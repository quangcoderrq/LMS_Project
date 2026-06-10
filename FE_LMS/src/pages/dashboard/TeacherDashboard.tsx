import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import Navbar from "../../components/layout/Navbar.tsx";
import Sidebar from "../../components/layout/Sidebar.tsx";
import { Skeleton } from "../../components/common/Skeleton.tsx";
import { quizService } from "../../services/quizService";
import { courseService } from "../../services/courseService";
import { assignmentService } from "../../services/assignmentService";
import { submissionService } from "../../services/submissionService";
import { enrollmentService } from "../../services/enrollmentService";
import { announcementService } from "../../services/announcementService";

// Types
interface Course {
  _id: string;
  title: string;
  code?: string;
  description?: string;
  logo?: string;
  subjectId?: {
    _id: string;
    name: string;
    code: string;
    credits: number;
  };
  semesterId?: {
    name: string;
    year: number;
  };
  studentCount?: number; // Optional, might not be in API yet
}

interface Assignment {
  _id: string;
  title: string;
  courseId: {
    _id: string;
    title: string;
  };
  dueDate: string;
  status?: string; // 'published', 'draft'
  submissionsCount?: number;
  gradedCount?: number;
  totalStudents?: number;
}

interface Quiz {
  _id: string;
  title: string;
  courseId: string | { _id: string; title: string };
  startTime: string;
  endTime: string;
  isPublished?: boolean;
  snapshotQuestions?: any[];
}

