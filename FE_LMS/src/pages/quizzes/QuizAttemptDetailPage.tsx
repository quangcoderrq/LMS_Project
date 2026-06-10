import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";
import { quizAttemptService } from "../../services";
import type { QuizAttempt, QuizAnswer } from "../../services/quizAttemptService";
import type { QuizResponse } from "../../services/quizService";
import { useAuth } from "../../hooks/useAuth";
import {
  ArrowLeft,
  RefreshCcw,
  Clock,
  UserRound,
  Book,
  CheckCircle,
  XCircle,
} from "lucide-react";

const statusDisplay: Record<
  QuizAttempt["status"],
  { label: string; color: string; bg: string }
> = {
  in_progress: { label: "In progress", color: "#2563eb", bg: "rgba(37, 99, 235, 0.15)" },
  submitted: { label: "Submitted", color: "#059669", bg: "rgba(16, 185, 129, 0.15)" },
  abandoned: { label: "Banned", color: "#dc2626", bg: "rgba(220, 38, 38, 0.15)" },
};

const formatDate = (value?: string) => (value ? new Date(value).toLocaleString() : "—");

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "object" && error !== null && "message" in error) {
    const maybeMessage = (error as { message?: string }).message;
    if (maybeMessage) return String(maybeMessage);
  }
  return fallback;
};

const getStudentLabel = (student: QuizAttempt["studentId"]) => {
  if (!student) return "Unknown student";
  if (typeof student === "string") return student;
  return (
    student.fullName ||
    student.fullname ||
    student.username ||
    student.email ||
    student._id ||
    "Unknown student"
  );
};

