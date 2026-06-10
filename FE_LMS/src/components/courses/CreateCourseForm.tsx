import React, { useEffect, useMemo, useState, useRef } from "react";
import http, { httpClient } from "../../utils/http";
import { subjectService, courseService } from "../../services";
import { userService } from "../../services/userService";
import { useAuth } from "../../hooks/useAuth";

import type { User } from "../../types/auth";
import type { Subject } from "../../types/subject";
type Semester = {
  _id: string;
  name: string;
  type: string;
  year: number;
  startDate: string;
  endDate: string;
};

type Props = {
  darkMode?: boolean;
  onClose?: () => void;
  onCreated?: () => Promise<void> | void;
  presetTeacherId?: string;
};

const statuses = ["draft", "ongoing", "completed"] as const;

const CreateCourseForm: React.FC<Props> = ({
  darkMode,
  onClose,
  onCreated,
  presetTeacherId,
}) => {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  const teacherSpecialistIds = Array.isArray((user as any)?.specialistIds) ? (user as any).specialistIds : [];
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [currentSpecialistIds, setCurrentSpecialistIds] = useState<string[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [form, setForm] = useState({
    title: "",
    subjectId: "",
    description: "",
    startDate: "",
    endDate: "",
    semesterId: "",
    teacherIds: [] as string[],
    status: "draft",
    isPublished: false,
    capacity: 50,
    enrollRequiresApproval: true,
    logo: null as File | null,
  });

  useEffect(() => {
    const load = async () => {
      setError("");
      try {
        const [subjectsResult, teachersResult, semestersResult] =
          await Promise.allSettled([
            subjectService.getAllSubjects(),
            userService.getUsers({
              role: "teacher",
              specialistIds: currentSpecialistIds,
              limit: 100,
            } as any),
            httpClient.get("/semesters", { withCredentials: true }),
          ]);
        if (subjectsResult.status === "fulfilled") {
          setSubjects(subjectsResult.value.data || []);
          console.log("subjects", subjectsResult.value.data || []);
        }
        if (teachersResult.status === "fulfilled") {
          setTeachers(teachersResult.value.users || []);
        }
        if (semestersResult.status === "fulfilled") {
          const body: any = semestersResult.value.data;
          const list = Array.isArray(body)
            ? body
            : Array.isArray(body?.data)
            ? body.data
            : [];
          setSemesters(list);
        }
      } catch (e: any) {
        setError(e?.message || "Không thể tải dữ liệu");
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (presetTeacherId) {
      setForm((prev) => ({
        ...prev,
        teacherIds: Array.from(new Set([presetTeacherId, ...prev.teacherIds])),
      }));
    }
    if (isTeacher && (user as any)?._id) {
      setForm((prev) => ({
        ...prev,
        teacherIds: [ (user as any)._id ],
      }));
    }
  }, [presetTeacherId, isTeacher, user]);

  // Dropdown state for teacher selector (mimic Calendar UI)
  const [showTeacherDropdown, setShowTeacherDropdown] =
    useState<boolean>(false);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState<string>("");
  const teacherDropdownRef = useRef<HTMLDivElement | null>(null);
  const [dateErrors, setDateErrors] = useState<{ startDate: string; endDate: string }>({ startDate: "", endDate: "" });

  const filteredTeachers = useMemo(() => {
    if (!teacherSearchQuery.trim()) return teachers;
    const q = teacherSearchQuery.toLowerCase();
    return teachers.filter((t) => {
      const name = (t.fullname || t.username || "").toLowerCase();
      const email = (t.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [teachers, teacherSearchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      if (
        teacherDropdownRef.current &&
        !teacherDropdownRef.current.contains(ev.target as Node)
      ) {
        setShowTeacherDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type, checked } = e.target as any;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : name === "capacity"
          ? Number(value)
          : value,
    }));
    if (name === "subjectId") {
      const selected = subjects.find((s) => s._id === value) as any;
      const rawSpecIds = Array.isArray(selected?.specialistIds)
        ? selected.specialistIds
        : Array.isArray(selected?.specialists)
        ? (selected.specialists || []).map((s: any) => s?._id).filter(Boolean)
        : [selected?.specialistId || selected?.specialist?._id].filter(Boolean);
      const specIds = rawSpecIds
        .map((x: any) => (typeof x === "string" ? x : x?._id))
        .filter((id: any) => typeof id === "string" && id);
      setCurrentSpecialistIds(specIds);
      void (async () => {
        try {
          const params: any = { role: "teacher", specialistIds: specIds };
          const res = await userService.getUsers(params);
          const list = res.users || [];
          setTeachers(list);
          const allowedIds = list.map((u: any) => u._id);
          setForm((prev) => ({
            ...prev,
            teacherIds: prev.teacherIds.filter((id) => allowedIds.includes(id)),
          }));
        } catch (_e) {}
      })();
    }
    const nextSemesterId = name === "semesterId" ? value : form.semesterId;
    const nextStartDate = name === "startDate" ? value : form.startDate;
    const nextEndDate = name === "endDate" ? value : form.endDate;
    const sem = semesters.find((s) => s._id === nextSemesterId);
    if (!sem) {
      setDateErrors({ startDate: "", endDate: "" });
      return;
    }
    const semStart = new Date(sem.startDate);
    const semEnd = new Date(sem.endDate);
    let startError = "";
    let endError = "";
    if (nextStartDate) {
      const start = new Date(nextStartDate);
      if (start < semStart || start > semEnd) {
        startError = "Start Date must be within the selected semester";
      }
    }
    if (nextEndDate) {
      const end = new Date(nextEndDate);
      if (end < semStart || end > semEnd) {
        endError = "End Date must be within the selected semester";
      }
    }
    setDateErrors({ startDate: startError, endDate: endError });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setForm((prev) => ({ ...prev, logo: file }));
  };

  const toggleTeacher = (id: string) => {
    setForm((prev) => {
      const exists = prev.teacherIds.includes(id);
      return {
        ...prev,
        teacherIds: exists
          ? prev.teacherIds.filter((t) => t !== id)
          : [...prev.teacherIds, id],
      };
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const slug = form.title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");

      await courseService.createCourse({
        title: form.title,
        slug,
        subjectId: form.subjectId,
        description: form.description,
        startDate: form.startDate,
        endDate: form.endDate,
        semesterId: form.semesterId || undefined,
        teacherIds: isTeacher && (user as any)?._id ? [ (user as any)._id ] : form.teacherIds,
        status: form.status as any,
        isPublished: form.isPublished,
        capacity: form.capacity,
        enrollRequiresApproval: form.enrollRequiresApproval,
        logo: form.logo || undefined,
      });
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Create a successful course",
        showConfirmButton: false,
        timer: 2000,
      });
      setSuccessMsg("Create a successful course");
      setForm({
        title: "",
        subjectId: "",
        description: "",
        startDate: "",
        endDate: "",
        semesterId: "",
        teacherIds: [],
        status: "draft",
        isPublished: false,
        capacity: 50,
        enrollRequiresApproval: true,
        logo: null as File | null,
      });
      if (onCreated) await onCreated();
      if (onClose) onClose();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || e?.message || "Create a course failed";
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
  console.log("teachers", teachers);
  console.log("subjects", subjects);
  return (
    <form onSubmit={submit} className="px-6 py-6 overflow-y-auto flex-1 min-h-0">
      {successMsg && (
        <div className="mb-4 p-3 rounded bg-green-500/10 text-green-600">
          {successMsg}
        </div>
      )}
      <div className="mb-6">
        <label
          className="block text-sm font-medium mb-2"
          style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
        >
          Semester
        </label>
        <select
          name="semesterId"
          value={form.semesterId}
          onChange={handleChange}
          className="w-full px-4 py-2 rounded-lg border"
          style={{
            backgroundColor: darkMode ? "rgba(55, 65, 81, 0.8)" : "#ffffff",
            borderColor: darkMode ? "rgba(75, 85, 99, 0.3)" : "#e5e7eb",
            color: darkMode ? "#ffffff" : "#000000",
          }}
          required
        >
          <option value="">Select semester</option>
          {semesters.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name} ({s.year})
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
          >
            Title
          </label>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg border"
            style={{
              backgroundColor: darkMode ? "rgba(55, 65, 81, 0.8)" : "#ffffff",
              borderColor: darkMode ? "rgba(75, 85, 99, 0.3)" : "#e5e7eb",
              color: darkMode ? "#ffffff" : "#000000",
            }}
            placeholder="Enter course title"
            required
          />
        </div>
        <div>
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
          >
            Subject
          </label>
          <select
            name="subjectId"
            value={form.subjectId}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg border"
            style={{
              backgroundColor: darkMode ? "rgba(55, 65, 81, 0.8)" : "#ffffff",
              borderColor: darkMode ? "rgba(75, 85, 99, 0.3)" : "#e5e7eb",
              color: darkMode ? "#ffffff" : "#000000",
            }}
            required
          >
            <option value="">Select subject</option>
            {(
              isTeacher && teacherSpecialistIds.length > 0
                ? subjects.filter((s: any) => {
                    const raw = Array.isArray(s?.specialistIds)
                      ? s.specialistIds
                      : Array.isArray(s?.specialists)
                      ? (s.specialists || []).map((x: any) => x?._id).filter(Boolean)
                      : [s?.specialistId || s?.specialist?._id].filter(Boolean);
                    const ids = (Array.isArray(raw) ? raw : [])
                      .map((x: any) => (typeof x === "string" ? x : x?._id))
                      .filter(Boolean);
                    return ids.some((id: any) => teacherSpecialistIds.includes(id));
                  })
                : subjects
            ).map((s) => (
              <option key={s._id} value={s._id}>
                {s.name || s.code}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
          >
            Description
          </label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg border h-24"
            style={{
              backgroundColor: darkMode ? "rgba(55, 65, 81, 0.8)" : "#ffffff",
              borderColor: darkMode ? "rgba(75, 85, 99, 0.3)" : "#e5e7eb",
              color: darkMode ? "#ffffff" : "#000000",
            }}
            placeholder="Enter course description"
          />
        </div>
      </div>
      <div className="mb-6">
        <label
          className="block text-sm font-medium mb-2"
          style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
        >
          Teachers
        </label>
        <div
          ref={teacherDropdownRef}
          style={{ position: "relative", minWidth: 320 }}
        >
          <div
            onClick={() => !isTeacher && setShowTeacherDropdown(!showTeacherDropdown)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 12px",
              borderRadius: 12,
              border: `2px solid ${
                showTeacherDropdown
                  ? "#10b981"
                  : darkMode
                  ? "rgba(75,85,99,0.3)"
                  : "#e5e7eb"
              }`,
              background: darkMode ? "#1f2937" : "white",
              cursor: "pointer",
              transition: "all 0.2s",
              boxSizing: "border-box",
              minHeight: 44,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                overflow: "hidden",
                flex: 1,
                minWidth: 0,
              }}
            >
              {form.teacherIds.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    overflow: "hidden",
                  }}
                >
                  {form.teacherIds.slice(0, 3).map((id) => {
                    const t = teachers.find((x) => x._id === id) as any;
                    if (!t) return null;
                    return (
                      <div
                        key={id}
                        title={t.fullname || t.username}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {t.avatar_url ? (
                          <img
                            src={t.avatar_url}
                            alt={t.fullname || t.username}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              background: darkMode ? "#374151" : "#f1f5f9",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: darkMode ? "#9ca3af" : "#64748b",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {(t.fullname || t.username || "T")
                              .substring(0, 2)
                              .toUpperCase()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {form.teacherIds.length > 3 && (
                    <div
                      style={{
                        fontSize: 12,
                        color: darkMode ? "#9ca3af" : "#374151",
                      }}
                    >
                      +{form.teacherIds.length - 3}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: darkMode ? "#9ca3af" : "#64748b" }}>
                  Select teachers...
                </div>
              )}
            </div>
            <i
              className={`bi bi-chevron-${showTeacherDropdown ? "up" : "down"}`}
              style={{
                color: darkMode ? "#9ca3af" : "#64748b",
                marginLeft: "auto",
              }}
            />
          </div>

          {showTeacherDropdown && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                right: 0,
                background: darkMode ? "#1f2937" : "white",
                borderRadius: 12,
                border: `1px solid ${darkMode ? "#374151" : "#e5e7eb"}`,
                boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
                zIndex: 1000,
                maxHeight: 360,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: 12,
                  borderBottom: `1px solid ${darkMode ? "#374151" : "#e5e7eb"}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: darkMode ? "#374151" : "#f1f5f9",
                  }}
                >
                  <i
                    className="bi bi-search"
                    style={{ color: darkMode ? "#9ca3af" : "#64748b" }}
                  />
                  <input
                    type="text"
                    placeholder="Search teachers..."
                    value={teacherSearchQuery}
                    onChange={(e) => setTeacherSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      border: "none",
                      background: "transparent",
                      outline: "none",
                      width: "100%",
                      color: darkMode ? "#f1f5f9" : "#1e293b",
                      fontSize: 14,
                    }}
                  />
                  {teacherSearchQuery && (
                    <i
                      className="bi bi-x-circle-fill"
                      style={{
                        color: darkMode ? "#6b7280" : "#9ca3af",
                        cursor: "pointer",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTeacherSearchQuery("");
                      }}
                    />
                  )}
                </div>
              </div>

              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                {filteredTeachers.length === 0 ? (
                  <div
                    style={{
                      padding: 24,
                      textAlign: "center",
                      color: darkMode ? "#9ca3af" : "#64748b",
                    }}
                  >
                    <i
                      className="bi bi-person-x"
                      style={{
                        fontSize: 24,
                        marginBottom: 8,
                        display: "block",
                      }}
                    />
                    No teachers found
                  </div>
                ) : (
                  filteredTeachers.map((teacher) => {
                    const t = teacher as any;
                    const selected = form.teacherIds.includes(t._id);
                    return (
                      <div
                        key={t._id}
                        onClick={() => { if (!isTeacher) toggleTeacher(t._id); }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 12px",
                          cursor: "pointer",
                          background: selected
                            ? darkMode
                              ? "rgba(16,185,129,0.12)"
                              : "rgba(16,185,129,0.08)"
                            : "transparent",
                          borderLeft: selected
                            ? "3px solid #10b981"
                            : "3px solid transparent",
                          transition: "all 0.12s",
                        }}
                      >
                        {t.avatar_url ? (
                          <img
                            src={t.avatar_url}
                            alt={t.fullname || t.username}
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "50%",
                              objectFit: "cover",
                              border: selected
                                ? "2px solid #10b981"
                                : `2px solid ${
                                    darkMode ? "#374151" : "#e2e8f0"
                                  }`,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "50%",
                              background: selected
                                ? "linear-gradient(135deg,#10b981,#059669)"
                                : darkMode
                                ? "#374151"
                                : "#e2e8f0",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: selected
                                ? "white"
                                : darkMode
                                ? "#9ca3af"
                                : "#64748b",
                              fontWeight: 600,
                              fontSize: 14,
                            }}
                          >
                            {(t.fullname || t.username || "T")
                              .substring(0, 2)
                              .toUpperCase()}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 500,
                              fontSize: 13,
                              color: darkMode ? "#f1f5f9" : "#1e293b",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            {t.fullname || t.username}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: darkMode ? "#6b7280" : "#94a3b8",
                              marginTop: 2,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <i
                              className="bi bi-envelope"
                              style={{ fontSize: 10 }}
                            />
                            {(t as any).email || ""}
                          </div>
                        </div>
                        {selected && (
                          <i
                            className="bi bi-check-circle-fill"
                            style={{ color: "#10b981", fontSize: 16 }}
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div>
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
          >
            Start Date
          </label>
          <input
            type="date"
            name="startDate"
            value={form.startDate}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg border"
            style={{
              backgroundColor: darkMode ? "rgba(55, 65, 81, 0.8)" : "#ffffff",
              borderColor: darkMode ? "rgba(75, 85, 99, 0.3)" : "#e5e7eb",
              color: darkMode ? "#ffffff" : "#000000",
            }}
          />
          {dateErrors.startDate && (
            <div className="text-xs mt-1" style={{ color: "#ef4444" }}>
              {dateErrors.startDate}
            </div>
          )}
        </div>
        <div>
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
          >
            End Date
          </label>
          <input
            type="date"
            name="endDate"
            value={form.endDate}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg border"
            style={{
              backgroundColor: darkMode ? "rgba(55, 65, 81, 0.8)" : "#ffffff",
              borderColor: darkMode ? "rgba(75, 85, 99, 0.3)" : "#e5e7eb",
              color: darkMode ? "#ffffff" : "#000000",
            }}
          />
          {dateErrors.endDate && (
            <div className="text-xs mt-1" style={{ color: "#ef4444" }}>
              {dateErrors.endDate}
            </div>
          )}
        </div>
        <div>
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
          >
            Capacity
          </label>
          <input
            type="number"
            name="capacity"
            min={1}
            value={form.capacity}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg border"
            style={{
              backgroundColor: darkMode ? "rgba(55, 65, 81, 0.8)" : "#ffffff",
              borderColor: darkMode ? "rgba(75, 85, 99, 0.3)" : "#e5e7eb",
              color: darkMode ? "#ffffff" : "#000000",
            }}
            placeholder="50"
          />
        </div>
      </div>

      <div className="mb-6">
        <label
          className="block text-sm font-medium mb-2"
          style={{ color: darkMode ? "#cbd5e1" : "#374151" }}
        >
          Logo
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleLogoChange}
          className="w-full px-4 py-2 rounded-lg border"
          style={{
            backgroundColor: darkMode ? "rgba(55, 65, 81, 0.8)" : "#ffffff",
            borderColor: darkMode ? "rgba(75, 85, 99, 0.3)" : "#e5e7eb",
            color: darkMode ? "#ffffff" : "#000000",
          }}
        />
      </div>



      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="flex items-center gap-6">
          {user?.role === "teacher" ? null : (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isPublished"
                checked={form.isPublished}
                onChange={handleChange}
              />
              <span>Is published</span>
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="enrollRequiresApproval"
              checked={form.enrollRequiresApproval}
              onChange={handleChange}
            />
            <span>Enroll requires approval</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3 px-1">
        <button
          type="button"
          onClick={onClose}
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
        >
          Create
        </button>
      </div>
    </form>
  );
};

export default CreateCourseForm;
