import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import Navbar from "../../components/layout/Navbar.tsx";
import Sidebar from "../../components/layout/Sidebar.tsx";
import AttendanceProgressIndicator from "../../components/attendance/AttendanceProgressIndicator.tsx";
import CourseGrid from "../../components/common/CourseGrid.tsx";
import {
    semesterService,
    courseService,
    type Semester,
} from "../../services";
import type { Course } from "../../types/course";
import { Search } from "lucide-react";

export default function MyCoursesV2() {
    const { darkMode } = useTheme();
    const navigate = useNavigate();
    const { semesterId } = useParams<{ semesterId?: string }>();

    const [semesters, setSemesters] = useState<Semester[]>([]);
    const [selectedSemester, setSelectedSemester] = useState<Semester | null>(null);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
    const [subjects, setSubjects] = useState<Array<{ _id: string; name: string }>>([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState("");

    // Find semester closest to current date
    const findClosestSemester = (semesters: Semester[]): Semester | null => {
        if (semesters.length === 0) return null;

        const now = new Date();
        const nowUTC7 = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        let closest: Semester | null = null;
        let minDiff = Infinity;

        for (const semester of semesters) {
            const startDate = new Date(semester.startDate);
            const endDate = new Date(semester.endDate);

            if (nowUTC7 >= startDate && nowUTC7 <= endDate) {
                return semester;
            }

            const diff = Math.abs(startDate.getTime() - nowUTC7.getTime());
            if (diff < minDiff && startDate >= nowUTC7) {
                minDiff = diff;
                closest = semester;
            }
        }

        if (!closest) {
            return semesters.sort((a, b) =>
                new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
            )[0];
        }

        return closest;
    };

    // Fetch subjects for filter
    useEffect(() => {
        const fetchSubjects = async () => {
            try {
                const { subjectService } = await import("../../services");
                const result = await subjectService.getAllSubjects({ limit: 200, sortOrder: "asc" });
                const list = Array.isArray(result?.data) ? result.data : [];
                setSubjects(list.map((s: any) => ({ _id: s._id, name: s.name })));
            } catch (err) {
                console.error("Failed to fetch subjects", err);
            }
        };
        fetchSubjects();
    }, []);

    // Fetch semesters
    useEffect(() => {
        const fetchSemesters = async () => {
            try {
                setLoading(true);
                const data = await semesterService.getAllSemesters();
                setSemesters(data);

                if (semesterId) {
                    const semester = data.find(s => s._id === semesterId);
                    if (semester) {
                        setSelectedSemester(semester);
                    } else {
                        const closest = findClosestSemester(data);
                        if (closest) {
                            setSelectedSemester(closest);
                            navigate(`/my-courses-v2/${closest._id}`, { replace: true });
                        }
                    }
                } else {
                    const closest = findClosestSemester(data);
                    if (closest) {
                        setSelectedSemester(closest);
                        navigate(`/my-courses-v2/${closest._id}`, { replace: true });
                    }
                }
            } catch (err: any) {
                setError(err.message || "Failed to fetch semesters");
            } finally {
                setLoading(false);
            }
        };

        fetchSemesters();
    }, [semesterId, navigate]);

    // Fetch courses when semester or subject changes
    useEffect(() => {
        const fetchCourses = async () => {
            if (!selectedSemester) return;

            try {
                setLoading(true);
                setCourses([]); // Clear old courses immediately to prevent flicker
                const result = await courseService.getAllCourses({
                    semesterId: selectedSemester._id,
                    isPublished: true,
                    limit: 100,
                    ...(selectedSubjectId && { subjectId: selectedSubjectId }),
                });
                setCourses(result.courses || []);
            } catch (err: any) {
                setError(err.message || "Failed to fetch courses");
            } finally {
                setLoading(false);
            }
        };

        fetchCourses();
    }, [selectedSemester?._id, selectedSubjectId]); // Only re-fetch when semester ID changes, not the whole object

    // Filter courses based on search term
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredCourses(courses);
            return;
        }

        const term = searchTerm.toLowerCase();
        const filtered = courses.filter(course =>
            course.title.toLowerCase().includes(term) ||
            course.description?.toLowerCase().includes(term) ||
            (typeof course.subjectId === "object" && course.subjectId?.name?.toLowerCase().includes(term))
        );
        setFilteredCourses(filtered);
    }, [searchTerm, courses]);

    const handleSemesterChange = (semester: Semester) => {
        setSelectedSemester(semester);
        setSearchTerm("");
        setSelectedSubjectId("");
        navigate(`/my-courses-v2/${semester._id}`);
    };

    const handleCourseClick = (course: Course) => {
        navigate(`/courses/${course._id}`);
    };

    return (
        <div
            className="min-h-screen transition-colors duration-300"
            style={{ backgroundColor: darkMode ? "#1a202c" : "#f7fafc" }}
        >
            <Navbar />
            <div className="flex pt-16">
                <Sidebar />
                <main className="flex-1 p-6 lg:p-8">
                    <div className="max-w-7xl mx-auto">
                        {/* Header */}
                        <div className="mb-6">
                            <h1
                                className="text-3xl font-bold mb-2"
                                style={{ color: darkMode ? "#ffffff" : "#1e293b" }}
                            >
                                My Courses
                            </h1>
                            <p
                                className="text-sm"
                                style={{ color: darkMode ? "#94a3b8" : "#64748b" }}
                            >
                                Browse your enrolled courses by semester
                            </p>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div
                                className="mb-4 p-4 rounded-lg flex items-center gap-2"
                                style={{
                                    backgroundColor: darkMode ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.1)",
                                    border: "1px solid rgba(239, 68, 68, 0.3)",
                                    color: "#ef4444",
                                }}
                            >
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Semester Selection */}
                        <div className="mb-6">
                            <label
                                className="block text-sm font-medium mb-2"
                                style={{ color: darkMode ? "#e2e8f0" : "#475569" }}
                            >
                                Select Semester
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {semesters.map((semester) => (
                                    <button
                                        key={semester._id}
                                        onClick={() => handleSemesterChange(semester)}
                                        className={`px-4 py-2 rounded-lg transition-all ${selectedSemester?._id === semester._id
                                            ? "ring-2 ring-indigo-500"
                                            : ""
                                            }`}
                                        style={{
                                            backgroundColor:
                                                selectedSemester?._id === semester._id
                                                    ? darkMode
                                                        ? "rgba(99, 102, 241, 0.2)"
                                                        : "rgba(99, 102, 241, 0.1)"
                                                    : darkMode
                                                        ? "rgba(148, 163, 184, 0.1)"
                                                        : "rgba(148, 163, 184, 0.1)",
                                            color: darkMode ? "#e2e8f0" : "#475569",
                                        }}
                                    >
                                        {semester.name}
                                    </button>
                                ))}
                            </div>
                            {selectedSemester && (
                                <div className="mt-4">
                                    <AttendanceProgressIndicator
                                        startDate={selectedSemester.startDate}
                                        endDate={selectedSemester.endDate}
                                        label="Semester Progress"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Search Bar & Subject Filter */}
                        {selectedSemester && (
                            <div className="mb-6">
                                <div className="flex gap-3">
                                    <div className="relative flex-1">
                                        <Search
                                            className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5"
                                            style={{ color: darkMode ? '#94a3b8' : '#64748b' }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Search courses by title, description, or subject..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 rounded-lg border transition-colors"
                                            style={{
                                                backgroundColor: darkMode ? "rgba(30, 41, 59, 0.5)" : "#ffffff",
                                                borderColor: darkMode ? "rgba(148, 163, 184, 0.1)" : "rgba(148, 163, 184, 0.2)",
                                                color: darkMode ? "#ffffff" : "#1e293b",
                                            }}
                                        />
                                    </div>
                                    <select
                                        value={selectedSubjectId}
                                        onChange={(e) => {
                                            setSelectedSubjectId(e.target.value);
                                            setSearchTerm("");
                                        }}
                                        className="px-4 py-3 rounded-lg border transition-colors min-w-[200px]"
                                        style={{
                                            backgroundColor: darkMode ? "rgba(30, 41, 59, 0.5)" : "#ffffff",
                                            borderColor: darkMode ? "rgba(148, 163, 184, 0.1)" : "rgba(148, 163, 184, 0.2)",
                                            color: darkMode ? "#ffffff" : "#1e293b",
                                        }}
                                    >
                                        <option value="">All Subjects</option>
                                        {subjects.map((subject) => (
                                            <option key={subject._id} value={subject._id}>
                                                {subject.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Course Grid */}
                        {selectedSemester && (
                            <div className="mb-6">
                                <label
                                    className="block text-sm font-medium mb-2"
                                    style={{ color: darkMode ? "#e2e8f0" : "#475569" }}
                                >
                                    Available Courses ({filteredCourses.length})
                                </label>
                                <CourseGrid
                                    courses={filteredCourses}
                                    loading={loading}
                                    emptyMessage={searchTerm || selectedSubjectId
                                        ? "No courses found matching your filters"
                                        : "No courses available for this semester"}
                                    onCourseClick={handleCourseClick}
                                    showProgress={true}
                                    showDescription={true}
                                    showCode={true}
                                />
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