const QuizAttemptDetailPage = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const quizInfo = useMemo(() => {
    if (attempt && typeof attempt.quizId !== "string") {
      return attempt.quizId as QuizResponse;
    }
    return null;
  }, [attempt]);

  const answers: QuizAnswer[] = attempt?.answers || [];

  const studentLabel = useMemo(() => getStudentLabel(attempt?.studentId || ""), [attempt]);

  const fetchAttempt = useCallback(async () => {
    if (!attemptId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await quizAttemptService.getQuizAttempt(attemptId);
      setAttempt(data);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load quiz attempt."));
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    fetchAttempt();
  }, [fetchAttempt]);



  const renderAnswerOption = (answer: QuizAnswer, option: string, idx: number) => {
    const selected = answer.answer?.[idx] === 1;
    return (
      <div
        key={idx}
        className="flex items-start gap-2 px-3 py-2 rounded-lg"
        style={{
          backgroundColor: selected ? "rgba(109, 40, 217, 0.1)" : "var(--card-row-bg)",
          border: selected ? "1px solid #6d28d9" : "1px solid transparent",
        }}
      >
        <span className="font-semibold">{String.fromCharCode(65 + idx)}.</span>
        <span dangerouslySetInnerHTML={{ __html: option }} />
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={(user?.role as "admin" | "teacher" | "student") || "teacher"} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main
          className="flex-1 overflow-y-auto px-6 pb-6 pt-28"
          style={{ backgroundColor: "var(--page-bg)", color: "var(--page-text)" }}
        >
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-sm"
                style={{ color: "var(--muted-text)" }}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div className="flex gap-3">
                <button
                  onClick={fetchAttempt}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm"
                  style={{ borderColor: "var(--card-border)" }}
                  disabled={loading}
                >
                  <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
            </div>

            {loading && (
              <div
                className="p-6 rounded-2xl border text-center"
                style={{ backgroundColor: "var(--card-surface)", borderColor: "var(--card-border)" }}
              >
                Loading attempt details...
              </div>
            )}

            {error && !loading && (
              <div
                className="p-6 rounded-2xl border"
                style={{ backgroundColor: "var(--card-surface)", borderColor: "var(--card-border)" }}
              >
                <p style={{ color: "#dc2626" }}>{error}</p>
              </div>
            )}



            {attempt && !loading && (
              <>
                <div
                  className="p-6 rounded-2xl border space-y-4"
                  style={{ backgroundColor: "var(--card-surface)", borderColor: "var(--card-border)" }}
                >
                  <div className="flex flex-wrap justify-between gap-4">
                    <div>
                      <p className="text-sm" style={{ color: "var(--muted-text)" }}>
                        Quiz
                      </p>
                      <h1 className="text-2xl font-bold" style={{ color: "var(--heading-text)" }}>
                        {quizInfo?.title || "Quiz"}
                      </h1>
                      <p className="text-sm" style={{ color: "var(--muted-text)" }}>
                        Attempt ID: {attempt._id}
                      </p>
                    </div>
                    <div
                      className="px-4 py-2 rounded-full text-sm font-semibold"
                      style={{
                        backgroundColor: statusDisplay[attempt.status].bg,
                        color: statusDisplay[attempt.status].color,
                      }}
                    >
                      {statusDisplay[attempt.status].label}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border p-4" style={{ borderColor: "var(--card-border)" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <UserRound className="w-4 h-4" />
                        <span className="text-sm font-semibold">Student</span>
                      </div>
                      <p className="text-sm" style={{ color: "var(--heading-text)" }}>
                        {studentLabel}
                      </p>
                    </div>
                    <div className="rounded-xl border p-4" style={{ borderColor: "var(--card-border)" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-semibold">Timeline</span>
                      </div>
                      <p className="text-xs" style={{ color: "var(--muted-text)" }}>
                        Started: {formatDate(attempt.startedAt || attempt.startTime)}
                      </p>
                      <p className="text-xs" style={{ color: "var(--muted-text)" }}>
                        Updated: {formatDate(attempt.updatedAt)}
                      </p>
                      {attempt.submittedAt && (
                        <p className="text-xs" style={{ color: "var(--muted-text)" }}>
                          Submitted: {formatDate(attempt.submittedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className="p-6 rounded-2xl border"
                  style={{ backgroundColor: "var(--card-surface)", borderColor: "var(--card-border)" }}
                >
                  <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--heading-text)" }}>
                    Answer history
                  </h2>
                  {answers.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--muted-text)" }}>
                      No answers recorded for this attempt.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {answers.map((answer, idx) => (
                        <div
                          key={answer.questionId || idx}
                          className="p-4 rounded-xl border space-y-3"
                          style={{ borderColor: "var(--card-border)" }}
                        >
                          <div className="flex items-center gap-2">
                            <Book className="w-4 h-4" />
                            <span className="font-semibold">
                              Question {idx + 1}:{" "}
                              <span dangerouslySetInnerHTML={{ __html: answer.text || "" }} />
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs uppercase font-semibold">
                            <span
                              className="px-2 py-1 rounded-full"
                              style={{ backgroundColor: "var(--card-row-bg)", color: "var(--muted-text)" }}
                            >
                              {answer.type || "unknown"}
                            </span>
                            {typeof answer.pointsEarned === "number" && (
                              <span
                                className="px-2 py-1 rounded-full"
                                style={{ backgroundColor: "var(--card-row-bg)", color: "var(--muted-text)" }}
                              >
                                Points: {answer.pointsEarned}/{answer.points ?? 1}
                              </span>
                            )}
                            {typeof answer.correct !== "undefined" && (
                              <span
                                className="flex items-center gap-1 px-2 py-1 rounded-full"
                                style={{
                                  backgroundColor: answer.correct ? "rgba(16, 185, 129, 0.15)" : "rgba(220,38,38,0.15)",
                                  color: answer.correct ? "#059669" : "#dc2626",
                                }}
                              >
                                {answer.correct ? (
                                  <CheckCircle className="w-4 h-4" />
                                ) : (
                                  <XCircle className="w-4 h-4" />
                                )}
                                {answer.correct ? "Correct" : "Incorrect"}
                              </span>
                            )}
                          </div>
                          {Array.isArray(answer.options) && answer.options.length > 0 && (
                            <div className="space-y-2">{answer.options.map((opt, optIdx) => renderAnswerOption(answer, opt, optIdx))}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default QuizAttemptDetailPage;

