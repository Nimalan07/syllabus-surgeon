const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000";

function getAuthToken() {
  try {
    return localStorage.getItem("syllabus-surgeon-auth-token") || "";
  } catch {
    return "";
  }
}

async function request(path, options = {}) {
  const token = options.token !== undefined ? options.token : getAuthToken();
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
    let message = "Request failed";

    try {
      const error = await response.json();
      message = error.detail || message;
    } catch {
      // Keep the default error message.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  // Base URL access
  baseUrl: API_BASE_URL,

  // Auth APIs
  login(email, password) {
    return request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  register(email, password, displayName) {
    return request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        full_name: displayName,
        display_name: displayName,
      }),
    });
  },

  getMe(token) {
    return request("/api/auth/me", { token });
  },

  // Workspaces APIs
  listWorkspaces(token) {
    return request("/api/workspaces", { token });
  },

  getWorkspace(workspaceId, token) {
    return request(`/api/workspaces/${workspaceId}`, { token });
  },

  createWorkspace(data, token) {
    return request("/api/workspaces", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    });
  },

  updateWorkspace(workspaceId, data, token) {
    return request(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      token,
    });
  },

  deleteWorkspace(workspaceId, token) {
    return request(`/api/workspaces/${workspaceId}`, {
      method: "DELETE",
      token,
    });
  },

  // Courses APIs
  getCourses(workspaceId, token) {
    return request(`/api/workspaces/${workspaceId}/courses`, { token });
  },

  createCourse(workspaceId, data, token) {
    return request(`/api/workspaces/${workspaceId}/courses`, {
      method: "POST",
      body: JSON.stringify(data),
      token,
    });
  },

  updateCourse(courseId, data, token) {
    return request(`/api/courses/${courseId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      token,
    });
  },

  deleteCourse(courseId, token) {
    return request(`/api/courses/${courseId}`, {
      method: "DELETE",
      token,
    });
  },

  // Assessments APIs
  getAssessments(courseId, token) {
    return request(`/api/courses/${courseId}/assessments`, { token });
  },

  getWorkspaceAssessments(workspaceId, token) {
    return request(`/api/workspaces/${workspaceId}/assessments`, { token });
  },

  createAssessment(courseId, data, token) {
    return request(`/api/courses/${courseId}/assessments`, {
      method: "POST",
      body: JSON.stringify(data),
      token,
    });
  },

  updateAssessment(assessmentId, data, token) {
    return request(`/api/assessments/${assessmentId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      token,
    });
  },

  toggleAssessmentComplete(assessmentId, token) {
    return request(`/api/assessments/${assessmentId}/complete`, {
      method: "POST",
      token,
    });
  },

  deleteAssessment(assessmentId, token) {
    return request(`/api/assessments/${assessmentId}`, {
      method: "DELETE",
      token,
    });
  },

  // Study Sessions APIs
  getStudySessions(workspaceId, token) {
    return request(`/api/workspaces/${workspaceId}/study-sessions`, { token });
  },

  createStudySession(workspaceId, data, token) {
    return request(`/api/workspaces/${workspaceId}/study-sessions`, {
      method: "POST",
      body: JSON.stringify(data),
      token,
    });
  },

  updateStudySession(sessionId, data, token) {
    return request(`/api/study-sessions/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      token,
    });
  },

  deleteStudySession(sessionId, token) {
    return request(`/api/study-sessions/${sessionId}`, {
      method: "DELETE",
      token,
    });
  },
};
