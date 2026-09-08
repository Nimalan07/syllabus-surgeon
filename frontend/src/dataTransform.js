export function normalizeAssessment(assessment, course) {
  return {
    ...assessment,

    id: assessment.id,
    courseId: assessment.course_id,

    courseCode: course?.code || course?.course_code || "",
    courseName: course?.name || course?.course_name || "",
    course_code: course?.code || course?.course_code || "",
    course_name: course?.name || course?.course_name || "",

    title: assessment.title || assessment.item || "",
    item: assessment.title || assessment.item || "",
    description: assessment.description || "",

    assessmentType: assessment.assessment_type || "other",
    assessment_type: assessment.assessment_type || "other",

    officialDueDate: assessment.official_due_date || assessment.due_date || null,
    official_due_date: assessment.official_due_date || assessment.due_date || null,
    dueDate: assessment.official_due_date || assessment.due_date || null,
    due_date: assessment.official_due_date || assessment.due_date || null,

    targetDate: assessment.target_date || "",
    target_date: assessment.target_date || "",

    priority: assessment.priority || assessment.priority_level || "medium",
    priorityLevel: assessment.priority || assessment.priority_level || "medium",
    priority_level: assessment.priority || assessment.priority_level || "medium",

    status: assessment.status || (assessment.completed ? "completed" : "not_started"),
    completed: assessment.status === "completed" || Boolean(assessment.completed),

    estimatedHours: Number(assessment.estimated_hours || 1),
    completedHours: Number(assessment.completed_hours || 0),

    difficulty: assessment.difficulty,
    impact: assessment.impact,
    weight_percent: assessment.weight_percent != null ? Number(assessment.weight_percent) : null,
    topic: assessment.topic || "",
    recommended_action: assessment.recommended_action || "",
    why_prioritized: assessment.why_prioritized || "",
  };
}

export function normalizeStudySession(session, course) {
  return {
    ...session,

    id: session.id,
    courseId: session.course_id,
    assessmentId: session.assessment_id,

    courseCode: course?.code || course?.course_code || "",
    courseName: course?.name || course?.course_name || "",

    sessionDate: session.session_date,
    startTime: session.start_time,
    endTime: session.end_time,

    plannedMinutes: session.planned_minutes,
    actualMinutes: session.actual_minutes || session.completed_minutes || 0,

    status: session.status,
    notes: session.notes || "",
  };
}
