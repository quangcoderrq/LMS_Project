// FE_LMS/src/pages/EnrollmentsList.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import Navbar from "../../components/layout/Navbar.tsx";
import Sidebar from "../../components/layout/Sidebar.tsx";
import { enrollmentService, courseService } from "../../services";
import http from "../../utils/http";
import useDebounce from "../../hooks/useDebounce";
import { userService } from "../../services/userService";

type Status =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "dropped"
  | "completed";

const STATUS_OPTIONS: { value: Status | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "dropped", label: "Dropped" },
  { value: "completed", label: "Completed" },
];

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

const EnrollmentsListPage: React.FC = () => {
  const { darkMode } = useTheme();
  const { user } = useAuth();

  const [items, setItems] = useState<
    ReturnType<typeof useState> extends never ? never : any[]
  >([]);
  const [pagination, setPagination] = useState<
    | { total?: number; page?: number; limit?: number; totalPages?: number }
    | undefined
  >(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [status, setStatus] = useState<Status | "">("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState<{
    userId: string;
    courseId: string;
    status: "pending" | "approved";
    role: string;
  }>({
    userId: "",
    courseId: "",
    status: "pending",
    role: "student",
  });
  const [users, setUsers] = useState<
    Array<{ _id: string; username: string; email: string; fullname?: string }>
  >([]);
  const [courses, setCourses] = useState<
    Array<{ _id: string; title: string; description?: string }>
  >([]);
  const [courseTeachers, setCourseTeachers] = useState<
    Record<string, string[]>
  >({});
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [showKickModal, setShowKickModal] = useState(false);
  const [kickReason, setKickReason] = useState("");
  const [kickTargetId, setKickTargetId] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveTargetId, setApproveTargetId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return items;
    return items.filter((it: any) => {
      const student = it?.studentId;
      const course = it?.courseId;
      const s1 = `${student?.username ?? ""} ${student?.email ?? ""} ${
        student?.fullname ?? ""
      }`.toLowerCase();
      const c1 = `${course?.title ?? ""} ${
        course?.description ?? ""
      }`.toLowerCase();
      return s1.includes(term) || c1.includes(term);
    });
  }, [items, debouncedSearch]);

  const groupedCourses = useMemo(() => {
    const map = new Map<string, {
      courseId: string;
      courseTitle: string;
      courseDesc?: string;
      enrollments: any[];
    }>();
    filtered.forEach((it: any) => {
      const courseObj = it?.courseId;
      const id = courseObj?._id || courseObj;
      if (!id) return;
      const title = courseObj?.title || "";
      const desc = courseObj?.description;
      if (!map.has(id)) {
        map.set(id, { courseId: id, courseTitle: title, courseDesc: desc, enrollments: [] });
      }
      map.get(id)!.enrollments.push(it);
    });
    return Array.from(map.values());
  }, [filtered]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const { items: data, pagination: pg } = await enrollmentService.listAll(
          {
            page,
            limit,
            status: status || undefined,
          }
        );
        if (mounted) {
          setItems(Array.isArray(data) ? data : []);
          setPagination(pg);
          setError("");
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load enrollments");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [page, limit, status]);

  useEffect(() => {
    const ids = Array.from(
      new Set(items.map((it: any) => it?.courseId?._id).filter(Boolean))
    );
    const missing = ids.filter((id) => !courseTeachers[id]);
    if (!missing.length) return;
    (async () => {
      const results = await Promise.all(
        missing.map((id) => courseService.getCourseById(id).catch(() => null))
      );
      const mapUpdate: Record<string, string[]> = {};
      results.forEach((course, idx) => {
        const id = missing[idx];
        const arr = Array.isArray((course as any)?.teacherIds)
          ? (course as any).teacherIds
              .map((t: any) => (typeof t === "string" ? t : t?._id))
              .filter(Boolean)
          : Array.isArray((course as any)?.teachers)
          ? (course as any).teachers.map((t: any) => t?._id).filter(Boolean)
          : [];
        mapUpdate[id] = arr;
      });
      setCourseTeachers((prev) => ({ ...prev, ...mapUpdate }));
    })();
  }, [items]);

  useEffect(() => {
    if (!showCreateModal) return;
    let mounted = true;
    (async () => {
      try {
        const [{ users: userList }, { courses: courseList }] =
          await Promise.all([
            userService.getUsers({ role: "student", limit: 50 }),
            courseService.getAllCourses({
              limit: 50,
              ...(user?.role === "teacher" && user?._id
                ? { teacherId: user._id }
                : {}),
            }),
          ]);
        if (mounted) {
          setUsers(
            Array.isArray(userList)
              ? userList.map((u) => ({
                  _id: u._id,
                  username: u.username,
                  email: (u as any)?.email ?? "",
                  fullname: (u as any)?.fullname,
                }))
              : []
          );
          setCourses(
            Array.isArray(courseList)
              ? courseList.map((c) => ({
                  _id: c._id,
                  title: c.title,
                  description: c.description,
                }))
              : []
          );
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [showCreateModal]);
  async function submitCreate() {
    setCreating(true);
    setCreateError("");
    try {
      await enrollmentService.create({
        userId: form.userId,
        courseId: form.courseId,
        status: form.status,
        role: form.role,
      });
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Create enrollment successfully",
        showConfirmButton: false,
        timer: 2000,
      });
      setShowCreateModal(false);
      setForm({ userId: "", courseId: "", status: "pending", role: "student" });
      setPage(1);
      const { items: data, pagination: pg } = await enrollmentService.listAll({
        page: 1,
        limit,
        status: status || undefined,
      });
      setItems(Array.isArray(data) ? data : []);
      setPagination(pg);
    } catch (e: any) {
      const backendMsg = e?.response?.data?.message || e?.data?.message;
      const msg =
        backendMsg && typeof backendMsg === "string"
          ? backendMsg
          : e?.message || "Failed to create enrollment";
      setCreateError(msg);
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
      setCreating(false);
    }
  }
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";

  const canUpdateEnrollment = (it: any) => {
    if (isAdmin) return true;
    if (isTeacher && user?._id) {
      const courseId = it?.courseId?._id || it?.courseId;
      const cachedTeacherIds = courseId ? courseTeachers[courseId] || [] : [];
      const inlineTeacherIds = Array.isArray(it?.courseId?.teacherIds)
        ? (it.courseId.teacherIds as any[])
            .map((t) => (typeof t === "string" ? t : t?._id))
            .filter(Boolean)
        : Array.isArray(it?.courseId?.teachers)
        ? (it.courseId.teachers as any[])
            .map((t) => t?._id)
            .filter(Boolean)
        : [];

      const isCourseTeacher =
        cachedTeacherIds.includes(user._id) || inlineTeacherIds.includes(user._id);

      const respondedById =
        typeof it?.respondedBy === "string"
          ? it.respondedBy
          : it?.respondedBy?._id;
      const isResponsible = respondedById === user._id;

      return isCourseTeacher || isResponsible;
    }
    return false;
  };

  async function handleApprove(id: string) {
    setUpdating((prev) => ({ ...prev, [id]: true }));
    try {
      await http.put(`/enrollments/${id}`, { status: "approved" });
      setItems((prev) =>
        prev.map((it: any) =>
          it._id === id
            ? { ...it, status: "approved", updatedAt: new Date().toISOString() }
            : it
        )
      );
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Approve enrollment successfully",
        showConfirmButton: false,
        timer: 2000,
      });
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Approve failed";
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
      setUpdating((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleReject(id: string) {
    setUpdating((prev) => ({ ...prev, [id]: true }));
    try {
      await http.put(`/enrollments/${id}`, { status: "rejected" });
      setItems((prev) =>
        prev.map((it: any) =>
          it._id === id
            ? { ...it, status: "rejected", updatedAt: new Date().toISOString() }
            : it
        )
      );
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Reject enrollment successfully",
        showConfirmButton: false,
        timer: 2000,
      });
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Reject failed";
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
      setUpdating((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleReload() {
    try {
      setLoading(true);
      const { items: data, pagination: pg } = await enrollmentService.listAll({
        page,
        limit,
        status: status || undefined,
      });
      setItems(Array.isArray(data) ? data : []);
      setPagination(pg);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Failed to load enrollments");
    } finally {
      setLoading(false);
    }
  }

  function openApproveModal(id: string) {
    setApproveTargetId(id);
    setShowApproveModal(true);
  }

  async function confirmApprove() {
    if (!approveTargetId) return;
    await handleApprove(approveTargetId);
    setShowApproveModal(false);
    setApproveTargetId(null);
  }

  function openRejectModal(id: string) {
    setRejectTargetId(id);
    setShowRejectModal(true);
  }

  async function confirmReject() {
    if (!rejectTargetId) return;
    await handleReject(rejectTargetId);
    setShowRejectModal(false);
    setRejectTargetId(null);
  }

  function openKickModal(id: string) {
    setKickTargetId(id);
    setKickReason("");
    setShowKickModal(true);
  }

  async function confirmKick() {
    if (!kickTargetId) return;
    const reason = kickReason.trim();
    if (!reason) return;
    setUpdating((prev) => ({ ...prev, [kickTargetId]: true }));
    try {
      await http.post(`/enrollments/${kickTargetId}/kick`, { reason });
      setItems((prev) => prev.filter((it: any) => it._id !== kickTargetId));
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Kick student successfully",
        showConfirmButton: false,
        timer: 2000,
      });
      setShowKickModal(false);
      setKickTargetId(null);
      setKickReason("");
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Remove failed";
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
      setUpdating((prev) => ({ ...prev, [kickTargetId]: false }));
    }
  }

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{
        backgroundColor: darkMode ? "#0f172a" : "#f8fafc",
        color: darkMode ? "#ffffff" : "#0f172a",
      }}
    >
      <Navbar />
      <Sidebar />
      <div className="max-w-[1600px] mt-[100px] mx-auto px-4 sm:pl-[93px] py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h1
            className="text-2xl font-semibold"
            style={{ color: darkMode ? "#ffffff" : "#111827" }}
          >
            Enrollments
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#525fe1] text-white px-4 py-2 rounded-lg hover:opacity-90 w-full sm:w-auto"
            >
              Create Enrollment
            </button>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student or course"
              className="px-3 py-2 rounded-lg outline-none w-full sm:w-64"
              style={{
                backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                color: darkMode ? "#ffffff" : "#111827",
                border: darkMode
                  ? "1px solid rgba(255,255,255,0.08)"
                  : "1px solid #e5e7eb",
              }}
            />
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value as Status | "");
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
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}/page
                </option>
              ))}
            </select>
            <button
              onClick={handleReload}
              className="px-4 py-2 rounded-lg w-full sm:w-auto"
              style={{
                backgroundColor: darkMode ? "#111827" : "#ffffff",
                border: darkMode
                  ? "1px solid rgba(255,255,255,0.08)"
                  : "1px solid #e5e7eb",
              }}
            >
              Reload
            </button>
          </div>
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => !creating && setShowCreateModal(false)}
            />
            <div
              className="relative w-full max-w-lg rounded-xl shadow-lg p-6"
              style={{
                backgroundColor: darkMode ? "#0b132b" : "#ffffff",
                border: darkMode
                  ? "1px solid rgba(255,255,255,0.08)"
                  : "1px solid #e5e7eb",
              }}
            >
              <div
                className="text-lg font-semibold mb-4"
                style={{ color: darkMode ? "#ffffff" : "#111827" }}
              >
                Create Enrollment
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm mb-1 block">Student</label>
                  <select
                    value={form.userId}
                    onChange={(e) =>
                      setForm({ ...form, userId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg"
                    style={{
                      backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                      color: darkMode ? "#ffffff" : "#111827",
                      border: darkMode
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
                <div>
                  <label className="text-sm mb-1 block">Course</label>
                  <select
                    value={form.courseId}
                    onChange={(e) =>
                      setForm({ ...form, courseId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg"
                    style={{
                      backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                      color: darkMode ? "#ffffff" : "#111827",
                      border: darkMode
                        ? "1px solid rgba(255,255,255,0.08)"
                        : "1px solid #e5e7eb",
                    }}
                  >
                    <option value="">Select course</option>
                    {courses.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm mb-1 block">Status</label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          status: e.target.value as "pending" | "approved",
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                        color: darkMode ? "#ffffff" : "#111827",
                        border: darkMode
                          ? "1px solid rgba(255,255,255,0.08)"
                          : "1px solid #e5e7eb",
                      }}
                    >
                      <option value="pending">pending</option>
                      <option value="approved">approved</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm mb-1 block">Role</label>
                    <select
                      value={form.role}
                      onChange={(e) =>
                        setForm({ ...form, role: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                        color: darkMode ? "#ffffff" : "#111827",
                        border: darkMode
                          ? "1px solid rgba(255,255,255,0.08)"
                          : "1px solid #e5e7eb",
                      }}
                    >
                      <option value="student">student</option>
                      <option value="teaching_assistant">
                        teaching_assistant
                      </option>
                      <option value="instructor">instructor</option>
                    </select>
                  </div>
                </div>
                {createError && (
                  <div className="text-sm text-red-500">{createError}</div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    disabled={creating}
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
                    onClick={submitCreate}
                    disabled={creating || !form.userId || !form.courseId}
                    className="bg-[#525fe1] text-white px-4 py-2 rounded-lg disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showKickModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() =>
                !updating[kickTargetId || ""] && setShowKickModal(false)
              }
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
                className="text-lg font-semibold mb-4"
                style={{ color: darkMode ? "#ffffff" : "#111827" }}
              >
                Remove Enrollment
              </div>
              <label className="text-sm mb-1 block">Reason</label>
              <textarea
                value={kickReason}
                onChange={(e) => setKickReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                  color: darkMode ? "#ffffff" : "#111827",
                  border: darkMode
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid #e5e7eb",
                }}
                placeholder="Nhập lý do remove enrollment"
              />
              <div className="flex justify-end gap-2 pt-3">
                <button
                  onClick={() => setShowKickModal(false)}
                  disabled={!!updating[kickTargetId || ""]}
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
                  onClick={confirmKick}
                  disabled={
                    !kickReason.trim() || !!updating[kickTargetId || ""]
                  }
                  className="px-4 py-2 rounded-lg bg-[#ef4444] text-white disabled:opacity-50"
                >
                  {updating[kickTargetId || ""] ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showApproveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() =>
                !approveTargetId || !updating[approveTargetId as string]
                  ? setShowApproveModal(false)
                  : null
              }
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
                Confirm Approve Enrollment
              </div>
              <div
                className="text-sm mb-4"
                style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
              >
                Are you sure you want to approve this enrollment?
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowApproveModal(false)}
                  disabled={
                    !!(approveTargetId && updating[approveTargetId as string])
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
                  onClick={confirmApprove}
                  disabled={
                    !approveTargetId ||
                    !!(approveTargetId && updating[approveTargetId as string])
                  }
                  className="px-4 py-2 rounded-lg bg-[#525fe1] text-white disabled:opacity-50"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        )}

        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() =>
                !rejectTargetId || !updating[rejectTargetId as string]
                  ? setShowRejectModal(false)
                  : null
              }
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
                Confirm Reject Enrollment
              </div>
              <div
                className="text-sm mb-4"
                style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
              >
                Are you sure you want to reject this enrollment?
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowRejectModal(false)}
                  disabled={
                    !!(rejectTargetId && updating[rejectTargetId as string])
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
                  onClick={confirmReject}
                  disabled={
                    !rejectTargetId ||
                    !!(rejectTargetId && updating[rejectTargetId as string])
                  }
                  className="px-4 py-2 rounded-lg bg-[#ef4444] text-white disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-8 w-56 bg-gray-300 dark:bg-gray-700 rounded" />
            <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
        ) : error ? (
          <div
            className="rounded-lg p-4"
            style={{
              backgroundColor: darkMode ? "#1f2937" : "#ffffff",
              border: darkMode
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid #e5e7eb",
            }}
          >
            <div className="text-red-500 mb-2">Failed to load enrollments:</div>
            <div
              className="text-sm"
              style={{ color: darkMode ? "#cbd5e1" : "#4b5563" }}
            >
              {error}
            </div>
          </div>
        ) : (
          <div
            className="rounded-lg shadow w-full"
            style={{
              backgroundColor: darkMode ? "#0b132b" : "#ffffff",
              border: darkMode
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid #e5e7eb",
            }}
          >
            <div className="space-y-6">
              {groupedCourses.length === 0 ? (
                <div
                  className="px-4 py-6 text-center"
                  style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                >
                  Không có dữ liệu
                </div>
              ) : (
                groupedCourses.map((group) => (
                  <div
                    key={group.courseId}
                    className="rounded-lg border shadow"
                    style={{
                      backgroundColor: darkMode ? "#0b132b" : "#ffffff",
                      borderColor: darkMode
                        ? "rgba(255,255,255,0.08)"
                        : "#e5e7eb",
                    }}
                  >
                    <div
                      className="px-4 py-3 border-b"
                      style={{
                        borderColor: darkMode
                          ? "rgba(255,255,255,0.08)"
                          : "#e5e7eb",
                        backgroundColor: darkMode ? "#46536df2" : "#dbeafe",
                      }}
                    >
                      <div className="font-semibold">{group.courseTitle}</div>
                      {group.courseDesc && (
                        <div
                          className="text-sm"
                          style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                        >
                          {group.courseDesc}
                        </div>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {group.enrollments.map((it: any) => (
                        <div
                          key={it._id}
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-t"
                          style={{
                            borderColor: darkMode
                              ? "rgba(255,255,255,0.08)"
                              : "#e5e7eb",
                          }}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-medium truncate">
                                {it?.studentId?.fullname || it?.studentId?.username}
                              </div>
                              {it?.role && (
                                <span
                                  className="px-2 py-0.5 rounded text-xs font-medium"
                                  style={{
                                    backgroundColor: darkMode
                                      ? "rgba(99,102,241,0.2)"
                                      : "rgba(99,102,241,0.1)",
                                    color: darkMode ? "#a5b4fc" : "#4f46e5",
                                    border: `1px solid ${darkMode ? "rgba(99,102,241,0.35)" : "rgba(99,102,241,0.25)"}`,
                                  }}
                                >
                                  {it.role}
                                </span>
                              )}
                            </div>
                            <div
                              className="text-sm truncate"
                              style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                            >
                              {it?.studentId?.email}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${statusColors(it?.status, darkMode)}`}
                            >
                              {it?.status}
                            </span>
                            {user?.role === "student" ? null : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => openApproveModal(it._id)}
                                  disabled={
                                    it?.status !== "pending" ||
                                    !canUpdateEnrollment(it) ||
                                    !!updating[it._id]
                                  }
                                  className="px-3 py-1 rounded-lg text-sm bg-[#525fe1] text-white disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => openRejectModal(it._id)}
                                  disabled={
                                    it?.status !== "pending" ||
                                    !canUpdateEnrollment(it) ||
                                    !!updating[it._id]
                                  }
                                  className="px-3 py-1 rounded-lg text-sm bg-[#ef4444] text-white disabled:opacity-50"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => openKickModal(it._id)}
                                  disabled={
                                    it?.status !== "approved" ||
                                    !canUpdateEnrollment(it) ||
                                    !!updating[it._id]
                                  }
                                  className="px-3 py-1 rounded-lg text-sm bg-[#7688a8] text-white disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3">
              <div
                className="text-sm"
                style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
              >
                Total: {pagination?.total ?? filtered.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-2 rounded-lg disabled:opacity-50"
                  style={{
                    backgroundColor: darkMode ? "#111827" : "#ffffff",
                    border: darkMode
                      ? "1px solid rgba(255,255,255,0.08)"
                      : "1px solid #e5e7eb",
                  }}
                >
                  Prev
                </button>
                <span className="text-sm">
                  {page} /{" "}
                  {pagination?.totalPages ??
                    Math.max(
                      1,
                      Math.ceil((pagination?.total ?? filtered.length) / limit)
                    )}
                </span>
                <button
                  disabled={
                    page >=
                    (pagination?.totalPages ??
                      Math.max(
                        1,
                        Math.ceil(
                          (pagination?.total ?? filtered.length) / limit
                        )
                      ))
                  }
                  onClick={() =>
                    setPage((p) =>
                      Math.min(
                        pagination?.totalPages ??
                          Math.max(
                            1,
                            Math.ceil(
                              (pagination?.total ?? filtered.length) / limit
                            )
                          ),
                        p + 1
                      )
                    )
                  }
                  className="px-3 py-2 rounded-lg disabled:opacity-50"
                  style={{
                    backgroundColor: darkMode ? "#111827" : "#ffffff",
                    border: darkMode
                      ? "1px solid rgba(255,255,255,0.08)"
                      : "1px solid #e5e7eb",
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnrollmentsListPage;
