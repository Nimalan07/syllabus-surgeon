export function normalizeAssessment(assessment, course) {
  const officialDue =
    assessment.official_due_date ||
    assessment.due_date ||
    assessment.officialDueDate ||
    null;
  const targetDate =
    assessment.target_date ||
    assessment.targetDate ||
    null;
  const status =
    assessment.status ||
    (assessment.completed ? "completed" : "not_started");
  const priority =
    assessment.priority ||
    assessment.priority_level ||
    assessment.priorityLevel ||
    "medium";

  return {
    ...assessment,

    id: assessment.id,
    courseId: assessment.course_id || course?.id,

    courseCode:
      course?.code ||
      course?.course_code ||
      assessment.courseCode ||
      assessment.course_code ||
      "",
    courseName:
      course?.name ||
      course?.course_name ||
      assessment.courseName ||
      assessment.course_name ||
      "",
    course_code:
      course?.code ||
      course?.course_code ||
      assessment.courseCode ||
      assessment.course_code ||
      "",
    course_name:
      course?.name ||
      course?.course_name ||
      assessment.courseName ||
      assessment.course_name ||
      "",

    title: assessment.title || assessment.item || "",
    item: assessment.title || assessment.item || "",
    description: assessment.description || "",

    assessmentType:
      assessment.assessment_type ||
      assessment.assessmentType ||
      "other",
    assessment_type:
      assessment.assessment_type ||
      assessment.assessmentType ||
      "other",

    officialDueDate: officialDue,
    official_due_date: officialDue,
    dueDate: officialDue,
    due_date: officialDue,

    targetDate: targetDate,
    target_date: targetDate,

    priority: priority,
    priorityLevel: priority,
    priority_level: priority,

    status: status,
    completed: status === "completed",

    estimatedHours: Number(
      assessment.estimated_hours ?? assessment.estimatedHours ?? 1
    ),
    completedHours: Number(
      assessment.completed_hours ?? assessment.completedHours ?? 0
    ),

    difficulty: assessment.difficulty || null,
    impact: assessment.impact || null,
    weight_percent:
      assessment.weight_percent != null
        ? Number(assessment.weight_percent)
        : null,
    topic: assessment.topic || "",
    recommended_action: assessment.recommended_action || "",
    why_prioritized: assessment.why_prioritized || "",
  };
}

export function normalizeStudySession(session, course) {
  return {
    ...session,

    id: session.id,
    courseId: session.course_id || session.courseId,
    assessmentId: session.assessment_id || session.assessmentId,

    courseCode: course?.code || course?.course_code || "",
    courseName: course?.name || course?.course_name || "",

    sessionDate: session.session_date || session.sessionDate,
    startTime: session.start_time || session.startTime,
    endTime: session.end_time || session.endTime,

    plannedMinutes: Number(session.planned_minutes || session.plannedMinutes || 60),
    actualMinutes: Number(
      session.actual_minutes ?? session.actualMinutes ?? session.completed_minutes ?? 0
    ),

    status: session.status || "planned",
    notes: session.notes || "",
  };
}
