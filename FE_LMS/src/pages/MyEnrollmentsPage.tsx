// FE_LMS/src/pages/MyEnrollmentsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../hooks/useAuth";
import Navbar from "../components/layout/Navbar.tsx";
import Sidebar from "../components/layout/Sidebar.tsx";
import http from "../utils/http";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

type EnrollmentItem = {
  _id: string;
  studentId: {
    _id: string;
    username: string;
    email: string;
    fullname?: string;
  };
  courseId: {
    _id: string;
    title: string;
    description?: string;
    isPublished?: boolean;
  };
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "cancelled"
    | "dropped"
    | "completed";
  method?: string;
  role?: string;
  progress?: { totalLessons: number; completedLessons: number };
  createdAt: string;
  updatedAt?: string;
  respondedAt?: string;
};

function statusColors(s?: string, dark?: boolean) {
  switch (s) {
    case "approved":
      return dark
        ? "bg-green-900 text-green-100"
        : "bg-green-100 text-green-800";
    case "pending":
      return dark
        ? "bg-yellow-900 text-yellow-100"
        : "bg-yellow-100 text-yellow-800";
    case "rejected":
      return dark ? "bg-red-900 text-red-100" : "bg-red-100 text-red-800";
    case "cancelled":
      return dark ? "bg-gray-800 text-gray-100" : "bg-gray-100 text-gray-800";
    case "dropped":
      return dark ? "bg-rose-900 text-rose-100" : "bg-rose-100 text-rose-800";
    case "completed":
      return dark ? "bg-blue-900 text-blue-100" : "bg-blue-100 text-blue-800";
    default:
      return dark
        ? "bg-slate-800 text-slate-100"
        : "bg-slate-100 text-slate-800";
  }
}

