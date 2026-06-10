import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { majorService, specialistService, userService } from "../../services";
import type { Major } from "../../types/specialist";
import type { UserDetail } from "../../services/userService";
import { GraduationCap, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";

interface SpecialistOption {
  _id: string;
  name: string;
  description?: string;
  majorId?: string | { _id: string; name: string };
}

const STUDENT_SPECIALIST_KEY = "lms:studentSpecialistIds";

const Onboarding: React.FC = () => {
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [contentPaddingLeft, setContentPaddingLeft] = useState(
    window.innerWidth >= 640 ? 93 : 0
  );

  const [majors, setMajors] = useState<Major[]>([]);
  const [specialists, setSpecialists] = useState<SpecialistOption[]>([]);
  const [selectedMajorId, setSelectedMajorId] = useState<string>("");
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [currentMajorIndex, setCurrentMajorIndex] = useState(0);
  const [currentSpecialistIndex, setCurrentSpecialistIndex] = useState(0);
  const [hasMounted, setHasMounted] = useState(false);

  // Responsive padding like other pages
  useEffect(() => {
    const handleResize = () => {
      setContentPaddingLeft(window.innerWidth >= 640 ? 93 : 0);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Trigger entrance animations once on mount
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHasMounted(true);
    }, 50);
    return () => window.clearTimeout(timer);
  }, []);

  // Guard: only students without specialistIds should see this
  useEffect(() => {
    if (!user) {
      return;
    }

    // Non-students skip onboarding
    if (user.role !== "student") {
      navigate("/dashboard");
      return;
    }

    try {
      // Check stored user detail (from /users/me) first
      const rawStored = localStorage.getItem("lms:user");
      if (rawStored) {
        const storedUser = JSON.parse(rawStored) as UserDetail;
        const hasSpecialists =
          Array.isArray(storedUser.specialistIds) &&
          storedUser.specialistIds.length > 0;
        if (hasSpecialists) {
          navigate("/student-dashboard");
          return;
        }
      }

      // Fallback: explicit local key
      const localSpec = localStorage.getItem(STUDENT_SPECIALIST_KEY);
      if (localSpec) {
        const parsed = JSON.parse(localSpec) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          navigate("/student-dashboard");
        }
      }
    } catch {
      // ignore parse errors, just stay on onboarding
    }
  }, [navigate, user]);

  // Load majors on mount
  useEffect(() => {
    const fetchMajors = async () => {
      try {
        setLoading(true);
        setError(null);
        const { majors: majorList } = await majorService.getAllMajors({
          limit: 100,
          sortBy: "title",
          sortOrder: "asc",
        } as any);
        setMajors(majorList);
        if (majorList.length > 0) {
          setCurrentMajorIndex(0);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load majors";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchMajors();
  }, []);

  // Load specialists only when we're on step 2 and a major is selected
  useEffect(() => {
    if (currentStep !== 2) {
      return;
    }
    if (!selectedMajorId) {
      setSpecialists([]);
      setSelectedSpecialistId("");
      return;
    }

    const fetchSpecialists = async () => {
      try {
        setLoading(true);
        setError(null);
        const { specialists: specialistList } =
          await specialistService.getAllSpecialists({
            majorId: selectedMajorId,
            limit: 100,
            sortBy: "title",
            sortOrder: "asc",
          } as any);
        setSpecialists(specialistList as SpecialistOption[]);
        setCurrentSpecialistIndex(0);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load specialists";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchSpecialists();
  }, [currentStep, selectedMajorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== "student") {
      return;
    }
    if (!selectedMajorId || !selectedSpecialistId) {
      setError("Please choose both a major and a specialist to continue.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const updated = await userService.updateUserSpecialists(user._id, [
        selectedSpecialistId,
      ]);

      // Persist to dedicated key
      try {
        localStorage.setItem(
          STUDENT_SPECIALIST_KEY,
          JSON.stringify(updated.specialistIds ?? [selectedSpecialistId])
        );
      } catch {
        // ignore storage errors
      }

      // Also refresh stored current user if present
      try {
        const rawStored = localStorage.getItem("lms:user");
        if (rawStored) {
          const storedUser = JSON.parse(rawStored) as UserDetail;
          const merged = {
            ...storedUser,
            specialistIds: updated.specialistIds ?? [selectedSpecialistId],
          };
            localStorage.setItem("lms:user", JSON.stringify(merged));
        }
      } catch {
        // ignore
      }

      // Move to final step - completion
      setCurrentStep(3);
    } catch (err) {
      const message =
        (err as any)?.message || "Failed to save your specialist selection";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{
        backgroundColor: darkMode ? "#0f172a" : "#f3f4f6",
        color: darkMode ? "#e5e7eb" : "#111827",
      }}
    >
      <Navbar />
      <Sidebar
        role={(user?.role as "admin" | "teacher" | "student") || "student"}
      />

      <div
        className="flex flex-col flex-1 w-0 overflow-hidden"
        style={{
          paddingLeft: contentPaddingLeft,
          background:
            "radial-gradient(circle at top left, rgba(59,130,246,0.12), transparent 55%), radial-gradient(circle at bottom right, rgba(16,185,129,0.12), transparent 55%)",
        }}
      >
        <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 mt-16">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold mb-3"
                style={{
                  backgroundColor: darkMode
                    ? "rgba(59,130,246,0.15)"
                    : "rgba(59,130,246,0.08)",
                  color: darkMode ? "#bfdbfe" : "#1d4ed8",
                }}
              >
                Welcome, new student
              </span>
              <h1
                className="text-3xl font-bold mb-2"
                style={{ color: darkMode ? "#f9fafb" : "#111827" }}
              >
                Set up your study profile
              </h1>
              <p
                className="text-sm max-w-2xl"
                style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
              >
                This quick setup helps us recommend the right content for you. It only
                takes a few seconds.
              </p>
            </div>

            {/* Progress bar (TikTok-style multi step) */}
            <div className="mb-6">
              <div className="grid grid-cols-3 gap-4 text-sm">
                {[
                  {
                    id: 1,
                    title: "Major",
                    subtitle: "Choose your field",
                  },
                  {
                    id: 2,
                    title: "Specialist",
                    subtitle: "Pick your track",
                  },
                  {
                    id: 3,
                    title: "Complete",
                    subtitle: "Profile ready",
                  },
                ].map((step) => {
                  const isActive = currentStep === step.id;
                  const isCompleted = currentStep > step.id;
                  const barColor = isCompleted
                    ? "#8b5cf6"
                    : isActive
                    ? "#8b5cf6"
                    : darkMode
                    ? "#1f2933"
                    : "#e5e7eb";
                  const textColor = isActive
                    ? darkMode
                      ? "#ffffff"
                      : "#111827"
                    : darkMode
                    ? "#9ca3af"
                    : "#6b7280";

                  return (
                    <div key={step.id} className="flex flex-col">
                      <div
                        style={{
                          height: 3,
                          borderRadius: 999,
                          backgroundColor: barColor,
                        }}
                      />
                      <div className="mt-2 flex items-center gap-2">
                        {isCompleted ? (
                          <CheckCircle2
                            size={16}
                            style={{ color: "#22c55e" }}
                          />
                        ) : step.id === 1 ? (
                          <GraduationCap
                            size={16}
                            style={{ color: textColor }}
                          />
                        ) : (
                          <Sparkles size={16} style={{ color: textColor }} />
                        )}
                        <div>
                          <div
                            className="font-semibold"
                            style={{ color: textColor }}
                          >
                            {step.title}
                          </div>
                          <div
                            className="text-xs"
                            style={{
                              color: darkMode ? "#6b7280" : "#9ca3af",
                            }}
                          >
                            {step.subtitle}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="rounded-2xl shadow-lg border overflow-hidden"
              style={{
                backgroundColor: darkMode ? "#020617" : "#ffffff",
                borderColor: darkMode ? "#1e293b" : "#e5e7eb",
              }}
            >
              <div
                className="px-6 py-4 border-b flex items-center justify-between"
                style={{
                  borderColor: darkMode ? "#1e293b" : "#e5e7eb",
                  background: darkMode
                    ? "linear-gradient(to right, #020617, #0f172a)"
                    : "linear-gradient(to right, #eff6ff, #ecfdf5)",
                }}
              >
                <div>
                  <h2
                    className="text-lg font-semibold"
                    style={{ color: darkMode ? "#e5e7eb" : "#111827" }}
                  >
                    Academic profile
                  </h2>
                  <p
                    className="text-xs"
                    style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                  >
                    This helps us show you the most relevant courses,
                    announcements, and resources.
                  </p>
                </div>
                {user && (
                  <div className="hidden sm:flex items-center gap-2 text-xs">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.fullname}
                        className="h-8 w-8 rounded-full object-cover border"
                      />
                    ) : (
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold"
                        style={{
                          backgroundColor: darkMode ? "#1d4ed8" : "#3b82f6",
                          color: "#ffffff",
                        }}
                      >
                        {user.fullname?.charAt(0)?.toUpperCase() ??
                          user.username?.charAt(0)?.toUpperCase() ??
                          "S"}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span
                        className="font-medium"
                        style={{ color: darkMode ? "#e5e7eb" : "#111827" }}
                      >
                        {user.fullname || user.username}
                      </span>
                      <span
                        style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                      >
                        Student
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {error && (
                  <div
                    className="text-sm rounded-lg px-4 py-3 flex items-start gap-2"
                    style={{
                      backgroundColor: darkMode
                        ? "rgba(248,113,113,0.12)"
                        : "#fee2e2",
                      color: darkMode ? "#fecaca" : "#b91c1c",
                    }}
                  >
                    <svg
                      className="w-4 h-4 mt-0.5 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.5a.75.75 0 00-1.5 0v4a.75.75 0 001.5 0v-4zM10 13a1 1 0 100 2 1 1 0 000-2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                {currentStep === 1 && (
                  <>
                    <div className="space-y-2">
                      <div
                        className="flex items-center gap-2 text-sm font-medium"
                        style={{ color: darkMode ? "#e5e7eb" : "#111827" }}
                      >
                        <GraduationCap size={18} />
                        <span>Choose your major</span>
                      </div>
                      <p
                        className="text-xs"
                        style={{ color: darkMode ? "#6b7280" : "#9ca3af" }}
                      >
                        Pick the main field you are studying. You can scroll horizontally
                        to see all available majors.
                      </p>
                    </div>

                    {/* Majors content */}
                    <div className="mt-3 space-y-4">
                      {loading && majors.length === 0 && (
                        <div className="flex justify-center">
                          <div className="w-full max-w-3xl flex justify-center gap-4">
                            {[0, 1, 2].map((i) => (
                              <div
                                // eslint-disable-next-line react/no-array-index-key
                                key={i}
                                className="rounded-2xl border shadow-sm bg-gray-100 dark:bg-slate-800/80 dark:border-slate-700 animate-pulse"
                                style={{ width: i === 1 ? 360 : 300 }}
                              >
                                <div className="h-40 w-full bg-gray-200 dark:bg-slate-700 rounded-t-2xl" />
                                <div className="p-4 space-y-2">
                                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-slate-700 rounded" />
                                  <div className="h-3 w-full bg-gray-200 dark:bg-slate-700 rounded" />
                                  <div className="h-3 w-5/6 bg-gray-200 dark:bg-slate-700 rounded" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {!loading && majors.length > 0 && (
                        <div className="relative">
                          <div className="flex justify-center items-center">
                            <div className="relative w-full max-w-3xl flex justify-center items-center">
                              {/* Left arrow over left card */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (majors.length === 0) return;
                                  const nextIndex =
                                    (currentMajorIndex - 1 + majors.length) %
                                    majors.length;
                                  setCurrentMajorIndex(nextIndex);
                                  const major = majors[nextIndex];
                                  setSelectedMajorId(major._id);
                                  setSelectedSpecialistId("");
                                  setError(null);
                                }}
                                className="absolute left-2 md:left-4 z-30 h-9 w-9 rounded-full border flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-md"
                                style={{
                                  borderColor: darkMode ? "#1f2937" : "#e5e7eb",
                                  color: darkMode ? "#e5e7eb" : "#4b5563",
                                }}
                              >
                                ‹
                              </button>

                              {/* Cards with center card enlarged and overlapping */}
                              <div className="flex justify-center items-center">
                                {majors.map((major, index) => {
                                  const offset = index - currentMajorIndex;
                                  if (
                                    Math.abs(offset) > 1 &&
                                    majors.length > 2
                                  ) {
                                    // hide far cards for clarity
                                    return null;
                                  }
                                  const isCenter = offset === 0;
                                  const isLeft = offset === -1;
                                  const baseScale = isCenter ? 1.08 : 0.9;
                                  const translateX = isCenter
                                    ? 0
                                    : isLeft
                                    ? -80
                                    : 80;
                                  const zIndex = isCenter ? 20 : 10;
                                  const opacity = hasMounted
                                    ? isCenter
                                      ? 1
                                      : 0.75
                                    : 0;
                                  const isSelected =
                                    selectedMajorId === major._id;

                                  return (
                                    <button
                                      key={major._id}
                                      type="button"
                                      onClick={() => {
                                        setCurrentMajorIndex(index);
                                        setSelectedMajorId(major._id);
                                        setSelectedSpecialistId("");
                                        setError(null);
                                      }}
                                      className={`rounded-2xl border text-left shadow-xl transition-all duration-300 ease-out mx-[-28px] will-change-transform ${
                                        isSelected
                                          ? "ring-2 ring-purple-500 border-transparent"
                                          : ""
                                      }`}
                                      style={{
                                        width: isCenter ? 360 : 300,
                                        transform: `translateX(${translateX}px) scale(${baseScale}) translateY(${
                                          hasMounted ? 0 : 12
                                        }px)`,
                                        transition:
                                          "transform 0.38s cubic-bezier(0.22,0.61,0.36,1), opacity 0.32s ease-out, box-shadow 0.3s ease-out",
                                        zIndex,
                                        opacity,
                                        backgroundColor: darkMode
                                          ? "#020617"
                                          : "#ffffff",
                                        borderColor: darkMode
                                          ? "#1e293b"
                                          : "#e5e7eb",
                                      }}
                                    >
                                      <div className="h-40 w-full overflow-hidden rounded-t-2xl relative">
                                        <img
                                          src="https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=800"
                                          alt="Major placeholder"
                                          className="h-full w-full object-cover"
                                        />
                                        <div
                                          className="absolute inset-0"
                                          style={{
                                            background:
                                              "linear-gradient(to top, rgba(15,23,42,0.8), transparent)",
                                          }}
                                        />
                                      </div>
                                      <div className="p-4 space-y-1 min-h-[96px]">
                                        <div className="flex items-center justify-between gap-2">
                                          <span
                                            className="text-sm font-semibold"
                                            style={{
                                              color: darkMode
                                                ? "#e5e7eb"
                                                : "#111827",
                                            }}
                                          >
                                            {major.name}
                                          </span>
                                          {isSelected && (
                                            <CheckCircle2
                                              size={18}
                                              style={{ color: "#22c55e" }}
                                            />
                                          )}
                                        </div>
                                        <p
                                          className="text-xs line-clamp-3"
                                          style={{
                                            color: darkMode
                                              ? "#9ca3af"
                                              : "#6b7280",
                                          }}
                                        >
                                          {major.description ||
                                            "Explore this major to see courses and learning paths tailored to this field."}
                                        </p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Right arrow over right card */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (majors.length === 0) return;
                                  const nextIndex =
                                    (currentMajorIndex + 1) % majors.length;
                                  setCurrentMajorIndex(nextIndex);
                                  const major = majors[nextIndex];
                                  setSelectedMajorId(major._id);
                                  setSelectedSpecialistId("");
                                  setError(null);
                                }}
                                className="absolute right-2 md:right-4 z-30 h-9 w-9 rounded-full border flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-md"
                                style={{
                                  borderColor: darkMode ? "#1f2937" : "#e5e7eb",
                                  color: darkMode ? "#e5e7eb" : "#4b5563",
                                }}
                              >
                                ›
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {!loading && majors.length === 0 && (
                        <div
                          className="text-xs rounded-xl px-4 py-3 border"
                          style={{
                            backgroundColor: darkMode
                              ? "rgba(15,23,42,0.7)"
                              : "#f9fafb",
                            borderColor: darkMode ? "#1f2937" : "#e5e7eb",
                            color: darkMode ? "#9ca3af" : "#6b7280",
                          }}
                        >
                          No majors available yet. Please contact an
                          administrator.
                        </div>
                      )}
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <p
                        className="text-xs"
                        style={{ color: darkMode ? "#6b7280" : "#9ca3af" }}
                      >
                        You can review or change this with your advisor later.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedMajorId) {
                            setError("Please choose a major to continue.");
                            return;
                          }
                          setCurrentStep(2);
                          setError(null);
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
                        style={{
                          backgroundColor: darkMode ? "#4f46e5" : "#6366f1",
                          color: "#ffffff",
                        }}
                      >
                        Next
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </>
                )}

                {currentStep === 2 && (
                  <>
                    <div className="space-y-2">
                      <div
                        className="flex items-center gap-2 text-sm font-medium"
                        style={{ color: darkMode ? "#e5e7eb" : "#111827" }}
                      >
                        <Sparkles size={18} />
                        <span>Choose your specialist</span>
                      </div>
                      <p
                        className="text-xs"
                        style={{ color: darkMode ? "#6b7280" : "#9ca3af" }}
                      >
                        Within your major, pick the track that best fits your interests.
                      </p>
                    </div>

                    <div className="mt-3 space-y-4">
                      {!selectedMajorId ? (
                        <p
                          className="text-xs rounded-xl px-4 py-3 border"
                          style={{
                            backgroundColor: darkMode
                              ? "rgba(15,23,42,0.7)"
                              : "#f9fafb",
                            borderColor: darkMode ? "#1f2937" : "#e5e7eb",
                            color: darkMode ? "#9ca3af" : "#6b7280",
                          }}
                        >
                          Select a major first to see available specialists.
                        </p>
                      ) : specialists.length === 0 ? (
                        <p
                          className="text-xs rounded-xl px-4 py-3 border"
                          style={{
                            backgroundColor: darkMode
                              ? "rgba(15,23,42,0.7)"
                              : "#f9fafb",
                            borderColor: darkMode ? "#1f2937" : "#e5e7eb",
                            color: darkMode ? "#9ca3af" : "#6b7280",
                          }}
                        >
                          No specialists found for this major yet. Please contact
                          an administrator.
                        </p>
                      ) : loading && specialists.length === 0 ? (
                        <div className="flex justify-center">
                          <div className="w-full max-w-3xl flex justify-center gap-4">
                            {[0, 1, 2].map((i) => (
                              // eslint-disable-next-line react/no-array-index-key
                              <div
                                key={i}
                                className="rounded-2xl border shadow-sm bg-gray-100 dark:bg-slate-800/80 dark:border-slate-700 animate-pulse"
                                style={{ width: i === 1 ? 360 : 300 }}
                              >
                                <div className="h-40 w-full bg-gray-200 dark:bg-slate-700 rounded-t-2xl" />
                                <div className="p-4 space-y-2">
                                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-slate-700 rounded" />
                                  <div className="h-3 w-full bg-gray-200 dark:bg-slate-700 rounded" />
                                  <div className="h-3 w-5/6 bg-gray-200 dark:bg-slate-700 rounded" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="flex justify-center items-center">
                            <div className="relative w-full max-w-3xl flex justify-center items-center">
                              {/* Left arrow */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (specialists.length === 0) return;
                                  const nextIndex =
                                    (currentSpecialistIndex - 1 + specialists.length) %
                                    specialists.length;
                                  setCurrentSpecialistIndex(nextIndex);
                                  const spec = specialists[nextIndex];
                                  setSelectedSpecialistId(spec._id);
                                  setError(null);
                                }}
                                className="absolute left-2 md:left-4 z-30 h-9 w-9 rounded-full border flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-md"
                                style={{
                                  borderColor: darkMode ? "#1f2937" : "#e5e7eb",
                                  color: darkMode ? "#e5e7eb" : "#4b5563",
                                }}
                              >
                                ‹
                              </button>

                              {/* Cards */}
                              <div className="flex justify-center items-center">
                                {specialists.map((spec, index) => {
                                  const offset = index - currentSpecialistIndex;
                                  if (
                                    Math.abs(offset) > 1 &&
                                    specialists.length > 2
                                  ) {
                                    return null;
                                  }
                                  const isCenter = offset === 0;
                                  const isLeft = offset === -1;
                                  const baseScale = isCenter ? 1.06 : 0.9;
                                  const translateX = isCenter
                                    ? 0
                                    : isLeft
                                    ? -80
                                    : 80;
                                  const zIndex = isCenter ? 20 : 10;
                                  const opacity = hasMounted ? (isCenter ? 1 : 0.75) : 0;
                                  const isSelected =
                                    selectedSpecialistId === spec._id;

                                  return (
                                    <button
                                      key={spec._id}
                                      type="button"
                                      onClick={() => {
                                        setCurrentSpecialistIndex(index);
                                        setSelectedSpecialistId(spec._id);
                                        setError(null);
                                      }}
                                      className={`rounded-2xl border text-left shadow-xl transition-all duration-300 ease-out mx-[-28px] will-change-transform ${
                                        isSelected
                                          ? "ring-2 ring-purple-500 border-transparent"
                                          : ""
                                      }`}
                                      style={{
                                        width: isCenter ? 360 : 300,
                                        transform: `translateX(${translateX}px) scale(${baseScale}) translateY(${
                                          hasMounted ? 0 : 12
                                        }px)`,
                                        transition:
                                          "transform 0.38s cubic-bezier(0.22,0.61,0.36,1), opacity 0.32s ease-out, box-shadow 0.3s ease-out",
                                        zIndex,
                                        opacity,
                                        backgroundColor: darkMode
                                          ? "#020617"
                                          : "#ffffff",
                                        borderColor: darkMode
                                          ? "#1e293b"
                                          : "#e5e7eb",
                                      }}
                                    >
                                      <div className="h-40 w-full overflow-hidden rounded-t-2xl relative">
                                        <img
                                          src="https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=800"
                                          alt="Specialist placeholder"
                                          className="h-full w-full object-cover"
                                        />
                                        <div
                                          className="absolute inset-0"
                                          style={{
                                            background:
                                              "linear-gradient(to top, rgba(15,23,42,0.8), transparent)",
                                          }}
                                        />
                                      </div>
                                      <div className="p-4 space-y-1 min-h-[96px]">
                                        <div className="flex items-center justify-between gap-2">
                                          <span
                                            className="text-sm font-semibold"
                                            style={{
                                              color: darkMode
                                                ? "#e5e7eb"
                                                : "#111827",
                                            }}
                                          >
                                            {spec.name}
                                          </span>
                                          {isSelected && (
                                            <CheckCircle2
                                              size={18}
                                              style={{ color: "#22c55e" }}
                                            />
                                          )}
                                        </div>
                                        <p
                                          className="text-xs line-clamp-3"
                                          style={{
                                            color: darkMode
                                              ? "#9ca3af"
                                              : "#6b7280",
                                          }}
                                        >
                                          {spec.description || "Specialist track within your major, e.g. AI, Web Development or Data Science."}
                                        </p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Right arrow */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (specialists.length === 0) return;
                                  const nextIndex =
                                    (currentSpecialistIndex + 1) %
                                    specialists.length;
                                  setCurrentSpecialistIndex(nextIndex);
                                  const spec = specialists[nextIndex];
                                  setSelectedSpecialistId(spec._id);
                                  setError(null);
                                }}
                                className="absolute right-2 md:right-4 z-30 h-9 w-9 rounded-full border flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-md"
                                style={{
                                  borderColor: darkMode ? "#1f2937" : "#e5e7eb",
                                  color: darkMode ? "#e5e7eb" : "#4b5563",
                                }}
                              >
                                ›
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedSpecialistId && (
                      <div
                        className="mt-3 rounded-lg border px-3 py-2 text-xs"
                        style={{
                          backgroundColor: darkMode
                            ? "rgba(37,99,235,0.12)"
                            : "#eff6ff",
                          borderColor: darkMode ? "#1d4ed8" : "#bfdbfe",
                          color: darkMode ? "#bfdbfe" : "#1d4ed8",
                        }}
                      >
                        <span className="font-semibold">Nice pick!</span> We’ll
                        tailor courses and materials to this specialist track.
                      </div>
                    )}

                    <div className="pt-4 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="text-xs underline"
                        style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                      >
                        Back to majors
                      </button>
                      <button
                        type="submit"
                        disabled={
                          loading ||
                          !selectedMajorId ||
                          !selectedSpecialistId
                        }
                        className="px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
                        style={{
                          backgroundColor: darkMode ? "#2563eb" : "#3b82f6",
                          color: "#ffffff",
                        }}
                      >
                        {loading ? (
                          <>
                            <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            Finish setup
                            <ArrowRight size={16} />
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}

                {currentStep === 3 && (
                  <>
                    <div className="space-y-3">
                      <div
                        className="flex items-center gap-2 text-sm font-medium"
                        style={{ color: darkMode ? "#e5e7eb" : "#111827" }}
                      >
                        <CheckCircle2 size={18} />
                        <span>Profile setup complete</span>
                      </div>
                      <p
                        className="text-xs"
                        style={{ color: darkMode ? "#6b7280" : "#9ca3af" }}
                      >
                        Your major and specialist are saved. We’ll use this to
                        personalize your dashboard, courses, and notifications.
                      </p>
                      <div
                        className="mt-2 rounded-xl px-4 py-3 text-xs flex items-center gap-2"
                        style={{
                          backgroundColor: darkMode
                            ? "rgba(22,163,74,0.12)"
                            : "#dcfce7",
                          color: darkMode ? "#bbf7d0" : "#166534",
                        }}
                      >
                        <Sparkles size={16} />
                        <span>
                          Tip: you can always ask an administrator to adjust
                          your specialization later if your interests change.
                        </span>
                      </div>
                    </div>
                    <div className="pt-4 flex items-center justify-between">
                      <p
                        className="text-xs"
                        style={{ color: darkMode ? "#6b7280" : "#9ca3af" }}
                      >
                        Ready to start learning?
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate("/student-dashboard")}
                        className="px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2"
                        style={{
                          backgroundColor: darkMode ? "#2563eb" : "#3b82f6",
                          color: "#ffffff",
                        }}
                      >
                        Go to dashboard
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Onboarding;


