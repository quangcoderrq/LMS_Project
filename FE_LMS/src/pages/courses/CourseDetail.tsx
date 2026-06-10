import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Info } from "lucide-react";

import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import CourseTabsNavigation from "../../components/courses/CourseTabsNavigation";
import type { TabType } from "../../components/courses/CourseTabsNavigation";
import LessonsTab from "../../components/courses/LessonsTab";
import AssignmentsTab from "../../components/courses/AssignmentsTab";
import AttendanceTab from "../../components/courses/AttendanceTab";
import QuizTab from "../../components/courses/QuizTab";
import ScheduleTab from "../../components/courses/ScheduleTab";
import StaticCourseTab from "../../components/courses/StaticCourseTab";
import EnrollmentListModal from "../../components/courses/EnrollmentListModal";
import { courseService, quizService } from "../../services";
import type { Course } from "../../types/course";
import { httpClient } from "../../utils/http";
import { userService } from "../../services/userService";

type ApiCourse = Partial<Course> & {
  subjectId?: {
    _id: string;
    name: string;
    description?: string;
    code?: string;
    slug?: string;
    credits?: number;
  };
  teacherIds?: Array<{
    _id: string;
    username?: string;
    email?: string;
    fullname?: string;
  }>;
  startDate?: string;
  endDate?: string;
  status?: string;
  meta?: { level?: string; duration?: string };
  createdBy?: { _id: string; username?: string; email?: string };
  enrollRequiresApproval?: boolean;
  logo?: string;
  key?: string;
  isTeacherOfCourse?: boolean;
};

function sanitizeLogo(logo?: string): string | undefined {
  if (!logo) return undefined;
  const cleaned = logo
    .trim()
    .replace(/^`+|`+$/g, "")
    .trim();
  return cleaned || undefined;
}

