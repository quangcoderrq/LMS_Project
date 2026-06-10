import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import {
  Navbar,
  Sidebar,
  ListToolbar,
  LessonCard,
  LessonFormModal,
} from "../../components";
import { httpClient } from "../../utils/http";
import { courseService } from "../../services";
import type {
  Lesson,
  LessonFormValues,
  LessonSortOption,
} from "../../types/lesson";

interface ApiResponse {
  success: boolean;
  message: string;
  data: Lesson[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

type ModalState =
  | { mode: "create" }
  | {
      mode: "edit";
      lesson: Lesson;
    }
  | null;

const defaultFormValues: LessonFormValues = {
  courseId: "",
  title: "",
  content: "",
  order: 0,
  durationMinutes: 0,
  publishedAt: "",
  isPublished: false,
};

const ListAllLessonsPage: React.FC = () => {
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState<LessonSortOption>("date_desc"); // Default to newest first
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(25);
  const [totalLessons, setTotalLessons] = useState(0);
  const [availableCourses, setAvailableCourses] = useState<
    { _id: string; title: string }[]
  >([]);
  const [modalState, setModalState] = useState<ModalState>(null);

  const scrubMessage = (message: string) => {
    if (!message) return "";
    const cleaned = message.replace(/https?:\/\/[^\s]+/g, "").trim();
    return cleaned || "Something went wrong";
  };

  const showSwalError = async (message: string) => {
    try {
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: scrubMessage(message),
        confirmButtonColor: darkMode ? "#4c1d95" : "#4f46e5",
        background: darkMode ? "#1f2937" : "#ffffff",
        color: darkMode ? "#ffffff" : "#1e293b",
        didOpen: () => {
          const swalContainer = document.querySelector(
            ".swal2-container"
          ) as HTMLElement;
          const swalBackdrop = document.querySelector(
            ".swal2-backdrop-show"
          ) as HTMLElement;
          if (swalContainer) swalContainer.style.zIndex = "99999";
          if (swalBackdrop) swalBackdrop.style.zIndex = "99998";
        },
      });
    } catch {
      alert(scrubMessage(message));
    }
  };

  const showSwalConfirm = async (message: string): Promise<boolean> => {
    try {
      const Swal = (await import("sweetalert2")).default;
      const result = await Swal.fire({
        icon: "warning",
        title: "Confirm",
        text: scrubMessage(message),
        showCancelButton: true,
        confirmButtonColor: darkMode ? "#dc2626" : "#ef4444",
        cancelButtonColor: darkMode ? "#4b5563" : "#6b7280",
        confirmButtonText: "Yes",
        cancelButtonText: "No",
        background: darkMode ? "#1f2937" : "#ffffff",
        color: darkMode ? "#ffffff" : "#1e293b",
        didOpen: () => {
          const swalContainer = document.querySelector(
            ".swal2-container"
          ) as HTMLElement;
          const swalBackdrop = document.querySelector(
            ".swal2-backdrop-show"
          ) as HTMLElement;
          if (swalContainer) swalContainer.style.zIndex = "99999";
          if (swalBackdrop) swalBackdrop.style.zIndex = "99998";
        },
      });
      return result.isConfirmed;
    } catch {
      return window.confirm(scrubMessage(message));
    }
  };

