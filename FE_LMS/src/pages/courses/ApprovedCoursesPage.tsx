import React, { useEffect, useState } from "react";
import Navbar from "../../components/layout/Navbar.tsx";
import Sidebar from "../../components/layout/Sidebar.tsx";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import { courseService } from "../../services";
import type { Course } from "../../types/course";
import useDebounce from "../../hooks/useDebounce";
import { ChevronLeft, ChevronRight, RefreshCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ApprovedCoursesPage: React.FC = () => {
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [restoring, setRestoring] = useState<Record<string, boolean>>({});

  const fetchWaitingApproveCourses = async () => {
    try {
      setLoading(true);
      const { courses: list, pagination } = await courseService.getAllCourses({
        isPublished: false,
        page: currentPage,
        limit: pageLimit,
        ...(debouncedSearchTerm ? { search: debouncedSearchTerm } : {}),
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      const items = Array.isArray(list) ? list : [];
      setCourses(items);
      const pg: any = pagination;
      const totalCount =
        (pg && (pg.total ?? pg.totalItems ?? pg.count)) ?? items.length;
      setTotal(totalCount);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Failed to load courses waiting approval");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaitingApproveCourses();
  }, [currentPage, pageLimit, debouncedSearchTerm]);

  const handleApprove = async (id: string) => {
    setRestoring((prev) => ({ ...prev, [id]: true }));
    try {
      await courseService.updateCourse(id, { isPublished: true });
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Course approved successfully",
        showConfirmButton: false,
        timer: 2000,
      });
      navigate("/courses");
    } catch (e: any) {
      const message =
        e?.response?.data?.message || e?.message || "Approve failed";
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: message,
        showConfirmButton: false,
        timer: 2500,
      });
    } finally {
      setRestoring((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{
        backgroundColor: darkMode ? "#0f172a" : "#f8fafc",
        color: darkMode ? "#ffffff" : "#0f172a",
      }}
    >
      <Navbar />
      <Sidebar
        role={(user?.role as "admin" | "teacher" | "student") || "admin"}
      />
      <div className="max-w-[1200px] mt-[100px] mx-auto px-4 sm:pl-[93px] py-6">
        <div className="flex items-center justify-between mb-6">
          <h1
            className="text-2xl font-semibold"
            style={{ color: darkMode ? "#ffffff" : "#111827" }}
          >
            Courses Waiting Approval
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/courses")}
              className="px-3 py-2 rounded-lg font-semibold flex items-center gap-2"
              style={{
                backgroundColor: darkMode ? "#111827" : "#ffffff",
                color: darkMode ? "#ffffff" : "#111827",
                border: darkMode
                  ? "1px solid rgba(255,255,255,0.08)"
                  : "1px solid #e5e7eb",
              }}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={fetchWaitingApproveCourses}
              className="px-3 py-2 rounded-lg font-semibold flex items-center gap-2"
              style={{
                backgroundColor: darkMode ? "#111827" : "#ffffff",
                color: darkMode ? "#ffffff" : "#111827",
                border: darkMode
                  ? "1px solid rgba(255,255,255,0.08)"
                  : "1px solid #e5e7eb",
              }}
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title or description"
            className="px-3 py-2 rounded-lg outline-none flex-1"
            style={{
              backgroundColor: darkMode ? "#1f2937" : "#ffffff",
              color: darkMode ? "#ffffff" : "#111827",
              border: darkMode
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid #e5e7eb",
            }}
          />
          <select
            value={pageLimit}
            onChange={(e) => {
              setCurrentPage(1);
              setPageLimit(Number(e.target.value));
            }}
            className="ml-3 px-3 py-2 rounded-lg"
            style={{
              backgroundColor: darkMode ? "#1f2937" : "#ffffff",
              color: darkMode ? "#ffffff" : "#111827",
              border: darkMode
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid #e5e7eb",
            }}
          >
            {[10, 20, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div
              className="animate-spin rounded-full h-12 w-12 border-b-2"
              style={{ borderColor: darkMode ? "#6366f1" : "#4f46e5" }}
            />
          </div>
        ) : error ? (
          <div
            className="p-4 rounded-lg mb-6"
            style={{
              backgroundColor: darkMode ? "rgba(239, 68, 68, 0.1)" : "#fee2e2",
              color: darkMode ? "#fca5a5" : "#dc2626",
            }}
          >
            {error}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {courses.map((course) => (
                <div
                  key={course._id}
                  className="group rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col"
                  style={{
                    backgroundColor: darkMode ? "#0b132b" : "#ffffff",
                    border: darkMode
                      ? "1px solid rgba(255,255,255,0.08)"
                      : "1px solid #e5e7eb",
                    minHeight: 340,
                  }}
                >
                  <div className="h-40 w-full bg-gradient-to-br from-indigo-200 via-purple-200 to-pink-200 dark:from-indigo-900 dark:via-purple-900 dark:to-pink-900">
                    <img
                      src={
                        (course as any).logo ||
                        "https://api.dicebear.com/9.x/shapes/svg?seed=" +
                          encodeURIComponent(course.title || "course")
                      }
                      alt={course.title || "Course"}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src =
                          "https://api.dicebear.com/9.x/shapes/svg?seed=" +
                          encodeURIComponent(course.title || "course");
                      }}
                    />
                  </div>
                  <div className="p-6 flex flex-col flex-1">
                    <h3
                      className="text-xl font-bold mb-2"
                      style={{ color: darkMode ? "#ffffff" : "#1f2937" }}
                    >
                      {course.title}
                    </h3>
                    {course.description && (
                      <p
                        className="text-sm line-clamp-2 mb-4"
                        style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                      >
                        {course.description}
                      </p>
                    )}
                    <div
                      className="flex items-center justify-between pt-4 border-t mt-auto"
                      style={{
                        borderColor: darkMode
                          ? "rgba(75, 85, 99, 0.3)"
                          : "#e5e7eb",
                      }}
                    >
                      <button
                        onClick={() => handleApprove(course._id)}
                        disabled={!!restoring[course._id]}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                      >
                        <RefreshCcw className="w-4 h-4" />
                        {restoring[course._id] ? "Approving..." : "Approve"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-4 py-4 mt-2">
              <div
                className="text-sm"
                style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
              >
                Total: {total}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: darkMode ? "#111827" : "#ffffff",
                    border: darkMode
                      ? "1px solid rgba(255,255,255,0.08)"
                      : "1px solid #e5e7eb",
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm">
                  {currentPage} / {Math.max(1, Math.ceil(total / pageLimit))}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: darkMode ? "#111827" : "#ffffff",
                    border: darkMode
                      ? "1px solid rgba(255,255,255,0.08)"
                      : "1px solid #e5e7eb",
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ApprovedCoursesPage;
