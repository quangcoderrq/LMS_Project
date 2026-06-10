import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import AverageRating from "../../components/courses/AverageRating";
import MarkdownContent from "../../components/markdown/MarkdownContent";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { feedbackService } from "../../services/feedbackService";
import type { Feedback, FeedbackMeta, FeedbackPagination } from "../../types/feedback";

function formatDate(value: string, timezone?: string) {
  try {
    const options: Intl.DateTimeFormatOptions = {
      dateStyle: "medium",
      timeStyle: "short",
    };

    if (timezone) {
      options.timeZone = timezone;
    }

    return new Intl.DateTimeFormat("vi-VN", options).format(new Date(value));
  } catch {
    return value;
  }
}

function getInitials(value?: string) {
  if (!value) return "?";
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

const PAGE_SIZE = 5;
const PREVIEW_CHAR_LIMIT = 500;

export default function FeedbackList() {
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const isStudent = user?.role === "student";
  const canCreateFeedback = !isAdmin;
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [pagination, setPagination] = useState<FeedbackPagination | undefined>();
  const [meta, setMeta] = useState<FeedbackMeta | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"system" | "teacher">("system");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedFeedbackIds, setExpandedFeedbackIds] = useState<Record<string, boolean>>({});
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt?: string } | null>(null);

  const fetchFeedbacks = useCallback(async (page: number, type: "system" | "teacher", from?: string, to?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params: { page: number; limit: number; type: "system" | "teacher"; from?: string; to?: string } = {
        page,
        limit: PAGE_SIZE,
        type,
      };
      if (from) params.from = from;
      if (to) params.to = to;
      
      const response = await feedbackService.getFeedbacks(params);
      setFeedbacks(response.feedbacks);
      setPagination(response.pagination);
      setMeta(response.meta);
    } catch (err) {
      console.error(err);
      setError("Unable to load feedbacks. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await feedbackService.deleteFeedback(id);
      await fetchFeedbacks(currentPage, activeFilter, dateFrom || undefined, dateTo || undefined);
    } catch (err) {
      console.error(err);
      setError("Failed to delete feedback. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const closeDeleteModal = () => {
    setConfirmDeleteId(null);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    await handleDelete(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  useEffect(() => {
    void fetchFeedbacks(currentPage, activeFilter, dateFrom || undefined, dateTo || undefined);
  }, [currentPage, activeFilter, fetchFeedbacks]);

  const handleDateSearch = () => {
    setCurrentPage(1);
    void fetchFeedbacks(1, activeFilter, dateFrom || undefined, dateTo || undefined);
  };

  const handleClearDateFilter = () => {
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
    void fetchFeedbacks(1, activeFilter);
  };

 

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((fb) => {
      if (activeFilter === "teacher") {
        return fb.type === "teacher";
      }
      return fb.type === "system";
    });
  }, [feedbacks, activeFilter]);

  const summary = useMemo(() => {
    if (!filteredFeedbacks.length) return null;
    const count = filteredFeedbacks.length;
    const average =
      filteredFeedbacks.reduce((acc, fb) => acc + (fb.rating || 0), 0) / Math.max(count, 1);
    const byType = filteredFeedbacks.reduce<Record<string, number>>((acc, fb) => {
      acc[fb.type] = (acc[fb.type] || 0) + 1;
      return acc;
    }, {});
    return { count, average: Number(average.toFixed(1)), byType };
  }, [filteredFeedbacks]);

  const pageNumbers = useMemo(() => {
    if (!pagination) return [];
    const maxButtons = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(pagination.totalPages, start + maxButtons - 1);
    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1);
    }
    const pages: number[] = [];
    for (let number = start; number <= end; number += 1) {
      pages.push(number);
    }
    return pages;
  }, [pagination, currentPage]);

  const handleImagePreview = useCallback((payload: { src: string; alt?: string }) => {
    setLightboxImage(payload);
  }, []);

  const handlePageChange = (page: number) => {
    if (!pagination) return;
    if (page < 1 || page > pagination.totalPages || page === currentPage) return;
    setCurrentPage(page);
  };

  const filterOptions = [
    { value: "system", label: "System", helper: "Platform related" },
    { value: "teacher", label: "Lecturer", helper: "Lecturer related" },
  ] as const;

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{
        backgroundColor: darkMode ? "#0b1220" : "#f5f7fb",
        color: darkMode ? "#e5e7eb" : "#1f2937",
      }}
    >
      <Navbar />
      <Sidebar role={(user?.role as "admin" | "teacher" | "student") || "student"} />
      <main className="flex-1 overflow-y-auto pt-24 px-6 sm:px-10">
        <style>
          {`
            @keyframes fadeUp {
              from { opacity: 0; transform: translateY(12px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes floaty {
              0% { transform: translateY(0); }
              50% { transform: translateY(-6px); }
              100% { transform: translateY(0); }
            }
            @keyframes shimmerBar {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
            @keyframes pulseRing {
              0% { box-shadow: 0 0 0 0 rgba(82, 95, 225, 0.45); }
              70% { box-shadow: 0 0 0 16px rgba(82, 95, 225, 0); }
              100% { box-shadow: 0 0 0 0 rgba(82, 95, 225, 0); }
            }
            @keyframes ratingGlow {
              0% { box-shadow: 0 5px 18px rgba(250, 204, 21, 0.25); transform: translateY(0); }
              50% { box-shadow: 0 8px 24px rgba(251, 191, 36, 0.45); transform: translateY(-1px); }
              100% { box-shadow: 0 5px 18px rgba(250, 204, 21, 0.25); transform: translateY(0); }
            }
            @keyframes starPulse {
              0% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(251,191,36,0.45)); }
              50% { transform: scale(1.12); filter: drop-shadow(0 0 6px rgba(251,191,36,0.65)); }
              100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(251,191,36,0.45)); }
            }
            .rating-pill {
              background-image: linear-gradient(120deg, #facc15, #f97316);
              color: #78350f;
              padding: 0.35rem 0.8rem;
              border-radius: 999px;
              box-shadow: 0 5px 18px rgba(250, 204, 21, 0.25);
              animation: ratingGlow 3s ease-in-out infinite;
            }
            .rating-pill svg {
              animation: starPulse 2.8s ease-in-out infinite;
            }
            @keyframes infoGlow {
              0% { opacity: 0.85; transform: translateY(0); }
              50% { opacity: 1; transform: translateY(-1px); }
              100% { opacity: 0.85; transform: translateY(0); }
            }
            .info-line {
              color: #1d4ed8;
              animation: infoGlow 5s ease-in-out infinite;
            }
            .info-chip {
              background: rgba(59,130,246,0.08);
              border: 1px solid rgba(59,130,246,0.25);
              padding: 0.35rem 0.75rem;
              border-radius: 999px;
              color: inherit;
              display: inline-flex;
              align-items: center;
              gap: 0.25rem;
            }
            .fade-up { animation: fadeUp 400ms ease forwards; }
            .float-card { animation: floaty 6s ease-in-out infinite; }
            .shimmer-line {
              position: relative;
              overflow: hidden;
            }
            .shimmer-line::after {
              content: "";
              position: absolute;
              inset: 0;
              background-image: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%);
              background-size: 200% 100%;
              animation: shimmerBar 2s linear infinite;
            }
            .pulse-button {
              animation: pulseRing 2.4s ease-out infinite;
            }
            .pulse-button::after {
              content: "";
              position: absolute;
              inset: 0;
              border-radius: inherit;
              background-image: linear-gradient(135deg, rgba(255,255,255,0.2), transparent);
              opacity: 0;
              transition: opacity 200ms ease;
            }
            .pulse-button:hover::after {
              opacity: 1;
            }
            .click-animate {
              position: relative;
              overflow: hidden;
              transition: transform 200ms ease, box-shadow 200ms ease;
            }
            .click-animate:hover {
              transform: translateY(-1px);
            }
            .click-animate:active {
              transform: translateY(1px) scale(0.98);
            }
            .click-animate::after {
              content: "";
              position: absolute;
              top: 50%;
              left: 50%;
              width: 0;
              height: 0;
              background: radial-gradient(circle, rgba(255,255,255,0.8) 10%, transparent 60%);
              transform: translate(-50%, -50%);
              opacity: 0;
            }
            .click-animate:active::after {
              animation: ripple 500ms ease-out;
            }
            @keyframes ripple {
              0% {
                width: 0;
                height: 0;
                opacity: 0.35;
              }
              100% {
                width: 260px;
                height: 260px;
                opacity: 0;
              }
            }
            @keyframes deleteGlow {
              0% { box-shadow: 0 0 0 rgba(248,113,113,0.45); }
              70% { box-shadow: 0 0 18px rgba(248,113,113,0.5); }
              100% { box-shadow: 0 0 0 rgba(248,113,113,0); }
            }
            .delete-button {
              animation: deleteGlow 2.2s ease-in-out infinite;
            }
            @keyframes modalFade {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes modalScale {
              from { opacity: 0; transform: translateY(12px) scale(0.96); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .modal-backdrop {
              animation: modalFade 180ms ease-out forwards;
            }
            .modal-content {
              animation: modalScale 220ms ease-out forwards;
            }
            @keyframes starPop {
              0% { transform: scale(0.4); opacity: 0; }
              70% { transform: scale(1.2); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            .rating-star {
              width: 18px;
              height: 18px;
              transform-origin: center;
              opacity: 0.25;
            }
            .rating-star--active {
              opacity: 1;
              animation: starPop 380ms ease forwards;
            }
          `}
        </style>
        <div className="max-w-5xl mx-auto">
          <div
            className="h-1.5 w-24 rounded-full mb-4 shimmer-line"
            style={{
              background: "linear-gradient(90deg, #525fe1, #7c3aed, #14b8a6)",
              backgroundSize: "200% 100%",
            }}
          />
          <div className="flex items-center justify-between mb-6 fade-up" style={{ animationDelay: "60ms" }}>
            <div>
              <p className="text-sm uppercase tracking-wide text-indigo-400 font-semibold">
                Feedback Center
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold mt-1">Feedback overview</h1>
              <p className="text-sm mt-1" style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}>
              Review the latest suggestions from learners and spot trends quickly.
              </p>
            </div>
              <div className="flex gap-3 flex-wrap justify-end items-center">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-3 py-2 rounded-full font-semibold border transition-all pulse-button relative click-animate flex items-center justify-center"
                  style={{
                    background: darkMode ? "rgba(30,41,59,0.85)" : "rgba(226,232,255,0.8)",
                    color: darkMode ? "#e0e7ff" : "#4338ca",
                    borderColor: darkMode ? "rgba(148,163,184,0.5)" : "rgba(99,102,241,0.35)",
                    width: "48px",
                    height: "40px",
                  }}
                  aria-label="Go back"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-4 h-4"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              {canCreateFeedback && (
                <button
                  type="button"
                  onClick={() => navigate("/help/feedback")}
                  className="px-4 py-2 rounded-xl font-semibold border border-transparent transition-all hover:-translate-y-0.5 click-animate"

                  style={{
                    background: "linear-gradient(135deg, #525fe1 0%, #7c3aed 100%)",
                    color: "#fff",
                  }}
                
                >
                  Create new feedback
                </button>
              )}
              <button
                type="button"
                onClick={() => void fetchFeedbacks(currentPage, activeFilter, dateFrom || undefined, dateTo || undefined)}
                className="px-4 py-2 rounded-xl font-semibold border border-transparent transition-all hover:-translate-y-0.5 click-animate"

                style={{
                  background: darkMode ? "#1f2937" : "#eef2ff",
                  color: darkMode ? "#e5e7eb" : "#4338ca",
                }}
                disabled={loading}
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>

          {/* Date Range Search Section */}
          <section
            className="rounded-2xl shadow-lg p-6 mb-6 fade-up"
            style={{
              animationDelay: "75ms",
              background: darkMode ? "rgba(17, 24, 39, 0.8)" : "#fff",
              border: "1px solid rgba(148, 163, 184, 0.2)",
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: darkMode ? "#cbd5f5" : "#0f172a" }}>
                  Search by Date Range
                </p>
                <p className="text-xs" style={{ color: darkMode ? "#94a3b8" : "#6b7280" }}>
                  Filter feedbacks from a specific time period
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: darkMode ? "#cbd5e1" : "#374151" }}>
                  From Date
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border transition-all focus:outline-none"
                  style={{
                    backgroundColor: darkMode ? "rgba(15,23,42,0.7)" : "#ffffff",
                    borderColor: darkMode ? "rgba(148,163,184,0.3)" : "rgba(148,163,184,0.5)",
                    color: darkMode ? "#e5e7eb" : "#1f2937",
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: darkMode ? "#cbd5e1" : "#374151" }}>
                  To Date
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom || undefined}
                  className="w-full px-4 py-2 rounded-xl border transition-all focus:outline-none"
                  style={{
                    backgroundColor: darkMode ? "rgba(15,23,42,0.7)" : "#ffffff",
                    borderColor: darkMode ? "rgba(148,163,184,0.3)" : "rgba(148,163,184,0.5)",
                    color: darkMode ? "#e5e7eb" : "#1f2937",
                  }}
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={handleDateSearch}
                  disabled={loading || (!dateFrom && !dateTo)}
                  className="flex-1 px-4 py-2 rounded-xl font-semibold border border-transparent transition-all hover:-translate-y-0.5 click-animate disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #525fe1 0%, #7c3aed 100%)",
                    color: "#fff",
                  }}
                >
                  Search
                </button>
              </div>
              <div className="flex items-end">
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={handleClearDateFilter}
                    className="w-full px-4 py-2 rounded-xl font-semibold border transition-all hover:-translate-y-0.5 click-animate"
                    style={{
                      background: darkMode ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.1)",
                      color: darkMode ? "#fca5a5" : "#dc2626",
                      borderColor: darkMode ? "rgba(239,68,68,0.3)" : "rgba(239,68,68,0.4)",
                    }}
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>
            {(dateFrom || dateTo) && (
              <div className="mt-3">
                <span className="text-xs px-3 py-1 rounded-full" style={{ 
                  background: darkMode ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.12)", 
                  color: darkMode ? "#6ee7b7" : "#059669" 
                }}>
                  Filtering: {dateFrom ? `From ${dateFrom}` : ""} {dateFrom && dateTo ? "to" : ""} {dateTo ? `To ${dateTo}` : ""}
                </span>
              </div>
            )}
          </section>

          <section
            className="rounded-2xl shadow-lg p-6 mb-6 fade-up"
            style={{
              animationDelay: "90ms",
              background: darkMode ? "rgba(17, 24, 39, 0.8)" : "#fff",
              border: "1px solid rgba(148, 163, 184, 0.2)",
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-sm font-semibold" style={{ color: darkMode ? "#cbd5f5" : "#0f172a" }}>
                  Feedback and reviews
                </p>
                <p className="text-xs" style={{ color: darkMode ? "#94a3b8" : "#6b7280" }}>
                  Choose a response type
                </p>
              </div>
                    <span className="text-xs px-3 py-1 rounded-full" style={{ background: darkMode ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.12)", color: darkMode ? "#bfdbfe" : "#1d4ed8" }}>
                Showing {activeFilter === "system" ? "System" : "Lecturer"} feedback
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {filterOptions.map((option) => {
                const isActive = activeFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setActiveFilter(option.value);
                      setCurrentPage(1);
                    }}
                            className="text-left rounded-2xl border px-4 py-3 transition-all focus:outline-none click-animate"
                    style={{
                      borderColor: isActive
                        ? "rgba(59,130,246,0.5)"
                        : darkMode
                          ? "rgba(148,163,184,0.3)"
                          : "rgba(148,163,184,0.5)",
                      background: isActive
                        ? "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(14,165,233,0.1))"
                        : darkMode
                          ? "rgba(15,23,42,0.7)"
                          : "rgba(248,250,252,0.9)",
                      boxShadow: isActive ? "0 12px 30px rgba(59,130,246,0.15)" : "none",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full border flex items-center justify-center"
                        style={{
                          borderColor: isActive ? "#2563eb" : "rgba(148,163,184,0.7)",
                          background: isActive ? "#2563eb" : "transparent",
                        }}
                      >
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <span className="font-semibold">{option.label}</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: darkMode ? "#94a3b8" : "#6b7280" }}>
                      {option.helper}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {summary && (
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 fade-up" style={{ animationDelay: "120ms" }}>
              <div
                className="rounded-2xl p-4 shadow float-card"
                style={{ background: darkMode ? "rgba(17,24,39,0.8)" : "#fff" }}
              >
                <p className="text-xs uppercase tracking-wide text-gray-400">Total feedback</p>
                <p className="text-2xl font-bold mt-2">{summary.count}</p>
              </div>
              {activeFilter === "system" ? (
                <AverageRating />
              ) : (
                <div
                  className="rounded-2xl p-4 shadow float-card"
                  style={{ background: darkMode ? "rgba(17,24,39,0.8)" : "#fff" }}
                >
                  <p className="text-xs uppercase tracking-wide text-gray-400">Average rating</p>
                  <p className="text-2xl font-bold mt-2">{summary.average}/5</p>
                </div>
              )}
              <div
                className="rounded-2xl p-4 shadow float-card"
                style={{ background: darkMode ? "rgba(17,24,39,0.8)" : "#fff" }}
              >
                <p className="text-xs uppercase tracking-wide text-gray-400">By type</p>
                <div className="flex flex-wrap gap-2 mt-2 text-sm">
                  {Object.entries(summary.byType).map(([type, count]) => (
                    <span
                      key={type}
                      className="px-3 py-1 rounded-full"
                      style={{
                        background: darkMode ? "rgba(79,70,229,0.15)" : "rgba(79,70,229,0.1)",
                        color: darkMode ? "#c7d2fe" : "#4338ca",
                      }}
                    >
                      {type}: {count}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          )}

          <section
            className="rounded-2xl shadow-lg p-6 space-y-4 fade-up"
            style={{
              animationDelay: "180ms",
              background: darkMode ? "rgba(17, 24, 39, 0.8)" : "rgba(255,255,255,0.95)",
              border: "1px solid rgba(148, 163, 184, 0.15)",
              backdropFilter: "blur(8px)",
            }}
          >
            {error && (
              <div className="p-3 rounded-lg text-sm" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                {error}
              </div>
            )}

            {loading && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="animate-pulse h-20 rounded-xl"
                    style={{ background: darkMode ? "rgba(30,41,59,0.7)" : "#f3f4f6" }}
                  />
                ))}
              </div>
            )}

            {!loading && filteredFeedbacks.length === 0 && (
              <div className="text-center py-12">
                <p className="text-lg font-semibold">No feedback yet.</p>
                <p className="text-sm mt-2" style={{ color: darkMode ? "#94a3b8" : "#6b7280" }}>
                  {activeFilter === "system"
                    ? "Chưa có phản hồi hệ thống nào trong nhóm này."
                    : "Chưa có phản hồi dành cho giảng viên trong nhóm này."}
                </p>
                {canCreateFeedback && (
                  <button
                    type="button"
                    onClick={() => navigate("/help/feedback")}
                    className="mt-4 px-4 py-2 rounded-xl font-semibold border border-transparent transition-all hover:-translate-y-0.5 click-animate"
                    style={{
                      background: darkMode ? "#1f2937" : "#eef2ff",
                      color: darkMode ? "#e5e7eb" : "#4338ca",
                    }}
                  >
                    Create new feedback
                  </button>
                )}
              </div>
            )}

            {!loading &&
              filteredFeedbacks.map((fb, index) => (
                <article
                  key={fb._id}
                  className="rounded-3xl p-5 border transition hover:-translate-y-0.5 fade-up"
                  style={{
                    animationDelay: `${220 + index * 60}ms`,
                    borderColor: darkMode ? "rgba(148,163,184,0.2)" : "rgba(226,232,240,0.8)",
                    background: darkMode ? "rgba(15,23,42,0.95)" : "#fff",
                    boxShadow: "0 12px 35px rgba(15,23,42,0.08)",
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold"
                      style={{
                        background: "linear-gradient(135deg, #fde68a, #f59e0b)",
                        color: "#78350f",
                      }}
                    >
                      {getInitials(fb.userId?.fullname || fb.userId?.username)}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold">
                          {fb.userId?.fullname || fb.userId?.username || "Người dùng ẩn danh"}
                        </h3>
                        <span
                          className="px-3 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            background: "rgba(16,185,129,0.15)",
                            color: "#0f766e",
                          }}
                        >
                          {fb.type === "teacher" ? "Lecturer" : "System"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, starIndex) => {
                            const active = starIndex < Math.round(fb.rating ?? 0);
                            return (
                              <svg
                                key={starIndex}
                                viewBox="0 0 24 24"
                                className={`rating-star ${active ? "rating-star--active" : ""}`}
                                style={{ animationDelay: `${starIndex * 90}ms` }}
                                fill={active ? "#fbbf24" : "none"}
                                stroke="#f59e0b"
                                strokeWidth="1.5"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M11.48 3.499a.562.562 0 011.04 0l2.012 5.111a.563.563 0 00.475.354l5.518.403c.499.036.701.663.322.988l-4.204 3.57a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0l-4.725 2.885a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557l-4.204-3.57a.563.563 0 01.322-.988l5.518-.403a.563.563 0 00.475-.354l2.012-5.11z"
                                />
                              </svg>
                            );
                          })}
                        </div>
                        <span className="text-sm font-semibold" style={{ color: darkMode ? "#f8fafc" : "#0f172a" }}>
                          {fb.rating}/5
                        </span>
                        <span className="text-xs" style={{ color: darkMode ? "#94a3b8" : "#6b7280" }}>
                          {formatDate(fb.createdAt, meta?.timezone)}
                        </span>
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(fb._id)}
                        disabled={deletingId === fb._id}
                        className="text-xs px-3 py-1 rounded-full border transition-all click-animate delete-button"
                        style={{
                          borderColor: "rgba(248,113,113,0.4)",
                          color: "#dc2626",
                          opacity: deletingId === fb._id ? 0.6 : 1,
                        }}
                      >
                        {deletingId === fb._id ? "Deleting..." : "Delete"}
                      </button>
                    )}
                  </div>
                  <div className="mt-3">
                    <div
                      className="text-sm leading-relaxed prose prose-sm max-w-none"
                      style={{ color: darkMode ? "#cbd5e1" : "#0f172a" }}
                    >
                      <MarkdownContent
                        content={
                          expandedFeedbackIds[fb._id] || fb.description.length <= PREVIEW_CHAR_LIMIT
                            ? fb.description
                            : `${fb.description.slice(0, PREVIEW_CHAR_LIMIT).trimEnd()}…`
                        }
                        onImageClick={handleImagePreview}
                      />
                    </div>
                    {fb.description.length > PREVIEW_CHAR_LIMIT && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedFeedbackIds((prev) => ({
                            ...prev,
                            [fb._id]: !prev[fb._id],
                          }))
                        }
                        className="mt-2 text-xs font-semibold underline-offset-2 hover:underline"
                        style={{ color: darkMode ? "#93c5fd" : "#2563eb" }}
                      >
                        {expandedFeedbackIds[fb._id] ? "Show less" : "Show more"}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-4 text-xs info-line">
                    <span className="info-chip">Email: {fb.userId?.email}</span>
                  </div>
                </article>
              ))}
            </section>

            {confirmDeleteId && (
              <div className="fixed inset-0 z-40 flex items-center justify-center modal-backdrop">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: darkMode
                      ? "rgba(164, 176, 204, 0.2)"
                      : "rgba(181, 191, 213, 0.1)",
                    backdropFilter: "blur(4px)",
                  }}
                  onClick={closeDeleteModal}
                />
                <div
                  className="relative z-50 max-w-sm w-full mx-4 rounded-3xl shadow-2xl modal-content"
                  style={{
                    background: darkMode ? "#020617" : "#ecfeff",
                    border: darkMode
                      ? "1px solid rgba(148, 163, 184, 0.4)"
                      : "1px solid rgba(59, 130, 246, 0.35)",
                  }}
                >
                  <div className="px-6 py-5">
                    <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "#0f766e" }}>
                      Confirm delete
                    </p>
                    <h2 className="text-lg font-semibold mb-2">
                      Are you sure you want to delete this feedback?
                    </h2>
                    <p
                      className="text-xs mb-5"
                      style={{ color: darkMode ? "#9ca3af" : "#64748b" }}
                    >
                      This action cannot be undone. The selected feedback will be permanently
                      removed.
                    </p>
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={closeDeleteModal}
                        className="px-4 py-2 rounded-full font-semibold border text-sm transition-all click-animate"
                        style={{
                          background: darkMode ? "rgba(15,23,42,0.9)" : "#e0f2fe",
                          color: darkMode ? "#e5e7eb" : "#0f172a",
                          borderColor: darkMode
                            ? "rgba(148,163,184,0.5)"
                            : "rgba(59,130,246,0.45)",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void confirmDelete()}
                        disabled={deletingId === confirmDeleteId}
                        className="px-6 py-2 rounded-full font-semibold text-sm relative overflow-hidden pulse-button transition-all click-animate"
                        style={{
                          background: "linear-gradient(135deg, #0f766e, #022c22)",
                          color: "#f9fafb",
                          opacity: deletingId === confirmDeleteId ? 0.7 : 1,
                        }}
                      >
                        {deletingId === confirmDeleteId ? "Deleting..." : "OK"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {pagination && (
            <div className="mt-6 flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="w-10 h-10 rounded-full border font-semibold click-animate flex items-center justify-center"
                  style={{
                    background: darkMode ? "rgba(15,23,42,0.6)" : "#fff",
                    color: darkMode ? "#e5e7eb" : "#1f2937",
                    borderColor: darkMode ? "rgba(148,163,184,0.4)" : "rgba(148,163,184,0.6)",
                    opacity: pagination.hasPrevPage ? 1 : 0.4,
                  }}
                >
                  {"<"}
                </button>
                {pageNumbers.map((pageNumber) => {
                  const isActive = pageNumber === currentPage;
                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => handlePageChange(pageNumber)}
                      className="min-w-[40px] h-10 rounded-full border px-3 text-sm font-semibold click-animate"
                      style={{
                        background: isActive
                          ? "linear-gradient(135deg, #525fe1, #7c3aed)"
                          : darkMode
                            ? "rgba(15,23,42,0.6)"
                            : "#fff",
                        color: isActive ? "#fff" : darkMode ? "#e5e7eb" : "#1f2937",
                        borderColor: isActive
                          ? "transparent"
                          : darkMode
                            ? "rgba(148,163,184,0.4)"
                            : "rgba(148,163,184,0.6)",
                      }}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                  className="w-10 h-10 rounded-full border font-semibold click-animate flex items-center justify-center"
                  style={{
                    background: darkMode ? "rgba(15,23,42,0.6)" : "#fff",
                    color: darkMode ? "#e5e7eb" : "#1f2937",
                    borderColor: darkMode ? "rgba(148,163,184,0.4)" : "rgba(148,163,184,0.6)",
                    opacity: pagination.hasNextPage ? 1 : 0.4,
                  }}
                >
                  {">"}
                </button>
              </div>
            </div>
          )}

          {meta && (
            <div className="mt-2 text-xs" style={{ color: darkMode ? "#6b7280" : "#9ca3af" }}>
              Last updated: {meta.timestamp ? formatDate(meta.timestamp, meta.timezone) : "Unknown"}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

