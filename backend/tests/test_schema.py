from datetime import date
from models.schema import SyllabusItem, Course, ExtractionResponse

def test_syllabus_item_with_string_nulls():
    raw = {
        "item": "Midterm Exam",
        "due_date": "null",
        "weight_percent": "null",
        "topic": "null",
        "notes": "none"
    }
    item = SyllabusItem.model_validate(raw)
    assert item.item == "Midterm Exam"
    assert item.due_date is None
    assert item.weight_percent is None
    assert item.topic is None
    assert item.notes is None

def test_syllabus_item_with_human_dates():
    for date_str, expected in [
        ("14 Aug 2026", date(2026, 8, 14)),
        ("23 Sep 2026", date(2026, 9, 23)),
        ("4 Dec 2026", date(2026, 12, 4)),
        ("2026-10-15", date(2026, 10, 15)),
        ("September 25, 2026", date(2026, 9, 25)),
    ]:
        item = SyllabusItem.model_validate({"item": "Assessment", "due_date": date_str})
        assert item.due_date == expected

def test_syllabus_item_with_percentage_string():
    raw = {
        "item": "Final Project",
        "due_date": "2026-10-15",
        "weight_percent": "35%",
        "topic": "Machine Learning"
    }
    item = SyllabusItem.model_validate(raw)
    assert str(item.due_date) == "2026-10-15"
    assert item.weight_percent == 35.0

def test_extraction_response_multi_course():
    raw = {
        "courses": [
            {
                "course_name": "Artificial Intelligence",
                "course_code": "CS501",
                "semester": "V",
                "items": [
                    {
                        "item": "Diagnostic Quiz",
                        "due_date": "14 Aug 2026",
                        "weight_percent": "5%",
                    }
                ]
            },
            {
                "course_name": "Cybersecurity",
                "course_code": "CS503",
                "semester": "V",
                "items": [
                    {
                        "item": "Midterm Exam",
                        "due_date": "23 Sep 2026",
                        "weight_percent": "20%",
                    }
                ]
            }
        ],
        "warnings": []
    }
    res = ExtractionResponse.model_validate(raw)
    assert len(res.courses) == 2
    assert res.courses[0].course_code == "CS501"
    assert res.courses[0].items[0].due_date == date(2026, 8, 14)
    assert res.courses[1].course_code == "CS503"
    assert res.courses[1].items[0].due_date == date(2026, 9, 23)