const MyEnrollmentsPage: React.FC = () => {
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const [items, setItems] = useState<EnrollmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  const fetchMyEnrollments = async () => {
    try {
      setLoading(true);
      const res = await http.get("/enrollments/my-enrollments", {
        params: { page, limit },
      });
      const dataAny: any = res as any;
      const list: EnrollmentItem[] = Array.isArray(dataAny?.data)
        ? dataAny.data
        : Array.isArray(dataAny?.data?.data)
        ? dataAny.data.data
        : Array.isArray(dataAny)
        ? dataAny
        : [];
      const pagination: any = dataAny?.pagination || dataAny?.meta?.pagination;
      setItems(list);
      setTotal(pagination?.total ?? list.length);
      setError("");
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || e?.message || "Không thể tải enrollments";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyEnrollments();
  }, [page, limit]);

  const handleCancel = async (id: string) => {
    setUpdating((prev) => ({ ...prev, [id]: true }));
    try {
      await http.put(`/enrollments/my-enrollments/${id}`, {
        status: "cancelled",
      });
      setItems((prev) =>
        prev.map((it) =>
          it._id === id
            ? {
                ...it,
                status: "cancelled",
                updatedAt: new Date().toISOString(),
              }
            : it
        )
      );
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Cancel enrollment successfully",
        showConfirmButton: false,
        timer: 2000,
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || e?.message || "Cancel enrollment failed";
      setError(msg);
    } finally {
      setUpdating((prev) => ({ ...prev, [id]: false }));
    }
  };

  const openCancelModal = (id: string) => {
    setCancelTargetId(id);
    setShowCancelModal(true);
  };

  const totalPages = useMemo(() => {
    if (!limit) return 1;
    return Math.max(1, Math.ceil(total / limit));
  }, [total, limit]);

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{
        backgroundColor: darkMode ? "#0f172a" : "#f8fafc",
        color: darkMode ? "#ffffff" : "#0f172a",
      }}
    >
      <Navbar />
      <Sidebar role={(user?.role as any) || "student"} />
      <div className="max-w-[1200px] mt-[100px] mx-auto px-4 sm:pl-[93px] py-6">
        <h1
          className="text-2xl font-semibold mb-6"
          style={{ color: darkMode ? "#ffffff" : "#111827" }}
        >
          My Enrollments
        </h1>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={limit}
              onChange={(e) => {
                setPage(1);
                setLimit(Number(e.target.value));
              }}
              className="px-3 py-2 rounded-lg w-full sm:w-auto"
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-2 rounded-lg disabled:opacity-50 flex items-center gap-1 w-full sm:w-auto"
              style={{
                backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                color: darkMode ? "#ffffff" : "#111827",
                border: darkMode
                  ? "1px solid rgba(255,255,255,0.08)"
                  : "1px solid #e5e7eb",
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <span
              className="text-sm"
              style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
            >
              Page {page}/{totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-2 rounded-lg disabled:opacity-50 flex items-center gap-1 w-full sm:w-auto"
              style={{
                backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                color: darkMode ? "#ffffff" : "#111827",
                border: darkMode
                  ? "1px solid rgba(255,255,255,0.08)"
                  : "1px solid #e5e7eb",
              }}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => {
                if (!cancelTargetId || !updating[cancelTargetId as string]) {
                  setShowCancelModal(false);
                  setCancelTargetId(null);
                }
              }}
            />
            <div
              className="relative w-full max-w-md rounded-xl shadow-lg p-6"
              style={{
                backgroundColor: darkMode ? "#0b132b" : "#ffffff",
                border: darkMode
                  ? "1px solid rgba(255,255,255,0.08)"
                  : "1px solid #e5e7eb",
              }}
            >
              <div
                className="text-lg font-semibold mb-2"
                style={{ color: darkMode ? "#ffffff" : "#111827" }}
              >
                {items.find((it) => it._id === cancelTargetId)?.status ===
                "pending"
                  ? "Confirm Cancel Enrollment"
                  : "Confirm Withdraw Enrollment"}
              </div>
              <div
                className="text-sm mb-4"
                style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
              >
                {items.find((it) => it._id === cancelTargetId)?.status ===
                "pending"
                  ? "Are you sure you want to cancel this enrollment?"
                  : "Are you sure you want to withdraw from this course?"}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelTargetId(null);
                  }}
                  disabled={
                    !!(cancelTargetId && updating[cancelTargetId as string])
                  }
                  className="px-4 py-2 rounded-lg"
                  style={{
                    backgroundColor: darkMode ? "#111827" : "#ffffff",
                    border: darkMode
                      ? "1px solid rgba(255,255,255,0.08)"
                      : "1px solid #e5e7eb",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (cancelTargetId) {
                      await handleCancel(cancelTargetId);
                    }
                    setShowCancelModal(false);
                    setCancelTargetId(null);
                  }}
                  disabled={
                    !cancelTargetId ||
                    !!(cancelTargetId && updating[cancelTargetId as string])
                  }
                  className="px-4 py-2 rounded-lg bg-[#ef4444] text-white disabled:opacity-50"
                >
                  {items.find((it) => it._id === cancelTargetId)?.status ===
                  "pending"
                    ? "Confirm Cancel"
                    : "Confirm Withdraw"}
                </button>
              </div>
            </div>
          </div>
        )}

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
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="w-24 h-24 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: darkMode ? "#6b7280" : "#9ca3af" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            <h3
              className="text-xl font-semibold mb-2"
              style={{ color: darkMode ? "#ffffff" : "#1f2937" }}
            >
              No enrollments
            </h3>
            <p style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}>
              You have no enrollments yet
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {items.map((en) => {
              const progress = en.progress || {
                totalLessons: 0,
                completedLessons: 0,
              };
              const pct =
                progress.totalLessons > 0
                  ? Math.round(
                      (progress.completedLessons / progress.totalLessons) * 100
                    )
                  : 0;
              return (
                <div
                  key={en._id}
                  className="rounded-lg p-5 flex flex-col sm:flex-row gap-4 items-start"
                  style={{
                    backgroundColor: darkMode
                      ? "rgba(31, 41, 55, 0.85)"
                      : "#ffffff",
                    border: darkMode
                      ? "1px solid rgba(255,255,255,0.08)"
                      : "1px solid #e5e7eb",
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${statusColors(
                          en.status,
                          darkMode
                        )}`}
                      >
                        {en.status}
                      </span>
                      {en.method && (
                        <span
                          className="px-2 py-1 text-xs font-semibold rounded"
                          style={{
                            backgroundColor: darkMode
                              ? "rgba(99, 102, 241, 0.2)"
                              : "#eef2ff",
                            color: darkMode ? "#a5b4fc" : "#4f46e5",
                          }}
                        >
                          {en.method}
                        </span>
                      )}
                    </div>
                    <Link
                      to={`/courses/${en.courseId?._id}`}
                      className="text-lg font-semibold hover:underline"
                      style={{ color: darkMode ? "#60a5fa" : "#2563eb" }}
                    >
                      {en.courseId?.title}
                    </Link>
                    {en.courseId?.description && (
                      <p
                        className="text-sm mt-1 break-words"
                        style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                      >
                        {en.courseId?.description}
                      </p>
                    )}

                    <div className="mt-3">
                      <div
                        className="h-2 rounded-full overflow-hidden"
                        style={{
                          backgroundColor: darkMode
                            ? "rgba(255,255,255,0.1)"
                            : "#e5e7eb",
                        }}
                      >
                        <div
                          className="h-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: darkMode ? "#22c55e" : "#16a34a",
                          }}
                        />
                      </div>
                      <div
                        className="text-xs mt-1"
                        style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                      >
                        Progress: {progress.completedLessons}/
                        {progress.totalLessons} ({pct}%)
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap sm:mt-0 mt-2">
                    <button
                      onClick={() => openCancelModal(en._id)}
                      disabled={
                        updating[en._id] ||
                        en.status === "cancelled" ||
                        en.status === "dropped" ||
                        en.status === "completed" ||
                        en.status === "rejected"
                      }
                      className="px-3 py-2 rounded-lg text-sm disabled:opacity-50"
                      style={{
                        backgroundColor: darkMode
                          ? "rgba(239, 68, 68, 0.2)"
                          : "#fee2e2",
                        color: darkMode ? "#fca5a5" : "#dc2626",
                        border: darkMode
                          ? "1px solid rgba(255,255,255,0.08)"
                          : "1px solid #fecaca",
                      }}
                    >
                      {updating[en._id]
                        ? en.status === "pending"
                          ? "Cancelling..."
                          : "Withdrawing..."
                        : en.status === "pending"
                        ? "Cancel"
                        : "Withdraw"}
                    </button>
                    <div
                      className="text-sm"
                      style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                    >
                      {new Date(en.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyEnrollmentsPage;
