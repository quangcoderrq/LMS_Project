import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import Navbar from "../../components/layout/Navbar.tsx";
import Sidebar from "../../components/layout/Sidebar.tsx";
import AttendanceStatsOverview from "../../components/attendance/AttendanceStatsOverview.tsx";
import AttendanceForm from "../../components/attendance/AttendanceForm.tsx";
import AttendanceProgressIndicator from "../../components/attendance/AttendanceProgressIndicator.tsx";
import StudentAttendanceModal from "../../components/attendance/StudentAttendanceModal.tsx";
import CourseGrid from "../../components/common/CourseGrid.tsx";
import ScheduleDatePicker from "../../components/common/ScheduleDatePicker.tsx";
import { CourseCardSkeleton, AttendanceStatsSkeleton } from "../../components/common/Skeleton.tsx";
import {
  semesterService,
  courseService,
  attendanceService,
  enrollmentService,
  type Semester,
  type CourseAttendanceStats,
  type StudentAttendanceStat,
} from "../../services";
import type { EnrollmentItem } from "../../services/enrollmentService";
import { scheduleService } from "../../services/scheduleService";
import type { Course } from "../../types/course";
import type { Schedule, DayOfWeek } from "../../types/schedule";
import { Users, Download, AlertTriangle, Calendar } from "lucide-react";
import { getCurrentDateUTC7 } from "../../utils/dateUtils";
import { format, parseISO, isWithinInterval } from "date-fns";

