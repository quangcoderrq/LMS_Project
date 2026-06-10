import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { useSearchParams } from "react-router-dom";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
  getDay,
  parseISO,
  isWithinInterval,
} from "date-fns";
import "./Calendar.css";
import "./Modal.css";
import Navbar from "../layout/Navbar";
import Sidebar from "../layout/Sidebar";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import { scheduleService } from "../../services/scheduleService";
import { courseService } from "../../services/courseService";
import { userService, type UserDetail } from "../../services/userService";
import type {
  Schedule,
  TimeSlot,
  TeacherWeeklySchedule,
  DayOfWeek,
  ScheduleStatus,
  ScheduleTeacher,
  CreateScheduleRequest,
} from "../../types/schedule";
import type { Course } from "../../types/course";

type ViewMode = "month" | "week" | "day";

// Map day index to DayOfWeek enum (0 = Sunday)
const indexToDayOfWeek: DayOfWeek[] = [
  "sunday" as DayOfWeek,
  "monday" as DayOfWeek,
  "tuesday" as DayOfWeek,
  "wednesday" as DayOfWeek,
  "thursday" as DayOfWeek,
  "friday" as DayOfWeek,
  "saturday" as DayOfWeek,
];

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

// Helper to safely get teacher name
const getTeacherName = (teacherId: ScheduleTeacher | string): string => {
  if (typeof teacherId === "object" && teacherId?.fullname) {
    return teacherId.fullname;
  }
  return "Unknown Teacher";
};

// Helper to safely get time slot info
const getTimeSlotInfo = (
  timeSlotId: TimeSlot | string
): { startTime: string; endTime: string; slotName: string } => {
  if (typeof timeSlotId === "object" && timeSlotId?.startTime) {
    return {
      startTime: timeSlotId.startTime,
      endTime: timeSlotId.endTime,
      slotName: timeSlotId.slotName,
    };
  }
  return { startTime: "00:00", endTime: "00:00", slotName: "Unknown Slot" };
};

// Check if schedule is effective on a given date
const isScheduleEffectiveOnDate = (schedule: Schedule, date: Date): boolean => {
  const effectiveFrom = parseISO(schedule.effectiveFrom);
  const effectiveTo = schedule.effectiveTo
    ? parseISO(schedule.effectiveTo)
    : addMonths(effectiveFrom, 12);
  return isWithinInterval(date, { start: effectiveFrom, end: effectiveTo });
};

// Get status badge color
const getStatusColor = (status: ScheduleStatus): string => {
  switch (status) {
    case "approved":
    case "active":
      return "#10b981";
    case "pending":
      return "#f59e0b";
    case "rejected":
      return "#ef4444";
    case "inactive":
      return "#6b7280";
    default:
      return "#6b7280";
  }
};

function safeFormatDate(
  dateValue: string | Date | undefined,
  fmt: string,
  fallback = ""
): string {
  if (!dateValue) return fallback;
  try {
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return fallback;
    return format(d, fmt);
  } catch {
    return fallback;
  }
}

type ScheduleViewMode = "my-schedule" | "by-course" | "by-teacher";

