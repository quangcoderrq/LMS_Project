import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../hooks/useAuth";
import { httpClient } from "../../utils/http";

const CreateSemesterPage: React.FC = () => {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [form, setForm] = useState({
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "year" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

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
        year: form.year,
        type: form.type,
        startDate: formatDate(form.startDate),
        endDate: formatDate(form.endDate),
      };

      const response = await httpClient.post("/semesters", payload, {
        withCredentials: true,
      });

      if (response.data?.success) {
        const Swal = (await import("sweetalert2")).default;
        await Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "Semester created successfully!",
          showConfirmButton: false,
          timer: 2000,
        });
        setSuccessMsg("Semester created successfully");
        setForm({
          year: new Date().getFullYear(),
          type: "fall",
          startDate: "",
          endDate: "",
        });
        // Navigate back after a short delay
        setTimeout(() => {
          navigate("/admin/courses");
        }, 1500);
      } else {
        throw new Error(response.data?.message || "Failed to create semester");
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || e?.message || "Failed to create semester";
      setError(msg);
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
      setLoading(false);
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
      {/* Navigation */}
      <Navbar />

      {/* Sidebar */}
      <Sidebar role={user?.role || "admin"} />

      {/* Main Content */}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 mt-16 sm:pl-24 md:pl-28">
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <h1
                className="text-2xl font-bold mb-2"
                style={{ color: darkMode ? "#ffffff" : "#1e293b" }}
              >
                Create New Semester
              </h1>
              <p
                className="text-sm"
                style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
              >
                Fill in the form below to create a new semester
              </p>
            </div>

            <div
              className="rounded-lg shadow-lg p-6"
              style={{
                backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                border: darkMode
                  ? "1px solid rgba(255,255,255,0.1)"
                  : "1px solid #e5e7eb",
              }}
            >
              {successMsg && (
                <div
                  className="mb-4 p-3 rounded"
                  style={{
                    backgroundColor: darkMode
                      ? "rgba(34, 197, 94, 0.2)"
                      : "rgba(34, 197, 94, 0.1)",
                    color: darkMode ? "#86efac" : "#16a34a",
                  }}
                >
                  {successMsg}
                </div>
              )}

              {error && (
                <div
                  className="mb-4 p-3 rounded"
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

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      value={form.year}
                      onChange={handleChange}
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
                      placeholder="Enter year"
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
                      value={form.type}
                      onChange={handleChange}
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
                      value={form.startDate}
                      onChange={handleChange}
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
                      value={form.endDate}
                      onChange={handleChange}
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

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => navigate("/admin/courses")}
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
                    disabled={loading}
                    className="px-5 py-2 rounded-lg text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: darkMode ? "#4c1d95" : "#4f46e5",
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.backgroundColor = darkMode
                          ? "#5b21b6"
                          : "#4338ca";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading) {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.backgroundColor = darkMode
                          ? "#4c1d95"
                          : "#4f46e5";
                      }
                    }}
                  >
                    {loading ? "Creating..." : "Create Semester"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CreateSemesterPage;
