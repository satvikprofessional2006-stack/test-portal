// Central API client — all requests go through here.
// Automatically attaches JWT token from localStorage.
// On 401, redirects to login.

import axios, { AxiosError, AxiosResponse } from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// Attach Bearer token from localStorage on every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// On 401 — clear tokens and redirect to login
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login/", { email, password }),
  logout: (refresh: string) =>
    api.post("/auth/logout/", { refresh }),
  me: () => api.get("/auth/me/"),
  refresh: (refresh: string) =>
    api.post("/auth/refresh/", { refresh }),
};

// ─── Exams ────────────────────────────────────────────────────────────────────
export const examsApi = {
  // Student
  myExams: () => api.get("/exams/my/"),
  examDetail: (id: number) => api.get(`/exams/${id}/detail/`),

  // Admin
  list: () => api.get("/exams/"),
  create: (data: object) => api.post("/exams/", data),
  update: (id: number, data: object) => api.patch(`/exams/${id}/`, data),
  delete: (id: number) => api.delete(`/exams/${id}/`),

  // Questions
  questions: (examId: number) => api.get(`/exams/${examId}/questions/`),
  createQuestion: (examId: number, data: object) => api.post(`/exams/${examId}/questions/`, data),
  updateQuestion: (examId: number, qId: number, data: object) =>
    api.patch(`/exams/${examId}/questions/${qId}/`, data),
  deleteQuestion: (examId: number, qId: number) =>
    api.delete(`/exams/${examId}/questions/${qId}/`),

  // Test cases
  testCases: (examId: number, qId: number) =>
    api.get(`/exams/${examId}/questions/${qId}/testcases/`),
  createTestCase: (examId: number, qId: number, data: object) =>
    api.post(`/exams/${examId}/questions/${qId}/testcases/`, data),
  deleteTestCase: (examId: number, qId: number, tcId: number) =>
    api.delete(`/exams/${examId}/questions/${qId}/testcases/${tcId}/`),

  // Enrollment & results
  enrollments: (examId: number) => api.get(`/exams/${examId}/enrollments/`),
  enrollStudents: (examId: number, student_ids: number[]) =>
    api.post(`/exams/${examId}/enroll/`, { student_ids }),
  results: (examId: number) => api.get(`/exams/${examId}/results/`),
};

// ─── Sessions ─────────────────────────────────────────────────────────────────
export const sessionsApi = {
  enter: (examId: number) => api.post(`/sessions/enter/${examId}/`),
  timer: () => api.get("/sessions/timer/"),
  heartbeat: (data?: { current_question_order?: number }) =>
    api.post("/sessions/heartbeat/", data || {}),
  autosave: (data: { question_id: number; language: string; code: string; is_primary_language?: boolean }) =>
    api.post("/sessions/autosave/", data),
  drafts: (questionId: number) => api.get(`/sessions/drafts/${questionId}/`),
  complete: () => api.post("/sessions/complete/"),

  // Admin
  activeSessions: () => api.get("/sessions/active/"),
  terminate: (sessionId: number) => api.post(`/sessions/${sessionId}/terminate/`),
};

// ─── Submissions ──────────────────────────────────────────────────────────────
export const submissionsApi = {
  run: (data: { question_id: number; language: string; code: string; stdin: string }) =>
    api.post("/submissions/run/", data),
  runStatus: (runId: number) => api.get(`/submissions/run/${runId}/`),
  submit: (data: { question_id: number; language: string; code: string }) =>
    api.post("/submissions/submit/", data),
  status: (submissionId: number) => api.get(`/submissions/${submissionId}/`),
  mySubmissions: () => api.get("/submissions/my/"),

  // Admin
  adminList: (params?: { exam_id?: number; student_id?: number; verdict?: string }) =>
    api.get("/submissions/", { params }),
};

// ─── Security ─────────────────────────────────────────────────────────────────
export const securityApi = {
  logEvent: (event_type: string, payload?: object) =>
    api.post("/security/events/", { event_type, payload: payload || {} }),
  adminEvents: (params?: { exam_id?: number; session_id?: number; severity?: string }) =>
    api.get("/security/events/admin/", { params }),
};

// ─── Admin: Users ─────────────────────────────────────────────────────────────
export const usersApi = {
  list: (params?: { role?: string; search?: string }) =>
    api.get("/auth/users/", { params }),
  create: (data: object) => api.post("/auth/users/", data),
  importCSV: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/auth/users/import/", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};