  const showSwalSuccess = async (message: string) => {
    try {
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        icon: "success",
        title: "Success",
        text: scrubMessage(message),
        confirmButtonColor: darkMode ? "#4c1d95" : "#4f46e5",
        background: darkMode ? "#1f2937" : "#ffffff",
        color: darkMode ? "#ffffff" : "#1e293b",
        didOpen: () => {
          const swalContainer = document.querySelector(
            ".swal2-container"
          ) as HTMLElement;
          const swalBackdrop = document.querySelector(
            ".swal2-backdrop-show"
          ) as HTMLElement;
          if (swalContainer) swalContainer.style.zIndex = "99999";
          if (swalBackdrop) swalBackdrop.style.zIndex = "99998";
        },
      });
    } catch {
      alert(scrubMessage(message));
    }
  };

  useEffect(() => {
    fetchLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageLimit, sortOption]);

  useEffect(() => {
    if (modalState) {
      fetchCourses();
    }
  }, [modalState]);

  const fetchCourses = async () => {
    try {
      const result = await courseService.getAllCourses({ page: 1, limit: 100 });
      setAvailableCourses(
        result.courses.map((c) => ({ _id: c._id, title: c.title }))
      );
    } catch (err) {
      console.error("Error fetching courses:", err);
    }
  };

  const changePageLimit = (limit: number) => {
    setPageLimit(limit);
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchLessons();
  };

  const fetchLessons = async (
    customSearchTerm?: string,
    customPage?: number
  ) => {
    setLoading(true);
    setError("");
    try {
      const pageToUse = customPage ?? currentPage;
      const params: Record<string, string | number> = {
        page: pageToUse,
        limit: pageLimit,
      };

      const termToUse = customSearchTerm ?? searchTerm;
      if (termToUse) {
        params.title = termToUse; // Use title parameter for regex search
      }

      // Sort by createdAt
      if (sortOption === "date_asc") {
        params.sortBy = "createdAt";
        params.sortOrder = "asc";
      } else if (sortOption === "date_desc") {
        params.sortBy = "createdAt";
        params.sortOrder = "desc";
      }

      const response = await httpClient.get<ApiResponse>("/lessons/", {
        params,
        withCredentials: true,
      });

      const data = response.data;
      if (data.success && data.data) {
        setLessons(data.data);
        if (data.pagination) {
          setTotalLessons(data.pagination.total || 0);
        }
      } else {
        setError(scrubMessage(data.message || "Failed to load lessons"));
      }
    } catch (err) {
      console.error("Error fetching lessons:", err);
      let errorMessage = "An error occurred while fetching lessons";
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        errorMessage =
          axiosError.response?.data?.message ||
          axiosError.message ||
          errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(scrubMessage(errorMessage));
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const canCreate = isAdmin || isTeacher;

  const handleCreate = () => setModalState({ mode: "create" });
  const handleEdit = (lesson: Lesson) =>
    setModalState({ mode: "edit", lesson });

  const handleDelete = async (lessonId: string) => {
    const confirmed = await showSwalConfirm(
      "Are you sure you want to delete this lesson?"
    );
    if (!confirmed) return;

    try {
      await httpClient.delete(`/lessons/${lessonId}`, {
        withCredentials: true,
      });
      await showSwalSuccess("Lesson deleted successfully");
      await fetchLessons();
    } catch (err) {
      console.error("Error deleting lesson:", err);
      let errorMessage = "Failed to delete lesson";
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        errorMessage =
          axiosError.response?.data?.message ||
          axiosError.message ||
          errorMessage;
      }
      await showSwalError(errorMessage);
    }
  };

  const closeModal = () => setModalState(null);

  const buildPayload = (values: LessonFormValues) => {
    const payload: {
      courseId: string;
      title: string;
      content?: string;
      durationMinutes?: number;
      isPublished: boolean;
    } = {
      courseId: values.courseId,
      title: values.title,
      isPublished: values.isPublished,
    };
    if (values.content) payload.content = values.content;
    if (values.durationMinutes > 0)
      payload.durationMinutes = values.durationMinutes;
    return payload;
  };

  const getModalInitialValues = (): LessonFormValues => {
    if (modalState?.mode === "edit" && modalState.lesson) {
      const lesson = modalState.lesson;
      return {
        courseId: lesson.courseId._id,
        title: lesson.title,
        content: lesson.content || "",
        order: lesson.order || 0,
        durationMinutes: lesson.durationMinutes || 0,
        publishedAt: "",
        isPublished: lesson.isPublished,
      };
    }
    return defaultFormValues;
  };

  const handleModalSubmit = async (values: LessonFormValues) => {
    const payload = buildPayload(values);
    try {
      if (modalState?.mode === "create") {
        await httpClient.post("/lessons", payload, { withCredentials: true });
        await showSwalSuccess("Lesson created successfully");
      } else if (modalState?.mode === "edit" && modalState.lesson) {
        await httpClient.put(`/lessons/${modalState.lesson._id}`, payload, {
          withCredentials: true,
        });
        await showSwalSuccess("Lesson updated successfully");
      }
      closeModal();
      await fetchLessons();
    } catch (err) {
      console.error("Error saving lesson:", err);
      let errorMessage = "Failed to save lesson";
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        errorMessage =
          axiosError.response?.data?.message ||
          axiosError.message ||
          errorMessage;
      }
      await showSwalError(errorMessage);
    }
  };

  const handleSearchTermChange = (value: string) => {
    setSearchTerm(value);
    if (value === "") {
      setCurrentPage(1);
      fetchLessons("", 1);
    }
  };

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{
        backgroundColor: darkMode ? "#1a202c" : "#f8fafc",
        color: darkMode ? "#ffffff" : "#1e293b",
      }}
    >
      <Navbar />
      <Sidebar
        role={(user?.role as "admin" | "teacher" | "student") || "student"}
      />

      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 mt-16 sm:pl-24 md:pl-28">
          <div className="max-w-7xl mx-auto px-4">
            <div className="mb-8">
              <h1
                className="text-3xl font-bold mb-2"
                style={{ color: darkMode ? "#ffffff" : "#1f2937" }}
              >
                Lesson
              </h1>
              <p style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}>
                Browse all available lessons across courses
              </p>
            </div>

            <ListToolbar
              darkMode={darkMode}
              searchPlaceholder="Search lessons..."
              searchTerm={searchTerm}
              onSearchTermChange={handleSearchTermChange}
              onSearch={handleSearch}
              sortOption={sortOption}
              onSortOptionChange={(value) =>
                setSortOption(value as LessonSortOption)
              }
              pageLimit={pageLimit}
              onPageLimitChange={changePageLimit}
              currentPage={currentPage}
              totalItems={totalLessons}
              onPrevPage={() => goToPage(currentPage - 1)}
              onNextPage={() => goToPage(currentPage + 1)}
              canCreate={canCreate}
              onCreate={handleCreate}
              createLabel="+ Create Lesson"
              showOnlyDateSort={true}
            />

            {error && (
              <div
                className="p-4 rounded-lg mb-6 flex items-center"
                style={{
                  backgroundColor: darkMode
                    ? "rgba(239, 68, 68, 0.1)"
                    : "#fee2e2",
                  color: darkMode ? "#fca5a5" : "#dc2626",
                }}
              >
                <svg
                  className="w-5 h-5 mr-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div
                  className="animate-spin rounded-full h-12 w-12 border-b-2"
                  style={{ borderColor: darkMode ? "#6366f1" : "#4f46e5" }}
                ></div>
              </div>
            ) : lessons.length === 0 ? (
              <div className="text-center py-12">
                <p style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}>
                  No lessons available at the moment.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {lessons.map((lesson) => (
                  <LessonCard
                    key={lesson._id}
                    lesson={lesson}
                    darkMode={darkMode}
                    canManage={canCreate}
                    onNavigate={(id) => navigate(`/materials/${id}`)}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <LessonFormModal
        darkMode={darkMode}
        isOpen={Boolean(modalState)}
        mode={modalState?.mode === "edit" ? "edit" : "create"}
        courses={availableCourses}
        initialValues={getModalInitialValues()}
        onClose={closeModal}
        onSubmit={handleModalSubmit}
      />
    </div>
  );
};

export default ListAllLessonsPage;
