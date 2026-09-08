from datetime import date
from typing import Optional
from models.schema import SyllabusItem, Course

COURSE_TOPIC_HINTS = {
    "cybersecurity": [
        "zero-trust",
        "iam",
        "cloud logging",
        "cryptography",
        "network security",
        "incident response",
        "vulnerability",
        "threat",
        "soc",
        "penetration",
        "firewall",
    ],
    "entrepreneurship": [
        "business model",
        "customer discovery",
        "market",
        "pricing",
        "value proposition",
        "go-to-market",
        "pitch deck",
        "startup",
        "venture",
        "lean canvas",
    ],
    "machine learning": [
        "regression",
        "classification",
        "clustering",
        "neural network",
        "decision tree",
        "deep learning",
        "model evaluation",
        "supervised",
        "unsupervised",
    ],
    "data visualization": [
        "chart",
        "tableau",
        "power bi",
        "visual analytics",
        "dashboard",
        "storytelling",
        "d3",
    ],
    "business analytics": [
        "forecasting",
        "predictive",
        "prescriptive",
        "kpi",
        "optimization",
        "statistical model",
    ],
}


def realign_course_items(courses: list[Course], warnings: list[str]) -> list[Course]:
    """Ensure assessments belong to their correct course based on topic domain hints and prevent duplicates."""
    course_by_domain: dict[str, Course] = {}
    for c in courses:
        name_code = f"{c.course_code or ''} {c.course_name}".lower()
        for domain in COURSE_TOPIC_HINTS:
            if domain in name_code or any(part in name_code for part in domain.split()):
                course_by_domain[domain] = c

    for course in courses:
        current_domain = None
        curr_name_code = f"{course.course_code or ''} {course.course_name}".lower()
        for domain in COURSE_TOPIC_HINTS:
            if domain in curr_name_code or any(part in curr_name_code for part in domain.split()):
                current_domain = domain
                break

        retained_items: list[SyllabusItem] = []
        for item in course.items:
            item_text = f"{item.item} {item.topic or ''} {item.notes or ''}".lower()
            mismatched_domain = None

            for domain, keywords in COURSE_TOPIC_HINTS.items():
                if domain != current_domain and domain in course_by_domain:
                    has_mismatched = any(kw in item_text for kw in keywords)
                    has_current = current_domain and any(kw in item_text for kw in COURSE_TOPIC_HINTS[current_domain])
                    if has_mismatched and not has_current:
                        mismatched_domain = domain
                        break

            if mismatched_domain and mismatched_domain in course_by_domain:
                target_course = course_by_domain[mismatched_domain]
                existing_item = next(
                    (it for it in target_course.items if it.item.strip().lower() == item.item.strip().lower()),
                    None,
                )
                if not existing_item:
                    target_course.items.append(item)
                    warnings.append(
                        f"Reassigned '{item.item}' from {course.course_name} to {target_course.course_name} based on topic domain matching."
                    )
                else:
                    warnings.append(
                        f"Removed duplicate '{item.item}' from {course.course_name} (already present in {target_course.course_name})."
                    )
            else:
                retained_items.append(item)

        course.items = retained_items

    return courses


def calculate_priority(
    days_until_due: int | None,
    weight_percent: float | None,
) -> float:
    if days_until_due is None:
        return 0.0

    if days_until_due < 0:
        return 9999.0

    weight = weight_percent or 1.0
    urgency = 1 / (days_until_due + 1)

    return round(urgency * weight, 4)


def classify_priority(
    days_until_due: int | None,
    weight_percent: float | None,
) -> str:
    if days_until_due is None:
        return "unranked"

    if days_until_due < 0:
        return "overdue"

    if days_until_due <= 7:
        return "urgent"

    if weight_percent is not None:
        if weight_percent >= 30 and days_until_due > 30:
            return "high-impact"

        if weight_percent >= 20:
            return "medium"

    if days_until_due <= 21:
        return "medium"

    return "low"


def recommended_action(
    level: str,
    days_until_due: int | None,
) -> str:
    if level == "overdue":
        return "Submit immediately or contact the instructor."

    if level == "urgent":
        return "Work on this immediately."

    if level == "medium":
        return "Schedule dedicated study blocks this week."

    if level == "high-impact":
        return (
            "High grade impact but low immediate urgency. "
            "Begin weekly preparation and increase revision closer "
            "to the deadline."
        )

    if level == "low":
        return "Begin initial preparation as time permits."

    return "Confirm the missing date or weight before prioritizing."


def why_prioritized(
    level: str,
    days_until_due: int | None,
    weight_percent: float | None,
    item_name: str,
) -> str:
    if level == "overdue":
        overdue_days = abs(days_until_due or 0)
        return (
            f"{item_name} is overdue by {overdue_days} days"
            + (
                f" and contributes {weight_percent:g}% of the final grade."
                if weight_percent is not None
                else "."
            )
        )

    if level == "urgent":
        return (
            f"Due in {days_until_due} days"
            + (
                f" and worth {weight_percent:g}% of the final grade."
                if weight_percent is not None
                else "."
            )
        )

    if level == "medium":
        return (
            f"Due in {days_until_due} days"
            + (
                f"; worth {weight_percent:g}% of the final grade."
                if weight_percent is not None
                else "."
            )
        )

    if level == "high-impact":
        return (
            f"This assessment is worth {weight_percent:g}% of the final "
            f"grade, but it is due in {days_until_due} days."
        )

    if level == "low":
        return (
            f"Lower immediate urgency because it is due in "
            f"{days_until_due} days"
            + (
                f" and is worth {weight_percent:g}% of the final grade."
                if weight_percent is not None
                else "."
            )
        )

    return (
        "The date or weight is unclear, so this item is not ranked "
        "aggressively."
    )


def rank_items(
    items: list[SyllabusItem],
    today: date | None = None,
) -> list[SyllabusItem]:
    today = today or date.today()
    ranked: list[SyllabusItem] = []

    for item in items:
        days = (
            (item.due_date - today).days
            if item.due_date
            else None
        )

        level = classify_priority(
            days,
            item.weight_percent,
        )

        item.days_until_due = days
        item.priority_score = calculate_priority(
            days,
            item.weight_percent,
        )
        item.priority_level = level
        item.recommended_action = recommended_action(
            level,
            days,
        )
        item.why_prioritized = why_prioritized(
            level,
            days,
            item.weight_percent,
            item.item,
        )

        ranked.append(item)

    priority_order = {
        "overdue": 0,
        "urgent": 1,
        "medium": 2,
        "high-impact": 3,
        "low": 4,
        "unranked": 5,
    }

    return sorted(
        ranked,
        key=lambda item: (
            priority_order.get(item.priority_level, 99),
            item.due_date or date.max,
            -item.priority_score,
        ),
    )
