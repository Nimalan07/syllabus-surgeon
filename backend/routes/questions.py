from fastapi import APIRouter, HTTPException
from models.schema import QuestionRequest
from services.llm_client import generate_questions

router = APIRouter()

@router.post("/questions")
def questions(request: QuestionRequest):
    try:
        return generate_questions(
            topic=request.topic,
            item=request.item,
            difficulty=request.difficulty,
            question_type=request.question_type,
            count=request.count,
        )
    except Exception as exc:
        raise HTTPException(500, str(exc))
