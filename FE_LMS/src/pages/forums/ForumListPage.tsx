import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import type { Course } from "../../types/course";
import { courseService } from "../../services";
import AttachmentPreview from "../../components/common/AttachmentPreview";
import { forumService, type ForumResponse, type ForumType } from "../../services/forumService";
import { Edit3, Eye, Loader2, RefreshCcw, Trash2, X, User } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import MarkdownComposer from "../../components/markdown/MarkdownComposer";
import MarkdownContent from "../../components/markdown/MarkdownContent";

type SidebarRole = "admin" | "teacher" | "student";

const forumTypeLabels: Record<ForumType, string> = {
  discussion: "Discussion",
  announcement: "Announcement",
};

const attachmentAcceptTypes = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z,image/*";

type CourseSnapshot = Pick<Course, "_id"> & Partial<Omit<Course, "_id">>;

interface ForumListLocationState {
  preselectedCourseId?: string;
  preselectedCourseTitle?: string;
}

const ForumListPage: React.FC = () => {
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const locationState = (location.state as ForumListLocationState | null) ?? null;
  const locationCourseId = locationState?.preselectedCourseId ?? "";
  const locationCourseTitle = locationState?.preselectedCourseTitle ?? "";
  const searchCourseId = searchParams.get("courseId") ?? "";
  const searchCourseTitle = searchParams.get("courseTitle") ?? "";
  const sidebarRole: SidebarRole =
    user && ["admin", "teacher", "student"].includes(user.role) ? (user.role as SidebarRole) : "student";
  const canManage = user?.role === "admin" || user?.role === "teacher";

  const getInitials = (input?: string) => {
    if (!input) return "U";
    const trimmed = input.trim();
    if (!trimmed) return "U";
    return (
      trimmed
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((segment) => segment[0]?.toUpperCase() || "")
        .join("") || "U"
    );
  };

  const imageExtensions = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg"]);

  const getFileExtension = (fileUrl: string): string => {
    const sanitized = fileUrl.split(/[?#]/)[0];
    const lastSegment = sanitized.split("/").pop() || "";
    const hasExtension = lastSegment.includes(".");
    return hasExtension ? lastSegment.split(".").pop()?.toLowerCase() || "" : "";
  };

  const getFirstImageUrl = (files?: string[]): string | null => {
    if (!files || files.length === 0) return null;
    for (const fileUrl of files) {
      const extension = getFileExtension(fileUrl);
      if (extension && imageExtensions.has(extension)) {
        return fileUrl;
      }
    }
    return null;
  };

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseLoading, setCourseLoading] = useState(true);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState(() => {
    return localStorage.getItem("selectedCourseId") || null;
  });
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [debouncedCourseSearch, setDebouncedCourseSearch] = useState("");
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
  const [selectedCourseSnapshot, setSelectedCourseSnapshot] = useState<CourseSnapshot | null>(null);

  const [forums, setForums] = useState<ForumResponse[]>([]);
  const [forumsLoading, setForumsLoading] = useState(false);
  const [forumsError, setForumsError] = useState<string | null>(null);

  const [detailModal, setDetailModal] = useState<{ loading: boolean; forum: ForumResponse | null }>({
    loading: false,
    forum: null,
  });
  const [editModal, setEditModal] = useState<{
    open: boolean;
    forum: ForumResponse | null;
    title: string;
    description: string;
    forumType: ForumType;
    isActive: boolean;
    saving: boolean;
    error?: string | null;
    file: File | null;
  }>({
    open: false,
    forum: null,
    title: "",
    description: "",
    forumType: "discussion",
    isActive: true,
    saving: false,
    error: null,
    file: null,
  });

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    forum: ForumResponse | null;
    loading: boolean;
    error: string | null;
  }>({
    open: false,
    forum: null,
    loading: false,
    error: null,
  });


  const courseDropdownRef = useRef<HTMLDivElement | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<{ src: string; alt?: string } | null>(null);
  const handleAttachmentPreview = useCallback((payload: { src: string; alt?: string }) => {
    setAttachmentPreview(payload);
  }, []);

  useEffect(() => {
    const preselectedCourseId = locationCourseId || searchCourseId;
    if (!preselectedCourseId) return;
    setSelectedCourseId((current) => (current === preselectedCourseId ? current : preselectedCourseId));

    const preselectedTitle = locationCourseTitle || searchCourseTitle;
    if (preselectedTitle) {
      setSelectedCourseSnapshot((prev) => {
        if (prev && prev._id === preselectedCourseId && prev.title === preselectedTitle) {
          return prev;
        }
        return {
          ...(prev && prev._id === preselectedCourseId ? prev : {}),
          _id: preselectedCourseId,
          title: preselectedTitle,
          description: prev?.description ?? "",
        };
      });
    }
  }, [locationCourseId, locationCourseTitle, searchCourseId, searchCourseTitle]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setCourseLoading(true);
        const result = await courseService.getAllCourses({
          limit: 20,
          sortBy: "title",
          sortOrder: "asc",
          search: debouncedCourseSearch || undefined,
        });
        const normalized = Array.isArray(result.courses) ? result.courses.filter(Boolean) : [];
        if (!mounted) return;
        setCourses(normalized);
        setCourseError(null);
        if (!selectedCourseId && normalized.length > 0) {
          setSelectedCourseId(normalized[0]._id);
          setSelectedCourseSnapshot(normalized[0]);
        } else if (selectedCourseId) {
          const match = normalized.find((course) => course._id === selectedCourseId);
          if (match) setSelectedCourseSnapshot(match);
        }
      } catch (error) {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : "Unable to load courses";
        setCourseError(message);
        setCourses([]);
      } finally {
        if (mounted) setCourseLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [debouncedCourseSearch, selectedCourseId]);
  useEffect(() => {
    if (selectedCourseId) {
      localStorage.setItem("selectedCourseId", selectedCourseId);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedCourseSearch(courseSearchQuery.trim());
    }, 300);
    return () => clearTimeout(timeout);
  }, [courseSearchQuery]);
  const refreshForums = useCallback(async () => {
    if (!selectedCourseId) {
      setForums([]);
      return;
    }
    try {
      setForumsLoading(true);
      // Load all forums (both active and inactive) for the selected course
      const data = await forumService.getForums({ courseId: selectedCourseId });
      setForums(data);
      setForumsError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load forums";
      setForums([]);
      setForumsError(message);
    } finally {
      setForumsLoading(false);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    refreshForums();
  }, [refreshForums]);

  const selectedCourse = useMemo<CourseSnapshot | null>(() => {
    const fromList = courses.find((course) => course._id === selectedCourseId);
    if (fromList) return fromList;
    if (selectedCourseSnapshot && selectedCourseSnapshot._id === selectedCourseId) {
      return selectedCourseSnapshot;
    }
    return null;
  }, [courses, selectedCourseId, selectedCourseSnapshot]);

  useEffect(() => {
    if (courseDropdownOpen) return;
    if (selectedCourse?.title) {
      setCourseSearchQuery(selectedCourse.title);
    } else if (!selectedCourse) {
      setCourseSearchQuery("");
    }
  }, [selectedCourse, courseDropdownOpen]);

  useEffect(() => {
    if (!courseDropdownOpen) return;
    const handler = (event: MouseEvent) => {
      if (!courseDropdownRef.current) return;
      if (!courseDropdownRef.current.contains(event.target as Node)) {
        setCourseDropdownOpen(false);
        if (selectedCourse?.title) {
          setCourseSearchQuery(selectedCourse.title);
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [courseDropdownOpen, selectedCourse]);

  useEffect(() => {
    if (!attachmentPreview) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAttachmentPreview(null);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [attachmentPreview]);

  const handleCourseSelect = (course: Course) => {
    setSelectedCourseId(course._id);
    setSelectedCourseSnapshot(course);
    setCourseDropdownOpen(false);
    setCourseSearchQuery(course.title);
  };

  const openDetailModal = async (forumId: string) => {
    setDetailModal({ loading: true, forum: null });
    try {
      const data = await forumService.getForumById(forumId);
      setDetailModal({ loading: false, forum: data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load forum detail";
      setDetailModal({ loading: false, forum: null });
      toast.error(message);
    }
  };

  const closeDetailModal = () => setDetailModal({ loading: false, forum: null });

  const openEditModal = (forum: ForumResponse) => {
    if (!canManage) return;
    setEditModal({
      open: true,
      forum,
      title: forum.title,
      description: forum.description,
      forumType: forum.forumType,
      isActive: forum.isActive,
      saving: false,
      error: null,
      file: null,
    });
  };

  const closeEditModal = () =>
    setEditModal({
      open: false,
      forum: null,
      title: "",
      description: "",
      forumType: "discussion",
      isActive: true,
      saving: false,
      error: null,
      file: null,
    });

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editModal.forum) return;
    try {
      setEditModal((prev) => ({ ...prev, saving: true, error: null }));
      await forumService.updateForum(
        editModal.forum._id,
        {
          title: editModal.title.trim(),
          description: editModal.description.trim(),
          forumType: editModal.forumType,
          isActive: editModal.isActive,
        },
        editModal.file || undefined
      );
      toast.success("Forum updated successfully.");
      closeEditModal();
      refreshForums();
    } catch (error: any) {
      const apiData = error?.response?.data;
      const apiMessage: string | undefined = apiData?.message;
      const fieldErrors: Array<{ path?: string | string[]; message?: string }> =
        apiData?.errors ?? [];

      let finalMessage = apiMessage || "Unable to update forum";

      if (fieldErrors.length > 0) {
        fieldErrors.forEach((e) => {
          const path =
            Array.isArray(e.path) && e.path.length > 0
              ? e.path.join(".")
              : typeof e.path === "string"
              ? e.path
              : "";
          const msg = e.message || apiMessage || "Invalid input";
          toast.error(path ? `${path}: ${msg}` : msg);
        });
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

      setEditModal((prev) => ({ ...prev, saving: false, error: finalMessage }));
    }
  };

  const handleCreateForumFromList = () => {
    if (!selectedCourseId || !selectedCourse) {
      toast.error("Please select a course first.");
      return;
    }
    const courseTitle = selectedCourse.title ?? "Course";
    navigate("/forum", {
      state: {
        preselectedCourseId: selectedCourseId,
        preselectedCourseTitle: courseTitle,
      },
    });
  };

  const openDeleteModal = (forum: ForumResponse) => {
    if (!canManage) return;
    setDeleteModal({ open: true, forum, loading: false, error: null });
  };

  const closeDeleteModal = () => setDeleteModal({ open: false, forum: null, loading: false, error: null });

  const handleDelete = async () => {
    if (!canManage || !deleteModal.forum) return;
    try {
      setDeleteModal((prev) => ({ ...prev, loading: true, error: null }));
      await forumService.deleteForum(deleteModal.forum._id);
      toast.success("Forum deleted successfully.");
      closeDeleteModal();
      refreshForums();
    } catch (error: any) {
      let message = "Unable to delete forum";

      // Check for specific error messages from the API
      if (error?.response?.data?.message) {
        message = error.response.data.message;
      } else if (error instanceof Error) {
        message = error.message;
      }

      // Show error in toast popup and close modal
      toast.error(message);
      closeDeleteModal();
    }
  };

  const pageBackground = {
    backgroundColor: darkMode ? "#0f172a" : "#f8fafc",
    // Default text color: white in dark mode, slate-900 in light mode
    color: darkMode ? "#ffffff" : "#0f172a",
  };

  const panelStyles = darkMode
    ? "bg-slate-900/70 border border-slate-700/60"
    : "bg-white border border-slate-100";

  return (
    <div className="flex h-screen overflow-hidden relative" style={pageBackground}>
      <Navbar />
      <Sidebar role={sidebarRole} />

      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 mt-16 sm:pl-24 md:pl-28">
          <div className="max-w-6xl mx-auto space-y-6 pb-16">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-4x1 uppercase tracking-wide text-indigo-500 font-semibold">Forums</p>
                <h1 className="text-2xl font-bold mt-1">All topics for your courses</h1>

              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleCreateForumFromList}
                  disabled={!selectedCourseId}
                  className="bg-[#ffcf59] text-[#1c1c1c] font-semibold px-4 py-2 rounded-lg hover:scale-105 transition disabled:opacity-50"
                >
                  Create Forum Post
                </button>
                <button
                  type="button"
                  onClick={refreshForums}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-white font-semibold hover:bg-indigo-500 disabled:opacity-60"
                  disabled={forumsLoading || !selectedCourseId}
                >
                  <RefreshCcw className={`w-4 h-4 ${forumsLoading ? "animate-spin" : ""}`} />

                </button>
              </div>
            </header>


            <section className={`rounded-2xl p-6 shadow-sm ${panelStyles}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm text-slate-400 uppercase">Course filter</p>
                  <h2 className="text-xl font-semibold">{selectedCourse?.title || "Select a course"}</h2>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <div className="w-full sm:w-80 space-y-2" ref={courseDropdownRef}>
                    <label className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Search course</label>
                    <div className="relative">
                      <input
                        type="text"
                        className={`w-full rounded-2xl border px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${darkMode ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
                          }`}
                        placeholder="Type course title..."
                        value={courseSearchQuery}
                        onChange={(event) => {
                          setCourseSearchQuery(event.target.value);
                          setCourseDropdownOpen(true);
                        }}
                        onFocus={() => setCourseDropdownOpen(true)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            if (courses[0]) {
                              handleCourseSelect(courses[0]);
                            }
                          }
                          if (event.key === "Escape") {
                            setCourseDropdownOpen(false);
                            if (selectedCourse?.title) {
                              setCourseSearchQuery(selectedCourse.title);
                            }
                          }
                        }}
                      />
                      <span className="absolute inset-y-0 right-4 flex items-center text-slate-400">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 15.75 19.5 19.5m-3.75-3.75a6 6 0 1 0-8.485 0 6 6 0 0 0 8.485 0Z"
                          />
                        </svg>
                      </span>
                      {courseDropdownOpen && (
                        <div
                          className={`absolute z-20 mt-2 w-full max-h-64 overflow-y-auto rounded-2xl border shadow-lg ${darkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
                            }`}
                        >
                          {courseLoading ? (
                            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Searching courses...
                            </div>
                          ) : courses.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-slate-500">No courses found.</p>
                          ) : (
                            courses.map((course) => {
                              const isSelected = course._id === selectedCourseId;
                              return (
                                <button
                                  type="button"
                                  key={course._id}
                                  onClick={() => handleCourseSelect(course)}
                                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 ${darkMode ? "border-slate-800" : "border-slate-100"
                                    } ${isSelected ? "bg-indigo-50/60 dark:bg-indigo-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/70"}`}
                                >
                                  <p className="font-semibold text-sm">{course.title}</p>
                                  {course.description && (
                                    <p className="text-xs text-slate-500 line-clamp-1">{course.description}</p>
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {courseError && <p className="text-sm text-rose-500 mt-2">{courseError}</p>}
            </section>

            <section className={`rounded-2xl p-6 shadow-sm space-y-4 ${panelStyles}`}>
  <div className="flex items-center justify-between">
    <h3 className="text-xl font-semibold dark:text-white">All topics</h3>
    <span className="text-sm text-slate-500 dark:text-white">{forums.length} forum(s)</span>
  </div>

  {forumsLoading ? (
    <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-white">
      <Loader2 className="w-4 h-4 animate-spin" />
      Loading forums...
    </div>
  ) : forumsError ? (
    <p className="text-sm text-rose-500 dark:text-white">{forumsError}</p>
  ) : forums.length === 0 ? (
    <div
      className={`border-2 border-dashed rounded-2xl p-8 text-center ${darkMode ? "border-slate-700 text-slate-400 dark:text-white" : "border-slate-200 text-slate-500"}`}
    >
      <p className="font-semibold mb-2">No topics yet</p>
      <p className="text-sm">
        Start from a course detail page using the <span className="font-medium">"Create Forum Post"</span> button.
      </p>
    </div>
  ) : (
    <div className="space-y-4">
      {forums.map((forum) => {
        const authorName = forum.createdBy?.fullname || forum.createdBy?.username || "Unknown author";
        const avatarUrl = forum.createdBy?.avatar_url;
        const authorRole = forum.createdBy?.role;
        const forumTitle = forum.title;
        const backgroundImageUrl = getFirstImageUrl(forum.key);
        const hasBackgroundImage = Boolean(backgroundImageUrl);

        return (
          <div
            key={forum._id}
            className={`rounded-2xl border p-5 flex flex-col gap-4 relative overflow-hidden ${darkMode ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"}`}
            style={
              hasBackgroundImage
                ? {
                    backgroundImage: `url(${backgroundImageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    filter: darkMode ? "none" : "brightness(1.1)",
                  }
                : undefined
            }
          >
            {hasBackgroundImage && (
              <div
                className="absolute inset-0 z-0"
                style={{
                  backgroundColor: darkMode ? "rgba(0, 0, 0, 0.4)" : "rgba(0, 0, 0, 0.3)",
                }}
              />
            )}

            <div className="relative z-10">
              <div className="flex items-start gap-4 relative">
                <div className="relative group" style={{ zIndex: 100 }}>
                  <div
                    className={`h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-sky-500/15 font-semibold flex items-center justify-center uppercase tracking-wide overflow-hidden cursor-pointer ${darkMode ? "ring-2 ring-indigo-500/40 text-indigo-100" : "ring-2 ring-indigo-100 text-indigo-600"}`}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={authorName} className="h-full w-full object-cover" />
                    ) : (
                      getInitials(authorName)
                    )}
                  </div>

                  {/* Author Hover Popup */}
                  <div className="absolute left-0 top-14 z-[9999] hidden group-hover:block w-64">
                    <div className={`rounded-2xl shadow-2xl border p-4 ${darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-sky-500/15 font-semibold flex items-center justify-center uppercase tracking-wide overflow-hidden ${darkMode ? "ring-2 ring-indigo-500/40 text-indigo-100" : "ring-2 ring-indigo-100 text-indigo-600"}`}>
                          {avatarUrl ? <img src={avatarUrl} alt={authorName} className="h-full w-full object-cover" /> : getInitials(authorName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{authorName}</p>
                          {authorRole && (
                            <p className="text-xs uppercase tracking-wide text-indigo-500 mt-0.5">{authorRole}</p>
                          )}
                        </div>
                      </div>
                      {forum.createdBy?.username && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                          <User className="w-3 h-3" />
                          <span>@{forum.createdBy.username}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <div className={`text-xs mb-2 ${hasBackgroundImage ? "text-white/90 drop-shadow" : "text-slate-400 dark:text-white"}`}>
                    <span className="relative inline-block group/name" style={{ zIndex: 100 }}>
                      <span className={`font-semibold cursor-pointer hover:underline ${hasBackgroundImage ? "text-white" : "text-slate-600 dark:text-white"}`}>
                        {authorName}
                      </span>

                      {/* Author Name Hover Popup */}
                      <div className="absolute left-0 top-6 z-[9999] hidden group-hover/name:block w-64">
                        <div className={`rounded-2xl shadow-2xl border p-4 ${darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`}>
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-sky-500/15 font-semibold flex items-center justify-center uppercase tracking-wide overflow-hidden ${darkMode ? "ring-2 ring-indigo-500/40 text-indigo-100" : "ring-2 ring-indigo-100 text-indigo-600"}`}>
                              {avatarUrl ? <img src={avatarUrl} alt={authorName} className="h-full w-full object-cover" /> : getInitials(authorName)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">{authorName}</p>
                              {authorRole && (
                                <p className="text-xs uppercase tracking-wide text-indigo-500 mt-0.5">{authorRole}</p>
                              )}
                            </div>
                          </div>
                          {forum.createdBy?.username && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                              <User className="w-3 h-3" />
                              <span>@{forum.createdBy.username}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </span>
                    {authorRole && (
                      <span className="ml-2 uppercase tracking-wide text-[11px] text-indigo-500">{authorRole}</span>
                    )}
                    <span className={`ml-2 ${hasBackgroundImage ? "text-white/80" : "text-slate-500 dark:text-white"}`}>
                      • Created: {forum.createdAt ? new Date(forum.createdAt).toLocaleString() : "—"}
                    </span>
                  </div>

                  <Link to={`/forums/${forum._id}`} className="block">
                    <h4 className={`text-2xl font-bold cursor-pointer transition-colors ${hasBackgroundImage ? "text-white drop-shadow-lg hover:text-indigo-200" : "text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200"}`}>
                      {forumTitle}
                    </h4>
                  </Link>

                  <div className={`text-sm mt-2 line-clamp-3 ${hasBackgroundImage ? "text-white/90 drop-shadow" : "text-slate-500 dark:text-white"}`}>
                    <MarkdownContent content={forum.description} />
                  </div>
                </div>

                <div className="absolute top-0 right-0">
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      hasBackgroundImage
                        ? forum.forumType === "announcement"
                          ? "bg-amber-500/90 text-white backdrop-blur-sm"
                          : "bg-indigo-500/90 text-white backdrop-blur-sm"
                        : forum.forumType === "announcement"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    {forumTypeLabels[forum.forumType]}
                  </span>
                </div>
              </div>

              {!hasBackgroundImage && (
                <AttachmentPreview
                  files={forum.key}
                  size="sm"
                  onImageClick={handleAttachmentPreview}
                  caption={forumTitle}
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-12">
                <div className={`flex items-center gap-3 text-xs ${hasBackgroundImage ? "text-white/80" : "text-slate-400 dark:text-white"}`}>
                  <span>
                    Updated: {forum.updatedAt ? new Date(forum.updatedAt).toLocaleString() : "Awaiting update"}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
                    forum.isActive
                      ? hasBackgroundImage
                        ? "bg-emerald-500/90 text-white backdrop-blur-sm"
                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"
                      : hasBackgroundImage
                        ? "bg-rose-500/90 text-white backdrop-blur-sm"
                        : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200"
                  }`}>
                    {forum.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="flex gap-2 shrink-0">
                  <Link
                    to={`/forums/${forum._id}`}
                    className={`inline-flex items-center justify-center rounded-xl border active:scale-[0.97] transition-all duration-200 shadow-sm hover:shadow px-3 py-2 ${
                      hasBackgroundImage
                        ? "border-white/30 text-white bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                        : "border-slate-300 text-slate-700 bg-white hover:bg-slate-100 hover:border-slate-400 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
                    }`}
                    title="View forum"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>

                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditModal(forum)}
                        className={`inline-flex items-center justify-center rounded-xl border active:scale-[0.97] transition-all duration-200 shadow-sm hover:shadow px-3 py-2 ${
                          hasBackgroundImage
                            ? "border-white/30 text-white bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                            : "border-slate-300 text-slate-700 bg-white hover:bg-slate-100 hover:border-slate-400 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
                        }`}
                        title="Edit forum"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => openDeleteModal(forum)}
                        className={`inline-flex items-center justify-center rounded-lg px-3 py-2 border ${
                          hasBackgroundImage
                            ? "border-rose-300/50 text-rose-200 hover:bg-rose-500/30 backdrop-blur-sm"
                            : "border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  )}
</section>

          </div>
        </main>
      </div>

      {detailModal.forum && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center px-4">
          <div
            className={`max-w-lg w-full rounded-2xl p-6 relative ${darkMode ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900"
              }`}
          >
            <button className="absolute top-4 right-4" onClick={closeDetailModal}>
              <X className="w-5 h-5" />
            </button>
            <p className="text-xs uppercase tracking-wide text-indigo-400 mb-1">
              {forumTypeLabels[detailModal.forum.forumType]}
            </p>
            <h3 className="text-2xl font-semibold mb-2">{detailModal.forum.title}</h3>
            <div className="text-sm text-slate-500 mb-4">
              <MarkdownContent content={detailModal.forum.description} />
            </div>
            <AttachmentPreview
              files={detailModal.forum.key}
              size="sm"
              onImageClick={handleAttachmentPreview}
              caption={detailModal.forum.title}
            />
            <div className="text-sm text-slate-500 space-y-1">
              <p>ID: {detailModal.forum._id}</p>
              <p>Active: {detailModal.forum.isActive ? "Yes" : "No"}</p>
              <p>Created at: {detailModal.forum.createdAt ? new Date(detailModal.forum.createdAt).toLocaleString() : "—"}</p>
              {detailModal.forum.updatedAt && (
                <p>Updated at: {new Date(detailModal.forum.updatedAt).toLocaleString()}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {detailModal.loading && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center">
          <div className="rounded-xl bg-white px-6 py-4 flex items-center gap-3 shadow-lg dark:bg-slate-900">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading forum details...</span>
          </div>
        </div>
      )}

      {editModal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div
            className={`max-w-lg w-full rounded-2xl p-6 relative ${darkMode ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900"
              }`}
          >
            <button className="absolute top-4 right-4" onClick={closeEditModal}>
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-2xl font-semibold mb-4">Update forum</h3>
            <form className="space-y-4" onSubmit={handleUpdate}>
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  className={`w-full rounded-xl border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${darkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
                    }`}
                  value={editModal.title}
                  onChange={(event) => setEditModal((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Content editor</label>
                <MarkdownComposer
                  value={editModal.description}
                  onChange={(next) => setEditModal((prev) => ({ ...prev, description: next }))}
                  placeholder="Share context, add bullet lists, or embed resources using Markdown shortcuts."
                  darkMode={darkMode}
                  attachment={editModal.file}
                  onAttachmentChange={(file) => setEditModal((prev) => ({ ...prev, file }))}
                  attachmentAccept={attachmentAcceptTypes}
                />
                {editModal.file && (
                  <div className="mt-3">
                    <AttachmentPreview
                      files={[URL.createObjectURL(editModal.file)]}
                      size="sm"
                      onImageClick={handleAttachmentPreview}
                      caption={editModal.file.name}
                    />
                  </div>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(["discussion", "announcement"] as ForumType[]).map((type) => {
                  const isActive = editModal.forumType === type;
                  return (
                    <button
                      type="button"
                      key={type}
                      onClick={() => setEditModal((prev) => ({ ...prev, forumType: type }))}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        isActive
                          ? darkMode
                            ? "border-indigo-400 bg-indigo-500/20 text-white"
                            : "border-indigo-400 bg-indigo-50 text-slate-900"
                          : darkMode
                          ? "border-slate-700 hover:border-slate-500 text-slate-200"
                          : "border-slate-200 hover:border-slate-300 text-slate-700"
                      }`}
                    >
                      <p className="font-semibold">{forumTypeLabels[type]}</p>
                    </button>
                  );
                })}
              </div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={editModal.isActive}
                  onChange={(event) => setEditModal((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                <span className="text-sm">Active (visible to everyone in the course)</span>
              </label>
              {/* Error message now shown via react-hot-toast */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-white font-semibold hover:bg-indigo-500 disabled:opacity-50"
                  disabled={editModal.saving}
                >
                  {editModal.saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModal.open && deleteModal.forum && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div
            className={`max-w-md w-full rounded-2xl p-6 relative ${darkMode ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900"
              }`}
          >
            <button className="absolute top-4 right-4" onClick={closeDeleteModal}>
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-semibold mb-2">Delete forum</h3>
            <p className="text-sm text-slate-500 mb-4">
              Are you sure you want to delete this forum topic? This action cannot be undone.
            </p>
            <div className="rounded-xl border px-3 py-2 text-sm mb-4 border-slate-200 dark:border-slate-700">
              <p className="font-semibold line-clamp-1">{deleteModal.forum.title}</p>
              <p className="text-xs text-slate-500 line-clamp-2 mt-1">{deleteModal.forum.description}</p>
            </div>
            {deleteModal.error && <p className="text-sm text-rose-500 mb-3">{deleteModal.error}</p>}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="rounded-xl border px-4 py-2 text-sm font-semibold border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                disabled={deleteModal.loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-white text-sm font-semibold hover:bg-rose-500 disabled:opacity-50"
                disabled={deleteModal.loading}
              >
                {deleteModal.loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {attachmentPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAttachmentPreview(null)}
        >
          <div className="max-h-full max-w-4xl w-full flex flex-col items-center gap-4" onClick={(event) => event.stopPropagation()}>
            <img
              src={attachmentPreview.src}
              alt={attachmentPreview.alt || "Attachment preview"}
              className="max-h-[80vh] w-full object-contain rounded-3xl border border-white/20 shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setAttachmentPreview(null)}
              className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
            >
              Close preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForumListPage;


