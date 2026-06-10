import React, { useEffect, useState, useMemo } from "react";
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  parseISO,
  isWithinInterval,
  isSameDay,
} from "date-fns";
import { scheduleService } from "../../services/scheduleService";
import { attendanceService } from "../../services/attendanceService";
import type { AttendanceRecord } from "../../services/attendanceService";
import http from "../../utils/http";
import type { Schedule, TimeSlot, DayOfWeek } from "../../types/schedule";

interface StudentScheduleCalendarProps {
  darkMode: boolean;
}

interface Course {
  _id: string;
  title: string;
  code?: string;
}

interface ScheduleWithCourse extends Schedule {
  courseName?: string;
  courseCode?: string;
}

const DAYS_OF_WEEK: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Color palette for different courses
const COURSE_COLORS = [
  { bg: "#3b82f6", text: "#ffffff", accent: "#fbbf24" }, // Blue
  { bg: "#10b981", text: "#ffffff", accent: "#fbbf24" }, // Green
  { bg: "#8b5cf6", text: "#ffffff", accent: "#fbbf24" }, // Purple
  { bg: "#f59e0b", text: "#ffffff", accent: "#1e293b" }, // Amber
  { bg: "#ef4444", text: "#ffffff", accent: "#fbbf24" }, // Red
  { bg: "#06b6d4", text: "#ffffff", accent: "#fbbf24" }, // Cyan
  { bg: "#ec4899", text: "#ffffff", accent: "#fbbf24" }, // Pink
  { bg: "#84cc16", text: "#ffffff", accent: "#1e293b" }, // Lime
];

