import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import LandingHeader from "../../components/landing/LandingHeader";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import type { BlogPost } from "../../types/blog";
import { getBlogBySlug } from "../../services/blogService";
import { Loader2, ArrowLeft, Calendar } from "lucide-react";

const BlogDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const [blog, setBlog] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBlog = async () => {
      if (!slug) return;
      setLoading(true);
      try {
        const response = await getBlogBySlug(slug);
        setBlog(response.data);
      } catch (err) {
        console.error("Failed to fetch blog detail", err);
        navigate("/blogs"); // Redirect on error
      } finally {
        setLoading(false);
      }
    };
    fetchBlog();
  }, [slug, navigate]);

  if (loading) {
    return (
      <>
        {user ? <Navbar /> : <LandingHeader />}
        <div className="min-h-screen flex items-center justify-center pt-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      </>
    );
  }

  if (!blog) {
    return null; // Render nothing while redirecting
  }

  return (
    <>
      {user ? <Navbar /> : <LandingHeader />}
      <div
        className="min-h-screen transition-colors duration-200"
        style={{
          paddingTop: user ? 80 : 0, // Fix spacing issue: 0 for sticky LandingHeader, 80 for fixed Navbar
          backgroundColor: darkMode ? "rgb(26, 32, 44)" : "#f8fafc",
        }}
      >
        <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
          <Link
            to="/blogs"
            className={`inline-flex items-center gap-2 mb-8 text-sm font-medium transition-colors group ${
              darkMode
                ? "text-slate-400 hover:text-indigo-400"
                : "text-slate-600 hover:text-indigo-600"
            }`}
          >
            <div
              className={`p-2 rounded-full transition-colors ${
                darkMode
                  ? "bg-slate-800 group-hover:bg-indigo-500/20"
                  : "bg-white group-hover:bg-indigo-50 shadow-sm"
              }`}
            >
              <ArrowLeft className="h-4 w-4" />
            </div>
            Back to Blogs
          </Link>

          <article
            className={`flex flex-col gap-10 rounded-3xl border p-6 md:p-10 ${
              darkMode
                ? "border-slate-700 shadow-2xl"
                : "bg-white/80 border-slate-200 shadow-xl"
            }`}
            style={{
              backgroundColor: darkMode ? "rgba(30, 41, 59, 0.85)" : undefined,
              backdropFilter: "blur(12px)",
            }}
          >
            {/* Header Section */}
            <header className="flex flex-col gap-6">
              {blog.category && (
                <div className="flex">
                  <span className="inline-flex items-center px-3 py-1 text-xs font-bold tracking-wider text-indigo-500 uppercase bg-indigo-500/10 rounded-full border border-indigo-500/20">
                    {blog.category}
                  </span>
                </div>
              )}

              <h1
                className={`text-3xl md:text-5xl font-extrabold leading-tight ${
                  darkMode ? "text-white" : "text-slate-900"
                }`}
              >
                {blog.title}
              </h1>

              <div className="flex items-center gap-6 text-sm border-b pb-8 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-indigo-500/20">
                    <img
                      src={
                        blog.avatar ||
                        "https://ui-avatars.com/api/?name=" + blog.authorName
                      }
                      alt={blog.authorName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p
                      className={`font-semibold ${
                        darkMode ? "text-slate-200" : "text-slate-900"
                      }`}
                    >
                      {blog.authorName}
                    </p>
                    <p
                      className={darkMode ? "text-slate-500" : "text-slate-500"}
                    >
                      Author
                    </p>
                  </div>
                </div>

                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800"></div>

                <div className="flex items-center gap-2">
                  <div
                    className={`p-2 rounded-lg ${
                      darkMode
                        ? "bg-slate-800 text-slate-400"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <p
                      className={`font-medium ${
                        darkMode ? "text-slate-300" : "text-slate-700"
                      }`}
                    >
                      {new Date(blog.createdAt).toLocaleDateString("vi-VN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <p
                      className={darkMode ? "text-slate-500" : "text-slate-500"}
                    >
                      Published
                    </p>
                  </div>
                </div>
              </div>
            </header>

            {/* Featured Image */}
            <div className="w-full aspect-video md:aspect-[21/9] relative rounded-3xl overflow-hidden shadow-2xl">
              <img
                src={blog.thumbnailUrl}
                alt={blog.title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Content */}
            <div
              className={`mx-auto w-full max-w-none ${
                darkMode ? "text-slate-300" : "text-slate-700"
              }`}
            >
              <div
                className={`prose prose-lg md:prose-xl max-w-none ${
                  darkMode
                    ? "prose-invert prose-p:text-slate-300 prose-headings:text-white prose-strong:text-white"
                    : "prose-slate prose-headings:text-slate-900"
                } prose-img:rounded-2xl prose-img:shadow-lg prose-a:text-indigo-500 hover:prose-a:text-indigo-600`}
                dangerouslySetInnerHTML={{ __html: blog.content }}
              />
            </div>
          </article>
        </main>
      </div>
    </>
  );
};

export default BlogDetailPage;