interface Announcement {
  _id: string;
  title: string;
  content: string;
  type: 'system' | 'course';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  courseId?: string | { _id: string; title: string };
  isActive: boolean;
  isPinned: boolean;
  createdAt: string;
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode } = useTheme();
  const { user } = useAuth();

  // Loading states
  const [loading, setLoading] = useState(true);
  const [coursesLoading, setCoursesLoading] = useState(false);

  // Hover preview state with delay
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [isHoverVisible, setIsHoverVisible] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const HOVER_DELAY = 1000; // 1 second delay

  // Handle hover with delay
  const handleMouseEnter = useCallback((cardId: string) => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = setTimeout(() => {
      setHoveredCard(cardId);
      setIsHoverVisible(true);
    }, HOVER_DELAY);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHoverVisible(false);
    setTimeout(() => setHoveredCard(null), 150); // Allow fade-out animation
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  // Data states
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // Carousel state for Teaching Courses
  const [courseCarouselIndex, setCourseCarouselIndex] = useState(0);
  const [coursePage, setCoursePage] = useState(1);
  const [hasMoreCourses, setHasMoreCourses] = useState(false);
  const [totalCourses, setTotalCourses] = useState(0);
  const COURSES_PER_PAGE = 5;
  const VISIBLE_COURSES = 3;

  // Stats
  const [stats, setStats] = useState({
    teachingCourses: 0,
    totalStudents: 0,
    pendingGrading: 0,
    publishedContent: 0
  });

  // Fetch more courses for carousel
  const fetchMoreCourses = useCallback(async (page: number) => {
    if (coursesLoading) return;
    
    try {
      setCoursesLoading(true);
      const response = await courseService.getMyCourses({
        page,
        limit: COURSES_PER_PAGE,
        sortOrder: 'desc'
      });

      const newCourses = response.data || [];
      const pagination = response.pagination;
      
      if (page === 1) {
        setCourses(newCourses as unknown as Course[]);
      } else {
        setCourses(prev => [...prev, ...(newCourses as unknown as Course[])]);
      }

      setHasMoreCourses(pagination?.hasNextPage || false);
      setTotalCourses(pagination?.total || newCourses.length);
      setCoursePage(page);

      return newCourses.length;
    } catch (error) {
      console.error('Error fetching courses:', error);
      return 0;
    } finally {
      setCoursesLoading(false);
    }
  }, [coursesLoading]);

  // Handle carousel navigation
  const handleNextCourse = useCallback(async () => {
    const nextIndex = courseCarouselIndex + 1;
    const maxIndex = Math.max(0, courses.length - VISIBLE_COURSES);
    
    if (nextIndex >= courses.length - VISIBLE_COURSES - 1 && hasMoreCourses) {
      await fetchMoreCourses(coursePage + 1);
    }
    
    if (nextIndex <= maxIndex || hasMoreCourses) {
      setCourseCarouselIndex(Math.min(nextIndex, maxIndex));
    }
  }, [courseCarouselIndex, courses.length, hasMoreCourses, coursePage, fetchMoreCourses]);

  const handlePrevCourse = useCallback(() => {
    setCourseCarouselIndex(prev => Math.max(0, prev - 1));
  }, []);

  // Main data fetch effect - runs once on mount like admin dashboard
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. Fetch Teaching Courses using courseService (limit 5 for carousel)
        let coursesData: any[] = [];
        let pagination: any = undefined;
        try {
          const coursesResponse = await courseService.getMyCourses({
            page: 1,
            limit: COURSES_PER_PAGE,
            sortOrder: 'desc'
          });
          coursesData = coursesResponse.data || [];
          pagination = coursesResponse.pagination;
          setCourses(coursesData as unknown as Course[]);
          setTotalCourses(pagination?.total || coursesData.length);
          setHasMoreCourses(pagination?.hasNextPage || false);
        } catch (err) {
          console.log('Could not fetch courses:', err);
        }

        // 2. Fetch Assignments using assignmentService
        let assignmentsData: any[] = [];
        try {
          const assignmentsResponse = await assignmentService.listAssignments({
            page: 1,
            limit: 20,
            sortOrder: 'desc'
          });
          assignmentsData = assignmentsResponse.data || [];
          setAssignments(assignmentsData as unknown as Assignment[]);
        } catch (err) {
          console.log('Could not fetch assignments:', err);
        }

        // 3. Fetch Quizzes for teaching courses
        let allQuizzes: Quiz[] = [];
        try {
          if (coursesData.length > 0) {
            const quizPromises = coursesData.slice(0, 5).map((course: any) =>
              quizService.getQuizzesByCourseId(course._id, {
                page: 1,
                limit: 5
              }).catch(() => ({ data: [] }))
            );

            const quizResults = await Promise.all(quizPromises);
            allQuizzes = quizResults.flatMap(result => result.data || []);
          }
          setQuizzes(allQuizzes);
        } catch (err) {
          console.log('Could not fetch quizzes:', err);
        }

        // 4. Fetch announcements using announcementService
        try {
          const announcementsResponse = await announcementService.getAllAnnouncements({
            page: 1,
            limit: 5,
            isActive: true,
            sortOrder: 'desc'
          });
          setAnnouncements(announcementsResponse.data || []);
        } catch (err) {
          console.log('Could not fetch announcements:', err);
        }

        // 5. Get enrollment stats for total students count
        let totalStudentsCount = 0;
        if (coursesData.length > 0) {
          const enrollmentPromises = coursesData.slice(0, 10).map((course: any) =>
            enrollmentService.getByCourse(course._id, { page: 1, limit: 1 })
              .catch(() => ({ enrollments: [], pagination: undefined }))
          );

          const enrollmentResults = await Promise.all(enrollmentPromises);
          totalStudentsCount = enrollmentResults.reduce((sum, result) => {
            return sum + (result.pagination?.total || result.enrollments.length);
          }, 0);
        }

        // 6. Calculate Pending Grading using submissionService
        let pendingGradingCount = 0;
        if (assignmentsData.length > 0) {
          try {
            const statsPromises = assignmentsData.slice(0, 5).map((assignment: any) =>
              submissionService.getSubmissionStats(assignment._id).catch(() => null)
            );
            const statsResults = await Promise.all(statsPromises);
            pendingGradingCount = statsResults.reduce((sum, stat) => {
              if (stat) {
                return sum + (stat.totalSubmissions || 0) - (stat.gradedSubmissions || 0);
              }
              return sum;
            }, 0);
          } catch (err) {
            console.log('Could not fetch submission stats:', err);
          }
        }

        // Published Content: Assignments + Quizzes
        const publishedContentCount = assignmentsData.length + allQuizzes.length;

        setStats({
          teachingCourses: pagination?.total || coursesData.length,
          totalStudents: totalStudentsCount,
          pendingGrading: pendingGradingCount,
          publishedContent: publishedContentCount
        });

        setLoading(false);
      } catch (error) {
        console.error('Error fetching teacher dashboard data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []); // Run once on mount like admin dashboard

  // Hover preview component for teacher dashboard with animation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const HoverPreview = ({ items, type, visible }: { items: any[]; type: string; visible: boolean }) => {
    if (!items || items.length === 0) return null;

    return (
      <div
        className={`absolute left-0 right-0 top-full mt-2 p-3 rounded-lg shadow-xl z-[200] transition-all duration-200 ease-out ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
        style={{
          backgroundColor: darkMode ? '#2d3748' : '#ffffff',
          border: darkMode ? '1px solid rgba(148, 163, 184, 0.2)' : '1px solid rgba(148, 163, 184, 0.2)',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
        }}
      >
        <p className="text-xs font-semibold mb-2" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
          {type === 'courses' ? 'Recent Courses' : type === 'assignments' ? 'Recent Assignments' : 'Recent Quizzes'}
        </p>
        <ul className="space-y-1">
          {items.slice(0, 5).map((item, idx) => (
            <li key={idx} className="text-sm truncate" style={{ color: darkMode ? '#e5e7eb' : '#374151' }}>
              • {item.title || item.name || 'Untitled'}
            </li>
          ))}
        </ul>
        <p className="text-xs mt-2" style={{ color: darkMode ? '#60a5fa' : '#3b82f6' }}>
          Click to view all →
        </p>
      </div>
    );
  };

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{
        backgroundColor: darkMode ? '#1a202c' : '#f8fafc',
        color: darkMode ? '#ffffff' : '#1e293b'
      }}
    >
      {/* Navigation */}
      <Navbar />

      {/* Sidebar */}
      <Sidebar role="teacher" />

      {/* Main Content */}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 mt-16 sm:pl-24 md:pl-28">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h1
                className="text-2xl font-bold"
                style={{ color: darkMode ? '#ffffff' : '#1f2937' }}
              >
                Teacher Dashboard
              </h1>
              <button
                className="px-4 py-2 rounded-lg text-white flex items-center"
                style={{ backgroundColor: darkMode ? '#4c1d95' : '#4f46e5' }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = darkMode ? '#5b21b6' : '#4338ca'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = darkMode ? '#4c1d95' : '#4f46e5'}
                onClick={() => window.location.href = '/courses/create'} // Assuming create course route
              >
                <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                Create New Course
              </button>
            </div>

            <div className="mb-8">
              <h2
                className="text-xl font-semibold mb-4"
                style={{ color: darkMode ? '#ffffff' : '#1f2937' }}
              >
                <span className="inline-flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="7" r="4" />
                    <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                  </svg>
                  Welcome back, {user?.fullname || user?.username || 'Teacher'}!
                </span>
              </h2>
              <p
                style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
              >
                Manage your courses, assignments, and track student progress.
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {loading ? (
                [1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="p-6 rounded-2xl shadow-lg"
                    style={{
                      backgroundColor: darkMode ? 'rgba(26, 32, 44, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                      border: darkMode ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid rgba(148, 163, 184, 0.1)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <Skeleton className="h-12 w-12 rounded-xl" />
                    </div>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))
              ) : (
                <>
                  {/* Teaching Courses - Clickable */}
                  <div
                    className="relative p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                    style={{
                      backgroundColor: darkMode ? 'rgba(26, 32, 44, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                      border: darkMode ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid rgba(148, 163, 184, 0.1)',
                      backdropFilter: 'blur(10px)'
                    }}
                    onClick={() => navigate('/my-courses')}
                    onMouseEnter={() => handleMouseEnter('courses')}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className="p-3 rounded-xl"
                        style={{ backgroundColor: darkMode ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.1)' }}
                      >
                        <svg className="w-6 h-6" style={{ color: darkMode ? '#a5b4fc' : '#6366f1' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                        </svg>
                      </div>
                      <div
                        className="text-xs px-2 py-1 rounded-full"
                        style={{
                          backgroundColor: darkMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          color: darkMode ? '#10b981' : '#059669'
                        }}
                      >
                        Click to view
                      </div>
                    </div>
                    <p
                      className="text-sm font-medium mb-1"
                      style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                    >
                      Teaching Courses
                    </p>
                    <p
                      className="text-3xl font-bold"
                      style={{ color: darkMode ? '#ffffff' : '#1e293b' }}
                    >
                      {stats.teachingCourses}
                    </p>
                    {hoveredCard === 'courses' && courses.length > 0 && (
                      <HoverPreview items={courses} type="courses" visible={isHoverVisible} />
                    )}
                  </div>

                  {/* Total Students (Estimated) */}
                  <div
                    className="p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                    style={{
                      backgroundColor: darkMode ? 'rgba(26, 32, 44, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                      border: darkMode ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid rgba(148, 163, 184, 0.1)',
                      backdropFilter: 'blur(10px)'
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className="p-3 rounded-xl"
                        style={{ backgroundColor: darkMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.1)' }}
                      >
                        <svg className="w-6 h-6" style={{ color: darkMode ? '#86efac' : '#16a34a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                        </svg>
                      </div>
                    </div>
                    <p
                      className="text-sm font-medium mb-1"
                      style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                    >
                      Total Students (Est.)
                    </p>
                    <p
                      className="text-3xl font-bold"
                      style={{ color: darkMode ? '#ffffff' : '#1e293b' }}
                    >
                      {stats.totalStudents}
                    </p>
                  </div>

                  {/* Pending Grading - Clickable */}
                  <div
                    className="relative p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                    style={{
                      backgroundColor: darkMode ? 'rgba(26, 32, 44, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                      border: stats.pendingGrading > 0
                        ? (darkMode ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)')
                        : (darkMode ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid rgba(148, 163, 184, 0.1)'),
                      backdropFilter: 'blur(10px)'
                    }}
                    onClick={() => navigate('/assignments')}
                    onMouseEnter={() => handleMouseEnter('assignments')}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className="p-3 rounded-xl"
                        style={{ backgroundColor: darkMode ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.1)' }}
                      >
                        <svg className="w-6 h-6" style={{ color: darkMode ? '#fcd34d' : '#d97706' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
                        </svg>
                      </div>
                    </div>
                    <p
                      className="text-sm font-medium mb-1"
                      style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                    >
                      Pending Grading
                    </p>
                    <p
                      className="text-3xl font-bold"
                      style={{ color: darkMode ? '#ffffff' : '#1e293b' }}
                    >
                      {stats.pendingGrading}
                    </p>
                    {hoveredCard === 'assignments' && assignments.length > 0 && (
                      <HoverPreview items={assignments} type="assignments" visible={isHoverVisible} />
                    )}
                  </div>

                  {/* Published Content - Clickable */}
                  <div
                    className="relative p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                    style={{
                      backgroundColor: darkMode ? 'rgba(26, 32, 44, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                      border: darkMode ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid rgba(148, 163, 184, 0.1)',
                      backdropFilter: 'blur(10px)'
                    }}
                    onClick={() => navigate('/quizzes')}
                    onMouseEnter={() => handleMouseEnter('quizzes')}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className="p-3 rounded-xl"
                        style={{ backgroundColor: darkMode ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.1)' }}
                      >
                        <svg className="w-6 h-6" style={{ color: darkMode ? '#c4b5fd' : '#8b5cf6' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                        </svg>
                      </div>
                      <div
                        className="text-xs px-2 py-1 rounded-full"
                        style={{
                          backgroundColor: darkMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          color: darkMode ? '#10b981' : '#059669'
                        }}
                      >
                        Click to view
                      </div>
                    </div>
                    <p
                      className="text-sm font-medium mb-1"
                      style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                    >
                      Published Content
                    </p>
                    <p
                      className="text-3xl font-bold"
                      style={{ color: darkMode ? '#ffffff' : '#1e293b' }}
                    >
                      {stats.publishedContent}
                    </p>
                    {hoveredCard === 'quizzes' && quizzes.length > 0 && (
                      <HoverPreview items={quizzes} type="quizzes" visible={isHoverVisible} />
                    )}
                  </div>
                </>
              )}
            </div>

            {/* My Teaching Courses Carousel */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2
                  className="text-xl font-semibold"
                  style={{ color: darkMode ? '#ffffff' : '#1e293b' }}
                >
                  My Teaching Courses
                  <span
                    className="ml-2 text-sm font-normal"
                    style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                  >
                    ({totalCourses} total)
                  </span>
                </h2>
                <a
                  href="/my-courses"
                  className="text-sm font-medium hover:underline"
                  style={{ color: darkMode ? '#a5b4fc' : '#6366f1' }}
                >
                  Manage All →
                </a>
              </div>

              {/* Carousel Container */}
              <div className="relative">
                {/* Previous Button - hidden on mobile */}
                {courseCarouselIndex > 0 && (
                  <button
                    onClick={handlePrevCourse}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 p-2 rounded-full shadow-lg transition-all hover:scale-110 hidden sm:block"
                    style={{
                      backgroundColor: darkMode ? '#4f46e5' : '#6366f1',
                      color: '#ffffff'
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}

                {/* Next Button - hidden on mobile */}
                {(courseCarouselIndex < courses.length - VISIBLE_COURSES || hasMoreCourses) && (
                  <button
                    onClick={handleNextCourse}
                    disabled={coursesLoading}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 p-2 rounded-full shadow-lg transition-all hover:scale-110 disabled:opacity-50 hidden sm:block"
                    style={{
                      backgroundColor: darkMode ? '#4f46e5' : '#6366f1',
                      color: '#ffffff'
                    }}
                  >
                    {coursesLoading ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                )}

                {/* Courses Carousel - scrollable on mobile, transform-based on desktop */}
                <div className="overflow-x-auto sm:overflow-hidden px-2 pb-2 -mx-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <div 
                    className="flex gap-4 sm:gap-6"
                    style={{ 
                      transform: `translateX(-${courseCarouselIndex * (100 / VISIBLE_COURSES + 2)}%)`,
                      transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    {loading ? (
                      [1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="flex-shrink-0 rounded-2xl shadow-lg overflow-hidden"
                          style={{
                            width: 'calc(85vw - 32px)',
                            minWidth: '260px',
                            maxWidth: '320px',
                            backgroundColor: darkMode ? 'rgba(26, 32, 44, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                            border: darkMode ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid rgba(148, 163, 184, 0.1)',
                          }}
                        >
                          <Skeleton className="h-32 w-full" />
                          <div className="p-6">
                            <Skeleton className="h-6 w-3/4 mb-2" />
                            <Skeleton className="h-4 w-1/2 mb-4" />
                            <div className="flex items-center justify-between mb-4">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-4 w-24" />
                            </div>
                            <Skeleton className="h-10 w-full rounded-lg" />
                          </div>
                        </div>
                      ))
                    ) : courses.length === 0 ? (
                      <div className="w-full text-center py-12">
                        <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                          You haven't created any courses yet.
                        </p>
                      </div>
                    ) : (
                      courses.map((course) => (
                        <div
                          key={course._id}
                          className="flex-shrink-0 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden cursor-pointer"
                          style={{
                            width: 'calc(85vw - 32px)',
                            minWidth: '260px',
                            maxWidth: '320px',
                            backgroundColor: darkMode ? 'rgba(26, 32, 44, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                            border: darkMode ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid rgba(148, 163, 184, 0.1)',
                            backdropFilter: 'blur(10px)'
                          }}
                          onClick={() => navigate(`/courses/${course._id}`)}
                        >
                          {course.logo ? (
                            <img
                              className="h-32 w-full object-cover"
                              src={course.logo}
                              alt={course.title}
                            />
                          ) : (
                            <div
                              className="h-32 flex items-center justify-center text-4xl font-bold text-white"
                              style={{ backgroundColor: darkMode ? '#4c1d95' : '#4f46e5' }}
                            >
                              {course.title.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="p-4">
                            <h3
                              className="text-base font-semibold mb-1 line-clamp-2"
                              style={{ color: darkMode ? '#ffffff' : '#1e293b' }}
                              title={course.title}
                            >
                              {course.title}
                            </h3>
                            <p
                              className="text-xs mb-2"
                              style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                            >
                              {course.code || course.subjectId?.code || 'No Code'}
                            </p>
                            <div className="flex items-center justify-between text-xs mb-3">
                              <span style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                👥 {course.studentCount || 'N/A'}
                              </span>
                              <span style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                📅 {course.semesterId?.name || 'Ongoing'}
                              </span>
                            </div>
                            <button
                              className="w-full px-3 py-2 rounded-lg text-white text-sm font-medium"
                              style={{ backgroundColor: darkMode ? '#4f46e5' : '#6366f1' }}
                              onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = darkMode ? '#4338ca' : '#4f46e5'}
                              onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = darkMode ? '#4f46e5' : '#6366f1'}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/courses/${course._id}`);
                              }}
                            >
                              Manage
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Carousel Indicators - hidden on mobile */}
                {courses.length > VISIBLE_COURSES && (
                  <div className="hidden sm:flex justify-center gap-2 mt-4">
                    {Array.from({ length: Math.ceil(totalCourses / VISIBLE_COURSES) }).map((_, idx) => (
                      <button
                        key={idx}
                        className="w-2 h-2 rounded-full transition-all"
                        style={{
                          backgroundColor: Math.floor(courseCarouselIndex / VISIBLE_COURSES) === idx
                            ? (darkMode ? '#6366f1' : '#4f46e5')
                            : (darkMode ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.5)')
                        }}
                        onClick={() => setCourseCarouselIndex(idx * VISIBLE_COURSES)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Assignments and Quizzes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Recent Assignments */}
              <div
                className="rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
                style={{
                  backgroundColor: darkMode ? 'rgba(26, 32, 44, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                  border: darkMode ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid rgba(148, 163, 184, 0.1)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <div
                  className="px-6 py-4 border-b flex justify-between items-center"
                  style={{
                    backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.3)' : 'rgba(249, 250, 251, 0.5)',
                    borderColor: darkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(229, 231, 235, 0.5)'
                  }}
                >
                  <h2
                    className="text-lg font-semibold"
                    style={{ color: darkMode ? '#ffffff' : '#1e293b' }}
                  >
                    Assignments
                  </h2>
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: darkMode ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.1)' }}
                  >
                    <svg className="w-5 h-5" style={{ color: darkMode ? '#fcd34d' : '#d97706' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                    </svg>
                  </div>
                </div>
                <div className="p-6">
                  {loading ? (
                    [1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="mb-4 pb-4 border-b last:border-b-0"
                        style={{
                          borderColor: darkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(229, 231, 235, 0.5)'
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <Skeleton className="h-5 w-3/4 mb-2" />
                            <Skeleton className="h-4 w-1/2 mb-2" />
                          </div>
                        </div>
                        <div className="flex items-center space-x-4 mb-2">
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                        <Skeleton className="h-2 w-full rounded-full" />
                      </div>
                    ))
                  ) : assignments.length === 0 ? (
                    <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                      No assignments found.
                    </p>
                  ) : (
                    assignments.slice(0, 5).map((assignment) => (
                      <div
                        key={assignment._id}
                        className="mb-4 pb-4 border-b last:border-b-0"
                        style={{
                          borderColor: darkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(229, 231, 235, 0.5)'
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3
                              className="font-semibold mb-1"
                              style={{ color: darkMode ? '#ffffff' : '#1e293b' }}
                            >
                              {assignment.title}
                            </h3>
                            <p
                              className="text-sm mb-2"
                              style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                            >
                              {assignment.courseId?.title || 'Unknown Course'}
                            </p>
                          </div>
                          <button
                            className="text-xs font-medium hover:underline"
                            style={{ color: darkMode ? '#a5b4fc' : '#6366f1' }}
                            onClick={() => window.location.href = `/assignments/${assignment._id}`}
                          >
                            View
                          </button>
                        </div>
                        <div className="flex items-center space-x-4 text-xs mb-2">
                          <span
                            style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                          >
                            📅 Due: {new Date(assignment.dueDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quizzes */}
              <div
                className="rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
                style={{
                  backgroundColor: darkMode ? 'rgba(26, 32, 44, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                  border: darkMode ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid rgba(148, 163, 184, 0.1)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <div
                  className="px-6 py-4 border-b flex justify-between items-center"
                  style={{
                    backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.3)' : 'rgba(249, 250, 251, 0.5)',
                    borderColor: darkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(229, 231, 235, 0.5)'
                  }}
                >
                  <h2
                    className="text-lg font-semibold"
                    style={{ color: darkMode ? '#ffffff' : '#1e293b' }}
                  >
                    Quizzes
                  </h2>
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.1)' }}
                  >
                    <svg className="w-5 h-5" style={{ color: darkMode ? '#86efac' : '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </div>
                </div>
                <div className="p-6">
                  {loading ? (
                    [1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="mb-4 pb-4 border-b last:border-b-0"
                        style={{
                          borderColor: darkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(229, 231, 235, 0.5)'
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Skeleton className="h-5 w-3/4" />
                              <Skeleton className="h-4 w-16 rounded-full" />
                            </div>
                            <Skeleton className="h-4 w-1/2 mb-2" />
                            <div className="flex items-center space-x-4">
                              <Skeleton className="h-3 w-20" />
                              <Skeleton className="h-3 w-20" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : quizzes.length === 0 ? (
                    <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                      No quizzes found.
                    </p>
                  ) : (
                    quizzes.slice(0, 5).map((quiz) => {
                      const courseTitle = typeof quiz.courseId === 'object' ? quiz.courseId.title : 'Unknown Course';
                      return (
                        <div
                          key={quiz._id}
                          className="mb-4 pb-4 border-b last:border-b-0"
                          style={{
                            borderColor: darkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(229, 231, 235, 0.5)'
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3
                                  className="font-semibold"
                                  style={{ color: darkMode ? '#ffffff' : '#1e293b' }}
                                >
                                  {quiz.title}
                                </h3>
                                {quiz.isPublished ? (
                                  <span
                                    className="text-xs px-2 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                      color: darkMode ? '#86efac' : '#16a34a'
                                    }}
                                  >
                                    Published
                                  </span>
                                ) : (
                                  <span
                                    className="text-xs px-2 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                      color: darkMode ? '#fcd34d' : '#d97706'
                                    }}
                                  >
                                    Draft
                                  </span>
                                )}
                              </div>
                              <p
                                className="text-sm mb-2"
                                style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                              >
                                {courseTitle}
                              </p>
                              <div className="flex items-center space-x-4 text-xs">
                                <span
                                  style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                                >
                                  📝 {quiz.snapshotQuestions?.length || 0} questions
                                </span>
                                <span
                                  style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                                >
                                  📅 {new Date(quiz.startTime).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Announcements Section */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2
                  className="text-xl font-semibold"
                  style={{ color: darkMode ? '#ffffff' : '#1e293b' }}
                >
                  Recent Announcements
                </h2>
                <button
                  className="text-sm font-medium hover:underline"
                  style={{ color: darkMode ? '#a5b4fc' : '#6366f1' }}
                  onClick={() => window.location.href = '/announcements/create'}
                >
                  + New Announcement
                </button>
              </div>
              <div
                className="rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
                style={{
                  backgroundColor: darkMode ? 'rgba(26, 32, 44, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                  border: darkMode ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid rgba(148, 163, 184, 0.1)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <div className="p-6">
                  {loading ? (
                    [1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="mb-4 pb-4 border-b last:border-b-0"
                        style={{ borderColor: darkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(229, 231, 235, 0.5)' }}
                      >
                        <Skeleton className="h-5 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    ))
                  ) : announcements.length === 0 ? (
                    <div className="text-center py-8">
                      <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                        No announcements yet.
                      </p>
                      <button
                        className="mt-4 px-4 py-2 rounded-lg text-white text-sm font-medium"
                        style={{ backgroundColor: darkMode ? '#4f46e5' : '#6366f1' }}
                        onClick={() => window.location.href = '/announcements/create'}
                      >
                        Create First Announcement
                      </button>
                    </div>
                  ) : (
                    announcements.map((announcement) => (
                      <div
                        key={announcement._id}
                        className="mb-4 pb-4 border-b last:border-b-0"
                        style={{ borderColor: darkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(229, 231, 235, 0.5)' }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3
                                className="font-semibold"
                                style={{ color: darkMode ? '#ffffff' : '#1e293b' }}
                              >
                                {announcement.title}
                              </h3>
                              {announcement.isPinned && (
                                <span className="text-xs">📌</span>
                              )}
                              <span
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: announcement.priority === 'urgent'
                                    ? 'rgba(239, 68, 68, 0.1)'
                                    : announcement.priority === 'high'
                                    ? 'rgba(245, 158, 11, 0.1)'
                                    : 'rgba(107, 114, 128, 0.1)',
                                  color: announcement.priority === 'urgent'
                                    ? (darkMode ? '#fca5a5' : '#dc2626')
                                    : announcement.priority === 'high'
                                    ? (darkMode ? '#fcd34d' : '#d97706')
                                    : (darkMode ? '#9ca3af' : '#6b7280')
                                }}
                              >
                                {announcement.priority}
                              </span>
                            </div>
                            <p
                              className="text-sm mb-2 line-clamp-2"
                              style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                            >
                              {announcement.content}
                            </p>
                            <div className="flex items-center space-x-4 text-xs">
                              <span style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                {announcement.type === 'system' ? '🌐 System' : '📚 Course'}
                              </span>
                              <span style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                📅 {new Date(announcement.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Dark Mode Toggle */}
      <button
        onClick={toggleDarkMode}
        className={`fixed bottom-4 right-4 z-[100] w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-300 shadow-lg hover:scale-110 ${darkMode
          ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-300'
          : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {darkMode ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </button>
    </div>
  );
}
