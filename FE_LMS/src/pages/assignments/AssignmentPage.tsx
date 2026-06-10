import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import { Navbar, Sidebar, ListToolbar, AssignmentCard, AssignmentFormModal } from "../../components";
import { httpClient } from "../../utils/http";
import { courseService } from "../../services";
import type { Assignment, AssignmentFormValues, AssignmentSortOption } from "../../types/assignment";

interface ApiResponse {
  success: boolean;
  message: string;
  data: Assignment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

type ModalState =
  | { mode: "create" }
  | {
      mode: "edit";
      assignment: Assignment;
    }
  | null;

const defaultFormValues: AssignmentFormValues = {
  courseId: "",
  title: "",
  description: "",
  maxScore: 10,
  dueDate: "",
  allowLate: false,
  file: null,
};

const AssignmentPage: React.FC = () => {
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState<AssignmentSortOption>("date_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(25);
  const [totalAssignments, setTotalAssignments] = useState(0);
  const [availableCourses, setAvailableCourses] = useState<{ _id: string; title: string }[]>([]);
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
          const swalContainer = document.querySelector(".swal2-container") as HTMLElement;
          const swalBackdrop = document.querySelector(".swal2-backdrop-show") as HTMLElement;
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
          const swalContainer = document.querySelector(".swal2-container") as HTMLElement;
          const swalBackdrop = document.querySelector(".swal2-backdrop-show") as HTMLElement;
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
          const swalContainer = document.querySelector(".swal2-container") as HTMLElement;
          const swalBackdrop = document.querySelector(".swal2-backdrop-show") as HTMLElement;
          if (swalContainer) swalContainer.style.zIndex = "99999";
          if (swalBackdrop) swalBackdrop.style.zIndex = "99998";
        },
      });
    } catch {
      alert(scrubMessage(message));
    }
  };

  useEffect(() => {
    fetchAssignments();
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
      setAvailableCourses(result.courses.map((c) => ({ _id: c._id, title: c.title })));
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
    fetchAssignments();
  };

  const fetchAssignments = async (customSearchTerm?: string, customPage?: number) => {
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
        params.search = termToUse;
      }

      const isName = sortOption === "name_asc" || sortOption === "name_desc";
      const order = sortOption.endsWith("asc") ? "asc" : "desc";
      params.sortBy = isName ? "title" : "createdAt";
      params.sortOrder = order;

      const response = await httpClient.get<ApiResponse>("/assignments", {
        params,
        withCredentials: true,
      });

      const data = response.data;
      if (data.success && data.data) {
        setAssignments(data.data);
        if (data.pagination) {
          setTotalAssignments(data.pagination.total || 0);
        }
      } else {
        setError(scrubMessage(data.message || "Failed to load assignments"));
      }
    } catch (err) {
      console.error("Error fetching assignments:", err);
      let errorMessage = "An error occurred while fetching assignments";
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as { response?: { data?: { message?: string } }; message?: string };
        errorMessage = axiosError.response?.data?.message || axiosError.message || errorMessage;
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
  const handleEdit = (assignment: Assignment) => setModalState({ mode: "edit", assignment });

  const handleDelete = async (assignmentId: string) => {
    const confirmed = await showSwalConfirm("Are you sure you want to delete this assignment?");
    if (!confirmed) return;

    try {
      await httpClient.delete(`/assignments/${assignmentId}`, {
        withCredentials: true,
      });
      await showSwalSuccess("Assignment deleted successfully");
      await fetchAssignments();
    } catch (err) {
      console.error("Error deleting assignment:", err);
      await showSwalError("Failed to delete assignment");
    }
  };

  const closeModal = () => setModalState(null);

  const getModalInitialValues = (): AssignmentFormValues => {
    if (modalState?.mode === "edit" && modalState.assignment) {
      const assignment = modalState.assignment;
      let formattedDueDate = "";
      if (assignment.dueDate) {
        const date = new Date(assignment.dueDate);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        formattedDueDate = `${year}-${month}-${day}T${hours}:${minutes}`;
      }

      return {
        courseId: assignment.courseId._id,
        title: assignment.title,
        description: assignment.description || "",
        maxScore: assignment.maxScore,
        dueDate: formattedDueDate,
        allowLate: assignment.allowLate || false,
      };
    }
    return defaultFormValues;
  };

  const buildAssignmentFormData = (values: AssignmentFormValues) => {
    const formData = new FormData();
    formData.append("courseId", values.courseId);
    formData.append("title", values.title);
    formData.append("description", values.description || "");
    formData.append("maxScore", String(values.maxScore));
    if (values.dueDate) {
      formData.append("dueDate", values.dueDate);
    }
    formData.append("allowLate", String(values.allowLate));
    if (values.file) {
      formData.append("file", values.file);
    }
    return formData;
  };

  const handleModalSubmit = async (values: AssignmentFormValues) => {
    try {
      if (modalState?.mode === "create") {
        const formData = buildAssignmentFormData(values);
        await httpClient.post(`/assignments`, formData, {
          withCredentials: true,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        await showSwalSuccess("Assignment created successfully");
      } else if (modalState?.mode === "edit" && modalState.assignment) {
        const formData = buildAssignmentFormData(values);
        await httpClient.put(`/assignments/${modalState.assignment._id}`, formData, {
          withCredentials: true,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        await showSwalSuccess("Assignment updated successfully");
      }
      closeModal();
      await fetchAssignments();
    } catch (err) {
      console.error("Error saving assignment:", err);
      let errorMessage = "Failed to save assignment";
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as { response?: { data?: { message?: string } }; message?: string };
        errorMessage = axiosError.response?.data?.message || axiosError.message || errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      await showSwalError(errorMessage);
    }
  };

  const handleSearchTermChange = (value: string) => {
    setSearchTerm(value);
    if (value === "") {
      setCurrentPage(1);
      fetchAssignments("", 1);
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
      <Sidebar role={(user?.role as "admin" | "teacher" | "student") || "student"} />

      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 mt-16 sm:pl-24 md:pl-28">
          <div className="max-w-7xl mx-auto px-4">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2" style={{ color: darkMode ? "#ffffff" : "#1f2937" }}>
                Assignments
              </h1>
              <p style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}>Browse all available assignments across courses</p>
            </div>

            <ListToolbar
              darkMode={darkMode}
              searchPlaceholder="Search assignments..."
              searchTerm={searchTerm}
              onSearchTermChange={handleSearchTermChange}
              onSearch={handleSearch}
              sortOption={sortOption}
              onSortOptionChange={(value) => setSortOption(value as AssignmentSortOption)}
              pageLimit={pageLimit}
              onPageLimitChange={changePageLimit}
              currentPage={currentPage}
              totalItems={totalAssignments}
              onPrevPage={() => goToPage(currentPage - 1)}
              onNextPage={() => goToPage(currentPage + 1)}
              canCreate={canCreate}
              onCreate={handleCreate}
              createLabel="+ Create Assignment"
            />

            {error && (
              <div
                className="p-4 rounded-lg mb-6 flex items-center"
                style={{
                  backgroundColor: darkMode ? "rgba(239, 68, 68, 0.1)" : "#fee2e2",
                  color: darkMode ? "#fca5a5" : "#dc2626",
                }}
              >
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
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
            ) : assignments.length === 0 ? (
              <div className="text-center py-12">
                <p style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}>No assignments available at the moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {assignments.map((assignment) => (
                  <AssignmentCard
                    key={assignment._id}
                    assignment={assignment}
                    darkMode={darkMode}
                    canManage={canCreate}
                    onNavigate={(id) => navigate(`/assignments/${id}`)}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <AssignmentFormModal
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

export default AssignmentPage;

