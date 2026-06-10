import React, { useEffect, useState } from "react";
import { Trash, Pencil } from "lucide-react";
import type { Lesson } from "../../types/lesson";
import { httpClient } from "../../utils/http";
import { useAuth } from "../../hooks/useAuth";




interface LessonCardProps {
  lesson: Lesson;
  darkMode: boolean;
  canManage: boolean;
  onNavigate: (lessonId: string) => void;
  onEdit: (lesson: Lesson) => void;
  onDelete: (lessonId: string) => void;
}

const formatDuration = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const LessonCard: React.FC<LessonCardProps> = ({
  lesson,
  darkMode,
  canManage,
  onNavigate,
  onEdit,
  onDelete,
}) => {
  const { user } = useAuth();
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const isStudent = user?.role === "student";
  useEffect(() => {
    const fetchProgress = async () => {
      if (!lesson.hasAccess || !isStudent) return;

      try {
        const response = await httpClient.get(
          `/lesson-progress/lessons/${lesson._id}`,
          {
            withCredentials: true,
          }
        );
        if (response.data?.success && response.data?.data) {
          const progressData = response.data.data;
          // If lesson is completed, always show 100%
          if (progressData.isCompleted) {
            setProgressPercent(100);
          } else if (progressData.progressPercent !== undefined) {
            setProgressPercent(progressData.progressPercent);
          }
        }
      } catch {
        // Progress might not exist yet, set to 0
        setProgressPercent(0);
      }
    };

    fetchProgress();

    // Listen for progress updates from LessonMaterialDetailPage
    const handleProgressUpdate = (event: CustomEvent) => {
      if (event.detail.lessonId === lesson._id) {
        if (event.detail.isCompleted) {
          setProgressPercent(100);
        } else if (event.detail.progressPercent !== undefined) {
          setProgressPercent(event.detail.progressPercent);
        }
      }
    };

    window.addEventListener(
      "lessonProgressUpdated",
      handleProgressUpdate as EventListener
    );

    return () => {
      window.removeEventListener(
        "lessonProgressUpdated",
        handleProgressUpdate as EventListener
      );
    };
  }, [lesson._id, lesson.hasAccess, isStudent]);

  const handleCardHover = (
    event: React.MouseEvent<HTMLDivElement>,
    entering: boolean
  ) => {
    const el = event.currentTarget;
    if (entering) {
      el.style.transform = "translateY(-6px) scale(1.02)";
      el.style.boxShadow = darkMode
        ? "24px 24px 38px rgba(0,0,0,0.45), -24px -24px 38px rgba(255,255,255,0.05)"
        : "18px 18px 32px rgba(0,0,0,0.12), -18px -18px 32px rgba(255,255,255,0.7)";
    } else {
      el.style.transform = "translateY(0) scale(1)";
      el.style.boxShadow = "";
    }
  };

  return (
    <div
      className="rounded-lg shadow-md overflow-hidden h-full flex flex-col"
      style={{
        backgroundColor: darkMode
          ? "rgba(31, 41, 55, 0.8)"
          : "rgba(255, 255, 255, 0.9)",
        border: darkMode
          ? "1px solid rgba(75, 85, 99, 0.3)"
          : "1px solid rgba(229, 231, 235, 0.5)",
        transition: "transform 0.3s ease, box-shadow 0.3s ease",
      }}
      onMouseEnter={(e) => handleCardHover(e, true)}
      onMouseLeave={(e) => handleCardHover(e, false)}
    >
      <div className="p-6 flex flex-col h-full">
        <div className="flex items-start justify-between mb-3">
          <span
            className="inline-block px-3 py-1 text-xs font-semibold rounded-full"
            style={{
              backgroundColor: darkMode
                ? "rgba(99, 102, 241, 0.2)"
                : "rgba(99, 102, 241, 0.1)",
              color: darkMode ? "#a5b4fc" : "#6366f1",
            }}
          >
            {lesson.courseId.title}
          </span>
          {canManage && (
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => onEdit(lesson)}
                className="p-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 hover:shadow-md flex items-center gap-1"
                style={{
                  backgroundColor: darkMode
                    ? "rgba(99, 102, 241, 0.2)"
                    : "#eef2ff",
                  color: darkMode ? "#a5b4fc" : "#4f46e5",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = darkMode
                    ? "rgba(99, 102, 241, 0.3)"
                    : "#e0e7ff";
                  e.currentTarget.style.transform = "scale(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = darkMode
                    ? "rgba(99, 102, 241, 0.2)"
                    : "#eef2ff";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => onDelete(lesson._id)}
                className="p-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 hover:shadow-md flex items-center gap-1"
                style={{
                  backgroundColor: darkMode
                    ? "rgba(239, 68, 68, 0.2)"
                    : "#fee2e2",
                  color: darkMode ? "#fca5a5" : "#dc2626",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = darkMode
                    ? "rgba(239, 68, 68, 0.3)"
                    : "#fecaca";
                  e.currentTarget.style.transform = "scale(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = darkMode
                    ? "rgba(239, 68, 68, 0.2)"
                    : "#fee2e2";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <Trash size={14} />
              </button>
            </div>
          )}
        </div>

        <h3
          onClick={() => onNavigate(lesson._id)}
          className="text-xl font-semibold mb-2 cursor-pointer hover:underline"
          style={{ color: darkMode ? "#ffffff" : "#1f2937" }}
        >
          {lesson.title}
        </h3>
        <p
          onClick={() => onNavigate(lesson._id)}
          className="text-sm mb-4 line-clamp-2 cursor-pointer"
          style={{ color: darkMode ? "#d1d5db" : "#6b7280" }}
        >
          {lesson.content}
        </p>

        <div className="space-y-2 mb-4">
          <div
            className="flex items-center justify-between text-sm"
            style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
          >
            <div className="flex items-center">
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {formatDuration(lesson.durationMinutes)}
            </div>
            {lesson.hasAccess && isStudent && (
              <div className="flex items-center gap-2">
                <div
                  className="w-55 h-2 rounded-full overflow-hidden"
                  style={{
                    backgroundColor: darkMode
                      ? "rgba(55, 65, 81, 0.5)"
                      : "rgba(229, 231, 235, 0.8)",
                  }}
                >
                  <div
                    className="h-full transition-all duration-300 ease-out"
                    style={{
                      width: `${progressPercent}%`,
                      backgroundColor:
                        progressPercent >= 100
                          ? darkMode
                            ? "#10b981"
                            : "#059669"
                          : darkMode
                            ? "#6366f1"
                            : "#4f46e5",
                    }}
                  />
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="font-semibold">
                    {Math.round(progressPercent)}%
                  </span>
                </div>
              </div>
            )}
          </div>
          <div
            className="flex items-center text-sm"
            style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {formatDate(lesson.createdAt)}
          </div>
        </div>

        <div
          className="flex items-center justify-between pt-4 border-t mt-auto"
          style={{
            borderColor: darkMode
              ? "rgba(75, 85, 99, 0.3)"
              : "rgba(229, 231, 235, 0.5)",
          }}
        >
          <div className="flex items-center">
            {lesson.hasAccess ? (
              <span
                className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded"
                style={{
                  backgroundColor: darkMode
                    ? "rgba(34, 197, 94, 0.2)"
                    : "rgba(34, 197, 94, 0.1)",
                  color: darkMode ? "#86efac" : "#16a34a",
                }}
              >
                Accessible
              </span>
            ) : (
              <span
                className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded"
                style={{
                  backgroundColor: darkMode
                    ? "rgba(239, 68, 68, 0.2)"
                    : "rgba(239, 68, 68, 0.1)",
                  color: darkMode ? "#fca5a5" : "#dc2626",
                }}
              >
                No Access
              </span>
            )}
          </div>
          {lesson.isPublished ? (
            <span
              className="text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: darkMode
                  ? "rgba(59, 130, 246, 0.2)"
                  : "rgba(59, 130, 246, 0.1)",
                color: darkMode ? "#93c5fd" : "#2563eb",
              }}
            >
              Published
            </span>
          ) : (
            canManage && (
              <span
                className="text-xs px-2 py-1 rounded"
                style={{
                  backgroundColor: darkMode
                    ? "rgba(234, 179, 8, 0.2)"
                    : "rgba(234, 179, 8, 0.1)",
                  color: darkMode ? "#fcd34d" : "#d97706",
                }}
              >
                Unpublished
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default LessonCard;
