import React, { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import type { Course } from "../../types/course";
import { courseService } from "../../services";
import { forumService, type CreateForumPayload, type ForumType } from "../../services/forumService";
import { Book, Flame, Loader2, MessageSquare, MessageSquareText, Sparkles, Users } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import MarkdownComposer from "../../components/markdown/MarkdownComposer";
import toast from "react-hot-toast";


type SidebarRole = "admin" | "teacher" | "student";

const forumTypeOptions: Array<{
  value: ForumType;
  label: string;
  hint: string;
}> = [
  {
    value: "discussion",
    label: "Open discussion",
    hint: "Share ideas, experiences, and learning resources with classmates.",
  },
  {
    value: "announcement",
    label: "Announcement",
    hint: "Post important reminders or updates for the whole class.",
  },
];

interface ForumLocationState {
  preselectedCourseId?: string;
  preselectedCourseTitle?: string;
}

interface CreateForumFormState extends CreateForumPayload {
  file: File | null;
}

const ForumPage: React.FC = () => {
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams();
  const locationState = (location.state as ForumLocationState | null) ?? null;
  const searchCourseId = searchParams.get("courseId") ?? "";
  const searchCourseTitle = searchParams.get("courseTitle") ?? "";
  const initialCourseId = locationState?.preselectedCourseId || searchCourseId;
  const initialCourseTitle = locationState?.preselectedCourseTitle || searchCourseTitle;
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseLoading, setCourseLoading] = useState(true);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateForumFormState>({
    courseId: initialCourseId || "",
    title: "",
    description: "",
    forumType: "discussion",
    isActive: true,
    file: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const createCardRef = useRef<HTMLDivElement | null>(null);
  const [showCreateSticky, setShowCreateSticky] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setCourseLoading(true);
        const response = await courseService.getAllCourses({ limit: 100, sortBy: "title", sortOrder: "asc" });
        const normalized = Array.isArray(response.courses) ? response.courses.filter(Boolean) : [];
        if (!mounted) return;
        setCourses(normalized);
        setCourseError(null);
      } catch (error) {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : "Unable to load course list";
        setCourseError(message);
        setCourses([]);
      } finally {
        if (mounted) setCourseLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    const target = createCardRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowCreateSticky(!entry.isIntersecting),
      { threshold: 0.9 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const selectedCourse = useMemo(
    () => courses.find((course) => course._id === form.courseId) ?? null,
    [courses, form.courseId]
  );
  const hasLockedCourse = Boolean(form.courseId);
  const lockedCourseTitle = selectedCourse?.title || initialCourseTitle || "";
  const courseTitleDisplay = lockedCourseTitle || (hasLockedCourse ? "Course" : "");
  const courseDescriptionDisplay =
    selectedCourse?.description ||
    (hasLockedCourse ? "Forum topics are visible to every participant enrolled in this course." : "");

  useEffect(() => {
    if (!initialCourseId) return;
    setForm((prev) => (prev.courseId === initialCourseId ? prev : { ...prev, courseId: initialCourseId }));
  }, [initialCourseId]);

  // Keep URL in sync so reloads preserve the locked course context.
  useEffect(() => {
    if (!initialCourseId) return;
    const shouldUpdateCourseId = searchCourseId !== initialCourseId;
    const shouldUpdateTitle = lockedCourseTitle ? searchCourseTitle !== lockedCourseTitle : Boolean(searchCourseTitle);
    if (!shouldUpdateCourseId && !shouldUpdateTitle) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("courseId", initialCourseId);
    if (lockedCourseTitle) {
      nextParams.set("courseTitle", lockedCourseTitle);
    } else {
      nextParams.delete("courseTitle");
    }
    setSearchParams(nextParams, { replace: true });
  }, [initialCourseId, lockedCourseTitle, searchCourseId, searchCourseTitle, searchParams, setSearchParams]);

  const sidebarRole: SidebarRole =
    user && ["admin", "teacher", "student"].includes(user.role)
      ? (user.role as SidebarRole)
      : "student";
  const isStudent = user?.role === "student";

  useEffect(() => {
    if (!isStudent) return;
    setForm((prev) => (prev.forumType === "discussion" ? prev : { ...prev, forumType: "discussion" }));
  }, [isStudent]);

  const setFormValue = <K extends keyof CreateForumFormState>(key: K, value: CreateForumFormState[K]) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!form.courseId) {
      const message =
        'Open the course detail page and use "Create Forum Post" to start a topic.';
      setFeedback({ type: "error", message });
      toast.error(message);
      return;
    }

    if (!form.title.trim() || !form.description.trim()) {
      const message = "Please enter both a title and a description.";
      setFeedback({ type: "error", message });
      toast.error(message);
      return;
    }

    try {
      setSubmitting(true);
      const payload: CreateForumPayload = {
        courseId: form.courseId,
        title: form.title.trim(),
        description: form.description.trim(),
        forumType: form.forumType,
        isActive: form.isActive,
      };
      await forumService.createForum(payload, form.file || undefined);

      const successMessage = "Forum topic created successfully.";
      setFeedback({ type: "success", message: successMessage });
      toast.success(successMessage);
      setForm((prev) => ({
        ...prev,
        title: "",
        description: "",
        file: null,
      }));

      // Redirect to forum list with the same course preselected so user can see the new topic
      navigate("/forum-list", {
        state: {
          preselectedCourseId: form.courseId,
          preselectedCourseTitle: lockedCourseTitle || "",
        },
      });

    } catch (error: any) {
      // Ưu tiên đọc lỗi từ API (validation error, v.v.)
      const apiData = error?.response?.data;
      const apiMessage: string | undefined = apiData?.message;
      const fieldErrors: Array<{ path?: string | string[]; message?: string }> =
        apiData?.errors ?? [];

      let finalMessage = apiMessage || "Unable to create forum topic";

      if (fieldErrors.length > 0) {
        // Hiển thị toast cho từng lỗi field
        fieldErrors.forEach((err) => {
          const path =
            Array.isArray(err.path) && err.path.length > 0
              ? err.path.join(".")
              : typeof err.path === "string"
              ? err.path
              : "";
          const msg = err.message || apiMessage || "Invalid input";
          toast.error(path ? `${path}: ${msg}` : msg);
        });
        // Gộp message chính để show ở feedback box
        finalMessage =
          apiMessage ||
          fieldErrors.map((e) => e.message).filter(Boolean).join(", ") ||
          finalMessage;
      } else if (apiMessage) {
        toast.error(apiMessage);
        finalMessage = apiMessage;
      } else if (error instanceof Error && error.message) {
        toast.error(error.message);
        finalMessage = error.message;
      } else {
        toast.error(finalMessage);
      }

      setFeedback({ type: "error", message: finalMessage });
    } finally {
      setSubmitting(false);
    }
  };

  const containerStyles = {
    backgroundColor: darkMode ? "#0f172a" : "#f8fafc",
    // Default text color: white in dark mode, slate-900 in light mode
    color: darkMode ? "#ffffff" : "#0f172a",
  };

  const panelStyles = darkMode
    ? "bg-slate-900/70 border border-slate-700/60"
    : "bg-white border border-slate-100";

  return (
    <div className="flex h-screen overflow-hidden relative" style={containerStyles}>
      <Navbar />
      <Sidebar role={sidebarRole} />

      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 mt-16 sm:pl-24 md:pl-28">
          <div className="max-w-6xl mx-auto space-y-6 pb-12">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-2xl uppercase tracking-wide text-indigo-500 font-semibold">Create Forum Topic</p>
               
                
              </div>
              <div
                className={`flex items-center gap-3 rounded-2xl px-5 py-3 shadow-lg ${darkMode ? "bg-indigo-600/20 border border-indigo-500/30" : "bg-indigo-50 border border-indigo-100"}`}
              >
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <div>
                  <p className="text-xs text-slate-500 uppercase">Active members</p>
                  <p className="text-lg font-semibold">+24 in 24h</p>
                </div>
              </div>
            </header>

            {/* Sticky summary header for selected course when form scrolls out of view */}
            {showCreateSticky && (
              <div className="sticky top-0 z-20 mb-4">
                <div
                  className={`rounded-2xl border px-4 py-3 shadow-lg flex items-center gap-3 ${
                    darkMode
                      ? "bg-slate-900/90 border-slate-700/80 backdrop-blur"
                      : "bg-white/95 border-slate-200 backdrop-blur"
                  }`}
                >
                  <Book className="w-4 h-4 text-indigo-500" />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-indigo-500 font-semibold">Course</p>
                    <p
                      className={`text-sm font-semibold truncate ${
                        darkMode ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {courseTitleDisplay || "Select a course to start"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
              <section className="space-y-6">
                <div className={`rounded-2xl p-6 shadow-sm ${panelStyles}`} ref={createCardRef}>
                  

                  <form className="space-y-5" onSubmit={handleSubmit}>
                    

                    <div>
                      <label className="block text-sm font-medium mb-2">Title</label>
                      <input
                        type="text"
                        className={`w-full rounded-xl border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                          darkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
                        } ${hasLockedCourse ? "" : "opacity-50 cursor-not-allowed"}`}
                        placeholder="Example: Discussion for project week 5"
                        value={form.title}
                        onChange={(event) => setFormValue("title", event.target.value)}
                        disabled={!hasLockedCourse}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Description</label>
                      <MarkdownComposer
                        value={form.description}
                        onChange={(next) => setFormValue("description", next)}
                        placeholder="Share context, questions, or any resources the class should review together..."
                        darkMode={darkMode}
                        attachment={hasLockedCourse ? form.file : null}
                        onAttachmentChange={
                          hasLockedCourse ? (file) => setForm((prev) => ({ ...prev, file })) : undefined
                        }
                        attachmentAccept="image/*"
                        disabled={!hasLockedCourse}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Topic type</label>
                      <div className="grid gap-3 md:grid-cols-2">
                        {forumTypeOptions.map((option) => {
                          const isActive = form.forumType === option.value;
                          const disabledOption = !hasLockedCourse || (isStudent && option.value !== "discussion");
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                if (disabledOption) return;
                                setFormValue("forumType", option.value);
                              }}
                              disabled={disabledOption}
                              className={`text-left p-4 rounded-xl border transition-all ${
                                isActive
                                  ? darkMode
                                    ? "border-indigo-400 bg-indigo-500/20 text-white"
                                    : "border-indigo-400 bg-indigo-50 text-slate-900"
                                  : darkMode
                                  ? "border-slate-700 hover:border-slate-500 text-slate-200"
                                  : "border-slate-200 hover:border-slate-300 text-slate-700"
                              } ${disabledOption ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              <p className="font-semibold">{option.label}</p>
                              <p
                                className={`text-sm mt-1 ${
                                  darkMode ? "text-slate-300" : "text-slate-500"
                                }`}
                              >
                                {option.hint}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                      {isStudent && (
                        <p className="text-sm text-slate-500 mt-1">
                          Students can only create open discussions. Announcements are reserved for teachers and admins.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t pt-4 border-dashed border-slate-200 dark:border-slate-700">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={form.isActive}
                          onChange={(event) => setFormValue("isActive", event.target.checked)}
                          disabled={!hasLockedCourse}
                        />
                        <span className="text-sm">Allow everyone in the course to participate (active)</span>
                      </label>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-white font-semibold hover:bg-indigo-500 disabled:opacity-50"
                        disabled={submitting || courseLoading || !hasLockedCourse}
                      >
                        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        Publish topic
                      </button>
                    </div>
                  </form>
                </div>

              </section>

              <aside className="space-y-6">
                <div className={`rounded-2xl p-6 shadow-sm ${panelStyles}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-slate-400 uppercase">Current course</p>
                      <h3 className="text-xl font-semibold mt-1">Your discussion space</h3>
                    </div>
                    <Flame className="w-8 h-8 text-rose-400" />
                  </div>
                  {selectedCourse ? (
                    <>
                      <p className="font-semibold text-lg">{selectedCourse.title}</p>
                      <p className="text-sm text-slate-500 mt-2 line-clamp-3">
                        {courseDescriptionDisplay}
                      </p>
                      <div className="mt-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-sky-500/10 p-4 text-sm text-slate-500">
                        Tip: concise titles and clear descriptions help classmates respond faster.
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">There is no course selected to create a topic yet.</p>
                  )}
                </div>

                <div className={`rounded-2xl p-6 shadow-sm ${panelStyles}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-semibold">Quick guide</h3>
                  </div>
                  <p className="text-sm text-slate-500">
                    Only admins or teachers can launch the forum from a course page. To create a topic, open the course, click
                    <span className="font-medium"> "Create Forum Post"</span>, and you will be redirected here with that course preselected.
                  </p>
                </div>

                <div className={`rounded-2xl p-6 shadow-sm ${panelStyles}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-semibold">Community rules</h3>
                  </div>
                  <ul className="space-y-3 text-sm text-slate-500">
                    <li>• Stay on learning topics and respect classmates.</li>
                    <li>• Link to the course material or resources when relevant.</li>
                    <li>• Mark resolved questions so others can find answers quickly.</li>
                  </ul>
                </div>
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ForumPage;

