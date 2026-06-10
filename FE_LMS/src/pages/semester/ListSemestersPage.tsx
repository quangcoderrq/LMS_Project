import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../hooks/useAuth";
import { httpClient } from "../../utils/http";
import { ChevronLeft, Plus, Edit, Trash2, Search } from "lucide-react";
import type { Semester } from "../../services/semesterService";

interface SemesterFormData {
  year: number;
  type: string;
  startDate: string;
  endDate: string;
}

const ListSemestersPage: React.FC = () => {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [allSemesters, setAllSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  const [formData, setFormData] = useState<SemesterFormData>({
    year: new Date().getFullYear(),
    type: "fall",
    startDate: "",
    endDate: "",
  });

  const semesterTypes = [
    { value: "fall", label: "Fall" },
    { value: "spring", label: "Spring" },
    { value: "summer", label: "Summer" },
  ];

  const fetchSemesters = async () => {
    try {
      setLoading(true);
      const response = await httpClient.get("/semesters", {
        withCredentials: true,
      });
      const data = response.data;
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : [];
      setAllSemesters(list);
      setSemesters(list);
      setError("");
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || "Failed to load semesters"
      );
    } finally {
      setLoading(false);
    }
  };

  const getSemesterName = (semester: Semester) => {
    const typeLabel =
      semesterTypes.find((t) => t.value === semester.type)?.label ||
      semester.type;
    return `${typeLabel.toUpperCase()} ${semester.year}`;
  };

  useEffect(() => {
    fetchSemesters();
  }, []);

  // Filter semesters based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSemesters(allSemesters);
      return;
    }

    const filtered = allSemesters.filter((semester) => {
      const searchLower = searchTerm.toLowerCase();
      const semesterName = getSemesterName(semester).toLowerCase();
      const year = semester.year.toString();
      const type = semester.type.toLowerCase();

      return (
        semesterName.includes(searchLower) ||
        year.includes(searchLower) ||
        type.includes(searchLower)
      );
    });

    setSemesters(filtered);
  }, [searchTerm, allSemesters]);

  const handleCreate = () => {
    setFormData({
      year: new Date().getFullYear(),
      type: "fall",
      startDate: "",
      endDate: "",
    });
    setShowCreateModal(true);
  };

  const handleEdit = (semester: Semester) => {
    setEditingSemester(semester);
    // Parse dates from API format (YYYY/MM/DD) to input format (YYYY-MM-DD)
    const parseDate = (dateString: string) => {
      if (!dateString) return "";
      const parts = dateString.split("/");
      if (parts.length === 3) {
        return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(
          2,
          "0"
        )}`;
      }
      return dateString;
    };
    setFormData({
      year: semester.year,
      type: semester.type,
      startDate: parseDate(semester.startDate),
      endDate: parseDate(semester.endDate),
    });
    setShowEditModal(true);
  };

  const handleDelete = async (semesterId: string) => {
    const Swal = (await import("sweetalert2")).default;
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This action cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        await httpClient.delete(`/semesters/${semesterId}`, {
          withCredentials: true,
        });
        await Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "Semester deleted successfully",
          showConfirmButton: false,
          timer: 2000,
        });
        await fetchSemesters();
      } catch (e: any) {
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          "Failed to delete semester";
        await Swal.fire({
          toast: true,
          position: "top-end",
          icon: "error",
          title: msg,
          showConfirmButton: false,
          timer: 2500,
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent, isEdit: boolean) => {
    e.preventDefault();
    try {
      // Format dates to YYYY/MM/DD format
      const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}/${month}/${day}`;
      };

      const payload = {
        year: formData.year,
        type: formData.type,
        startDate: formatDate(formData.startDate),
        endDate: formatDate(formData.endDate),
      };

      if (isEdit && editingSemester) {
        await httpClient.put(`/semesters/${editingSemester._id}`, payload, {
          withCredentials: true,
        });
      } else {
        await httpClient.post("/semesters", payload, {
          withCredentials: true,
        });
      }

      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: isEdit
          ? "Semester updated successfully!"
          : "Semester created successfully!",
        showConfirmButton: false,
        timer: 2000,
      });

      setShowCreateModal(false);
      setShowEditModal(false);
      setEditingSemester(null);
      await fetchSemesters();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || e?.message || "Failed to save semester";
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: msg,
        showConfirmButton: false,
        timer: 2500,
      });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";

    // Handle ISO date format (2026-08-31T17:00:00.000Z)
    if (dateString.includes("T")) {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    // Handle YYYY/MM/DD format
    const parts = dateString.split("/");
    if (parts.length === 3) {
      const date = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    // Handle YYYY-MM-DD format
    if (dateString.includes("-") && dateString.length === 10) {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    return dateString;
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
      <Sidebar role={user?.role || "admin"} />

      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 mt-16 sm:pl-24 md:pl-28">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="p-2 rounded-lg hover:bg-opacity-80 transition-colors"
                  style={{
                    backgroundColor: darkMode ? "#1f2937" : "#e5e7eb",
                    color: darkMode ? "#ffffff" : "#111827",
                  }}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1
                    className="text-2xl font-bold mb-2"
                    style={{ color: darkMode ? "#ffffff" : "#1e293b" }}
                  >
                    Semesters Management
                  </h1>
                  <p
                    className="text-sm"
                    style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                  >
                    Manage all semesters in the system
                  </p>
                </div>
              </div>
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all"
                style={{ backgroundColor: darkMode ? "#4c1d95" : "#4f46e5" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    darkMode ? "#5b21b6" : "#4338ca";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    darkMode ? "#4c1d95" : "#4f46e5";
                }}
              >
                <Plus className="w-4 h-4" />
                Create Semester
              </button>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search semesters by name, year, or type..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg outline-none"
                  style={{
                    backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                    color: darkMode ? "#ffffff" : "#111827",
                    border: darkMode
                      ? "1px solid rgba(255,255,255,0.08)"
                      : "1px solid #e5e7eb",
                  }}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div
                className="mb-4 p-3 rounded-lg"
                style={{
                  backgroundColor: darkMode
                    ? "rgba(239, 68, 68, 0.2)"
                    : "rgba(239, 68, 68, 0.1)",
                  color: darkMode ? "#fca5a5" : "#dc2626",
                }}
              >
                {error}
              </div>
            )}

            {/* Loading State */}
            {loading ? (
              <div className="flex justify-center items-center py-16">
                <div
                  className="animate-spin rounded-full h-12 w-12 border-b-2"
                  style={{ borderColor: darkMode ? "#6366f1" : "#4f46e5" }}
                />
              </div>
            ) : semesters.length === 0 ? (
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
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <h3
                  className="text-xl font-semibold mb-2"
                  style={{ color: darkMode ? "#ffffff" : "#1f2937" }}
                >
                  No semesters found
                </h3>
                <p style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}>
                  Create your first semester to get started
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {semesters.map((semester) => (
                  <div
                    key={semester._id}
                    className="rounded-lg p-6"
                    style={{
                      backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                      border: darkMode
                        ? "1px solid rgba(255,255,255,0.1)"
                        : "1px solid #e5e7eb",
                    }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3
                          className="text-lg font-bold mb-1"
                          style={{ color: darkMode ? "#ffffff" : "#1f2937" }}
                        >
                          {getSemesterName(semester)}
                        </h3>
                        <p
                          className="text-sm"
                          style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                        >
                          {semester.name || `${semester.type} ${semester.year}`}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm">
                        <span
                          className="font-medium mr-2"
                          style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
                        >
                          Start:
                        </span>
                        <span
                          style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                        >
                          {formatDate(semester.startDate)}
                        </span>
                      </div>
                      <div className="flex items-center text-sm">
                        <span
                          className="font-medium mr-2"
                          style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
                        >
                          End:
                        </span>
                        <span
                          style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                        >
                          {formatDate(semester.endDate)}
                        </span>
                      </div>
                    </div>

                    <div
                      className="flex gap-2 pt-4 border-t"
                      style={{
                        borderColor: darkMode
                          ? "rgba(75, 85, 99, 0.3)"
                          : "#e5e7eb",
                      }}
                    >
                      <button
                        onClick={() => handleEdit(semester)}
                        className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 flex items-center justify-center gap-2"
                        style={{
                          backgroundColor: darkMode
                            ? "rgba(59, 130, 246, 0.2)"
                            : "#dbeafe",
                          color: darkMode ? "#93c5fd" : "#2563eb",
                        }}
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(semester._id)}
                        className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 flex items-center justify-center gap-2"
                        style={{
                          backgroundColor: darkMode
                            ? "rgba(239, 68, 68, 0.2)"
                            : "#fee2e2",
                          color: darkMode ? "#fca5a5" : "#dc2626",
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-[9999] p-4 flex items-center justify-center transition-all duration-300 bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
            }
          }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
            style={{
              backgroundColor: darkMode ? "#0b132b" : "#ffffff",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{
                borderBottom: darkMode
                  ? "1px solid rgba(255,255,255,0.06)"
                  : "1px solid #eee",
              }}
            >
              <h3
                className="text-xl font-semibold"
                style={{ color: darkMode ? "#ffffff" : "#111827" }}
              >
                Create New Semester
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1 rounded-lg text-sm"
                style={{
                  backgroundColor: darkMode ? "#1f2937" : "#f3f4f6",
                  color: darkMode ? "#e5e7eb" : "#111827",
                }}
              >
                Close
              </button>
            </div>

            <form
              onSubmit={(e) => handleSubmit(e, false)}
              className="px-6 py-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
                  >
                    Year *
                  </label>
                  <input
                    type="number"
                    name="year"
                    value={formData.year}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        year: Number(e.target.value),
                      }))
                    }
                    min="2020"
                    max="2100"
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{
                      backgroundColor: darkMode
                        ? "rgba(55, 65, 81, 0.8)"
                        : "#ffffff",
                      borderColor: darkMode
                        ? "rgba(75, 85, 99, 0.3)"
                        : "#e5e7eb",
                      color: darkMode ? "#ffffff" : "#000000",
                    }}
                    required
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
                  >
                    Type *
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, type: e.target.value }))
                    }
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{
                      backgroundColor: darkMode
                        ? "rgba(55, 65, 81, 0.8)"
                        : "#ffffff",
                      borderColor: darkMode
                        ? "rgba(75, 85, 99, 0.3)"
                        : "#e5e7eb",
                      color: darkMode ? "#ffffff" : "#000000",
                    }}
                    required
                  >
                    {semesterTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
                  >
                    Start Date *
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{
                      backgroundColor: darkMode
                        ? "rgba(55, 65, 81, 0.8)"
                        : "#ffffff",
                      borderColor: darkMode
                        ? "rgba(75, 85, 99, 0.3)"
                        : "#e5e7eb",
                      color: darkMode ? "#ffffff" : "#000000",
                    }}
                    required
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
                  >
                    End Date *
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{
                      backgroundColor: darkMode
                        ? "rgba(55, 65, 81, 0.8)"
                        : "#ffffff",
                      borderColor: darkMode
                        ? "rgba(75, 85, 99, 0.3)"
                        : "#e5e7eb",
                      color: darkMode ? "#ffffff" : "#000000",
                    }}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 px-1">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg"
                  style={{
                    backgroundColor: darkMode ? "#1f2937" : "#e5e7eb",
                    color: darkMode ? "#e5e7eb" : "#111827",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-white font-medium transition-all duration-200"
                  style={{ backgroundColor: darkMode ? "#4c1d95" : "#4f46e5" }}
                  onMouseEnter={(e) => {
                    (
                      e.currentTarget as HTMLButtonElement
                    ).style.backgroundColor = darkMode ? "#5b21b6" : "#4338ca";
                  }}
                  onMouseLeave={(e) => {
                    (
                      e.currentTarget as HTMLButtonElement
                    ).style.backgroundColor = darkMode ? "#4c1d95" : "#4f46e5";
                  }}
                >
                  Create Semester
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingSemester && (
        <div
          className="fixed inset-0 z-[9999] p-4 flex items-center justify-center transition-all duration-300 bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEditModal(false);
              setEditingSemester(null);
            }
          }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
            style={{
              backgroundColor: darkMode ? "#0b132b" : "#ffffff",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{
                borderBottom: darkMode
                  ? "1px solid rgba(255,255,255,0.06)"
                  : "1px solid #eee",
              }}
            >
              <h3
                className="text-xl font-semibold"
                style={{ color: darkMode ? "#ffffff" : "#111827" }}
              >
                Edit Semester
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingSemester(null);
                }}
                className="px-3 py-1 rounded-lg text-sm"
                style={{
                  backgroundColor: darkMode ? "#1f2937" : "#f3f4f6",
                  color: darkMode ? "#e5e7eb" : "#111827",
                }}
              >
                Close
              </button>
            </div>

            <form onSubmit={(e) => handleSubmit(e, true)} className="px-6 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
                  >
                    Year *
                  </label>
                  <input
                    type="number"
                    name="year"
                    value={formData.year}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        year: Number(e.target.value),
                      }))
                    }
                    min="2020"
                    max="2100"
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{
                      backgroundColor: darkMode
                        ? "rgba(55, 65, 81, 0.8)"
                        : "#ffffff",
                      borderColor: darkMode
                        ? "rgba(75, 85, 99, 0.3)"
                        : "#e5e7eb",
                      color: darkMode ? "#ffffff" : "#000000",
                    }}
                    required
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
                  >
                    Type *
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, type: e.target.value }))
                    }
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{
                      backgroundColor: darkMode
                        ? "rgba(55, 65, 81, 0.8)"
                        : "#ffffff",
                      borderColor: darkMode
                        ? "rgba(75, 85, 99, 0.3)"
                        : "#e5e7eb",
                      color: darkMode ? "#ffffff" : "#000000",
                    }}
                    required
                  >
                    {semesterTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
                  >
                    Start Date *
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{
                      backgroundColor: darkMode
                        ? "rgba(55, 65, 81, 0.8)"
                        : "#ffffff",
                      borderColor: darkMode
                        ? "rgba(75, 85, 99, 0.3)"
                        : "#e5e7eb",
                      color: darkMode ? "#ffffff" : "#000000",
                    }}
                    required
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
                  >
                    End Date *
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{
                      backgroundColor: darkMode
                        ? "rgba(55, 65, 81, 0.8)"
                        : "#ffffff",
                      borderColor: darkMode
                        ? "rgba(75, 85, 99, 0.3)"
                        : "#e5e7eb",
                      color: darkMode ? "#ffffff" : "#000000",
                    }}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 px-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingSemester(null);
                  }}
                  className="px-4 py-2 rounded-lg"
                  style={{
                    backgroundColor: darkMode ? "#1f2937" : "#e5e7eb",
                    color: darkMode ? "#e5e7eb" : "#111827",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-white font-medium transition-all duration-200"
                  style={{ backgroundColor: darkMode ? "#4c1d95" : "#4f46e5" }}
                  onMouseEnter={(e) => {
                    (
                      e.currentTarget as HTMLButtonElement
                    ).style.backgroundColor = darkMode ? "#5b21b6" : "#4338ca";
                  }}
                  onMouseLeave={(e) => {
                    (
                      e.currentTarget as HTMLButtonElement
                    ).style.backgroundColor = darkMode ? "#4c1d95" : "#4f46e5";
                  }}
                >
                  Update Semester
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListSemestersPage;