export default function CourseDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { darkMode: isDarkMode } = useTheme();
  const { user } = useAuth();

  const [course, setCourse] = useState<ApiCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("lessons");
  const handleTabChange = async (tab: TabType) => {
    if (tab === "static" && course?.status !== "completed") {
      const Swal = (await import("sweetalert2")).default;
      const res = await Swal.fire({
        title: "Static statistics require course completion",
        html: "<div style='font-size:14px;opacity:0.8'>You need to complete the course to view aggregated statistics.</div>",
        icon: "info",
        showCancelButton: true,
        showConfirmButton: false,
        cancelButtonText: "Confirm",
      });
      if (res.isConfirmed) {
        await handleCompleteCourse();
        setActiveTab("static");
      }
      return;
    }
    setActiveTab(tab);
  };
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [inviteInput, setInviteInput] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [users, setUsers] = useState<
    Array<{ _id: string; fullname?: string; username: string; email: string }>
  >([]);
  const [userId, setUserId] = useState("");
  const [completing, setCompleting] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsData, setStatsData] = useState<any>(null);
  const [quizCount, setQuizCount] = useState(0);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [pendingEnrollmentCount, setPendingEnrollmentCount] = useState(0);

  const showToastSuccess = async (message: string) => {
    try {
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: message,
        showConfirmButton: false,
        timer: 2000,
      });
    } catch {
      // Ignore error
    }
  };

  const showToastInfo = async (message: string) => {
    try {
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "info",
        title: message,
        showConfirmButton: false,
        timer: 2000,
      });
    } catch {
      // Ignore error
    }
  };
  const handleEnroll = async () => {
    try {
      setEnrolling(true);
      await httpClient.post(
        "/enrollments/enroll",
        { courseId: id, role: "student" },
        { withCredentials: true }
      );

      await showToastSuccess("Enroll successfully");
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 409) {
        const message =
          e?.response?.data?.message ||
          "You are already enrolled in this course.";
        await showToastInfo(message);
      } else {
        console.error(e);
      }
    } finally {
      setEnrolling(false);
    }
  };

  const handleCreateForumPost = () => {
    if (!course?._id) return;
    navigate("/forum", {
      state: {
        preselectedCourseId: course._id,
        preselectedCourseTitle: course.title ?? course.code ?? "Course",
      },
    });
  };

  const handleViewForumList = () => {
    if (!course?._id) return;
    const courseTitle = course.title ?? course.code ?? "Course";
    const params = new URLSearchParams({ courseId: course._id });
    if (courseTitle) {
      params.set("courseTitle", courseTitle);
    }
    navigate(`/forum-list?${params.toString()}`, {
      state: {
        preselectedCourseId: course._id,
        preselectedCourseTitle: courseTitle,
      },
    });
  };
  const openInviteModal = () => {
    setInviteError("");
    setInviteEmails([]);
    setInviteInput("");
    setExpiresInDays(7);
    setUserId("");
    userService
      .getUsers({ role: "student", limit: 100 } as any)
      .then((res) => {
        const list = res.users || [];
        setUsers(
          list.map((u: any) => ({
            _id: u._id,
            fullname: u.fullname,
            username: u.username,
            email: u.email,
          }))
        );
      })
      .catch(() => {});
    setShowInviteModal(true);
  };

  const isValidEmail = (email: string) =>
    /[^\s@]+@[^\s@]+\.[^\s@]+/.test(email);

  const addInviteEmail = (email?: string) => {
    const e = (email ?? inviteInput).trim();
    if (!e) return;
    if (!isValidEmail(e)) {
      setInviteError("Invalid email format");
      return;
    }
    setInviteError("");
    setInviteEmails((prev) => (prev.includes(e) ? prev : [...prev, e]));
    if (!email) setInviteInput("");
  };

  const removeInviteEmail = (email: string) => {
    setInviteEmails((prev) => prev.filter((x) => x !== email));
  };

  const handleStudentSelect = (e: any) => {
    const id = e.target.value;
    const selected = users.find((u) => u._id === id);
    if (selected) {
      addInviteEmail(selected.email);
    }
    setUserId("");
  };

  const submitInvite = async () => {
    if (!course?._id) return;
    if (!inviteEmails.length) {
      setInviteError("Please add at least one email");
      return;
    }
    setInviting(true);
    try {
      await httpClient.post(
        "/course-invites",
        { courseId: id, expiresInDays, invitedEmails: inviteEmails },
        { withCredentials: true }
      );
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Invite sent successfully",
        showConfirmButton: false,
        timer: 2000,
      });
      setShowInviteModal(false);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Invite failed";
      setInviteError(msg);
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: msg,
        showConfirmButton: false,
        timer: 2500,
      });
    } finally {
      setInviting(false);
    }
  };

  const handleCompleteCourse = async () => {
    if (!course?._id) return;
    setCompleting(true);
    try {
      const resp = await httpClient.post(
        `/courses/${id}/statistics`,
        {},
        { withCredentials: true }
      );
      const body: any = resp?.data;
      const stats = body?.data ?? body;
      setStatsData(stats);
      await showToastSuccess(body?.message || "Course completed successfully");
      const updated = await courseService.getCourseById(id);
      setCourse(updated as unknown as ApiCourse);
      setShowStatsModal(true);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || e?.message || "Failed to complete course";
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: msg,
        showConfirmButton: false,
        timer: 2000,
      });
    } finally {
      setCompleting(false);
    }
  };

  const handleCompleteButtonClick = async () => {
    if (course?.status === "completed") {
      const Swal = (await import("sweetalert2")).default;
      const res = await Swal.fire({
        title: "Course is completed",
        html: "<div style='font-size:14px;opacity:0.8'>You can view aggregated statistics in the Static tab.</div>",
        icon: "success",
        confirmButtonText: "Open Static Tab",
        showCancelButton: true,
        cancelButtonText: "Close",
      });
      if (res.isConfirmed) setActiveTab("static");
      return;
    }
    const Swal = (await import("sweetalert2")).default;
    const res = await Swal.fire({
      title: "Confirm complete course",
      html: "<div style='font-size:14px;opacity:0.8'>Completing will generate statistics and mark the course as completed.</div>",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Confirm",
      cancelButtonText: "Cancel",
    });
    if (!res.isConfirmed) return;
    await handleCompleteCourse();
  };
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await courseService.getCourseById(id);
        if (mounted) {
          const anyData = data as unknown as ApiCourse;
          setCourse(anyData);
          setError("");
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load course");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Fetch quiz count when course loads
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        // Don't pass pagination params - backend will use defaults
        const result = await quizService.getQuizzesByCourseId(id, {
          isPublished: true,
        });
        setQuizCount(result.pagination.total);
      } catch (err) {
        console.error("Failed to fetch quiz count:", err);
      }
    })();
  }, [id]);

  // Fetch pending enrollment count for teachers/admins
  const fetchPendingEnrollmentCount = useCallback(async () => {
    if (!id) return;
    const role = user?.role;
    if (role !== "admin" && role !== "teacher") return;
    
    try {
      const response = await httpClient.get(
        `/enrollments/course/${id}?status=pending&limit=1`,
        { withCredentials: true }
      );
      const data = response.data as any;
      const pagination = data?.data?.pagination || data?.pagination;
      setPendingEnrollmentCount(pagination?.total || 0);
    } catch (err) {
      console.error("Failed to fetch pending enrollment count:", err);
    }
  }, [id, user?.role]);

  useEffect(() => {
    fetchPendingEnrollmentCount();
  }, [fetchPendingEnrollmentCount]);

  const logoUrl = useMemo(() => sanitizeLogo(course?.logo), [course?.logo]);

  const teachers = useMemo(() => {
    const list = (
      Array.isArray(course?.teachers) ? course?.teachers : []
    ) as Array<{
      _id: string;
      username?: string;
      email?: string;
      fullname?: string;
    }>;
    const list2 = (
      Array.isArray(course?.teacherIds) ? course?.teacherIds : []
    ) as Array<{
      _id: string;
      username?: string;
      email?: string;
      fullname?: string;
    }>;
    const merged = [...list, ...list2];
    const seen = new Set<string>();
    return merged.filter((t) => {
      if (!t?._id) return false;
      if (seen.has(t._id)) return false;
      seen.add(t._id);
      return true;
    });
  }, [course?.teachers, course?.teacherIds]);

  const subject = course?.subjectId;
  const startDate = course?.startDate ? new Date(course.startDate) : null;
  const endDate = course?.endDate ? new Date(course.endDate) : null;

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{
        backgroundColor: isDarkMode ? "#0f172a" : "#f8fafc",
        color: isDarkMode ? "#ffffff" : "#0f172a",
      }}
    >
      <Navbar />
      <Sidebar
        role={(user?.role as "admin" | "teacher" | "student") || "student"}
      />

      <div className="max-w-[1200px] mx-auto px-4 py-10 mt-16 sm:pl-24 md:pl-28">
        {loading ? (
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-gray-300 dark:bg-gray-700 rounded mb-6" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="lg:col-span-2 space-y-4">
                <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
                <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
                <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded" />
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <h1
              className="text-3xl font-bold mb-4"
              style={{ color: isDarkMode ? "#ffffff" : "#1c1c1c" }}
            >
              Không thể tải khóa học
            </h1>
            <p
              className="mb-6"
              style={{ color: isDarkMode ? "#d1d5db" : "#4b5563" }}
            >
              {error}
            </p>
            <button
              onClick={() => navigate(-1)}
              className="bg-[#525fe1] text-white px-5 py-2 rounded-lg hover:scale-105 transition"
            >
              Back
            </button>
          </div>
        ) : !course ? (
          <div className="text-center py-20">
            <h1
              className="text-3xl font-bold mb-4"
              style={{ color: isDarkMode ? "#ffffff" : "#1c1c1c" }}
            >
              Course not found
            </h1>
            <button
              onClick={() => navigate("/")}
              className="bg-[#525fe1] text-white px-5 py-2 rounded-lg hover:scale-105 transition"
            >
              Go to home page
            </button>
          </div>
        ) : (
          <>
            {/* Back Button */}
            <div className="mb-4">
              <button
                onClick={() => navigate("/my-courses")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: isDarkMode
                    ? "rgba(55, 65, 81, 0.8)"
                    : "rgba(249, 250, 251, 0.8)",
                  color: isDarkMode ? "#ffffff" : "#1f2937",
                }}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                <span>Back to My Courses</span>
              </button>
            </div>

            {/* Hero */}
            <div
              className="relative rounded-2xl overflow-visible mb-8 shadow-xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(82,95,225,0.15), rgba(255,207,89,0.15))",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                <div
                  className="p-6 flex items-center justify-center"
                  style={{
                    backgroundColor: isDarkMode ? "#0b132b" : "#ffffff",
                  }}
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={course.title ?? "Course Logo"}
                      className="rounded-xl w-full h-[260px] object-cover"
                    />
                  ) : (
                    <div className="w-full h-[260px] rounded-xl bg-gradient-to-br from-indigo-200 via-purple-200 to-pink-200 dark:from-indigo-900 dark:via-purple-900 dark:to-pink-900 flex items-center justify-center">
                      <span className="text-lg opacity-80">No Cover</span>
                    </div>
                  )}
                </div>
                <div className="lg:col-span-2 p-8">
                  <div className="flex items-center gap-2 mb-3">
                    <h1
                      className="text-4xl font-bold"
                      style={{ color: isDarkMode ? "#ffffff" : "#111827" }}
                    >
                      {course.title}
                    </h1>
                    <div className="relative group">
                      <Info
                        className="w-5 h-5 cursor-pointer"
                        style={{ color: isDarkMode ? "#9ca3af" : "#6b7280" }}
                      />
                      <div
                        className="fixed left-1/2 top-1/2 w-[90vw] max-w-[950px] max-h-[85vh] overflow-y-auto p-6 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none"
                        style={{
                          backgroundColor: isDarkMode ? "#0b132b" : "#ffffff",
                          border: `1px solid ${
                            isDarkMode ? "rgba(255,255,255,0.08)" : "#e5e7eb"
                          }`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-start text-sm">
                          {/* Instructors */}
                          <div>
                            <h2
                              className="text-xl font-semibold mb-3"
                              style={{
                                color: isDarkMode ? "#ffffff" : "#111827",
                              }}
                            >
                              Instructors
                            </h2>
                            {teachers.length === 0 ? (
                              <p
                                style={{
                                  color: isDarkMode ? "#9ca3af" : "#6b7280",
                                }}
                              >
                                Chưa có thông tin giảng viên
                              </p>
                            ) : (
                              <ul className="space-y-2">
                                {teachers.map((t) => (
                                  <li
                                    key={t._id}
                                    className="flex items-center gap-2"
                                  >
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-100 text-xs">
                                      {(t.fullname || t.username || "T")
                                        .slice(0, 1)
                                        .toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="font-semibold text-xs">
                                        {t.fullname || t.username}
                                      </div>
                                      <div
                                        className="text-xs"
                                        style={{
                                          color: isDarkMode
                                            ? "#9ca3af"
                                            : "#6b7280",
                                        }}
                                      >
                                        {t.email}
                                      </div>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {/* Subject Detail */}
                          <div>
                            <h2
                              className="text-xl font-semibold mb-3"
                              style={{
                                color: isDarkMode ? "#ffffff" : "#111827",
                              }}
                            >
                              Subject Detail
                            </h2>
                            {subject ? (
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span className="opacity-70">Name:</span>
                                  <span className="text-right truncate max-w-[180px]">
                                    {subject.name}
                                  </span>
                                </div>
                                {subject.description && (
                                  <div className="flex justify-between text-xs">
                                    <span className="opacity-70 shrink-0 mr-2">
                                      Desc:
                                    </span>
                                    <p
                                      className="text-right line-clamp-2"
                                      style={{
                                        color: isDarkMode
                                          ? "#cbd5e1"
                                          : "#4b5563",
                                      }}
                                    >
                                      {subject.description}
                                    </p>
                                  </div>
                                )}
                                {subject.code && (
                                  <div className="flex justify-between text-xs">
                                    <span className="opacity-70">Code:</span>
                                    <span className="text-right truncate max-w-[180px]">
                                      {subject.code}
                                    </span>
                                  </div>
                                )}
                                {subject.slug && (
                                  <div className="flex justify-between text-xs">
                                    <span className="opacity-70">Slug:</span>
                                    <span className="text-right truncate max-w-[180px]">
                                      {subject.slug}
                                    </span>
                                  </div>
                                )}
                                {typeof subject.credits === "number" && (
                                  <div className="flex justify-between text-xs">
                                    <span className="opacity-70">Credits:</span>
                                    <span className="text-right truncate max-w-[180px]">
                                      {subject.credits}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p
                                className="text-xs"
                                style={{
                                  color: isDarkMode ? "#9ca3af" : "#6b7280",
                                }}
                              >
                                Chưa có thông tin môn học
                              </p>
                            )}
                          </div>

                          {/* Info */}
                          <div>
                            <h2
                              className="text-xl font-semibold mb-3"
                              style={{
                                color: isDarkMode ? "#ffffff" : "#111827",
                              }}
                            >
                              Info
                            </h2>
                            <div className="space-y-2 text-xs">
                              {course.createdBy && (
                                <>
                                  <div className="flex justify-between">
                                    <span className="opacity-70">
                                      Created By:
                                    </span>
                                    <span className="text-right truncate max-w-[180px]">
                                      {course.createdBy.username}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="opacity-70">Email:</span>
                                    <span className="text-right truncate max-w-[180px]">
                                      {course.createdBy.email}
                                    </span>
                                  </div>
                                </>
                              )}
                              {course.createdAt && (
                                // <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto">
                                <div className="flex justify-between">
                                  <span className="opacity-70">Created:</span>
                                  <span className="text-right truncate max-w-[180px]">
                                    {new Date(
                                      course.createdAt
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                              {course.updatedAt && (
                                <div className="flex justify-between">
                                  <span className="opacity-70">Updated:</span>
                                  <span className="text-right truncate max-w-[180px]">
                                    {new Date(
                                      course.updatedAt
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mb-5">
                    {course.status && (
                      <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                        {course.status}
                      </span>
                    )}
                    {course.isPublished !== undefined && (
                      <span className="px-3 py-1 text-sm rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        {course.isPublished ? "Published" : "Unpublished"}
                      </span>
                    )}
                    {course.meta?.level && (
                      <span className="px-3 py-1 text-sm rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
                        Level: {course.meta.level}
                      </span>
                    )}
                    {course.meta?.duration && (
                      <span className="px-3 py-1 text-sm rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">
                        Duration: {course.meta.duration}
                      </span>
                    )}
                  </div>
                  {subject && (
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-semibold">Subject:</span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100 text-xs">
                          {subject.name}
                        </span>
                        {subject.code && (
                          <span className="px-2 py-1 rounded bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100 text-xs">
                            {subject.code}
                          </span>
                        )}
                        {typeof subject.credits === "number" && (
                          <span className="px-2 py-1 rounded bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100 text-xs">
                            {subject.credits} credits
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <p
                    className="text-base mb-4"
                    style={{ color: isDarkMode ? "#d1d5db" : "#374151" }}
                  >
                    {course.description}
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {startDate && (
                      <div className="flex items-center gap-2">
                        <span className="opacity-70">Start:</span>
                        <span>{startDate.toLocaleDateString()}</span>
                      </div>
                    )}
                    {endDate && (
                      <div className="flex items-center gap-2">
                        <span className="opacity-70">End:</span>
                        <span>{endDate.toLocaleDateString()}</span>
                      </div>
                    )}
                    {typeof course.capacity === "number" && (
                      <div className="flex items-center gap-2">
                        <span className="opacity-70">Capacity:</span>
                        <span>{course.capacity}</span>
                      </div>
                    )}
                    {course.enrollRequiresApproval !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="opacity-70">Enroll Approval:</span>
                        <span>
                          {course.enrollRequiresApproval ? "Required" : "Open"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs Navigation */}
            <div
              className="rounded-xl shadow-lg mb-8 overflow-hidden"
              style={{
                backgroundColor: isDarkMode ? "#0b132b" : "#ffffff",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <CourseTabsNavigation
                activeTab={activeTab}
                onTabChange={handleTabChange}
                darkMode={isDarkMode}
                quizCount={quizCount}
              />
              <div className="p-6">
                {activeTab === "lessons" && course?._id && (
                  <LessonsTab
                    courseId={course._id}
                    darkMode={isDarkMode}
                    courseTitle={course.title}
                  />
                )}
                {activeTab === "assignments" && course?._id && (
                  <AssignmentsTab
                    courseId={course._id}
                    darkMode={isDarkMode}
                    courseTitle={course.title}
                  />
                )}
                {activeTab === "attendance" && course?._id && (
                  <AttendanceTab
                    courseId={course._id}
                    darkMode={isDarkMode}
                    courseTitle={course.title}
                  />
                )}
                {activeTab === "quiz" && course?._id && (
                  <QuizTab
                    courseId={course._id}
                    darkMode={isDarkMode}
                    onQuizCountChange={setQuizCount}
                  />
                )}
                {activeTab === "schedule" && course?._id && (
                  <ScheduleTab courseId={course._id} darkMode={isDarkMode} />
                )}
                {activeTab === "static" && course?._id && (
                  <StaticCourseTab
                    courseId={course._id}
                    darkMode={isDarkMode}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="fixed bottom-4 left-0 right-0 pointer-events-none">
        <div className="max-w-[1200px] mx-auto px-4">
          <div
            className="pointer-events-auto rounded-xl shadow-lg border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 px-4 py-3"
            style={{
              backgroundColor: isDarkMode ? "#111827" : "#ffffff",
              borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "#e5e7eb",
            }}
          >
            {(() => {
              const role = user?.role as string | undefined;
              const showForTeacher =
                role === "teacher" && Boolean(course?.isTeacherOfCourse);
              const showForAdmin = role === "admin";
              const show = showForAdmin || showForTeacher;
              return show ? (
                <button
                  onClick={handleCompleteButtonClick}
                  disabled={completing || !course?._id}
                  className="bg-[#65e69b] text-white font-semibold px-4 py-2 rounded-lg hover:scale-105 transition disabled:opacity-50 w-full sm:w-auto"
                >
                  {course?.status === "completed"
                    ? "Completed"
                    : completing
                    ? "Completing..."
                    : "Complete Course"}
                </button>
              ) : null;
            })()}

            <div className="flex gap-2">
              {/* Enrollments button for teachers/admins */}
              {user?.role !== "student" && (
                <button
                  onClick={() => setShowEnrollmentModal(true)}
                  disabled={!course?._id}
                  className="relative bg-[#7c3aed] text-white font-semibold px-4 py-2 rounded-lg hover:scale-105 transition disabled:opacity-50 w-full sm:w-auto"
                >
                  Enrollments
                  {pendingEnrollmentCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                      {pendingEnrollmentCount > 99 ? "99+" : pendingEnrollmentCount}
                    </span>
                  )}
                </button>
              )}
              {user?.role === "student" ? null : (
                <button
                  onClick={openInviteModal}
                  disabled={!course?._id}
                  className="bg-[#525fe1] text-white font-semibold px-4 py-2 rounded-lg hover:scale-105 transition disabled:opacity-50 w-full sm:w-auto"
                >
                  Invite Students
                </button>
              )}

              <button
                onClick={handleViewForumList}
                className="bg-[#525fe1] text-white font-semibold px-4 py-2 rounded-lg hover:scale-105 transition disabled:opacity-50 w-full sm:w-auto"
              >
                View Forums
              </button>

              <button
                onClick={handleCreateForumPost}
                disabled={!course?._id}
                className="bg-[#ffcf59] text-[#1c1c1c] font-semibold px-4 py-2 rounded-lg hover:scale-105 transition disabled:opacity-50 w-full sm:w-auto"
              >
                Create Forum Post
              </button>
              {user?.role === "student" ? null : (
                <button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="bg-[#ffcf59] text-[#1c1c1c] font-semibold px-4 py-2 rounded-lg hover:scale-105 transition disabled:opacity-50 w-full sm:w-auto"
                >
                  {enrolling ? "Enrolling..." : "Enroll"}
                </button>
              )}
              <button
                onClick={() => navigate(-1)}
                className="bg-[#eaedff] text-[#1c1c1c] font-semibold px-4 py-2 rounded-lg hover:scale-105 transition w-full sm:w-auto"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (!inviting) setShowInviteModal(false);
            }}
          />
          <div
            className="relative w-full max-w-lg rounded-xl shadow-lg p-6"
            style={{
              backgroundColor: isDarkMode ? "#0b132b" : "#ffffff",
              border: isDarkMode
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid #e5e7eb",
            }}
          >
            <div
              className="text-2xl font-semibold mb-4"
              style={{ color: isDarkMode ? "#ffffff" : "#111827" }}
            >
              Invite Students
            </div>

            <div>
              <label className="text-sm mb-1 block">Email Student</label>
              <select
                value={userId}
                onChange={handleStudentSelect}
                className="w-full px-3 py-2 rounded-lg"
                style={{
                  backgroundColor: isDarkMode ? "#1f2937" : "#ffffff",
                  color: isDarkMode ? "#ffffff" : "#111827",
                  border: isDarkMode
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid #e5e7eb",
                }}
              >
                <option value="">Select student</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.fullname || u.username} - {u.email}
                  </option>
                ))}
              </select>
            </div>
            {inviteEmails.length > 0 && (
              <div
                className="mt-3 h-[150px] max-h-[150px] overflow-y-auto border rounded p-2"
                style={{
                  borderColor: isDarkMode
                    ? "rgba(255,255,255,0.08)"
                    : "#e5e7eb",
                }}
              >
                {inviteEmails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between px-2 py-2 border-b border-[#e5e7eb]"
                  >
                    <span
                      className="text-sm"
                      style={{ color: isDarkMode ? "#e5e7eb" : "#111827" }}
                    >
                      {email}
                    </span>
                    <button
                      onClick={() => removeInviteEmail(email)}
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        backgroundColor: isDarkMode ? "#111827" : "#f3f4f6",
                        border: isDarkMode
                          ? "1px solid rgba(255,255,255,0.08)"
                          : "1px solid #e5e7eb",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3">
              <label className="text-sm mb-1 block">Expires in days</label>
              <input
                type="number"
                min={1}
                value={expiresInDays}
                onChange={(e) =>
                  setExpiresInDays(parseInt(e.target.value) || 1)
                }
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  backgroundColor: isDarkMode ? "#1f2937" : "#ffffff",
                  color: isDarkMode ? "#ffffff" : "#111827",
                  border: isDarkMode
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid #e5e7eb",
                }}
              />
            </div>
            {inviteError && (
              <div className="text-sm text-red-500 mt-2">{inviteError}</div>
            )}
            <div className="flex justify-end gap-2 pt-3">
              <button
                onClick={() => setShowInviteModal(false)}
                disabled={inviting}
                className="px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: isDarkMode ? "#111827" : "#ffffff",
                  border: isDarkMode
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid #e5e7eb",
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitInvite}
                disabled={inviting || inviteEmails.length === 0}
                className="px-4 py-2 rounded-lg bg-[#525fe1] text-white disabled:opacity-50"
              >
                {inviting ? "Sending..." : "Send Invites"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showStatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowStatsModal(false)}
          />
          <div
            className="relative w-full max-w-2xl rounded-xl shadow-lg p-6"
            style={{
              backgroundColor: isDarkMode ? "#0b132b" : "#ffffff",
              border: isDarkMode
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid #e5e7eb",
            }}
          >
            <div
              className="text-2xl font-semibold mb-4"
              style={{ color: isDarkMode ? "#ffffff" : "#111827" }}
            >
              Course Statistics
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div
                className="rounded-lg p-4"
                style={{
                  backgroundColor: isDarkMode
                    ? "rgba(31,41,55,0.8)"
                    : "#f9fafb",
                  border: isDarkMode
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid #e5e7eb",
                }}
              >
                <div className="text-sm opacity-70">Total Students</div>
                <div className="text-xl font-bold">
                  {statsData?.course?.totalStudents ?? 0}
                </div>
              </div>
              <div
                className="rounded-lg p-4"
                style={{
                  backgroundColor: isDarkMode
                    ? "rgba(31,41,55,0.8)"
                    : "#f9fafb",
                  border: isDarkMode
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid #e5e7eb",
                }}
              >
                <div className="text-sm opacity-70">Total Lessons</div>
                <div className="text-xl font-bold">
                  {statsData?.course?.totalLessons ?? 0}
                </div>
              </div>
              <div
                className="rounded-lg p-4"
                style={{
                  backgroundColor: isDarkMode
                    ? "rgba(31,41,55,0.8)"
                    : "#f9fafb",
                  border: isDarkMode
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid #e5e7eb",
                }}
              >
                <div className="text-sm opacity-70">Total Quizzes</div>
                <div className="text-xl font-bold">
                  {statsData?.course?.totalQuizzes ?? 0}
                </div>
              </div>
              <div
                className="rounded-lg p-4"
                style={{
                  backgroundColor: isDarkMode
                    ? "rgba(31,41,55,0.8)"
                    : "#f9fafb",
                  border: isDarkMode
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid #e5e7eb",
                }}
              >
                <div className="text-sm opacity-70">Total Assignments</div>
                <div className="text-xl font-bold">
                  {statsData?.course?.totalAssignments ?? 0}
                </div>
              </div>
              <div
                className="rounded-lg p-4"
                style={{
                  backgroundColor: isDarkMode
                    ? "rgba(31,41,55,0.8)"
                    : "#f9fafb",
                  border: isDarkMode
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid #e5e7eb",
                }}
              >
                <div className="text-sm opacity-70">Total Attendances</div>
                <div className="text-xl font-bold">
                  {statsData?.course?.totalAttendances ?? 0}
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div
                className="rounded-lg p-4"
                style={{
                  backgroundColor: isDarkMode
                    ? "rgba(31,41,55,0.8)"
                    : "#f9fafb",
                  border: isDarkMode
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid #e5e7eb",
                }}
              >
                <div className="text-sm opacity-70">Average Final Grade</div>
                <div className="text-xl font-bold">
                  {statsData?.summary?.averageFinalGrade ?? 0}
                </div>
              </div>
              <div
                className="rounded-lg p-4"
                style={{
                  backgroundColor: isDarkMode
                    ? "rgba(31,41,55,0.8)"
                    : "#f9fafb",
                  border: isDarkMode
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid #e5e7eb",
                }}
              >
                <div className="text-sm opacity-70">Pass Rate</div>
                <div className="text-xl font-bold">
                  {statsData?.summary?.passRate ?? 0}%
                </div>
              </div>
              <div
                className="rounded-lg p-4"
                style={{
                  backgroundColor: isDarkMode
                    ? "rgba(31,41,55,0.8)"
                    : "#f9fafb",
                  border: isDarkMode
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid #e5e7eb",
                }}
              >
                <div className="text-sm opacity-70">Dropped Rate</div>
                <div className="text-xl font-bold">
                  {statsData?.summary?.droppedRate ?? 0}%
                </div>
              </div>
              <div
                className="rounded-lg p-4"
                style={{
                  backgroundColor: isDarkMode
                    ? "rgba(31,41,55,0.8)"
                    : "#f9fafb",
                  border: isDarkMode
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid #e5e7eb",
                }}
              >
                <div className="text-sm opacity-70">Average Attendance</div>
                <div className="text-xl font-bold">
                  {statsData?.summary?.averageAttendance ?? 0}%
                </div>
              </div>
              <div
                className="rounded-lg p-4"
                style={{
                  backgroundColor: isDarkMode
                    ? "rgba(31,41,55,0.8)"
                    : "#f9fafb",
                  border: isDarkMode
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid #e5e7eb",
                }}
              >
                <div className="text-sm opacity-70">Average Quiz Score</div>
                <div className="text-xl font-bold">
                  {statsData?.summary?.averageQuizScore ?? 0}
                </div>
              </div>
              <div
                className="rounded-lg p-4"
                style={{
                  backgroundColor: isDarkMode
                    ? "rgba(31,41,55,0.8)"
                    : "#f9fafb",
                  border: isDarkMode
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid #e5e7eb",
                }}
              >
                <div className="text-sm opacity-70">
                  Average Assignment Score
                </div>
                <div className="text-xl font-bold">
                  {statsData?.summary?.averageAssignmentScore ?? 0}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowStatsModal(false)}
                className="px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: isDarkMode ? "#111827" : "#ffffff",
                  border: isDarkMode
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid #e5e7eb",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enrollment List Modal */}
      {course?._id && (
        <EnrollmentListModal
          courseId={course._id}
          darkMode={isDarkMode}
          isOpen={showEnrollmentModal}
          onClose={() => setShowEnrollmentModal(false)}
          onEnrollmentChange={fetchPendingEnrollmentCount}
          userRole={user?.role as "admin" | "teacher" | "student" | undefined}
          courseStatus={course?.status}
        />
      )}
    </div>
  );
}
