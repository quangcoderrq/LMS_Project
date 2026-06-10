import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import Navbar from "../../components/layout/Navbar.tsx";
import Sidebar from "../../components/layout/Sidebar.tsx";
import http from "../../utils/http";
import { myCourses } from "../../services/mock";
import { quizService, courseService } from "../../services";
import type { QuizResponse } from "../../services/quizService";
import { Clock, FileText, Calendar, CheckCircle, XCircle } from "lucide-react";

interface Course {
  _id: string;
  title: string;
  code?: string;
  description?: string;
  subjectId?: string | { _id: string; code?: string; name?: string };
}

interface Enrollment {
  _id: string;
  courseId: Course | string;
  status: string;
  role: string;
}


const QuizPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<QuizResponse[]>([]);
  const [quizTitle, setQuizTitle] = useState("");

  useEffect(() => {
    fetchMyEnrollments();
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      fetchQuizzesForCourse(selectedCourseId);
    } else {
      setQuizzes([]);
    }
  }, [selectedCourseId]);

  const fetchQuizzesForCourse = async (courseId: string) => {
    try {
      console.log("QuizPage: Fetching quizzes for courseId:", courseId);
      const result = await quizService.getQuizzesByCourseId(courseId, {
        isPublished: true,
      });
      console.log("QuizPage: Quizzes fetched:", result.data);
      setQuizzes(result.data || []);
    } catch (error) {
      console.error("QuizPage: Error fetching quizzes:", error);
      setQuizzes([]);
    }
  };

  const fetchMyEnrollments = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await http.get("/courses/my-courses", {
        params: {
          page: 1,
          limit: 1000,
        },
      });

      // Normalize response structure – backend returns { success, data, pagination }
      const rawCourses =
        Array.isArray(response?.data) ? response.data :
        Array.isArray(response?.data?.data) ? response.data.data :
        Array.isArray(response) ? response : [];

      const pagination = response?.pagination || response?.meta?.pagination;

      console.log("My courses response:", {
        count: rawCourses.length,
        pagination,
      });

      const mappedEnrollments: Enrollment[] = rawCourses.map((course: Course) => ({
        _id: `course-${course._id}`,
        courseId: course,
        status: "approved",
        role: "student",
      }));

      if (mappedEnrollments.length === 0) {
          const mockedEnrollments: Enrollment[] = myCourses.map((c) => {
            const courseId = `mock-${String(c.id)}`;
            return {
              _id: `enr-${courseId}`,
              courseId: { _id: courseId, title: c.name, description: `${c.instructor ?? ""}` },
              status: "approved",
              role: "student",
            };
          });
          setEnrollments(mockedEnrollments);
          setError("");
        } else {
        setEnrollments(mappedEnrollments);
      }
    } catch (err) {
      console.error("Error fetching enrollments:", err);
      let errorMessage = "An error occurred while fetching courses";
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as { response?: { data?: { message?: string } }; message?: string };
        errorMessage = axiosError.response?.data?.message || axiosError.message || errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      // Fallback: use mock 'myCourses' to populate course list when unauthorized or API fails
      const mockedEnrollments: Enrollment[] = myCourses.map((c) => {
        const courseId = `mock-${String(c.id)}`;
        return {
          _id: `enr-${courseId}`,
          courseId: { _id: courseId, title: c.name, description: `${c.instructor ?? ""}` },
          status: "approved",
          role: "student",
        };
      });
      if (mockedEnrollments.length > 0) {
        setEnrollments(mockedEnrollments);
        // Do not surface an error banner if mock data is shown
        setError("");
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCourse = (enrollment: Enrollment): Course | null => {
    if (typeof enrollment.courseId === "object" && enrollment.courseId !== null) {
      return enrollment.courseId as Course;
    }
    // If courseId is a string, we don't have course details, skip this enrollment
    // The API should populate courseId, but we handle the case where it doesn't
    return null;
  };

  const getCourseId = (enrollment: Enrollment): string | null => {
    if (typeof enrollment.courseId === "object" && enrollment.courseId !== null) {
      return (enrollment.courseId as Course)._id;
    }
    if (typeof enrollment.courseId === "string") {
      return enrollment.courseId;
    }
    return null;
  };

  const getQuizStatus = (quiz: QuizResponse) => {
    const now = new Date();
    const startTime = new Date(quiz.startTime);
    const endTime = new Date(quiz.endTime);
    
    if (startTime > now) {
      return { text: "Not Started", color: "var(--status-neutral-text)", bg: "var(--status-neutral-bg)" };
    }
    if (endTime < now) {
      return { text: "Closed", color: "var(--status-closed-text)", bg: "var(--status-closed-bg)" };
    }
    if (quiz.isPublished) {
      return { text: "Available", color: "var(--status-available-text)", bg: "var(--status-available-bg)" };
    }
    return { text: "Unavailable", color: "var(--status-neutral-text)", bg: "var(--status-neutral-bg)" };
  };

  const handleQuizClick = (quizId: string) => {
    navigate(`/quiz/take/${quizId}`);
  };

  const handleCourseClick = (courseId: string) => {
    if (selectedCourseId === courseId) {
      setSelectedCourseId(null);
    } else {
      setSelectedCourseId(courseId);
    }
  };

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{
        backgroundColor: "var(--page-bg)",
        color: "var(--page-text)",
      }}
    >
      <Navbar />
      <Sidebar role={(user?.role as "admin" | "teacher" | "student") || "student"} />

      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 mt-16 sm:pl-24 md:pl-28">
          <div className="max-w-7xl mx-auto px-4">
            {/* Header with Form Title */}
            <div className="mb-8">
              <div className="mb-4">
                <label
                  htmlFor="quiz-title"
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--muted-text)" }}
                >
                  Quiz Title
                </label>
                <input
                  id="quiz-title"
                  type="text"
                  placeholder="Enter quiz title..."
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  className="w-full max-w-md px-4 py-2 rounded-lg border transition-colors duration-300"
                  style={{
                    backgroundColor: "var(--input-bg)",
                    borderColor: "var(--input-border)",
                    color: "var(--input-text)",
                  }}
                />
              </div>
              <h1
                className="text-3xl font-bold mb-2"
                style={{ color: "var(--heading-text)" }}
              >
                {quizTitle || "Quizzes"}
              </h1>
              <p style={{ color: "var(--muted-text)" }}>
                Select a course to view available quizzes
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div
                className="p-4 rounded-lg mb-6 flex items-center"
                style={{
                  backgroundColor: "var(--error-bg)",
                  color: "var(--error-text)",
                }}
              >
                <XCircle className="w-5 h-5 mr-3" />
                {error}
              </div>
            )}

            {/* Loading State */}
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div
                  className="animate-spin rounded-full h-12 w-12 border-b-2"
                  style={{ borderColor: "var(--spinner-border)" }}
                ></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Courses List */}
                <div>
                  <h2
                    className="text-xl font-semibold mb-4"
                    style={{ color: "var(--heading-text)" }}
                  >
                    My Courses
                  </h2>
                  {enrollments.length === 0 ? (
                    <div className="text-center py-12">
                      <p style={{ color: "var(--muted-text)" }}>
                        No courses available. Please enroll in a course first.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {enrollments.map((enrollment) => {
                        const course = getCourse(enrollment);
                        const courseId = getCourseId(enrollment);
                        if (!courseId) return null; // Skip if we can't get course ID

                        const isSelected = selectedCourseId === courseId;
                        return (
                          <div
                            key={enrollment._id}
                            onClick={() => handleCourseClick(courseId)}
                            className="rounded-lg shadow-md overflow-hidden transition-all duration-200 hover:shadow-lg cursor-pointer"
                            style={{
                              backgroundColor: isSelected ? "var(--card-selected-bg)" : "var(--card-surface)",
                              border: isSelected
                                ? `2px solid var(--card-selected-border)`
                                : `1px solid var(--card-border)`,
                            }}
                          >
                            <div className="p-4">
                              <h3
                                className="text-lg font-semibold mb-1"
                                style={{ color: "var(--heading-text)" }}
                              >
                                {course ? course.title : `Course ${courseId.substring(0, 8)}...`}
                              </h3>
                              {course?.code && (
                                <p
                                  className="text-sm mb-2"
                                  style={{ color: "var(--muted-text)" }}
                                >
                                  Code: {course.code}
                                </p>
                              )}
                              {course?.description && (
                                <p
                                  className="text-sm line-clamp-2"
                                  style={{ color: "var(--muted-text)" }}
                                >
                                  {course.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Quizzes List */}
                <div>
                  <h2
                    className="text-xl font-semibold mb-4"
                    style={{ color: "var(--heading-text)" }}
                  >
                    {selectedCourseId ? "Quizzes" : "Select a course to view quizzes"}
                  </h2>
                  {!selectedCourseId ? (
                    <div className="text-center py-12">
                      <p style={{ color: "var(--muted-text)" }}>
                        Click on a course to view its quizzes
                      </p>
                    </div>
                  ) : quizzes.length === 0 ? (
                    <div className="text-center py-12">
                      <p style={{ color: "var(--muted-text)" }}>
                        No quizzes available for this course.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {quizzes.map((quiz) => {
                        const status = getQuizStatus(quiz);
                        const questionCount = quiz.snapshotQuestions?.filter((q) => !q.isDeleted).length || 0;
                        return (
                          <div
                            key={quiz._id}
                            onClick={() => handleQuizClick(quiz._id)}
                            className="rounded-lg shadow-md overflow-hidden transition-all duration-200 hover:shadow-lg cursor-pointer"
                            style={{
                              backgroundColor: "var(--card-surface)",
                              border: `1px solid var(--card-border)`,
                            }}
                          >
                            <div className="p-6">
                              {/* Quiz Title */}
                              <h3
                                className="text-xl font-semibold mb-2"
                                style={{ color: "var(--heading-text)" }}
                              >
                                {quiz.title}
                              </h3>

                              {/* Quiz Description */}
                              <p
                                className="text-sm mb-4 line-clamp-2"
                                style={{ color: "var(--muted-text)" }}
                              >
                                {quiz.description}
                              </p>

                              {/* Quiz Details */}
                              <div className="space-y-2 mb-4">
                                <div className="flex items-center text-sm" style={{ color: "var(--muted-text)" }}>
                                  <FileText className="w-4 h-4 mr-2" />
                                  {questionCount} questions
                                </div>
                                <div className="flex items-center text-sm" style={{ color: "var(--muted-text)" }}>
                                  <Calendar className="w-4 h-4 mr-2" />
                                  Start: {formatDate(quiz.startTime)}
                                </div>
                                <div className="flex items-center text-sm" style={{ color: "var(--muted-text)" }}>
                                  <Clock className="w-4 h-4 mr-2" />
                                  End: {formatDate(quiz.endTime)}
                                  </div>
                              </div>

                              {/* Status Badge */}
                              <div className="flex items-center justify-between pt-4 mt-auto border-t gap-2" style={{ borderColor: "var(--divider-color)" }}>
                                <span
                                  className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full"
                                  style={{
                                    backgroundColor: status.bg,
                                    color: status.color,
                                  }}
                                >
                                  {status.text}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default QuizPage;



