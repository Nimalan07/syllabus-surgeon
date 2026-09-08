import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api/client.js";
import {
  getWorkspaces,
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getCourses,
  createCourse,
  getCourse,
  updateCourse,
  deleteCourse,
  getAssessments,
  createAssessment,
  getAssessment,
  updateAssessment,
  deleteAssessment,
  getStudySessions,
  createStudySession,
  getStudySession,
  updateStudySession,
  deleteStudySession,
} from "./api.js";
import { normalizeAssessment, normalizeStudySession } from "./dataTransform.js";
import "./styles.css";

const API = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://localhost:8000";

const STORAGE_KEYS = {
  authToken: "syllabus-surgeon-auth-token",
  user: "syllabus-surgeon-user",
  currentWorkspace: "syllabus-surgeon-current-workspace",
  plan: "syllabus-surgeon-plan",
  targetDates: "syllabus-surgeon-target-dates",
  completed: "syllabus-surgeon-completed",
  filters: "syllabus-surgeon-filters",
  studyPrefs: "syllabus-surgeon-study-prefs",
  practiceHistory: "syllabus-surgeon-practice-history",
};

const PRIORITY_ORDER = {
  overdue: 0,
  urgent: 1,
  medium: 2,
  "high-impact": 3,
  low: 4,
  unranked: 5,
};

function getAssessmentId(item) {
  if (item.id) return String(item.id);
  return [
    item.course_code || "",
    item.item || item.title || "",
    item.due_date || "no-date",
  ].join("|");
}

function formatDate(value) {
  if (!value) return "Not specified";
  try {
    const parts = value.split("-");
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function getCourseLabel(item) {
  const code = (item.course_code || "").trim();
  let name = (item.course_name || "").trim();

  if (!code) return name || "Unknown course";
  if (!name) return code;

  name = name.replace(new RegExp(`^${code}\\s*[:\\-\\–]?\\s*`, "i"), "").trim();
  return `${code} · ${name}`;
}

function getStatusText(item) {
  if (item.days_until_due == null) {
    return "Date unclear";
  }
  if (item.days_until_due < 0) {
    return `Overdue by ${Math.abs(item.days_until_due)} days`;
  }
  if (item.days_until_due === 0) {
    return "Due today";
  }
  if (item.days_until_due === 1) {
    return "Due tomorrow";
  }
  return `${item.days_until_due} days left`;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* =========================================================================
   STEP 11: CALENDAR HELPER FUNCTIONS
   ========================================================================= */
const CALENDAR_START_HOUR = 8;
const CALENDAR_END_HOUR = 22;
const SLOT_HEIGHT = 64;

function getStartOfWeek(date = new Date()) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);

  return result;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseTimeToMinutes(time) {
  if (!time) return 0;

  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(
    remainingMinutes
  ).padStart(2, "0")}`;
}

function formatCalendarTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${displayHour} ${suffix}`;
}

function getWeekDates(weekStart) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
}

function getSessionStyle(session) {
  const startTime = session.start_time || session.startTime;
  const endTime = session.end_time || session.endTime;
  const startMinutes = parseTimeToMinutes(startTime || "09:00");
  const endMinutes = parseTimeToMinutes(endTime || "10:00");

  const calendarStartMinutes = CALENDAR_START_HOUR * 60;
  const top = Math.max(
    0,
    ((startMinutes - calendarStartMinutes) / 60) * SLOT_HEIGHT
  );

  const height = Math.max(
    36,
    ((endMinutes - startMinutes) / 60) * SLOT_HEIGHT
  );

  return {
    top,
    height,
  };
}

/* =========================================================================
   STEP 12: ANALYTICS HELPER FUNCTIONS
   ========================================================================= */
function calculateAnalytics(assessments = [], studySessions = []) {
  const totalAssessments = assessments.length;

  const completedAssessments = assessments.filter(
    (assessment) => assessment.status === "completed"
  ).length;

  const inProgressAssessments = assessments.filter(
    (assessment) => assessment.status === "in_progress"
  ).length;

  const plannedMinutes = studySessions.reduce(
    (total, session) =>
      total + Number(session.planned_minutes || session.plannedMinutes || 0),
    0
  );

  const actualMinutes = studySessions.reduce(
    (total, session) =>
      total + Number(session.actual_minutes || session.actualMinutes || 0),
    0
  );

  const completionPercentage =
    totalAssessments === 0
      ? 0
      : Math.round((completedAssessments / totalAssessments) * 100);

  return {
    totalAssessments,
    completedAssessments,
    inProgressAssessments,
    plannedMinutes,
    actualMinutes,
    completionPercentage,
  };
}

