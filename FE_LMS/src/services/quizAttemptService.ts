import http from "../utils/http";
import type { QuizResponse } from "./quizService";

export interface QuizAttempt {
  _id: string;
  quizId: string | QuizResponse;
  studentId?:
  | string
  | {
    _id: string;
    fullName?: string;
    fullname?: string;
    username?: string;
    email?: string;
  };
  student?: {
    _id: string;
    fullName?: string;
    fullname?: string;
    username?: string;
    email?: string;
  };
  status: "in_progress" | "submitted" | "abandoned";
  startTime: string;
  submittedAt?: string;
  startedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  durationSeconds?: number;
  answers?: QuizAnswer[];
  totalScore?: number;
  totalQuizScore?: number;
  scorePercentage?: number;
  score?: number;
}

export interface QuizAnswer {
  questionId: string;
  answer: number[]; // Array of 0s and 1s
  correct?: boolean;
  pointsEarned?: number;
  text?: string;
  options?: string[];
  type?: string;
  images?: Array<{ url: string; fromDB?: boolean }>;
  explanation?: string;
  points?: number;
}

export interface QuizAnswerPayload {
  questionId: string;
  answer: number[];
}

export interface EnrollQuizInput {
  quizId: string;
  hashPassword: string;
}

export interface SubmitQuizInput {
  quizAttemptId: string;
}

export interface SubmitQuizResponse {
  totalQuestions: number;
  totalScore: number;
  totalQuizScore: number;
  scorePercentage: number;
  failedQuestions: QuizAnswer[];
  passedQuestions: QuizAnswer[];
  answersSubmitted: QuizAnswer[];
}

export interface AutoSaveInput {
  quizAttemptId: string;
  questionId: string;
  answer: number[];
}

export interface AutoSaveResult {
  attempt: QuizAttempt;
  total: number;
  answeredTotal: number;
}

export const quizAttemptService = {
  /**
   * Enroll in a quiz (start quiz attempt)
   * POST /quiz-attempts/enroll
   */
  enrollQuiz: async (input: EnrollQuizInput): Promise<QuizAttempt> => {
    const response = await http.post<QuizAttempt>("/quiz-attempts/enroll", input);
    return response.data;
  },

  /**
   * Get quiz attempt details
   * GET /quiz-attempts/:quizAttemptId
   */
  getQuizAttempt: async (quizAttemptId: string): Promise<QuizAttempt> => {
    const response = await http.get<QuizAttempt>(`/quiz-attempts/${quizAttemptId}`);
    return response.data;
  },

  /**
   * Submit quiz attempt
   * POST /quiz-attempts/:quizAttemptId/submit
   */
  submitQuiz: async (input: SubmitQuizInput): Promise<SubmitQuizResponse> => {
    const response = await http.put<SubmitQuizResponse>(
      `/quiz-attempts/${input.quizAttemptId}/submit`,
      {}
    );
    return response.data;
  },

  /**
   * Auto save a single question
   * POST /quiz-attempts/:quizAttemptId/auto-save
   */
  autoSaveAnswer: async (input: AutoSaveInput): Promise<AutoSaveResult> => {
    const response = await http.put<{
      data: QuizAttempt;
      total: number;
      answeredTotal: number;
    }>(`/quiz-attempts/${input.quizAttemptId}/auto-save`, {
      answer: {
        questionId: input.questionId,
        answer: input.answer,
      },
    });

    return {
      attempt: response.data,
      total: response.total ?? 0,
      answeredTotal: response.answeredTotal ?? 0,
    };
  },

  /**
   * Ban a quiz attempt (teacher/admin action)
   * PUT /quiz-attempts/:quizAttemptId/ban
   */
  banQuizAttempt: async (quizAttemptId: string): Promise<QuizAttempt> => {
    const response = await http.put<QuizAttempt>(`/quiz-attempts/${quizAttemptId}/ban`, {});
    return response.data;
  },

  /**
   * Get all attempts for a quiz (teacher/admin view)
   * GET /quizzes/:quizId/quiz-attempts
   */
  getAttemptsByQuiz: async (quizId: string): Promise<QuizAttempt[]> => {
    // Add populate parameter to get student details
    const response = await http.get<{ data: QuizAttempt[] }>(`/quizzes/${quizId}/quiz-attempts?populate=studentId`);
    if (Array.isArray(response.data?.data)) {
      return response.data.data;
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  },

  /**
   * Get quiz attempts with filters and pagination
   * GET /quizzes/:quizId/attempts
   */
  getQuizAttemptsForGrading: async (
    quizId: string,
    params?: import("../types/quizAttemptGrading").GetQuizAttemptsParams
  ): Promise<import("../types/quizAttemptGrading").QuizAttemptsResponse> => {
    const response = await http.get<import("../types/quizAttemptGrading").QuizAttemptsResponse>(
      `/quizzes/${quizId}/quiz-attempts`,
      { params }
    );
    return response;
  },

  /**
   * Get attempt details for grading
   * GET /quiz-attempts/:attemptId
   */
  getAttemptDetailsForGrading: async (
    attemptId: string
  ): Promise<import("../types/quizAttemptGrading").AttemptDetailsResponse> => {
    const response = await http.get<import("../types/quizAttemptGrading").AttemptDetailsResponse>(
      `/quiz-attempts/${attemptId}`
    );
    return response;
  },

  /**
   * Regrade/Recalculate scores for an attempt
   * PUT /quiz-attempts/:attemptId/re-grade
   */
  regradeAttempt: async (attemptId: string): Promise<QuizAttempt> => {
    const response = await http.put<QuizAttempt>(`/quiz-attempts/${attemptId}/re-grade`, {});
    return response.data;
  },

  /**
   * Submit regrade for an attempt
   * POST /quiz-attempts/:attemptId/re-grade
   */
  submitRegrade: async (
    attemptId: string,
    payload: import("../types/quizAttemptGrading").RegradePayload
  ): Promise<import("../types/quizAttemptGrading").RegradeResponse> => {
    const response = await http.post<import("../types/quizAttemptGrading").RegradeResponse>(
      `/quiz-attempts/${attemptId}/re-grade`,
      payload
    );
    return response;
  },
};