const Calendar: React.FC = () => {
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<ViewMode>("week");

  // Schedule view mode: 'my-schedule', 'by-course', or 'by-teacher'
  const [scheduleViewMode, setScheduleViewMode] =
    useState<ScheduleViewMode>("my-schedule");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");

  // Check if user is admin
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const canCreateSchedule = isAdmin || isTeacher;

  // Schedule data from API
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [weeklySchedule, setWeeklySchedule] =
    useState<TeacherWeeklySchedule | null>(null);
  const [courseSchedules, setCourseSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Admin-specific state
  const [pendingSchedules, setPendingSchedules] = useState<Schedule[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<UserDetail[]>([]);
  const [teacherSchedule, setTeacherSchedule] =
    useState<TeacherWeeklySchedule | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(
    null
  );
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Custom dropdown states
  const [showCourseDropdown, setShowCourseDropdown] = useState<boolean>(false);
  const [showTeacherDropdown, setShowTeacherDropdown] =
    useState<boolean>(false);
  const [courseSearchQuery, setCourseSearchQuery] = useState<string>("");
  const [teacherSearchQuery, setTeacherSearchQuery] = useState<string>("");
  const courseDropdownRef = React.useRef<HTMLDivElement>(null);
  const teacherDropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        courseDropdownRef.current &&
        !courseDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCourseDropdown(false);
      }
      if (
        teacherDropdownRef.current &&
        !teacherDropdownRef.current.contains(event.target as Node)
      ) {
        setShowTeacherDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtered courses and teachers based on search
  const filteredCourses = useMemo(() => {
    if (!courseSearchQuery.trim()) return courses;
    const query = courseSearchQuery.toLowerCase();
    return courses.filter(
      (course) =>
        course.title.toLowerCase().includes(query) ||
        (course.code && course.code.toLowerCase().includes(query))
    );
  }, [courses, courseSearchQuery]);

  const filteredTeachers = useMemo(() => {
    if (!teacherSearchQuery.trim()) return teachers;
    const query = teacherSearchQuery.toLowerCase();
    return teachers.filter(
      (teacher) =>
        (teacher.fullname || "").toLowerCase().includes(query) ||
        (teacher.username || "").toLowerCase().includes(query) ||
        (teacher.email || "").toLowerCase().includes(query)
    );
  }, [teachers, teacherSearchQuery]);

  // Create schedule form state - supports multiple slots
  const [createForm, setCreateForm] = useState<{
    courseId: string;
    slots: Array<{ dayOfWeek: DayOfWeek; timeSlotId: string }>;
    effectiveFrom: string;
    effectiveTo: string;
    location: string;
    requestNote: string;
  }>({
    courseId: "",
    slots: [],
    effectiveFrom: format(new Date(), "yyyy-MM-dd"),
    effectiveTo: "",
    location: "",
    requestNote: "",
  });

  // Fetch time slots
  useEffect(() => {
    const fetchTimeSlots = async () => {
      try {
        const slots = await scheduleService.getTimeSlots();
        setTimeSlots(slots);
      } catch (err) {
        console.error("Failed to fetch time slots:", err);
      }
    };
    fetchTimeSlots();
  }, []);

  // Read URL params on mount
  useEffect(() => {
    const courseIdParam = searchParams.get("courseId");
    const teacherIdParam = searchParams.get("teacherId");
    if (courseIdParam) {
      setScheduleViewMode("by-course");
      setSelectedCourseId(courseIdParam);
    } else if (teacherIdParam && isAdmin) {
      setScheduleViewMode("by-teacher");
      setSelectedTeacherId(teacherIdParam);
    }
  }, [searchParams, isAdmin]);

  // Fetch courses for all users (for course filter dropdown)
  // For teachers, filter by their teacherId to show only their assigned courses
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const params: { limit: number; teacherId?: string } = { limit: 100 };
        // If user is a teacher, only fetch their assigned courses
        if (isTeacher && user?._id) {
          params.teacherId = user._id;
        }
        const { courses: courseList } = await courseService.getAllCourses(
          params
        );
        setCourses(courseList);
      } catch (err) {
        console.error("Failed to fetch courses:", err);
      }
    };

    fetchCourses();
  }, [isTeacher, user?._id]);

  // Fetch teachers list for admin (for "By Teacher" view mode)
  useEffect(() => {
    const fetchTeachers = async () => {
      if (!isAdmin) return;

      try {
        const { users: teacherList } = await userService.getUsers({
          role: "teacher",
          limit: 100,
          status: "active",
        });
        // Cast to UserDetail[] since the API returns user details including email
        setTeachers(teacherList as UserDetail[]);
      } catch (err) {
        console.error("Failed to fetch teachers:", err);
      }
    };

    fetchTeachers();
  }, [isAdmin]);

  // Fetch teacher schedule (my-schedule mode)
  useEffect(() => {
    const fetchSchedule = async () => {
      if (!user?._id || scheduleViewMode !== "my-schedule") return;

      setLoading(true);
      setError(null);

      try {
        const dateStr = format(currentDate, "yyyy-MM-dd");
        const schedule = await scheduleService.getTeacherSchedule(
          user._id,
          dateStr,
          "approved"
        );
        setWeeklySchedule(schedule);
      } catch (err: unknown) {
        console.error("Failed to fetch schedule:", err);
        const message =
          err instanceof Error ? err.message : "Failed to load schedule";
        setError(message);
        setWeeklySchedule(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [user?._id, currentDate, scheduleViewMode]);

  // Fetch course schedule (by-course mode)
  useEffect(() => {
    const fetchCourseSchedule = async () => {
      if (!selectedCourseId || scheduleViewMode !== "by-course") return;

      setLoading(true);
      setError(null);

      try {
        const schedules = await scheduleService.getCourseSchedule(
          selectedCourseId,
          "approved"
        );
        setCourseSchedules(schedules);
      } catch (err: unknown) {
        console.error("Failed to fetch course schedule:", err);
        const message =
          err instanceof Error ? err.message : "Failed to load course schedule";
        setError(message);
        setCourseSchedules([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseSchedule();
  }, [selectedCourseId, scheduleViewMode]);

  // Fetch selected teacher schedule (by-teacher mode) - Admin only
  useEffect(() => {
    const fetchSelectedTeacherSchedule = async () => {
      if (!selectedTeacherId || scheduleViewMode !== "by-teacher" || !isAdmin)
        return;

      setLoading(true);
      setError(null);

      try {
        const dateStr = format(currentDate, "yyyy-MM-dd");
        const schedule = await scheduleService.getTeacherSchedule(
          selectedTeacherId,
          dateStr,
          ["pending", "approved"] as ScheduleStatus[]
        );
        setTeacherSchedule(schedule);
      } catch (err: unknown) {
        console.error("Failed to fetch teacher schedule:", err);
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load teacher schedule";
        setError(message);
        setTeacherSchedule(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSelectedTeacherSchedule();
  }, [selectedTeacherId, currentDate, scheduleViewMode, isAdmin]);

  // Fetch pending schedules for admin
  useEffect(() => {
    const fetchPendingSchedules = async () => {
      if (!isAdmin) return;

      try {
        const pending = await scheduleService.getPendingSchedules();
        setPendingSchedules(pending);
      } catch (err) {
        console.error("Failed to fetch pending schedules:", err);
      }
    };

    fetchPendingSchedules();
  }, [isAdmin]);

  // Handle schedule view mode change
  const handleScheduleViewModeChange = (mode: ScheduleViewMode) => {
    setScheduleViewMode(mode);
    if (mode === "my-schedule") {
      setSelectedCourseId("");
      setSelectedTeacherId("");
      // Remove courseId and teacherId from URL
      searchParams.delete("courseId");
      searchParams.delete("teacherId");
      setSearchParams(searchParams);
    } else if (mode === "by-course") {
      setSelectedTeacherId("");
      searchParams.delete("teacherId");
      setSearchParams(searchParams);
    } else if (mode === "by-teacher") {
      setSelectedCourseId("");
      searchParams.delete("courseId");
      setSearchParams(searchParams);
    }
  };

  // Handle teacher selection
  const handleTeacherSelect = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    if (teacherId) {
      // Update URL with teacherId
      searchParams.set("teacherId", teacherId);
      setSearchParams(searchParams);
    } else {
      searchParams.delete("teacherId");
      setSearchParams(searchParams);
    }
  };

  // Handle course selection
  const handleCourseSelect = (courseId: string) => {
    setSelectedCourseId(courseId);
    if (courseId) {
      // Update URL with courseId
      searchParams.set("courseId", courseId);
      setSearchParams(searchParams);
    } else {
      searchParams.delete("courseId");
      setSearchParams(searchParams);
    }
  };

  // Admin handlers
  const handleCreateSchedule = async () => {
    if (!createForm.courseId || createForm.slots.length === 0) {
      setActionError("Please select a course and at least one day/time slot");
      return;
    }

    // Validate all slots have timeSlotId
    const invalidSlots = createForm.slots.filter((s) => !s.timeSlotId);
    if (invalidSlots.length > 0) {
      setActionError("Please select a time slot for each selected day");
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      const request: CreateScheduleRequest = {
        courseId: createForm.courseId,
        slots: createForm.slots,
        effectiveFrom: createForm.effectiveFrom,
        effectiveTo: createForm.effectiveTo || undefined,
        location: createForm.location || undefined,
        requestNote: createForm.requestNote || undefined,
      };

      await scheduleService.createSchedule(request);
      setShowCreateModal(false);
      setCreateForm({
        courseId: "",
        slots: [],
        effectiveFrom: format(new Date(), "yyyy-MM-dd"),
        effectiveTo: "",
        location: "",
        requestNote: "",
      });

      // Refresh pending schedules
      const pending = await scheduleService.getPendingSchedules();
      setPendingSchedules(pending);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create schedule";
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveSchedule = async (
    scheduleId: string,
    approved: boolean,
    note?: string
  ) => {
    setActionLoading(true);
    setActionError(null);

    try {
      await scheduleService.approveSchedule(scheduleId, {
        approved,
        approvalNote: note,
      });

      // Refresh pending schedules and weekly schedule
      const pending = await scheduleService.getPendingSchedules();
      setPendingSchedules(pending);

      if (user?._id) {
        const dateStr = format(currentDate, "yyyy-MM-dd");
        const schedule = await scheduleService.getTeacherSchedule(
          user._id,
          dateStr
        );
        setWeeklySchedule(schedule);
      }

      setShowApprovalModal(false);
      setSelectedSchedule(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to process schedule";
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const openScheduleDetail = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    if (isAdmin && schedule.status === "pending") {
      setShowApprovalModal(true);
    } else {
      setShowEditModal(true);
    }
  };

  // Get schedules for a specific date - handles my-schedule, by-course, and by-teacher modes
  const getSchedulesForDate = useCallback(
    (day: Date): Schedule[] => {
      if (scheduleViewMode === "by-course") {
        // For course view, filter courseSchedules by day of week and effective date
        const dayIndex = getDay(day);
        const dayName = indexToDayOfWeek[dayIndex];

        return courseSchedules.filter((schedule) => {
          const matchesDay = schedule.dayOfWeek === dayName;
          const isEffective = isScheduleEffectiveOnDate(schedule, day);
          const isApproved =
            schedule.status === "approved" || schedule.status === "active";
          return matchesDay && isEffective && isApproved;
        });
      }

      if (scheduleViewMode === "by-teacher") {
        // For teacher view, use teacherSchedule (admin viewing another teacher's schedule)
        if (!teacherSchedule) return [];

        const dayIndex = getDay(day);
        const dayName = indexToDayOfWeek[
          dayIndex
        ] as keyof TeacherWeeklySchedule;
        const daySchedules = teacherSchedule[dayName] || [];

        // Filter by effective date range (include both approved and pending for admin view)
        return daySchedules.filter((schedule) => {
          const isEffective = isScheduleEffectiveOnDate(schedule, day);
          return isEffective;
        });
      }

      // For my-schedule view, use weeklySchedule
      if (!weeklySchedule) return [];

      const dayIndex = getDay(day);
      const dayName = indexToDayOfWeek[dayIndex] as keyof TeacherWeeklySchedule;
      const daySchedules = weeklySchedule[dayName] || [];

      // Filter by effective date range and approved/active status
      return daySchedules.filter((schedule) => {
        const isEffective = isScheduleEffectiveOnDate(schedule, day);
        const isApproved =
          schedule.status === "approved" || schedule.status === "active";
        return isEffective && isApproved;
      });
    },
    [weeklySchedule, courseSchedules, teacherSchedule, scheduleViewMode]
  );

  // Get all schedules for the week
  const allSchedulesForWeek = useMemo(() => {
    if (scheduleViewMode === "by-course") {
      return courseSchedules;
    }

    if (scheduleViewMode === "by-teacher") {
      if (!teacherSchedule) return [];
      const allSchedules: Schedule[] = [];
      Object.values(teacherSchedule).forEach((daySchedules) => {
        allSchedules.push(...daySchedules);
      });
      return allSchedules;
    }

    if (!weeklySchedule) return [];
    const allSchedules: Schedule[] = [];
    Object.values(weeklySchedule).forEach((daySchedules) => {
      allSchedules.push(...daySchedules);
    });
    return allSchedules;
  }, [weeklySchedule, courseSchedules, teacherSchedule, scheduleViewMode]);

  // Calculate stats
  const stats = useMemo(() => {
    const approvedCount = allSchedulesForWeek.filter(
      (s) => s.status === "approved" || s.status === "active"
    ).length;
    const pendingCount = allSchedulesForWeek.filter(
      (s) => s.status === "pending"
    ).length;
    const uniqueCourses = new Set(
      allSchedulesForWeek.map((s) =>
        typeof s.courseId === "object" ? s.courseId._id : s.courseId
      )
    ).size;

    return {
      totalClasses: approvedCount,
      pendingRequests: pendingCount,
      courses: uniqueCourses,
    };
  }, [allSchedulesForWeek]);

  // Course cache for courses not in the courses list
  const courseCache = useRef<Map<string, Course>>(new Map());
  const [, forceUpdate] = useState(0);

  // Fetch course by ID and cache it
  const fetchAndCacheCourse = useCallback(async (courseId: string) => {
    if (courseCache.current.has(courseId)) return;

    try {
      const course = await courseService.getCourseById(courseId);
      courseCache.current.set(courseId, course);
      forceUpdate((prev) => prev + 1); // Trigger re-render
    } catch (err) {
      console.error("Failed to fetch course:", courseId, err);
    }
  }, []);

  // Helper to get course title from courseId (can be object or string)
  const getCourseTitle = useCallback(
    (courseId: Schedule["courseId"]): string => {
      // If courseId is an object with title, use it directly
      if (
        typeof courseId === "object" &&
        courseId !== null &&
        "title" in courseId
      ) {
        return (courseId as { title: string }).title;
      }

      // courseId is a string, look up in courses list first
      const courseIdStr =
        typeof courseId === "object"
          ? (courseId as { _id: string })._id
          : courseId;

      // Check local courses list
      const course = courses.find((c) => c._id === courseIdStr);
      if (course) return course.title;

      // Check cache
      const cachedCourse = courseCache.current.get(courseIdStr);
      if (cachedCourse) return cachedCourse.title;

      // Trigger fetch for this course (async)
      fetchAndCacheCourse(courseIdStr);

      return "Loading...";
    },
    [courses, fetchAndCacheCourse]
  );

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const startWeek = startOfWeek(start);
    const endWeek = endOfWeek(end);
    return eachDayOfInterval({ start: startWeek, end: endWeek });
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate);
    const end = endOfWeek(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Navigation handlers
  const handlePrev = () => {
    if (view === "month") {
      setCurrentDate((d) => subMonths(d, 1));
    } else if (view === "week") {
      setCurrentDate((d) => subWeeks(d, 1));
    } else {
      setCurrentDate((d) => subDays(d, 1));
    }
  };

  const handleNext = () => {
    if (view === "month") {
      setCurrentDate((d) => addMonths(d, 1));
    } else if (view === "week") {
      setCurrentDate((d) => addWeeks(d, 1));
    } else {
      setCurrentDate((d) => addDays(d, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Render schedule item for month view
  const renderScheduleItem = (schedule: Schedule, index: number) => {
    const timeSlot = getTimeSlotInfo(schedule.timeSlotId);
    const courseTitle = getCourseTitle(schedule.courseId);
    const color = COLORS[index % COLORS.length];

    return (
      <div
        key={schedule._id}
        className={`schedule-item class ${isAdmin ? "clickable" : ""}`}
        style={{
          borderLeftColor: color,
          borderLeft: `3px solid ${color}`,
          cursor: isAdmin ? "pointer" : "default",
        }}
        title={`${courseTitle} - ${timeSlot.startTime}-${timeSlot.endTime} @ ${
          schedule.location || "TBA"
        }`}
        onClick={() => isAdmin && openScheduleDetail(schedule)}
      >
        {courseTitle.length > 15
          ? courseTitle.substring(0, 15) + "..."
          : courseTitle}
      </div>
    );
  };

  function renderMonthView() {
    return (
      <div className="calendar-grid">
        <div className="calendar-header">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="calendar-day-header">
              {d}
            </div>
          ))}
        </div>
        <div className="calendar-days">
          {monthDays.map((day) => {
            const daySchedules = getSchedulesForDate(day);
            const today = isSameDay(day, new Date());
            const inMonth = isSameMonth(day, currentDate);
            const totalCount = daySchedules.length;

            return (
              <div
                key={day.toISOString()}
                className={`calendar-day ${today ? "today" : ""} ${
                  inMonth ? "" : "other-month"
                }`}
              >
                <div className="day-number">{safeFormatDate(day, "d")}</div>
                <div className="day-schedules">
                  {daySchedules
                    .slice(0, 3)
                    .map((schedule, i) => renderScheduleItem(schedule, i))}
                  {totalCount > 3 && (
                    <div className="more-items">+{totalCount - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderWeekView() {
    return (
      <div className="week-view">
        <div className="week-content">
          {weekDays.map((day) => {
            const daySchedules = getSchedulesForDate(day);
            const isToday = isSameDay(day, new Date());

            return (
              <div key={day.toISOString()} className="week-day-column">
                <div className="week-day-row">
                  <div className="week-day-label-mobile">
                    <div className="week-day-name">
                      {safeFormatDate(day, "EEE").toUpperCase()}
                    </div>
                    <div
                      className={`week-day-number ${isToday ? "today" : ""}`}
                    >
                      {safeFormatDate(day, "d")}
                    </div>
                  </div>
                  <div className="week-day-items">
                    {daySchedules.length === 0 ? (
                      <div
                        className="no-class-indicator"
                        style={{
                          color: "#9ca3af",
                          fontSize: "12px",
                          padding: "8px 0",
                        }}
                      >
                        No classes
                      </div>
                    ) : (
                      daySchedules.map((schedule, index) => {
                        const timeSlot = getTimeSlotInfo(schedule.timeSlotId);
                        const courseTitle = getCourseTitle(schedule.courseId);
                        const color = COLORS[index % COLORS.length];

                        return (
                          <div
                            key={schedule._id}
                            className={`week-schedule-item-compact ${
                              isAdmin ? "clickable" : ""
                            }`}
                            style={{
                              borderLeft: `3px solid ${color}`,
                              cursor: isAdmin ? "pointer" : "default",
                            }}
                            onClick={() =>
                              isAdmin && openScheduleDetail(schedule)
                            }
                          >
                            <div className="subject-code">{courseTitle}</div>
                            <div className="time-range">
                              {timeSlot.startTime} - {timeSlot.endTime}
                            </div>
                            {schedule.location && (
                              <div className="room-info">
                                📍 {schedule.location}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderDayView() {
    const day = currentDate;
    const daySchedules = getSchedulesForDate(day);

    return (
      <div className="day-view">
        <div className="day-header">
          <h2>{safeFormatDate(day, "EEEE, MMMM d, yyyy")}</h2>
        </div>
        <div className="day-schedule-list">
          {daySchedules.length === 0 ? (
            <div className="no-schedules">No classes scheduled for today</div>
          ) : (
            daySchedules.map((schedule, index) => {
              const timeSlot = getTimeSlotInfo(schedule.timeSlotId);
              const courseTitle = getCourseTitle(schedule.courseId);
              const teacherName = getTeacherName(schedule.teacherId);
              const color = COLORS[index % COLORS.length];

              return (
                <div
                  key={schedule._id}
                  className={`day-schedule-item class ${
                    isAdmin ? "clickable" : ""
                  }`}
                  style={{
                    borderLeftColor: color,
                    cursor: isAdmin ? "pointer" : "default",
                  }}
                  onClick={() => isAdmin && openScheduleDetail(schedule)}
                >
                  <div className="schedule-time">
                    {timeSlot.startTime}
                    <br />
                    <span style={{ fontSize: "10px", color: "#6b7280" }}>
                      {timeSlot.endTime}
                    </span>
                  </div>
                  <div className="schedule-content">
                    <div className="schedule-title">{courseTitle}</div>
                    <div className="schedule-location">
                      📍 {schedule.location || "Location TBA"}
                    </div>
                    <div
                      className="schedule-teacher"
                      style={{
                        fontSize: "12px",
                        color: "#9ca3af",
                        marginTop: "4px",
                      }}
                    >
                      👤 {teacherName}
                    </div>
                    <div style={{ marginTop: "6px" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          backgroundColor: getStatusColor(schedule.status),
                          color: "white",
                          textTransform: "uppercase",
                        }}
                      >
                        {schedule.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Today's schedule for sidebar
  const todaySchedules = getSchedulesForDate(new Date());

  // Get selected course name for display
  const selectedCourseName = useMemo(() => {
    if (!selectedCourseId) return "";
    const course = courses.find((c) => c._id === selectedCourseId);
    return course?.title || "Selected Course";
  }, [selectedCourseId, courses]);

  // Get selected teacher name for display
  const selectedTeacherName = useMemo(() => {
    if (!selectedTeacherId) return "";
    const teacher = teachers.find((t) => t._id === selectedTeacherId);
    return teacher?.fullname || teacher?.username || "Selected Teacher";
  }, [selectedTeacherId, teachers]);

  // Get current view description
  const getViewDescription = () => {
    switch (scheduleViewMode) {
      case "my-schedule":
        return "View your class schedules and manage your time";
      case "by-course":
        return `Viewing schedule for: ${selectedCourseName}`;
      case "by-teacher":
        return `Viewing schedule for teacher: ${selectedTeacherName}`;
      default:
        return "View class schedules";
    }
  };

  return (
    <>
      <Navbar />
      <Sidebar />
      <div
        className={`calendar-page${darkMode ? " dark" : ""}`}
        style={{ paddingTop: 72 }}
      >
        <div className="calendar-page-header">
          <div className="header-content">
            <h1>📅 Schedule Calendar</h1>
            <p>{getViewDescription()}</p>

            <div className="header-stats">
              <div className="stat-card">
                <div className="stat-number">{stats.totalClasses}</div>
                <div className="stat-label">Weekly Classes</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.courses}</div>
                <div className="stat-label">Courses</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">
                  {isAdmin ? pendingSchedules.length : stats.pendingRequests}
                </div>
                <div className="stat-label">Pending</div>
              </div>
            </div>
          </div>

          <div className="calendar-page-tabs">
            <button
              className={`tab-button ${view === "month" ? "active" : ""}`}
              onClick={() => setView("month")}
            >
              <i className="bi bi-calendar-month"></i> Month
            </button>
            <button
              className={`tab-button ${view === "week" ? "active" : ""}`}
              onClick={() => setView("week")}
            >
              <i className="bi bi-calendar-week"></i> Week
            </button>
            <button
              className={`tab-button ${view === "day" ? "active" : ""}`}
              onClick={() => setView("day")}
            >
              <i className="bi bi-calendar-day"></i> Day
            </button>
          </div>
        </div>

        <div className="calendar-page-content">
          <section className="calendar-section">
            <div className="calendar-container">
              {/* Schedule View Mode Toggle Row */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-start",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => handleScheduleViewModeChange("my-schedule")}
                    style={{
                      background:
                        scheduleViewMode === "my-schedule"
                          ? "#3b82f6"
                          : darkMode
                          ? "#374151"
                          : "#f1f5f9",
                      color:
                        scheduleViewMode === "my-schedule"
                          ? "white"
                          : darkMode
                          ? "#e5e7eb"
                          : "#374151",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 16px",
                      cursor: "pointer",
                      fontWeight: 500,
                      fontSize: "14px",
                      transition: "all 0.2s",
                    }}
                  >
                    <i className="bi bi-person"></i> My Schedule
                  </button>
                  <button
                    onClick={() => handleScheduleViewModeChange("by-course")}
                    style={{
                      background:
                        scheduleViewMode === "by-course"
                          ? "#3b82f6"
                          : darkMode
                          ? "#374151"
                          : "#f1f5f9",
                      color:
                        scheduleViewMode === "by-course"
                          ? "white"
                          : darkMode
                          ? "#e5e7eb"
                          : "#374151",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 16px",
                      cursor: "pointer",
                      fontWeight: 500,
                      fontSize: "14px",
                      transition: "all 0.2s",
                    }}
                  >
                    <i className="bi bi-book"></i> By Course
                  </button>
                  {/* By Teacher button - Admin only */}
                  {isAdmin && (
                    <button
                      onClick={() => handleScheduleViewModeChange("by-teacher")}
                      style={{
                        background:
                          scheduleViewMode === "by-teacher"
                            ? "#3b82f6"
                            : darkMode
                            ? "#374151"
                            : "#f1f5f9",
                        color:
                          scheduleViewMode === "by-teacher"
                            ? "white"
                            : darkMode
                            ? "#e5e7eb"
                            : "#374151",
                        border: "none",
                        borderRadius: "8px",
                        padding: "8px 16px",
                        cursor: "pointer",
                        fontWeight: 500,
                        fontSize: "14px",
                        transition: "all 0.2s",
                      }}
                    >
                      <i className="bi bi-person-badge"></i> By Teacher
                    </button>
                  )}
                </div>

                {/* Course Selector - shows when in by-course mode */}
                {scheduleViewMode === "by-course" && (
                  <div
                    ref={courseDropdownRef}
                    style={{ position: "relative", minWidth: "320px" }}
                  >
                    {/* Selected Course Display / Trigger Button */}
                    <div
                      onClick={() => setShowCourseDropdown(!showCourseDropdown)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "6px 14px",
                        borderRadius: "12px",
                        border: `2px solid ${
                          showCourseDropdown
                            ? "#3b82f6"
                            : darkMode
                            ? "#4b5563"
                            : "#e2e8f0"
                        }`,
                        background: darkMode ? "#1f2937" : "white",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: showCourseDropdown
                          ? "0 4px 12px rgba(59, 130, 246, 0.15)"
                          : "none",
                        height: "42px",
                        boxSizing: "border-box",
                      }}
                    >
                      {selectedCourseId ? (
                        <>
                          {/* Course Icon/Logo */}
                          {(() => {
                            const course = courses.find(
                              (c) => c._id === selectedCourseId
                            );
                            const colorIndex = courses.findIndex(
                              (c) => c._id === selectedCourseId
                            );
                            return course?.logo ? (
                              <img
                                src={course.logo}
                                alt={course.title}
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  borderRadius: "6px",
                                  objectFit: "cover",
                                  border: "2px solid #3b82f6",
                                  flexShrink: 0,
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  borderRadius: "6px",
                                  background: `linear-gradient(135deg, ${
                                    COLORS[colorIndex % COLORS.length] ||
                                    "#3b82f6"
                                  }, ${
                                    COLORS[(colorIndex + 2) % COLORS.length] ||
                                    "#8b5cf6"
                                  })`,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "white",
                                  fontWeight: 700,
                                  fontSize: "10px",
                                  flexShrink: 0,
                                }}
                              >
                                {course?.code?.substring(0, 3) ||
                                  course?.title.substring(0, 2).toUpperCase() ||
                                  "📚"}
                              </div>
                            );
                          })()}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: "13px",
                                color: darkMode ? "#f1f5f9" : "#1e293b",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {courses.find((c) => c._id === selectedCourseId)
                                ?.title || "Unknown Course"}
                            </div>
                            <div
                              style={{
                                fontSize: "11px",
                                color: darkMode ? "#94a3b8" : "#64748b",
                              }}
                            >
                              {courses.find((c) => c._id === selectedCourseId)
                                ?.code || "Course"}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "6px",
                              background: darkMode ? "#374151" : "#f1f5f9",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: darkMode ? "#9ca3af" : "#64748b",
                              fontSize: "14px",
                            }}
                          >
                            📚
                          </div>
                          <div
                            style={{
                              color: darkMode ? "#9ca3af" : "#64748b",
                              fontSize: "13px",
                            }}
                          >
                            Select a course...
                          </div>
                        </>
                      )}
                      <i
                        className={`bi bi-chevron-${
                          showCourseDropdown ? "up" : "down"
                        }`}
                        style={{
                          color: darkMode ? "#9ca3af" : "#64748b",
                          marginLeft: "auto",
                        }}
                      />
                    </div>

                    {/* Dropdown Menu */}
                    {showCourseDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 8px)",
                          left: 0,
                          right: 0,
                          background: darkMode ? "#1f2937" : "white",
                          borderRadius: "12px",
                          border: `1px solid ${
                            darkMode ? "#374151" : "#e2e8f0"
                          }`,
                          boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
                          zIndex: 1000,
                          maxHeight: "350px",
                          overflow: "hidden",
                        }}
                      >
                        {/* Search Input */}
                        <div
                          style={{
                            padding: "12px",
                            borderBottom: `1px solid ${
                              darkMode ? "#374151" : "#e2e8f0"
                            }`,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "8px 12px",
                              borderRadius: "8px",
                              background: darkMode ? "#374151" : "#f1f5f9",
                            }}
                          >
                            <i
                              className="bi bi-search"
                              style={{
                                color: darkMode ? "#9ca3af" : "#64748b",
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Search courses..."
                              value={courseSearchQuery}
                              onChange={(e) =>
                                setCourseSearchQuery(e.target.value)
                              }
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                border: "none",
                                background: "transparent",
                                outline: "none",
                                width: "100%",
                                color: darkMode ? "#f1f5f9" : "#1e293b",
                                fontSize: "14px",
                              }}
                            />
                            {courseSearchQuery && (
                              <i
                                className="bi bi-x-circle-fill"
                                style={{
                                  color: darkMode ? "#6b7280" : "#9ca3af",
                                  cursor: "pointer",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCourseSearchQuery("");
                                }}
                              />
                            )}
                          </div>
                        </div>

                        {/* Course List */}
                        <div style={{ maxHeight: "280px", overflowY: "auto" }}>
                          {filteredCourses.length === 0 ? (
                            <div
                              style={{
                                padding: "24px",
                                textAlign: "center",
                                color: darkMode ? "#9ca3af" : "#64748b",
                              }}
                            >
                              <i
                                className="bi bi-folder2-open"
                                style={{
                                  fontSize: "24px",
                                  marginBottom: "8px",
                                  display: "block",
                                }}
                              />
                              No courses found
                            </div>
                          ) : (
                            filteredCourses.map((course, index) => (
                              <div
                                key={course._id}
                                onClick={() => {
                                  handleCourseSelect(course._id);
                                  setShowCourseDropdown(false);
                                  setCourseSearchQuery("");
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                  padding: "12px 14px",
                                  cursor: "pointer",
                                  background:
                                    selectedCourseId === course._id
                                      ? darkMode
                                        ? "rgba(59, 130, 246, 0.2)"
                                        : "rgba(59, 130, 246, 0.1)"
                                      : "transparent",
                                  borderLeft:
                                    selectedCourseId === course._id
                                      ? "3px solid #3b82f6"
                                      : "3px solid transparent",
                                  transition: "all 0.15s",
                                }}
                                onMouseEnter={(e) => {
                                  if (selectedCourseId !== course._id) {
                                    e.currentTarget.style.background = darkMode
                                      ? "#374151"
                                      : "#f8fafc";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (selectedCourseId !== course._id) {
                                    e.currentTarget.style.background =
                                      "transparent";
                                  }
                                }}
                              >
                                {/* Course Logo */}
                                {course.logo ? (
                                  <img
                                    src={course.logo}
                                    alt={course.title}
                                    style={{
                                      width: "36px",
                                      height: "36px",
                                      borderRadius: "8px",
                                      objectFit: "cover",
                                      border:
                                        selectedCourseId === course._id
                                          ? "2px solid #3b82f6"
                                          : `2px solid ${
                                              darkMode ? "#374151" : "#e2e8f0"
                                            }`,
                                      flexShrink: 0,
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: "36px",
                                      height: "36px",
                                      borderRadius: "8px",
                                      background: `linear-gradient(135deg, ${
                                        COLORS[index % COLORS.length]
                                      }, ${
                                        COLORS[(index + 2) % COLORS.length]
                                      })`,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      color: "white",
                                      fontWeight: 700,
                                      fontSize: "12px",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {course.code?.substring(0, 3) ||
                                      course.title
                                        .substring(0, 2)
                                        .toUpperCase()}
                                  </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontWeight: 500,
                                      fontSize: "13px",
                                      color: darkMode ? "#f1f5f9" : "#1e293b",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {course.title}
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                      marginTop: "2px",
                                    }}
                                  >
                                    {course.code && (
                                      <span
                                        style={{
                                          fontSize: "11px",
                                          padding: "2px 6px",
                                          borderRadius: "4px",
                                          background: darkMode
                                            ? "#374151"
                                            : "#e2e8f0",
                                          color: darkMode
                                            ? "#94a3b8"
                                            : "#64748b",
                                        }}
                                      >
                                        {course.code}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {selectedCourseId === course._id && (
                                  <i
                                    className="bi bi-check-circle-fill"
                                    style={{
                                      color: "#3b82f6",
                                      fontSize: "16px",
                                    }}
                                  />
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Teacher Selector - shows when in by-teacher mode (Admin only) */}
                {scheduleViewMode === "by-teacher" && isAdmin && (
                  <div
                    ref={teacherDropdownRef}
                    style={{ position: "relative", minWidth: "320px" }}
                  >
                    {/* Selected Teacher Display / Trigger Button */}
                    <div
                      onClick={() =>
                        setShowTeacherDropdown(!showTeacherDropdown)
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "6px 14px",
                        borderRadius: "12px",
                        border: `2px solid ${
                          showTeacherDropdown
                            ? "#10b981"
                            : darkMode
                            ? "#4b5563"
                            : "#e2e8f0"
                        }`,
                        background: darkMode ? "#1f2937" : "white",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: showTeacherDropdown
                          ? "0 4px 12px rgba(16, 185, 129, 0.15)"
                          : "none",
                        height: "42px",
                        boxSizing: "border-box",
                      }}
                    >
                      {selectedTeacherId ? (
                        <>
                          {/* Teacher Avatar */}
                          {(() => {
                            const teacher = teachers.find(
                              (t) => t._id === selectedTeacherId
                            );
                            return teacher?.avatar_url ? (
                              <img
                                src={teacher.avatar_url}
                                alt={teacher.fullname || teacher.username}
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  borderRadius: "50%",
                                  objectFit: "cover",
                                  border: "2px solid #10b981",
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  borderRadius: "50%",
                                  background:
                                    "linear-gradient(135deg, #10b981, #059669)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "white",
                                  fontWeight: 700,
                                  fontSize: "10px",
                                  flexShrink: 0,
                                }}
                              >
                                {(teacher?.fullname || teacher?.username || "T")
                                  .substring(0, 2)
                                  .toUpperCase()}
                              </div>
                            );
                          })()}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: "13px",
                                color: darkMode ? "#f1f5f9" : "#1e293b",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {teachers.find((t) => t._id === selectedTeacherId)
                                ?.fullname ||
                                teachers.find(
                                  (t) => t._id === selectedTeacherId
                                )?.username ||
                                "Unknown"}
                            </div>
                            <div
                              style={{
                                fontSize: "11px",
                                color: darkMode ? "#94a3b8" : "#64748b",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <i
                                className="bi bi-envelope"
                                style={{ fontSize: "9px" }}
                              />
                              {teachers.find((t) => t._id === selectedTeacherId)
                                ?.email || ""}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                              background: darkMode ? "#374151" : "#f1f5f9",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: darkMode ? "#9ca3af" : "#64748b",
                              fontSize: "14px",
                            }}
                          >
                            👨‍🏫
                          </div>
                          <div
                            style={{
                              color: darkMode ? "#9ca3af" : "#64748b",
                              fontSize: "13px",
                            }}
                          >
                            Select a teacher...
                          </div>
                        </>
                      )}
                      <i
                        className={`bi bi-chevron-${
                          showTeacherDropdown ? "up" : "down"
                        }`}
                        style={{
                          color: darkMode ? "#9ca3af" : "#64748b",
                          marginLeft: "auto",
                        }}
                      />
                    </div>

                    {/* Dropdown Menu */}
                    {showTeacherDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 8px)",
                          left: 0,
                          right: 0,
                          background: darkMode ? "#1f2937" : "white",
                          borderRadius: "12px",
                          border: `1px solid ${
                            darkMode ? "#374151" : "#e2e8f0"
                          }`,
                          boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
                          zIndex: 1000,
                          maxHeight: "350px",
                          overflow: "hidden",
                        }}
                      >
                        {/* Search Input */}
                        <div
                          style={{
                            padding: "12px",
                            borderBottom: `1px solid ${
                              darkMode ? "#374151" : "#e2e8f0"
                            }`,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "8px 12px",
                              borderRadius: "8px",
                              background: darkMode ? "#374151" : "#f1f5f9",
                            }}
                          >
                            <i
                              className="bi bi-search"
                              style={{
                                color: darkMode ? "#9ca3af" : "#64748b",
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Search teachers..."
                              value={teacherSearchQuery}
                              onChange={(e) =>
                                setTeacherSearchQuery(e.target.value)
                              }
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                border: "none",
                                background: "transparent",
                                outline: "none",
                                width: "100%",
                                color: darkMode ? "#f1f5f9" : "#1e293b",
                                fontSize: "14px",
                              }}
                            />
                            {teacherSearchQuery && (
                              <i
                                className="bi bi-x-circle-fill"
                                style={{
                                  color: darkMode ? "#6b7280" : "#9ca3af",
                                  cursor: "pointer",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTeacherSearchQuery("");
                                }}
                              />
                            )}
                          </div>
                        </div>

                        {/* Teacher List */}
                        <div style={{ maxHeight: "280px", overflowY: "auto" }}>
                          {filteredTeachers.length === 0 ? (
                            <div
                              style={{
                                padding: "24px",
                                textAlign: "center",
                                color: darkMode ? "#9ca3af" : "#64748b",
                              }}
                            >
                              <i
                                className="bi bi-person-x"
                                style={{
                                  fontSize: "24px",
                                  marginBottom: "8px",
                                  display: "block",
                                }}
                              />
                              No teachers found
                            </div>
                          ) : (
                            filteredTeachers.map((teacher) => (
                              <div
                                key={teacher._id}
                                onClick={() => {
                                  handleTeacherSelect(teacher._id);
                                  setShowTeacherDropdown(false);
                                  setTeacherSearchQuery("");
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                  padding: "12px 14px",
                                  cursor: "pointer",
                                  background:
                                    selectedTeacherId === teacher._id
                                      ? darkMode
                                        ? "rgba(16, 185, 129, 0.2)"
                                        : "rgba(16, 185, 129, 0.1)"
                                      : "transparent",
                                  borderLeft:
                                    selectedTeacherId === teacher._id
                                      ? "3px solid #10b981"
                                      : "3px solid transparent",
                                  transition: "all 0.15s",
                                }}
                                onMouseEnter={(e) => {
                                  if (selectedTeacherId !== teacher._id) {
                                    e.currentTarget.style.background = darkMode
                                      ? "#374151"
                                      : "#f8fafc";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (selectedTeacherId !== teacher._id) {
                                    e.currentTarget.style.background =
                                      "transparent";
                                  }
                                }}
                              >
                                {/* Teacher Avatar */}
                                {teacher.avatar_url ? (
                                  <img
                                    src={teacher.avatar_url}
                                    alt={teacher.fullname || teacher.username}
                                    style={{
                                      width: "40px",
                                      height: "40px",
                                      borderRadius: "50%",
                                      objectFit: "cover",
                                      border:
                                        selectedTeacherId === teacher._id
                                          ? "2px solid #10b981"
                                          : `2px solid ${
                                              darkMode ? "#374151" : "#e2e8f0"
                                            }`,
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: "40px",
                                      height: "40px",
                                      borderRadius: "50%",
                                      background:
                                        selectedTeacherId === teacher._id
                                          ? "linear-gradient(135deg, #10b981, #059669)"
                                          : darkMode
                                          ? "#374151"
                                          : "#e2e8f0",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      color:
                                        selectedTeacherId === teacher._id
                                          ? "white"
                                          : darkMode
                                          ? "#9ca3af"
                                          : "#64748b",
                                      fontWeight: 600,
                                      fontSize: "14px",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {(
                                      teacher.fullname ||
                                      teacher.username ||
                                      "T"
                                    )
                                      .substring(0, 2)
                                      .toUpperCase()}
                                  </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontWeight: 500,
                                      fontSize: "13px",
                                      color: darkMode ? "#f1f5f9" : "#1e293b",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                    }}
                                  >
                                    {teacher.fullname || teacher.username}
                                    {teacher.isVerified && (
                                      <i
                                        className="bi bi-patch-check-fill"
                                        style={{
                                          color: "#3b82f6",
                                          fontSize: "12px",
                                        }}
                                      />
                                    )}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "11px",
                                      color: darkMode ? "#6b7280" : "#94a3b8",
                                      marginTop: "2px",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                  >
                                    <i
                                      className="bi bi-envelope"
                                      style={{ fontSize: "10px" }}
                                    />
                                    {teacher.email}
                                  </div>
                                  {/* Specializations */}
                                  {teacher.specialistIds &&
                                    teacher.specialistIds.length > 0 && (
                                      <div
                                        style={{
                                          display: "flex",
                                          flexWrap: "wrap",
                                          gap: "4px",
                                          marginTop: "4px",
                                        }}
                                      >
                                        {(
                                          teacher.specialistIds as unknown as Array<{
                                            name: string;
                                          }>
                                        )
                                          .slice(0, 2)
                                          .map((spec, idx) => (
                                            <span
                                              key={idx}
                                              style={{
                                                fontSize: "10px",
                                                padding: "1px 6px",
                                                borderRadius: "4px",
                                                background: darkMode
                                                  ? "#374151"
                                                  : "#f1f5f9",
                                                color: darkMode
                                                  ? "#94a3b8"
                                                  : "#64748b",
                                              }}
                                            >
                                              {typeof spec === "object"
                                                ? spec.name
                                                : spec}
                                            </span>
                                          ))}
                                        {teacher.specialistIds.length > 2 && (
                                          <span
                                            style={{
                                              fontSize: "10px",
                                              color: darkMode
                                                ? "#6b7280"
                                                : "#94a3b8",
                                            }}
                                          >
                                            +{teacher.specialistIds.length - 2}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                </div>
                                {selectedTeacherId === teacher._id && (
                                  <i
                                    className="bi bi-check-circle-fill"
                                    style={{
                                      color: "#10b981",
                                      fontSize: "16px",
                                    }}
                                  />
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div
                className="calendar-controls"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div className="calendar-navigation">
                  <button
                    onClick={handlePrev}
                    style={{
                      background: darkMode ? "#334155" : "#f1f5f9",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      cursor: "pointer",
                      color: darkMode ? "#f1f5f9" : "#1e293b",
                    }}
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={handleToday}
                    style={{
                      background: "#3b82f6",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 16px",
                      cursor: "pointer",
                      color: "white",
                      fontWeight: 600,
                    }}
                  >
                    Today
                  </button>
                  <h2>
                    {format(
                      currentDate,
                      view === "day" ? "MMMM d, yyyy" : "MMMM yyyy"
                    )}
                  </h2>
                  <button
                    onClick={handleNext}
                    style={{
                      background: darkMode ? "#334155" : "#f1f5f9",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      cursor: "pointer",
                      color: darkMode ? "#f1f5f9" : "#1e293b",
                    }}
                  >
                    Next →
                  </button>
                </div>

                {/* Action buttons for admin and teacher */}
                {canCreateSchedule && (
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      style={{
                        background: "#10b981",
                        border: "none",
                        borderRadius: "8px",
                        padding: "10px 20px",
                        cursor: "pointer",
                        color: "white",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <i className="bi bi-plus-circle"></i>{" "}
                      {isAdmin ? "Create Schedule" : "Request Schedule"}
                    </button>
                    {isAdmin && pendingSchedules.length > 0 && (
                      <button
                        onClick={() => {
                          setSelectedSchedule(pendingSchedules[0]);
                          setShowApprovalModal(true);
                        }}
                        style={{
                          background: "#f59e0b",
                          border: "none",
                          borderRadius: "8px",
                          padding: "10px 20px",
                          cursor: "pointer",
                          color: "white",
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <i className="bi bi-hourglass-split"></i> Review Pending
                        ({pendingSchedules.length})
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="calendar-content">
                {loading ? (
                  <div className="loading">Loading schedule...</div>
                ) : error ? (
                  <div className="no-schedules" style={{ color: "#ef4444" }}>
                    {error}
                  </div>
                ) : (
                  <>
                    {view === "month" && renderMonthView()}
                    {view === "week" && renderWeekView()}
                    {view === "day" && renderDayView()}
                  </>
                )}
              </div>
            </div>
          </section>

          <aside className="events-section quick-actions-sidebar">
            {/* Course List Section */}
            <div className="sidebar-section">
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                  }}
                >
                  📚
                </span>
                Browse by Course
              </h3>
              <div style={{ maxHeight: "220px", overflowY: "auto" }}>
                {courses.slice(0, 8).map((course, index) => (
                  <div
                    key={course._id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px",
                      cursor: "pointer",
                      borderRadius: "10px",
                      marginBottom: "6px",
                      background:
                        selectedCourseId === course._id
                          ? darkMode
                            ? "rgba(59, 130, 246, 0.2)"
                            : "rgba(59, 130, 246, 0.1)"
                          : "transparent",
                      border:
                        selectedCourseId === course._id
                          ? "1px solid rgba(59, 130, 246, 0.3)"
                          : "1px solid transparent",
                      transition: "all 0.2s",
                    }}
                    onClick={() => {
                      handleScheduleViewModeChange("by-course");
                      handleCourseSelect(course._id);
                    }}
                    onMouseEnter={(e) => {
                      if (selectedCourseId !== course._id) {
                        e.currentTarget.style.background = darkMode
                          ? "#374151"
                          : "#f8fafc";
                        e.currentTarget.style.border = `1px solid ${
                          darkMode ? "#4b5563" : "#e2e8f0"
                        }`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedCourseId !== course._id) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.border = "1px solid transparent";
                      }
                    }}
                  >
                    {/* Course Icon */}
                    {course.logo ? (
                      <img
                        src={course.logo}
                        alt={course.title}
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          objectFit: "cover",
                          border:
                            selectedCourseId === course._id
                              ? "2px solid #3b82f6"
                              : `2px solid ${darkMode ? "#374151" : "#e2e8f0"}`,
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          background: `linear-gradient(135deg, ${
                            COLORS[index % COLORS.length]
                          }, ${COLORS[(index + 2) % COLORS.length]})`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontWeight: 700,
                          fontSize: "11px",
                          flexShrink: 0,
                        }}
                      >
                        {course.code?.substring(0, 3) ||
                          course.title.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 500,
                          fontSize: "12px",
                          color:
                            selectedCourseId === course._id
                              ? darkMode
                                ? "#60a5fa"
                                : "#2563eb"
                              : darkMode
                              ? "#e5e7eb"
                              : "#374151",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {course.title}
                      </div>
                      {course.code && (
                        <div
                          style={{
                            fontSize: "10px",
                            color: darkMode ? "#6b7280" : "#94a3b8",
                            marginTop: "2px",
                          }}
                        >
                          {course.code}
                        </div>
                      )}
                    </div>
                    {selectedCourseId === course._id && (
                      <i
                        className="bi bi-check-circle-fill"
                        style={{ color: "#3b82f6", fontSize: "14px" }}
                      />
                    )}
                  </div>
                ))}
                {courses.length === 0 && (
                  <div
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      color: darkMode ? "#6b7280" : "#94a3b8",
                    }}
                  >
                    <i
                      className="bi bi-folder2-open"
                      style={{
                        fontSize: "20px",
                        marginBottom: "8px",
                        display: "block",
                      }}
                    />
                    No courses available
                  </div>
                )}
                {courses.length > 8 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "8px",
                      fontSize: "11px",
                      color: darkMode ? "#6b7280" : "#94a3b8",
                      background: darkMode ? "#1f2937" : "#f8fafc",
                      borderRadius: "6px",
                    }}
                  >
                    +{courses.length - 8} more courses
                  </div>
                )}
              </div>
            </div>

            {/* Browse by Teacher Section - Admin only */}
            {isAdmin && (
              <div className="sidebar-section">
                <h3
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                    }}
                  >
                    👨‍🏫
                  </span>
                  Browse by Teacher
                </h3>
                <div style={{ maxHeight: "220px", overflowY: "auto" }}>
                  {teachers.slice(0, 6).map((teacher) => (
                    <div
                      key={teacher._id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px",
                        cursor: "pointer",
                        borderRadius: "10px",
                        marginBottom: "6px",
                        background:
                          selectedTeacherId === teacher._id
                            ? darkMode
                              ? "rgba(16, 185, 129, 0.2)"
                              : "rgba(16, 185, 129, 0.1)"
                            : "transparent",
                        border:
                          selectedTeacherId === teacher._id
                            ? "1px solid rgba(16, 185, 129, 0.3)"
                            : "1px solid transparent",
                        transition: "all 0.2s",
                      }}
                      onClick={() => {
                        handleScheduleViewModeChange("by-teacher");
                        handleTeacherSelect(teacher._id);
                      }}
                      onMouseEnter={(e) => {
                        if (selectedTeacherId !== teacher._id) {
                          e.currentTarget.style.background = darkMode
                            ? "#374151"
                            : "#f8fafc";
                          e.currentTarget.style.border = `1px solid ${
                            darkMode ? "#4b5563" : "#e2e8f0"
                          }`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedTeacherId !== teacher._id) {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.border =
                            "1px solid transparent";
                        }
                      }}
                    >
                      {/* Teacher Avatar */}
                      {teacher.avatar_url ? (
                        <img
                          src={teacher.avatar_url}
                          alt={teacher.fullname || teacher.username}
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            objectFit: "cover",
                            border:
                              selectedTeacherId === teacher._id
                                ? "2px solid #10b981"
                                : `2px solid ${
                                    darkMode ? "#374151" : "#e2e8f0"
                                  }`,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            background:
                              selectedTeacherId === teacher._id
                                ? "linear-gradient(135deg, #10b981, #059669)"
                                : darkMode
                                ? "#374151"
                                : "#e2e8f0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color:
                              selectedTeacherId === teacher._id
                                ? "white"
                                : darkMode
                                ? "#9ca3af"
                                : "#64748b",
                            fontWeight: 600,
                            fontSize: "11px",
                            flexShrink: 0,
                          }}
                        >
                          {(teacher.fullname || teacher.username || "T")
                            .substring(0, 2)
                            .toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 500,
                            fontSize: "12px",
                            color:
                              selectedTeacherId === teacher._id
                                ? darkMode
                                  ? "#34d399"
                                  : "#059669"
                                : darkMode
                                ? "#e5e7eb"
                                : "#374151",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {teacher.fullname || teacher.username}
                          {teacher.isVerified && (
                            <i
                              className="bi bi-patch-check-fill"
                              style={{ color: "#3b82f6", fontSize: "10px" }}
                            />
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: "10px",
                            color: darkMode ? "#6b7280" : "#94a3b8",
                            marginTop: "2px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {teacher.email}
                        </div>
                      </div>
                      {selectedTeacherId === teacher._id && (
                        <i
                          className="bi bi-check-circle-fill"
                          style={{ color: "#10b981", fontSize: "14px" }}
                        />
                      )}
                    </div>
                  ))}
                  {teachers.length === 0 && (
                    <div
                      style={{
                        padding: "20px",
                        textAlign: "center",
                        color: darkMode ? "#6b7280" : "#94a3b8",
                      }}
                    >
                      <i
                        className="bi bi-person-x"
                        style={{
                          fontSize: "20px",
                          marginBottom: "8px",
                          display: "block",
                        }}
                      />
                      No teachers available
                    </div>
                  )}
                  {teachers.length > 6 && (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "8px",
                        fontSize: "11px",
                        color: darkMode ? "#6b7280" : "#94a3b8",
                        background: darkMode ? "#1f2937" : "#f8fafc",
                        borderRadius: "6px",
                      }}
                    >
                      +{teachers.length - 6} more teachers
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="sidebar-section">
              <h3>
                <i className="bi bi-clock"></i>
                Time Slots
              </h3>
              <div
                style={{
                  fontSize: "12px",
                  color: darkMode ? "#94a3b8" : "#64748b",
                }}
              >
                {timeSlots.map((slot) => (
                  <div
                    key={slot._id}
                    style={{
                      padding: "8px 0",
                      borderBottom: `1px solid ${
                        darkMode ? "#334155" : "#e2e8f0"
                      }`,
                    }}
                  >
                    <strong>{slot.slotName}</strong>
                    <br />
                    <span>
                      {slot.startTime} - {slot.endTime}
                    </span>
                  </div>
                ))}
                {timeSlots.length === 0 && (
                  <div style={{ fontStyle: "italic" }}>
                    No time slots available
                  </div>
                )}
              </div>
            </div>

            <div className="sidebar-section">
              <h3>
                <i className="bi bi-geo-alt"></i>
                Today's Classes
              </h3>
              <div className="today-schedule">
                {todaySchedules.map((schedule) => {
                  const timeSlot = getTimeSlotInfo(schedule.timeSlotId);
                  const courseTitle = getCourseTitle(schedule.courseId);

                  return (
                    <div key={schedule._id} className="event-item">
                      <div className="event-time">{timeSlot.startTime}</div>
                      <div className="event-details">
                        <div className="event-title">{courseTitle}</div>
                        <div className="event-location">
                          {schedule.location || "TBA"}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {todaySchedules.length === 0 && (
                  <div className="no-events">No classes today 🎉</div>
                )}
              </div>
            </div>

            <div className="sidebar-section">
              <h3>
                <i className="bi bi-info-circle"></i>
                Legend
              </h3>
              <div
                style={{
                  fontSize: "12px",
                  color: darkMode ? "#94a3b8" : "#64748b",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: "#10b981",
                    }}
                  ></span>
                  <span>Approved / Active</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: "#f59e0b",
                    }}
                  ></span>
                  <span>Pending Approval</span>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: "#ef4444",
                    }}
                  ></span>
                  <span>Rejected</span>
                </div>
              </div>
            </div>

            <div className="sidebar-section">
              <h3>
                <i className="bi bi-lightbulb"></i>
                Tips
              </h3>
              <div className="tips-list">
                <div className="tip-item">
                  <i className="bi bi-star-fill"></i>Use Week view for a clear
                  overview of your weekly schedule.
                </div>
                <div className="tip-item">
                  <i className="bi bi-star-fill"></i>Click on Month view to see
                  the entire month at a glance.
                </div>
                <div className="tip-item">
                  <i className="bi bi-star-fill"></i>Use the navigation buttons
                  to browse different dates.
                </div>
              </div>
            </div>

            {/* Admin Pending Requests Section */}
            {isAdmin && pendingSchedules.length > 0 && (
              <div className="sidebar-section">
                <h3>
                  <i className="bi bi-hourglass-split"></i>
                  Pending Requests
                </h3>
                <div className="pending-list">
                  {pendingSchedules.slice(0, 5).map((schedule) => {
                    const courseTitle = getCourseTitle(schedule.courseId);
                    const teacherName = getTeacherName(schedule.teacherId);

                    return (
                      <div
                        key={schedule._id}
                        className="pending-item"
                        style={{
                          padding: "10px",
                          marginBottom: "8px",
                          borderRadius: "8px",
                          background: darkMode ? "#374151" : "#fef3c7",
                          border: `1px solid ${
                            darkMode ? "#4b5563" : "#fcd34d"
                          }`,
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setSelectedSchedule(schedule);
                          setShowApprovalModal(true);
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "13px",
                            marginBottom: "4px",
                          }}
                        >
                          {courseTitle}
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: darkMode ? "#9ca3af" : "#92400e",
                          }}
                        >
                          {teacherName} • {schedule.dayOfWeek}
                        </div>
                        <div
                          style={{
                            fontSize: "10px",
                            color: darkMode ? "#6b7280" : "#b45309",
                            marginTop: "4px",
                          }}
                        >
                          Requested:{" "}
                          {safeFormatDate(schedule.requestedAt, "MMM d, yyyy")}
                        </div>
                      </div>
                    );
                  })}
                  {pendingSchedules.length > 5 && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: darkMode ? "#9ca3af" : "#6b7280",
                        textAlign: "center",
                      }}
                    >
                      +{pendingSchedules.length - 5} more pending...
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Create Schedule Modal */}
      {showCreateModal && (
        <div
          className={`modal-overlay ${darkMode ? "dark" : ""}`}
          onClick={() => setShowCreateModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Schedule</h2>
              <button
                className="modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-form">
              {actionError && (
                <div className="error-message">{actionError}</div>
              )}

              <div className="form-group">
                <label>Course *</label>
                <select
                  value={createForm.courseId}
                  onChange={(e) => {
                    const selectedCourseId = e.target.value;
                    const selectedCourse = courses.find(
                      (c) => c._id === selectedCourseId
                    );

                    // Auto-fill semester dates from the selected course
                    let effectiveFrom = format(new Date(), "yyyy-MM-dd");
                    let effectiveTo = "";

                    if (
                      selectedCourse?.semesterId &&
                      typeof selectedCourse.semesterId === "object"
                    ) {
                      const semester = selectedCourse.semesterId;
                      if (semester.startDate) {
                        effectiveFrom = format(
                          parseISO(semester.startDate),
                          "yyyy-MM-dd"
                        );
                      }
                      if (semester.endDate) {
                        effectiveTo = format(
                          parseISO(semester.endDate),
                          "yyyy-MM-dd"
                        );
                      }
                    } else if (selectedCourse?.startDate) {
                      // Fallback to course dates if semester not populated
                      effectiveFrom = format(
                        parseISO(selectedCourse.startDate),
                        "yyyy-MM-dd"
                      );
                      if (selectedCourse.endDate) {
                        effectiveTo = format(
                          parseISO(selectedCourse.endDate),
                          "yyyy-MM-dd"
                        );
                      }
                    }

                    setCreateForm({
                      ...createForm,
                      courseId: selectedCourseId,
                      effectiveFrom,
                      effectiveTo,
                    });
                  }}
                >
                  <option value="">Select a course</option>
                  {courses.map((course) => (
                    <option key={course._id} value={course._id}>
                      {course.title}
                      {course.semesterId &&
                      typeof course.semesterId === "object"
                        ? ` (${course.semesterId.name})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Multiple Day/Time Slot Selection */}
              <div className="form-group">
                <label>Schedule Slots * (Select days and time slots)</label>
                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    padding: "12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(148, 163, 184, 0.1)",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                  }}
                >
                  {(
                    [
                      "monday",
                      "tuesday",
                      "wednesday",
                      "thursday",
                      "friday",
                      "saturday",
                      "sunday",
                    ] as DayOfWeek[]
                  ).map((day) => {
                    const existingSlot = createForm.slots.find(
                      (s) => s.dayOfWeek === day
                    );
                    const isSelected = !!existingSlot;

                    return (
                      <div
                        key={day}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "8px",
                          borderRadius: "6px",
                          backgroundColor: isSelected
                            ? "rgba(99, 102, 241, 0.1)"
                            : "transparent",
                          border: isSelected
                            ? "1px solid rgba(99, 102, 241, 0.3)"
                            : "1px solid transparent",
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            minWidth: "120px",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                // Add day with empty timeSlotId
                                setCreateForm({
                                  ...createForm,
                                  slots: [
                                    ...createForm.slots,
                                    { dayOfWeek: day, timeSlotId: "" },
                                  ],
                                });
                              } else {
                                // Remove day
                                setCreateForm({
                                  ...createForm,
                                  slots: createForm.slots.filter(
                                    (s) => s.dayOfWeek !== day
                                  ),
                                });
                              }
                            }}
                            style={{ width: "18px", height: "18px" }}
                          />
                          <span
                            style={{
                              textTransform: "capitalize",
                              fontWeight: isSelected ? 500 : 400,
                            }}
                          >
                            {day}
                          </span>
                        </label>

                        {isSelected && (
                          <select
                            value={existingSlot?.timeSlotId || ""}
                            onChange={(e) => {
                              setCreateForm({
                                ...createForm,
                                slots: createForm.slots.map((s) =>
                                  s.dayOfWeek === day
                                    ? { ...s, timeSlotId: e.target.value }
                                    : s
                                ),
                              });
                            }}
                            style={{ flex: 1 }}
                          >
                            <option value="">Select time slot</option>
                            {timeSlots.map((slot) => (
                              <option key={slot._id} value={slot._id}>
                                {slot.slotName} ({slot.startTime} -{" "}
                                {slot.endTime})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
                {createForm.slots.length > 0 && (
                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "13px",
                      color: "#6366f1",
                    }}
                  >
                    {createForm.slots.length} day(s) selected
                  </div>
                )}
              </div>

              {/* Date range with semester constraints */}
              {(() => {
                const selectedCourse = courses.find(
                  (c) => c._id === createForm.courseId
                );
                const semester =
                  selectedCourse?.semesterId &&
                  typeof selectedCourse.semesterId === "object"
                    ? selectedCourse.semesterId
                    : null;
                const minDate = semester?.startDate
                  ? format(parseISO(semester.startDate), "yyyy-MM-dd")
                  : selectedCourse?.startDate
                  ? format(parseISO(selectedCourse.startDate), "yyyy-MM-dd")
                  : undefined;
                const maxDate = semester?.endDate
                  ? format(parseISO(semester.endDate), "yyyy-MM-dd")
                  : selectedCourse?.endDate
                  ? format(parseISO(selectedCourse.endDate), "yyyy-MM-dd")
                  : undefined;

                return (
                  <>
                    {semester && (
                      <div
                        className="form-info"
                        style={{
                          padding: "8px 12px",
                          marginBottom: "12px",
                          borderRadius: "6px",
                          backgroundColor: "rgba(99, 102, 241, 0.1)",
                          border: "1px solid rgba(99, 102, 241, 0.2)",
                          fontSize: "13px",
                        }}
                      >
                        <strong>Semester:</strong> {semester.name}
                        <span style={{ marginLeft: "8px", opacity: 0.8 }}>
                          (
                          {format(parseISO(semester.startDate), "MMM dd, yyyy")}{" "}
                          - {format(parseISO(semester.endDate), "MMM dd, yyyy")}
                          )
                        </span>
                      </div>
                    )}
                    <div className="form-row">
                      <div className="form-group">
                        <label>Effective From *</label>
                        <input
                          type="date"
                          value={createForm.effectiveFrom}
                          min={minDate}
                          max={maxDate}
                          onChange={(e) =>
                            setCreateForm({
                              ...createForm,
                              effectiveFrom: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label>Effective To</label>
                        <input
                          type="date"
                          value={createForm.effectiveTo}
                          min={createForm.effectiveFrom || minDate}
                          max={maxDate}
                          onChange={(e) =>
                            setCreateForm({
                              ...createForm,
                              effectiveTo: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </>
                );
              })()}

              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  placeholder="e.g., Room A101"
                  value={createForm.location}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, location: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Request Note</label>
                <textarea
                  placeholder="Add any notes about this schedule request..."
                  rows={3}
                  value={createForm.requestNote}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      requestNote: e.target.value,
                    })
                  }
                />
              </div>

              <div className="modal-actions">
                <div></div>
                <div className="btn-group">
                  <button
                    className="btn-secondary"
                    onClick={() => setShowCreateModal(false)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleCreateSchedule}
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Creating..." : "Create Schedule"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedSchedule && (
        <div
          className={`modal-overlay ${darkMode ? "dark" : ""}`}
          onClick={() => {
            setShowApprovalModal(false);
            setSelectedSchedule(null);
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Review Schedule Request</h2>
              <button
                className="modal-close"
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedSchedule(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {actionError && (
                <div className="error-message">{actionError}</div>
              )}

              <div className="detail-item">
                <span className="detail-label">Course:</span>
                <span className="detail-value">
                  {getCourseTitle(selectedSchedule.courseId)}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Teacher:</span>
                <span className="detail-value">
                  {getTeacherName(selectedSchedule.teacherId)}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Day:</span>
                <span
                  className="detail-value"
                  style={{ textTransform: "capitalize" }}
                >
                  {selectedSchedule.dayOfWeek}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Time Slot:</span>
                <span className="detail-value">
                  {(() => {
                    const slot = getTimeSlotInfo(selectedSchedule.timeSlotId);
                    return `${slot.slotName} (${slot.startTime} - ${slot.endTime})`;
                  })()}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Location:</span>
                <span className="detail-value">
                  {selectedSchedule.location || "Not specified"}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Effective From:</span>
                <span className="detail-value">
                  {safeFormatDate(
                    selectedSchedule.effectiveFrom,
                    "MMM d, yyyy"
                  )}
                </span>
              </div>

              {selectedSchedule.effectiveTo && (
                <div className="detail-item">
                  <span className="detail-label">Effective To:</span>
                  <span className="detail-value">
                    {safeFormatDate(
                      selectedSchedule.effectiveTo,
                      "MMM d, yyyy"
                    )}
                  </span>
                </div>
              )}

              {selectedSchedule.requestNote && (
                <div className="detail-note">
                  <strong>Request Note:</strong> {selectedSchedule.requestNote}
                </div>
              )}

              <div className="detail-item">
                <span className="detail-label">Status:</span>
                <span className="detail-value">
                  <span
                    className="status-badge"
                    style={{
                      backgroundColor: getStatusColor(selectedSchedule.status),
                      color: "white",
                      padding: "4px 12px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      textTransform: "uppercase",
                    }}
                  >
                    {selectedSchedule.status}
                  </span>
                </span>
              </div>
            </div>

            {selectedSchedule.status === "pending" && (
              <div
                className="modal-footer"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  padding: "16px 24px",
                  borderTop: `1px solid ${darkMode ? "#4b5563" : "#e5e7eb"}`,
                }}
              >
                <button
                  className="btn-delete"
                  onClick={() =>
                    handleApproveSchedule(
                      selectedSchedule._id,
                      false,
                      "Rejected by admin"
                    )
                  }
                  disabled={actionLoading}
                >
                  {actionLoading ? "Processing..." : "Reject"}
                </button>
                <button
                  className="btn-primary"
                  onClick={() =>
                    handleApproveSchedule(
                      selectedSchedule._id,
                      true,
                      "Approved by admin"
                    )
                  }
                  disabled={actionLoading}
                  style={{ background: "#10b981" }}
                >
                  {actionLoading ? "Processing..." : "Approve"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit/View Schedule Modal */}
      {showEditModal && selectedSchedule && (
        <div
          className={`modal-overlay ${darkMode ? "dark" : ""}`}
          onClick={() => {
            setShowEditModal(false);
            setSelectedSchedule(null);
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Schedule Details</h2>
              <button
                className="modal-close"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedSchedule(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-item">
                <span className="detail-label">Course:</span>
                <span className="detail-value">
                  {getCourseTitle(selectedSchedule.courseId)}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Teacher:</span>
                <span className="detail-value">
                  {getTeacherName(selectedSchedule.teacherId)}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Day:</span>
                <span
                  className="detail-value"
                  style={{ textTransform: "capitalize" }}
                >
                  {selectedSchedule.dayOfWeek}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Time Slot:</span>
                <span className="detail-value">
                  {(() => {
                    const slot = getTimeSlotInfo(selectedSchedule.timeSlotId);
                    return `${slot.slotName} (${slot.startTime} - ${slot.endTime})`;
                  })()}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Location:</span>
                <span className="detail-value">
                  {selectedSchedule.location || "Not specified"}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Status:</span>
                <span className="detail-value">
                  <span
                    style={{
                      backgroundColor: getStatusColor(selectedSchedule.status),
                      color: "white",
                      padding: "4px 12px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      textTransform: "uppercase",
                    }}
                  >
                    {selectedSchedule.status}
                  </span>
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Effective From:</span>
                <span className="detail-value">
                  {safeFormatDate(
                    selectedSchedule.effectiveFrom,
                    "MMM d, yyyy"
                  )}
                </span>
              </div>

              {selectedSchedule.effectiveTo && (
                <div className="detail-item">
                  <span className="detail-label">Effective To:</span>
                  <span className="detail-value">
                    {safeFormatDate(
                      selectedSchedule.effectiveTo,
                      "MMM d, yyyy"
                    )}
                  </span>
                </div>
              )}

              {selectedSchedule.approvedBy && (
                <div className="detail-item">
                  <span className="detail-label">Approved At:</span>
                  <span className="detail-value">
                    {safeFormatDate(
                      selectedSchedule.approvedAt,
                      "MMM d, yyyy HH:mm"
                    )}
                  </span>
                </div>
              )}
            </div>

            <div
              className="modal-footer"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                padding: "16px 24px",
                borderTop: `1px solid ${darkMode ? "#4b5563" : "#e5e7eb"}`,
              }}
            >
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedSchedule(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Calendar;
