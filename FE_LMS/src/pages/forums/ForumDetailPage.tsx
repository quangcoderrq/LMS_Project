import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import { forumService, type ForumResponse, type ForumPost } from "../../services/forumService";
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  Trash2,
  X,
  PlusCircle,
  Pin,
  MessageSquare,
  ShieldCheck,
  Clock3,
  RefreshCcw,
} from "lucide-react";
import MarkdownContent from "../../components/markdown/MarkdownContent";
import MarkdownComposer from "../../components/markdown/MarkdownComposer";
import AttachmentPreview from "../../components/common/AttachmentPreview";
import toastLib from "react-hot-toast";

type SidebarRole = "admin" | "teacher" | "student";

const attachmentAcceptTypes = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z,image/*";

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

const ForumDetailPage: React.FC = () => {
  const { forumId = "" } = useParams();
  const { darkMode } = useTheme();
  const { user } = useAuth();

  const sidebarRole: SidebarRole =
    user && ["admin", "teacher", "student"].includes(user.role) ? (user.role as SidebarRole) : "student";
  const canPin = user?.role === "admin" || user?.role === "teacher";

  const [forum, setForum] = useState<ForumResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pinnedPosts, setPinnedPosts] = useState<ForumPost[]>([]);
  const [unpinnedPosts, setUnpinnedPosts] = useState<ForumPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState<{
    open: boolean;
    title: string;
    content: string;
    pinned: boolean;
    submitting: boolean;
    error: string | null;
    file: File | null;
  }>({
    open: false,
    title: "",
    content: "",
    pinned: false,
    submitting: false,
    error: null,
    file: null,
  });

  const [editModal, setEditModal] = useState<{
    open: boolean;
    post: ForumPost | null;
    title: string;
    content: string;
    pinned: boolean;
    saving: boolean;
    error: string | null;
  }>({
    open: false,
    post: null,
    title: "",
    content: "",
    pinned: false,
    saving: false,
    error: null,
  });
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    post: ForumPost | null;
    loading: boolean;
    error: string | null;
  }>({
    open: false,
    post: null,
    loading: false,
    error: null,
  });
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt?: string } | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [pinningPostId, setPinningPostId] = useState<string | null>(null);

  const fetchForum = useCallback(async () => {
    if (!forumId) return;
    try {
      setLoading(true);
      const data = await forumService.getForumById(forumId);
      setForum(data);
      setError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load forum";
      setError(message);
      setForum(null);
    } finally {
      setLoading(false);
    }
  }, [forumId]);

  const fetchPosts = useCallback(async () => {
    if (!forumId) return;
    try {
      setPostsLoading(true);
      const [pinned, regular] = await Promise.all([
        forumService.getForumPosts(forumId, { pinned: true }),
        forumService.getForumPosts(forumId, { pinned: false }),
      ]);
      setPinnedPosts(pinned);
      setUnpinnedPosts(regular);
      setPostsError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load posts";
      setPinnedPosts([]);
      setUnpinnedPosts([]);
      setPostsError(message);
    } finally {
      setPostsLoading(false);
    }
  }, [forumId]);

  useEffect(() => {
    fetchForum();
    fetchPosts();
  }, [fetchForum, fetchPosts]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!lightboxImage) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxImage]);

  useEffect(() => {
    const target = heroRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyHeader(!entry.isIntersecting);
      },
      { threshold: 0.6 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [forum]);

  const resetCreateForm = () =>
    setCreateModal({
      open: false,
      title: "",
      content: "",
      pinned: false,
      submitting: false,
      error: null,
      file: null,
    });

  const openCreateModal = () =>
    setCreateModal((prev) => ({
      ...prev,
      open: true,
      error: null,
    }));

  const closeCreateModal = () =>
    setCreateModal((prev) => ({
      ...prev,
      open: false,
    }));

  const handleCreatePost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!forumId) return;
    if (!createModal.title.trim() || !createModal.content.trim()) {
      const msg = "Please provide both a title and content.";
      setCreateModal((prev) => ({ ...prev, error: msg }));
      toastLib.error(msg);
      return;
    }

    try {
      setCreateModal((prev) => ({ ...prev, submitting: true, error: null }));
      await forumService.createForumPost(
        forumId,
        {
          title: createModal.title.trim(),
          content: createModal.content,
          pinned: canPin ? createModal.pinned : false,
        },
        createModal.file || undefined
      );
      const successMsg = "Post published successfully.";
      setToast({ type: "success", message: successMsg });
      toastLib.success(successMsg);
      resetCreateForm();
      fetchForum();
      fetchPosts();
    } catch (err: any) {
      const apiData = err?.response?.data;
      const apiMessage: string | undefined = apiData?.message;
      const fieldErrors: Array<{ path?: string | string[]; message?: string }> =
        apiData?.errors ?? [];

      let finalMessage = apiMessage || "Unable to create post";

      if (fieldErrors.length > 0) {
        fieldErrors.forEach((e) => {
          const path =
            Array.isArray(e.path) && e.path.length > 0
              ? e.path.join(".")
              : typeof e.path === "string"
              ? e.path
              : "";
          const msg = e.message || apiMessage || "Invalid input";
          toastLib.error(path ? `${path}: ${msg}` : msg);
        });
        finalMessage =
          apiMessage ||
          fieldErrors.map((e) => e.message).filter(Boolean).join(", ") ||
          finalMessage;
      } else if (apiMessage) {
        toastLib.error(apiMessage);
        finalMessage = apiMessage;
      } else if (err instanceof Error && err.message) {
        toastLib.error(err.message);
        finalMessage = err.message;
      } else {
        toastLib.error(finalMessage);
      }

      setCreateModal((prev) => ({ ...prev, submitting: false, error: finalMessage }));
    }
  };



  const openEditPost = (post: ForumPost) => {
    if (!canManagePosts) return;
    setEditModal({
      open: true,
      post,
      title: post.title,
      content: post.content,
      pinned: Boolean(post.pinned),
      saving: false,
      error: null,
    });
  };

  const closeEditModal = () =>
    setEditModal({
      open: false,
      post: null,
      title: "",
      content: "",
      pinned: false,
      saving: false,
      error: null,
    });

  const handleUpdatePost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!forumId || !editModal.post) return;
    try {
      setEditModal((prev) => ({ ...prev, saving: true, error: null }));
      await forumService.updateForumPost(forumId, editModal.post._id, {
        title: editModal.title.trim(),
        content: editModal.content,
        pinned: editModal.pinned,
      });
      setToast({ type: "success", message: "Post updated." });
      closeEditModal();
      fetchPosts();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update post";
      setEditModal((prev) => ({ ...prev, saving: false, error: message }));
    }
  };

  const openDeletePostModal = (post: ForumPost) => {
    if (!canManagePosts) return;
    setDeleteModal({ open: true, post, loading: false, error: null });
  };

  const closeDeletePostModal = () => {
    setDeleteModal({ open: false, post: null, loading: false, error: null });
  };

  const handleConfirmDeletePost = async () => {
    if (!canManagePosts || !forumId || !deleteModal.post) return;
    try {
      setDeleteModal((prev) => ({ ...prev, loading: true, error: null }));
      await forumService.deleteForumPost(forumId, deleteModal.post._id);
      setToast({ type: "success", message: "Post deleted." });
      closeDeletePostModal();
      fetchPosts();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete post";
      setDeleteModal((prev) => ({ ...prev, loading: false, error: message }));
    }
  };

  const handleTogglePinPost = async (post: ForumPost) => {
    if (!canPin || !forumId) return;
    try {
      setPinningPostId(post._id);
      await forumService.updateForumPost(forumId, post._id, {
        title: post.title,
        content: post.content,
        pinned: !post.pinned,
      });
      setToast({
        type: "success",
        message: post.pinned ? "Post unpinned." : "Post pinned.",
      });
      fetchPosts();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update pinned status";
      setToast({ type: "error", message });
    } finally {
      setPinningPostId(null);
    }
  };

  if (!forumId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-slate-500">Forum not found.</p>
      </div>
    );
  }

  const backgroundStyles = {
    backgroundColor: darkMode ? "#0f172a" : "#f8fafc",
    // Default text color: white in dark mode, slate-900 in light mode
    color: darkMode ? "#ffffff" : "#0f172a",
  };
  const canManagePosts = user?.role === "admin" || user?.role === "teacher";
  const formatDate = (value?: string | number | Date) => {
    if (!value) return "—";
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };
  const totalPosts = pinnedPosts.length + unpinnedPosts.length;
  const orderedPosts = useMemo(() => {
    const sortByCreatedDesc = (items: ForumPost[]) =>
      [...items].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

    const sortedPinned = sortByCreatedDesc(pinnedPosts);
    const sortedUnpinned = sortByCreatedDesc(unpinnedPosts);

    // Pinned posts first, then the rest; each group newest -> oldest
    return [...sortedPinned, ...sortedUnpinned];
  }, [pinnedPosts, unpinnedPosts]);
  const handleImagePreview = useCallback((payload: { src: string; alt?: string }) => {
    setLightboxImage(payload);
  }, []);
  return (
    <>
      <div className="flex h-screen overflow-hidden relative" style={backgroundStyles}>
        <Navbar />
        <Sidebar role={sidebarRole} />

        <div className="flex flex-col flex-1 w-0 overflow-hidden">
          <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 mt-16 sm:pl-24 md:pl-28">
            <div className="max-w-5xl mx-auto space-y-6 pb-16">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <Link
                  to="/forum-list"
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 dark:border-slate-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to forums
                </Link>
                <div className="flex items-center gap-3 ml-auto">
                  {toast && (
                    <div
                      className={`rounded-xl border px-4 py-2 text-sm flex items-center gap-2 ${toast.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {toast.message}
                    </div>
                  )}
                  {user && (
                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Create post 
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="flex items-center gap-3 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading forum...
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
                  <p className="font-semibold mb-2">Unable to load forum</p>
                  <p className="text-sm">{error}</p>
                </div>
              ) : forum ? (
                <>
                  {showStickyHeader && forum && (() => {
                    const backgroundImageUrl = getFirstImageUrl(forum.key);
                    const hasBackgroundImage = Boolean(backgroundImageUrl);

                    return (
                      <div className="sticky top-0 z-20 mb-4">
                        <div
                          className={`rounded-2xl px-4 py-3 shadow-lg border flex items-center gap-3 relative overflow-hidden ${darkMode ? "border-slate-700/70" : "border-slate-200"
                            }`}
                          style={
                            hasBackgroundImage
                              ? {
                                backgroundImage: `url(${backgroundImageUrl})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                backgroundRepeat: "no-repeat",
                                filter: darkMode ? "none" : "brightness(1.1)",
                              }
                              : darkMode
                                ? { backgroundColor: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(8px)" }
                                : { backgroundColor: "white", backdropFilter: "blur(8px)" }
                          }
                          aria-live="polite"
                        >
                          {hasBackgroundImage && (
                            <div
                              className="absolute inset-0 z-0"
                              style={{
                                backgroundColor: darkMode ? "rgba(0, 0, 0, 0.4)" : "rgba(0, 0, 0, 0.3)",
                              }}
                            />
                          )}
                          <div className="relative z-10 flex items-center gap-3 w-full">
                            <MessageSquare className={`w-4 h-4 ${hasBackgroundImage
                              ? "text-indigo-200"
                              : "text-indigo-500"
                              }`} />
                            <div className="flex flex-col">
                              <span className={`text-[11px] uppercase tracking-wide font-semibold ${hasBackgroundImage
                                ? "text-indigo-200 drop-shadow"
                                : "text-indigo-500"
                                }`}>
                                Discussion topic
                              </span>
                              <span className={`text-sm font-semibold ${hasBackgroundImage
                                ? "text-white drop-shadow"
                                : "text-slate-900 dark:text-slate-100"
                                }`}>
                                {forum.title}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {(() => {
                    const backgroundImageUrl = getFirstImageUrl(forum.key);
                    const hasBackgroundImage = Boolean(backgroundImageUrl);

                    return (
                      <section
                        ref={heroRef}
                        className={`rounded-2xl p-6 shadow-sm relative overflow-hidden ${darkMode ? "border border-slate-700/70" : "border border-slate-100"
                          }`}
                        style={
                          hasBackgroundImage
                            ? {
                              backgroundImage: `url(${backgroundImageUrl})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              backgroundRepeat: "no-repeat",
                              filter: darkMode ? "none" : "brightness(1.1)",
                            }
                            : darkMode
                              ? { backgroundColor: "rgba(15, 23, 42, 0.8)" }
                              : { backgroundColor: "white" }
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
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className={`text-xs uppercase tracking-wide font-semibold flex items-center gap-2 ${hasBackgroundImage
                                ? "text-indigo-200 drop-shadow"
                                : "text-indigo-500"
                                }`}>
                                <MessageSquare className="w-4 h-4" />
                                {forum.forumType === "announcement" ? "Announcement" : "Discussion"}
                              </p>
                              <h1 className={`text-3xl font-bold mt-2 ${hasBackgroundImage
                                ? "text-white drop-shadow-lg"
                                : ""
                                }`}>
                                {forum.title}
                              </h1>
                              <div className={`mt-3 ${hasBackgroundImage
                                ? "text-white/90 drop-shadow"
                                : "text-slate-500 dark:text-slate-300"
                                }`}>
                                <MarkdownContent content={forum.description} />
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs font-semibold">
                              <span
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${hasBackgroundImage
                                  ? forum.isActive
                                    ? "bg-emerald-500/90 text-white backdrop-blur-sm"
                                    : "bg-rose-500/90 text-white backdrop-blur-sm"
                                  : forum.isActive
                                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200"
                                    : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-200"
                                  }`}
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                {forum.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </div>
                          <div className={`mt-4 grid gap-3 text-xs sm:grid-cols-2 ${hasBackgroundImage
                            ? "text-white/80"
                            : "text-slate-500 dark:text-slate-400"
                            }`}>
                            {forum.createdAt && (
                              <span className="inline-flex items-center gap-2">
                                <Clock3 className={`w-3.5 h-3.5 ${hasBackgroundImage
                                  ? "text-indigo-200"
                                  : "text-indigo-400"
                                  }`} />
                                Created: {formatDate(forum.createdAt)}
                              </span>
                            )}
                            {forum.updatedAt && (
                              <span className="inline-flex items-center gap-2">
                                <RefreshCcw className={`w-3.5 h-3.5 ${hasBackgroundImage
                                  ? "text-indigo-200"
                                  : "text-indigo-400"
                                  }`} />
                                Updated: {formatDate(forum.updatedAt)}
                              </span>
                            )}
                          </div>
                        </div>
                      </section>
                    );
                  })()}

                  <section
                    className={`rounded-2xl p-6 shadow-sm ${darkMode ? "bg-slate-900/70 border border-slate-700/60" : "bg-white border border-slate-100"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-blue-600">Latest posts</h2>
                      <span className="text-sm text-slate-800">{totalPosts} item(s)</span>
                    </div>
                    {postsLoading ? (
                      <div className="space-y-4">
                        {[...Array(3)].map((_, index) => (
                          <div
                            key={`post-skeleton-${index}`}
                            className={`rounded-3xl border p-5 ${darkMode ? "border-slate-800 bg-slate-900/40" : "border-slate-100 bg-white"
                              } animate-pulse`}
                          >
                            <div className="flex gap-2 text-xs">
                              <div className={`h-3 w-32 rounded-full ${darkMode ? "bg-slate-800" : "bg-slate-200"}`} />
                              <div className={`h-3 w-20 rounded-full ${darkMode ? "bg-slate-800" : "bg-slate-200"}`} />
                              <div className="ml-auto h-3 w-16 rounded-full bg-slate-200 dark:bg-slate-800" />
                            </div>
                            <div className="mt-4 space-y-3">
                              <div className={`h-5 w-1/3 rounded-full ${darkMode ? "bg-slate-700" : "bg-slate-200"}`} />
                              <div className="space-y-2">
                                <div className={`h-3 w-full rounded-full ${darkMode ? "bg-slate-800" : "bg-slate-200"}`} />
                                <div className={`h-3 w-5/6 rounded-full ${darkMode ? "bg-slate-800" : "bg-slate-200"}`} />
                              </div>
                              <div className="flex gap-2">
                                <div className="h-24 w-32 rounded-2xl bg-slate-200 dark:bg-slate-800" />
                                <div className="h-24 w-32 rounded-2xl bg-slate-200 dark:bg-slate-800" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : postsError ? (
                      <p className="text-sm text-rose-500">{postsError}</p>
                    ) : totalPosts === 0 ? (
                      <div
                        className={`border-2 border-dashed rounded-2xl p-8 text-center ${darkMode ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500"
                          }`}
                      >
                        <p className="font-semibold mb-2">No posts yet</p>
                        <p className="text-sm">Be the first to share materials or questions with your classmates.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {orderedPosts.map((post) => (
                          <div
                            key={post._id}
                            className={`rounded-3xl p-5 shadow-sm border ${darkMode ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-100"
                              }`}
                          >
                            <Link to={`/forums/${forumId}/posts/${post._id}`} className="block">
                              {/* Header: date, pinned, replies */}
                              <div className="flex flex-wrap items-center gap-3 text-xs">
                                <span className={`font-semibold ${darkMode ? "text-slate-300" : "text-slate-500"}`}>
                                  {formatDate(post.createdAt)}
                                </span>
                                {post.pinned && (
                                  <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold bg-amber-50 text-amber-700 text-[11px]">
                                    Pinned
                                  </span>
                                )}
                                <span
                                  className={`ml-auto text-sm font-semibold ${darkMode ? "text-blue-300" : "text-blue-400"
                                    }`}
                                >
                                  {post.replyCount ?? 0} replies
                                </span>
                              </div>

                              {/* Content */}
                              <div className="mt-3 flex flex-wrap gap-3 justify-between">
                                <div className="space-y-2 flex-1 min-w-[200px]">
                                  <h3 className="text-3xl font-semibold cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                    {post.title}
                                  </h3>
                                  <div
                                    className={`text-sm line-clamp-2 ${darkMode ? "text-slate-300" : "text-slate-600"
                                      }`}
                                  >
                                    <MarkdownContent content={post.content} onImageClick={handleImagePreview} />
                                  </div>

                                  <AttachmentPreview
                                    files={post.key}
                                    size="sm"
                                    onImageClick={handleImagePreview}
                                    caption={post.title}
                                  />

                                  {/* Author */}
                                  {post.author ? (
                                    <div className="flex items-center gap-2 mt-2">
                                      <div
                                        className={`h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500/15 to-sky-500/15 font-semibold flex items-center justify-center uppercase tracking-wide overflow-hidden text-[10px] ${darkMode ? "ring-1 ring-indigo-500/40 text-indigo-100" : "ring-1 ring-indigo-100 text-indigo-600"
                                          }`}
                                      >
                                        {post.author.avatar_url ? (
                                          <img
                                            src={post.author.avatar_url}
                                            alt={post.author.fullname || post.author.username || "User avatar"}
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          (post.author.fullname || post.author.username || "U")
                                            .split(/\s+/)
                                            .map((segment) => segment[0]?.toUpperCase())
                                            .slice(0, 2)
                                            .join("") || "U"
                                        )}
                                      </div>
                                      <div className="flex flex-col">
                                        <p className={`text-xs font-semibold ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
                                          {post.author.fullname || post.author.username || "Unknown User"}
                                        </p>
                                        {post.author.role && (
                                          <p className={`text-[10px] capitalize ${darkMode ? "text-slate-400" : "text-slate-400"}`}>
                                            {post.author.role}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 mt-2">
                                      <div
                                        className={`h-8 w-8 rounded-xl bg-gradient-to-br from-slate-500/15 to-slate-500/15 text-slate-600 font-semibold flex items-center justify-center uppercase tracking-wide text-[10px] ${darkMode ? "ring-1 ring-slate-500/40 text-slate-100" : "ring-1 ring-slate-100"
                                          }`}
                                      >
                                        ?
                                      </div>
                                      <div className="flex flex-col">
                                        <p className={`text-xs font-semibold ${darkMode ? "text-slate-200" : "text-slate-400"}`}>
                                          Unknown User
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </Link>

                            {/* Buttons: Pin, Edit, Delete */}
                            <div className="mt-3 flex items-center gap-2 justify-end">
                              {canPin && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleTogglePinPost(post);
                                  }}
                                  className={`h-9 w-9 rounded-full border flex items-center justify-center transition ${post.pinned
                                    ? "border-amber-300 text-amber-600 bg-amber-50 hover:bg-amber-100 dark:border-amber-500/50 dark:text-amber-300 dark:bg-amber-500/10 dark:hover:bg-amber-500/20"
                                    : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                                    }`}
                                  title={post.pinned ? "Unpin post" : "Pin post"}
                                  disabled={pinningPostId === post._id}
                                >
                                  {pinningPostId === post._id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Pin className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                              {canManagePosts && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      openEditPost(post);
                                    }}
                                    className="h-9 w-9 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 flex items-center justify-center"
                                    title="Edit post"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      openDeletePostModal(post);
                                    }}
                                    className="h-9 w-9 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10 flex items-center justify-center"
                                    title="Delete post"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                    )}
                  </section>


                </>
              ) : null}
            </div>
          </main>
        </div>
      </div>

      {createModal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div
            className={`max-w-3xl w-full rounded-2xl p-6 md:p-8 relative ${darkMode ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"
              }`}
          >
            <button className="absolute top-4 right-4" onClick={closeCreateModal}>
              <X className="w-5 h-5" />
            </button>
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm uppercase tracking-wide text-indigo-500 font-semibold">
                <PlusCircle className="w-4 h-4" />
                Create post
              </div>
              {user && (
                <div className="mt-4 flex items-center gap-3">
                  <div
                    className={`h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-sky-500/15 text-indigo-600 font-semibold flex items-center justify-center uppercase tracking-wide overflow-hidden ${darkMode ? "ring-2 ring-indigo-500/40 text-indigo-100" : "ring-2 ring-indigo-100"
                      }`}
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.fullname || user.username || "User avatar"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (user.fullname || user.username || "You")
                        .split(/\s+/)
                        .map((segment) => segment[0]?.toUpperCase())
                        .slice(0, 2)
                        .join("") || "U"
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Posting as</p>
                    <p className="text-sm font-semibold">{user?.fullname || user?.username || "You"}</p>
                    {user?.role && <p className="text-xs text-slate-400 capitalize">{user.role}</p>}
                  </div>
                </div>
              )}
            </div>
            <form className="space-y-6" onSubmit={handleCreatePost}>
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="block text-sm font-medium mb-0">Title</label>
                  {canPin && (
                    <button
                      type="button"
                      onClick={() =>
                        setCreateModal((prev) => ({
                          ...prev,
                          pinned: !prev.pinned,
                        }))
                      }
                      aria-pressed={createModal.pinned}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-1 text-xs font-semibold transition ${createModal.pinned
                        ? "bg-amber-500/10 text-amber-600 border-amber-300 dark:text-amber-300 dark:border-amber-500/40"
                        : "text-slate-500 border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-800"
                        }`}
                    >
                      <Pin className="w-4 h-4" />
                      {createModal.pinned ? "Pinned" : "Pin this post"}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  className={`w-full rounded-2xl border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${darkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
                    }`}
                  placeholder="Example: UI design materials"
                  value={createModal.title}
                  onChange={(event) => setCreateModal((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Content editor</label>
                <MarkdownComposer
                  value={createModal.content}
                  onChange={(next) => setCreateModal((prev) => ({ ...prev, content: next }))}
                  placeholder="Share context, add bullet lists, or embed resources using Markdown shortcuts."
                  darkMode={darkMode}
                  attachment={createModal.file}
                  onAttachmentChange={(file) => setCreateModal((prev) => ({ ...prev, file }))}
                  attachmentAccept={attachmentAcceptTypes}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-2xl border px-5 py-2.5 text-sm font-semibold border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-5 py-2.5 text-white font-semibold hover:bg-indigo-500 disabled:opacity-50"
                  disabled={createModal.submitting}
                >
                  {createModal.submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Publish post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editModal.open && editModal.post && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div
            className={`max-w-xl w-full rounded-2xl p-6 relative ${darkMode ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900"
              }`}
          >
            <button className="absolute top-4 right-4" onClick={closeEditModal}>
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-2xl font-semibold mb-4">Edit post</h3>
            <form className="space-y-4" onSubmit={handleUpdatePost}>
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
                <label className="block text-sm font-medium mb-2">Content</label>
                <textarea
                  className={`w-full h-32 rounded-xl border px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 ${darkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
                    }`}
                  value={editModal.content}
                  onChange={(event) => setEditModal((prev) => ({ ...prev, content: event.target.value }))}
                ></textarea>
              </div>
              {editModal.error && <p className="text-sm text-rose-500">{editModal.error}</p>}
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

      {deleteModal.open && deleteModal.post && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div
            className={`max-w-md w-full rounded-2xl p-6 relative ${darkMode ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900"
              }`}
          >
            <button className="absolute top-4 right-4" onClick={closeDeletePostModal}>
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-semibold mb-2">Delete post</h3>
            <p className="text-sm text-slate-500 mb-3">
              Are you sure you want to permanently delete this post? This action cannot be undone.
            </p>
            <div className="rounded-xl border px-3 py-2 text-sm mb-4 border-slate-200 dark:border-slate-700">
              <p className="font-semibold line-clamp-1">{deleteModal.post.title}</p>
              <p className="text-xs text-slate-500 line-clamp-2 mt-1">{deleteModal.post.content}</p>
            </div>
            {deleteModal.error && <p className="text-sm text-rose-500 mb-3">{deleteModal.error}</p>}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeletePostModal}
                className="rounded-xl border px-4 py-2 text-sm font-semibold border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                disabled={deleteModal.loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePost}
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

      {lightboxImage && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="max-h-full max-w-4xl w-full flex flex-col items-center gap-4" onClick={(event) => event.stopPropagation()}>
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt || "Preview image"}
              className="max-h-[80vh] w-full object-contain rounded-3xl border border-white/20 shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
            >
              Close preview
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ForumDetailPage;

