// FE_LMS/src/pages/MyCourses.tsx
import React, { useEffect, useState } from "react";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import Navbar from "../../components/layout/Navbar.tsx";
import Sidebar from "../../components/layout/Sidebar.tsx";
import http from "../../utils/http";
import useDebounce from "../../hooks/useDebounce";
import type { Course } from "../../types/course";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { userService } from "../../services/userService";

const MyCoursesPage: React.FC = () => {
    const { darkMode } = useTheme();
    const { user } = useAuth();
    const navigate = useNavigate();
      const [searchParams, setSearchParams] = useSearchParams();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState(searchParams.get("search") ?? "");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [currentPage, setCurrentPage] = useState(Number(searchParams.get("page") ?? "1"));
    const [pageLimit, setPageLimit] = useState(Number(searchParams.get("limit") ?? "25"));
    const [totalCourses, setTotalCourses] = useState(0);
    const [sortOption, setSortOption] = useState<'name_asc' | 'name_desc' | 'date_asc' | 'date_desc'>((searchParams.get("sort") as 'name_asc' | 'name_desc' | 'date_asc' | 'date_desc') || 'date_desc');
    const [mySubjects, setMySubjects] = useState<Array<{ _id: string; name: string }>>([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState(searchParams.get("subjectId") ?? "");
    const [semesters, setSemesters] = useState<Array<{ _id: string; name: string }>>([]);
    const [selectedSemesterId, setSelectedSemesterId] = useState(searchParams.get("semesterId") ?? "");
    const [teachers, setTeachers] = useState<Array<{ _id: string; fullname?: string; username?: string }>>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState(searchParams.get("teacherId") ?? "");

    const fetchMyCourses = async () => {
        try {
            setLoading(true);
            const isName = sortOption === 'name_asc' || sortOption === 'name_desc';
            const order = (sortOption.endsWith('asc') ? 'asc' : 'desc') as 'asc' | 'desc';
            const params: any = {
                page: currentPage,
                limit: pageLimit,
                ...(debouncedSearchTerm ? { search: debouncedSearchTerm } : {}),
                ...(selectedSubjectId ? { subjectId: selectedSubjectId } : {}),
                ...(selectedSemesterId ? { semesterId: selectedSemesterId } : {}),
                ...(selectedTeacherId ? { teacherId: selectedTeacherId } : {}),
                ...(isName ? { sortBy: 'title' } : {}),
                ...(order ? { sortOrder: order } : {}),
            };
            const res = await http.get("/courses/my-courses", { params });
            const dataAny: any = res as any;
            const list: Course[] = Array.isArray(dataAny?.data)
                ? dataAny.data
                : Array.isArray(dataAny?.data?.data)
                ? dataAny.data.data
                : Array.isArray(dataAny)
                ? dataAny
                : [];
            const pagination: any = dataAny?.pagination || dataAny?.meta?.pagination;
            setCourses(list);
            setError("");
            setTotalCourses(pagination?.total ?? list.length);
        } catch (e: any) {
            setError(e?.message || "Failed to load courses");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMyCourses();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, pageLimit, sortOption, debouncedSearchTerm, selectedSubjectId, selectedSemesterId, selectedTeacherId]);

    useEffect(() => {
        (async () => {
            try {
                const [subjectsRes, semestersRes, teachersRes] = await Promise.allSettled([
                    http.get('/subjects/my-subjects'),
                    http.get('/semesters'),
                    userService.getUsers({ role: 'teacher', limit: 100 } as any),
                ]);
                if (subjectsRes.status === 'fulfilled') {
                    const list = Array.isArray((subjectsRes.value as any)?.data) ? (subjectsRes.value as any).data : [];
                    setMySubjects(list.map((s: any) => ({ _id: s._id, name: s.name })));
                }
                if (semestersRes.status === 'fulfilled') {
                    const body: any = semestersRes.value as any;
                    const list = Array.isArray(body?.data) ? body.data : Array.isArray(body?.data?.data) ? body.data.data : Array.isArray(body) ? body : [];
                    setSemesters(list.map((x: any) => ({ _id: x._id, name: x.name })));
                }
                if (teachersRes.status === 'fulfilled') {
                    const list = teachersRes.value.users || [];
                    setTeachers(list.map((u: any) => ({ _id: u._id, fullname: u.fullname, username: u.username })));
                }
            } catch {}
        })();
    }, []);

    useEffect(() => {
        const params: Record<string, string> = {};
        if (debouncedSearchTerm) params.search = debouncedSearchTerm;
        if (sortOption) params.sort = sortOption;
        if (selectedSubjectId) params.subjectId = selectedSubjectId;
        if (selectedSemesterId) params.semesterId = selectedSemesterId;
        if (selectedTeacherId) params.teacherId = selectedTeacherId;
        params.page = String(currentPage);
        params.limit = String(pageLimit);
        setSearchParams(params);
    }, [debouncedSearchTerm, sortOption, selectedSubjectId, selectedSemesterId, selectedTeacherId, currentPage, pageLimit, setSearchParams]);

    return (
        <div
            className="min-h-screen transition-colors duration-300"
            style={{
                backgroundColor: darkMode ? "#0f172a" : "#f8fafc",
                color: darkMode ? "#ffffff" : "#0f172a",
            }}
        >
            <Navbar />
                  <Sidebar role={user?.role as 'admin' | 'teacher' | 'student'} />
            <div className="max-w-[1200px] mt-[100px] mx-auto px-4 sm:pl-[93px] py-6">
                <h1
                    className="text-2xl font-semibold mb-6"
                    style={{ color: darkMode ? "#ffffff" : "#111827" }}
                >
                    My Courses
                </h1>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }} />
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search courses by title or description"
                                className="pl-9 pr-3 py-2 rounded-lg outline-none shadow-sm w-full sm:w-64"
                                style={{
                                    backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                                    color: darkMode ? "#ffffff" : "#111827",
                                    border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e7eb",
                                }}
                            />
                        </div>
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as 'name_asc' | 'name_desc' | 'date_asc' | 'date_desc')}
                            className="px-3 py-2 rounded-lg w-full sm:w-auto"
                            style={{
                                backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                                color: darkMode ? "#ffffff" : "#111827",
                                border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e7eb",
                            }}
                        >
                            <option value="date_desc">Newest</option>
                            <option value="date_asc">Oldest</option>
                            <option value="name_asc">Title A-Z</option>
                            <option value="name_desc">Title Z-A</option>
                        </select>
                        <select
                            value={selectedSubjectId}
                            onChange={(e) => { setSelectedSubjectId(e.target.value); setCurrentPage(1); }}
                            className="px-3 py-2 rounded-lg w-full sm:w-auto"
                            style={{
                                backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                                color: darkMode ? "#ffffff" : "#111827",
                                border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e7eb",
                            }}
                        >
                            <option value="">All My Subjects</option>
                            {mySubjects.map((s) => (
                                <option key={s._id} value={s._id}>{s.name}</option>
                            ))}
                        </select>
                        <select
                            value={selectedSemesterId}
                            onChange={(e) => { setSelectedSemesterId(e.target.value); setCurrentPage(1); }}
                            className="px-3 py-2 rounded-lg w-full sm:w-auto"
                            style={{
                                backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                                color: darkMode ? "#ffffff" : "#111827",
                                border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e7eb",
                            }}
                        >
                            <option value="">All Semesters</option>
                            {semesters.map((s) => (
                                <option key={s._id} value={s._id}>{s.name}</option>
                            ))}
                        </select>
                        <select
                            value={selectedTeacherId}
                            onChange={(e) => { setSelectedTeacherId(e.target.value); setCurrentPage(1); }}
                            className="px-3 py-2 rounded-lg w-full sm:w-auto"
                            style={{
                                backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                                color: darkMode ? "#ffffff" : "#111827",
                                border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e7eb",
                            }}
                        >
                            <option value="">All Teachers</option>
                            {teachers.map((t) => (
                                <option key={t._id} value={t._id}>{t.fullname || t.username}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
<select
                        value={pageLimit}
                        onChange={(e) => {
                            setCurrentPage(1);
                            setPageLimit(Number(e.target.value));
                        }}
                        className="px-3 py-2 rounded-lg w-full sm:w-auto"
                        style={{
                            backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                            color: darkMode ? "#ffffff" : "#111827",
                            border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e7eb",
                        }}
                    >
                        {[10, 20, 25, 50].map((n) => (
                            <option key={n} value={n}>{n}/page</option>
                        ))}
                    </select>
                    </div>
                    
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-16">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: darkMode ? '#6366f1' : '#4f46e5' }} />
                    </div>
                ) : error ? (
                    <div
                        className="p-4 rounded-lg mb-6"
                        style={{
                            backgroundColor: darkMode ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2',
                            color: darkMode ? '#fca5a5' : '#dc2626'
                        }}
                    >
                        {error}
                    </div>
                ) : (
                    <>
                                {courses.length === 0 ? (
                                    <div className="text-center py-12">
                                        <svg className="w-24 h-24 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: darkMode ? '#6b7280' : '#9ca3af' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                        <h3 className="text-xl font-semibold mb-2" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>No courses available</h3>
                                        <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>There are no courses available for enrollment at the moment</p>
                                    </div>
                                ) : (
                                    <><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                                        {courses.map((course) => (
                                            <div
                                                key={course._id}
                                                className="rounded-xl p-6 neu-surface transition-all duration-300 hover:scale-[1.02] hover:shadow-xl flex flex-col"
                                                style={{
                                                    backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.85)' : '#f7f7fb',
                                                    border: 'none',
                                                    minHeight: '320px',
                                                }}
                                            >
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center space-x-2 mb-2">
                                                            {course.code && (
                                                                <span
                                                                    className="px-2 py-1 rounded text-xs font-semibold"
                                                                    style={{
                                                                        backgroundColor: darkMode ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff',
                                                                        color: darkMode ? '#a5b4fc' : '#4f46e5'
                                                                    }}
                                                                >
                                                                    {course.code}
                                                                </span>
                                                            )}
                                                            {course.isPublished ? (
                                                                <span
                                                                    className="px-2 py-1 rounded text-xs font-semibold"
                                                                    style={{
                                                                        backgroundColor: darkMode ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5',
                                                                        color: darkMode ? '#6ee7b7' : '#059669'
                                                                    }}
                                                                >
                                                                    Published
                                                                </span>
                                                            ) : (
                                                                <span
                                                                    className="px-2 py-1 rounded text-xs font-semibold"
                                                                    style={{
                                                                        backgroundColor: darkMode ? 'rgba(156, 163, 175, 0.2)' : '#f3f4f6',
                                                                        color: darkMode ? '#9ca3af' : '#6b7280'
                                                                    }}
                                                                >
                                                                    Draft
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h3 className="text-xl font-bold mb-2" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                                                            {course.title}
                                                        </h3>
                                                    </div>
                                                </div>

                                                <p className="text-sm mb-4 line-clamp-2" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                                    {course.description}
                                                </p>

                                                <div className="space-y-2 mb-4">
                                                    <div className="flex items-center text-sm">
                                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: darkMode ? '#6b7280' : '#9ca3af' }}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                        </svg>
                                                        <span style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                                            {(() => {
                                                                const sem: any = (course as any).semesterId;
                                                                return typeof sem === 'object' && sem ? (sem.name || 'No Semester') : 'No Semester';
                                                            })()}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center text-sm">
                                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: darkMode ? '#6b7280' : '#9ca3af' }}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                        </svg>
                                                        <span style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                                            Capacity: {course.capacity} students
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-auto pt-4 border-t" style={{ borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb' }}>
                                                    <button
                                                        className="w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-90"
                                                        style={{
                                                            backgroundColor: darkMode ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff',
                                                            color: darkMode ? '#a5b4fc' : '#4f46e5'
                                                        }}
                                                        onClick={() => navigate(`/courses/${course._id}`)}
                                                    >
                                                        View Course
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div><div className="flex items-center justify-between px-4 py-4 mt-2">
                                        <div className="text-sm" style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}>
                                            Total: {totalCourses}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                                className="px-3 py-2 rounded-lg disabled:opacity-50 flex items-center gap-1"
                                                style={{
                                                    backgroundColor: darkMode ? "#111827" : "#ffffff",
                                                    border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e7eb",
                                                }}
                                                disabled={currentPage <= 1}
                                            >
                                                <ChevronLeft size={16} /> Prev
                                            </button>
                                            <span
                                                className="px-3 py-1 rounded-full text-sm"
                                                style={{
                                                    backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.6)' : '#f3f4f6',
                                                    color: darkMode ? '#e5e7eb' : '#374151'
                                                }}
                                            >
                                                {currentPage} / {Math.max(1, Math.ceil(totalCourses / pageLimit))}
                                            </span>
                                            <button
                                                onClick={() => setCurrentPage((p) => p + 1)}
                                                className="px-3 py-2 rounded-lg disabled:opacity-50 flex items-center gap-1"
                                                style={{
                                                    backgroundColor: darkMode ? "#111827" : "#ffffff",
                                                    border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e7eb",
                                                }}
                                                disabled={currentPage >= Math.max(1, Math.ceil(totalCourses / pageLimit))}
                                            >
                                                Next <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div></>
                                )
                                }
                    </>
                    
                )}
            </div>
        </div>
    );
};

export default MyCoursesPage;