export default function AttendancePage() {
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { semesterId, courseId } = useParams<{ semesterId?: string; courseId?: string }>();

  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<Semester | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [attendanceStats, setAttendanceStats] = useState<CourseAttendanceStats | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  // Schedule validation state
  const [courseSchedules, setCourseSchedules] = useState<Schedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState<string>(getCurrentDateUTC7());

  // Track if we're setting selectedCourse from UI interaction (to prevent duplicate fetch)
  const isSettingFromUI = useRef(false);

  // Map day index (0=Sunday) to DayOfWeek
  const indexToDayOfWeek: DayOfWeek[] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ];

  // Check if schedule is effective on a given date
  const isScheduleEffectiveOnDate = (schedule: Schedule, date: Date): boolean => {
    try {
      const effectiveFrom = parseISO(schedule.effectiveFrom);
      if (schedule.effectiveTo) {
        const effectiveTo = parseISO(schedule.effectiveTo);
        return isWithinInterval(date, { start: effectiveFrom, end: effectiveTo });
      }
      return date >= effectiveFrom;
    } catch {
      return false;
    }
  };

  // Check if the selected date has a valid schedule
  const scheduleValidation = useMemo(() => {
    if (!selectedCourse || courseSchedules.length === 0) {
      return { hasSchedule: false, scheduleForDay: null, message: "No schedule found for this course" };
    }

    const selectedDateObj = parseISO(attendanceDate);
    const dayIndex = selectedDateObj.getDay();
    const dayOfWeek = indexToDayOfWeek[dayIndex];

    // Find schedules for this day that are approved/active and effective on the selected date
    const schedulesForDay = courseSchedules.filter(schedule => {
      const matchesDay = schedule.dayOfWeek === dayOfWeek;
      const isApproved = schedule.status === 'approved' || schedule.status === 'active';
      const isEffective = isScheduleEffectiveOnDate(schedule, selectedDateObj);
      return matchesDay && isApproved && isEffective;
    });

    if (schedulesForDay.length === 0) {
      const dayName = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
      return {
        hasSchedule: false,
        scheduleForDay: null,
        message: `No class scheduled for ${dayName} (${format(selectedDateObj, 'MMM dd, yyyy')})`
      };
    }

    return {
      hasSchedule: true,
      scheduleForDay: schedulesForDay[0],
      message: null
    };
  }, [selectedCourse, courseSchedules, attendanceDate, indexToDayOfWeek]);

  // Find semester closest to current date
  const findClosestSemester = (semesters: Semester[]): Semester | null => {
    if (semesters.length === 0) return null;

    const now = new Date();
    // Adjust to UTC+7
    const nowUTC7 = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    let closest: Semester | null = null;
    let minDiff = Infinity;

    for (const semester of semesters) {
      const startDate = new Date(semester.startDate);
      const endDate = new Date(semester.endDate);

      // If current date is within semester range, prioritize it
      if (nowUTC7 >= startDate && nowUTC7 <= endDate) {
        return semester;
      }

      // Otherwise, find the closest upcoming semester
      const diff = Math.abs(startDate.getTime() - nowUTC7.getTime());
      if (diff < minDiff && startDate >= nowUTC7) {
        minDiff = diff;
        closest = semester;
      }
    }

    // If no upcoming semester, return the most recent past semester
    if (!closest) {
      return semesters.sort((a, b) =>
        new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
      )[0];
    }

    return closest;
  };


  // Fetch semesters once on mount
  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        setLoadingCourses(true);
        const data = await semesterService.getAllSemesters();
        setSemesters(data);
      } catch (err: any) {
        setError(err.message || "Failed to fetch semesters");
      } finally {
        setLoadingCourses(false);
      }
    };

    fetchSemesters();
  }, []); // Empty dependency array - only run once on mount

  // Select semester based on URL or default to closest
  useEffect(() => {
    if (semesters.length === 0) return;

    if (semesterId) {
      const semester = semesters.find(s => s._id === semesterId);
      if (semester && semester._id !== selectedSemester?._id) {
        setSelectedSemester(semester);
      } else if (!semester) {
        // semesterId in URL doesn't match any semester, fallback to closest
        const closest = findClosestSemester(semesters);
        if (closest) {
          setSelectedSemester(closest);
          navigate(`/attendance/${closest._id}`, { replace: true });
        }
      }
    } else {
      // No semesterId in URL, select closest semester
      const closest = findClosestSemester(semesters);
      if (closest) {
        setSelectedSemester(closest);
        navigate(`/attendance/${closest._id}`, { replace: true });
      }
    }
  }, [semesterId, semesters, navigate]); // Removed selectedSemester._id to prevent circular updates

  // Fetch courses when semester is selected (only when semester changes)
  useEffect(() => {
    const fetchCourses = async () => {
      if (!selectedSemester) return;

      try {
        setLoadingCourses(true);
        setCourses([]); // Clear old courses immediately to prevent flicker
        const result = await courseService.getAllCourses({
          semesterId: selectedSemester._id,
          isPublished: true,
          limit: 100,
        });
        setCourses(result.courses || []);
      } catch (err: any) {
        setError(err.message || "Failed to fetch courses");
      } finally {
        setLoadingCourses(false);
      }
    };

    fetchCourses();
  }, [selectedSemester?._id]); // Only re-fetch when semester ID changes, not the whole object

  // Set selected course from URL parameter when courses are loaded
  useEffect(() => {
    if (!courseId || courses.length === 0 || isSettingFromUI.current) {
      if (isSettingFromUI.current) {
        isSettingFromUI.current = false;
      }
      return;
    }

    const course = courses.find(c => c._id === courseId);
    if (course && course._id !== selectedCourse?._id) {
      setSelectedCourse(course);
    }
  }, [courseId, courses, selectedCourse?._id]);

  // Fetch course schedules when course is selected (for validation)
  useEffect(() => {
    const fetchCourseSchedules = async () => {
      if (!selectedCourse) {
        setCourseSchedules([]);
        return;
      }

      try {
        setLoadingSchedules(true);
        // Fetch approved/active schedules for this course
        const schedules = await scheduleService.getCourseSchedule(
          selectedCourse._id,
          ['approved', 'active']
        );
        setCourseSchedules(schedules);
      } catch (err) {
        console.error('Failed to fetch course schedules:', err);
        setCourseSchedules([]);
      } finally {
        setLoadingSchedules(false);
      }
    };

    fetchCourseSchedules();
  }, [selectedCourse?._id]);

  // Fetch attendance stats and enrollments when course is selected
  useEffect(() => {
    const fetchAttendanceData = async () => {
      if (!selectedCourse) {
        setAttendanceStats(null);
        return;
      }

      try {
        setLoadingStats(true);
        setError(null);

        // Fetch both enrollments and stats in parallel
        const [enrollmentsResult, stats] = await Promise.all([
          enrollmentService.getByCourse(selectedCourse._id, {
            limit: 1000
          }),
          attendanceService.getCourseStats(selectedCourse._id)
        ]);

        // Merge enrollments with stats to show all students
        const mergedStudentStats = mergeEnrollmentsWithStats(
          enrollmentsResult.enrollments,
          stats
        );

        // Update the stats with merged student list
        setAttendanceStats({
          ...stats,
          studentStats: mergedStudentStats,
          totalStudents: mergedStudentStats.length,
        });
      } catch (err: any) {
        setError(err.message || "Failed to fetch attendance data");
        setAttendanceStats(null);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchAttendanceData();
  }, [selectedCourse]);

  // Helper function to merge enrollments with stats
  const mergeEnrollmentsWithStats = (
    enrollments: EnrollmentItem[],
    stats: CourseAttendanceStats | null
  ): StudentAttendanceStat[] => {
    const enrollmentMap = new Map<string, EnrollmentItem>();
    const result: StudentAttendanceStat[] = [];

    // Map approved enrollments by studentId
    // API returns studentId (not userId) for getByCourse endpoint
    enrollments
      .filter(enrollment => {
        const student = enrollment.studentId || enrollment.userId;
        return enrollment.status === 'approved' && student?._id;
      })
      .forEach(enrollment => {
        const student = enrollment.studentId || enrollment.userId;
        if (student?._id) {
          enrollmentMap.set(student._id, enrollment);
        }
      });

    // Process all students from stats (historical data)
    if (stats?.studentStats) {
      stats.studentStats.forEach(stat => {
        const isEnrolled = enrollmentMap.has(stat.studentId);
        result.push({
          ...stat,
          isCurrentlyEnrolled: isEnrolled,
        });
        // Remove from map so we can track which enrollments we've processed
        if (isEnrolled) {
          enrollmentMap.delete(stat.studentId);
        }
      });
    }

    // Add remaining enrollments (students with no attendance history yet)
    enrollmentMap.forEach(enrollment => {
      // Get student from studentId or userId (API returns studentId)
      const student = enrollment.studentId || enrollment.userId;
      if (!student?._id) return;
      
      result.push({
        studentId: student._id,
        student: {
          _id: student._id,
          username: student.username || 'Unknown',
          email: student.email || '',
          fullname: student.fullname,
          avatar_url: undefined,
        },
        totalSessions: 0,
        counts: {
          present: 0,
          absent: 0,
          notyet: 0,
        },
        attendanceRate: 0,
        absentRate: 0,
        longestAbsentStreak: 0,
        alerts: {
          highAbsence: false,
        },
        isCurrentlyEnrolled: true,
      } as StudentAttendanceStat);
    });

    // Sort: Currently enrolled students first, then historical students
    return result.sort((a, b) => {
      if (a.isCurrentlyEnrolled === b.isCurrentlyEnrolled) {
        // Same enrollment status, sort by name (with null checks)
        const nameA = a.student?.fullname || a.student?.username || '';
        const nameB = b.student?.fullname || b.student?.username || '';
        return nameA.localeCompare(nameB);
      }
      // Currently enrolled students come first
      return (b.isCurrentlyEnrolled ? 1 : 0) - (a.isCurrentlyEnrolled ? 1 : 0);
    });
  };

  const handleSemesterChange = (semester: Semester) => {
    setSelectedSemester(semester);
    setCourses([]); // Clear old courses immediately to prevent flickering
    setSelectedCourse(null);
    setAttendanceStats(null);
    navigate(`/attendance/${semester._id}`);
  };

  const handleCourseClick = (course: Course) => {
    // Set flag to prevent duplicate course fetch when URL changes
    isSettingFromUI.current = true;
    setSelectedCourse(course);
    navigate(`/attendance/${selectedSemester?._id}/${course._id}`);
  };

  const handleSaveAttendance = async (entries: Array<{ studentId: string; status: "present" | "absent" | "notyet" }>) => {
    if (!selectedCourse) return;

    // Filter out "notyet" entries - only save present/absent
    const validEntries = entries.filter(e => e.status !== "notyet") as Array<{ studentId: string; status: "present" | "absent" }>;
    if (validEntries.length === 0) {
      setError("No attendance changes to save");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await attendanceService.createAttendance({
        courseId: selectedCourse._id,
        date: attendanceDate, // Use selected date (admin can modify, others use today)
        entries: validEntries,
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      // Refresh stats AND enrollments after saving, then re-merge
      const [enrollmentsResult, stats] = await Promise.all([
        enrollmentService.getByCourse(selectedCourse._id, {
          limit: 1000
        }),
        attendanceService.getCourseStats(selectedCourse._id)
      ]);

      // Re-merge to maintain isCurrentlyEnrolled flags
      const mergedStudentStats = mergeEnrollmentsWithStats(
        enrollmentsResult.enrollments,
        stats
      );

      setAttendanceStats({
        ...stats,
        studentStats: mergedStudentStats,
        totalStudents: mergedStudentStats.length,
      });
    } catch (err: any) {
      setError(err.message || "Failed to save attendance");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      setError(null);
      const result = await attendanceService.exportAttendance();

      // Create blob and download
      const blob = new Blob([result.csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_export_${getCurrentDateUTC7()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to export attendance");
    } finally {
      setExporting(false);
    }
  };

  const handleStudentClick = (studentId: string, studentName: string) => {
    setSelectedStudent({ id: studentId, name: studentName });
  };

  const handleAttendanceUpdate = async () => {
    if (selectedCourse) {
      const stats = await attendanceService.getCourseStats(selectedCourse._id);
      setAttendanceStats(stats);
    }
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
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1
                  className="text-3xl font-bold mb-2"
                  style={{ color: darkMode ? "#ffffff" : "#1e293b" }}
                >
                  Attendance Management
                </h1>
                <p
                  className="text-sm"
                  style={{ color: darkMode ? "#94a3b8" : "#64748b" }}
                >
                  Manage student attendance for courses (UTC+7)
                </p>
              </div>
              {user?.role === "admin" && (
                <button
                  onClick={handleExportCSV}
                  disabled={exporting}
                  className="px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: exporting ? "#94a3b8" : "#6366f1",
                    color: "#ffffff",
                  }}
                >
                  {exporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Export CSV</span>
                    </>
                  )}
                </button>
              )}
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

            {/* Success Message */}
            {showSuccess && (
              <div
                className="mb-4 p-4 rounded-lg flex items-center gap-2"
                style={{
                  backgroundColor: darkMode ? "rgba(34, 197, 94, 0.1)" : "rgba(34, 197, 94, 0.1)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                  color: "#22c55e",
                }}
              >
                <span>Operation completed successfully!</span>
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

            {/* Course Selection */}
            {selectedSemester && (
              <div className="mb-6">
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: darkMode ? "#e2e8f0" : "#475569" }}
                >
                  Select Course
                </label>
                {loadingCourses ? (
                  <CourseCardSkeleton count={6} />
                ) : (
                  <CourseGrid
                    courses={courses}
                    loading={false}
                    emptyMessage="No courses available for this semester"
                    onCourseClick={handleCourseClick}
                    selectedCourseId={selectedCourse?._id}
                    showProgress={true}
                    showDescription={false}
                    showCode={false}
                  />
                )}
              </div>
            )}

            {/* Attendance Stats and Form */}
            {selectedCourse && attendanceStats && (
              <div className="space-y-6">
                <AttendanceStatsOverview stats={attendanceStats} />

                {/* Date Selection for Admin/Teacher */}
                {(isAdmin || isTeacher) && (
                  <div
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: darkMode ? "rgba(30, 41, 59, 0.5)" : "#ffffff",
                      border: darkMode
                        ? "1px solid rgba(148, 163, 184, 0.1)"
                        : "1px solid rgba(148, 163, 184, 0.2)",
                    }}
                  >
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" style={{ color: darkMode ? "#94a3b8" : "#64748b" }} />
                        <label
                          className="text-sm font-medium"
                          style={{ color: darkMode ? "#e2e8f0" : "#475569" }}
                        >
                          Attendance Date:
                        </label>
                      </div>
                      <ScheduleDatePicker
                        value={attendanceDate}
                        onChange={setAttendanceDate}
                        schedules={courseSchedules}
                        darkMode={darkMode}
                        maxDate={isTeacher ? getCurrentDateUTC7() : undefined}
                      />
                      <span
                        className="text-xs"
                        style={{ color: darkMode ? "#94a3b8" : "#64748b" }}
                      >
                        {isAdmin 
                          ? "(Admin can modify attendance for any date)"
                          : "(Teacher can view past dates, edit only today)"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Schedule Validation Warning */}
                {loadingSchedules ? (
                  <div
                    className="p-4 rounded-lg flex items-center gap-3"
                    style={{
                      backgroundColor: darkMode ? "rgba(30, 41, 59, 0.5)" : "#ffffff",
                      border: darkMode
                        ? "1px solid rgba(148, 163, 184, 0.1)"
                        : "1px solid rgba(148, 163, 184, 0.2)",
                    }}
                  >
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span style={{ color: darkMode ? "#94a3b8" : "#64748b" }}>
                      Checking course schedule...
                    </span>
                  </div>
                ) : !scheduleValidation.hasSchedule ? (
                  <div
                    className="p-4 rounded-lg flex items-start gap-3"
                    style={{
                      backgroundColor: darkMode ? "rgba(245, 158, 11, 0.1)" : "rgba(245, 158, 11, 0.1)",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                    }}
                  >
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
                    <div>
                      <p className="font-medium" style={{ color: "#f59e0b" }}>
                        Attendance Not Available
                      </p>
                      <p className="text-sm mt-1" style={{ color: darkMode ? "#fbbf24" : "#d97706" }}>
                        {scheduleValidation.message}
                      </p>
                      {courseSchedules.length > 0 && (
                        <p className="text-sm mt-2" style={{ color: darkMode ? "#94a3b8" : "#64748b" }}>
                          This course has classes on:{" "}
                          {Array.from(new Set(courseSchedules.map(s => s.dayOfWeek)))
                            .map(day => day.charAt(0).toUpperCase() + day.slice(1))
                            .join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <AttendanceForm
                    stats={attendanceStats.studentStats}
                    courseId={selectedCourse._id}
                    courseTitle={selectedCourse.title}
                    onSave={handleSaveAttendance}
                    onStudentClick={handleStudentClick}
                    saving={saving}
                    attendanceDate={attendanceDate}
                    viewOnly={isTeacher && attendanceDate !== getCurrentDateUTC7()}
                  />
                )}
              </div>
            )}

            {/* Loading State for Attendance Stats */}
            {selectedCourse && loadingStats && <AttendanceStatsSkeleton />}

            {/* Empty State */}
            {selectedCourse && !attendanceStats && !loadingStats && (
              <div
                className="p-8 rounded-lg text-center"
                style={{
                  backgroundColor: darkMode ? "rgba(30, 41, 59, 0.5)" : "#ffffff",
                  border: darkMode
                    ? "1px solid rgba(148, 163, 184, 0.1)"
                    : "1px solid rgba(148, 163, 184, 0.2)",
                }}
              >
                <Users className="w-12 h-12 mx-auto mb-4" style={{ color: "#94a3b8" }} />
                <p style={{ color: darkMode ? "#94a3b8" : "#64748b" }}>
                  No attendance data found for this course
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Student Attendance Modal */}
      {selectedStudent && (
        <StudentAttendanceModal
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          courseId={selectedCourse?._id}
          courseTitle={selectedCourse?.title}
          courseStartDate={selectedCourse?.startDate}
          courseEndDate={selectedCourse?.endDate}
          onUpdate={handleAttendanceUpdate}
        />
      )}
    </div>
  );
}
