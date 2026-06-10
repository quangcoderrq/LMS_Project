//do business like API call, auth service, ...
import http, { httpClient } from "../utils/http";

import { type LoginRequest, type RegisterRequest, type AuthResponse, type RefreshAuthResponse, type User } from "../types/auth";
export * from "./mock";
export * from "./courseService";
export * from "./enrollmentService";
export * from "./feedbackService";
export * from "./quizQuestionService";
export * from "./subjectService";
export * from "./quizService";
export * from "./quizAttemptService";
export * from "./specialistService";
export * from "./majorService";
export * from "./userService";
export * from "./semesterService";
export * from "./attendanceService";
export * from "./forumService";
export * from "./sessionService";
export * from "./scheduleService";
export * from "./assignmentService";
export * from "./submissionService";
export * from "./announcementService";
export * from "./notificationService";
export { webRTCService } from "./webrtcService";

// storage keys
const USER_STORAGE_KEY = 'lms:user';

// The current user shape from /users/me (relaxed to accept backend changes)
export type CurrentUser = {
  _id: string;
  username: string;
  email: string;
  role: string;
  verified?: boolean;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
  // allow additional fields without failing types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export const saveCurrentUserFromApi = async (): Promise<CurrentUser> => {
  console.log("[auth] saveCurrentUserFromApi called");
  // /users/me returns raw user (not wrapped in ApiResponse)
  const response = await httpClient.get<CurrentUser>("/users/me", { withCredentials: true });
  const user = response.data;
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    console.log("[auth] /users/me response saved to storage:", user);
  } catch (e) {
    console.warn("[auth] Failed to save current user to storage", e);
  }
  return user;
};

export const saveUserToLocal = (user: CurrentUser): void => {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn("[auth] Failed to save user to storage", e);
  }
};

export const clearStoredUser = (): void => {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
    console.log("[auth] cleared stored user");
  } catch (e) {
    console.warn("[auth] Failed to clear stored user", e);
  }
};
export const authService = {
  login: async (data: LoginRequest): Promise<User> => {
    const response = await http.post<User>("/auth/login", data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await http.post<AuthResponse>("/auth/register", data);
    return response.data;
  },

  logout: async (): Promise<AuthResponse> => {
    const response = await http.get<AuthResponse>("/auth/logout");
    // Clear local storage
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userData');
    clearStoredUser();
    console.log("[auth] logout completed and storage cleared");
    return response.data;
  },

  refreshToken: async (): Promise<RefreshAuthResponse> => {
    const response = await http.get<RefreshAuthResponse>("/auth/refresh");
    return response;
  },

  sendPasswordReset: async (email: string): Promise<AuthResponse> => {
    const response = await http.post<AuthResponse>("/auth/password/forgot", { email });
    return response.data;
  },

  resetPassword: async (verificationCode: string, password: string): Promise<AuthResponse> => {
    const response = await http.post<AuthResponse>("/auth/password/reset", {
      verificationCode,
      password,
    });
    return response.data;
  },

  verifyEmail: async (code: string): Promise<AuthResponse> => {
    const response = await http.get<AuthResponse>(`/auth/email/verify/${code}`);
    return response.data;
  },

  // Get current user info (requires authentication)
  getCurrentUser: async (): Promise<User> => {
    const response = await httpClient.get<User>("/users/me", { withCredentials: true });
    return response.data;
  },

  // Google OAuth login (receives authorization code from frontend)
  googleLogin: async (code: string): Promise<User> => {
    const response = await http.post<User>("/auth/google", { code });
    return response.data;
  },
};