function calculateCourseProgress(courses = [], assessments = []) {
  return courses.map((course) => {
    const courseAssessments = assessments.filter(
      (assessment) =>
        (assessment.course_id || assessment.courseId) === course.id ||
        (assessment.course_code || assessment.courseCode) === (course.course_code || course.code)
    );

    const completed = courseAssessments.filter(
      (assessment) => assessment.status === "completed"
    ).length;

    const total = courseAssessments.length;

    return {
      course,
      completed,
      total,
      percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  });
}

function getAssessmentTiming(assessment) {
  const targetDate =
    assessment.target_date ||
    assessment.targetDate ||
    assessment.official_due_date ||
    assessment.officialDueDate ||
    assessment.due_date;

  if (!targetDate) {
    return "No target date";
  }

  if (assessment.status === "completed") {
    return "Completed";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${targetDate}T00:00:00`);
  const difference =
    Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

  if (difference < 0) {
    return `${Math.abs(difference)} day(s) overdue`;
  }

  if (difference === 0) {
    return "Due today";
  }

  return `${difference} day(s) remaining`;
}

function getMonthCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const startDay = (firstDay.getDay() + 6) % 7; // Monday = 0

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();

  const days = [];

  for (let index = startDay - 1; index >= 0; index -= 1) {
    const date = new Date(year, month - 1, previousMonthDays - index);
    days.push({
      date,
      dateKey: toDateKey(date),
      isCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    days.push({
      date,
      dateKey: toDateKey(date),
      isCurrentMonth: true,
    });
  }

  let nextDay = 1;
  while (days.length < 42) {
    const date = new Date(year, month + 1, nextDay);
    days.push({
      date,
      dateKey: toDateKey(date),
      isCurrentMonth: false,
    });
    nextDay += 1;
  }

  return days;
}

function generateICSFile(assessments, targetDates) {
  const escapeICS = (str) =>
    (str || "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Syllabus Surgeon//Smart Study Workspace//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Syllabus Surgeon Academic Schedule",
  ];

  assessments.forEach((item, idx) => {
    const id = getAssessmentId(item);
    const targetDate = targetDates[id] || item.target_date;
    const title = item.title || item.item;
    const course = item.course_code ? `${item.course_code}: ${item.course_name || ""}` : item.course_name || "";
    const weight = item.weight_percent != null ? `${item.weight_percent}%` : "N/A";
    const status = item.priority_level || item.status || "unranked";

    // 1. Official Due Date Event
    if (item.due_date) {
      const dueClean = item.due_date.replace(/-/g, "");
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:due-${idx}-${dueClean}@syllabussurgeon.local`);
      lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`);
      lines.push(`DTSTART;VALUE=DATE:${dueClean}`);
      lines.push(`SUMMARY:📅 [DUE] ${escapeICS(title)} (${escapeICS(item.course_code || "Course")})`);
      lines.push(
        `DESCRIPTION:${escapeICS(
          `Course: ${course}\nAssessment: ${title}\nGrade Weight: ${weight}\nPriority: ${status.toUpperCase()}\nTopics: ${item.topic || "N/A"}\nWhy Prioritized: ${item.why_prioritized || ""}\nRecommended Action: ${item.recommended_action || ""}`
        )}`
      );
      lines.push(`CATEGORIES:ACADEMIC,DUE DATE,${escapeICS(item.course_code || "")}`);
      lines.push("STATUS:CONFIRMED");
      lines.push("END:VEVENT");
    }

    // 2. Student Target Preparation Date Event
    if (targetDate) {
      const targetClean = targetDate.replace(/-/g, "");
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:target-${idx}-${targetClean}@syllabussurgeon.local`);
      lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`);
      lines.push(`DTSTART;VALUE=DATE:${targetClean}`);
      lines.push(`SUMMARY:🎯 [TARGET] Prep: ${escapeICS(title)} (${escapeICS(item.course_code || "Course")})`);
      lines.push(
        `DESCRIPTION:${escapeICS(
          `Target Study Date for: ${title}\nOfficial Due Date: ${item.due_date || "Not set"}\nGrade Weight: ${weight}\nTopics to revise: ${item.topic || "N/A"}`
        )}`
      );
      lines.push(`CATEGORIES:STUDY TARGET,${escapeICS(item.course_code || "")}`);
      lines.push("STATUS:CONFIRMED");
      lines.push("END:VEVENT");
    }
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function calculateDailyStudyPlan(assessments, targetDates, completedItems) {
  const uncompleted = assessments.filter((it) => {
    const id = getAssessmentId(it);
    return !(completedItems[id]?.completed || it.completed);
  });

  if (uncompleted.length === 0) return [];

  const todayStr = toDateKey(new Date());

  const scored = uncompleted.map((it) => {
    const id = getAssessmentId(it);
    const target = targetDates[id] || it.target_date;
    const weight = it.weight_percent != null ? Number(it.weight_percent) : 5;
    const days = it.days_until_due;

    let score = 0;
    let workloadMinutes = 45;
    let reason = "";

    // 1. Overdue items have highest urgency
    if (days != null && days < 0) {
      score += 1000 + Math.abs(days) * 15;
      workloadMinutes = weight >= 15 ? 90 : 60;
      reason = `Overdue by ${Math.abs(days)} day${Math.abs(days) > 1 ? "s" : ""}; immediate completion required (${weight}% weight).`;
    }
    // 2. Target date is today or already passed
    else if (target && target <= todayStr) {
      score += 800;
      workloadMinutes = weight >= 20 ? 90 : 60;
      reason = `Matches your scheduled target prep date (${target === todayStr ? "Today" : "Overdue target"}).`;
    }
    // 3. Due within 7 days
    else if (days != null && days <= 7) {
      score += 500 + (7 - days) * 20 + weight;
      workloadMinutes = weight >= 20 ? 75 : days <= 2 ? 60 : 45;
      reason = `Deadline approaching in ${days === 0 ? "today" : days === 1 ? "tomorrow" : `${days} days`} (${weight}% weight).`;
    }
    // 4. High-impact milestone (weight >= 20%)
    else if (weight >= 20) {
      score += 300 + weight * 2;
      workloadMinutes = 60;
      reason = `High-impact milestone (${weight}% of final grade); consistent weekly revision prevents cramming.`;
    }
    // 5. Due within 21 days
    else if (days != null && days <= 21) {
      score += 150 + (21 - days) * 5 + weight;
      workloadMinutes = 45;
      reason = `Due in ${days} days; progressive preparation recommended (${weight}% weight).`;
    }
    // 6. Regular revision
    else {
      score += 50 + weight;
      workloadMinutes = 30;
      reason = `Gradual study topic to maintain long-term retention (${weight}% weight).`;
    }

    return {
      ...it,
      dailyScore: score,
      workloadMinutes,
      dailyReason: reason,
    };
  });

  scored.sort((a, b) => b.dailyScore - a.dailyScore);
  return scored.slice(0, 5);
}

function StatCard({ value, label, icon, isProgress = false, progressPercent = 0, subtitle = "" }) {
  if (isProgress) {
    return (
      <div className="stat-card stat-progress">
        <div>
          <strong>{value}</strong>
          <span>{label}</span>
          {subtitle && <small className="stat-sub">{subtitle}</small>}
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        {subtitle && <small className="stat-sub">{subtitle}</small>}
      </div>
    </div>
  );
}

function PriorityBadge({ status }) {
  const labels = {
    overdue: "OVERDUE",
    urgent: "URGENT",
    medium: "MEDIUM",
    "high-impact": "HIGH IMPACT · LONG-TERM",
    low: "LOW",
    completed: "COMPLETED",
    unranked: "UNRANKED",
  };

  return (
    <span className={`priority-badge ${status}`}>
      {labels[status] || status.toUpperCase()}
    </span>
  );
}

/* =========================================================================
   ASSESSMENT DETAIL DRAWER (PANEL)
   ========================================================================= */
const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const STATUS_OPTIONS = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

/* =========================================================================
   ASSESSMENT DETAIL DRAWER (PANEL)
   ========================================================================= */
function AssessmentDetailDrawer({
  item,
  onClose,
  targetDate,
  isCompleted,
  onToggleComplete,
  onSetTargetDate,
  onSaveAssessmentChanges,
  onCompletedHoursChange,
  onPractice,
  onScheduleSession,
}) {
  if (!item) return null;

  const title = item.title || item.item;
  const currentStatus = isCompleted ? "completed" : item.status || "not_started";
  const priority = item.priority || item.priority_level || "medium";
  const weight = item.weight_percent != null ? item.weight_percent : item.weight;
  const estimatedHrs = item.estimatedHours ?? item.estimated_hours ?? 1;
  const completedHrs = item.completedHours ?? item.completed_hours ?? 0;
  const officialDue = item.officialDueDate || item.official_due_date || item.due_date;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="assessment-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <span className="drawer-eyebrow">ASSESSMENT DETAILS</span>
            <h2>{title}</h2>
            <p className="drawer-course">{getCourseLabel(item)}</p>
          </div>
          <button className="drawer-close" onClick={onClose} title="Close panel">
            ✕
          </button>
        </div>

        <div className="drawer-body">
          <div className="drawer-status-row">
            <PriorityBadge status={currentStatus === "completed" ? "completed" : priority} />
            <button
              className={`btn-drawer-complete ${isCompleted ? "completed" : ""}`}
              onClick={() => onToggleComplete(item)}
            >
              {isCompleted ? "✓ Completed" : "○ Mark as completed"}
            </button>
          </div>

          <div className="drawer-meta-grid">
            <div className="drawer-meta-cell">
              <span className="meta-label">Official Deadline</span>
              <strong>{formatDate(officialDue)}</strong>
              <small className={`status-highlight ${currentStatus}`}>{getStatusText(item)}</small>
            </div>

            <div className="drawer-meta-cell">
              <span className="meta-label">Your Target Date</span>
              <strong style={{ color: targetDate ? "var(--target)" : "var(--muted)" }}>
                {targetDate ? formatDate(targetDate) : "Not set"}
              </strong>
              <small>Personal preparation milestone</small>
            </div>
          </div>

          {/* Quick Editing Controls */}
          <div className="drawer-section">
            <span className="drawer-section-title">Assessment Management & Tracking</span>
            <div className="drawer-meta-grid" style={{ marginTop: 4 }}>
              <div className="drawer-meta-cell">
                <span className="meta-label">Priority Level</span>
                <select
                  className="studio-select"
                  style={{ width: "100%", marginTop: 4 }}
                  value={priority}
                  onChange={(e) =>
                    onSaveAssessmentChanges(item.id, { priority: e.target.value })
                  }
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} Priority
                    </option>
                  ))}
                </select>
              </div>

              <div className="drawer-meta-cell">
                <span className="meta-label">Workflow Status</span>
                <select
                  className="studio-select"
                  style={{ width: "100%", marginTop: 4 }}
                  value={currentStatus}
                  onChange={(e) =>
                    onSaveAssessmentChanges(item.id, { status: e.target.value })
                  }
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Study Hours Tracking */}
          <div className="drawer-section">
            <span className="drawer-section-title">Study Hours & Effort</span>
            <div className="drawer-meta-grid">
              <div className="drawer-meta-cell">
                <span className="meta-label">Estimated Hours</span>
                <input
                  type="number"
                  className="studio-input"
                  min="0"
                  step="0.25"
                  style={{ marginTop: 4 }}
                  value={estimatedHrs}
                  onChange={(e) =>
                    onSaveAssessmentChanges(item.id, {
                      estimated_hours: Number(e.target.value),
                    })
                  }
                />
              </div>

              <div className="drawer-meta-cell">
                <span className="meta-label">Completed Hours</span>
                <input
                  type="number"
                  className="studio-input"
                  min="0"
                  step="0.25"
                  style={{ marginTop: 4 }}
                  value={completedHrs}
                  onChange={(e) =>
                    onCompletedHoursChange(item, e.target.value)
                  }
                />
              </div>
            </div>
          </div>

          <div className="drawer-section">
            <span className="drawer-section-title">Grade Weight</span>
            <div className="drawer-topic-box">
              <p>
                <strong>Weight:</strong> {weight != null ? `${weight}%` : "Not specified"}
                {weight != null && " · Contributes directly to final course grade."}
              </p>
            </div>
          </div>

          <div className="drawer-section">
            <span className="drawer-section-title">Topics & Modules Covered</span>
            <div className="drawer-topic-box">
              <p>{item.topic || "Specific syllabus module not defined."}</p>
            </div>
          </div>

          <div className="drawer-section">
            <span className="drawer-section-title">Why this was prioritized</span>
            <div className="drawer-reason-box">
              <p>{item.why_prioritized || item.why || "Prioritization derived from urgency and grade weight."}</p>
            </div>
          </div>

          <div className="drawer-section">
            <span className="drawer-section-title">Recommended action</span>
            <div className="drawer-action-box">
              <p>{item.recommended_action || item.action || "Begin scheduled study sessions for this milestone."}</p>
            </div>
          </div>

          <div className="drawer-section">
            <span className="drawer-section-title">Personal Target Preparation Date</span>
            <div className="drawer-target-picker">
              <input
                type="date"
                className="target-date-input"
                value={targetDate || ""}
                onChange={(e) => onSetTargetDate(item, e.target.value)}
              />
              {targetDate && (
                <button
                  className="btn-clear-target"
                  onClick={() => onSetTargetDate(item, "")}
                  title="Remove target date"
                >
                  Clear date
                </button>
              )}
            </div>
            <small className="target-date-hint">
              Setting a personal target date schedules your preparation milestone without altering the official syllabus deadline.
            </small>
          </div>
        </div>

        <div className="drawer-footer" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {onScheduleSession && (
            <button
              className="btn-drawer-practice"
              style={{ background: "var(--purple-soft)", color: "var(--purple-dark)", boxShadow: "none" }}
              onClick={() => {
                onClose();
                onScheduleSession(item);
              }}
            >
              <span>⏱ Schedule a study session</span>
              <span>+</span>
            </button>
          )}

          {item.topic && (
            <button
              className="btn-drawer-practice"
              onClick={() => {
                onClose();
                onPractice(item);
              }}
            >
              <span>✦ Practice this topic</span>
              <span>→</span>
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

/* =========================================================================
   ASSESSMENT CARD COMPONENT
   ========================================================================= */
function AssessmentCard({
  item,
  targetDate,
  isCompleted,
  onToggleComplete,
  onSetTargetDate,
  onSaveAssessmentChanges,
  onCompletedHoursChange,
  onPractice,
  onClickDetail,
}) {
  const title = item.title || item.item;
  const currentStatus = isCompleted ? "completed" : item.status || "not_started";
  const priority = item.priority || item.priority_level || "medium";
  const statusText = isCompleted ? "Completed" : getStatusText(item);
  const weight = item.weight_percent != null ? item.weight_percent : item.weight;
  const officialDue = item.officialDueDate || item.official_due_date || item.due_date;
  const estimatedHrs = item.estimatedHours ?? item.estimated_hours ?? 1;
  const completedHrs = item.completedHours ?? item.completed_hours ?? 0;

  return (
    <article
      className={`assessment-card ${isCompleted ? "is-completed" : ""}`}
      onClick={() => onClickDetail(item)}
    >
      <div className="assessment-top">
        <div>
          <p className="course-label">{getCourseLabel(item)}</p>
          <h3 className="card-clickable-title">{title}</h3>
        </div>

        <div className="assessment-top-right" onClick={(e) => e.stopPropagation()}>
          <button
            className={`btn-complete-toggle ${isCompleted ? "completed" : ""}`}
            onClick={() => onToggleComplete(item)}
            title={isCompleted ? "Mark as uncompleted" : "Mark as completed"}
          >
            {isCompleted ? "✓ Completed" : "○ Mark complete"}
          </button>
          <PriorityBadge status={isCompleted ? "completed" : priority} />
        </div>
      </div>

      <div className="topic-box">
        <span className="topic-label">Topics covered</span>
        <p>{item.topic || "Topics not specified in the syllabus."}</p>
      </div>

      <div className="assessment-meta">
        <div>
          <span>Official deadline</span>
          <strong>{formatDate(officialDue)}</strong>
        </div>

        <div>
          <span>Your target</span>
          <strong style={{ color: targetDate ? "var(--target)" : "var(--muted)" }}>
            {targetDate ? formatDate(targetDate) : "Not set"}
          </strong>
        </div>

        <div>
          <span>Grade weight</span>
          <strong>{weight != null ? `${weight}%` : "Not specified"}</strong>
        </div>

        <div>
          <span>Study progress</span>
          <strong>{completedHrs} / {estimatedHrs} hrs</strong>
        </div>
      </div>

      {item.date_confidence &&
        item.date_confidence !== "high" &&
        item.date_confidence !== "user_set" &&
        priority !== "unranked" &&
        !isCompleted && (
          <div className="warning-banner">⚠ Date was inferred and needs confirmation</div>
        )}

      <div className="reason-box">
        <strong>Why this is prioritized</strong>
        <p>{item.why_prioritized || item.why || "Ranking is based on available date and weight details."}</p>
      </div>

      <div className="action-box">
        <strong>Recommended action</strong>
        <p>{item.recommended_action || item.action || "Prepare for this assessment according to your timeline."}</p>
      </div>

      <div className="assessment-footer" onClick={(e) => e.stopPropagation()}>
        <div className="target-date-control">
          <span className="label-text">
            🎯 Target date: {targetDate ? formatDate(targetDate) : "Not set"}
          </span>
          <div className="target-date-input-group">
            <input
              type="date"
              className="target-date-input"
              value={targetDate || ""}
              onChange={(e) => onSetTargetDate(item, e.target.value)}
            />
            {targetDate && (
              <button
                className="btn-clear-target"
                onClick={() => onSetTargetDate(item, "")}
                title="Clear target date"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {item.topic && (
          <button className="practice-button" onClick={() => onPractice(item)}>
            Practice this topic
            <span>→</span>
          </button>
        )}
      </div>
    </article>
  );
}

/* =========================================================================
   CALENDAR VIEW
   ========================================================================= */
function CalendarView({
  assessments,
  targetDates,
  courseFilter,
  setCourseFilter,
  priorityFilter,
  setPriorityFilter,
  searchQuery,
  setSearchQuery,
  subjectOptions,
  getPriorityCount,
  onClickDetail,
}) {
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  function moveMonth(amount) {
    setCalendarMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + amount, 1)
    );
  }

  function goToToday() {
    const today = new Date();
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  const calendarDays = useMemo(() => getMonthCalendarDays(calendarMonth), [calendarMonth]);

  const filteredAssessments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return assessments.filter((item) => {
      const isCompleted = item.completed;
      const status = item.priority_level || item.status || "unranked";

      const matchesPriority =
        priorityFilter === "all" ||
        (priorityFilter === "completed" ? isCompleted : status === priorityFilter);

      const matchesCourse =
        courseFilter === "all" ||
        item.course_code === courseFilter ||
        item.course_name === courseFilter;

      const searchableText = [
        item.title,
        item.item,
        item.topic,
        item.course_code,
        item.course_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);

      return matchesPriority && matchesCourse && matchesSearch;
    });
  }, [assessments, priorityFilter, courseFilter, searchQuery]);

  // Group events by date (both official due dates AND student target dates)
  const eventsByDate = useMemo(() => {
    const grouped = {};

    filteredAssessments.forEach((item) => {
      const id = getAssessmentId(item);
      const targetDate = targetDates[id] || item.target_date;

      // 1. Official Due Date entry
      if (item.due_date) {
        if (!grouped[item.due_date]) grouped[item.due_date] = [];
        grouped[item.due_date].push({
          ...item,
          eventType: "due",
        });
      }

      // 2. Student Target Date entry
      if (targetDate) {
        if (!grouped[targetDate]) grouped[targetDate] = [];
        grouped[targetDate].push({
          ...item,
          eventType: "target",
        });
      }
    });

    return grouped;
  }, [filteredAssessments, targetDates]);

  const todayKey = toDateKey(new Date());

  const monthTitle = calendarMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <section className="calendar-section-wrapper">
      <div className="calendar-toolbar">
        <div className="calendar-toolbar-top">
          <div>
            <span className="eyebrow">ACADEMIC CALENDAR</span>
            <h2>{monthTitle}</h2>
            <p>
              Showing official deadlines (📅) and student target preparation dates (🎯). Click any event for full details.
            </p>
          </div>

          <div className="calendar-actions">
            <button className="calendar-nav-button" onClick={goToToday}>
              Today
            </button>
            <button className="calendar-nav-button" onClick={() => moveMonth(-1)} aria-label="Previous month">
              ←
            </button>
            <button className="calendar-nav-button" onClick={() => moveMonth(1)} aria-label="Next month">
              →
            </button>
          </div>
        </div>

        <div className="calendar-filters">
          <select
            className="course-filter-select"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="all">All subjects ({assessments.length} total)</option>
            {subjectOptions.map((c) => (
              <option key={c.code || c.name} value={c.code || c.name}>
                {c.code ? `${c.code}: ${c.name}` : c.name} ({c.count})
              </option>
            ))}
          </select>

          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="Search assessments or topics…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery("")}>
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="calendar-priority-filters">
          {[
            { key: "all", label: "All" },
            { key: "overdue", label: "Overdue" },
            { key: "urgent", label: "Urgent" },
            { key: "medium", label: "Medium" },
            { key: "high-impact", label: "High impact" },
            { key: "low", label: "Low" },
            { key: "completed", label: "Completed" },
          ].map((tab) => (
            <button
              key={tab.key}
              className={priorityFilter === tab.key ? "selected" : ""}
              onClick={() => setPriorityFilter(tab.key)}
            >
              {tab.label}
              <span>{getPriorityCount(tab.key)}</span>
            </button>
          ))}
        </div>
      </div>

      {assessments.length === 0 && (
        <div className="calendar-empty-banner">
          <span>💡</span>
          <span>No deadlines scheduled yet. Upload your syllabus PDF to view your academic deadlines and target study milestones on the calendar.</span>
        </div>
      )}

      <div className="calendar-shell">
        <div className="calendar-weekdays">
          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
            (day) => (
              <div key={day}>{day}</div>
            )
          )}
        </div>

        <div className="calendar-grid">
          {calendarDays.map((day) => {
            const dayEvents = eventsByDate[day.dateKey] || [];
            const isToday = day.dateKey === todayKey;

            return (
              <div
                key={day.dateKey}
                className={`calendar-day ${day.isCurrentMonth ? "" : "outside-month"} ${
                  isToday ? "today" : ""
                }`}
              >
                <div className="calendar-day-header">
                  <span>{day.date.getDate()}</span>
                  {isToday && <small>Today</small>}
                </div>

                <div className="calendar-day-items">
                  {dayEvents.map((evt, idx) => {
                    const isTarget = evt.eventType === "target";
                    const status = evt.priority_level || evt.status || "unranked";
                    const isCompleted = evt.completed;

                    return (
                      <button
                        key={`${evt.id}-${evt.eventType}-${idx}`}
                        className={`calendar-assessment ${isTarget ? "target-event" : status} ${
                          isCompleted ? "completed" : ""
                        }`}
                        onClick={() => onClickDetail(evt)}
                        title={`${isTarget ? "🎯 Target:" : "📅 Due:"} ${evt.title || evt.item}`}
                      >
                        <span className="calendar-assessment-title">
                          {isTarget ? "🎯 Target: " : "📅 "}
                          {evt.title || evt.item}
                        </span>
                        <span className="calendar-assessment-meta">
                          {evt.course_code || "Course"}
                          {evt.weight_percent != null ? ` · ${evt.weight_percent}%` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {filteredAssessments.length === 0 && (
        <div className="empty-filter" style={{ marginTop: 20 }}>
          <h3>No assessments match your filters</h3>
          <p>Try clearing your search query or choosing another subject / priority filter.</p>
        </div>
      )}
    </section>
  );
}

/* =========================================================================
   DAILY STUDY PLAN VIEW
   ========================================================================= */
function DailyPlanView({
  assessments,
  targetDates,
  completedItems,
  onToggleComplete,
  onPractice,
  onClickDetail,
}) {
  const dailyTasks = useMemo(
    () => calculateDailyStudyPlan(assessments, targetDates, completedItems),
    [assessments, targetDates, completedItems]
  );

  const totalMinutes = useMemo(
    () => dailyTasks.reduce((acc, t) => acc + (t.workloadMinutes || 45), 0),
    [dailyTasks]
  );

  const hoursDisplay = `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60 > 0 ? `${totalMinutes % 60}m` : ""}`;

  return (
    <section className="daily-plan-section">
      <div className="daily-plan-header">
        <div>
          <span className="eyebrow">SMART WORKSPACE</span>
          <h2>Today's Intelligent Study Plan</h2>
          <p>
            Dynamically prioritized from your upcoming due dates, grade weights, remaining days, and student target dates.
          </p>
        </div>

        <div className="daily-plan-stats-pill">
          <div>
            <strong>{dailyTasks.length}</strong>
            <span>Active tasks today</span>
          </div>
          <div className="pill-divider" />
          <div>
            <strong>{hoursDisplay}</strong>
            <span>Estimated workload</span>
          </div>
        </div>
      </div>

      {assessments.length === 0 ? (
        <div className="daily-plan-empty">
          <div className="empty-icon">⚡</div>
          <h3>No daily study tasks yet</h3>
          <p>Upload a course syllabus PDF to automatically generate your personalized daily study plan.</p>
        </div>
      ) : dailyTasks.length === 0 ? (
        <div className="daily-plan-empty">
          <div className="empty-icon">🎉</div>
          <h3>All caught up for today!</h3>
          <p>You have completed all urgent and prioritized syllabus tasks. Review the priority plan or calendar to prep ahead.</p>
        </div>
      ) : (
        <div className="daily-plan-list">
          {dailyTasks.map((task, idx) => {
            const id = getAssessmentId(task);
            const isDone = Boolean(completedItems[id]?.completed || task.completed);
            const weight = task.weight_percent != null ? `${task.weight_percent}%` : "N/A";

            return (
              <div key={`${task.id}-${idx}`} className={`daily-plan-card ${isDone ? "completed" : ""}`}>
                <div className="daily-plan-index">
                  <span>#{idx + 1}</span>
                </div>

                <div className="daily-plan-content">
                  <div className="daily-plan-top">
                    <div>
                      <span className="daily-plan-course">{getCourseLabel(task)}</span>
                      <h3 className="card-clickable-title" onClick={() => onClickDetail(task)}>
                        {task.title || task.item}
                      </h3>
                    </div>

                    <div className="daily-plan-chips">
                      <span className="workload-chip">⏱ {task.workloadMinutes} mins</span>
                      <span className="weight-chip">⚖ {weight} weight</span>
                      <PriorityBadge status={isDone ? "completed" : task.priority_level || "unranked"} />
                    </div>
                  </div>

                  <div className="daily-plan-rationale">
                    <strong>Why selected today:</strong>
                    <p>{task.dailyReason}</p>
                  </div>

                  {task.topic && (
                    <div className="daily-plan-topic">
                      <strong>Topic:</strong> {task.topic}
                    </div>
                  )}

                  <div className="daily-plan-actions">
                    <button
                      className={`btn-daily-complete ${isDone ? "completed" : ""}`}
                      onClick={() => onToggleComplete(task)}
                    >
                      {isDone ? "✓ Completed for today" : "○ Mark completed"}
                    </button>

                    {task.topic && (
                      <button className="btn-daily-practice" onClick={() => onPractice(task)}>
                        <span>✦ Practice questions</span>
                      </button>
                    )}

                    <button className="btn-daily-details" onClick={() => onClickDetail(task)}>
                      View details →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* =========================================================================
   SUBJECTS DASHBOARD VIEW
   ========================================================================= */
function SubjectsDashboardView({
  courses,
  assessments,
  completedItems,
  onSelectSubjectFilter,
  onOpenPractice,
  onClickDetail,
}) {
  const subjectStats = useMemo(() => {
    return courses.map((course) => {
      const code = course.course_code;
      const name = course.course_name;
      const courseItems = assessments.filter(
        (a) => a.course_code === code || a.course_name === name
      );

      const totalItems = courseItems.length;
      let completedCount = 0;
      let totalWeight = 0;
      let completedWeight = 0;
      let nextDue = null;

      courseItems.forEach((it) => {
        const id = getAssessmentId(it);
        const isDone = Boolean(completedItems[id]?.completed || it.completed);
        const w = it.weight_percent != null ? Number(it.weight_percent) : 0;
        totalWeight += w;

        if (isDone) {
          completedCount++;
          completedWeight += w;
        } else if (it.due_date) {
          if (!nextDue || it.due_date < nextDue.due_date) {
            nextDue = it;
          }
        }
      });

      const progress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

      return {
        code,
        name,
        totalItems,
        completedCount,
        progress,
        totalWeight: Math.round(totalWeight),
        completedWeight: Math.round(completedWeight),
        nextDue,
        items: courseItems,
      };
    });
  }, [courses, assessments, completedItems]);

  return (
    <section className="subjects-view-section">
      <div className="subjects-view-header">
        <div>
          <span className="eyebrow">SUBJECT COMMAND CENTER</span>
          <h2>Course Portfolios & Analytics</h2>
          <p>
            Review all subjects, track subject-specific grade weight completions, and launch targeted practice.
          </p>
        </div>
        <div className="subjects-total-badge">
          <strong>{courses.length}</strong>
          <span>Enrolled Subjects</span>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="empty-workspace-state">
          <div className="empty-workspace-icon">📚</div>
          <h2>No subjects registered yet</h2>
          <p>Upload a course syllabus PDF to view subject breakdown, grade weight distributions, and next deadlines.</p>
        </div>
      ) : (
        <div className="subjects-grid">
          {subjectStats.map((sub, idx) => (
            <div key={`${sub.code}-${idx}`} className="subject-card">
              <div className="subject-card-header">
                <span className="subject-code-tag">{sub.code || `SUBJ-${idx + 1}`}</span>
                <span className="subject-item-count">{sub.totalItems} assessments</span>
              </div>

              <h3 className="subject-title">{sub.name}</h3>

              <div className="subject-progress-box">
                <div className="subject-progress-labels">
                  <span>Completion progress</span>
                  <strong>{sub.progress}% ({sub.completedCount}/{sub.totalItems})</strong>
                </div>
                <div className="subject-progress-bar">
                  <div className="subject-progress-fill" style={{ width: `${sub.progress}%` }} />
                </div>
              </div>

              <div className="subject-meta-row">
                <div>
                  <span>Total Weight</span>
                  <strong>{sub.totalWeight}%</strong>
                </div>
                <div>
                  <span>Weight Secured</span>
                  <strong className="text-success">{sub.completedWeight}%</strong>
                </div>
              </div>

              <div className="subject-next-due">
                <span className="next-due-label">Next Deadline</span>
                {sub.nextDue ? (
                  <div
                    className="next-due-card"
                    onClick={() => onClickDetail(sub.nextDue)}
                    title="Click to view details"
                  >
                    <strong>{sub.nextDue.title || sub.nextDue.item}</strong>
                    <small>Due {formatDate(sub.nextDue.due_date)} · {getStatusText(sub.nextDue)}</small>
                  </div>
                ) : (
                  <div className="no-next-due">✓ All deadlines completed or unscheduled</div>
                )}
              </div>

              <div className="subject-card-actions">
                <button
                  className="btn-subject-filter"
                  onClick={() => onSelectSubjectFilter(sub.code || sub.name)}
                >
                  View subject plan →
                </button>

                {sub.items.length > 0 && sub.items[0].topic && (
                  <button
                    className="btn-subject-practice"
                    onClick={() => onOpenPractice(sub.items[0])}
                    title="Practice first topic"
                  >
                    ✦ Practice
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* =========================================================================
   PRACTICE STUDIO WORKSPACE
   ========================================================================= */
function PracticeStudioView({
  assessments,
  courses,
  initialItem,
  onOpenUpload,
}) {
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(
    initialItem ? getAssessmentId(initialItem) : (assessments[0] ? getAssessmentId(assessments[0]) : "")
  );
  const [customTopic, setCustomTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [questionType, setQuestionType] = useState("mixed");
  const [count, setCount] = useState(5);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [questionsData, setQuestionsData] = useState(null);
  const [revealedAnswers, setRevealedAnswers] = useState({});
  const [selectedChoices, setSelectedChoices] = useState({});

  const selectedAssessment = useMemo(() => {
    return assessments.find((a) => getAssessmentId(a) === selectedAssessmentId) || assessments[0] || null;
  }, [assessments, selectedAssessmentId]);

  useEffect(() => {
    if (initialItem) {
      setSelectedAssessmentId(getAssessmentId(initialItem));
      handleGenerate(initialItem.topic, initialItem.title || initialItem.item);
    }
  }, [initialItem]);

  async function handleGenerate(overrideTopic, overrideItem) {
    const topicToUse = overrideTopic || (customTopic.trim() || selectedAssessment?.topic);
    const itemTitle = overrideItem || (selectedAssessment?.title || selectedAssessment?.item || "Topic Revision");

    if (!topicToUse) {
      setError("Please select an assessment with topics or type a study topic.");
      return;
    }

    setLoading(true);
    setError("");
    setRevealedAnswers({});
    setSelectedChoices({});

    try {
      const response = await fetch(`${API}/api/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topicToUse,
          item: itemTitle,
          difficulty,
          question_type: questionType,
          count,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to generate practice questions.");
      }

      setQuestionsData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleRevealAnswer(index) {
    setRevealedAnswers((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  }

  function handleSelectChoice(qIndex, choiceText) {
    setSelectedChoices((prev) => ({
      ...prev,
      [qIndex]: choiceText,
    }));
  }

  const itemsList = questionsData?.items?.length
    ? questionsData.items
    : (questionsData?.questions || []).map((q) => ({
        question: typeof q === "string" ? q : q.question || JSON.stringify(q),
        options: [],
        answer: "Please refer to course lecture notes and reference textbook for the step-by-step solution.",
        explanation: "Key concepts covered under this syllabus module.",
        question_type: questionType,
      }));

  return (
    <section className="practice-studio-section">
      <div className="practice-studio-header">
        <div>
          <span className="eyebrow">AI PRACTICE STUDIO</span>
          <h2>Intelligent Question Studio</h2>
          <p>
            Generate targeted academic questions, test conceptual mastery, and reveal detailed step-by-step explanations.
          </p>
        </div>
      </div>

      <div className="practice-studio-grid">
        {/* Controls Column */}
        <div className="practice-control-card">
          <h3>Practice Configuration</h3>

          <div className="control-group">
            <label>Select assessment from syllabus</label>
            <select
              className="studio-select"
              value={selectedAssessmentId}
              onChange={(e) => {
                setSelectedAssessmentId(e.target.value);
                setCustomTopic("");
              }}
            >
              {assessments.map((a) => (
                <option key={getAssessmentId(a)} value={getAssessmentId(a)}>
                  {a.course_code ? `[${a.course_code}] ` : ""}{a.title || a.item}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label>Or enter custom topic / concepts</label>
            <input
              type="text"
              className="studio-input"
              placeholder={selectedAssessment?.topic || "e.g. Heuristic evaluation, SHAP, Cryptography"}
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
            />
          </div>

          <div className="control-group">
            <label>Difficulty level</label>
            <div className="segmented-control">
              {["easy", "medium", "hard"].map((d) => (
                <button
                  key={d}
                  className={difficulty === d ? "active" : ""}
                  onClick={() => setDifficulty(d)}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="control-group">
            <label>Question format</label>
            <div className="segmented-control question-type-control">
              {[
                { key: "mixed", label: "Mixed" },
                { key: "multiple_choice", label: "MCQ" },
                { key: "short_answer", label: "Short" },
                { key: "long_answer", label: "Long" },
              ].map((t) => (
                <button
                  key={t.key}
                  className={questionType === t.key ? "active" : ""}
                  onClick={() => setQuestionType(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="control-group">
            <label>Number of questions</label>
            <div className="segmented-control">
              {[3, 5, 10].map((c) => (
                <button
                  key={c}
                  className={count === c ? "active" : ""}
                  onClick={() => setCount(c)}
                >
                  {c} Questions
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn-generate-questions"
            onClick={() => handleGenerate()}
            disabled={loading}
          >
            {loading ? (
              <span>Generating questions…</span>
            ) : (
              <>
                <span>✦ Generate practice session</span>
                <span>→</span>
              </>
            )}
          </button>

          {selectedAssessment && (
            <div className="studio-context-box">
              <strong>Active context:</strong>
              <p>{selectedAssessment.course_code ? `${selectedAssessment.course_code}: ` : ""}{selectedAssessment.title || selectedAssessment.item}</p>
              <small><strong>Topics:</strong> {selectedAssessment.topic || "None specified"}</small>
            </div>
          )}
        </div>

        {/* Output Workspace Column */}
        <div className="practice-output-workspace">
          {loading ? (
            <div className="studio-loading-state">
              <div className="loading-spinner" style={{ width: 44, height: 44 }} />
              <h3>Crafting {count} {difficulty} questions…</h3>
              <p>Analyzing module topics to generate balanced conceptual and applied questions.</p>
            </div>
          ) : error ? (
            <div className="studio-error-state">
              <div className="error-icon">⚠️</div>
              <h3>Generation failed</h3>
              <p>{error}</p>
              <button className="btn-retry" onClick={() => handleGenerate()}>
                Try again
              </button>
            </div>
          ) : questionsData && itemsList.length > 0 ? (
            <div className="studio-questions-flow">
              <div className="studio-flow-header">
                <div>
                  <span className="flow-badge">{questionsData.difficulty?.toUpperCase()} · {questionsData.question_type?.toUpperCase()}</span>
                  <h3>{questionsData.topic}</h3>
                </div>

                <button className="btn-regenerate" onClick={() => handleGenerate()} title="Regenerate new questions">
                  🔄 Regenerate
                </button>
              </div>

              <div className="questions-card-list">
                {itemsList.map((item, qIdx) => {
                  const isRevealed = Boolean(revealedAnswers[qIdx]);
                  const hasOptions = item.options && item.options.length > 0;
                  const selectedChoice = selectedChoices[qIdx];

                  return (
                    <div key={qIdx} className="practice-question-card">
                      <div className="question-card-top">
                        <span className="question-number">Question {qIdx + 1}</span>
                        {item.question_type && (
                          <span className="question-type-tag">{item.question_type.replace(/_/g, " ")}</span>
                        )}
                      </div>

                      <p className="question-prompt">{item.question}</p>

                      {hasOptions && (
                        <div className="question-options-list">
                          {item.options.map((opt, optIdx) => {
                            const isSelected = selectedChoice === opt;
                            return (
                              <button
                                key={optIdx}
                                className={`option-btn ${isSelected ? "selected" : ""}`}
                                onClick={() => handleSelectChoice(qIdx, opt)}
                              >
                                <span className="option-bullet">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span className="option-text">{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="question-card-footer">
                        <button
                          className={`btn-reveal-answer ${isRevealed ? "revealed" : ""}`}
                          onClick={() => toggleRevealAnswer(qIdx)}
                        >
                          {isRevealed ? "Hide Answer & Explanation" : "Reveal Answer & Explanation"}
                        </button>
                      </div>

                      {isRevealed && (
                        <div className="answer-explanation-box">
                          <div className="answer-line">
                            <strong>Correct Answer:</strong>
                            <span>{item.answer || "See explanation below"}</span>
                          </div>
                          {item.explanation && (
                            <div className="explanation-line">
                              <strong>Explanation:</strong>
                              <p>{item.explanation}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="studio-empty-state">
              <div className="studio-empty-icon">✦</div>
              <h3>Ready to study?</h3>
              <p>
                Select an assessment topic on the left, pick your difficulty and question format, and hit <strong>Generate practice session</strong>.
              </p>
              <button
                className="btn-quick-start"
                onClick={() => handleGenerate()}
              >
                Generate 5 practice questions now →
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
   PROGRESS TRACKING DASHBOARD VIEW
   ========================================================================= */
function ProgressDashboardView({
  courses,
  assessments,
  completedItems,
  onSelectSubjectFilter,
}) {
  const stats = useMemo(() => {
    let totalAssessments = assessments.length;
    let completedCount = 0;
    let overdueCount = 0;
    let pendingCount = 0;
    let totalGradeWeight = 0;
    let completedGradeWeight = 0;

    assessments.forEach((it) => {
      const id = getAssessmentId(it);
      const isDone = Boolean(completedItems[id]?.completed || it.completed);
      const w = it.weight_percent != null ? Number(it.weight_percent) : 0;
      totalGradeWeight += w;

      if (isDone) {
        completedCount++;
        completedGradeWeight += w;
      } else {
        pendingCount++;
        if (it.priority_level === "overdue" || (it.days_until_due != null && it.days_until_due < 0)) {
          overdueCount++;
        }
      }
    });

    const semesterProgress = totalAssessments > 0 ? Math.round((completedCount / totalAssessments) * 100) : 0;
    const gradeProgress = totalGradeWeight > 0 ? Math.round((completedGradeWeight / totalGradeWeight) * 100) : 0;

    return {
      totalAssessments,
      completedCount,
      overdueCount,
      pendingCount,
      totalGradeWeight: Math.round(totalGradeWeight),
      completedGradeWeight: Math.round(completedGradeWeight),
      semesterProgress,
      gradeProgress,
    };
  }, [assessments, completedItems]);

  const subjectBreakdown = useMemo(() => {
    return courses.map((course) => {
      const code = course.course_code;
      const name = course.course_name;
      const items = assessments.filter((a) => a.course_code === code || a.course_name === name);

      let completed = 0;
      let totalWeight = 0;
      let securedWeight = 0;

      items.forEach((it) => {
        const id = getAssessmentId(it);
        const isDone = Boolean(completedItems[id]?.completed || it.completed);
        const w = it.weight_percent != null ? Number(it.weight_percent) : 0;
        totalWeight += w;
        if (isDone) {
          completed++;
          securedWeight += w;
        }
      });

      const percent = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;

      return {
        code,
        name,
        total: items.length,
        completed,
        percent,
        totalWeight: Math.round(totalWeight),
        securedWeight: Math.round(securedWeight),
      };
    });
  }, [courses, assessments, completedItems]);

  return (
    <section className="progress-view-section">
      <div className="progress-view-header">
        <div>
          <span className="eyebrow">SEMESTER ANALYTICS</span>
          <h2>Academic Progress & Milestones</h2>
          <p>
            Track your semester completion trajectory, secured grade weights, and course milestones.
          </p>
        </div>
      </div>

      {assessments.length === 0 ? (
        <div className="empty-workspace-state">
          <div className="empty-workspace-icon">📊</div>
          <h2>No analytics recorded yet</h2>
          <p>Upload your course syllabus to track semester progress, grade weight completion, and subject performance.</p>
        </div>
      ) : (
        <>
          <div className="progress-overview-grid">
            <div className="progress-hero-card">
              <span className="overview-overline">OVERALL SEMESTER COMPLETION</span>
              <div className="progress-large-metric">
                <strong>{stats.semesterProgress}%</strong>
                <span>{stats.completedCount} of {stats.totalAssessments} items completed</span>
              </div>

              <div className="progress-bar-container large">
                <div className="progress-bar-fill" style={{ width: `${stats.semesterProgress}%` }} />
              </div>

              <div className="progress-hero-footer">
                <div>
                  <span>Pending Tasks</span>
                  <strong>{stats.pendingCount}</strong>
                </div>
                <div>
                  <span>Overdue Tasks</span>
                  <strong className="text-danger">{stats.overdueCount}</strong>
                </div>
                <div>
                  <span>Enrolled Courses</span>
                  <strong>{courses.length}</strong>
                </div>
              </div>
            </div>

            <div className="progress-hero-card">
              <span className="overview-overline">GRADE WEIGHT SECURED</span>
              <div className="progress-large-metric">
                <strong>{stats.completedGradeWeight}%</strong>
                <span>of {stats.totalGradeWeight}% total syllabus weight</span>
              </div>

              <div className="progress-bar-container large">
                <div className="progress-bar-fill success" style={{ width: `${stats.gradeProgress}%` }} />
              </div>

              <div className="progress-hero-footer">
                <div>
                  <span>Weight Completed</span>
                  <strong className="text-success">{stats.completedGradeWeight}%</strong>
                </div>
                <div>
                  <span>Weight Remaining</span>
                  <strong>{stats.totalGradeWeight - stats.completedGradeWeight}%</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="progress-breakdown-card">
            <h3>Subject Performance Breakdown</h3>
            <p>Compare completion percentages across all enrolled courses.</p>

            <div className="progress-subjects-list">
              {subjectBreakdown.map((s, idx) => (
                <div key={`${s.code}-${idx}`} className="progress-subject-row">
                  <div className="progress-sub-info">
                    <span className="progress-sub-code">{s.code || `SUBJ-${idx + 1}`}</span>
                    <strong>{s.name}</strong>
                  </div>

                  <div className="progress-sub-bar-wrapper">
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill" style={{ width: `${s.percent}%` }} />
                    </div>
                    <span className="subject-percent-tag">{s.percent}%</span>
                  </div>

                  <button
                    className="btn-row-action"
                    onClick={() => onSelectSubjectFilter(s.code || s.name)}
                  >
                    View →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/* =========================================================================
   AUTH & WORKSPACE MODALS (Phase 3A)
   ========================================================================= */

function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const endpoint = mode === "register" ? `${API}/api/auth/register` : `${API}/api/auth/login`;
      const body = mode === "register"
        ? { email, password, display_name: displayName }
        : { email, password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Authentication failed.");
      }

      onLoginSuccess(data.token, data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleQuickDemo() {
    setEmail("student@syllabussurgeon.edu");
    setPassword("Semester2026!");
    setDisplayName("Alex Student");
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">PHASE 3 · CLOUD ACCOUNTS</span>
            <h2>{mode === "login" ? "Welcome back" : "Create study account"}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <p className="auth-modal-subtitle">
          {mode === "login"
            ? "Log in to sync your semester plans, target dates, and practice history across all your devices."
            : "Set up a free academic account to backup your syllabi, workspaces, and study schedules."}
        </p>

        <div className="auth-mode-toggle">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => { setMode("login"); setError(""); }}
          >
            Log In
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => { setMode("register"); setError(""); }}
          >
            Create Account
          </button>
        </div>

        {error && <div className="error-banner" style={{ marginBottom: 16 }}>⚠ {error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" && (
            <div className="control-group">
              <label>Your Name / Nickname</label>
              <input
                type="text"
                className="studio-input"
                placeholder="e.g. Alex Student"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}

          <div className="control-group">
            <label>Email Address</label>
            <input
              type="email"
              className="studio-input"
              placeholder="student@university.edu"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="control-group">
            <label>Password</label>
            <input
              type="password"
              className="studio-input"
              placeholder="At least 6 characters"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-auth-submit" disabled={loading}>
            {loading ? "Authenticating…" : mode === "login" ? "Log in →" : "Create free account →"}
          </button>
        </form>

        <div className="auth-modal-footer">
          <button type="button" className="btn-quick-fill" onClick={handleQuickDemo}>
            ⚡ Auto-fill test credentials
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   STUDY SESSION SCHEDULING MODAL (STEP 10)
   ========================================================================= */
function StudySessionModal({
  isOpen,
  onClose,
  courses,
  assessments,
  onSaveSession,
  isSaving,
  prefillItem,
}) {
  const [courseId, setCourseId] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [sessionDate, setSessionDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [plannedMinutes, setPlannedMinutes] = useState(60);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (prefillItem) {
        const foundCourse = courses.find(
          (c) =>
            c.id === prefillItem.courseId ||
            c.id === prefillItem.course_id ||
            c.code === prefillItem.courseCode ||
            c.code === prefillItem.course_code ||
            c.name === prefillItem.courseName ||
            c.name === prefillItem.course_name
        );
        setCourseId(foundCourse ? foundCourse.id : courses[0]?.id || "");
        setAssessmentId(prefillItem.id || "");
        setNotes(prefillItem.topic ? `Focus: ${prefillItem.topic}` : "");
        if (prefillItem.targetDate || prefillItem.target_date) {
          setSessionDate(prefillItem.targetDate || prefillItem.target_date);
        } else {
          setSessionDate(new Date().toISOString().slice(0, 10));
        }
      } else {
        if (courses.length > 0 && !courseId) {
          setCourseId(courses[0].id);
        }
        setAssessmentId("");
        setSessionDate(new Date().toISOString().slice(0, 10));
        setNotes("");
      }
      setStartTime("");
      setEndTime("");
      setPlannedMinutes(60);
      setFormError("");
    }
  }, [isOpen, prefillItem, courses]);

  if (!isOpen) return null;

  const filteredAssessments = assessments.filter(
    (a) =>
      (a.courseId || a.course_id) === courseId ||
      courses.find((c) => c.id === courseId)?.code === (a.courseCode || a.course_code)
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!courseId) {
      setFormError("Please select a course for this study session.");
      return;
    }
    if (!sessionDate) {
      setFormError("Please select a study session date.");
      return;
    }

    try {
      setFormError("");
      await onSaveSession({
        courseId,
        assessmentId: assessmentId || null,
        sessionDate,
        startTime: startTime || null,
        endTime: endTime || null,
        plannedMinutes: Number(plannedMinutes) || 60,
        notes: notes || null,
      });
      onClose();
    } catch (err) {
      setFormError(err.message || "Failed to schedule study session.");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">STUDY TIME PLANNER</span>
            <h2>Schedule Study Session</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <p className="auth-modal-subtitle">
          Plan focused revision slots for course topics or milestones. Persisted directly to your workspace database.
        </p>

        {formError && <div className="error-banner" style={{ marginBottom: 16 }}>⚠ {formError}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="control-group">
            <label>Course *</label>
            <select
              className="studio-select"
              required
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setAssessmentId("");
              }}
            >
              <option value="">Select course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code || c.course_code
                    ? `${c.code || c.course_code} · ${c.name || c.course_name}`
                    : c.name || c.course_name}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label>Assessment / Topic (Optional)</label>
            <select
              className="studio-select"
              value={assessmentId}
              onChange={(e) => setAssessmentId(e.target.value)}
            >
              <option value="">General course study</option>
              {filteredAssessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title || a.item}
                </option>
              ))}
            </select>
          </div>

          <div className="drawer-meta-grid">
            <div className="control-group">
              <label>Study Date *</label>
              <input
                type="date"
                className="studio-input"
                required
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </div>

            <div className="control-group">
              <label>Planned Duration (Minutes) *</label>
              <input
                type="number"
                className="studio-input"
                min="1"
                max="1440"
                required
                value={plannedMinutes}
                onChange={(e) => setPlannedMinutes(e.target.value)}
              />
            </div>
          </div>

          <div className="drawer-meta-grid">
            <div className="control-group">
              <label>Start Time (Optional)</label>
              <input
                type="time"
                className="studio-input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            <div className="control-group">
              <label>End Time (Optional)</label>
              <input
                type="time"
                className="studio-input"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="control-group">
            <label>Study Notes / Goals</label>
            <textarea
              className="studio-input"
              style={{ minHeight: 70, resize: "vertical" }}
              placeholder="e.g. Solve chapter 4 practice problems, review lecture slides"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
            <button type="button" className="btn-cancel" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-confirm-reset"
              style={{ background: "var(--purple)" }}
              disabled={isSaving}
            >
              {isSaving ? "Saving session…" : "Add Study Session →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================================
   STUDY SESSIONS DASHBOARD VIEW (STEP 10)
   ========================================================================= */
function StudySessionsView({
  studySessions,
  courses,
  assessments,
  onOpenCreateSession,
  onUpdateSession,
  onDeleteSession,
}) {
  const sortedSessions = useMemo(() => {
    return [...studySessions].sort((a, b) => {
      const dateA = a.sessionDate || a.session_date || "";
      const dateB = b.sessionDate || b.session_date || "";
      return dateB.localeCompare(dateA);
    });
  }, [studySessions]);

  const totalMinutes = useMemo(
    () =>
      studySessions.reduce(
        (acc, s) => acc + (Number(s.plannedMinutes || s.planned_minutes) || 0),
        0
      ),
    [studySessions]
  );
  const completedSessions = useMemo(
    () => studySessions.filter((s) => s.status === "completed"),
    [studySessions]
  );

  return (
    <section className="daily-plan-section">
      <div className="daily-plan-header">
        <div>
          <span className="eyebrow">CALENDAR PERSISTENCE</span>
          <h2>Saved Study Sessions</h2>
          <p>
            Scheduled study blocks linked to your courses and assessments, persisted in PostgreSQL.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="daily-plan-stats-pill">
            <div>
              <strong>{studySessions.length}</strong>
              <span>Sessions</span>
            </div>
            <div className="pill-divider" />
            <div>
              <strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</strong>
              <span>Planned Study</span>
            </div>
            <div className="pill-divider" />
            <div>
              <strong>{completedSessions.length}</strong>
              <span>Completed</span>
            </div>
          </div>

          <button
            className="primary-button"
            onClick={() => onOpenCreateSession(null)}
          >
            <span>+</span> Schedule Session
          </button>
        </div>
      </div>

      {studySessions.length === 0 ? (
        <div className="daily-plan-empty">
          <div className="empty-icon">⏱</div>
          <h3>No study sessions scheduled yet</h3>
          <p>Schedule focused study sessions for your courses and milestones to build productive habits.</p>
          <button
            className="primary-button"
            style={{ marginTop: 14 }}
            onClick={() => onOpenCreateSession(null)}
          >
            <span>+</span> Schedule First Study Session
          </button>
        </div>
      ) : (
        <div className="daily-plan-list">
          {sortedSessions.map((session) => {
            const isDone = session.status === "completed";
            const courseLabel = session.courseCode || session.courseName || "Course Study";
            const linkedAssessment = assessments.find(
              (a) => a.id === (session.assessmentId || session.assessment_id)
            );

            return (
              <div
                key={session.id}
                className={`daily-plan-card ${isDone ? "completed" : ""}`}
              >
                <div className="daily-plan-index">
                  <span>{isDone ? "✓" : "⏱"}</span>
                </div>

                <div className="daily-plan-content">
                  <div className="daily-plan-top">
                    <div>
                      <span className="daily-plan-course">{courseLabel}</span>
                      <h3 style={{ margin: "2px 0 4px", fontSize: 17, fontWeight: 800 }}>
                        {linkedAssessment
                          ? linkedAssessment.title || linkedAssessment.item
                          : session.notes
                          ? session.notes.slice(0, 50)
                          : "Course Revision Session"}
                      </h3>
                    </div>

                    <div className="daily-plan-chips">
                      <span className="workload-chip">
                        📅 {session.sessionDate || session.session_date}
                        {session.startTime && ` · ${session.startTime}`}
                        {session.endTime && ` - ${session.endTime}`}
                      </span>
                      <span className="weight-chip">
                        ⏱ {session.plannedMinutes || session.planned_minutes} mins
                      </span>
                      <PriorityBadge status={isDone ? "completed" : session.status || "planned"} />
                    </div>
                  </div>

                  {session.notes && (
                    <div className="daily-plan-rationale">
                      <strong>Notes & Goals:</strong>
                      <p>{session.notes}</p>
                    </div>
                  )}

                  <div className="daily-plan-actions" style={{ marginTop: 12 }}>
                    <button
                      className={`btn-daily-complete ${isDone ? "completed" : ""}`}
                      onClick={() =>
                        onUpdateSession(session.id, {
                          status: isDone ? "planned" : "completed",
                          actual_minutes: isDone ? 0 : Number(session.plannedMinutes || 60),
                        })
                      }
                    >
                      {isDone ? "✓ Completed (Mark active)" : "○ Mark as completed"}
                    </button>

                    <button
                      className="btn-danger-outline"
                      style={{ padding: "6px 12px", fontSize: 12 }}
                      onClick={() => onDeleteSession(session.id)}
                      title="Delete study session"
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function WorkspaceModal({ isOpen, onClose, onSave, onDelete, editingWorkspace }) {
  const [name, setName] = useState("");
  const [semester, setSemester] = useState("Fall 2026");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (editingWorkspace) {
      setName(editingWorkspace.name);
      setSemester(editingWorkspace.semester || "");
    } else {
      setName("");
      setSemester("Fall 2026");
    }
    setConfirmDelete(false);
  }, [editingWorkspace, isOpen]);

  if (!isOpen) return null;

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), semester.trim());
    onClose();
  }

  function handleDeleteClick() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(editingWorkspace.id);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">SEMESTER WORKSPACE</span>
            <h2>{editingWorkspace ? "Workspace Settings" : "Create New Workspace"}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: 12 }}>
          <div className="control-group">
            <label>Workspace / Semester Name</label>
            <input
              type="text"
              className="studio-input"
              placeholder="e.g. Fall 2026 Semester, Spring 2027"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="control-group">
            <label>Term / Period (Optional)</label>
            <input
              type="text"
              className="studio-input"
              placeholder="e.g. Fall 2026, Quarter 3"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, gap: 10 }}>
            {editingWorkspace ? (
              <button
                type="button"
                className={`btn-danger-outline ${confirmDelete ? "btn-danger-confirm" : ""}`}
                onClick={handleDeleteClick}
                title="Permanently remove this workspace and its courses"
              >
                {confirmDelete ? "⚠️ Click again to confirm delete" : "🗑 Delete Workspace"}
              </button>
            ) : <div />}

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-confirm-reset" style={{ background: "var(--purple)" }}>
                {editingWorkspace ? "Save changes" : "Create workspace"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================================
   STEP 11: WEEKLY CALENDAR VIEW COMPONENT
   ========================================================================= */
function WeeklyCalendar({
  weekStart,
  sessions = [],
  courses = [],
  assessments = [],
  onPreviousWeek,
  onNextWeek,
  onToday,
  onCreateSession,
  onEditSession,
}) {
  const weekDates = getWeekDates(weekStart);

  return (
    <section className="calendar-panel">
      <div className="calendar-toolbar">
        <div>
          <h2>Weekly study calendar</h2>
          <p>
            Plan focused study sessions and track your available time.
          </p>
        </div>

        <div className="calendar-toolbar-actions">
          <button type="button" onClick={onPreviousWeek}>
            Previous
          </button>

          <button type="button" onClick={onToday}>
            Today
          </button>

          <button type="button" onClick={onNextWeek}>
            Next
          </button>
        </div>
      </div>

      <div className="calendar-scroll">
        <div className="calendar-grid">
          <div className="calendar-time-header" />

          {weekDates.map((date) => (
            <div
              key={formatDateKey(date)}
              className="calendar-day-header"
            >
              <strong>
                {date.toLocaleDateString(undefined, {
                  weekday: "short",
                })}
              </strong>

              <span>{date.getDate()}</span>
            </div>
          ))}

          <div className="calendar-time-column">
            {Array.from(
              {
                length:
                  CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1,
              },
              (_, index) => {
                const hour = CALENDAR_START_HOUR + index;

                return (
                  <div
                    key={hour}
                    className="calendar-time-label"
                    style={{ height: SLOT_HEIGHT }}
                  >
                    {formatCalendarTime(hour * 60)}
                  </div>
                );
              }
            )}
          </div>

          {weekDates.map((date) => {
            const dateKey = formatDateKey(date);

            const daySessions = sessions.filter(
              (session) =>
                (session.session_date || session.sessionDate) === dateKey
            );

            return (
              <div
                key={dateKey}
                className="calendar-day-column"
                onClick={(event) => {
                  if (event.target !== event.currentTarget) return;
                  onCreateSession(date, 9);
                }}
              >
                {Array.from(
                  {
                    length:
                      CALENDAR_END_HOUR - CALENDAR_START_HOUR,
                  },
                  (_, index) => (
                    <button
                      type="button"
                      key={index}
                      className="calendar-slot"
                      onClick={() =>
                        onCreateSession(
                          date,
                          CALENDAR_START_HOUR + index
                        )
                      }
                      aria-label={`Create session on ${dateKey} at ${
                        CALENDAR_START_HOUR + index
                      }:00`}
                    />
                  )
                )}

                {daySessions.map((session) => {
                  const style = getSessionStyle(session);

                  const course = courses.find(
                    (item) =>
                      item.id === (session.course_id || session.courseId)
                  );

                  const assessment = assessments.find(
                    (item) =>
                      item.id === (session.assessment_id || session.assessmentId)
                  );

                  return (
                    <button
                      type="button"
                      key={session.id}
                      className="calendar-session"
                      style={{
                        top: style.top,
                        height: style.height,
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditSession(session);
                      }}
                    >
                      <strong>
                        {course?.code || course?.course_code || course?.name || course?.course_name || "Study"}
                      </strong>

                      <span>
                        {assessment?.title || assessment?.item || session.notes || "Study session"}
                      </span>

                      <small>
                        {session.start_time || session.startTime || "09:00"}–{session.end_time || session.endTime || "10:00"}
                      </small>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
   STEP 12: ANALYTICS & PROGRESS COMPONENTS
   ========================================================================= */
function AnalyticsCards({ analytics }) {
  return (
    <section className="analytics-grid">
      <div className="analytics-card">
        <span className="analytics-label">Total assessments</span>
        <strong>{analytics.totalAssessments}</strong>
      </div>

      <div className="analytics-card">
        <span className="analytics-label">Completed</span>
        <strong>{analytics.completedAssessments}</strong>
      </div>

      <div className="analytics-card">
        <span className="analytics-label">Completion rate</span>
        <strong>{analytics.completionPercentage}%</strong>
      </div>

      <div className="analytics-card">
        <span className="analytics-label">Planned study time</span>
        <strong>
          {Math.round(analytics.plannedMinutes / 60)}h
        </strong>
      </div>

      <div className="analytics-card">
        <span className="analytics-label">Actual study time</span>
        <strong>
          {Math.round(analytics.actualMinutes / 60)}h
        </strong>
      </div>
    </section>
  );
}

function ProgressBar({ percentage }) {
  return (
    <div className="progress-track">
      <div
        className="progress-fill"
        style={{
          width: `${Math.min(100, Math.max(0, percentage))}%`,
        }}
      />
    </div>
  );
}

function CourseProgress({ courseProgress }) {
  return (
    <section className="course-progress-panel">
      <div className="section-heading">
        <div>
          <h2>Course progress</h2>
          <p>Track assessment completion across all courses.</p>
        </div>
      </div>

      {courseProgress.length === 0 ? (
        <p className="empty-state">
          Add a course to start tracking progress.
        </p>
      ) : (
        <div className="course-progress-list">
          {courseProgress.map((item) => (
            <div
              key={item.course.id || item.course.code || item.course.name}
              className="course-progress-row"
            >
              <div className="course-progress-heading">
                <div>
                  <strong>
                    {item.course.code || item.course.course_code
                      ? `${item.course.code || item.course.course_code} · ${item.course.name || item.course.course_name}`
                      : item.course.name || item.course.course_name}
                  </strong>

                  <span>
                    {item.completed} of {item.total} completed
                  </span>
                </div>

                <strong>{item.percentage}%</strong>
              </div>

              <ProgressBar percentage={item.percentage} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AssessmentTimingSummary({ assessments }) {
  const overdue = assessments.filter((assessment) => {
    const targetDate =
      assessment.target_date ||
      assessment.targetDate ||
      assessment.official_due_date ||
      assessment.officialDueDate ||
      assessment.due_date;

    if (!targetDate || assessment.status === "completed") {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return new Date(`${targetDate}T00:00:00`) < today;
  });

  const upcoming = assessments
    .filter((assessment) => assessment.status !== "completed")
    .filter((assessment) => {
      const targetDate =
        assessment.target_date ||
        assessment.targetDate ||
        assessment.official_due_date ||
        assessment.officialDueDate ||
        assessment.due_date;

      return Boolean(targetDate);
    })
    .sort((a, b) => {
      const dateA =
        a.target_date || a.targetDate || a.official_due_date || a.officialDueDate || a.due_date;
      const dateB =
        b.target_date || b.targetDate || b.official_due_date || b.officialDueDate || b.due_date;

      return new Date(dateA) - new Date(dateB);
    })
    .slice(0, 5);

  return (
    <section className="timing-summary-grid">
      <div className="timing-panel">
        <h2>Overdue</h2>

        {overdue.length === 0 ? (
          <p className="empty-state">No overdue assessments.</p>
        ) : (
          <div className="timing-list">
            {overdue.slice(0, 5).map((assessment) => (
              <div
                key={assessment.id || getAssessmentId(assessment)}
                className="timing-list-item overdue-item"
              >
                <strong>{assessment.title || assessment.item}</strong>
                <span>{getAssessmentTiming(assessment)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="timing-panel">
        <h2>Upcoming</h2>

        {upcoming.length === 0 ? (
          <p className="empty-state">
            No upcoming assessments.
          </p>
        ) : (
          <div className="timing-list">
            {upcoming.map((assessment) => (
              <div
                key={assessment.id || getAssessmentId(assessment)}
                className="timing-list-item"
              >
                <strong>{assessment.title || assessment.item}</strong>
                <span>{getAssessmentTiming(assessment)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* =========================================================================
   PLANNER DASHBOARD (COMMAND CENTER CONTAINER)
   ========================================================================= */
function PlannerDashboard({
  courses,
  assessments,
  warnings,
  targetDates,
  completedItems,
  studySessions,
  setStudySessions,
  onToggleComplete,
  onSetTargetDate,
  onSaveAssessmentChanges,
  onCompletedHoursChange,
  onOpenCreateSession,
  onUpdateSession,
  onDeleteSession,
  onOpenExport,
  onOpenReset,
  onOpenUpload,
  onViewLanding,
  currentUser,
  workspaces,
  currentWorkspaceId,
  onSwitchWorkspace,
  onOpenWorkspaceModal,
  onOpenAuthModal,
  onLogout,
}) {
  const [activeTab, setActiveTab] = useState("plan");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedDrawerItem, setSelectedDrawerItem] = useState(null);
  const [practiceStudioItem, setPracticeStudioItem] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  // Step 11: Calendar State
  const [calendarWeekStart, setCalendarWeekStart] = useState(
    getStartOfWeek(new Date())
  );
  const [selectedCalendarSession, setSelectedCalendarSession] = useState(null);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarForm, setCalendarForm] = useState({
    course_id: "",
    assessment_id: "",
    session_date: formatDateKey(new Date()),
    start_time: "09:00",
    end_time: "10:00",
    planned_minutes: 60,
    status: "planned",
    notes: "",
  });

  // Step 12: Analytics calculations
  const analytics = calculateAnalytics(assessments, studySessions);
  const courseProgress = calculateCourseProgress(courses, assessments);

  // Step 11: Week navigation handlers
  function moveCalendarWeek(offset) {
    const nextWeek = new Date(calendarWeekStart);
    nextWeek.setDate(nextWeek.getDate() + offset * 7);
    setCalendarWeekStart(nextWeek);
  }

  function openNewCalendarSession(date, hour = 9) {
    const startMinutes = hour * 60;
    const endMinutes = startMinutes + 60;

    setSelectedCalendarSession(null);

    setCalendarForm({
      course_id: courses[0]?.id || "",
      assessment_id: "",
      session_date: formatDateKey(date),
      start_time: formatMinutesToTime(startMinutes),
      end_time: formatMinutesToTime(endMinutes),
      planned_minutes: 60,
      status: "planned",
      notes: "",
    });

    setCalendarModalOpen(true);
  }

  function openEditCalendarSession(session) {
    setSelectedCalendarSession(session);

    setCalendarForm({
      course_id: session.course_id || session.courseId || "",
      assessment_id: session.assessment_id || session.assessmentId || "",
      session_date: session.session_date || session.sessionDate || formatDateKey(new Date()),
      start_time: session.start_time || session.startTime || "09:00",
      end_time: session.end_time || session.endTime || "10:00",
      planned_minutes: session.planned_minutes || session.plannedMinutes || 60,
      status: session.status || "planned",
      notes: session.notes || "",
    });

    setCalendarModalOpen(true);
  }

  // Step 11: Save and Delete handlers
  async function handleSaveCalendarSession() {
    const payload = {
      course_id: calendarForm.course_id,
      assessment_id: calendarForm.assessment_id || null,
      session_date: calendarForm.session_date,
      start_time: calendarForm.start_time,
      end_time: calendarForm.end_time,
      planned_minutes: Number(calendarForm.planned_minutes),
      status: calendarForm.status,
      notes: calendarForm.notes || null,
    };

    try {
      if (selectedCalendarSession) {
        const updated = await updateStudySession(
          selectedCalendarSession.id,
          payload
        );

        if (setStudySessions) {
          setStudySessions((previous) =>
            previous.map((session) =>
              session.id === updated.id ? updated : session
            )
          );
        } else if (onUpdateSession) {
          onUpdateSession(selectedCalendarSession.id, payload);
        }
      } else {
        const created = await createStudySession(payload);

        if (setStudySessions) {
          setStudySessions((previous) => [...previous, created]);
        }
      }

      setCalendarModalOpen(false);
      setSelectedCalendarSession(null);
    } catch (error) {
      console.error("Failed to save study session:", error);
      alert("Unable to save this study session.");
    }
  }

  async function handleDeleteCalendarSession() {
    if (!selectedCalendarSession) return;

    const confirmed = window.confirm(
      "Delete this study session permanently?"
    );

    if (!confirmed) return;

    try {
      await deleteStudySession(selectedCalendarSession.id);

      if (setStudySessions) {
        setStudySessions((previous) =>
          previous.filter(
            (session) => session.id !== selectedCalendarSession.id
          )
        );
      } else if (onDeleteSession) {
        onDeleteSession(selectedCalendarSession.id);
      }

      setCalendarModalOpen(false);
      setSelectedCalendarSession(null);
    } catch (error) {
      console.error("Failed to delete study session:", error);
      alert("Unable to delete this study session.");
    }
  }

  const activeWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === currentWorkspaceId) || workspaces[0] || { name: "Default Semester" };
  }, [workspaces, currentWorkspaceId]);

  // Subject options with dynamic item count per subject
  const subjectOptions = useMemo(() => {
    const list = [];
    const seen = new Set();
    courses.forEach((c) => {
      const key = c.course_code || c.code || c.course_name || c.name;
      if (!seen.has(key)) {
        seen.add(key);
        const count = assessments.filter(
          (a) => (a.course_code || a.courseCode) === (c.course_code || c.code) || (a.course_name || a.courseName) === (c.course_name || c.name)
        ).length;
        list.push({ code: c.course_code || c.code, name: c.course_name || c.name, count });
      }
    });
    return list;
  }, [courses, assessments]);

  // Dynamically compute counts based on the currently selected courseFilter!
  const counts = useMemo(() => {
    let overdue = 0;
    let urgent = 0;
    let medium = 0;
    let highImpact = 0;
    let low = 0;
    let completed = 0;
    let total = 0;

    assessments.forEach((item) => {
      if (courseFilter !== "all") {
        const matchesCode = (item.course_code || item.courseCode) === courseFilter;
        const matchesName = (item.course_name || item.courseName) === courseFilter;
        if (!matchesCode && !matchesName) return;
      }

      total++;
      const id = getAssessmentId(item);
      const isDone = item.status === "completed" || Boolean(completedItems[id]?.completed || item.completed);
      if (isDone) {
        completed++;
      } else {
        const p = item.priority_level || item.priority || item.status;
        if (p === "overdue") overdue++;
        else if (p === "urgent") urgent++;
        else if (p === "medium") medium++;
        else if (p === "high-impact") highImpact++;
        else if (p === "low") low++;
      }
    });

    return {
      all: total,
      overdue,
      urgent,
      medium,
      "high-impact": highImpact,
      low,
      completed,
    };
  }, [assessments, completedItems, courseFilter]);

  function getPriorityCount(priority) {
    return counts[priority] || 0;
  }

  const filteredAssessments = useMemo(() => {
    return assessments.filter((item) => {
      const id = getAssessmentId(item);
      const isDone = item.status === "completed" || Boolean(completedItems[id]?.completed || item.completed);

      // Course filter
      if (courseFilter !== "all") {
        const matchesCode = (item.course_code || item.courseCode) === courseFilter;
        const matchesName = (item.course_name || item.courseName) === courseFilter;
        if (!matchesCode && !matchesName) return false;
      }

      // Priority / Completion filter
      if (priorityFilter === "completed") {
        if (!isDone) return false;
      } else if (priorityFilter !== "all") {
        if (isDone) return false;
        if ((item.priority_level || item.priority || item.status) !== priorityFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const title = (item.title || item.item || "").toLowerCase();
        const topic = (item.topic || "").toLowerCase();
        const course = (item.course_name || item.courseName || "").toLowerCase();
        const code = (item.course_code || item.courseCode || "").toLowerCase();
        if (!title.includes(q) && !topic.includes(q) && !course.includes(q) && !code.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [assessments, completedItems, priorityFilter, courseFilter, searchQuery]);

  const totalFiltered = counts.all;
  const completedCount = counts.completed;
  const progressPercent = totalFiltered > 0 ? Math.round((completedCount / totalFiltered) * 100) : 0;

  const todayStr = new Date().toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const selectedCourseLabel = useMemo(() => {
    if (courseFilter === "all") return null;
    const found = subjectOptions.find((c) => c.code === courseFilter || c.name === courseFilter);
    return found ? (found.code ? `${found.code}: ${found.name}` : found.name) : courseFilter;
  }, [courseFilter, subjectOptions]);

  function handleOpenPracticeStudio(item) {
    setPracticeStudioItem(item);
    setActiveTab("practice");
  }

  function handleSelectSubject(courseIdentifier) {
    setCourseFilter(courseIdentifier);
    setActiveTab("plan");
  }

  return (
    <main className="planner-page">
      <div className="dashboard-header-wrapper">
        <header className="dashboard-header">
          <div className="brand" onClick={onViewLanding}>
            <span className="brand-mark">S</span>
            <span>Syllabus Surgeon</span>
          </div>

          {/* Phase 3A: Workspace Switcher */}
          <div className="workspace-switcher-wrapper">
            <button
              className="workspace-switcher-btn"
              onClick={() => setWorkspaceMenuOpen((prev) => !prev)}
            >
              <span className="ws-icon">📂</span>
              <span className="ws-name">{activeWorkspace.name}</span>
              <span className="ws-caret">▾</span>
            </button>

            {workspaceMenuOpen && (
              <div className="workspace-dropdown-menu" onClick={() => setWorkspaceMenuOpen(false)}>
                <div className="dropdown-label">YOUR WORKSPACES</div>
                {workspaces.map((ws) => (
                  <div key={ws.id} className="workspace-dropdown-row">
                    <button
                      className={`dropdown-item ${ws.id === currentWorkspaceId ? "active" : ""}`}
                      onClick={() => onSwitchWorkspace(ws.id)}
                    >
                      <span>{ws.name}</span>
                      {ws.semester && <small>{ws.semester}</small>}
                    </button>
                    <button
                      className="btn-ws-edit"
                      title="Workspace settings / delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setWorkspaceMenuOpen(false);
                        onOpenWorkspaceModal(ws);
                      }}
                    >
                      ⚙
                    </button>
                  </div>
                ))}
                <div className="dropdown-divider" />
                <button
                  className="dropdown-item btn-create-ws"
                  onClick={() => onOpenWorkspaceModal(null)}
                >
                  <span>+ Create new workspace</span>
                </button>
              </div>
            )}
          </div>

          <nav className="header-nav-tabs">
            <button
              className={`header-tab-btn ${activeTab === "plan" ? "active" : ""}`}
              onClick={() => setActiveTab("plan")}
            >
              <span>▦</span> Plan
            </button>
            <button
              className={`header-tab-btn ${activeTab === "calendar" ? "active" : ""}`}
              onClick={() => setActiveTab("calendar")}
            >
              <span>📅</span> Calendar
            </button>
            <button
              className={`header-tab-btn ${activeTab === "daily" ? "active" : ""}`}
              onClick={() => setActiveTab("daily")}
            >
              <span>⚡</span> Daily Plan
            </button>
            <button
              className={`header-tab-btn ${activeTab === "sessions" ? "active" : ""}`}
              onClick={() => setActiveTab("sessions")}
            >
              <span>⏱</span> Sessions ({studySessions.length})
            </button>
            <button
              className={`header-tab-btn ${activeTab === "subjects" ? "active" : ""}`}
              onClick={() => setActiveTab("subjects")}
            >
              <span>📚</span> Subjects
            </button>
            <button
              className={`header-tab-btn ${activeTab === "practice" ? "active" : ""}`}
              onClick={() => setActiveTab("practice")}
            >
              <span>✦</span> Practice
            </button>
            <button
              className={`header-tab-btn ${activeTab === "progress" ? "active" : ""}`}
              onClick={() => setActiveTab("progress")}
            >
              <span>📊</span> Progress
            </button>
          </nav>

          <div className="dashboard-header-actions">
            {currentUser ? (
              <div className="user-profile-menu-wrapper">
                <button
                  className="user-profile-badge"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                >
                  <span className="user-avatar-sm">
                    {currentUser.display_name?.charAt(0).toUpperCase() || "S"}
                  </span>
                  <span className="user-name-text">{currentUser.display_name || "Account"}</span>
                  <span className="ws-caret">▾</span>
                </button>

                {userMenuOpen && (
                  <div className="user-dropdown-menu" onClick={() => setUserMenuOpen(false)}>
                    <div className="dropdown-user-info">
                      <strong>{currentUser.display_name || "Student"}</strong>
                      <small>{currentUser.email}</small>
                    </div>
                    <div className="dropdown-divider" />
                    <button className="dropdown-item" onClick={() => onOpenWorkspaceModal(activeWorkspace)}>
                      ⚙ Workspace settings
                    </button>
                    <button className="dropdown-item" onClick={onOpenExport}>
                      📥 Export workspace
                    </button>
                    <div className="dropdown-divider" />
                    <button className="dropdown-item text-danger" onClick={onLogout}>
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="btn-header-action btn-auth-pill" onClick={onOpenAuthModal}>
                <span>👤</span> Log In / Sign Up
              </button>
            )}

            <button
              className="btn-header-action"
              onClick={() => openNewCalendarSession(new Date(), 9)}
              title="Schedule a new study session"
            >
              ⏱ Session
            </button>
            <button className="btn-header-action" onClick={onOpenExport} title="Export calendar (.ics), CSV, JSON">
              📥 Export
            </button>
            <button className="upload-button" onClick={onOpenUpload}>
              <span>+</span>
              Upload PDF
            </button>
          </div>
        </header>
      </div>

      <div className="dashboard-layout">
        {/* Sidebar Nav */}
        <aside className="sidebar">
          <div className="sidebar-profile">
            <div className="profile-circle">
              {currentUser?.display_name?.charAt(0).toUpperCase() || "SS"}
            </div>
            <div>
              <strong>{currentUser?.display_name || "Study Workspace"}</strong>
              <span>{currentUser ? currentUser.email : "Local / Offline Mode"}</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <button
              className={activeTab === "plan" && priorityFilter === "all" ? "active" : ""}
              onClick={() => {
                setActiveTab("plan");
                setPriorityFilter("all");
              }}
            >
              <span>▦</span>
              Priority Plan ({counts.all})
            </button>

            <button
              className={activeTab === "calendar" ? "active" : ""}
              onClick={() => setActiveTab("calendar")}
            >
              <span>📅</span>
              Weekly Calendar
            </button>

            <button
              className={activeTab === "daily" ? "active" : ""}
              onClick={() => setActiveTab("daily")}
            >
              <span>⚡</span>
              Daily Study Plan
            </button>

            <button
              className={activeTab === "sessions" ? "active" : ""}
              onClick={() => setActiveTab("sessions")}
            >
              <span>⏱</span>
              Study Sessions ({studySessions.length})
            </button>

            <button
              className={activeTab === "subjects" ? "active" : ""}
              onClick={() => setActiveTab("subjects")}
            >
              <span>📚</span>
              Subjects Dashboard ({courses.length})
            </button>

            <button
              className={activeTab === "practice" ? "active" : ""}
              onClick={() => setActiveTab("practice")}
            >
              <span>✦</span>
              Practice Studio
            </button>

            <button
              className={activeTab === "progress" ? "active" : ""}
              onClick={() => setActiveTab("progress")}
            >
              <span>📊</span>
              Progress & Analytics
            </button>

            <div className="sidebar-divider" />

            <button
              className={activeTab === "plan" && priorityFilter === "overdue" ? "active" : ""}
              onClick={() => {
                setActiveTab("plan");
                setPriorityFilter("overdue");
              }}
            >
              <span>!</span>
              Overdue Tasks ({counts.overdue})
            </button>

            <button
              className={activeTab === "plan" && priorityFilter === "urgent" ? "active" : ""}
              onClick={() => {
                setActiveTab("plan");
                setPriorityFilter("urgent");
              }}
            >
              <span>↗</span>
              Urgent Tasks ({counts.urgent})
            </button>

            <button
              className={activeTab === "plan" && priorityFilter === "completed" ? "active" : ""}
              onClick={() => {
                setActiveTab("plan");
                setPriorityFilter("completed");
              }}
            >
              <span>✓</span>
              Completed ({counts.completed})
            </button>
          </nav>

          <div className="sidebar-help">
            <strong>Need to schedule study time?</strong>
            <p>Schedule a focused session with course milestones.</p>
            <button onClick={() => openNewCalendarSession(new Date(), 9)}>+ Schedule Session</button>
          </div>
        </aside>

        {/* Main Dashboard Canvas */}
        <section className="dashboard-content" id="dashboard">
          {/* Quick Header Banner */}
          <div className="dashboard-intro">
            <div>
              <span className="eyebrow">
                {activeTab === "calendar"
                  ? "ACADEMIC CALENDAR"
                  : activeTab === "daily"
                  ? "TODAY'S SCHEDULE"
                  : activeTab === "sessions"
                  ? "STUDY SESSIONS"
                  : activeTab === "subjects"
                  ? "SUBJECT PORTFOLIOS"
                  : activeTab === "practice"
                  ? "PRACTICE STUDIO"
                  : activeTab === "progress"
                  ? "SEMESTER ANALYTICS"
                  : "PRIORITY PLAN"}
              </span>
              <h1>
                {activeTab === "calendar"
                  ? "Weekly schedule & study sessions."
                  : activeTab === "daily"
                  ? "Your daily study itinerary."
                  : activeTab === "sessions"
                  ? "Your scheduled study sessions & time blocks."
                  : activeTab === "subjects"
                  ? "Subject breakdown & course stats."
                  : activeTab === "practice"
                  ? "Intelligent practice question generator."
                  : activeTab === "progress"
                  ? "Semester completion tracking."
                  : "Your priority plan is ready."}
              </h1>
              <p>
                {selectedCourseLabel
                  ? `Filtered to ${selectedCourseLabel}`
                  : `Managing workspace: ${activeWorkspace.name}`}
              </p>
            </div>

            <div className="dashboard-intro-right">
              <div className="date-chip">{todayStr}</div>
              <span className="method-tag">
                {currentUser ? "☁ Cloud Synced · PostgreSQL" : "⚡ Local Workspace Mode"}
              </span>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="stats-grid">
            <StatCard
              value={courseFilter === "all" ? subjectOptions.length : 1}
              label={courseFilter === "all" ? "Subjects" : "Selected Subject"}
              icon="▦"
            />
            <StatCard value={counts.all} label="Assessments" icon="✓" />
            <StatCard value={studySessions.length} label="Study Sessions" icon="⏱" />
            <StatCard value={counts.completed} label="Completed" icon="✓" />
            <StatCard
              value={`${progressPercent}%`}
              label="Plan completed"
              isProgress={true}
              progressPercent={progressPercent}
            />
          </div>

          {warnings && warnings.length > 0 && (
            <div className="warning-banner" style={{ marginBottom: 20 }}>
              <strong>Extraction notes:</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                {warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Tab View Switching */}
          {activeTab === "calendar" && (
            <WeeklyCalendar
              weekStart={calendarWeekStart}
              sessions={studySessions}
              courses={courses}
              assessments={assessments}
              onPreviousWeek={() => moveCalendarWeek(-1)}
              onNextWeek={() => moveCalendarWeek(1)}
              onToday={() => setCalendarWeekStart(getStartOfWeek(new Date()))}
              onCreateSession={openNewCalendarSession}
              onEditSession={openEditCalendarSession}
            />
          )}

          {activeTab === "daily" && (
            <DailyPlanView
              assessments={assessments}
              targetDates={targetDates}
              completedItems={completedItems}
              onToggleComplete={onToggleComplete}
              onPractice={handleOpenPracticeStudio}
              onClickDetail={setSelectedDrawerItem}
            />
          )}

          {activeTab === "sessions" && (
            <StudySessionsView
              studySessions={studySessions}
              courses={courses}
              assessments={assessments}
              onOpenCreateSession={openNewCalendarSession}
              onUpdateSession={onUpdateSession}
              onDeleteSession={onDeleteSession}
            />
          )}

          {activeTab === "subjects" && (
            <SubjectsDashboardView
              courses={courses}
              assessments={assessments}
              completedItems={completedItems}
              onSelectSubjectFilter={handleSelectSubject}
              onOpenPractice={handleOpenPracticeStudio}
              onClickDetail={setSelectedDrawerItem}
            />
          )}

          {activeTab === "practice" && (
            <PracticeStudioView
              assessments={assessments}
              courses={courses}
              initialItem={practiceStudioItem}
              onOpenUpload={onOpenUpload}
            />
          )}

          {activeTab === "progress" && (
            <>
              <AnalyticsCards analytics={analytics} />
              <CourseProgress courseProgress={courseProgress} />
              <AssessmentTimingSummary assessments={assessments} />
              <ProgressDashboardView
                courses={courses}
                assessments={assessments}
                completedItems={completedItems}
                onSelectSubjectFilter={handleSelectSubject}
              />
            </>
          )}

          {activeTab === "plan" && (
            assessments.length === 0 ? (
              <div className="empty-workspace-state">
                <div className="empty-workspace-icon">📂</div>
                <h2>Your workspace is empty</h2>
                <p>
                  No course syllabus has been uploaded yet. Upload your syllabus PDF to automatically extract subjects, deadlines, grade weightings, and prioritized study recommendations.
                </p>
                <button className="primary-button" onClick={onOpenUpload}>
                  <span>+</span> Upload Syllabus PDF
                </button>
              </div>
            ) : (
              <>
                {/* Step 12: Dashboard Analytics & Progress */}
                <AnalyticsCards analytics={analytics} />

                <CourseProgress courseProgress={courseProgress} />

                <AssessmentTimingSummary assessments={assessments} />

                {/* Step 11: Weekly Calendar */}
                <WeeklyCalendar
                  weekStart={calendarWeekStart}
                  sessions={studySessions}
                  courses={courses}
                  assessments={assessments}
                  onPreviousWeek={() => moveCalendarWeek(-1)}
                  onNextWeek={() => moveCalendarWeek(1)}
                  onToday={() =>
                    setCalendarWeekStart(getStartOfWeek(new Date()))
                  }
                  onCreateSession={openNewCalendarSession}
                  onEditSession={openEditCalendarSession}
                />

                {/* Filters & Search Toolbar */}
                <div className="filters-container">
                  <div className="filters-top-row">
                    <select
                      className="course-filter-select"
                      value={courseFilter}
                      onChange={(e) => setCourseFilter(e.target.value)}
                    >
                      <option value="all">
                        All subjects ({assessments.length} total)
                      </option>
                      {subjectOptions.map((c) => (
                        <option key={c.code || c.name} value={c.code || c.name}>
                          {c.code ? `${c.code}: ${c.name}` : c.name} ({c.count})
                        </option>
                      ))}
                    </select>

                    <div className="search-input-wrapper">
                      <input
                        type="text"
                        className="search-input"
                        placeholder="Search assessments or topics…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      {searchQuery && (
                        <button className="search-clear-btn" onClick={() => setSearchQuery("")}>
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="filter-tabs">
                    {[
                      { key: "all", label: "All", count: counts.all },
                      { key: "overdue", label: "Overdue", count: counts.overdue },
                      { key: "urgent", label: "Urgent", count: counts.urgent },
                      { key: "medium", label: "Medium", count: counts.medium },
                      { key: "high-impact", label: "High impact", count: counts["high-impact"] },
                      { key: "low", label: "Low", count: counts.low },
                      { key: "completed", label: "Completed", count: counts.completed },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        className={priorityFilter === tab.key ? "selected" : ""}
                        onClick={() => setPriorityFilter(tab.key)}
                      >
                        {tab.label}
                        <span className="tab-count">{tab.count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assessment Cards List */}
                <div className="assessment-list" id="assessments">
                  {filteredAssessments.length > 0 ? (
                    filteredAssessments.map((item, index) => {
                      const id = getAssessmentId(item);
                      const isCompleted = item.status === "completed" || Boolean(completedItems[id]?.completed || item.completed);
                      const targetDate = targetDates[id] || item.target_date || "";

                      return (
                        <AssessmentCard
                          key={`${id}-${index}`}
                          item={item}
                          targetDate={targetDate}
                          isCompleted={isCompleted}
                          onToggleComplete={onToggleComplete}
                          onSetTargetDate={onSetTargetDate}
                          onSaveAssessmentChanges={onSaveAssessmentChanges}
                          onCompletedHoursChange={onCompletedHoursChange}
                          onPractice={handleOpenPracticeStudio}
                          onClickDetail={setSelectedDrawerItem}
                        />
                      );
                    })
                  ) : (
                    <div className="empty-filter">
                      <h3>No assessments match your filters</h3>
                      <p>Try clearing your search query or choosing another priority / subject filter.</p>
                    </div>
                  )}
                </div>
              </>
            )
          )}
        </section>
      </div>

      {/* Step 11: Calendar Modal */}
      {calendarModalOpen && (
        <div className="modal-backdrop" onClick={() => setCalendarModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {selectedCalendarSession
                  ? "Edit study session"
                  : "Create study session"}
              </h2>

              <button
                type="button"
                className="modal-close"
                onClick={() => setCalendarModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <label>
              Course
              <select
                value={calendarForm.course_id}
                onChange={(event) =>
                  setCalendarForm((previous) => ({
                    ...previous,
                    course_id: event.target.value,
                  }))
                }
              >
                <option value="">Select course</option>

                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code || course.course_code
                      ? `${course.code || course.course_code} · ${course.name || course.course_name}`
                      : course.name || course.course_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Assessment
              <select
                value={calendarForm.assessment_id}
                onChange={(event) =>
                  setCalendarForm((previous) => ({
                    ...previous,
                    assessment_id: event.target.value,
                  }))
                }
              >
                <option value="">General study</option>

                {assessments
                  .filter(
                    (assessment) =>
                      !calendarForm.course_id ||
                      (assessment.course_id || assessment.courseId) === calendarForm.course_id
                  )
                  .map((assessment) => (
                    <option key={assessment.id} value={assessment.id}>
                      {assessment.title || assessment.item}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Date
              <input
                type="date"
                value={calendarForm.session_date}
                onChange={(event) =>
                  setCalendarForm((previous) => ({
                    ...previous,
                    session_date: event.target.value,
                  }))
                }
              />
            </label>

            <div className="modal-two-column">
              <label>
                Start time
                <input
                  type="time"
                  value={calendarForm.start_time}
                  onChange={(event) =>
                    setCalendarForm((previous) => ({
                      ...previous,
                      start_time: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                End time
                <input
                  type="time"
                  value={calendarForm.end_time}
                  onChange={(event) =>
                    setCalendarForm((previous) => ({
                      ...previous,
                      end_time: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <label>
              Planned minutes
              <input
                type="number"
                min="1"
                value={calendarForm.planned_minutes}
                onChange={(event) =>
                  setCalendarForm((previous) => ({
                    ...previous,
                    planned_minutes: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Notes
              <textarea
                value={calendarForm.notes}
                onChange={(event) =>
                  setCalendarForm((previous) => ({
                    ...previous,
                    notes: event.target.value,
                  }))
                }
              />
            </label>

            <div className="modal-actions">
              {selectedCalendarSession && (
                <button
                  type="button"
                  className="danger-button"
                  onClick={handleDeleteCalendarSession}
                >
                  Delete
                </button>
              )}

              <button
                type="button"
                onClick={() => setCalendarModalOpen(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={handleSaveCalendarSession}
              >
                Save session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assessment Detail Drawer / Panel */}
      {selectedDrawerItem && (
        <AssessmentDetailDrawer
          item={selectedDrawerItem}
          onClose={() => setSelectedDrawerItem(null)}
          targetDate={targetDates[getAssessmentId(selectedDrawerItem)] || selectedDrawerItem.target_date}
          isCompleted={selectedDrawerItem.status === "completed" || Boolean(completedItems[getAssessmentId(selectedDrawerItem)]?.completed || selectedDrawerItem.completed)}
          onToggleComplete={onToggleComplete}
          onSetTargetDate={onSetTargetDate}
          onSaveAssessmentChanges={onSaveAssessmentChanges}
          onCompletedHoursChange={onCompletedHoursChange}
          onPractice={handleOpenPracticeStudio}
          onScheduleSession={openNewCalendarSession}
        />
      )}
    </main>
  );
}

/* =========================================================================
   LANDING PAGE COMPONENT
   ========================================================================= */
function LandingPage({
  onSelectFile,
  selectedFile,
  onAnalyze,
  uploading,
  loadingStage,
  error,
  onViewDashboard,
  hasExistingPlan,
  currentUser,
  onOpenAuthModal,
  onLogout,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onSelectFile(file);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      onSelectFile(file);
    }
  }

  function formatFileSize(bytes) {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <main className="landing-page">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden-file-input"
        onChange={handleFileChange}
      />

      <section className="hero-section">
        <nav className="site-nav">
          <div className="brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <span className="brand-mark">S</span>
            <span>Syllabus Surgeon</span>
          </div>

          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#about">About</a>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {hasExistingPlan && (
              <button className="nav-button" onClick={onViewDashboard}>
                Open workspace →
              </button>
            )}
            {currentUser ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {!hasExistingPlan && (
                  <button className="nav-button" onClick={onViewDashboard}>
                    Workspace ({currentUser.display_name || "Dashboard"}) →
                  </button>
                )}
                <button className="btn-header-action" onClick={onLogout} title="Log out">
                  Log out
                </button>
              </div>
            ) : (
              <>
                <button className="btn-header-action" onClick={onOpenAuthModal}>
                  Log in
                </button>
                {!hasExistingPlan && (
                  <button
                    className="nav-button"
                    onClick={() => {
                      const el = document.getElementById("upload-section");
                      el?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Get started
                  </button>
                )}
              </>
            )}
          </div>
        </nav>

        <div className="hero-content">
          <div className="hero-copy">
            <span className="eyebrow">YOUR SMART STUDY OPERATING SYSTEM</span>

            <h1>
              Turn your syllabus
              <br />
              into a <em>smart workspace.</em>
            </h1>

            <p>
              Upload dense course syllabi and discover what is overdue,
              what matters most, and what you should study next with AI practice questions.
            </p>

            <div className="hero-actions">
              {hasExistingPlan ? (
                <>
                  <button className="primary-button" onClick={onViewDashboard}>
                    Open workspace
                    <span>→</span>
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      const el = document.getElementById("upload-section");
                      el?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Upload syllabus PDF
                    <span>↗</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="primary-button"
                    onClick={() => {
                      const el = document.getElementById("upload-section");
                      el?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Upload your syllabus
                    <span>↗</span>
                  </button>

                  <a className="secondary-button" href="#how-it-works">
                    See how it works
                    <span>↓</span>
                  </a>
                </>
              )}
            </div>

            <div className="hero-note">
              <span className="check-mark">✓</span>
              Built for students who want less planning and more academic progress.
            </div>
          </div>

          <div className="hero-preview">
            <div className="preview-window">
              <div className="preview-header">
                <div className="preview-brand">
                  <span className="brand-mark small">S</span>
                  <span>Syllabus Surgeon</span>
                </div>
                <span className="preview-menu">•••</span>
              </div>

              <div className="preview-body">
                <div className="preview-welcome">
                  <div>
                    <span className="preview-overline">ACADEMIC WORKSPACE</span>
                    <h2>Your priorities are ready.</h2>
                  </div>
                  <div className="preview-avatar">SS</div>
                </div>

                <div className="preview-stats">
                  <div>
                    <strong>5</strong>
                    <span>Subjects</span>
                  </div>
                  <div>
                    <strong>30</strong>
                    <span>Assessments</span>
                  </div>
                  <div>
                    <strong className="danger-number">7</strong>
                    <span>Overdue</span>
                  </div>
                </div>

                <div className="preview-plan-header">
                  <strong>Daily study plan</strong>
                  <span>View all →</span>
                </div>

                <div className="preview-task">
                  <div className="task-symbol danger">!</div>
                  <div>
                    <span>CS501 · Artificial Intelligence</span>
                    <strong>Diagnostic quiz</strong>
                    <small>Due August 14 · 5%</small>
                  </div>
                  <span className="mini-badge danger">Overdue</span>
                </div>

                <div className="preview-task">
                  <div className="task-symbol warning">↗</div>
                  <div>
                    <span>CS503 · Business Analytics</span>
                    <strong>Visualization critique</strong>
                    <small>Due September 11 · 7%</small>
                  </div>
                  <span className="mini-badge warning">Urgent</span>
                </div>

                <div className="preview-progress">
                  <div>
                    <span>Semester progress</span>
                    <strong>64%</strong>
                  </div>
                  <div className="progress-track">
                    <span />
                  </div>
                </div>
              </div>
            </div>

            <div className="floating-note note-one">
              <span>✓</span>
              Grade-aware priorities
            </div>

            <div className="floating-note note-two">
              <span>↗</span>
              Practice Studio
            </div>
          </div>
        </div>
      </section>

      {/* Upload Card Section */}
      <section className="upload-card-section" id="upload-section">
        <div className="upload-card">
          <div className="upload-card-header">
            <h2>Upload your syllabus</h2>
            <p>Upload a course syllabus PDF to automatically generate a prioritized semester schedule.</p>
          </div>

          {uploading ? (
            <div className="upload-loading-box">
              <div className="loading-spinner" />
              <h3>{loadingStage || "Analyzing syllabus…"}</h3>
              <p>Please wait while the AI extracts courses, dates, weights, and priorities.</p>
            </div>
          ) : (
            <>
              <div
                className={`dropzone ${isDragOver ? "active" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="dropzone-icon">📄</div>
                <div className="dropzone-title">Drag and drop your PDF here</div>
                <div className="dropzone-subtitle">or click to browse from your device</div>
                <button
                  type="button"
                  className="btn-choose-file"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Choose PDF file
                </button>
                <div className="dropzone-meta">PDF files only · Maximum file size: 10 MB</div>
              </div>

              {selectedFile && (
                <div className="selected-file-info">
                  <div className="file-details">
                    <span className="file-icon">📑</span>
                    <div>
                      <strong>{selectedFile.name}</strong>
                      <span>{formatFileSize(selectedFile.size)}</span>
                    </div>
                  </div>
                  <button className="btn-analyze-file" onClick={onAnalyze}>
                    Analyze syllabus →
                  </button>
                </div>
              )}

              {error && <div className="error-banner" style={{ marginTop: 16 }}>⚠ {error}</div>}
            </>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" id="features">
        <div className="section-heading">
          <span className="eyebrow">WHY SYLLABUS SURGEON</span>
          <h2>Everything you need to study with direction.</h2>
          <p>
            Replace scattered deadlines and overwhelming topic lists with one
            clear academic command center.
          </p>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon purple">◎</div>
            <h3>Grade-aware priorities</h3>
            <p>
              Ranks assessments using both deadline urgency and impact on your final grade.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon orange">⚡</div>
            <h3>Daily study planner</h3>
            <p>
              Generates an actionable daily study queue with estimated minutes and explicit reasoning.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon green">✦</div>
            <h3>Practice question studio</h3>
            <p>
              Generates targeted practice questions with difficulty tiers, multiple choice options, and answer explanations.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon blue">📅</div>
            <h3>Academic calendar & .ics</h3>
            <p>
              Syncs deadlines and target dates directly with Google Calendar, Apple Calendar, and Outlook.
            </p>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="workflow-section" id="how-it-works">
        <div className="section-heading">
          <span className="eyebrow">HOW IT WORKS</span>
          <h2>From syllabus to study system in four steps.</h2>
        </div>

        <div className="workflow-grid">
          <div className="workflow-step">
            <span>01</span>
            <h3>Upload</h3>
            <p>Choose your syllabus PDF file.</p>
          </div>

          <div className="workflow-step">
            <span>02</span>
            <h3>Analyze</h3>
            <p>Extract subjects, topics, dates, and weights.</p>
          </div>

          <div className="workflow-step">
            <span>03</span>
            <h3>Prioritize</h3>
            <p>Rank tasks using urgency and grade impact.</p>
          </div>

          <div className="workflow-step">
            <span>04</span>
            <h3>Study</h3>
            <p>Follow the daily plan and practice important topics.</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final-cta" id="about">
        <div>
          <span className="eyebrow">START YOUR SEMESTER SMARTER</span>
          <h2>Your syllabus. Your priorities. Your next step.</h2>
        </div>

        <button
          className="primary-button light"
          onClick={() => {
            const el = document.getElementById("upload-section");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          Build my study plan
          <span>↗</span>
        </button>
      </section>
    </main>
  );
}

/* =========================================================================
   MAIN APP COMPONENT (PHASE 3A AUTH & WORKSPACES)
   ========================================================================= */
/* =========================================================================
   MAIN APP COMPONENT (PHASE 3A AUTH, WORKSPACES & STEP 9/10 PERSISTENCE)
   ========================================================================= */
export default function App() {
  const [view, setView] = useState("landing");
  const [courses, setCourses] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [warnings, setWarnings] = useState([]);

  // Phase 3A: Auth & Workspaces State
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [workspaces, setWorkspaces] = useState([
    { id: "default-ws", name: "Fall 2026 Semester", semester: "Fall 2026" },
  ]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState("default-ws");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState(null);

  // Step 10: Study Sessions State
  const [studySessions, setStudySessions] = useState([]);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [studySessionModalOpen, setStudySessionModalOpen] = useState(false);
  const [studySessionPrefill, setStudySessionPrefill] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  const [targetDates, setTargetDates] = useState({});
  const [completedItems, setCompletedItems] = useState({});

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Initialize from API / Cloud / LocalStorage
  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const savedToken = localStorage.getItem(STORAGE_KEYS.authToken);
        const savedUser = localStorage.getItem(STORAGE_KEYS.user);
        const savedPlan = localStorage.getItem(STORAGE_KEYS.plan);
        const savedTargetDates = localStorage.getItem(STORAGE_KEYS.targetDates);
        const savedCompleted = localStorage.getItem(STORAGE_KEYS.completed);

        const targets = savedTargetDates ? JSON.parse(savedTargetDates) : {};
        const completed = savedCompleted ? JSON.parse(savedCompleted) : {};

        if (savedTargetDates) setTargetDates(targets);
        if (savedCompleted) setCompletedItems(completed);

        if (savedToken && savedUser) {
          setAuthToken(savedToken);
          setCurrentUser(JSON.parse(savedUser));
        }

        // 1. Fetch workspaces from PostgreSQL API
        const wsList = await getWorkspaces();
        if (cancelled) return;

        if (wsList && wsList.length > 0) {
          setWorkspaces(wsList);
          const activeWs = wsList[0];
          setCurrentWorkspaceId(activeWs.id);

          // Fetch courses from active workspace
          const cloudCourses = await getCourses(activeWs.id);
          if (cancelled) return;

          if (cloudCourses && cloudCourses.length > 0) {
            setCourses(cloudCourses);
            const allAssessments = [];
            for (const course of cloudCourses) {
              const assessmentsList = await getAssessments(course.id);
              assessmentsList.forEach((a) => {
                allAssessments.push(normalizeAssessment(a, course));
              });
            }
            if (!cancelled && allAssessments.length > 0) {
              flattenAndSetAssessments(cloudCourses, targets, completed);
            }

            // Fetch study sessions for courses
            try {
              const sessionGroups = await Promise.all(
                cloudCourses.map(async (course) => {
                  try {
                    const sessions = await getStudySessions(course.id);
                    return sessions.map((session) =>
                      normalizeStudySession(session, course)
                    );
                  } catch {
                    return [];
                  }
                })
              );
              if (!cancelled) {
                setStudySessions(sessionGroups.flat());
              }
            } catch {
              // Ignore session load error
            }
          }
        } else if (savedPlan) {
          const parsed = JSON.parse(savedPlan);
          if (parsed?.courses?.length) {
            setCourses(parsed.courses);
            setWarnings(parsed.warnings || []);
            flattenAndSetAssessments(parsed.courses, targets, completed);
          }
        }
      } catch (err) {
        // Fallback to local storage
        try {
          const savedPlan = localStorage.getItem(STORAGE_KEYS.plan);
          if (savedPlan) {
            const parsed = JSON.parse(savedPlan);
            if (parsed?.courses?.length) {
              setCourses(parsed.courses);
              setWarnings(parsed.warnings || []);
              flattenAndSetAssessments(parsed.courses);
            }
          }
        } catch {
          // Ignore fallback error
        }
      }
    }

    loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  async function fetchCloudWorkspaces(token) {
    try {
      const wsList = await getWorkspaces();
      if (wsList && wsList.length > 0) {
        setWorkspaces(wsList);
        setCurrentWorkspaceId(wsList[0].id);
        fetchWorkspaceCourses(wsList[0].id, token);
      }
    } catch {
      // Offline fallback
    }
  }

  async function fetchWorkspaceCourses(workspaceId, token) {
    if (!workspaceId) return;
    try {
      const cloudCourses = await getCourses(workspaceId);
      if (cloudCourses && cloudCourses.length > 0) {
        setCourses(cloudCourses);
        flattenAndSetAssessments(cloudCourses);

        // Fetch study sessions
        const sessionGroups = await Promise.all(
          cloudCourses.map(async (course) => {
            try {
              const sessions = await getStudySessions(course.id);
              return sessions.map((session) =>
                normalizeStudySession(session, course)
              );
            } catch {
              return [];
            }
          })
        );
        setStudySessions(sessionGroups.flat());
      }
    } catch {
      // Offline fallback
    }
  }

  function handleLoginSuccess(token, user) {
    setAuthToken(token);
    setCurrentUser(user);
    localStorage.setItem(STORAGE_KEYS.authToken, token);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    fetchCloudWorkspaces(token);
  }

  function handleLogout() {
    setAuthToken(null);
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEYS.authToken);
    localStorage.removeItem(STORAGE_KEYS.user);
    setWorkspaces([{ id: "default-ws", name: "Default Semester", semester: "Current" }]);
    setCurrentWorkspaceId("default-ws");
    setStudySessions([]);
  }

  async function handleCreateOrUpdateWorkspace(name, semester) {
    if (editingWorkspace && authToken) {
      try {
        const updated = await api.updateWorkspace(editingWorkspace.id, { name, semester }, authToken);
        if (updated) {
          setWorkspaces((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
        }
      } catch {
        setWorkspaces((prev) =>
          prev.map((w) => (w.id === editingWorkspace.id ? { ...w, name, semester } : w))
        );
      }
    } else if (authToken) {
      try {
        const created = await api.createWorkspace({ name, semester }, authToken);
        if (created) {
          setWorkspaces((prev) => [created, ...prev]);
          setCurrentWorkspaceId(created.id);
        }
      } catch {
        const localWs = { id: `ws-${Date.now()}`, name, semester };
        setWorkspaces((prev) => [localWs, ...prev]);
        setCurrentWorkspaceId(localWs.id);
      }
    } else {
      const localWs = { id: `ws-${Date.now()}`, name, semester };
      setWorkspaces((prev) => [localWs, ...prev]);
      setCurrentWorkspaceId(localWs.id);
    }
    setEditingWorkspace(null);
  }

  async function handleDeleteWorkspace(workspaceId) {
    if (!workspaceId) return;

    if (authToken) {
      try {
        await api.deleteWorkspace(workspaceId, authToken);
      } catch {
        // Fallback local delete
      }
    }

    const updated = workspaces.filter((w) => w.id !== workspaceId);
    if (updated.length === 0) {
      const fallback = { id: `ws-${Date.now()}`, name: "Default Semester", semester: "Current" };
      setWorkspaces([fallback]);
      setCurrentWorkspaceId(fallback.id);
      setCourses([]);
      setAssessments([]);
      setStudySessions([]);
    } else {
      setWorkspaces(updated);
      if (currentWorkspaceId === workspaceId) {
        const nextWs = updated[0];
        setCurrentWorkspaceId(nextWs.id);
        if (authToken) {
          fetchWorkspaceCourses(nextWs.id, authToken);
        } else {
          setCourses([]);
          setAssessments([]);
          setStudySessions([]);
        }
      }
    }

    setEditingWorkspace(null);
    setWorkspaceModalOpen(false);
  }

  function flattenAndSetAssessments(coursesList, targetMap = targetDates, completedMap = completedItems) {
    const list = coursesList.flatMap((course) =>
      (course.items || course.assessments || []).map((it) => {
        const id = it.id || getAssessmentId({ ...it, course_code: course.course_code || course.code });
        const isDone = Boolean(
          completedMap[id]?.completed || it.completed || it.status === "completed"
        );
        return {
          ...it,
          id: it.id || id,
          title: it.item || it.title,
          course_code: course.course_code || course.code,
          course_name: course.course_name || course.name,
          official_due_date: it.official_due_date || it.due_date || null,
          due_date: it.official_due_date || it.due_date || null,
          target_date: targetMap[id] || it.target_date || "",
          targetDate: targetMap[id] || it.target_date || "",
          status: it.status || (isDone ? "completed" : "not_started"),
          completed: isDone,
          priority_level: it.priority_level || it.priority || "medium",
          priority: it.priority || it.priority_level || "medium",
          estimatedHours: Number(it.estimated_hours ?? it.estimatedHours ?? 1),
          completedHours: Number(it.completed_hours ?? it.completedHours ?? 0),
        };
      })
    );

    list.sort((a, b) => {
      const orderA = PRIORITY_ORDER[a.priority_level] ?? 99;
      const orderB = PRIORITY_ORDER[b.priority_level] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return (b.priority_score || 0) - (a.priority_score || 0);
    });

    setAssessments(list);
  }

  function handleSelectFile(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setError("Please select a valid PDF document.");
      setSelectedFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File is too large. Maximum size is 10 MB.");
      setSelectedFile(null);
      return;
    }

    setError("");
    setSelectedFile(file);
  }

  async function handleAnalyze() {
    if (!selectedFile) return;

    setUploading(true);
    setError("");
    setLoadingStage("Reading syllabus PDF…");

    const formData = new FormData();
    formData.append("file", selectedFile);
    if (currentWorkspaceId && currentWorkspaceId !== "default-ws") {
      formData.append("workspace_id", currentWorkspaceId);
    }

    try {
      setTimeout(() => setLoadingStage("Extracting subjects & assessment topics…"), 1200);
      setTimeout(() => setLoadingStage("Building grade-aware priority plan…"), 3500);

      const response = await fetch(`${API}/api/upload`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Failed to analyze syllabus.");
      }

      setCourses(result.courses || []);
      setWarnings(result.warnings || []);
      flattenAndSetAssessments(result.courses || []);

      // Persist plan in localStorage
      localStorage.setItem(
        STORAGE_KEYS.plan,
        JSON.stringify({
          courses: result.courses || [],
          warnings: result.warnings || [],
          uploadedAt: new Date().toISOString(),
        })
      );

      setSelectedFile(null);
      setView("planner");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      setLoadingStage("");
    }
  }

  // Step 9: Save assessment changes to PostgreSQL & state
  async function saveAssessmentChanges(assessmentId, changes) {
    try {
      setLoadError("");
      const updatedAssessment = await updateAssessment(assessmentId, changes);

      const targetCourse = courses.find(
        (course) => course.id === updatedAssessment.course_id
      );

      const normalized = normalizeAssessment(updatedAssessment, targetCourse);

      setAssessments((previousAssessments) =>
        previousAssessments.map((assessment) => {
          const isMatch =
            assessment.id === assessmentId ||
            (assessment.course_id === updatedAssessment.course_id &&
              (assessment.title || assessment.item) === updatedAssessment.title);
          return isMatch ? { ...assessment, ...normalized } : assessment;
        })
      );

      if (changes.status !== undefined) {
        const isDone = changes.status === "completed";
        setCompletedItems((prev) => ({
          ...prev,
          [assessmentId]: {
            completed: isDone,
            completed_at: isDone ? new Date().toISOString() : null,
          },
        }));
      }
      if (changes.target_date !== undefined) {
        setTargetDates((prev) => ({
          ...prev,
          [assessmentId]: changes.target_date || "",
        }));
      }

      return updatedAssessment;
    } catch (err) {
      setLoadError(err.message || "Unable to save assessment changes");
      throw err;
    }
  }

  // Step 9: Fix Completion Toggle (status: "completed" / "not_started")
  async function handleToggleComplete(itemToUpdate) {
    const id = itemToUpdate.id || getAssessmentId(itemToUpdate);
    const currentlyDone =
      itemToUpdate.status === "completed" ||
      Boolean(completedItems[id]?.completed || itemToUpdate.completed);
    const nextStatus = currentlyDone ? "not_started" : "completed";

    const updatedMap = {
      ...completedItems,
      [id]: {
        completed: !currentlyDone,
        completed_at: !currentlyDone ? new Date().toISOString() : null,
      },
    };

    setCompletedItems(updatedMap);
    localStorage.setItem(STORAGE_KEYS.completed, JSON.stringify(updatedMap));

    // If item has a backend UUID, persist via API
    if (itemToUpdate.id && !String(itemToUpdate.id).includes("|")) {
      try {
        await saveAssessmentChanges(itemToUpdate.id, {
          status: nextStatus,
        });
        return;
      } catch {
        // Fallback local
      }
    }

    setAssessments((current) =>
      current.map((item) => {
        const sameItem =
          item.id === id ||
          (
            item.course_code === itemToUpdate.course_code &&
            (item.title || item.item) === (itemToUpdate.title || itemToUpdate.item) &&
            item.due_date === itemToUpdate.due_date
          );

        return sameItem
          ? {
              ...item,
              status: nextStatus,
              completed: !currentlyDone,
            }
          : item;
      })
    );
  }

  // Step 9: Target date update
  async function handleSetTargetDate(itemToUpdate, newDateStr) {
    const id = itemToUpdate.id || getAssessmentId(itemToUpdate);
    const updatedMap = {
      ...targetDates,
      [id]: newDateStr || "",
    };

    setTargetDates(updatedMap);
    localStorage.setItem(STORAGE_KEYS.targetDates, JSON.stringify(updatedMap));

    if (itemToUpdate.id && !String(itemToUpdate.id).includes("|")) {
      try {
        await saveAssessmentChanges(itemToUpdate.id, {
          target_date: newDateStr || null,
        });
        return;
      } catch {
        // Fallback local
      }
    }

    const updatedList = assessments.map((it) => {
      const isTarget =
        it.id === id ||
        (
          it.course_code === itemToUpdate.course_code &&
          (it.title || it.item) === (itemToUpdate.title || itemToUpdate.item) &&
          it.due_date === itemToUpdate.due_date
        );

      if (!isTarget) return it;

      return {
        ...it,
        target_date: newDateStr || null,
        targetDate: newDateStr || null,
      };
    });

    setAssessments(updatedList);
  }

  // Step 9: Safe completed hours change
  async function handleCompletedHoursChange(item, value) {
    const maxHours = Number(item.estimatedHours ?? item.estimated_hours ?? 100);
    const completedHours = Math.max(0, Math.min(Number(value), maxHours));

    if (item.id && !String(item.id).includes("|")) {
      try {
        await saveAssessmentChanges(item.id, {
          completed_hours: completedHours,
        });
        return;
      } catch {
        // Fallback local
      }
    }

    setAssessments((current) =>
      current.map((it) =>
        it.id === item.id || getAssessmentId(it) === getAssessmentId(item)
          ? { ...it, completed_hours: completedHours, completedHours }
          : it
      )
    );
  }

  // Step 10: Study Session Handlers
  async function handleCreateStudySession({
    courseId,
    assessmentId,
    sessionDate,
    startTime,
    endTime,
    plannedMinutes,
    notes,
  }) {
    try {
      setIsSavingSession(true);
      setSessionError("");

      const createdSession = await createStudySession({
        course_id: courseId,
        assessment_id: assessmentId || null,
        session_date: sessionDate,
        start_time: startTime || null,
        end_time: endTime || null,
        planned_minutes: Number(plannedMinutes),
        actual_minutes: 0,
        status: "planned",
        notes: notes || null,
      });

      const course = courses.find((item) => item.id === createdSession.course_id);
      const normalizedSession = normalizeStudySession(createdSession, course);

      setStudySessions((previousSessions) => [
        normalizedSession,
        ...previousSessions,
      ]);

      return normalizedSession;
    } catch (err) {
      setSessionError(err.message || "Unable to save study session");
      throw err;
    } finally {
      setIsSavingSession(false);
    }
  }

  async function handleUpdateStudySession(sessionId, changes) {
    try {
      const updatedSession = await updateStudySession(sessionId, changes);
      const course = courses.find((item) => item.id === updatedSession.course_id);
      const normalizedSession = normalizeStudySession(updatedSession, course);

      setStudySessions((previousSessions) =>
        previousSessions.map((session) =>
          session.id === sessionId ? normalizedSession : session
        )
      );
      return normalizedSession;
    } catch (err) {
      console.error("Failed to update study session:", err);
      throw err;
    }
  }

  async function handleDeleteStudySession(sessionId) {
    try {
      await deleteStudySession(sessionId);
      setStudySessions((previousSessions) =>
        previousSessions.filter((session) => session.id !== sessionId)
      );
    } catch (err) {
      console.error("Failed to delete study session:", err);
      throw err;
    }
  }

  function handleOpenCreateSession(prefill = null) {
    setStudySessionPrefill(prefill);
    setStudySessionModalOpen(true);
  }

  // Export functions
  function handleExportICS() {
    const icsString = generateICSFile(assessments, targetDates);
    const blob = new Blob([icsString], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `syllabus_schedule_${new Date().toISOString().slice(0, 10)}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportModalOpen(false);
  }

  function handleExportCSV() {
    const headers = [
      "Course Code",
      "Course Name",
      "Assessment",
      "Topic",
      "Due Date",
      "Grade Weight (%)",
      "Priority Level",
      "Days Remaining",
      "Target Date",
      "Completed",
      "Recommended Action",
      "Why Prioritized",
    ];

    const rows = assessments.map((it) => {
      const id = getAssessmentId(it);
      const isDone = it.completed ? "Yes" : "No";
      const target = targetDates[id] || it.target_date || "";
      const weight = it.weight_percent != null ? it.weight_percent : "";
      const days = it.days_until_due != null ? it.days_until_due : "";

      const clean = (val) => `"${String(val || "").replace(/"/g, '""')}"`;

      return [
        clean(it.course_code),
        clean(it.course_name),
        clean(it.title || it.item),
        clean(it.topic),
        clean(it.due_date),
        clean(weight),
        clean(it.priority_level || it.status),
        clean(days),
        clean(target),
        clean(isDone),
        clean(it.recommended_action || it.action),
        clean(it.why_prioritized || it.why),
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `syllabus_study_plan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportModalOpen(false);
  }

  function handleExportJSON() {
    const exportData = {
      exported_at: new Date().toISOString(),
      user: currentUser ? { email: currentUser.email, name: currentUser.display_name } : null,
      workspace: workspaces.find((w) => w.id === currentWorkspaceId) || null,
      subjects_count: courses.length,
      assessments_count: assessments.length,
      completed_count: assessments.filter((c) => c.completed).length,
      study_sessions_count: studySessions.length,
      courses: courses.map((c) => ({
        code: c.course_code,
        name: c.course_name,
        semester: c.semester,
      })),
      plan: assessments.map((it) => {
        const id = getAssessmentId(it);
        return {
          id: it.id,
          course_code: it.course_code,
          course_name: it.course_name,
          title: it.title || it.item,
          topic: it.topic,
          due_date: it.due_date,
          weight_percent: it.weight_percent,
          priority_level: it.priority_level,
          days_until_due: it.days_until_due,
          target_date: targetDates[id] || it.target_date || null,
          completed: Boolean(it.completed),
          why_prioritized: it.why_prioritized,
          recommended_action: it.recommended_action,
        };
      }),
      study_sessions: studySessions,
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `syllabus_study_plan_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportModalOpen(false);
  }

  function handlePrintPlan() {
    setExportModalOpen(false);
    setTimeout(() => {
      window.print();
    }, 200);
  }

  function handleResetWorkspace() {
    localStorage.removeItem(STORAGE_KEYS.plan);
    localStorage.removeItem(STORAGE_KEYS.targetDates);
    localStorage.removeItem(STORAGE_KEYS.completed);
    localStorage.removeItem(STORAGE_KEYS.filters);
    localStorage.removeItem(STORAGE_KEYS.studyPrefs);
    localStorage.removeItem(STORAGE_KEYS.practiceHistory);

    setCourses([]);
    setAssessments([]);
    setStudySessions([]);
    setWarnings([]);
    setTargetDates({});
    setCompletedItems({});
    setSelectedFile(null);
    setResetModalOpen(false);
    setView("landing");
  }

  return (
    <>
      {view === "landing" ? (
        <LandingPage
          onSelectFile={handleSelectFile}
          selectedFile={selectedFile}
          onAnalyze={handleAnalyze}
          uploading={uploading}
          loadingStage={loadingStage}
          error={error}
          onViewDashboard={() => setView("planner")}
          hasExistingPlan={assessments.length > 0}
          currentUser={currentUser}
          onOpenAuthModal={() => setAuthModalOpen(true)}
          onLogout={handleLogout}
        />
      ) : (
        <PlannerDashboard
          courses={courses}
          assessments={assessments}
          warnings={warnings}
          targetDates={targetDates}
          completedItems={completedItems}
          studySessions={studySessions}
          setStudySessions={setStudySessions}
          onToggleComplete={handleToggleComplete}
          onSetTargetDate={handleSetTargetDate}
          onSaveAssessmentChanges={saveAssessmentChanges}
          onCompletedHoursChange={handleCompletedHoursChange}
          onOpenCreateSession={handleOpenCreateSession}
          onUpdateSession={handleUpdateStudySession}
          onDeleteSession={handleDeleteStudySession}
          onOpenExport={() => setExportModalOpen(true)}
          onOpenReset={() => setResetModalOpen(true)}
          onOpenUpload={() => {
            setView("landing");
            setTimeout(() => {
              document.getElementById("upload-section")?.scrollIntoView({ behavior: "smooth" });
            }, 100);
          }}
          onViewLanding={() => setView("landing")}
          currentUser={currentUser}
          workspaces={workspaces}
          currentWorkspaceId={currentWorkspaceId}
          onSwitchWorkspace={(id) => {
            setCurrentWorkspaceId(id);
            if (authToken) {
              fetchWorkspaceCourses(id, authToken);
            }
          }}
          onOpenWorkspaceModal={(ws) => {
            setEditingWorkspace(ws);
            setWorkspaceModalOpen(true);
          }}
          onOpenAuthModal={() => setAuthModalOpen(true)}
          onLogout={handleLogout}
        />
      )}

      {/* Step 10: Study Session Modal */}
      <StudySessionModal
        isOpen={studySessionModalOpen}
        onClose={() => {
          setStudySessionModalOpen(false);
          setStudySessionPrefill(null);
        }}
        courses={courses}
        assessments={assessments}
        onSaveSession={handleCreateStudySession}
        isSaving={isSavingSession}
        prefillItem={studySessionPrefill}
      />

      {/* Phase 3A: Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Phase 3A: Workspace Modal */}
      <WorkspaceModal
        isOpen={workspaceModalOpen}
        onClose={() => setWorkspaceModalOpen(false)}
        onSave={handleCreateOrUpdateWorkspace}
        onDelete={handleDeleteWorkspace}
        editingWorkspace={editingWorkspace}
      />

      {/* Export Modal */}
      {exportModalOpen && (
        <div className="modal-overlay" onClick={() => setExportModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Export your study workspace</h2>
              <button className="modal-close" onClick={() => setExportModalOpen(false)}>
                ✕
              </button>
            </div>

            <p style={{ color: "var(--muted)", margin: "0 0 16px" }}>
              Sync deadlines with your personal calendar or backup your semester plan.
            </p>

            <div className="export-options-grid">
              <div className="export-option-card" onClick={handleExportICS}>
                <div className="export-option-info">
                  <strong>Calendar File (.ics) 📅</strong>
                  <span>Import official due dates & target preparation dates into Google Calendar, Apple Calendar, or Outlook.</span>
                </div>
                <button className="export-btn-action">Download .ics</button>
              </div>

              <div className="export-option-card" onClick={handleExportCSV}>
                <div className="export-option-info">
                  <strong>Spreadsheet (.csv) 📊</strong>
                  <span>Tabular export formatted for Excel, Google Sheets, or Notion database imports.</span>
                </div>
                <button className="export-btn-action">Download CSV</button>
              </div>

              <div className="export-option-card" onClick={handleExportJSON}>
                <div className="export-option-info">
                  <strong>Workspace Backup (.json) 💾</strong>
                  <span>Complete raw structured data with courses, items, target dates, and completion status.</span>
                </div>
                <button className="export-btn-action">Download JSON</button>
              </div>

              <div className="export-option-card" onClick={handlePrintPlan}>
                <div className="export-option-info">
                  <strong>Printable Semester Report 🖨</strong>
                  <span>Clean physical print layout for study binders and desk calendars.</span>
                </div>
                <button className="export-btn-action">Print report</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Workspace Confirmation Modal */}
      {resetModalOpen && (
        <div className="modal-overlay" onClick={() => setResetModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="reset-modal-content">
              <div className="reset-modal-icon">⚠️</div>
              <h3>Reset this workspace?</h3>
              <p>
                This will remove the current syllabus, target dates, completion states, and generated plan from this browser.
              </p>
              <div className="reset-modal-actions">
                <button className="btn-cancel" onClick={() => setResetModalOpen(false)}>
                  Cancel
                </button>
                <button className="btn-confirm-reset" onClick={handleResetWorkspace}>
                  Reset workspace
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
