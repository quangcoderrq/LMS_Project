import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import {
  forumService,
  type ForumResponse,
  type ForumPost,
  type ForumReply,
} from "../../services/forumService";
import { ArrowLeft, Edit3, Loader2, MessageSquare, Trash2, Save, X } from "lucide-react";
import MarkdownContent from "../../components/markdown/MarkdownContent";
import AttachmentPreview from "../../components/common/AttachmentPreview";
import MarkdownComposer from "../../components/markdown/MarkdownComposer";
import toast from "react-hot-toast";

type SidebarRole = "admin" | "teacher" | "student";
type ReplyNode = ForumReply & { children?: ReplyNode[] };

const attachmentAcceptTypes = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z,image/*";

const ForumPostDetailPage: React.FC = () => {
  const { forumId = "", postId = "" } = useParams();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const { user } = useAuth();

  const sidebarRole: SidebarRole =
    user && ["admin", "teacher", "student"].includes(user.role) ? (user.role as SidebarRole) : "student";

  const [forum, setForum] = useState<ForumResponse | null>(null);
  const [post, setPost] = useState<ForumPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesError, setRepliesError] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{ replyId: string | null; displayName?: string } | null>(null);
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);
  const [editingReply, setEditingReply] = useState<{ replyId: string; content: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [expandedChildGroups, setExpandedChildGroups] = useState<Record<string, boolean>>({});
  const [repliesExpanded, setRepliesExpanded] = useState(true);
  const [visibleRepliesCount, setVisibleRepliesCount] = useState(3);
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt?: string } | null>(null);

  // Post editing state
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editPostTitle, setEditPostTitle] = useState("");
  const [editPostContent, setEditPostContent] = useState("");
  const [postSaving, setPostSaving] = useState(false);
  const [postDeleteLoading, setPostDeleteLoading] = useState(false);

  const fetchForum = useCallback(async () => {
    if (!forumId) return;
    try {
      const response = await forumService.getForumById(forumId);
      setForum(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load forum";
      setError(message);
    }
  }, [forumId]);

  const fetchPost = useCallback(async () => {
    if (!forumId || !postId) return;
    try {
      setLoading(true);
      const response = await forumService.getForumPostById(forumId, postId);
      setPost(response);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load post";
      setError(message);
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [forumId, postId]);

  const fetchReplies = useCallback(async () => {
    if (!forumId || !postId) return;
    try {
      setRepliesLoading(true);
      const { replies: list } = await forumService.getReplies(forumId, postId);
      setReplies(list);
      setRepliesError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load replies";
      setReplies([]);
      setRepliesError(message);
    } finally {
      setRepliesLoading(false);
    }
  }, [forumId, postId]);

  useEffect(() => {
    fetchForum();
  }, [fetchForum]);

  useEffect(() => {
    fetchPost();
    fetchReplies();
  }, [fetchPost, fetchReplies]);

  useEffect(() => {
    if (replyTarget && replyTextareaRef.current) {
      replyTextareaRef.current.focus();
      replyTextareaRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [replyTarget]);

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
  const handleImagePreview = useCallback((payload: { src: string; alt?: string }) => {
    setLightboxImage(payload);
  }, []);

  const handleReplySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!forumId || !postId || !post) return;
    if (!replyContent.trim()) {
      toast.error("Please enter your reply before posting.");
      return;
    }
    try {
      setReplySubmitting(true);
      await forumService.createReply(
        forumId,
        post._id,
        {
          content: replyContent.trim(),
          parentReplyId: replyTarget?.replyId || undefined,
        },
        replyFile || undefined
      );
      setReplyContent("");
      setReplyFile(null);
      if (replyTarget?.replyId) {
        setExpandedChildGroups((prev) => ({ ...prev, [replyTarget.replyId as string]: true }));
      }
      setRepliesExpanded(true);
      setReplyTarget(null);
      await Promise.all([fetchPost(), fetchReplies()]);
      toast.success("Reply added successfully.");
    } catch (err: any) {
      const apiData = err?.response?.data;
      const apiMessage: string | undefined = apiData?.message;
      const fieldErrors: Array<{ path?: string | string[]; message?: string }> =
        apiData?.errors ?? [];

      let finalMessage = apiMessage || "Unable to add reply";

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
      } else if (err instanceof Error && err.message) {
        toast.error(err.message);
        finalMessage = err.message;
      } else {
        toast.error(finalMessage);
      }
    } finally {
      setReplySubmitting(false);
    }
  };

  const toggleExpandReply = (replyId: string) => {
    setExpandedReplies((prev) => ({ ...prev, [replyId]: !prev[replyId] }));
  };

  const toggleChildReplies = (replyId: string) => {
    setExpandedChildGroups((prev) => ({ ...prev, [replyId]: !prev[replyId] }));
  };

  const beginReplyTo = (target?: ForumReply) => {
    if (target) {
      const displayName = target.author?.fullname || target.author?.username || "user";
      setReplyTarget({ replyId: target._id, displayName });
      setRepliesExpanded(true);
    } else {
      setReplyTarget(null);
    }
  };

  const formatRoleLabel = (role?: string) => {
    switch (role) {
      case "admin":
        return "Admin";
      case "teacher":
        return "Teacher";
      case "student":
        return "Student";
      default:
        return "Member";
    }
  };

  const canDeleteReply = (reply: ForumReply) => {
    if (!user) return false;
    if (user.role === "admin" || user.role === "teacher") return true;
    return reply.author?._id === user._id;
  };

  const canEditReply = (reply: ForumReply) => canDeleteReply(reply);

  const beginEditReply = (reply: ForumReply) => {
    if (!canEditReply(reply)) return;
    setRepliesExpanded(true);
    setEditError(null);
    setEditingReply({ replyId: reply._id, content: reply.content });
  };

  const cancelEditReply = () => {
    setEditingReply(null);
    setEditError(null);
  };

  const handleUpdateReply = async () => {
    if (!forumId || !postId || !editingReply) return;
    const content = editingReply.content.trim();
    if (!content) {
      toast.error("Reply content cannot be empty.");
      return;
    }
    try {
      setEditSaving(true);
      setEditError(null);
      await forumService.updateReply(forumId, postId, editingReply.replyId, { content });
      setEditingReply(null);
      toast.success("Reply updated successfully.");
      await Promise.all([fetchPost(), fetchReplies()]);
    } catch (err: any) {
      const apiData = err?.response?.data;
      const apiMessage: string | undefined = apiData?.message;
      const fieldErrors: Array<{ path?: string | string[]; message?: string }> =
        apiData?.errors ?? [];

      let finalMessage = apiMessage || "Unable to update reply";

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
      } else if (err?.response?.status === 403 || err?.message?.toLowerCase().includes("permission") || err?.message?.toLowerCase().includes("not allowed")) {
        finalMessage = "You can only edit your own replies";
        toast.error(finalMessage);
      } else if (apiMessage) {
        toast.error(apiMessage);
        finalMessage = apiMessage;
      } else if (err instanceof Error && err.message) {
        toast.error(err.message);
        finalMessage = err.message;
      } else {
        toast.error(finalMessage);
      }

      setEditError(finalMessage);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!forumId || !postId) return;
    try {
      setDeletingReplyId(replyId);
      await forumService.deleteReply(forumId, postId, replyId);
      if (editingReply?.replyId === replyId) {
        setEditingReply(null);
        setEditError(null);
      }
      toast.success("Reply deleted successfully.");
      await Promise.all([fetchPost(), fetchReplies()]);
    } catch (err: any) {
      const apiData = err?.response?.data;
      const apiMessage: string | undefined = apiData?.message;
      const fieldErrors: Array<{ path?: string | string[]; message?: string }> =
        apiData?.errors ?? [];

      let finalMessage = apiMessage || "Unable to delete reply";

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
      } else if (err?.response?.status === 403 || err?.message?.toLowerCase().includes("permission") || err?.message?.toLowerCase().includes("not allowed")) {
        finalMessage = "You can only delete your own replies";
        toast.error(finalMessage);
      } else if (apiMessage) {
        toast.error(apiMessage);
        finalMessage = apiMessage;
      } else if (err instanceof Error && err.message) {
        toast.error(err.message);
        finalMessage = err.message;
      } else {
        toast.error(finalMessage);
      }
    } finally {
      setDeletingReplyId(null);
    }
  };

  const canManagePost = useMemo(() => {
    if (!user || !post) return false;
    return user.role === "admin" || user.role === "teacher" || post.author?._id === user._id;
  }, [user, post]);

  const startEditingPost = () => {
    if (!post) return;
    setEditPostTitle(post.title);
    setEditPostContent(post.content);
    setIsEditingPost(true);
  };

  const cancelEditingPost = () => {
    setIsEditingPost(false);
    setEditPostTitle("");
    setEditPostContent("");
  };

  const handleUpdatePost = async () => {
    if (!forumId || !post) return;
    if (!editPostTitle.trim() || !editPostContent.trim()) {
      toast.error("Title and content cannot be empty.");
      return;
    }

    try {
      setPostSaving(true);
      await forumService.updateForumPost(forumId, post._id, {
        title: editPostTitle.trim(),
        content: editPostContent,
        pinned: post.pinned, // Keep existing pinned status
      });
      toast.success("Post updated successfully.");
      setIsEditingPost(false);
      fetchPost();
    } catch (err: any) {
      const apiData = err?.response?.data;
      const apiMessage: string | undefined = apiData?.message;
      const fieldErrors: Array<{ path?: string | string[]; message?: string }> =
        apiData?.errors ?? [];

      let finalMessage = apiMessage || "Unable to update post";

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
      } else if (
        err?.response?.status === 403 ||
        err?.message?.toLowerCase?.().includes("permission") ||
        err?.message?.toLowerCase?.().includes("not allowed")
      ) {
        finalMessage = "You can only edit your own posts";
        toast.error(finalMessage);
      } else if (apiMessage) {
        toast.error(apiMessage);
        finalMessage = apiMessage;
      } else if (err instanceof Error && err.message) {
        toast.error(err.message);
        finalMessage = err.message;
      } else {
        toast.error(finalMessage);
      }
    } finally {
      setPostSaving(false);
    }
  };

  const handleDeletePost = async () => {
    if (!forumId || !post) return;
    if (!window.confirm("Are you sure you want to delete this post? This action cannot be undone.")) return;

    try {
      setPostDeleteLoading(true);
      await forumService.deleteForumPost(forumId, post._id);
      toast.success("Post deleted successfully.");
      navigate(`/forums/${forumId}`);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : "Unable to delete post";
      toast.error(message);
      setPostDeleteLoading(false);
    }
  };

  if (!forumId || !postId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-slate-500">Post not found.</p>
      </div>
    );
  }

  const replyCount = post?.replyCount ?? replies.length;

  const nestedReplies = useMemo<ReplyNode[]>(() => {
    if (!replies.length) return [];
    const nodes = new Map<string, ReplyNode>();
    replies.forEach((reply) => {
      nodes.set(reply._id, { ...reply, children: [] });
    });
    const roots: ReplyNode[] = [];
    replies.forEach((reply) => {
      const node = nodes.get(reply._id);
      if (!node) return;
      if (reply.parentReplyId) {
        const parent = nodes.get(reply.parentReplyId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });
    return roots;
  }, [replies]);

  const renderReplyItem = (reply: ReplyNode, depth = 0): React.ReactNode => {
    const displayName = reply.author?.fullname || reply.author?.username || "Anonymous";
    const avatarUrl = reply.author?.avatar_url;
    const initials =
      displayName
        .split(" ")
        .filter(Boolean)
        .map((segment) => segment[0]?.toUpperCase())
        .slice(0, 2)
        .join("") || "U";
    const isExpanded = Boolean(expandedReplies[reply._id]);
    const shouldClamp = reply.content.length > 320;
    const childCount = reply.children?.length ?? 0;
    const areChildrenExpanded = Boolean(expandedChildGroups[reply._id]);
    const allowDelete = canDeleteReply(reply);
    const allowEdit = canEditReply(reply);
    const isDeleting = deletingReplyId === reply._id;
    const isEditing = editingReply?.replyId === reply._id;

    return (
      <div
        key={reply._id}
        className={`space-y-3 ${depth > 0 ? "ml-10 border-l border-slate-200 dark:border-slate-700 pl-4" : ""}`}
      >
        <div
          className={`rounded-3xl border px-4 py-4 ${darkMode ? "bg-slate-900/60 border-slate-700" : "bg-white border-slate-200"
            }`}
        >
          <div className="flex gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-sky-500/10 flex items-center justify-center text-sm font-semibold text-indigo-600 overflow-hidden dark:text-indigo-200 dark:from-indigo-500/20 dark:to-sky-500/10">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-base">{displayName}</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ${reply.author?.role === "admin"
                    ? "bg-rose-100 text-rose-700"
                    : reply.author?.role === "teacher"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-emerald-100 text-emerald-700"
                    }`}
                >
                  {formatRoleLabel(reply.author?.role)}
                </span>
                <span className="text-xs text-slate-400">{formatDate(reply.createdAt)}</span>
              </div>
              {isEditing ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    className={`w-full rounded-2xl border px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400 ${darkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
                      }`}
                    rows={4}
                    value={editingReply.content}
                    onChange={(event) =>
                      setEditingReply((prev) =>
                        prev && prev.replyId === reply._id ? { ...prev, content: event.target.value } : prev
                      )
                    }
                  ></textarea>
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={cancelEditReply}
                      className="rounded-xl border px-4 py-2 text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:hover:text-slate-200"
                      disabled={editSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdateReply}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-60"
                      disabled={editSaving}
                    >
                      {editSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Save changes
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`mt-3 rounded-2xl border px-4 py-3 text-sm leading-relaxed ${darkMode ? "bg-slate-800/60 border-slate-700" : "bg-slate-50 border-slate-200"
                    }`}
                >
                  <div
                    className={`prose max-w-none dark:prose-invert ${shouldClamp && !isExpanded ? "line-clamp-4" : ""}`}
                  >
                    <MarkdownContent content={reply.content} onImageClick={handleImagePreview} />
                  </div>
                  <AttachmentPreview
                    files={reply.key}
                    size="xs"
                    onImageClick={handleImagePreview}
                    caption={`Reply from ${displayName}`}
                  />
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
                {shouldClamp && (
                  <button
                    type="button"
                    onClick={() => toggleExpandReply(reply._id)}
                    className="hover:text-indigo-500 disabled:opacity-50"
                    disabled={isEditing}
                  >
                    {isExpanded ? "Show less" : "Show more"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => beginReplyTo(reply)}
                  className="hover:text-indigo-500 disabled:opacity-50"
                  disabled={isEditing}
                >
                  Reply
                </button>
                {allowEdit && !isEditing && (
                  <button
                    type="button"
                    onClick={() => beginEditReply(reply)}
                    className="inline-flex items-center gap-1 text-indigo-500 hover:text-indigo-400"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                )}
                {allowDelete && (
                  <button
                    type="button"
                    onClick={() => handleDeleteReply(reply._id)}
                    className="inline-flex items-center gap-1 text-rose-500 hover:text-rose-400 disabled:opacity-60"
                    disabled={isDeleting}
                  >
                    {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                )}
                {isEditing && (
                  <span className="text-[11px] font-semibold text-slate-400">Editing...</span>
                )}
              </div>
            </div>
          </div>
        </div>
        {childCount > 0 && (
          <div className="ml-10">
            {!areChildrenExpanded ? (
              <button
                type="button"
                onClick={() => toggleChildReplies(reply._id)}
                className="text-xs font-semibold text-slate-500 hover:text-indigo-500"
              >
                View {childCount} {childCount === 1 ? "reply" : "replies"}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="space-y-3">
                  {reply.children?.map((child) => renderReplyItem(child, depth + 1))}
                </div>
                <button
                  type="button"
                  onClick={() => toggleChildReplies(reply._id)}
                  className="text-xs font-semibold text-slate-400 hover:text-indigo-500"
                >
                  Hide replies
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const backgroundStyles = {
    backgroundColor: darkMode ? "#0f172a" : "#f8fafc",
    color: darkMode ? "#e2e8f0" : "#0f172a",
  };

  return (
    <>
      <div className="flex h-screen overflow-hidden relative" style={backgroundStyles}>
        <Navbar />
        <Sidebar role={sidebarRole} />

        <div className="flex flex-col flex-1 w-0 overflow-hidden">
  <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 mt-16 sm:pl-24 md:pl-28">
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      
      {/* --- HEADER / BREADCRUMB --- */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 dark:border-slate-700 dark:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <Link
          to={`/forums/${forumId}`}
          className="text-22xl font-semibold text-indigo-500 hover:text-indigo-400 dark:text-indigo-400"
        >
          Forum overview
        </Link>

        {forum && (
          <span className="text-1xl text-slate-600 dark:text-white">
            View post in {forum.title}
          </span>
        )}
      </div>

      {/* --- LOADING / ERROR --- */}
      {loading ? (
        <div className="flex items-center gap-3 text-slate-400 dark:text-white">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading post...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:text-white">
          <p className="font-semibold mb-2">Unable to load post</p>
          <p className="text-sm">{error}</p>
        </div>
      ) : post ? (
        <section
          className={`rounded-2xl p-6 shadow-sm space-y-5 ${
            darkMode
              ? "bg-slate-900/70 border border-slate-700/60 text-white"
              : "bg-white border border-slate-100"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-4">

              {/* --- TIME + PIN --- */}
              <div className="text-xs text-slate-400 dark:text-white flex items-center gap-2">
                {post.pinned && (
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">
                    Pinned
                  </span>
                )}
                <span>{formatDate(post.createdAt)}</span>
              </div>

              {/* --- EDITING MODE --- */}
              {isEditingPost ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={editPostTitle}
                    onChange={(e) => setEditPostTitle(e.target.value)}
                    className={`w-full text-3xl font-bold bg-transparent border-b-2 focus:outline-none ${
                      darkMode
                        ? "border-slate-700 focus:border-indigo-500 text-white"
                        : "border-slate-200 focus:border-indigo-500 text-slate-900"
                    }`}
                    placeholder="Post title"
                  />

                  <div className="min-h-[200px]">
                    <MarkdownComposer
                      value={editPostContent}
                      onChange={setEditPostContent}
                      placeholder="Edit your post content..."
                      darkMode={darkMode}
                      attachmentAccept={attachmentAcceptTypes}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleUpdatePost}
                      disabled={postSaving}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-white font-semibold hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {postSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Save Changes
                    </button>

                    <button
                      onClick={cancelEditingPost}
                      disabled={postSaving}
                      className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-white"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* --- TITLE --- */}
                  <h1 className="text-3xl font-bold dark:text-white">
                    {post.title}
                  </h1>

                  {/* --- CONTENT (MARKDOWN) --- */}
                  <div className="prose max-w-none dark:prose-invert dark:text-white">
                    <MarkdownContent
                      content={post.content}
                      onImageClick={handleImagePreview}
                    />
                  </div>

                  <AttachmentPreview
                    files={post.key}
                    size="md"
                    onImageClick={handleImagePreview}
                    caption={post.title}
                  />
                </>
              )}

              {/* --- AUTHOR --- */}
              {post.author && (
                <p className="text-xs text-slate-500 dark:text-white">
                  Posted by {post.author.fullname || post.author.username}
                </p>
              )}
            </div>

            {/* --- EDIT BUTTON --- */}
            {!isEditingPost && canManagePost && (
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={startEditingPost}
                  className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:text-white dark:hover:text-indigo-400 transition-colors"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* --- REPLIES SECTION --- */}
          <div className="pt-4 border-t border-slate-100 space-y-4 dark:border-slate-800 dark:text-white">

            {/* --- ADD REPLY FORM --- */}
            <form className="space-y-3" onSubmit={handleReplySubmit}>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold dark:text-white">
                  Add reply
                </label>

                {replyTarget?.displayName && (
                  <button
                    type="button"
                    onClick={() => beginReplyTo()}
                    className="text-xs font-semibold text-indigo-500 hover:text-indigo-400 dark:text-indigo-400"
                  >
                    Replying to @{replyTarget.displayName} • Cancel
                  </button>
                )}
              </div>

              {replyTarget?.displayName && (
                <div
                  className={`text-xs rounded-xl px-3 py-2 border ${
                    darkMode
                      ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-100"
                      : "border-indigo-200 bg-indigo-50 text-indigo-600"
                  }`}
                >
                  You are replying to{" "}
                  <span className="font-semibold">
                    @{replyTarget.displayName}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2 dark:text-white">
                  Content editor
                </label>

                <MarkdownComposer
                  value={replyContent}
                  onChange={(next) => {
                    setReplyContent(next);
                  }}
                  placeholder="Share your thoughts..."
                  darkMode={darkMode}
                  attachment={replyFile}
                  onAttachmentChange={(file) => setReplyFile(file)}
                  attachmentAccept={attachmentAcceptTypes}
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="rounded-xl border px-5 py-2 text-sm font-semibold border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800 dark:text-white"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-white font-semibold hover:bg-indigo-500 disabled:opacity-50"
                  disabled={replySubmitting}
                >
                  {replySubmitting && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  Send
                </button>
              </div>
            </form>

            {/* --- REPLIES HEADER --- */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold dark:text-white">
                  Replies
                </h4>
                <p className="text-xs text-slate-500 dark:text-white">
                  {replyCount} replies
                </p>
              </div>

              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-white">
                <MessageSquare className="w-3.5 h-3.5" />
                {replyCount}
              </span>
            </div>

            {/* --- REPLIES LIST --- */}
            {repliesLoading ? (
              <div className="flex items-center gap-3 text-slate-400 dark:text-white py-8">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading replies...</span>
              </div>
            ) : repliesError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-200">
                <p className="font-semibold mb-2">Unable to load replies</p>
                <p className="text-sm">{repliesError}</p>
              </div>
            ) : nestedReplies.length > 0 ? (
              <div className="space-y-4">
                {nestedReplies.map((reply) => renderReplyItem(reply, 0))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 dark:text-white">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-semibold">No replies yet</p>
                <p className="text-xs mt-1">Be the first to reply!</p>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  </main>
</div>
</div>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="max-h-full max-w-4xl w-full flex flex-col items-center gap-4"
            onClick={(event) => event.stopPropagation()}
          >
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

export default ForumPostDetailPage;

