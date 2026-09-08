from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from core.auth import CurrentUser, bearer_scheme, get_current_user
from core.database import get_db
from models.database import Assessment, Course, Workspace
from services.pdf_parser import (
    PDFExtractionError,
    extract_text,
)
from services.llm_client import extract_syllabus
from services.priority_engine import rank_items, realign_course_items

router = APIRouter()


@router.post("/upload")
async def upload_syllabus(
    file: UploadFile = File(...),
    workspace_id: str | None = Form(default=None),
    db: Session = Depends(get_db),
):
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF file.",
        )

    try:
        pdf_bytes = await file.read()
        text = extract_text(pdf_bytes)

        result = extract_syllabus(text)

        if not result.courses:
            raise HTTPException(
                status_code=422,
                detail="No subjects were detected in this syllabus.",
            )

        # 1. Realign items if AI misallocated an assessment to the wrong course
        result.courses = realign_course_items(result.courses, result.warnings)

        total_items = 0

        # 2. Rank each course's assessments and attach course labels and stable ID
        for course in result.courses:
            course.items = rank_items(course.items)

            for item in course.items:
                item.course_name = course.course_name
                item.course_code = course.course_code
                item.id = "|".join([
                    course.course_code or "",
                    item.item,
                    item.due_date.isoformat() if item.due_date else "no-date",
                ])

            total_items += len(course.items)

        if total_items == 0:
            result.warnings.append(
                "Courses were detected, but no assessments were found."
            )

        # 3. If workspace_id is provided and valid, auto-persist to PostgreSQL
        if workspace_id:
            try:
                ws_uuid = UUID(workspace_id)
                workspace = db.scalar(select(Workspace).where(Workspace.id == ws_uuid))
                if workspace:
                    for c in result.courses:
                        db_course = Course(
                            workspace_id=ws_uuid,
                            code=c.course_code,
                            name=c.course_name or "Course",
                            description=c.description,
                        )
                        db.add(db_course)
                        db.flush()

                        for it in c.items:
                            db_assess = Assessment(
                                course_id=db_course.id,
                                title=it.item,
                                topic=it.topic,
                                official_due_date=it.due_date,
                                target_date=it.target_date,
                                weight_percent=it.weight_percent,
                                priority=it.priority_level or "medium",
                                status="not_started",
                                recommended_action=it.recommended_action,
                                why_prioritized=it.why_prioritized,
                            )
                            db.add(db_assess)

                    db.commit()
            except Exception as persist_err:
                # Log but don't fail response
                print(f"Warning: could not auto-persist to DB: {persist_err}")

        return result

    except PDFExtractionError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        )

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )
