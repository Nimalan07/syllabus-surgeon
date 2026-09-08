import json
import os
import re
from typing import Any
from dotenv import load_dotenv
import httpx

from models.schema import ExtractionResponse, QuestionResponse

load_dotenv()

SYSTEM = """
You are a careful academic syllabus parser.

Return only valid JSON.

Extract every course or subject in the syllabus. Never stop after
the first course. If the syllabus contains five subjects, return
five separate course objects in the courses array.

Each course must contain:
- course_name
- course_code
- semester
- its own assessment items

Course ownership rules:
- Every assessment must belong to exactly one course.
- Do not assign an assessment to a course based only on its position in the document.
- Use the nearest course heading, course code, and the assessment's topic to determine ownership.
- Cybersecurity topics such as zero-trust, IAM, cloud logging, cryptography, network security, and incident response must belong to the cybersecurity course.
- Entrepreneurship topics such as business model, customer discovery, market sizing, value proposition, pitch deck, and go-to-market must belong to the entrepreneurship course.
- If an assessment's course cannot be determined confidently, place it in the warnings list instead of assigning it randomly.

Extract every gradable item, including:
- exams
- midterms
- final exams
- quizzes
- assignments
- projects
- presentations
- laboratories
- reports
- participation
- practical assessments

Never invent dates or weights.

For missing values, return JSON null, never the string "null".
Use date format YYYY-MM-DD.
Use date_confidence as high, medium, low, or unknown.

Topic specificity rules:
- For each assessment, include only the topics relevant to that assessment.
- Do not use the entire course topic list for a midterm unless the syllabus explicitly states that the midterm is cumulative.
- Use the weekly schedule and assessment date to identify the topics covered before the assessment.
- If the assessment date is September 23, include only topics taught before September 23.
- For final exams, use the complete topic list only when the syllabus says the exam is cumulative.
- If relevant topics cannot be determined confidently, return null.

Preserve the exact course name and course code when available.
"""


def _settings() -> tuple[str, str, str]:
    provider = os.getenv("LLM_PROVIDER", "ollama").lower()

    if provider == "groq":
        api_key = os.getenv("GROQ_API_KEY", "")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not configured. Please set it in .env or use LLM_PROVIDER=ollama.")
        return (
            api_key,
            os.getenv(
                "GROQ_BASE_URL",
                "https://api.groq.com/openai/v1",
            ),
            os.getenv(
                "GROQ_MODEL",
                "llama-3.3-70b-versatile",
            ),
        )

    return (
        os.getenv("OLLAMA_API_KEY", "ollama-local"),
        os.getenv(
            "OLLAMA_BASE_URL",
            "http://localhost:11434/v1",
        ),
        os.getenv(
            "OLLAMA_MODEL",
            "llama3.1:8b",
        ),
    )


def _chat(
    messages: list[dict[str, str]],
    temperature: float = 0,
) -> str:
    api_key, base_url, model = _settings()

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "response_format": {"type": "json_object"},
    }

    try:
        with httpx.Client(timeout=120) as client:
            response = client.post(
                f"{base_url.rstrip('/')}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]

    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"LLM request failed: {exc.response.text}"
        ) from exc


def _json_object(raw: str) -> Any:
    text = raw.strip()

    # 1. Try markdown code block extraction
    code_block_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if code_block_match:
        block_content = code_block_match.group(1).strip()
        try:
            return json.loads(block_content)
        except json.JSONDecodeError:
            try:
                obj, _ = json.JSONDecoder().raw_decode(block_content)
                return obj
            except json.JSONDecodeError:
                pass

    # 2. Try direct json.loads
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 3. Find the first '{' or '[' and parse with JSONDecoder.raw_decode
    start_brace = text.find('{')
    start_bracket = text.find('[')
    starts = [p for p in [start_brace, start_bracket] if p != -1]

    if starts:
        first_pos = min(starts)
        candidate = text[first_pos:]
        try:
            obj, _ = json.JSONDecoder().raw_decode(candidate)
            return obj
        except json.JSONDecodeError:
            pass

    # 4. Fallback regex search
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            try:
                obj, _ = json.JSONDecoder().raw_decode(match.group(0))
                return obj
            except json.JSONDecodeError:
                pass

    raise ValueError("The model did not return a valid JSON object.")