const StudentScheduleCalendar: React.FC<StudentScheduleCalendarProps> = ({
  darkMode,
}) => {
  const [schedules, setSchedules] = useState<ScheduleWithCourse[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseColorMap, setCourseColorMap] = useState<Record<string, typeof COURSE_COLORS[0]>>({});
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

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

  // Fetch enrolled courses and their schedules
  useEffect(() => {
    const fetchSchedules = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get student's enrolled courses
        const myCoursesResponse = await http.get("/courses/my-courses", {
          params: { page: 1, limit: 50, sortOrder: "desc" },
        });

        const coursesList: Course[] = Array.isArray(myCoursesResponse.data)
          ? myCoursesResponse.data
          : [];

        setCourses(coursesList);

        if (coursesList.length === 0) {
          setSchedules([]);
          setLoading(false);
          return;
        }

        // Create color map for courses
        const colorMap: Record<string, typeof COURSE_COLORS[0]> = {};
        coursesList.forEach((course, index) => {
          colorMap[course._id] = COURSE_COLORS[index % COURSE_COLORS.length];
        });
        setCourseColorMap(colorMap);

        // Fetch schedules for each course
        const schedulePromises = coursesList.map(async (course) => {
          try {
            const courseSchedules = await scheduleService.getCourseSchedule(
              course._id,
              "approved"
            );
            return courseSchedules.map((schedule) => ({
              ...schedule,
              courseName: course.title,
              courseCode: course.code,
            }));
          } catch (err) {
            console.error(`Failed to fetch schedule for course ${course._id}:`, err);
            return [];
          }
        });

        const allSchedules = await Promise.all(schedulePromises);
        const flattenedSchedules = allSchedules.flat();
        setSchedules(flattenedSchedules);
      } catch (err) {
        console.error("Failed to fetch schedules:", err);
        setError(err instanceof Error ? err.message : "Failed to load schedules");
      } finally {
        setLoading(false);
      }
    };

    fetchSchedules();
  }, []);

  // Fetch attendance records for current user using /self endpoint
  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const result = await attendanceService.getSelfAttendance({
          limit: 200, // Get enough records to cover the calendar
        });
        setAttendanceRecords(result.data || []);
      } catch (err) {
        console.error("Failed to fetch self attendance:", err);
      }
    };

    fetchAttendance();
  }, []);

  // Get time slot by ID
  const getTimeSlot = (timeSlotId: string | TimeSlot): TimeSlot | undefined => {
    if (typeof timeSlotId === "object" && timeSlotId !== null) {
      return timeSlotId as TimeSlot;
    }
    return timeSlots.find((slot) => slot._id === timeSlotId);
  };

  // Get course ID from schedule
  const getCourseId = (schedule: ScheduleWithCourse): string => {
    if (typeof schedule.courseId === "string") {
      return schedule.courseId;
    }
    return schedule.courseId._id;
  };

  // Get teacher name from schedule
  const getTeacherName = (schedule: ScheduleWithCourse): string | null => {
    if (typeof schedule.teacherId === "object" && schedule.teacherId !== null) {
      return schedule.teacherId.fullname || schedule.teacherId.email || null;
    }
    return null;
  };

  // Get attendance status for a specific date and course
  const getAttendanceForDateAndCourse = (
    date: Date,
    courseId: string
  ): AttendanceRecord | undefined => {
    return attendanceRecords.find((record) => {
      const recordCourseId =
        typeof record.courseId === "object" ? record?.courseId?._id : record?.courseId;
      const recordDate = parseISO(record.date);
      return recordCourseId === courseId && isSameDay(recordDate, date);
    });
  };

  // Get attendance status color and label
  const getAttendanceDisplay = (status: string) => {
    switch (status) {
      case "present":
        return { color: "#22c55e", bgColor: "rgba(34, 197, 94, 0.2)", label: "Present", icon: "✓" };
      case "absent":
        return { color: "#ef4444", bgColor: "rgba(239, 68, 68, 0.2)", label: "Absent", icon: "✗" };
      case "notyet":
      default:
        return { color: "#6b7280", bgColor: "rgba(107, 114, 128, 0.2)", label: "Not Yet", icon: "?" };
    }
  };

  // Filter active schedules for the current week
  const activeSchedules = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);

    return schedules.filter((schedule) => {
      const effectiveFrom = parseISO(schedule.effectiveFrom);
      const effectiveTo = schedule.effectiveTo
        ? parseISO(schedule.effectiveTo)
        : new Date("2099-12-31");

      return (
        isWithinInterval(weekStart, { start: effectiveFrom, end: effectiveTo }) ||
        isWithinInterval(weekEnd, { start: effectiveFrom, end: effectiveTo }) ||
        (effectiveFrom <= weekStart && effectiveTo >= weekEnd)
      );
    });
  }, [schedules, currentDate]);

  // Sort time slots by order
  const sortedTimeSlots = useMemo(() => {
    return [...timeSlots].sort((a, b) => a.order - b.order);
  }, [timeSlots]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

  const handlePrev = () => {
    setCurrentDate((prev) => addWeeks(prev, -1));
  };

  const handleNext = () => {
    setCurrentDate((prev) => addWeeks(prev, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Get schedule for a specific day and time slot
  const getScheduleForSlot = (
    day: DayOfWeek,
    slotId: string
  ): ScheduleWithCourse | undefined => {
    return activeSchedules.find((schedule) => {
      const scheduleSlotId =
        typeof schedule.timeSlotId === "string"
          ? schedule.timeSlotId
          : (schedule.timeSlotId as TimeSlot)?._id;

      return (
        schedule.dayOfWeek.toLowerCase() === day && scheduleSlotId === slotId
      );
    });
  };

  if (loading) {
    return (
      <div
        className="rounded-2xl shadow-lg p-6"
        style={{
          backgroundColor: darkMode ? "rgba(26, 32, 44, 0.8)" : "rgba(255, 255, 255, 0.9)",
          border: darkMode ? "1px solid rgba(148, 163, 184, 0.1)" : "1px solid rgba(148, 163, 184, 0.1)",
        }}
      >
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3" style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}>
            Loading schedule...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-2xl shadow-lg p-6"
        style={{
          backgroundColor: darkMode ? "rgba(26, 32, 44, 0.8)" : "rgba(255, 255, 255, 0.9)",
          border: darkMode ? "1px solid rgba(148, 163, 184, 0.1)" : "1px solid rgba(148, 163, 184, 0.1)",
        }}
      >
        <div
          className="text-center py-12"
          style={{ color: darkMode ? "#f87171" : "#dc2626" }}
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl shadow-lg overflow-hidden"
      style={{
        backgroundColor: darkMode ? "rgba(26, 32, 44, 0.8)" : "rgba(255, 255, 255, 0.9)",
        border: darkMode ? "1px solid rgba(148, 163, 184, 0.1)" : "1px solid rgba(148, 163, 184, 0.1)",
      }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 border-b flex items-center justify-between flex-wrap gap-3"
        style={{
          borderColor: darkMode ? "rgba(75, 85, 99, 0.2)" : "rgba(229, 231, 235, 0.5)",
        }}
      >
        <h2
          className="text-lg font-semibold flex items-center gap-2"
          style={{ color: darkMode ? "#ffffff" : "#1e293b" }}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          My Schedule
        </h2>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="px-3 py-1.5 rounded-lg transition-colors text-sm"
            style={{
              background: darkMode ? "#374151" : "#f1f5f9",
              color: darkMode ? "#e5e7eb" : "#374151",
            }}
          >
            ←
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1.5 rounded-lg font-medium transition-colors text-sm"
            style={{
              background: "#3b82f6",
              color: "white",
            }}
          >
            Today
          </button>
          <button
            onClick={handleNext}
            className="px-3 py-1.5 rounded-lg transition-colors text-sm"
            style={{
              background: darkMode ? "#374151" : "#f1f5f9",
              color: darkMode ? "#e5e7eb" : "#374151",
            }}
          >
            →
          </button>
        </div>

        {/* Current Week Display */}
        <div
          className="text-sm font-medium"
          style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
        >
          Week of {format(weekStart, "MMM d, yyyy")}
        </div>
      </div>

      {/* Schedule Table */}
      <div className="p-4 overflow-x-auto">
        {schedules.length === 0 ? (
          <div
            className="text-center py-12 rounded-lg"
            style={{
              background: darkMode ? "#1e293b" : "#f8fafc",
              color: darkMode ? "#9ca3af" : "#6b7280",
            }}
          >
            <svg
              className="w-12 h-12 mx-auto mb-3 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p>No schedule found.</p>
            <p className="text-sm mt-1">Enroll in courses to see your schedule.</p>
          </div>
        ) : (
          <table
            className="w-full border-collapse"
            style={{
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <thead>
              <tr>
                {/* Slot column header */}
                <th
                  className="p-2 text-center font-semibold text-sm"
                  style={{
                    background: darkMode ? "#1e293b" : "#f1f5f9",
                    color: darkMode ? "#e5e7eb" : "#374151",
                    borderBottom: `1px solid ${darkMode ? "#374151" : "#e2e8f0"}`,
                    borderRight: `1px solid ${darkMode ? "#374151" : "#e2e8f0"}`,
                    minWidth: "70px",
                  }}
                >
                  Slot
                </th>
                {/* Day columns */}
                {DAYS_OF_WEEK.map((day, index) => {
                  const dayDate = addDays(weekStart, index);
                  const isToday = isSameDay(new Date(), dayDate);
                  return (
                    <th
                      key={day}
                      className="p-2 text-center font-semibold text-sm"
                      style={{
                        background: isToday
                          ? "#3b82f6"
                          : darkMode
                          ? "#1e293b"
                          : "#f1f5f9",
                        color: isToday ? "white" : darkMode ? "#e5e7eb" : "#374151",
                        borderBottom: `1px solid ${darkMode ? "#374151" : "#e2e8f0"}`,
                        borderRight:
                          index < 6 ? `1px solid ${darkMode ? "#374151" : "#e2e8f0"}` : "none",
                        minWidth: "100px",
                      }}
                    >
                      <div className="capitalize">{DAY_LABELS[index]}</div>
                      <div className="text-xs font-normal opacity-75">
                        {format(dayDate, "dd/MM")}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedTimeSlots.map((slot, slotIndex) => (
                <tr key={slot._id}>
                  {/* Time slot label */}
                  <td
                    className="p-2 text-center"
                    style={{
                      background: darkMode ? "#1e293b" : "#f8fafc",
                      borderBottom: `1px solid ${darkMode ? "#374151" : "#e2e8f0"}`,
                      borderRight: `1px solid ${darkMode ? "#374151" : "#e2e8f0"}`,
                    }}
                  >
                    <div
                      className="font-medium text-sm"
                      style={{ color: darkMode ? "#e5e7eb" : "#374151" }}
                    >
                      Slot {slotIndex + 1}
                    </div>
                  </td>
                  {/* Day cells */}
                  {DAYS_OF_WEEK.map((day, dayIndex) => {
                    const schedule = getScheduleForSlot(day, slot._id);
                    const dayDate = addDays(weekStart, dayIndex);
                    const isToday = isSameDay(new Date(), dayDate);
                    const isPast = dayDate < new Date() && !isToday;
                    const courseId = schedule ? getCourseId(schedule) : null;
                    const colors = courseId ? courseColorMap[courseId] : null;
                    
                    // Get attendance for this slot
                    const attendance = courseId ? getAttendanceForDateAndCourse(dayDate, courseId) : null;
                    const attendanceDisplay = attendance ? getAttendanceDisplay(attendance.status) : null;

                    return (
                      <td
                        key={`${day}-${slot._id}`}
                        className="p-1 text-center align-middle"
                        style={{
                          background: isToday
                            ? "rgba(59, 130, 246, 0.05)"
                            : darkMode
                            ? "#0f172a"
                            : "#ffffff",
                          borderBottom: `1px solid ${darkMode ? "#374151" : "#e2e8f0"}`,
                          borderRight:
                            dayIndex < 6 ? `1px solid ${darkMode ? "#374151" : "#e2e8f0"}` : "none",
                          height: "110px",
                        }}
                      >
                        {schedule ? (
                          <div
                            className="p-2 rounded-lg text-xs mx-auto cursor-pointer hover:opacity-80 transition-opacity relative text-left"
                            style={{
                              color: darkMode ? "#e5e7eb" : "#374151",
                              maxWidth: "140px",
                            }}
                            onClick={() => {
                              window.location.href = `/courses/${courseId}`;
                            }}
                            title={`Click to view ${schedule.courseName || "course"}`}
                          >
                            {/* Course Code/Name */}
                            <div className="font-bold truncate" style={{ color: colors?.bg || "#3b82f6" }}>
                              {schedule.courseCode || schedule.courseName || "Class"}
                            </div>
                            {/* Teacher Name */}
                            {getTeacherName(schedule) && (
                              <div className="mt-0.5 opacity-90 flex items-center justify-start gap-1 truncate">
                                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span className="truncate">{getTeacherName(schedule)}</span>
                              </div>
                            )}
                            {/* Location */}
                            <div className="mt-0.5 opacity-90 flex items-center justify-start gap-1">
                              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="truncate">{schedule.location || "TBD"}</span>
                            </div>
                            {/* Time */}
                            <div
                              className="mt-1 font-medium"
                              style={{ color: colors?.bg || "#3b82f6" }}
                            >
                              ({slot.startTime}-{slot.endTime})
                            </div>
                            {/* Attendance Status Badge - only show for past or today */}
                            {(isPast || isToday) && (
                              <div
                                className="mt-1.5 py-0.5 px-1.5 rounded text-xs font-bold inline-flex items-center gap-1"
                                style={{
                                  background: attendanceDisplay?.bgColor || "rgba(107, 114, 128, 0.2)",
                                  color: attendanceDisplay?.color || "#6b7280",
                                }}
                                title={`Attendance: ${attendanceDisplay?.label || "Not Yet"}`}
                              >
                                <span>{attendanceDisplay?.icon || "?"}</span>
                                <span>{attendanceDisplay?.label || "Not Yet"}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span
                            className="text-xs"
                            style={{ color: darkMode ? "#4b5563" : "#d1d5db" }}
                          >
                            -
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Legend */}
        {courses.length > 0 && schedules.length > 0 && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: darkMode ? "#374151" : "#e2e8f0" }}>
            <div className="flex flex-wrap justify-between gap-4">
              {/* Courses Legend */}
              <div>
                <div
                  className="text-xs font-medium mb-2"
                  style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                >
                  Courses:
                </div>
                <div className="flex flex-wrap gap-2">
                  {courses.map((course) => {
                    const colors = courseColorMap[course._id];
                    // Check if this course has any schedule
                    const hasSchedule = schedules.some(
                      (s) => getCourseId(s) === course._id
                    );
                    if (!hasSchedule) return null;

                    return (
                      <div
                        key={course._id}
                        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
                        style={{
                          background: colors?.bg || "#3b82f6",
                          color: colors?.text || "white",
                        }}
                      >
                        <span className="font-medium">{course.code || course.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Attendance Legend */}
              <div>
                <div
                  className="text-xs font-medium mb-2"
                  style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                >
                  Attendance:
                </div>
                <div className="flex flex-wrap gap-2">
                  <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
                    style={{
                      background: "rgba(34, 197, 94, 0.2)",
                      color: "#22c55e",
                    }}
                  >
                    <span>✓</span>
                    <span>Present</span>
                  </div>
                  <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
                    style={{
                      background: "rgba(239, 68, 68, 0.2)",
                      color: "#ef4444",
                    }}
                  >
                    <span>✗</span>
                    <span>Absent</span>
                  </div>
                  <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
                    style={{
                      background: "rgba(107, 114, 128, 0.2)",
                      color: "#6b7280",
                    }}
                  >
                    <span>?</span>
                    <span>Not Yet</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentScheduleCalendar;
