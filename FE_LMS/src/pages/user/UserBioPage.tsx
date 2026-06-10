import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import { userService, type UserDetail } from "../../services/userService";
import { enrollmentService, type ApiEnrollmentRecord } from "../../services/enrollmentService";
import { courseService } from "../../services/courseService";
import { specialistService } from "../../services/specialistService";
import { majorService } from "../../services/majorService";
import { feedbackService } from "../../services/feedbackService";
import type { Feedback } from "../../types/feedback";
import { attendanceService, type AttendanceRecord } from "../../services/attendanceService";
import { sessionService, type Session } from "../../services/sessionService";
import Navbar from "../../components/layout/Navbar.tsx";
import Sidebar from "../../components/layout/Sidebar.tsx";
import UserBio from "../../components/user/UserBio.tsx";
import MarkdownImage from "../../components/markdown/MarkdownImage.tsx";
import { Skeleton } from "../../components/common/Skeleton.tsx";
import ReactMarkdown from "react-markdown";
import {
  BookOpen,
  GraduationCap,
  MessageSquare,
  Calendar,
  Award,
  Star,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  User,
  Mail,
  TrendingUp,
  X,
  Save,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  LogOut,
  Search,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { authService } from "../../services";

const UserBioPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserDetail | null>(
    (location.state as any)?.userData || null
  );
  const [loading, setLoading] = useState(!userData);
  const [error, setError] = useState("");
  const [contentPaddingLeft, setContentPaddingLeft] = useState(window.innerWidth >= 640 ? 93 : 0);

  // Activity states
  const [enrollments, setEnrollments] = useState<ApiEnrollmentRecord[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [specialists, setSpecialists] = useState<any[]>([]);
  const [feedbacksWritten, setFeedbacksWritten] = useState<Feedback[]>([]);
  const [feedbacksReceived, setFeedbacksReceived] = useState<Feedback[]>([]);
  const [averageRating, setAverageRating] = useState<number | undefined>();
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Session states
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [sessionSearchQuery, setSessionSearchQuery] = useState("");

  // Edit states
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isEditFullnameModalOpen, setIsEditFullnameModalOpen] = useState(false);
  const [isEditSpecialistsModalOpen, setIsEditSpecialistsModalOpen] = useState(false);
  const [editFullname, setEditFullname] = useState("");
  const [editSpecialistIds, setEditSpecialistIds] = useState<string[]>([]);
  const [editMajors, setEditMajors] = useState<any[]>([]);
  const [editSpecialists, setEditSpecialists] = useState<any[]>([]);
  const [selectedEditMajorId, setSelectedEditMajorId] = useState<string>("");
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string>("");

  // Helper function to group courses/enrollments by semester
  const groupBySemester = (items: any[]): Array<{ semester: any; items: any[] }> => {
    const grouped: { [key: string]: { semester: any; items: any[] } } = {};
    items.forEach((item) => {
      const course = item.courseId || item;
      const semester = course.semesterId;
      if (semester) {
        const semesterKey = semester._id || semester;
        const semesterName = typeof semester === 'object' ? semester.name : 'Unknown Semester';
        if (!grouped[semesterKey]) {
          grouped[semesterKey] = {
            semester: typeof semester === 'object' ? semester : { name: semesterName },
            items: [],
          };
        }
        grouped[semesterKey].items.push(item);
      } else {
        // Items without semester
        if (!grouped['no-semester']) {
          grouped['no-semester'] = {
            semester: { name: 'No Semester' },
            items: [],
          };
        }
        grouped['no-semester'].items.push(item);
      }
    });
    return Object.values(grouped);
  };

  useEffect(() => {
    function handleResize() {
      setContentPaddingLeft(window.innerWidth >= 640 ? 93 : 0);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch current user for permission check
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const current = await authService.getCurrentUser();
        setCurrentUser(current);
      } catch (err) {
        console.error("Failed to fetch current user:", err);
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    // If user data was passed via navigation state, use it and skip API call
    const passedUserData = (location.state as any)?.userData;
    if (passedUserData) {
      setUserData(passedUserData);
      setLoading(false);
      return;
    }

    // Only make API call if no user data was passed
    const fetchUser = async () => {
      if (!userId) {
        setError("User ID is required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const data = await userService.getUserById(userId);
        setUserData(data);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch user";
        setError(errorMessage);
        setUserData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId, location.state]);

  // Fetch activities based on user role
  useEffect(() => {
    if (!userData || !userData._id) return;

    const fetchActivities = async () => {
      setLoadingActivities(true);
      try {
        const promises: Promise<any>[] = [];

        // Fetch feedbacks written by user (for all users)
        promises.push(
          feedbackService.getFeedbacks({ userId: userData._id, page: 1, limit: 10 }).catch(() => ({ feedbacks: [] }))
        );

        // Fetch feedbacks received about user (for all users)
        promises.push(
          feedbackService.getFeedbacks({ targetId: userData._id, page: 1, limit: 10 }).catch(() => ({ feedbacks: [], averageRating: undefined }))
        );

        // Fetch enrollments if student
        if (userData.role === 'student') {
          promises.push(
            enrollmentService.getByStudent(userData._id, { page: 1, limit: 10 }).catch(() => ({ items: [] }))
          );
          promises.push(
            attendanceService.getStudentAttendance(userData._id, { page: 1, limit: 10 }).catch(() => ({ data: [] }))
          );
        }

        // Fetch courses if teacher
        if (userData.role === 'teacher') {
          promises.push(
            courseService.getAllCourses({ teacherId: userData._id, page: 1, limit: 10 }).catch(() => ({ courses: [] }))
          );
        }

        const results = await Promise.all(promises);

        let resultIndex = 0;

        // Feedbacks written by user (always first)
        const feedbacksWrittenResult = results[resultIndex++];
        if (feedbacksWrittenResult?.feedbacks) {
          setFeedbacksWritten(feedbacksWrittenResult.feedbacks);
        }

        // Feedbacks received about user (always second)
        const feedbacksReceivedResult = results[resultIndex++];
        if (feedbacksReceivedResult?.feedbacks) {
          setFeedbacksReceived(feedbacksReceivedResult.feedbacks);
          if (feedbacksReceivedResult.averageRating !== undefined) {
            setAverageRating(feedbacksReceivedResult.averageRating);
          }
        }

        if (userData.role === 'student') {
          // Enrollments - fetch full course details if needed
          const enrollmentResult = results[resultIndex++];
          if (enrollmentResult?.items) {
            const enrichedEnrollments = await Promise.all(
              enrollmentResult.items.map(async (enrollment: ApiEnrollmentRecord) => {
                // Check if courseId has full info (like semesterId)
                const courseId = enrollment.courseId as any;
                if (!courseId.semesterId && courseId._id) {
                  try {
                    const fullCourse = await courseService.getCourseById(courseId._id);
                    return {
                      ...enrollment,
                      courseId: {
                        ...courseId,
                        ...fullCourse,
                      },
                    };
                  } catch {
                    return enrollment;
                  }
                }
                return enrollment;
              })
            );
            setEnrollments(enrichedEnrollments);
          }
          // Attendances
          const attendanceResult = results[resultIndex++];
          if (attendanceResult?.data) {
            setAttendances(attendanceResult.data);
          }
        } else if (userData.role === 'teacher') {
          // Courses
          const courseResult = results[resultIndex++];
          if (courseResult?.courses) {
            setCourses(courseResult.courses);
          }
        }

        // Fetch specialist details and majors for all users with specialistIds
        if (userData.specialistIds && userData.specialistIds.length > 0) {
          try {
            const specialistPromises = userData.specialistIds.map((spec: any) => {
              const specId = typeof spec === 'string' ? spec : spec._id;
              return specialistService.getSpecialistById(specId).then(async (specialist) => {
                if (specialist.majorId) {
                  try {
                    const majorId = typeof specialist.majorId === 'string' ? specialist.majorId : specialist.majorId._id;
                    const major = await majorService.getMajorById(majorId);
                    return { ...specialist, major };
                  } catch {
                    return specialist;
                  }
                }
                return specialist;
              });
            });
            const specialistResults = await Promise.all(specialistPromises);
            setSpecialists(specialistResults);
          } catch (err) {
            console.error('Failed to fetch specialists:', err);
          }
        }
      } catch (err) {
        console.error('Failed to fetch activities:', err);
      } finally {
        setLoadingActivities(false);
      }
    };

    fetchActivities();
  }, [userData]);

  // Load majors when edit specialists modal opens
  useEffect(() => {
    if (!isEditSpecialistsModalOpen) return;

    const loadMajors = async () => {
      try {
        setLoadingEditData(true);
        const { majors } = await majorService.getAllMajors({
          limit: 100,
          sortBy: "title",
          sortOrder: "asc",
        } as any);
        setEditMajors(majors);

        // If user has existing specialists, find their major
        if (userData?.specialistIds && userData.specialistIds.length > 0) {
          const firstSpecialist = userData.specialistIds[0];
          if (firstSpecialist?.majorId) {
            const majorId = typeof firstSpecialist.majorId === 'string'
              ? firstSpecialist.majorId
              : firstSpecialist.majorId._id;
            setSelectedEditMajorId(majorId);
          }
        }
      } catch (err) {
        console.error("Failed to load majors:", err);
      } finally {
        setLoadingEditData(false);
      }
    };

    loadMajors();
  }, [isEditSpecialistsModalOpen, userData]);

  // Load specialists when major is selected in edit modal
  useEffect(() => {
    if (!isEditSpecialistsModalOpen || !selectedEditMajorId) {
      setEditSpecialists([]);
      return;
    }

    const loadSpecialists = async () => {
      try {
        setLoadingEditData(true);
        const { specialists } = await specialistService.getAllSpecialists({
          majorId: selectedEditMajorId,
          limit: 100,
          sortBy: "title",
          sortOrder: "asc",
        } as any);
        setEditSpecialists(specialists);
      } catch (err) {
        console.error("Failed to load specialists:", err);
      } finally {
        setLoadingEditData(false);
      }
    };

    loadSpecialists();
  }, [isEditSpecialistsModalOpen, selectedEditMajorId]);

  // Initialize edit form when modals open
  useEffect(() => {
    if (isEditFullnameModalOpen && userData) {
      setEditFullname(userData.fullname || "");
      setEditError("");
    }
  }, [isEditFullnameModalOpen, userData]);

  useEffect(() => {
    if (isEditSpecialistsModalOpen && userData) {
      setEditSpecialistIds(
        userData.specialistIds
          ? (userData.specialistIds as any[]).map((s: any) =>
            typeof s === 'string' ? s : s._id
          )
          : []
      );
      setEditError("");
    }
  }, [isEditSpecialistsModalOpen, userData]);

  // Check if user can edit
  const canEdit = currentUser && userData && (
    currentUser.role === 'admin' ||
    currentUser._id === userData._id
  );

  // Check if specialist editing is allowed
  const canEditSpecialists = canEdit && (
    userData.role === 'student' ||
    (userData.role === 'teacher' && currentUser.role === 'admin')
  );

  // Handle fullname update
  const handleUpdateFullname = async () => {
    if (!userData?._id) return;

    try {
      setSavingEdit(true);
      setEditError("");
      const updated = await userService.updateUser(userData._id, {
        fullname: editFullname,
      });
      setUserData(updated);
      setIsEditFullnameModalOpen(false);
    } catch (err: any) {
      setEditError(err?.message || "Failed to update fullname");
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle specialists update
  const handleUpdateSpecialists = async () => {
    if (!userData?._id) return;

    try {
      setSavingEdit(true);
      setEditError("");
      const updated = await userService.updateUser(userData._id, {
        specialistIds: editSpecialistIds,
      });
      setUserData(updated);
      setIsEditSpecialistsModalOpen(false);
    } catch (err: any) {
      setEditError(err?.message || "Failed to update specialists");
    } finally {
      setSavingEdit(false);
    }
  };

  // Fetch sessions - only if viewing own profile
  useEffect(() => {
    // Only fetch sessions if user is viewing their own profile
    if (!currentUser || !userData || currentUser._id !== userData._id) {
      return;
    }

    const fetchSessions = async () => {
      try {
        setLoadingSessions(true);
        const sessionsData = await sessionService.getAllSessions();
        setSessions(sessionsData);
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
      } finally {
        setLoadingSessions(false);
      }
    };

    fetchSessions();
  }, [currentUser, userData]);

  // Parse user agent to get device info
  const parseUserAgent = (userAgent?: string) => {
    if (!userAgent) {
      return {
        deviceType: 'Unknown',
        deviceIcon: Monitor,
        browser: 'Unknown',
        os: 'Unknown',
      };
    }

    let deviceType = 'Desktop';
    let deviceIcon = Monitor;
    let browser = 'Unknown';
    let os = 'Unknown';

    // Detect device type
    if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
      if (/iPad/i.test(userAgent)) {
        deviceType = 'Tablet';
        deviceIcon = Tablet;
      } else {
        deviceType = 'Mobile';
        deviceIcon = Smartphone;
      }
    } else if (/Tablet/i.test(userAgent)) {
      deviceType = 'Tablet';
      deviceIcon = Tablet;
    } else if (/Laptop/i.test(userAgent)) {
      deviceType = 'Laptop';
      deviceIcon = Laptop;
    } else {
      deviceType = 'Desktop';
      deviceIcon = Monitor;
    }

    // Detect browser
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browser = 'Chrome';
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browser = 'Safari';
    } else if (userAgent.includes('Edg')) {
      browser = 'Edge';
    } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
      browser = 'Opera';
    } else if (userAgent.includes('insomnia')) {
      browser = 'Insomnia';
    }

    // Detect OS
    if (userAgent.includes('Windows')) {
      os = 'Windows';
    } else if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) {
      os = 'macOS';
    } else if (userAgent.includes('Linux')) {
      os = 'Linux';
    } else if (userAgent.includes('Android')) {
      os = 'Android';
    } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      os = 'iOS';
    }

    return { deviceType, deviceIcon, browser, os };
  };

  // Handle session deletion
  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to force logout this device? This will end the session immediately.')) {
      return;
    }

    try {
      setDeletingSessionId(sessionId);
      await sessionService.deleteSession(sessionId);
      // Remove session from list
      setSessions(sessions.filter(s => s._id !== sessionId));
    } catch (err: any) {
      console.error('Failed to delete session:', err);
      alert(err?.message || 'Failed to delete session');
    } finally {
      setDeletingSessionId(null);
    }
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
      <Sidebar role={(user?.role as 'admin' | 'teacher' | 'student') || 'student'} />

      {/* Main Content */}
      <div
        className="flex flex-col flex-1 w-0 overflow-hidden"
        style={{
          paddingLeft: contentPaddingLeft,
          backgroundColor: darkMode ? '#1f2937' : '#f0f0f0'
        }}
      >
        <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 mt-16">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <button
                  onClick={() => {
                    if (window.history.length > 1) {
                      navigate(-1);
                    } else {
                      // Fallback to dashboard if no history
                      const userRole = user?.role;
                      if (userRole === 'admin') {
                        navigate('/dashboard');
                      } else if (userRole === 'teacher') {
                        navigate('/teacher-dashboard');
                      } else if (userRole === 'student') {
                        navigate('/student-dashboard');
                      } else {
                        navigate('/');
                      }
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 hover:opacity-90 mb-4"
                  style={{
                    backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.8)' : '#ffffff',
                    borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                    color: darkMode ? '#ffffff' : '#1f2937',
                  }}
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>
                <h1
                  className="text-3xl font-bold"
                  style={{ color: darkMode ? '#ffffff' : '#1f2937' }}
                >
                  User Profile
                </h1>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div
                className="mb-6 p-4 rounded-lg border"
                style={{
                  backgroundColor: darkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
                  borderColor: darkMode ? 'rgba(239, 68, 68, 0.5)' : '#fecaca',
                  color: darkMode ? '#fca5a5' : '#dc2626',
                }}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="space-y-6">
                {/* User Bio Skeleton */}
                <div
                  className="rounded-lg border overflow-hidden"
                  style={{
                    backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.8)' : '#ffffff',
                    borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                  }}
                >
                  {/* Header Section */}
                  <div
                    className="p-6 border-b"
                    style={{
                      borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                      background: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#f9fafb',
                    }}
                  >
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                      {/* Avatar Skeleton */}
                      <Skeleton className="h-32 w-32 rounded-full flex-shrink-0" />

                      {/* User Info Skeleton */}
                      <div className="flex-1 w-full">
                        <div className="flex flex-col gap-3 mb-2">
                          <Skeleton className="h-8 w-48" />
                          <Skeleton className="h-5 w-32" />
                        </div>
                        <div className="flex gap-2 mb-3">
                          <Skeleton className="h-6 w-20 rounded-full" />
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Details Section */}
                  <div className="p-6">
                    <Skeleton className="h-6 w-24 mb-4" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i}>
                          <Skeleton className="h-4 w-24 mb-2" />
                          <Skeleton className="h-5 w-48" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Activities Skeleton */}
                <div>
                  <Skeleton className="h-8 w-32 mb-6" />
                  <div
                    className="rounded-lg border p-6"
                    style={{
                      backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.8)' : '#ffffff',
                      borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                    }}
                  >
                    <Skeleton className="h-6 w-32 mb-4" />
                    <div className="space-y-6">
                      {[1, 2].map((i) => (
                        <div key={i}>
                          <Skeleton className="h-6 w-24 mb-3" />
                          <div className="space-y-3">
                            {[1, 2].map((j) => (
                              <div
                                key={j}
                                className="p-4 rounded-lg border"
                                style={{
                                  backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#f9fafb',
                                  borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                                }}
                              >
                                <div className="flex items-start gap-4">
                                  <Skeleton className="h-20 w-20 rounded-lg flex-shrink-0" />
                                  <div className="flex-1">
                                    <Skeleton className="h-6 w-3/4 mb-2" />
                                    <Skeleton className="h-4 w-full mb-2" />
                                    <div className="flex gap-3">
                                      <Skeleton className="h-5 w-20" />
                                      <Skeleton className="h-5 w-32" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* User Bio */}
            {!loading && userData && (
              <>
                <UserBio
                  user={{
                    ...userData,
                    major: specialists.length > 0 && specialists[0]?.major ? specialists[0].major : undefined,
                  }}
                  showFullDetails={true}
                  averageRating={averageRating}
                  canEdit={canEdit}
                  onEditFullname={canEdit ? () => setIsEditFullnameModalOpen(true) : undefined}
                  onEditSpecialists={canEditSpecialists ? () => setIsEditSpecialistsModalOpen(true) : undefined}
                />

                <h1
                  className="text-3xl font-bold pt-6"
                  style={{ color: darkMode ? '#ffffff' : '#1f2937' }}
                >
                  Activities
                </h1>

                {/* Activities Section */}
                <div className="mt-6 space-y-6">
                  {/* Enrollments (for students) */}
                  {userData.role === 'student' && (
                    <div
                      className="rounded-lg border p-6"
                      style={{
                        backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.8)' : '#ffffff',
                        borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                      }}
                    >
                      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                        <BookOpen className="w-5 h-5" />
                        Enrollments
                      </h3>
                      {loadingActivities ? (
                        <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>Loading enrollments...</p>
                      ) : enrollments.length === 0 ? (
                        <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>No enrollments found</p>
                      ) : (
                        <div className="space-y-6">
                          {groupBySemester(enrollments).map((group) => (
                            <div key={group.semester._id || 'no-semester'}>
                              <h4 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                                <Calendar className="w-4 h-4" />
                                {group.semester.name}
                              </h4>
                              <div className="space-y-3">
                                {group.items.map((enrollment) => (
                                  <div
                                    key={enrollment._id}
                                    className="p-4 rounded-lg border"
                                    style={{
                                      backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#f9fafb',
                                      borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                                    }}
                                  >
                                    <div className="flex items-start gap-4">
                                      {/* Course Logo */}
                                      {(enrollment.courseId as any)?.logo ? (
                                        <img
                                          className="h-20 w-20 rounded-lg object-cover flex-shrink-0"
                                          src={(enrollment.courseId as any).logo}
                                          alt={enrollment.courseId.title}
                                        />
                                      ) : (
                                        <div
                                          className="h-20 w-20 rounded-lg flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
                                          style={{
                                            backgroundColor: darkMode ? '#4c1d95' : '#4f46e5',
                                          }}
                                        >
                                          {enrollment.courseId.title.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <div className="flex-1">
                                        <Link
                                          to={`/courses/${enrollment.courseId._id}`}
                                          className="text-lg font-semibold hover:underline"
                                          style={{ color: darkMode ? '#60a5fa' : '#2563eb' }}
                                        >
                                          {enrollment.courseId.title}
                                        </Link>
                                        {enrollment.courseId.description && (
                                          <p className="text-sm mt-1" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                            {enrollment.courseId.description}
                                          </p>
                                        )}
                                        <div className="flex items-center gap-3 mt-2">
                                          <span
                                            className="px-2 py-1 text-xs font-semibold rounded flex items-center gap-1"
                                            style={{
                                              backgroundColor: enrollment.status === 'approved'
                                                ? (darkMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)')
                                                : (darkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)'),
                                              color: enrollment.status === 'approved' ? (darkMode ? '#86efac' : '#16a34a') : (darkMode ? '#fca5a5' : '#dc2626'),
                                            }}
                                          >
                                            {enrollment.status === 'approved' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                            {enrollment.status}
                                          </span>
                                          {enrollment.progress && (
                                            <span className="text-xs flex items-center gap-1" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                              <TrendingUp className="w-3 h-3" />
                                              Progress: {enrollment.progress.completedLessons}/{enrollment.progress.totalLessons} lessons
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Teaching Courses (for teachers) */}
                  {userData.role === 'teacher' && (
                    <div
                      className="rounded-lg border p-6"
                      style={{
                        backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.8)' : '#ffffff',
                        borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                      }}
                    >
                      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                        <GraduationCap className="w-5 h-5" />
                        Teaching Courses
                      </h3>
                      {loadingActivities ? (
                        <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>Loading courses...</p>
                      ) : courses.length === 0 ? (
                        <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>No courses found</p>
                      ) : (
                        <div className="space-y-6">
                          {groupBySemester(courses.map(c => ({ courseId: c }))).map((group) => (
                            <div key={group.semester._id || 'no-semester'}>
                              <h4 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                                <Calendar className="w-4 h-4" />
                                {group.semester.name}
                              </h4>
                              <div className="space-y-3">
                                {group.items.map((item) => {
                                  const course = item.courseId || item;
                                  return (
                                    <div
                                      key={course._id}
                                      className="p-4 rounded-lg border"
                                      style={{
                                        backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#f9fafb',
                                        borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                                      }}
                                    >
                                      <div className="flex items-start gap-4">
                                        {/* Course Logo */}
                                        {course.logo ? (
                                          <img
                                            className="h-20 w-20 rounded-lg object-cover flex-shrink-0"
                                            src={course.logo}
                                            alt={course.title}
                                          />
                                        ) : (
                                          <div
                                            className="h-20 w-20 rounded-lg flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
                                            style={{
                                              backgroundColor: darkMode ? '#4c1d95' : '#4f46e5',
                                            }}
                                          >
                                            {course.title.charAt(0).toUpperCase()}
                                          </div>
                                        )}
                                        <div className="flex-1">
                                          <Link
                                            to={`/courses/${course._id}`}
                                            className="text-lg font-semibold hover:underline"
                                            style={{ color: darkMode ? '#60a5fa' : '#2563eb' }}
                                          >
                                            {course.title}
                                          </Link>
                                          {course.description && (
                                            <p className="text-sm mt-1" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                              {course.description}
                                            </p>
                                          )}
                                          <div className="flex items-center gap-3 mt-2">
                                            <span
                                              className="px-2 py-1 text-xs font-semibold rounded flex items-center gap-1"
                                              style={{
                                                backgroundColor: course.isPublished
                                                  ? (darkMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)')
                                                  : (darkMode ? 'rgba(107, 114, 128, 0.2)' : 'rgba(107, 114, 128, 0.1)'),
                                                color: course.isPublished ? (darkMode ? '#86efac' : '#16a34a') : (darkMode ? '#9ca3af' : '#6b7280'),
                                              }}
                                            >
                                              {course.isPublished ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                              {course.isPublished ? 'Published' : 'Draft'}
                                            </span>
                                            {course.status && (
                                              <span className="text-xs flex items-center gap-1" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                                <Award className="w-3 h-3" />
                                                Status: {course.status}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Specializations (for teachers) */}
                  {userData.role === 'teacher' && specialists.length > 0 && (
                    <div
                      className="rounded-lg border p-6"
                      style={{
                        backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.8)' : '#ffffff',
                        borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                      }}
                    >
                      <h3 className="text-xl font-semibold mb-4" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                        Specializations
                      </h3>
                      <div className="space-y-3">
                        {specialists.map((specialist) => (
                          <div
                            key={specialist._id}
                            className="p-4 rounded-lg border"
                            style={{
                              backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#f9fafb',
                              borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                            }}
                          >
                            <h4 className="font-semibold" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                              {specialist.name}
                            </h4>
                            {specialist.description && (
                              <p className="text-sm mt-1" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                {specialist.description}
                              </p>
                            )}
                            {specialist.major && (
                              <p className="text-xs mt-2 flex items-center gap-1" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                <GraduationCap className="w-3 h-3" />
                                Major: {specialist.major.name}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Feedbacks Written by User */}
                  <div
                    className="rounded-lg border p-6"
                    style={{
                      backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.8)' : '#ffffff',
                      borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                    }}
                  >
                    <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                      <MessageSquare className="w-5 h-5" />
                      Feedbacks Written
                    </h3>
                    {loadingActivities ? (
                      <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>Loading feedbacks...</p>
                    ) : feedbacksWritten.length === 0 ? (
                      <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>No feedbacks written</p>
                    ) : (
                      <div className="space-y-3">
                        {feedbacksWritten.map((feedback) => (
                          <div
                            key={feedback._id}
                            className="p-4 rounded-lg border"
                            style={{
                              backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#f9fafb',
                              borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                            }}
                          >
                            <div className="flex items-start gap-4">
                              {/* Writer Avatar */}
                              <div className="flex-shrink-0">
                                {userData.avatar_url ? (
                                  <img
                                    className="h-12 w-12 rounded-full object-cover"
                                    src={userData.avatar_url}
                                    alt={userData.fullname || userData.username}
                                  />
                                ) : (
                                  <div
                                    className="h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold"
                                    style={{
                                      backgroundColor: darkMode ? '#4c1d95' : '#4f46e5',
                                    }}
                                  >
                                    {(userData.fullname || userData.username).charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                {/* Writer Info */}
                                <div className="mb-2">
                                  <p className="font-semibold text-sm flex items-center gap-1" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                                    <User className="w-3 h-3" />
                                    {userData.fullname || userData.username}
                                  </p>
                                  <p className="text-xs flex items-center gap-1" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                    <Mail className="w-3 h-3" />
                                    {userData.email}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                                    {feedback.title}
                                  </h4>
                                  <span
                                    className="px-2 py-1 text-xs font-semibold rounded"
                                    style={{
                                      backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                                      color: darkMode ? '#93c5fd' : '#1e40af',
                                    }}
                                  >
                                    {feedback.type}
                                  </span>
                                </div>
                                <div className="prose prose-sm max-w-none mt-2" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                  <ReactMarkdown
                                    components={{
                                      p: ({ children }) => <p className="text-sm mb-2" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>{children}</p>,
                                      strong: ({ children }) => <strong style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>{children}</strong>,
                                      em: ({ children }) => <em>{children}</em>,
                                      code: ({ children }) => <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.5)' : '#f3f4f6' }}>{children}</code>,
                                      img: ({ src, alt, title }) => (
                                        <MarkdownImage
                                          src={src}
                                          alt={alt}
                                          title={title}
                                          darkMode={darkMode}
                                          maxWidth="100%"
                                          maxHeight="400px"
                                        />
                                      ),
                                    }}
                                  >
                                    {feedback.description}
                                  </ReactMarkdown>
                                </div>
                                <div className="flex items-center justify-between mt-3">
                                  {feedback.rating && (
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: 5 }).map((_, i) => (
                                        <Star
                                          key={i}
                                          className="w-4 h-4"
                                          fill={i < feedback.rating! ? '#fbbf24' : 'none'}
                                          style={{ color: i < feedback.rating! ? '#fbbf24' : (darkMode ? '#4b5563' : '#d1d5db') }}
                                        />
                                      ))}
                                    </div>
                                  )}
                                  <span className="text-xs flex items-center gap-1" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                    <Calendar className="w-3 h-3" />
                                    {new Date(feedback.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Feedbacks Received About User */}
                  <div
                    className="rounded-lg border p-6"
                    style={{
                      backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.8)' : '#ffffff',
                      borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-semibold flex items-center gap-2" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                        <MessageSquare className="w-5 h-5" />
                        Feedbacks Received
                      </h3>
                      {averageRating !== undefined && (
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4" style={{ color: '#fbbf24' }} />
                          <span className="text-sm" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                            Average:
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="font-semibold" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                              {averageRating.toFixed(1)}
                            </span>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className="w-4 h-4"
                                fill={i < Math.round(averageRating) ? '#fbbf24' : 'none'}
                                style={{ color: i < Math.round(averageRating) ? '#fbbf24' : (darkMode ? '#4b5563' : '#d1d5db') }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {loadingActivities ? (
                      <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>Loading feedbacks...</p>
                    ) : feedbacksReceived.length === 0 ? (
                      <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>No feedbacks received</p>
                    ) : (
                      <div className="space-y-3">
                        {feedbacksReceived.map((feedback) => (
                          <div
                            key={feedback._id}
                            className="p-4 rounded-lg border"
                            style={{
                              backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#f9fafb',
                              borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                            }}
                          >
                            <div className="flex items-start gap-4">
                              {/* Writer Avatar */}
                              <div className="flex-shrink-0">
                                {(feedback.userId as any)?.avatar_url ? (
                                  <img
                                    className="h-12 w-12 rounded-full object-cover"
                                    src={(feedback.userId as any).avatar_url}
                                    alt={feedback.userId.fullname || feedback.userId.username}
                                  />
                                ) : (
                                  <div
                                    className="h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold"
                                    style={{
                                      backgroundColor: darkMode ? '#4c1d95' : '#4f46e5',
                                    }}
                                  >
                                    {(feedback.userId.fullname || feedback.userId.username).charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                {/* Writer Info */}
                                {feedback.userId && (
                                  <div className="mb-2">
                                    <p className="font-semibold text-sm flex items-center gap-1" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                                      <User className="w-3 h-3" />
                                      {feedback.userId.fullname || feedback.userId.username}
                                    </p>
                                    <p className="text-xs flex items-center gap-1" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                      <Mail className="w-3 h-3" />
                                      {feedback.userId.email}
                                    </p>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                                    {feedback.title}
                                  </h4>
                                  <span
                                    className="px-2 py-1 text-xs font-semibold rounded"
                                    style={{
                                      backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                                      color: darkMode ? '#93c5fd' : '#1e40af',
                                    }}
                                  >
                                    {feedback.type}
                                  </span>
                                </div>
                                <div className="prose prose-sm max-w-none mt-2" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                  <ReactMarkdown
                                    components={{
                                      p: ({ children }) => <p className="text-sm mb-2" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>{children}</p>,
                                      strong: ({ children }) => <strong style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>{children}</strong>,
                                      em: ({ children }) => <em>{children}</em>,
                                      code: ({ children }) => <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.5)' : '#f3f4f6' }}>{children}</code>,
                                      img: ({ src, alt, title }) => (
                                        <MarkdownImage
                                          src={src}
                                          alt={alt}
                                          title={title}
                                          darkMode={darkMode}
                                          maxWidth="100%"
                                          maxHeight="400px"
                                        />
                                      ),
                                    }}
                                  >
                                    {feedback.description}
                                  </ReactMarkdown>
                                </div>
                                <div className="flex items-center justify-between mt-3">
                                  {feedback.rating && (
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: 5 }).map((_, i) => (
                                        <Star
                                          key={i}
                                          className="w-4 h-4"
                                          fill={i < feedback.rating! ? '#fbbf24' : 'none'}
                                          style={{ color: i < feedback.rating! ? '#fbbf24' : (darkMode ? '#4b5563' : '#d1d5db') }}
                                        />
                                      ))}
                                    </div>
                                  )}
                                  <span className="text-xs flex items-center gap-1" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                    <Calendar className="w-3 h-3" />
                                    {new Date(feedback.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Attendance History (for students) */}
                  {userData.role === 'student' && (
                    <div
                      className="rounded-lg border p-6"
                      style={{
                        backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.8)' : '#ffffff',
                        borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                      }}
                    >
                      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                        <Calendar className="w-5 h-5" />
                        Attendance History
                      </h3>
                      {loadingActivities ? (
                        <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>Loading attendance...</p>
                      ) : attendances.length === 0 ? (
                        <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>No attendance records found</p>
                      ) : (
                        <div className="space-y-3">
                          {attendances.map((attendance) => (
                            <div
                              key={attendance._id}
                              className="p-4 rounded-lg border"
                              style={{
                                backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#f9fafb',
                                borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                              }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <Link
                                    to={`/courses/${attendance.courseId._id}`}
                                    className="font-semibold hover:underline"
                                    style={{ color: darkMode ? '#60a5fa' : '#2563eb' }}
                                  >
                                    {attendance.courseId.title}
                                  </Link>
                                  <div className="flex items-center gap-3 mt-2">
                                    <span
                                      className="px-2 py-1 text-xs font-semibold rounded flex items-center gap-1"
                                      style={{
                                        backgroundColor: attendance.status === 'present'
                                          ? (darkMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)')
                                          : attendance.status === 'late'
                                            ? (darkMode ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.1)')
                                            : (darkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)'),
                                        color: attendance.status === 'present'
                                          ? (darkMode ? '#86efac' : '#16a34a')
                                          : attendance.status === 'late'
                                            ? (darkMode ? '#fbbf24' : '#d97706')
                                            : (darkMode ? '#fca5a5' : '#dc2626'),
                                      }}
                                    >
                                      {attendance.status === 'present' ? (
                                        <CheckCircle className="w-3 h-3" />
                                      ) : attendance.status === 'late' ? (
                                        <Clock className="w-3 h-3" />
                                      ) : (
                                        <XCircle className="w-3 h-3" />
                                      )}
                                      {attendance.status}
                                    </span>
                                    <span className="text-xs flex items-center gap-1" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                      <Calendar className="w-3 h-3" />
                                      {new Date(attendance.date).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Device and Session Section - Only show if viewing own profile */}
                {currentUser && userData && currentUser._id === userData._id && (
                  <>
                    <h1
                      className="text-3xl font-bold pt-6"
                      style={{ color: darkMode ? '#ffffff' : '#1f2937' }}
                    >
                      Device and Session
                    </h1>

                    <div className="mt-6">
                      <div
                        className="rounded-lg border p-6"
                        style={{
                          backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.8)' : '#ffffff',
                          borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                        }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-semibold flex items-center gap-2" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                            <Monitor className="w-5 h-5" />
                            Active Sessions
                          </h3>
                        </div>

                        {/* Search Bar */}
                        <div className="mb-4">
                          <div className="relative">
                            <Search
                              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
                              style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                            />
                            <input
                              type="text"
                              placeholder="Search by device, browser, or OS..."
                              value={sessionSearchQuery}
                              onChange={(e) => setSessionSearchQuery(e.target.value)}
                              className="w-full pl-10 pr-4 py-2 rounded-lg border"
                              style={{
                                backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#ffffff',
                                borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                                color: darkMode ? '#ffffff' : '#1f2937',
                              }}
                            />
                          </div>
                        </div>

                        {loadingSessions ? (
                          <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>Loading sessions...</p>
                        ) : (() => {
                          // Filter sessions based on search query
                          const filteredSessions = sessions.filter((session) => {
                            if (!sessionSearchQuery.trim()) return true;
                            const query = sessionSearchQuery.toLowerCase();
                            const deviceInfo = parseUserAgent(session.userAgent);
                            return (
                              deviceInfo.deviceType.toLowerCase().includes(query) ||
                              deviceInfo.browser.toLowerCase().includes(query) ||
                              deviceInfo.os.toLowerCase().includes(query) ||
                              (session.userAgent && session.userAgent.toLowerCase().includes(query))
                            );
                          });

                          // Limit to 5 if not expanded
                          const displayedSessions = showAllSessions
                            ? filteredSessions
                            : filteredSessions.slice(0, 5);
                          const hasMore = filteredSessions.length > 5;

                          return filteredSessions.length === 0 ? (
                            <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>No sessions found</p>
                          ) : (
                            <>
                              <div className="space-y-3">
                                {displayedSessions.map((session) => {
                                  const deviceInfo = parseUserAgent(session.userAgent);
                                  const DeviceIcon = deviceInfo.deviceIcon;
                                  const isCurrent = session.isCurrent;
                                  const sessionDate = new Date(session.createdAt);
                                  const isDeleting = deletingSessionId === session._id;

                                  return (
                                    <div
                                      key={session._id}
                                      className="p-4 rounded-lg border"
                                      style={{
                                        backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#f9fafb',
                                        borderColor: isCurrent
                                          ? (darkMode ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.3)')
                                          : (darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb'),
                                      }}
                                    >
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4 flex-1">
                                          <div
                                            className="p-3 rounded-lg flex-shrink-0"
                                            style={{
                                              backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                                            }}
                                          >
                                            <DeviceIcon
                                              className="w-6 h-6"
                                              style={{ color: darkMode ? '#93c5fd' : '#1e40af' }}
                                            />
                                          </div>
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                              <h4 className="font-semibold" style={{ color: darkMode ? '#ffffff' : '#1f2937' }}>
                                                {deviceInfo.deviceType} - {deviceInfo.browser}
                                              </h4>
                                              {isCurrent && (
                                                <span
                                                  className="px-2 py-1 text-xs font-semibold rounded"
                                                  style={{
                                                    backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)',
                                                    color: darkMode ? '#86efac' : '#16a34a',
                                                  }}
                                                >
                                                  Current Session
                                                </span>
                                              )}
                                            </div>
                                            <div className="space-y-1">
                                              <p className="text-sm" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                                {deviceInfo.os}
                                              </p>
                                              {session.userAgent && (
                                                <p className="text-xs truncate" style={{ color: darkMode ? '#6b7280' : '#9ca3af' }}>
                                                  {session.userAgent}
                                                </p>
                                              )}
                                              <div className="flex items-center gap-2 mt-2">
                                                <Clock className="w-3 h-3" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }} />
                                                <span className="text-xs" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                                  {sessionDate.toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                  })}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                        {!isCurrent && (
                                          <button
                                            onClick={() => handleDeleteSession(session._id)}
                                            disabled={isDeleting}
                                            className="p-2 rounded-lg transition-colors flex items-center gap-2"
                                            style={{
                                              backgroundColor: darkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                              color: darkMode ? '#fca5a5' : '#dc2626',
                                            }}
                                            title="Force logout"
                                          >
                                            {isDeleting ? (
                                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                              <LogOut className="w-4 h-4" />
                                            )}
                                            <span className="text-xs font-medium">Force Logout</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {hasMore && (
                                <div className="mt-4 flex justify-center">
                                  <button
                                    onClick={() => setShowAllSessions(!showAllSessions)}
                                    className="px-4 py-2 rounded-lg border transition-colors flex items-center gap-2"
                                    style={{
                                      backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#f3f4f6',
                                      borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                                      color: darkMode ? '#d1d5db' : '#374151',
                                    }}
                                  >
                                    {showAllSessions ? (
                                      <>
                                        <ChevronUp className="w-4 h-4" />
                                        Show Less
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="w-4 h-4" />
                                        Expand All ({filteredSessions.length - 5} more)
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Not Found */}
            {!loading && !error && !userData && (
              <div className="text-center py-12">
                <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>User not found</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Edit Fullname Modal */}
      {isEditFullnameModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(5px)",
          }}
          onClick={() => setIsEditFullnameModalOpen(false)}
        >
          <div
            className="rounded-lg border max-w-md w-full"
            style={{
              backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.95)' : '#ffffff',
              borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="p-6 border-b flex items-center justify-between"
              style={{
                borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
              }}
            >
              <h2
                className="text-xl font-bold"
                style={{ color: darkMode ? '#ffffff' : '#1f2937' }}
              >
                Edit Fullname
              </h2>
              <button
                onClick={() => setIsEditFullnameModalOpen(false)}
                className="p-2 rounded-lg hover:bg-opacity-20 transition-colors"
                style={{
                  color: darkMode ? '#9ca3af' : '#6b7280',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              {editError && (
                <div
                  className="mb-4 p-3 rounded-lg flex items-center gap-2"
                  style={{
                    backgroundColor: darkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                    color: darkMode ? '#fca5a5' : '#dc2626',
                  }}
                >
                  <XCircle size={18} />
                  <span className="text-sm">{editError}</span>
                </div>
              )}
              <div className="mb-4">
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: darkMode ? '#d1d5db' : '#374151' }}
                >
                  Fullname
                </label>
                <input
                  type="text"
                  value={editFullname}
                  onChange={(e) => setEditFullname(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{
                    backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#ffffff',
                    borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                    color: darkMode ? '#ffffff' : '#1f2937',
                  }}
                  placeholder="Enter fullname"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditFullnameModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg border transition-colors"
                  style={{
                    backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#f3f4f6',
                    borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                    color: darkMode ? '#d1d5db' : '#374151',
                  }}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateFullname}
                  className="flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.7)' : '#3b82f6',
                    color: '#ffffff',
                  }}
                  disabled={savingEdit}
                >
                  <Save size={16} />
                  {savingEdit ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Specialists Modal */}
      {isEditSpecialistsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(5px)",
          }}
          onClick={() => setIsEditSpecialistsModalOpen(false)}
        >
          <div
            className="rounded-lg border max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.95)' : '#ffffff',
              borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="p-6 border-b flex items-center justify-between"
              style={{
                borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
              }}
            >
              <h2
                className="text-xl font-bold"
                style={{ color: darkMode ? '#ffffff' : '#1f2937' }}
              >
                Edit Specializations
              </h2>
              <button
                onClick={() => setIsEditSpecialistsModalOpen(false)}
                className="p-2 rounded-lg hover:bg-opacity-20 transition-colors"
                style={{
                  color: darkMode ? '#9ca3af' : '#6b7280',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              {editError && (
                <div
                  className="mb-4 p-3 rounded-lg flex items-center gap-2"
                  style={{
                    backgroundColor: darkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                    color: darkMode ? '#fca5a5' : '#dc2626',
                  }}
                >
                  <XCircle size={18} />
                  <span className="text-sm">{editError}</span>
                </div>
              )}

              {/* Major Selection */}
              <div className="mb-4">
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: darkMode ? '#d1d5db' : '#374151' }}
                >
                  Major
                </label>
                {loadingEditData ? (
                  <div className="w-full px-4 py-2 rounded-lg border animate-pulse" style={{
                    backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#f3f4f6',
                    borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                  }}>
                    Loading majors...
                  </div>
                ) : (
                  <select
                    value={selectedEditMajorId}
                    onChange={(e) => {
                      setSelectedEditMajorId(e.target.value);
                      setEditSpecialistIds([]);
                    }}
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{
                      backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#ffffff',
                      borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                      color: darkMode ? '#ffffff' : '#1f2937',
                    }}
                  >
                    <option value="">Select a major</option>
                    {editMajors.map((major) => (
                      <option key={major._id} value={major._id}>
                        {major.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Specialist Selection */}
              {selectedEditMajorId && (
                <div className="mb-4">
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: darkMode ? '#d1d5db' : '#374151' }}
                  >
                    Specialists {userData?.role === 'teacher' && '(Select multiple)'}
                  </label>
                  {loadingEditData ? (
                    <div className="w-full px-4 py-2 rounded-lg border animate-pulse" style={{
                      backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#f3f4f6',
                      borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                    }}>
                      Loading specialists...
                    </div>
                  ) : (
                    <>
                      {userData?.role === 'teacher' ? (
                        <>
                          <select
                            multiple
                            value={editSpecialistIds}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                              setEditSpecialistIds(selected);
                            }}
                            className="w-full px-4 py-2 rounded-lg border min-h-[120px]"
                            style={{
                              backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#ffffff',
                              borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                              color: darkMode ? '#ffffff' : '#1f2937',
                            }}
                          >
                            {editSpecialists.map((specialist) => (
                              <option key={specialist._id} value={specialist._id}>
                                {specialist.name}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs mt-1" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                            Hold Ctrl (or Cmd on Mac) to select multiple specialists
                          </p>
                        </>
                      ) : (
                        <>
                          <select
                            value={editSpecialistIds[0] || ""}
                            onChange={(e) => {
                              setEditSpecialistIds(e.target.value ? [e.target.value] : []);
                            }}
                            className="w-full px-4 py-2 rounded-lg border"
                            style={{
                              backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#ffffff',
                              borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                              color: darkMode ? '#ffffff' : '#1f2937',
                            }}
                          >
                            <option value="">Select a specialist</option>
                            {editSpecialists.map((specialist) => (
                              <option key={specialist._id} value={specialist._id}>
                                {specialist.name}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs mt-1" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                            Select a specialist
                          </p>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditSpecialistsModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg border transition-colors"
                  style={{
                    backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.5)' : '#f3f4f6',
                    borderColor: darkMode ? 'rgba(75, 85, 99, 0.3)' : '#e5e7eb',
                    color: darkMode ? '#d1d5db' : '#374151',
                  }}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateSpecialists}
                  className="flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.7)' : '#3b82f6',
                    color: '#ffffff',
                  }}
                  disabled={savingEdit || !selectedEditMajorId || editSpecialistIds.length === 0 || (userData?.role === 'student' && editSpecialistIds.length !== 1)}
                >
                  <Save size={16} />
                  {savingEdit ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserBioPage;

