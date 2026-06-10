import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import LandingHeader from "../../components/landing/LandingHeader";
import { useTheme } from "../../hooks/useTheme";
import type { BlogPost } from "../../types/blog";
import {
  getBlogs,
  createBlog,
  updateBlog,
  deleteBlog,
} from "../../services/blogService";
import { useAuth } from "../../hooks/useAuth";
import { Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import BlogFormModal from "../../components/blog/BlogFormModal";
import Swal from "sweetalert2";

// ---- Card component ----
function BlogCard({
  post,
  isAdmin,
  onEdit,
  onDelete,
}: {
  post: BlogPost;
  isAdmin: boolean;
  onEdit: (post: BlogPost) => void;
  onDelete: (id: string) => void;
}) {
  const { darkMode } = useTheme();
  const date = new Date(post.createdAt).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <article
      className={`group relative flex flex-col md:flex-row gap-6 md:gap-8 p-6 rounded-2xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
        darkMode
          ? "bg-[#1a202c] border-slate-700 hover:border-indigo-500/50 hover:shadow-indigo-500/10"
          : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-indigo-100"
      }`}
    >
      {/* Admin Actions */}
      {isAdmin && (
        <div className="absolute z-10 flex gap-2 transition-opacity opacity-0 top-4 right-4 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.preventDefault();
              onEdit(post);
            }}
            className="p-2 text-white bg-blue-500 rounded-full shadow-lg hover:bg-blue-600"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              onDelete(post._id);
            }}
            className="p-2 text-white bg-red-500 rounded-full shadow-lg hover:bg-red-600"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Image Section */}
      <div className="w-full md:w-5/12 shrink-0">
        <div className="relative w-full overflow-hidden aspect-video rounded-xl">
          <img
            src={post.thumbnailUrl}
            alt={post.title}
            className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      </div>

      {/* Content Section */}
      <div className="flex flex-col flex-1">
        {/* Category */}
        {post.category && (
          <div className="mb-3">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                darkMode
                  ? "bg-indigo-950/40 text-indigo-300 border border-indigo-900/60"
                  : "bg-indigo-50 text-indigo-700 border border-indigo-100"
              }`}
            >
              {post.category}
            </span>
          </div>
        )}

        {/* Title */}
        <h2 className="mb-2 text-xl font-bold md:text-2xl">
          <Link
            to={`/blogs/${post.slug}`}
            className={`transition-colors ${
              darkMode
                ? "text-slate-50 group-hover:text-indigo-400"
                : "text-slate-900 group-hover:text-indigo-600"
            }`}
          >
            {post.title}
          </Link>
        </h2>

        {/* Meta */}
        <div
          className={`mb-4 flex items-center gap-4 text-xs ${
            darkMode ? "text-slate-400" : "text-slate-500"
          }`}
        >
          <span className="flex items-center gap-1">
            <i className="bi bi-calendar3"></i> {date}
          </span>
          <span className="flex items-center gap-1">
            <i className="bi bi-person"></i> {post.authorName}
          </span>
        </div>

        {/* Description (Excerpt or Content) */}
        <div
          className={`mb-4 line-clamp-3 text-sm leading-relaxed ${
            darkMode ? "text-slate-400" : "text-slate-600"
          }`}
          // Use a stripped version of content if no excerpt
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Read More Button */}
        <div className="flex justify-end mt-auto">
          <Link
            to={`/blogs/${post.slug}`}
            className={`group/btn inline-flex items-center gap-1 text-sm font-medium transition-colors ${
              darkMode
                ? "text-indigo-400 hover:text-indigo-300"
                : "text-indigo-600 hover:text-indigo-700"
            }`}
          >
            Xem thêm
            <span className="transition-transform group-hover/btn:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}

// ---- Pagination component ----
function Pagination({
  pageNumber,
  pageSize,
  total,
  basePath,
}: {
  pageNumber: number;
  pageSize: number;
  total: number;
  basePath: string;
}) {
  const { darkMode } = useTheme();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = pageNumber > 1;
  const hasNext = pageNumber < totalPages;

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 mt-12">
      <Link
        to={`${basePath}?pageNumber=${pageNumber - 1}&pageSize=${pageSize}`}
        className={`inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition ${
          hasPrev
            ? darkMode
              ? "border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            : darkMode
            ? "cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600"
            : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
        }`}
        aria-disabled={!hasPrev}
        onClick={(e) => !hasPrev && e.preventDefault()}
      >
        ← Trước
      </Link>

      <span
        className={`text-sm font-medium ${
          darkMode ? "text-slate-400" : "text-slate-600"
        }`}
      >
        Trang {pageNumber} / {totalPages}
      </span>

      <Link
        to={`${basePath}?pageNumber=${pageNumber + 1}&pageSize=${pageSize}`}
        className={`inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition ${
          hasNext
            ? darkMode
              ? "border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            : darkMode
            ? "cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600"
            : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
        }`}
        aria-disabled={!hasNext}
        onClick={(e) => !hasNext && e.preventDefault()}
      >
        Sau →
      </Link>
    </div>
  );
}

// ---- Page component ----
const BlogPage: React.FC = () => {
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [searchParams, setSearchParams] = useSearchParams();
  const pageNumber = Number(searchParams.get("pageNumber") ?? "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? "10") || 10;
  const search = searchParams.get("search") || "";

  const [items, setItems] = useState<BlogPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(search);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await getBlogs({
        page: pageNumber,
        limit: pageSize,
        search: search,
      });
      setItems(response.data);
      setTotal(response.pagination.total);
    } catch (error) {
      console.error("Failed to fetch blogs", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pageNumber, pageSize, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({
      pageNumber: "1",
      pageSize: String(pageSize),
      search: searchTerm,
    });
  };

  const handleCreate = () => {
    setEditingBlog(null);
    setIsModalOpen(true);
  };

  const handleEdit = (blog: BlogPost) => {
    setEditingBlog(blog);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        await deleteBlog(id);
        Swal.fire("Deleted!", "Your blog has been deleted.", "success");
        fetchData(); // Refresh list
      } catch (error) {
        console.error("Failed to delete blog", error);
        Swal.fire("Error!", "Failed to delete blog.", "error");
      }
    }
  };

  const handleFormSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    try {
      if (editingBlog) {
        await updateBlog(editingBlog._id, formData);
        Swal.fire("Success!", "Blog updated successfully.", "success");
      } else {
        await createBlog(formData);
        Swal.fire("Success!", "Blog created successfully.", "success");
      }
      setIsModalOpen(false);
      fetchData(); // Refresh list
    } catch (error) {
      console.error("Failed to save blog", error);
      Swal.fire("Error!", "Failed to save blog.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {user ? <Navbar /> : <LandingHeader />}
      <div
        className="min-h-screen transition-colors duration-200"
        style={{
          paddingTop: 80,
          backgroundColor: darkMode ? "rgb(26, 32, 44)" : "#f8fafc",
        }}
      >
        <main className="mx-auto w-full max-w-[1000px] px-4 pb-16 pt-10 sm:px-6 lg:px-8">
          <div
            className={`rounded-3xl border p-6 md:p-10 ${
              darkMode
                ? "border-slate-700 shadow-2xl"
                : "bg-white/80 border-slate-200 shadow-xl"
            }`}
            style={{
              backgroundColor: darkMode ? "rgba(30, 41, 59, 0.85)" : undefined,
              backdropFilter: "blur(12px)",
            }}
          >
            {/* Header */}
            <section
              className={`mb-12 flex flex-col md:flex-row gap-6 items-center ${
                isAdmin ? "justify-between" : "justify-center"
              }`}
            >
              {/* Search */}
              <form className="w-full max-w-xl" onSubmit={handleSearch}>
                <div className="relative group">
                  <input
                    type="search"
                    placeholder="Tìm kiếm bài viết..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full rounded-2xl border px-6 py-4 pl-12 text-base shadow-sm outline-none ring-0 transition-all focus:ring-2 focus:-translate-y-0.5 focus:shadow-lg ${
                      darkMode
                        ? "border-slate-600 bg-slate-900/50 text-slate-50 focus:border-indigo-500 focus:ring-indigo-500/20 placeholder-slate-400"
                        : "border-slate-200 bg-white text-slate-900 focus:border-indigo-500 focus:ring-indigo-500/20 placeholder-slate-400"
                    }`}
                  />
                  <span
                    className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg transition-colors ${
                      darkMode
                        ? "text-slate-500 group-focus-within:text-indigo-400"
                        : "text-slate-400 group-focus-within:text-indigo-600"
                    }`}
                  >
                    <i className="bi bi-search"></i>
                  </span>
                </div>
              </form>

              {/* Create Button (Admin Only) */}
              {isAdmin && (
                <button
                  onClick={handleCreate}
                  className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-indigo-600 text-white font-medium shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Create Blog
                </button>
              )}
            </section>

            {/* Blog List */}
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div
                className={`rounded-2xl border border-dashed p-12 text-center text-sm ${
                  darkMode
                    ? "border-slate-800 bg-slate-800/30 text-slate-400"
                    : "border-slate-300 bg-slate-50 text-slate-500"
                }`}
              >
                <i className="block mb-3 text-2xl bi bi-journal-text"></i>
                Hiện chưa có bài viết nào.
              </div>
            ) : (
              <>
                <section className="flex flex-col gap-6">
                  {items.map((post) => (
                    <BlogCard
                      key={post._id}
                      post={post}
                      isAdmin={isAdmin}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </section>

                <Pagination
                  pageNumber={pageNumber}
                  pageSize={pageSize}
                  total={total}
                  basePath="/blogs"
                />
              </>
            )}
          </div>
        </main>

        {/* Modal */}
        <BlogFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleFormSubmit}
          initialData={editingBlog}
          isLoading={isSubmitting}
        />
      </div>
    </>
  );
};

export default BlogPage;
