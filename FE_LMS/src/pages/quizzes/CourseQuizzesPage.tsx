import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { quizService, courseService, quizAttemptService } from "../../services";
import type { QuizResponse } from "../../services/quizService";
import type { QuizAttempt } from "../../services/quizAttemptService";
import type { Course } from "../../types/course";
import {
  Clock,
  Calendar,
  CheckCircle,
  ArrowLeft,
  Trash2,
  Edit2,
  X,
  ShieldOff,
  Loader2,
  BarChart3,
  ClipboardList,
  MoreVertical,
  Eye,
  EyeOff,
  Key,
  Copy,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import QuizCoursePage from "./QuizCoursePage";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import { QuizPagination } from "../../components/quiz/QuizPagination";

interface EditQuizForm {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  isPublished: boolean;
}

export default function CourseQuizzesPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const role = (user?.role as "admin" | "teacher" | "student") || "teacher";
  const isStudent = role === "student";
  const isQuestionBankRoute = location.pathname.startsWith("/questionbank");
  const QUIZZES_PER_PAGE = 5;
  const wrapPaginationValue = (value: number) => `"${value}"`;
  const QUIZZES_PER_PAGE_PARAM = wrapPaginationValue(QUIZZES_PER_PAGE);

  const [course, setCourse] = useState<Course | null>(null);
  const [quizzes, setQuizzes] = useState<QuizResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);
  const [isSubjectId, setIsSubjectId] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<QuizResponse | null>(null);
  const [editForm, setEditForm] = useState<EditQuizForm | null>(null);
  const [updatingQuizId, setUpdatingQuizId] = useState<string | null>(null);
  const [attemptModal, setAttemptModal] = useState<{
    quiz: QuizResponse | null;
    attempts: QuizAttempt[];
    loading: boolean;
    error: string | null;
  }>({ quiz: null, attempts: [], loading: false, error: null });
  const [statisticsModal, setStatisticsModal] = useState<{
    quiz: QuizResponse | null;
    statistics: {
      totalStudents: number;
      submittedCount: number;
      averageScore: number;
      medianScore: number;
      minMax: { min: number; max: number };
      standardDeviationScore: number;
      scoreDistribution: Array<{
        min: number;
        max: number;
        range: string;
        count: number;
        percentage: string;
      }>;
      students: Array<{
        fullname: string;
        email: string;
        score: number;
        durationSeconds: number;
        rank: number;
      }>;
    } | null;
    loading: boolean;
    error: string | null;
  }>({ quiz: null, statistics: null, loading: false, error: null });
  const [banProcessingId, setBanProcessingId] = useState<string | null>(null);
  const [quizzesPage, setQuizzesPage] = useState(1);
  const [quizzesPaginationInfo, setQuizzesPaginationInfo] = useState({
    totalItems: 0,
    currentPage: 1,
    limit: QUIZZES_PER_PAGE,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);
  const [passwordVisibility, setPasswordVisibility] = useState<Record<string, boolean>>({});

  const getSwalBaseOptions = () => ({
    width: 360,
    background: darkMode ? "rgba(15,23,42,0.95)" : "#ffffff",
    color: darkMode ? "#e2e8f0" : "#1f2937",
    confirmButtonColor: "#6366f1",
  });

  const showSwalConfirm = async (message: string): Promise<boolean> => {
    const Swal = (await import("sweetalert2")).default;
    const base = getSwalBaseOptions();
    const result = await Swal.fire({
      ...base,
      title: "Confirm",
      text: message,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: darkMode ? "#334155" : "#e2e8f0",
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      reverseButtons: true,
      heightAuto: false,
    });
    return result.isConfirmed;
  };

  const showSwalError = async (message: string) => {
    const Swal = (await import("sweetalert2")).default;
    const base = getSwalBaseOptions();
    await Swal.fire({
      ...base,
      icon: "error",
      title: "Error",
      text: message,
      confirmButtonText: "Close",
      heightAuto: false,
    });
  };

  const showSwalSuccess = async (message: string) => {
    const Swal = (await import("sweetalert2")).default;
    const base = getSwalBaseOptions();
    await Swal.fire({
      ...base,
      icon: "success",
      title: "Success",
      text: message,
      timer: 1500,
      showConfirmButton: false,
      heightAuto: false,
    });
  };

  const filterActiveQuizzes = useCallback(
    (data?: QuizResponse[]) => (data || []).filter((quiz) => !quiz.deletedAt),
    []
  );

  const activeQuizzesRef = useRef<QuizResponse[]>([]);
  const lastFetchedBackendPageRef = useRef(0);
  const backendHasMoreRef = useRef(true);

  const resetPaginationState = useCallback(() => {
    activeQuizzesRef.current = [];
    lastFetchedBackendPageRef.current = 0;
    backendHasMoreRef.current = true;
  }, []);

  const fetchBackendPage = useCallback(
    async (pageNumber: number) => {
      if (!courseId) return null;
      const params: Record<string, any> = {
        page: wrapPaginationValue(pageNumber),
        limit: QUIZZES_PER_PAGE_PARAM,
      };
      // Students only see published quizzes
      if (isStudent) {
        params.isPublished = true;
      }
      const result = await quizService.getQuizzesByCourseId(courseId, params);
      return {
        active: filterActiveQuizzes(result.data),
        hasNext: Boolean(result.pagination?.hasNextPage ?? false),
      };
    },
    [courseId, filterActiveQuizzes, isStudent, QUIZZES_PER_PAGE_PARAM]
  );

  const ensureActiveQuizzes = useCallback(
    async (pageNumber: number) => {
      if (!courseId) return;
      const targetCount = pageNumber * QUIZZES_PER_PAGE;
      let cache = [...activeQuizzesRef.current];
      let backendPage = lastFetchedBackendPageRef.current;
      let hasMore = backendHasMoreRef.current;

      while (cache.length < targetCount && (hasMore || backendPage === 0)) {
        const nextPage = backendPage + 1;
        const response = await fetchBackendPage(nextPage);
        if (!response) break;
        cache = [...cache, ...response.active];
        backendPage = nextPage;
        hasMore = response.hasNext;
        activeQuizzesRef.current = cache;
        lastFetchedBackendPageRef.current = backendPage;
        backendHasMoreRef.current = hasMore;
        if (!hasMore) break;
      }

      const startIndex = Math.max(0, (pageNumber - 1) * QUIZZES_PER_PAGE);
      const displayed = cache.slice(startIndex, startIndex + QUIZZES_PER_PAGE);
      setQuizzes(displayed);

      const hasPrev = pageNumber > 1;
      const hasNext = cache.length > startIndex + displayed.length || hasMore;
      const totalPages = hasMore
        ? Math.max(pageNumber + 1, Math.ceil(cache.length / QUIZZES_PER_PAGE))
        : Math.max(1, Math.ceil(cache.length / QUIZZES_PER_PAGE));

      setQuizzesPaginationInfo({
        totalItems: cache.length,
        currentPage: pageNumber,
        limit: QUIZZES_PER_PAGE,
        totalPages,
        hasNext,
        hasPrev,
      });
    },
    [courseId, fetchBackendPage]
  );

  const goToPage = useCallback(
    async (pageNumber: number, options?: { silent?: boolean }) => {
      if (!courseId) return;
      if (!options?.silent) {
        setLoading(true);
      }
      setError(null);
      try {
        await ensureActiveQuizzes(pageNumber);
      } catch (err) {
        console.error("Failed to load quizzes:", err);
        const message =
          typeof err === "object" && err !== null && "message" in err
            ? String((err as { message?: string }).message)
            : "Failed to load quizzes";
        setError(message);
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [courseId, ensureActiveQuizzes]
  );

  useEffect(() => {
    if (!courseId) {
      setError("Course ID is required");
      setLoading(false);
      return;
    }

    if (isQuestionBankRoute) {
      // Teacher/Admin accessing question bank subjects: skip course fetch and go straight to questions
      setIsSubjectId(true);
      setLoading(false);
      setCourse(null);
      setError(null);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // First, try to fetch as a course
        try {
          console.log("Fetching course with ID:", courseId);
          const courseData = await courseService.getCourseById(courseId);
          console.log("Course found:", courseData);
          if (cancelled) return;
          setCourse(courseData);
          setIsSubjectId(false);
          resetPaginationState();
          setQuizzesPage(1);
          await goToPage(1, { silent: true });
        } catch (courseErr) {
          // If course not found (404), treat it as a subjectId and render QuizCoursePage
          // http.ts throws error with status field, not response.status
          const courseError = courseErr as {
            status?: number;
            response?: { status?: number; data?: { message?: string } };
            message?: string;
          };
          const status = courseError?.status || courseError?.response?.status;
          const errorMessage =
            courseError?.message || courseError?.response?.data?.message || "";
          const isNotFound =
            status === 404 ||
            errorMessage.toLowerCase().includes("not found") ||
            errorMessage.toLowerCase().includes("course not found");

          if (isNotFound) {
            console.log("Course not found, treating as subjectId:", courseId);
            setIsSubjectId(true);
            setError(null); // Clear error since we'll render QuizCoursePage
            setLoading(false); // Stop loading since we're switching to QuizCoursePage
            return; // Exit early, don't throw error
          } else {
            // Some other error occurred (network, server error, etc.)
            throw courseErr;
          }
        }
      } catch (err) {
        console.error("Failed to fetch course quizzes:", err);
        const message =
          typeof err === "object" && err !== null && "message" in err
            ? String((err as { message?: string }).message)
            : "Failed to load quizzes";
        setError(message);
        setIsSubjectId(false);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [courseId, goToPage, isQuestionBankRoute, resetPaginationState]);

  const getQuizStatus = (quiz: QuizResponse) => {
    const now = new Date();
    const startTime = new Date(quiz.startTime);
    const endTime = new Date(quiz.endTime);

    if (now < startTime) {
      return { label: "Upcoming", color: "#3b82f6" };
    } else if (now >= startTime && now <= endTime) {
      return { label: "Active", color: "#10b981" };
    } else {
      return { label: "Ended", color: "#6b7280" };
    }
  };

  const canTakeQuiz = (quiz: QuizResponse) => {
    const now = new Date();
    const startTime = new Date(quiz.startTime);
    const endTime = new Date(quiz.endTime);
    return Boolean(quiz.isPublished) && now >= startTime && now <= endTime;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Convert ISO string to datetime-local format
  const isoToDatetimeLocal = (isoString: string): string => {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Convert datetime-local to ISO UTC string
  const datetimeLocalToISO = (datetimeLocal: string): string => {
    if (!datetimeLocal) return "";
    const localDate = new Date(datetimeLocal);
    return localDate.toISOString();
  };

  const getStudentLabel = (attempt: QuizAttempt) => {
    // Backend can return either 'student' or 'studentId' field
    const student = attempt.student || attempt.studentId;
    if (!student) return "Unknown student";
    if (typeof student === "string") return student;
    // Try fullname first (lowercase), then fullName, then others
    return (
      student.fullname ||
      student.fullName ||
      student.username ||
      student.email ||
      student._id ||
      "Unknown student"
    );
  };

  const handleOpenEditQuiz = (quiz: QuizResponse) => {
    setEditingQuiz(quiz);
    setEditForm({
      title: quiz.title,
      description: quiz.description || "",
      startTime: isoToDatetimeLocal(quiz.startTime),
      endTime: isoToDatetimeLocal(quiz.endTime),
      isPublished: quiz.isPublished ?? false,
    });
  };

  const handleCloseEdit = () => {
    setEditingQuiz(null);
    setEditForm(null);
  };

  const handleOpenAttemptModal = async (quiz: QuizResponse) => {
    setAttemptModal({
      quiz,
      attempts: [],
      loading: true,
      error: null,
    });
    try {
      const data = await quizAttemptService.getAttemptsByQuiz(quiz._id);
      setAttemptModal((prev) => ({
        ...prev,
        attempts: data,
        loading: false,
      }));
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: string }).message)
          : "Failed to load attempts";
      setAttemptModal((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
    }
  };

  const handleCloseAttemptModal = () => {
    setAttemptModal({
      quiz: null,
      attempts: [],
      loading: false,
      error: null,
    });
  };

  const handleOpenStatisticsModal = async (quiz: QuizResponse) => {
    setStatisticsModal({
      quiz,
      statistics: null,
      loading: true,
      error: null,
    });
    try {
      const data = await quizService.getQuizStatistics(quiz._id);
      setStatisticsModal((prev) => ({
        ...prev,
        statistics: data,
        loading: false,
      }));
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: string }).message)
          : "Failed to load statistics";
      setStatisticsModal((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
    }
  };

  const handleCloseStatisticsModal = () => {
    setStatisticsModal({
      quiz: null,
      statistics: null,
      loading: false,
      error: null,
    });
  };

  const handleBanAttempt = async (attempt: QuizAttempt) => {
    const studentLabel = getStudentLabel(attempt);
    const Swal = (await import("sweetalert2")).default;
    const base = getSwalBaseOptions();
    const confirmed = await Swal.fire({
      ...base,
      title: "Ban attempt?",
      text: `The student "${studentLabel}" will be removed immediately.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: darkMode ? "#334155" : "#e2e8f0",
      confirmButtonText: "Ban now",
      cancelButtonText: "Cancel",
      reverseButtons: true,
      heightAuto: false,
    });
    if (!confirmed.isConfirmed) return;

    try {
      setBanProcessingId(attempt._id);
      const updated = await quizAttemptService.banQuizAttempt(attempt._id);
      setAttemptModal((prev) => ({
        ...prev,
        attempts: prev.attempts.map((a) =>
          a._id === updated._id ? updated : a
        ),
      }));
      await showSwalSuccess("Attempt banned successfully");
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to ban attempt";
      await showSwalError(message);
    } finally {
      setBanProcessingId(null);
    }
  };

  const handleUpdateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuiz || !editForm) return;

    try {
      setUpdatingQuizId(editingQuiz._id);
      await quizService.updateQuiz(editingQuiz._id, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        startTime: datetimeLocalToISO(editForm.startTime),
        endTime: datetimeLocalToISO(editForm.endTime),
        isPublished: editForm.isPublished,
      });

      // Force complete cache reset to ensure updated quiz appears
      resetPaginationState();
      // Reset to page 1 to ensure fresh data
      setQuizzesPage(1);
      await goToPage(1);

      handleCloseEdit();
      await showSwalSuccess("Quiz updated successfully");
    } catch (err: any) {
      console.error("Failed to update quiz:", err);
      const message = err?.response?.data?.message || err?.message || "Failed to update quiz";
      await showSwalError(message);
    } finally {
      setUpdatingQuizId(null);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    const confirmed = await showSwalConfirm(
      "Are you sure you want to delete this quiz? This action cannot be undone."
    );
    if (!confirmed) {
      return;
    }

    try {
      setDeletingQuizId(quizId);
      await quizService.deleteQuiz(quizId);
      resetPaginationState();
      const nextPage =
        quizzesPage > 1 && quizzes.length === 1 ? quizzesPage - 1 : quizzesPage;
      setQuizzesPage(nextPage);
      await goToPage(nextPage);
      await showSwalSuccess("Quiz deleted successfully");
    } catch (err: any) {
      console.error("Failed to delete quiz:", err);
      const message = err?.response?.data?.message || err?.message || "Failed to delete quiz";
      await showSwalError(message);
    } finally {
      setDeletingQuizId(null);
    }
  };

  const handlePaginationSelect = (page?: number) => {
    if (!page || page === quizzesPage) {
      return;
    }
    setQuizzesPage(page);
    goToPage(page);
  };

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleToggleSidebar = () => {
    setMobileSidebarOpen((prev) => !prev);
  };

  const handleCloseSidebar = () => {
    setMobileSidebarOpen(false);
  };

  // If it's a subjectId, render QuizCoursePage instead
  if (isSubjectId) {
    return <QuizCoursePage />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={role} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onToggleSidebar={handleToggleSidebar} />
        <Sidebar
          variant="mobile"
          role={role}
          isOpen={mobileSidebarOpen}
          onClose={handleCloseSidebar}
        />
        <main
          className="flex-1 overflow-y-auto p-6 pt-12"
          style={{
            backgroundColor: "var(--page-bg)",
            color: "var(--page-text)",
          }}
        >
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <div className="flex flex-wrap items-center  p-6 pt-12">
                <button
                  onClick={() => navigate(-1)}
                  className="flex items-center gap-2 text-sm hover:underline"
                  style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              </div>
              <h1
                className="text-2xl font-bold mb-2"
                style={{ color: "var(--heading-text)" }}
              >
                {course ? course.title : "Loading..."}
              </h1>
              {course?.code && (
                <p className="text-sm" style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}>
                  {course.code}
                </p>
              )}
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <p style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}>Loading quizzes...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div
                className="rounded-lg p-4 mb-6"
                style={{
                  backgroundColor: "var(--error-bg)",
                  color: "var(--error-text)",
                }}
              >
                {error}
              </div>
            )}

            {/* Quizzes List */}
            {!loading && !error && (
              <>
                {quizzes.length === 0 ? (
                  <div
                    className="rounded-lg p-8 text-center"
                    style={{
                      backgroundColor: "var(--card-surface)",
                      border: "1px solid var(--card-border)",
                    }}
                  >
                    <p style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}>
                      No quizzes available for this course.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {quizzes.map((quiz) => {
                      const status = getQuizStatus(quiz);
                      return (
                        <div
                          key={quiz._id}
                          className="relative rounded-lg shadow-md overflow-hidden transition-all duration-200 hover:shadow-lg cursor-pointer"
                          style={{
                            backgroundColor: "var(--card-surface)",
                            border: `1px solid var(--card-border)`,
                          }}
                          onClick={() => {
                            if (isStudent) {
                              navigate(`/quizz/${courseId}/quiz/${quiz._id}`, {
                                state: { quiz },
                              });
                            } else {
                              navigate(`/questionbank/questions/${quiz._id}`);
                            }
                          }}
                        >
                          {/* Action menu - top right */}
                          {!isStudent && (
                            <div
                              className="absolute top-3 right-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  setActionMenuOpenId((prev) =>
                                    prev === quiz._id ? null : quiz._id
                                  );
                                }}
                                className="p-2 rounded hover:bg-gray-100 transition-colors"
                                style={{
                                  color: darkMode ? "#4b5563" : "#4b5563",
                                }}
                                title="More actions"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {actionMenuOpenId === quiz._id && (
                                <div
                                  className="absolute right-full top-0 mr-2 w-44 rounded-lg shadow-lg border z-20"
                                  style={{
                                    backgroundColor: darkMode
                                      ? "#020617"
                                      : "#ffffff",
                                    borderColor: darkMode
                                      ? "rgba(148,163,184,0.3)"
                                      : "rgba(226,232,240,0.9)",
                                    color: darkMode ? "#e5e7eb" : "#0f172a",
                                  }}
                                >
                                  <button
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-green-50"
                                    style={{
                                      color: "#10b981",
                                      backgroundColor: darkMode
                                        ? "transparent"
                                        : undefined,
                                    }}
                                    onClick={() => {
                                      handleOpenStatisticsModal(quiz);
                                      setActionMenuOpenId(null);
                                    }}
                                  >
                                    <BarChart3 className="w-4 h-4" />
                                    <span>View statistics</span>
                                  </button>
                                  <button
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-orange-50"
                                    style={{
                                      color: "#f97316",
                                      backgroundColor: darkMode
                                        ? "transparent"
                                        : undefined,
                                    }}
                                    onClick={() => {
                                      navigate(`/quizzes/${quiz._id}/attempts`);
                                      setActionMenuOpenId(null);
                                    }}
                                  >
                                    <ClipboardList className="w-4 h-4" />
                                    <span>View attempts</span>
                                  </button>
                                  <button
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50"
                                    style={{
                                      color: "#3b82f6",
                                      backgroundColor: darkMode
                                        ? "transparent"
                                        : undefined,
                                    }}
                                    onClick={() => {
                                      handleOpenEditQuiz(quiz);
                                      setActionMenuOpenId(null);
                                    }}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    <span>Edit quiz</span>
                                  </button>
                                  <button
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-red-50 disabled:opacity-50"
                                    style={{
                                      color: "#ef4444",
                                      backgroundColor: darkMode
                                        ? "transparent"
                                        : undefined,
                                    }}
                                    disabled={deletingQuizId === quiz._id}
                                    onClick={async () => {
                                      setActionMenuOpenId(null);
                                      handleDeleteQuiz(quiz._id);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Delete quiz</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="p-6">
                            {/* Quiz Title */}
                            <h3
                              className="text-xl font-semibold mb-2"
                              style={{ color: "var(--heading-text)" }}
                            >
                              {quiz.title}
                            </h3>

                            {/* Quiz Description */}
                            {quiz.description && (
                              <p
                                className="text-sm mb-4 line-clamp-2"
                                style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                              >
                                {quiz.description}
                              </p>
                            )}

                            {/* Quiz Details */}
                            <div className="space-y-2 mb-4">
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar
                                  className="w-4 h-4"
                                  style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                                />
                                <span style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}>
                                  Start: {formatDate(quiz.startTime)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Clock
                                  className="w-4 h-4"
                                  style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                                />
                                <span style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}>
                                  End: {formatDate(quiz.endTime)}
                                </span>
                              </div>

                              {/* Quiz Password - Only for Admin/Teacher */}
                              {!isStudent && quiz.hashPassword && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Key
                                    className="w-4 h-4"
                                    style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                                  />
                                  <span style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}>
                                    Password:
                                  </span>
                                  <span
                                    className="font-mono text-xs px-2 py-1 rounded"
                                    style={{
                                      backgroundColor: "var(--card-row-bg)",
                                      color: "var(--heading-text)",
                                    }}
                                  >
                                    {passwordVisibility[quiz._id] ? quiz.hashPassword : "••••••••"}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPasswordVisibility(prev => ({
                                        ...prev,
                                        [quiz._id]: !prev[quiz._id]
                                      }));
                                    }}
                                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    title={passwordVisibility[quiz._id] ? "Hide password" : "Show password"}
                                  >
                                    {passwordVisibility[quiz._id] ? (
                                      <EyeOff className="w-4 h-4" style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }} />
                                    ) : (
                                      <Eye className="w-4 h-4" style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }} />
                                    )}
                                  </button>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (quiz.hashPassword) {
                                        try {
                                          await navigator.clipboard.writeText(quiz.hashPassword);
                                          const Swal = (await import("sweetalert2")).default;
                                          Swal.fire({
                                            icon: "success",
                                            title: "Copied!",
                                            text: "Password copied to clipboard",
                                            timer: 1500,
                                            showConfirmButton: false,
                                          });
                                        } catch (err) {
                                          console.error("Failed to copy:", err);
                                        }
                                      }
                                    }}
                                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    title="Copy password"
                                  >
                                    <Copy className="w-4 h-4" style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }} />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Status Badge and Actions */}
                            <div className="flex items-center justify-between">
                              <span
                                className="text-xs font-semibold px-3 py-1 rounded-full"
                                style={{
                                  backgroundColor: `${status.color}20`,
                                  color: status.color,
                                }}
                              >
                                {status.label}
                              </span>
                              <div
                                className="flex items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {quiz.isPublished && (
                                  <span
                                    className="text-xs flex items-center gap-1"
                                    style={{ color: "#10b981" }}
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                    Published
                                  </span>
                                )}
                                {isStudent && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (canTakeQuiz(quiz)) {
                                        navigate(
                                          `/quizz/${courseId}/quiz/${quiz._id}`,
                                          {
                                            state: { quiz },
                                          }
                                        );
                                      }
                                    }}
                                    disabled={!canTakeQuiz(quiz)}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                                    style={{ backgroundColor: "#6d28d9" }}
                                  >
                                    {canTakeQuiz(quiz)
                                      ? "Take Quiz"
                                      : "Unavailable"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {quizzes.length > 0 && quizzesPaginationInfo.totalPages > 1 && (
                  <QuizPagination
                    currentPage={quizzesPaginationInfo.currentPage}
                    totalPages={quizzesPaginationInfo.totalPages}
                    textColor="var(--muted-text)"
                    borderColor="var(--card-border)"
                    hasPrev={quizzesPaginationInfo.hasPrev}
                    hasNext={quizzesPaginationInfo.hasNext}
                    pageOptions={Array.from(
                      { length: Math.min(5, quizzesPaginationInfo.totalPages) },
                      (_, index) => {
                        const start = Math.max(
                          1,
                          quizzesPaginationInfo.currentPage - 2
                        );
                        return Math.min(
                          start + index,
                          quizzesPaginationInfo.totalPages
                        );
                      }
                    )}
                    sendStringParams
                    onPrev={handlePaginationSelect}
                    onNext={handlePaginationSelect}
                    onSelectPage={handlePaginationSelect}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Edit Quiz Modal */}
      {!isStudent && editingQuiz && editForm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={handleCloseEdit}
          />
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6 space-y-4"
            style={{
              backgroundColor: "var(--card-surface)",
              color: "var(--heading-text)",
              border: "1px solid var(--card-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Edit Quiz</h2>
              <button
                onClick={handleCloseEdit}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                style={{ color: "var(--heading-text)" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateQuiz} className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                >
                  Title
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm({ ...editForm, title: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    backgroundColor: "var(--input-bg)",
                    borderColor: "var(--input-border)",
                    color: "var(--input-text)",
                  }}
                  required
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                >
                  Description
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    backgroundColor: "var(--input-bg)",
                    borderColor: "var(--input-border)",
                    color: "var(--input-text)",
                  }}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                  >
                    Start Time
                  </label>
                  <input
                    type="datetime-local"
                    value={editForm.startTime}
                    onChange={(e) =>
                      setEditForm({ ...editForm, startTime: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border"
                    style={{
                      backgroundColor: "var(--input-bg)",
                      borderColor: "var(--input-border)",
                      color: "var(--input-text)",
                    }}
                    required
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                  >
                    End Time
                  </label>
                  <input
                    type="datetime-local"
                    value={editForm.endTime}
                    onChange={(e) =>
                      setEditForm({ ...editForm, endTime: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border"
                    style={{
                      backgroundColor: "var(--input-bg)",
                      borderColor: "var(--input-border)",
                      color: "var(--input-text)",
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isPublished}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        isPublished: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded border"
                    style={{
                      backgroundColor: editForm.isPublished
                        ? "var(--primary-color)"
                        : "var(--input-bg)",
                      borderColor: "var(--input-border)",
                    }}
                  />
                  <span
                    className="text-sm font-medium"
                    style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                  >
                    Published
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{
                    backgroundColor: "var(--divider-color)",
                    color: "var(--heading-text)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingQuizId === editingQuiz._id}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white disabled:opacity-50"
                >
                  {updatingQuizId === editingQuiz._id
                    ? "Updating..."
                    : "Update Quiz"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attempt Modal */}
      {!isStudent && attemptModal.quiz && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={handleCloseAttemptModal}
          />
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6 space-y-4"
            style={{
              backgroundColor: "var(--card-surface)",
              color: "var(--heading-text)",
              border: "1px solid var(--card-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}>
                  Active attempts
                </p>
                <h2 className="text-2xl font-semibold">
                  {attemptModal.quiz?.title || "Quiz"}
                </h2>
              </div>
              <button
                onClick={handleCloseAttemptModal}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                style={{ color: "var(--heading-text)" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {attemptModal.loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : attemptModal.error ? (
              <div
                className="rounded-lg border p-4 text-center space-y-3"
                style={{ borderColor: "var(--card-border)" }}
              >
                <p style={{ color: "#ef4444" }}>{attemptModal.error}</p>
                <button
                  onClick={() =>
                    attemptModal.quiz &&
                    handleOpenAttemptModal(attemptModal.quiz)
                  }
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: "#6d28d9" }}
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                {attemptModal.attempts.filter((a) => a.status === "in_progress")
                  .length === 0 ? (
                  <div
                    className="rounded-lg border  p-6 pt-12 text-center"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    <p style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}>
                      No students are currently taking this quiz.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {attemptModal.attempts
                      .filter((attempt) => attempt.status === "in_progress")
                      .map((attempt) => (
                        <div
                          key={attempt._id}
                          className="border rounded-xl p-4 flex flex-wrap items-center justify-between gap-4"
                          style={{ borderColor: "var(--card-border)" }}
                        >
                          <div>
                            <p
                              className="font-semibold"
                              style={{ color: "var(--heading-text)" }}
                            >
                              {getStudentLabel(attempt)}
                            </p>
                            <p
                              className="text-xs"
                              style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                            >
                              Started:{" "}
                              {attempt.startedAt
                                ? new Date(attempt.startedAt).toLocaleString()
                                : "—"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                navigate(`/quiz-attempts/${attempt._id}`)
                              }
                              className="px-4 py-2 rounded-lg text-sm font-semibold"
                              style={{ backgroundColor: "var(--card-row-bg)" }}
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleBanAttempt(attempt)}
                              disabled={banProcessingId === attempt._id}
                              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-2"
                              style={{ backgroundColor: "#dc2626" }}
                            >
                              <ShieldOff className="w-4 h-4" />
                              {banProcessingId === attempt._id
                                ? "Banning..."
                                : "Ban"}
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Statistics Modal */}
      {!isStudent && statisticsModal.quiz && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={handleCloseStatisticsModal}
          />
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={handleCloseStatisticsModal}
          />
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6 space-y-4"
            style={{
              backgroundColor: "var(--card-surface)",
              color: "var(--heading-text)",
              border: "2px solid var(--card-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}>
                  Quiz Statistics
                </p>
                <h2 className="text-2xl font-semibold">
                  {statisticsModal.quiz?.title || "Quiz"}
                </h2>
              </div>
              <button
                onClick={handleCloseStatisticsModal}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                style={{ color: "var(--heading-text)" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {statisticsModal.loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : statisticsModal.error ? (
              <div
                className="rounded-lg border p-4 text-center space-y-3"
                style={{ borderColor: "var(--card-border)" }}
              >
                <p style={{ color: "#ef4444" }}>{statisticsModal.error}</p>
                <button
                  onClick={() =>
                    statisticsModal.quiz &&
                    handleOpenStatisticsModal(statisticsModal.quiz)
                  }
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: "#10b981" }}
                >
                  Retry
                </button>
              </div>
            ) : statisticsModal.statistics ? (
              statisticsModal.statistics.submittedCount === 0 ? (
                <div
                  className="rounded-lg border p-12 text-center"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  <BarChart3
                    className="w-16 h-16 mx-auto mb-4"
                    style={{ color: "var(--muted-text)", opacity: 0.5 }}
                  />
                  <p
                    className="text-lg font-semibold mb-2"
                    style={{ color: "var(--heading-text)" }}
                  >
                    No submissions yet
                  </p>
                  <p className="text-sm" style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}>
                    Statistics will be available once students submit their quiz
                    attempts.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Statistics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: Stats */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div
                          className="rounded-lg border-2 p-3 bg-gradient-to-br from-blue-500/10 to-blue-600/10"
                          style={{ borderColor: "#3b82f6" }}
                        >
                          <p
                            className="text-xs"
                            style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                          >
                            Total Students
                          </p>
                          <p className="text-xl font-bold mt-1">
                            {statisticsModal.statistics.totalStudents}
                          </p>
                        </div>
                        <div
                          className="rounded-lg border-2 p-3 bg-gradient-to-br from-green-500/10 to-green-600/10"
                          style={{ borderColor: "#10b981" }}
                        >
                          <p
                            className="text-xs"
                            style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                          >
                            Submitted
                          </p>
                          <p className="text-xl font-bold mt-1">
                            {statisticsModal.statistics.submittedCount}
                          </p>
                        </div>
                        <div
                          className="rounded-lg border-2 p-3 bg-gradient-to-br from-purple-500/10 to-purple-600/10"
                          style={{ borderColor: "#8b5cf6" }}
                        >
                          <p
                            className="text-xs"
                            style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                          >
                            Avg Score
                          </p>
                          <p className="text-xl font-bold mt-1">
                            {isNaN(statisticsModal.statistics.averageScore) ||
                              statisticsModal.statistics.averageScore === null
                              ? "N/A"
                              : statisticsModal.statistics.averageScore.toFixed(
                                1
                              )}
                          </p>
                        </div>
                        <div
                          className="rounded-lg border-2 p-3 bg-gradient-to-br from-orange-500/10 to-orange-600/10"
                          style={{ borderColor: "#f97316" }}
                        >
                          <p
                            className="text-xs"
                            style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                          >
                            Median
                          </p>
                          <p className="text-xl font-bold mt-1">
                            {isNaN(statisticsModal.statistics.medianScore) ||
                              statisticsModal.statistics.medianScore === null
                              ? "N/A"
                              : statisticsModal.statistics.medianScore.toFixed(
                                1
                              )}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div
                          className="rounded-lg border-2 p-3"
                          style={{
                            borderColor: "var(--heading-text)",
                            opacity: 0.8,
                          }}
                        >
                          <p
                            className="text-xs mb-1"
                            style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                          >
                            Score Range
                          </p>
                          <p className="text-base font-semibold">
                            {statisticsModal.statistics.minMax?.min !==
                              undefined &&
                              statisticsModal.statistics.minMax?.max !== undefined
                              ? `${statisticsModal.statistics.minMax.min} - ${statisticsModal.statistics.minMax.max}`
                              : "N/A"}
                          </p>
                        </div>
                        <div
                          className="rounded-lg border-2 p-3"
                          style={{
                            borderColor: "var(--heading-text)",
                            opacity: 0.8,
                          }}
                        >
                          <p
                            className="text-xs mb-1"
                            style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                          >
                            Std Deviation
                          </p>
                          <p className="text-base font-semibold">
                            {isNaN(
                              statisticsModal.statistics.standardDeviationScore
                            ) ||
                              statisticsModal.statistics
                                .standardDeviationScore === null
                              ? "N/A"
                              : statisticsModal.statistics.standardDeviationScore.toFixed(
                                2
                              )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Chart */}
                    {statisticsModal.statistics.scoreDistribution &&
                      statisticsModal.statistics.scoreDistribution.length >
                      0 && (
                        <div
                          className="flex flex-col items-center justify-center rounded-lg border-2 p-4 shadow-md"
                          style={{ borderColor: "var(--card-border)", borderWidth: "3px" }}
                        >
                          <h3 className="text-sm font-semibold mb-2">
                            Score Distribution
                          </h3>
                          <div className="w-full h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={statisticsModal.statistics.scoreDistribution.map(
                                    (d) => ({
                                      name: d.range,
                                      value: d.count,
                                      percentage: d.percentage,
                                    })
                                  )}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={40}
                                  outerRadius={70}
                                  paddingAngle={2}
                                  dataKey="value"
                                >
                                  {statisticsModal.statistics.scoreDistribution.map(
                                    (_, index) => {
                                      // Softer/Pastel Palette
                                      // Red -> Orange -> Yellow -> Blue -> Green
                                      const colors = [
                                        "#F87171",
                                        "#FB923C",
                                        "#FACC15",
                                        "#60A5FA",
                                        "#4ADE80",
                                      ];
                                      return (
                                        <Cell
                                          key={`cell-${index}`}
                                          fill={colors[index % colors.length]}
                                        />
                                      );
                                    }
                                  )}
                                </Pie>
                                <Tooltip
                                  formatter={(
                                    value: number,
                                    _: string,
                                    props: any
                                  ) => {
                                    // Parse percentage string (e.g. "25.5%") to number, round it, and add % back
                                    const rawPercent = parseFloat(
                                      props.payload.percentage.replace("%", "")
                                    );
                                    const roundedPercent =
                                      Math.round(rawPercent);
                                    return [
                                      `${roundedPercent}% - ${value} students`,
                                      null,
                                    ];
                                  }}
                                  contentStyle={{
                                    backgroundColor: "var(--card-surface)",
                                    borderColor: "var(--card-border)",
                                    color: "var(--heading-text)",
                                    borderRadius: "8px",
                                    fontSize: "12px",
                                    boxShadow:
                                      "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                  }}
                                  itemStyle={{ color: "var(--heading-text)" }}
                                  labelStyle={{ display: "none" }}
                                />
                                <Legend
                                  layout="vertical"
                                  verticalAlign="middle"
                                  align="right"
                                  wrapperStyle={{ fontSize: "10px" }}
                                  formatter={(value, entry: any) => (
                                    <span
                                      style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                                    >
                                      {value}
                                    </span>
                                  )}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Students List */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">
                      Student Results
                    </h3>
                    <div className="space-y-2">
                      {statisticsModal.statistics.students.length === 0 ? (
                        <p
                          className="text-sm text-center py-4"
                          style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                        >
                          No students have submitted this quiz yet.
                        </p>
                      ) : (
                        <div
                          className="rounded-lg border overflow-hidden"
                          style={{ borderColor: "var(--card-border)" }}
                        >
                          <table className="w-full">
                            <thead>
                              <tr
                                style={{
                                  backgroundColor: "var(--card-row-bg)",
                                }}
                              >
                                <th className="px-4 py-2 text-left text-sm font-semibold">
                                  Rank
                                </th>
                                <th className="px-4 py-2 text-left text-sm font-semibold">
                                  Name
                                </th>
                                <th className="px-4 py-2 text-left text-sm font-semibold">
                                  Email
                                </th>
                                <th className="px-4 py-2 text-right text-sm font-semibold">
                                  Score
                                </th>
                                <th className="px-4 py-2 text-right text-sm font-semibold">
                                  Duration
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {statisticsModal.statistics.students.map(
                                (student, index) => (
                                  <tr
                                    key={index}
                                    className="border-t"
                                    style={{
                                      borderColor: "var(--card-border)",
                                    }}
                                  >
                                    <td className="px-4 py-2 text-sm">
                                      #{student.rank}
                                    </td>
                                    <td className="px-4 py-2 text-sm">
                                      {student.fullname}
                                    </td>
                                    <td
                                      className="px-4 py-2 text-sm"
                                      style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                                    >
                                      {student.email}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-right font-semibold">
                                      {student.score.toFixed(1)}
                                    </td>
                                    <td
                                      className="px-4 py-2 text-sm text-right"
                                      style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
                                    >
                                      {Math.floor(student.durationSeconds / 60)}
                                      m{" "}
                                      {Math.floor(student.durationSeconds % 60)}
                                      s
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
