from datetime import date
from models.schema import SyllabusItem, Course
from services.priority_engine import (
    rank_items,
    calculate_priority,
    classify_priority,
    recommended_action,
    why_prioritized,
    realign_course_items,
)

def test_classify_and_recommended_actions():
    assert classify_priority(-3, 20.0) == "overdue"
    assert "Submit immediately" in recommended_action("overdue", -3)

    assert classify_priority(5, 10.0) == "urgent"
    assert "Work on this immediately" in recommended_action("urgent", 5)

    assert classify_priority(89, 35.0) == "high-impact"
    assert "High grade impact" in recommended_action("high-impact", 89)

    assert classify_priority(17, 20.0) == "medium"
    assert "Schedule dedicated study blocks" in recommended_action("medium", 17)

    assert classify_priority(45, 10.0) == "low"
    assert "Begin initial preparation" in recommended_action("low", 45)

    assert classify_priority(None, None) == "unranked"

def test_why_prioritized_text():
    why_exam = why_prioritized("high-impact", 89, 35.0, "Final exam")
    assert "35%" in why_exam
    assert "89 days" in why_exam

    why_overdue = why_prioritized("overdue", -2, 12.0, "Quiz")
    assert "overdue by 2 days" in why_overdue
    assert "12%" in why_overdue

def test_rank_items_order():
    items = [
        SyllabusItem(item="Final Exam", due_date=date(2026, 12, 4), weight_percent=35.0),
        SyllabusItem(item="Midterm Test", due_date=date(2026, 9, 20), weight_percent=20.0),
        SyllabusItem(item="Unranked Topic", due_date=None, weight_percent=None),
        SyllabusItem(item="Diagnostic Quiz", due_date=date(2026, 9, 6), weight_percent=5.0),
        SyllabusItem(item="Overdue Lab", due_date=date(2026, 9, 1), weight_percent=10.0),
    ]
    ranked = rank_items(items, today=date(2026, 9, 5))
    levels = [item.priority_level for item in ranked]
    # Order: overdue, urgent, medium, high-impact, unranked
    assert levels == ["overdue", "urgent", "medium", "high-impact", "unranked"]
    assert ranked[0].recommended_action != ""
    assert ranked[0].why_prioritized != ""

def test_realign_course_items():
    courses = [
        Course(
            course_name="Entrepreneurship and Product Strategy",
            course_code="CS505",
            items=[
                SyllabusItem(item="Pitch Deck", topic="Business model canvas"),
                SyllabusItem(item="Zero-trust presentation", topic="Zero-trust architecture and IAM"),
            ],
        ),
        Course(
            course_name="Cybersecurity and Cloud Infrastructure",
            course_code="CS502",
            items=[
                SyllabusItem(item="Vulnerability Assessment", topic="Penetration testing"),
            ],
        ),
    ]
    warnings = []
    realigned = realign_course_items(courses, warnings)
    # Zero-trust should be moved to Cybersecurity
    cs505 = next(c for c in realigned if c.course_code == "CS505")
    cs502 = next(c for c in realigned if c.course_code == "CS502")
    assert len(cs505.items) == 1
    assert cs505.items[0].item == "Pitch Deck"
    assert len(cs502.items) == 2
    assert any(it.item == "Zero-trust presentation" for it in cs502.items)
    assert len(warnings) == 1
