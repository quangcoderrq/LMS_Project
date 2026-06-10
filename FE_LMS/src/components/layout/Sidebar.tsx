import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTheme } from "../../hooks/useTheme";
import { Link } from "react-router-dom";
import { authService } from "../../services";
import { useUnreadChat } from "../../hooks/useUnreadChat";
import { useSidebar } from "../../context/SidebarContext";
import { useSocketContext } from "../../context/SocketContext";

interface SidebarProps {
  isOpen?: boolean;
  role?: "admin" | "teacher" | "student";
  userInfo?: {
    name: string;
    email: string;
    avatar?: string;
  };
  variant?: "desktop" | "mobile";
  onClose?: () => void;
  forceExpanded?: boolean;
  mobileView?: boolean;
}

interface MenuItem {
  href: string;
  icon: ReactNode;
  label: string;
}

const getMenuItems = (
  role: "admin" | "teacher" | "student",
  isUnread: boolean
): MenuItem[] => {
  const baseItems: MenuItem[] = [
    {
      href: role === "admin" ? "/dashboard" : `/${role}-dashboard`,
      icon: (
        <svg
          className="w-5 h-5 min-w-[1.25rem]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          ></path>
        </svg>
      ),
      label: "Dashboard",
    },
    {
      href: "/courses",
      icon: (
        <svg
          className="w-5 h-5 min-w-[1.25rem]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          ></path>
        </svg>
      ),
      label: "All Courses",
    },
  ];

  baseItems.push(
    {
      href: "/quizz",
      icon: (
        <svg
          className="w-5 h-5 min-w-[1.25rem]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          ></path>
        </svg>
      ),
      label: "Quiz",
    },
    {
      href: "/forum-list",
      icon: (
        <svg
          className="w-5 h-5 min-w-[1.25rem]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          ></path>
        </svg>
      ),
      label: "Forum",
    },
    {
      href: "/chat-rooms",
      icon: (
        <div className="relative">
          <svg
            className="w-5 h-5 min-w-[1.25rem]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeWidth={2}
              d="M12.005 10.5h.008m3.987 0h.009m-8 0h.009"
            />
            <path
              strokeWidth={1.5}
              d="M2 10.5c0-.77.013-1.523.04-2.25c.083-2.373.125-3.56 1.09-4.533c.965-.972 2.186-1.024 4.626-1.129A100 100 0 0 1 12 2.5c1.48 0 2.905.03 4.244.088c2.44.105 3.66.157 4.626 1.13c.965.972 1.007 2.159 1.09 4.532a64 64 0 0 1 0 4.5c-.083 2.373-.125 3.56-1.09 4.533c-.965.972-2.186 1.024-4.626 1.129q-1.102.047-2.275.07c-.74.014-1.111.02-1.437.145s-.6.358-1.148.828l-2.179 1.87A.73.73 0 0 1 8 20.77v-2.348l-.244-.01c-2.44-.105-3.66-.157-4.626-1.13c-.965-.972-1.007-2.159-1.09-4.532A64 64 0 0 1 2 10.5"
            />
          </svg>
          {isUnread && (
            <>
              <span className="absolute top-0 right-0 size-2.5 bg-red-500 rounded-full animate-ping"></span>
              <span className="absolute top-0 right-0 bg-red-600 rounded-full size-2 "></span>
            </>
          )}
        </div>
      ),
      label: "Chat Rooms",
    }
  );

  if (role === "admin") {
    return [
      ...baseItems,
      {
        href: "/curriculum",
        icon: (
          <svg
            className="w-5 h-5 min-w-[1.25rem]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            ></path>
          </svg>
        ),
        label: "Curriculum",
      },
      {
        href: "/questionbank",
        icon: (
          <svg
            className="w-5 h-5 min-w-[1.25rem]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
        ),
        label: "Questions Bank",
      },
      {
        href: "/calendar",
        icon: (
          <svg
            className="w-5 h-5 min-w-[1.25rem]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            ></path>
          </svg>
        ),
        label: "Weekly Timetable",
      },
      {
        href: "/user",
        icon: (
          <svg
            className="w-5 h-5 min-w-[1.25rem]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            ></path>
          </svg>
        ),
        label: "Manage Users",
      },
      {
        href: "/enrollments-list",
        icon: (
          <svg
            className="w-5 h-5 min-w-[1.25rem]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            ></path>
          </svg>
        ),
        label: "Enrollments",
      },
      {
        href: "/attendance",
        icon: (
          <svg
            className="w-5 h-5 min-w-[1.25rem]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
        ),
        label: "Attendance",
      },
    ];
  }

  if (role === "teacher") {
    return [
      ...baseItems,
      {
        href: "/questionbank",
        icon: (
          <svg
            className="w-5 h-5 min-w-[1.25rem]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
        ),
        label: "Questions Bank",
      },
      {
        href: "/grading",
        icon: (
          <svg
            className="w-5 h-5 min-w-[1.25rem]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            ></path>
          </svg>
        ),
        label: "Grading",
      },
      {
        href: "/my-courses",
        icon: (
          <svg
            className="w-5 h-5 min-w-[1.25rem]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            ></path>
          </svg>
        ),
        label: "My Courses",
      },
      {
        href: "/enrollments-list",
        icon: (
          <svg
            className="w-5 h-5 min-w-[1.25rem]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            ></path>
          </svg>
        ),
        label: "Enrollments",
      },
      {
        href: "/attendance",
        icon: (
          <svg
            className="w-5 h-5 min-w-[1.25rem]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            ></path>
          </svg>
        ),
        label: "Attendance",
      },
      {
        href: "/calendar",
        icon: (
          <svg
            className="w-5 h-5 min-w-[1.25rem]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            ></path>
          </svg>
        ),
        label: "Weekly Timetable",
      },
      {
        href: "/students",
        icon: (
          <svg
            className="w-5 h-5 min-w-[1.25rem]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            ></path>
          </svg>
        ),
        label: "Students",
      },
    ];
  }

  if (role === "student") {
    return [
      ...baseItems,
      {
        href: "/my-enrollments",
        icon: (
          <svg
            className="w-5 h-5 min-w-[1.25rem]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            ></path>
          </svg>
        ),
        label: "My Enrollments",
      },
      {
        href: "/grades",
        icon: (
          <svg
            className="w-5 h-5 min-w-[1.25rem]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
            ></path>
          </svg>
        ),
        label: "Grades",
      },
      {
        href: "/my-courses",
        icon: (
          <svg
            className="w-5 h-5 min-w-[1.25rem]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            ></path>
          </svg>
        ),
        label: "My Courses",
      },
    ];
  }

  return baseItems;
};

