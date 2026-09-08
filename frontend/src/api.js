const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const token = localStorage.getItem("syllabus-surgeon-auth-token") || "";
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const errorData = await response.json();
      message = errorData.detail || message;
    } catch {
      // Keep the default error message when the response is not JSON.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function getWorkspaces() {
  return request("/api/workspaces");
}

export function createWorkspace(payload) {
  return request("/api/workspaces", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getWorkspace(workspaceId) {
  return request(`/api/workspaces/${workspaceId}`);
}

export function updateWorkspace(workspaceId, payload) {
  return request(`/api/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteWorkspace(workspaceId) {
  return request(`/api/workspaces/${workspaceId}`, {
    method: "DELETE",
  });
}

export function getCourses(workspaceId) {
  return request(`/api/workspaces/${workspaceId}/courses`);
}

export function createCourse(workspaceId, payload) {
  return request(`/api/workspaces/${workspaceId}/courses`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCourse(courseId) {
  return request(`/api/courses/${courseId}`);
}

export function updateCourse(courseId, payload) {
  return request(`/api/courses/${courseId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteCourse(courseId) {
  return request(`/api/courses/${courseId}`, {
    method: "DELETE",
  });
}

export function getAssessments(courseId) {
  return request(`/api/courses/${courseId}/assessments`);
}

export function createAssessment(courseId, payload) {
  return request(`/api/courses/${courseId}/assessments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getAssessment(assessmentId) {
  return request(`/api/assessments/${assessmentId}`);
}

export function updateAssessment(assessmentId, payload) {
  return request(`/api/assessments/${assessmentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteAssessment(assessmentId) {
  return request(`/api/assessments/${assessmentId}`, {
    method: "DELETE",
  });
}

export function getStudySessions(courseId) {
  return request(`/api/courses/${courseId}/study-sessions`);
}

export function createStudySession(payload) {
  return request("/api/study-sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getStudySession(sessionId) {
  return request(`/api/study-sessions/${sessionId}`);
}

export function updateStudySession(sessionId, payload) {
  return request(`/api/study-sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteStudySession(sessionId) {
  return request(`/api/study-sessions/${sessionId}`, {
    method: "DELETE",
  });
}
