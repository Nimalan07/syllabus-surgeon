from fastapi import APIRouter, File, HTTPException, UploadFile

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