export default function Sidebar({
  isOpen = true,
  role = "admin",
  userInfo,
  variant = "desktop",
  onClose,
  forceExpanded,
  mobileView,
}: SidebarProps) {
  const { darkMode } = useTheme();
  const { isSidebarOpen, toggleSidebar } = useSidebar();
  const { isUnread } = useUnreadChat();
  const menuItems = getMenuItems(role, isUnread);
  const feedbackLink = "/help/feedback-list";
  const [isExpanded, setIsExpanded] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [closingSubmenu, setClosingSubmenu] = useState<string | null>(null);
  const [animatingOut, setAnimatingOut] = useState(false);
  const helpRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const coursesRef = useRef<HTMLDivElement | null>(null);
  const [helpHeight, setHelpHeight] = useState(0);
  const [settingsHeight, setSettingsHeight] = useState(0);
  const [coursesHeight, setCoursesHeight] = useState(0);
  const [mobileCoursesOpen, setMobileCoursesOpen] = useState(false);
  const { disconnectSocket } = useSocketContext();

  const [storedUser, setStoredUser] = useState<null | {
    _id?: string;
    username?: string;
    fullname?: string;
    email?: string;
    role?: string;
    avatar?: string;
  }>(null);

  useEffect(() => {
    if (animatingOut) {
      const timer = setTimeout(() => {
        setAnimatingOut(false);
        setClosingSubmenu(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [animatingOut]);

  useEffect(() => {
    const updateHeights = () => {
      if (helpRef.current) setHelpHeight(helpRef.current.scrollHeight);
      if (settingsRef.current)
        setSettingsHeight(settingsRef.current.scrollHeight);
      if (coursesRef.current) setCoursesHeight(coursesRef.current.scrollHeight);
    };
    updateHeights();
    window.addEventListener("resize", updateHeights);
    return () => window.removeEventListener("resize", updateHeights);
  }, [isExpanded, openSubmenu]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("lms:user");
      if (raw) {
        const parsed = JSON.parse(raw);
        setStoredUser(parsed);
      }
    } catch (error) {
      console.warn("Unable to parse stored user info", error);
    }
  }, []);

  const handleMouseEnter = () => {
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    //close submenu after mouse leave
    if (openSubmenu !== null) {
      setAnimatingOut(true);
      setClosingSubmenu(openSubmenu);
      setOpenSubmenu(null);
    }
    setIsExpanded(false);
  };

  const toggleSubmenu = (menuName: string) => {
    if (openSubmenu === menuName) {
      setAnimatingOut(true);
      setClosingSubmenu(openSubmenu);
      setOpenSubmenu(null);
    } else {
      setOpenSubmenu(menuName);
      setAnimatingOut(false);
    }
  };

  if (!isOpen) return null;

  const defaultUserInfo = {
    name: role,
    email: `${role}@fpt.edu.vn`,
    avatar: "https://admin.toandz.id.vn/placeholder/img/14.jpg",
  };

  const user = userInfo || {
    name: storedUser?.fullname || storedUser?.username || defaultUserInfo.name,
    email: storedUser?.email || defaultUserInfo.email,
    avatar: storedUser?.avatar || defaultUserInfo.avatar,
  };
  const roleColors = {
    admin: "rgba(168, 85, 247, 0.7)",
    teacher: "rgba(59, 130, 246, 0.7)",
    student: "rgba(34, 197, 94, 0.7)",
  };
  const effectiveRole =
    (storedUser?.role as "admin" | "teacher" | "student") || role;

  if (variant === "mobile") {
    return (
      <div className="fixed inset-0 z-[150] md:hidden">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div
          className="absolute left-0 top-0 h-full w-72 max-w-[85vw] shadow-2xl flex flex-col"
          style={{
            backgroundColor: darkMode ? "rgba(15,23,42,0.95)" : "#ffffff",
            color: darkMode ? "#f1f5f9" : "#0f172a",
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-4 border-b"
            style={{
              borderColor: darkMode
                ? "rgba(148,163,184,0.15)"
                : "rgba(148,163,184,0.2)",
            }}
          >
            <div className="flex items-center gap-3">
              <img
                className="object-cover w-10 h-10 rounded-xl"
                src={user.avatar}
                alt="Profile"
              />
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{user.name}</span>
                <span className="text-xs opacity-75">{user.email}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 transition-colors rounded-lg"
              style={{
                backgroundColor: darkMode ? "rgba(71,85,105,0.35)" : "#eff6ff",
                color: darkMode ? "#e2e8f0" : "#1e3a8a",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="flex-1 px-4 py-5 space-y-5 overflow-y-auto">
            <nav className="space-y-1">
              {menuItems.map((item, index) => {
                // For teacher/admin on mobile, show All Courses section with collapsible submenu
                if (item.href === "/courses" && effectiveRole !== "student") {
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center">
                        <Link
                          to="/courses"
                          onClick={onClose}
                          className="flex items-center flex-1 gap-3 px-3 py-2 text-sm font-medium transition-colors rounded-xl"
                          style={{
                            backgroundColor: darkMode
                              ? "rgba(71,85,105,0.3)"
                              : "rgba(15,23,42,0.05)",
                            color: darkMode ? "#e2e8f0" : "#0f172a",
                          }}
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setMobileCoursesOpen((prev) => !prev)}
                          className="p-2 ml-2 rounded-lg hover:bg-gray-200/40"
                          style={{
                            color: darkMode ? "#cbd5f5" : "#4b5563",
                          }}
                          aria-label="Toggle courses submenu"
                        >
                          <svg
                            className={`h-4 w-4 transition-transform ${
                              mobileCoursesOpen ? "rotate-180" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                      </div>
                      {mobileCoursesOpen && (
                        <div className="pl-9 space-y-1">
                          <Link
                            to="/assignments"
                            onClick={onClose}
                            className="block px-3 py-2 text-sm rounded-lg"
                            style={{
                              color: darkMode ? "#e2e8f0" : "#0f172a",
                              backgroundColor: darkMode
                                ? "rgba(148,163,184,0.1)"
                                : "#f8fafc",
                            }}
                          >
                            Assignments
                          </Link>
                          <Link
                            to="/materials"
                            onClick={onClose}
                            className="block px-3 py-2 text-sm rounded-lg"
                            style={{
                              color: darkMode ? "#e2e8f0" : "#0f172a",
                              backgroundColor: darkMode
                                ? "rgba(148,163,184,0.1)"
                                : "#f8fafc",
                            }}
                          >
                            Lesson
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                }

                // Default rendering
                return (
                  <Link
                    key={index}
                    to={item.href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors rounded-xl"
                    style={{
                      backgroundColor: darkMode
                        ? "rgba(71,85,105,0.3)"
                        : "rgba(15,23,42,0.05)",
                      color: darkMode ? "#e2e8f0" : "#0f172a",
                    }}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div
              className="pt-4 border-t"
              style={{
                borderColor: darkMode ? "rgba(148,163,184,0.2)" : "#e2e8f0",
              }}
            >
              <p
                className="mb-2 text-xs tracking-wide uppercase"
                style={{ color: darkMode ? "#94a3b8" : "#64748b" }}
              >
                Help & Support
              </p>
              <div className="space-y-1">
                <Link
                  to="/help/faq"
                  onClick={onClose}
                  className="block px-3 py-2 text-sm rounded-lg"
                  style={{
                    color: darkMode ? "#e2e8f0" : "#0f172a",
                    backgroundColor: darkMode
                      ? "rgba(148,163,184,0.1)"
                      : "#f8fafc",
                  }}
                >
                  FAQ / Usage
                </Link>
                <Link
                  to="/help/feedback"
                  onClick={onClose}
                  className="block px-3 py-2 text-sm rounded-lg"
                  style={{
                    color: darkMode ? "#e2e8f0" : "#0f172a",
                    backgroundColor: darkMode
                      ? "rgba(148,163,184,0.1)"
                      : "#f8fafc",
                  }}
                >
                  Feedback
                </Link>
                <Link
                  to="/help/about"
                  onClick={onClose}
                  className="block px-3 py-2 text-sm rounded-lg"
                  style={{
                    color: darkMode ? "#e2e8f0" : "#0f172a",
                    backgroundColor: darkMode
                      ? "rgba(148,163,184,0.1)"
                      : "#f8fafc",
                  }}
                >
                  About Us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && variant === "desktop" && (
        <Sidebar
          variant="mobile"
          role={role}
          userInfo={userInfo}
          onClose={toggleSidebar}
          forceExpanded={true}
          mobileView={true}
        />
      )}

      <div className="hidden md:block">
        {/* Hover sensor to expand when cursor reaches screen's left edge */}
        <div
          className="fixed left-0 top-1/2 -translate-y-1/2 h-[600px] w-4 z-[9001]"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          aria-hidden
        />
        <div
          className={`fixed left-4 top-1/2 -translate-y-1/2 z-[9002] flex flex-col rounded-xl shadow-xl transition-all duration-300 overflow-hidden sm:flex ${
            isExpanded ? "w-64" : "w-14"
          }`}
          style={{
            backgroundColor: darkMode
              ? "rgba(31, 41, 55, 0.9)"
              : "rgba(255, 255, 255, 0.9)",
            backdropFilter: "blur(5px)",
            transitionProperty: "width, background-color, backdrop-filter",
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div
            className={`flex-1 overflow-y-auto py-4 px-1.5 ${
              isExpanded ? "w-64" : "w-14"
            } transition-all duration-300 hide-scrollbar`}
          >
            <style>
              {`.hide-scrollbar::-webkit-scrollbar {
              display: none;
            }`}
            </style>
            {/* Profile info - visible when expanded */}
            {isExpanded && (
              <div className="border-b border-gray-200/50">
                <div className="flex items-center gap-3 p-3">
                  {/* Avatar */}
                  <div className="relative">
                    <img
                      className="object-cover w-16 h-16 rounded-xl"
                      src={user.avatar}
                      alt="Profile"
                    />
                  </div>

                  {/* Thông tin */}
                  <div className="flex flex-col justify-center overflow-hidden">
                    <h2
                      className="text-sm font-semibold truncate max-w-[140px]"
                      style={{ color: darkMode ? "#ffffff" : "#1f2937" }}
                    >
                      {user.name}
                    </h2>
                    <p
                      className="text-xs truncate max-w-[140px]"
                      style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                    >
                      {user.email}
                    </p>

                    <div
                      className="mt-1 w-fit px-2 py-0.5 text-xs font-semibold rounded-md backdrop-blur-sm"
                      style={{
                        backgroundColor: roleColors[effectiveRole],
                        backdropFilter: "blur(16px)",
                        color: "#fff",
                      }}
                    >
                      {storedUser?.role || role}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <nav className="space-y-2">
              {menuItems.map((item, index) => {
                // Desktop dropdown cho "All Courses" - chỉ admin & teacher

                if (item.href === "/courses" && effectiveRole !== "student") {
                  return (
                    <div key={index} className="relative">
                      <div className="flex items-center">
                        {/* Phần main: click để đi tới /courses */}

                        <Link
                          className="flex items-center flex-1 px-3 py-2 text-sm rounded-md hover:bg-gray-600/20"
                          style={{
                            color: darkMode ? "#9ca3af" : "#374151",
                          }}
                          to={item.href}
                        >
                          <div
                            style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                          >
                            {item.icon}
                          </div>

                          {isExpanded && (
                            <span className="ml-2 whitespace-nowrap">
                              {item.label}
                            </span>
                          )}
                        </Link>

                        {/* Nút mũi tên: chỉ toggle dropdown */}

                        {isExpanded && (
                          <button
                            onClick={() => toggleSubmenu("courses")}
                            className="p-2 ml-1 text-sm rounded-md hover:bg-gray-600/20"
                            style={{
                              color: darkMode ? "#9ca3af" : "#374151",
                            }}
                            type="button"
                            aria-label="Toggle courses submenu"
                          >
                            <svg
                              className={`h-4 w-4 transition-transform ${
                                openSubmenu === "courses"
                                  ? "transform rotate-180"
                                  : ""
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </button>
                        )}
                      </div>

                      {isExpanded && (
                        <div
                          ref={coursesRef}
                          className="mt-1 space-y-1 overflow-hidden pl-7"
                          style={{
                            maxHeight:
                              openSubmenu === "courses" ||
                              (closingSubmenu === "courses" && animatingOut)
                                ? coursesHeight
                                : 0,

                            transition: "max-height 300ms ease",
                          }}
                        >
                          <Link
                            to="/assignments"
                            className="flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-gray-100/20"
                            style={{ color: darkMode ? "#9ca3af" : "#374151" }}
                          >
                            <span className="whitespace-nowrap">
                              Assignments
                            </span>
                          </Link>

                          <Link
                            to="/materials"
                            className="flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-gray-100/20"
                            style={{ color: darkMode ? "#9ca3af" : "#374151" }}
                          >
                            <span className="whitespace-nowrap">Lesson</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                }

                // Default menu item
                return (
                  <Link
                    key={index}
                    className="flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-gray-600/20"
                    style={{
                      color: darkMode ? "#9ca3af" : "#374151",
                    }}
                    to={item.href}
                  >
                    <div style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}>
                      {item.icon}
                    </div>
                    {isExpanded && (
                      <span className="ml-2 whitespace-nowrap">
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}

              {/* Help submenu */}
              <div className="relative">
                <button
                  onClick={() => toggleSubmenu("help")}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-md hover:bg-gray-600/20"
                  style={{ color: darkMode ? "#9ca3af" : "#374151" }}
                >
                  <div className="flex items-center">
                    <svg
                      className="w-5 h-5 min-w-[1.25rem]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                    {isExpanded && (
                      <span className="ml-2 whitespace-nowrap">Help</span>
                    )}
                  </div>
                  {isExpanded && (
                    <svg
                      className={`ml-auto h-4 w-4 transition-transform ${
                        openSubmenu === "help" ? "transform rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  )}
                </button>
                {isExpanded && (
                  <div
                    ref={helpRef}
                    className="mt-1 space-y-1 overflow-hidden pl-7"
                    style={{
                      maxHeight:
                        openSubmenu === "help" ||
                        (closingSubmenu === "help" && animatingOut)
                          ? helpHeight
                          : 0,
                      transition: "max-height 300ms ease",
                    }}
                  >
                    <Link
                      to="/help/faq"
                      className="flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-gray-100/20"
                      style={{ color: darkMode ? "#9ca3af" : "#374151" }}
                    >
                      <svg
                        className="w-4 h-4 mr-2 min-w-[1rem]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span className="whitespace-nowrap">FAQ/Usage</span>
                    </Link>
                    <Link
                      to={feedbackLink}
                      className="flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-gray-100/20"
                      style={{ color: darkMode ? "#9ca3af" : "#374151" }}
                    >
                      <svg
                        className="w-4 h-4 mr-2 min-w-[1rem]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                        />
                      </svg>
                      <span className="whitespace-nowrap">Feedback</span>
                    </Link>
                    <Link
                      to="/help/about"
                      className="flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-gray-100/20"
                      style={{ color: darkMode ? "#9ca3af" : "#374151" }}
                    >
                      <svg
                        className="w-4 h-4 mr-2 min-w-[1rem]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="whitespace-nowrap">About Us</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Settings submenu */}
              <div className="relative">
                <button
                  onClick={() => toggleSubmenu("settings")}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-md hover:bg-gray-600/20"
                  style={{ color: darkMode ? "#9ca3af" : "#374151" }}
                >
                  <div className="flex items-center">
                    <svg
                      className="w-5 h-5 min-w-[1.25rem]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {isExpanded && (
                      <span className="ml-2 whitespace-nowrap">Settings</span>
                    )}
                  </div>
                  {isExpanded && (
                    <svg
                      className={`ml-auto h-4 w-4 transition-transform ${
                        openSubmenu === "settings" ? "transform rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  )}
                </button>
                {isExpanded && (
                  <div
                    ref={settingsRef}
                    className="mt-1 space-y-1 overflow-hidden pl-7"
                    style={{
                      maxHeight:
                        openSubmenu === "settings" ||
                        (closingSubmenu === "settings" && animatingOut)
                          ? settingsHeight
                          : 0,
                      transition: "max-height 300ms ease",
                    }}
                  >
                    <Link
                      to="/profile"
                      className="flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-gray-100/20"
                      style={{ color: darkMode ? "#9ca3af" : "#374151" }}
                    >
                      <svg
                        className="w-4 h-4 mr-2 min-w-[1rem]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <span className="whitespace-nowrap">Profile</span>
                    </Link>
                    <Link
                      to="/account"
                      className="flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-gray-100/20"
                      style={{ color: darkMode ? "#9ca3af" : "#374151" }}
                    >
                      <svg
                        className="w-4 h-4 mr-2 min-w-[1rem]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span className="whitespace-nowrap">Account</span>
                    </Link>
                    <Link
                      to="/theme"
                      className="flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-gray-100/20"
                      style={{ color: darkMode ? "#9ca3af" : "#374151" }}
                    >
                      <svg
                        className="w-4 h-4 mr-2 min-w-[1rem]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                        />
                      </svg>
                      <span className="whitespace-nowrap">App Theme</span>
                    </Link>
                  </div>
                )}
              </div>
            </nav>
          </div>
          {/* Logout button - visible when expanded */}
          {isExpanded && (
            <div className="flex-shrink-0 p-3 mt-auto border-t border-gray-200/50">
              <button
                onClick={async () => {
                  try {
                    await authService.logout();
                    disconnectSocket(); // hủy socket
                  } catch (error) {
                    console.error("Logout failed", error);
                  }
                  window.location.href = "/login";
                }}
                className="flex items-center w-full px-3 py-2 text-sm text-red-600 rounded-md hover:bg-red-50/70"
              >
                <svg
                  className="w-5 h-5 text-red-500 min-w-[1.25rem]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span className="ml-2 whitespace-nowrap">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
