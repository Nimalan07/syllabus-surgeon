const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000";

export function getAuthToken() {
  return (
    window.localStorage.getItem("access_token") ||
    window.localStorage.getItem("syllabus-surgeon-auth-token") ||
    ""
  );
}

export function saveAuthToken(token) {
  window.localStorage.setItem("access_token", token);
  window.localStorage.setItem("syllabus-surgeon-auth-token", token);
}

export function clearAuthToken() {
  window.localStorage.removeItem("access_token");
  window.localStorage.removeItem("syllabus-surgeon-auth-token");
  window.localStorage.removeItem("syllabus-surgeon-user");
}

export async function request(path, options = {}) {
  const token = getAuthToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));

    throw new Error(
      errorBody.detail || `Request failed with status ${response.status}`
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function registerUser(payload) {
  const result = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const token = result.access_token || result.token;
  if (token) {
    saveAuthToken(token);
  }

  return result;
}

export async function loginUser(payload) {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const token = result.access_token || result.token;
  if (token) {
    saveAuthToken(token);
  }

  return result;
}

export async function getCurrentUser() {
  return request("/api/auth/me");
}

export async function checkBackendHealth() {
  return request("/health");
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