def extract_syllabus(text: str) -> ExtractionResponse:
    prompt = f"""
Extract every subject/course in the syllabus.

Important requirements:

1. Do not stop after the first course. If there are five subjects, return five course objects.
2. Every assessment must belong to exactly one course based on heading and topic context.
   - For example: Cybersecurity topics (zero-trust, IAM, security) must belong to the cybersecurity course, NOT entrepreneurship or business analytics.
3. Keep each course's assessments inside that course. Do not merge all assessments into one course.
4. Do not duplicate the complete topic list for every assessment.
   - For a midterm, include only topics covered before that date.
   - For a final exam, include the complete course topic list only if it is cumulative.
5. Return an empty courses array only if no course can be detected.

Return exactly this JSON structure:

{{
  "courses": [
    {{
      "course_name": "string",
      "course_code": "string or null",
      "semester": "string or null",
      "items": [
        {{
          "item": "string",
          "due_date": "YYYY-MM-DD or null",
          "weight_percent": "number or null",
          "topic": "string or null",
          "date_confidence": "high, medium, low, or unknown",
          "notes": "string or null"
        }}
      ]
    }}
  ],
  "warnings": []
}}

Syllabus text:
{text}
"""

    raw = _chat(
        [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": prompt},
        ]
    )

    result = ExtractionResponse.model_validate(
        _json_object(raw)
    )

    if not result.courses:
        result.warnings.append(
            "No courses were detected in the uploaded syllabus."
        )

    return result


def generate_questions(
    topic: str,
    item: str | None = None,
    difficulty: str = "medium",
    question_type: str = "mixed",
    count: int = 5,
) -> QuestionResponse:
    prompt = f"""
Generate {count} academic practice questions for this topic and assessment:

Topic: {topic}
Assessment: {item or "Not specified"}
Difficulty: {difficulty} (easy, medium, or hard)
Question Type: {question_type} (multiple_choice, short_answer, long_answer, or mixed)

Return strictly a JSON object with this format:
{{
  "topic": "{topic}",
  "difficulty": "{difficulty}",
  "question_type": "{question_type}",
  "questions": [
    "Question 1 text...",
    "Question 2 text..."
  ],
  "items": [
    {{
      "question": "Question text here",
      "options": ["A) Choice 1", "B) Choice 2", "C) Choice 3", "D) Choice 4"],
      "answer": "Correct answer / Option letter & description",
      "explanation": "Detailed explanation of why this answer is correct and key concepts involved.",
      "question_type": "multiple_choice"
    }}
  ]
}}

Guidelines:
- If question_type is "multiple_choice", provide 4 options ("A) ...", "B) ...", "C) ...", "D) ...") for each item.
- If question_type is "short_answer" or "long_answer", options can be an empty array [].
- If question_type is "mixed", combine multiple choice and conceptual short/long answer questions.
- Always include an accurate answer and thorough step-by-step explanation for each question item.
"""

    raw = _chat(
        [
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
    )

    parsed = _json_object(raw)

    # Ensure items array exists or fall back from questions list
    if "items" not in parsed or not parsed["items"]:
        if "questions" in parsed and isinstance(parsed["questions"], list):
            parsed["items"] = [
                {
                    "question": q if isinstance(q, str) else str(q),
                    "options": [],
                    "answer": "Review topic materials for reference.",
                    "explanation": "Refer to the course notes for detailed solutions.",
                    "question_type": question_type,
                }
                for q in parsed["questions"]
            ]

    # Ensure questions list is populated from items if missing
    if ("questions" not in parsed or not parsed["questions"]) and "items" in parsed:
        parsed["questions"] = [
            it.get("question", "") if isinstance(it, dict) else str(it)
            for it in parsed["items"]
        ]

    return QuestionResponse.model_validate(parsed)
