import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  KeyRound,
  LogOut,
  Moon,
  Settings2,
  Sun,
  UserRound,
  UsersRound,
  Paintbrush,
} from "lucide-react";
import NotificationDropdown from "./NotificationDropdown";
import ChatButton from "../FloatingChat/ChatButton";
import { authService } from "../../services";
import { useSidebar } from "../../context/SidebarContext";

interface NavbarProps {
  onToggleSidebar?: () => void;
}

export default function Navbar({ onToggleSidebar }: NavbarProps) {
  const navigate = useNavigate();
  const { toggleSidebar } = useSidebar();
  const handleToggle = onToggleSidebar || toggleSidebar;
  const { darkMode, toggleDarkMode } = useTheme();
  const { user, savedAccounts, switchToAccount, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(
    null
  );
  const [manualPasswords, setManualPasswords] = useState<
    Record<string, string>
  >({});
  const [passwordPromptAccount, setPasswordPromptAccount] = useState<
    string | null
  >(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const navigateByRole = (role?: string) => {
    switch (role) {
      case "admin":
        return "/dashboard";
      case "teacher":
        return "/teacher-dashboard";
      case "student":
        return "/student-dashboard";
      default:
        return "/";
    }
  };

  const handleAccountSwitch = async (
    accountId: string,
    passwordOverride?: string
  ) => {
    setSwitchingAccountId(accountId);
    try {
      const switchedUser = await switchToAccount(accountId, passwordOverride);
      if (switchedUser) {
        navigate(navigateByRole(switchedUser.role));
        if (passwordOverride) {
          setManualPasswords((prev) => ({ ...prev, [accountId]: "" }));
        }
        setPasswordPromptAccount(null);
      }
      setIsDropdownOpen(false);
    } catch (error) {
      console.error("Failed to switch account", error);
      alert(
        "Unable to switch accounts. Please verify the password and try again."
      );
    } finally {
      setSwitchingAccountId(null);
    }
  };

  const handleManualPasswordChange = (accountId: string, value: string) => {
    setManualPasswords((prev) => ({ ...prev, [accountId]: value }));
  };

  const currentAccountTokens = useMemo(() => {
    const tokenSources = [
      (user as { _id?: string })?._id,
      (user as { id?: string })?.id,
      (user as { email?: string })?.email,
      (user as { username?: string })?.username,
      (user as { fullname?: string; fullName?: string })?.fullName,
      (user as { fullname?: string; fullName?: string })?.fullname,
    ];
    return tokenSources
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());
  }, [user]);

  const recentAccounts = savedAccounts
    .filter((account) => {
      const accountTokens = [account.userId, account.email, account.displayName]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase());
      return !accountTokens.some((token) =>
        currentAccountTokens.includes(token)
      );
    })
    .sort((a, b) => b.lastUsed - a.lastUsed);

  const dropdownPanelStyle = {
    backgroundColor: darkMode
      ? "rgba(15, 23, 42, 0.98)"
      : "rgba(255, 255, 255, 0.98)",
    borderColor: darkMode
      ? "rgba(71, 85, 105, 0.6)"
      : "rgba(226, 232, 240, 0.9)",
    color: darkMode ? "#e2e8f0" : "#0f172a",
  };

  const handleReturnHomePage = () => {
    const path = "/admin/dashboard";
    switch (user?.role) {
      case "admin":
        navigate(path);
        break;
      case "teacher":
        navigate("/teacher-dashboard");
        break;
      case "student":
        navigate("/student-dashboard");
        break;
      default:
        navigate("/");
    }
  };

  return (
    <nav
      className="shadow-lg py-3 px-4 sm:px-6 fixed top-0 left-0 right-0 z-[95] backdrop-blur-md transition-colors duration-300"
      style={{
        backgroundColor: darkMode
          ? "rgba(26, 32, 44, 0.95)"
          : "rgba(255, 255, 255, 0.95)",
        borderBottom: darkMode
          ? "1px solid rgba(148, 163, 184, 0.1)"
          : "1px solid rgba(148, 163, 184, 0.1)",
        color: darkMode ? "#ffffff" : "#1e293b",
      }}
    >
      <div className="flex flex-col gap-3 mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center">
            <button
              className="p-2 mr-3 transition-all duration-200 rounded-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/20 md:hidden"
              style={{
                backgroundColor: darkMode
                  ? "rgba(99, 102, 241, 0.15)"
                  : "rgba(99, 102, 241, 0.1)",
                color: darkMode ? "#a5b4fc" : "#4f46e5",
              }}
              onClick={handleToggle}
              aria-label="Toggle sidebar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                ></path>
              </svg>
            </button>
            <span
              className="flex items-center space-x-3 cursor-pointer"
              onClick={handleReturnHomePage}
            >
              <div
                className="flex items-center justify-center w-10 h-10 shadow-lg rounded-xl"
                style={{ backgroundColor: "#6366f1" }}
              >
                <span className="text-lg font-bold text-white">F</span>
              </div>
              <span
                className="text-xl font-bold"
                style={{ color: darkMode ? "#ffffff" : "#1e293b" }}
              >
                FStudyMate
              </span>
            </span>
          </div>
          <div className="hidden mx-4 md:flex md:flex-1">
            <div className="relative w-full max-w-xl mx-auto">
              <input
                type="text"
                placeholder="Search..."
                className="w-full py-3 pl-10 pr-4 transition-all duration-200 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                style={{
                  borderColor: darkMode
                    ? "rgba(148, 163, 184, 0.2)"
                    : "rgba(148, 163, 184, 0.3)",
                  backgroundColor: darkMode
                    ? "rgba(15, 23, 42, 0.5)"
                    : "rgba(255, 255, 255, 0.85)",
                  color: darkMode ? "#ffffff" : "#1e293b",
                  backdropFilter: "blur(10px)",
                }}
              />
              <div
                className="absolute right-3 top-2.5"
                style={{ color: darkMode ? "#9ca3af" : "#9ca3af" }}
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
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  ></path>
                </svg>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            <NotificationDropdown isDarkMode={darkMode} />
            <ChatButton darkMode={darkMode} />
            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  className="flex items-center gap-2 focus:outline-none"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  aria-haspopup="true"
                  aria-expanded={isDropdownOpen}
                >
                  <img
                    src={
                      (
                        user as {
                          profileImageUrl?: string;
                          avatar_url?: string;
                        }
                      ).profileImageUrl ||
                      (
                        user as {
                          profileImageUrl?: string;
                          avatar_url?: string;
                        }
                      ).avatar_url ||
                      "https://media.tenor.com/AN83u7YyqwUAAAAM/maxwell-the-cat.gif"
                    }
                    alt={
                      (user as { fullName?: string; fullname?: string })
                        .fullName ||
                      (user as { fullName?: string; fullname?: string })
                        .fullname ||
                      "profile"
                    }
                    className="object-cover w-8 h-8 border rounded-full md:h-9 md:w-9 border-white/70"
                  />
                  <svg
                    className={`h-4 w-4 transition-transform ${
                      isDropdownOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {isDropdownOpen && (
                  <div
                    className="absolute right-0 mt-3 w-72 rounded-2xl shadow-2xl border overflow-hidden z-[120]"
                    style={dropdownPanelStyle}
                  >
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-1 text-xs tracking-wide uppercase text-slate-500 dark:text-slate-400">
                        <UserRound className="h-3.5 w-3.5" />
                        Current account
                      </div>
                      <button
                        className="flex items-center w-full gap-3 px-2 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl"
                        onClick={async () => {
                          try {
                            // Call /users/me API to get current user info
                            const currentUser =
                              await authService.getCurrentUser();

                            if (currentUser?._id) {
                              // Navigate to user profile page with user data passed via state
                              navigate(`/user/${currentUser._id}`, {
                                state: { userData: currentUser },
                              });
                            } else {
                              // Fallback to profile if no ID found
                              navigate("/profile");
                            }
                          } catch (error) {
                            console.error(
                              "Failed to fetch current user:",
                              error
                            );
                            // Fallback to profile on error
                            navigate("/profile");
                          }
                          setIsDropdownOpen(false);
                        }}
                      >
                        <img
                          src={
                            (
                              user as {
                                profileImageUrl?: string;
                                avatar_url?: string;
                              }
                            ).profileImageUrl ||
                            (
                              user as {
                                profileImageUrl?: string;
                                avatar_url?: string;
                              }
                            ).avatar_url ||
                            "https://media.tenor.com/AN83u7YyqwUAAAAM/maxwell-the-cat.gif"
                          }
                          alt="current profile"
                          className="object-cover w-10 h-10 border rounded-full border-white/70"
                        />
                        <div>
                          <p
                            className="text-sm font-semibold text-slate-800 dark:text-white"
                            style={{ color: darkMode ? "#f9fafb" : "#0f172a" }}
                          >
                            {(
                              user as {
                                fullName?: string;
                                fullname?: string;
                                username?: string;
                              }
                            ).fullName ||
                              (
                                user as {
                                  fullName?: string;
                                  fullname?: string;
                                  username?: string;
                                }
                              ).fullname ||
                              (
                                user as {
                                  fullName?: string;
                                  fullname?: string;
                                  username?: string;
                                }
                              ).username}
                          </p>
                          <p className="text-xs text-slate-500">
                            {(user as { email?: string }).email ||
                              "View profile"}
                          </p>
                        </div>
                      </button>
                    </div>
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-2 text-xs tracking-wide uppercase text-slate-500 dark:text-slate-400">
                        <UsersRound className="h-3.5 w-3.5" />
                        Other recent accounts
                      </div>
                      {recentAccounts.length === 0 && (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          No other recent accounts yet
                        </p>
                      )}
                      {recentAccounts.map((account) => {
                        const manualPassword =
                          manualPasswords[account.userId] || "";
                        const isSwitching =
                          switchingAccountId === account.userId;
                        const isPromptOpen =
                          passwordPromptAccount === account.userId;
                        return (
                          <div
                            key={account.userId}
                            className="px-3 py-3 mb-2 transition-colors rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40 last:mb-0"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p
                                  className="text-sm font-medium text-slate-800 dark:text-white"
                                  style={{
                                    color: darkMode ? "#f9fafb" : "#0f172a",
                                  }}
                                >
                                  {account.displayName}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {account.email}
                                </p>
                              </div>
                              {account.hasPassword ? (
                                <button
                                  className="text-xs font-semibold text-indigo-500 hover:text-indigo-600"
                                  onClick={() =>
                                    handleAccountSwitch(account.userId)
                                  }
                                  disabled={isSwitching}
                                >
                                  {isSwitching ? "Switching..." : "Switch"}
                                </button>
                              ) : (
                                <button
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-500"
                                  onClick={() =>
                                    setPasswordPromptAccount((prev) =>
                                      prev === account.userId
                                        ? null
                                        : account.userId
                                    )
                                  }
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                  {isPromptOpen ? "Cancel" : "Switch"}
                                </button>
                              )}
                            </div>
                            {!account.hasPassword && isPromptOpen && (
                              <div className="mt-3 space-y-2">
                                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                  <KeyRound className="h-3.5 w-3.5" />
                                  Enter password to switch
                                </label>
                                <input
                                  type="password"
                                  value={manualPassword}
                                  onChange={(event) =>
                                    handleManualPasswordChange(
                                      account.userId,
                                      event.target.value
                                    )
                                  }
                                  placeholder="Password"
                                  className="w-full px-3 py-2 text-sm bg-white border rounded-lg border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white dark:bg-slate-800"
                                />
                                <button
                                  className="w-full py-2 text-sm font-medium text-white bg-indigo-500 rounded-lg disabled:opacity-50"
                                  onClick={() =>
                                    handleAccountSwitch(
                                      account.userId,
                                      manualPassword
                                    )
                                  }
                                  disabled={!manualPassword || isSwitching}
                                >
                                  {isSwitching ? "Switching..." : "Switch"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                      <button
                        className="w-full px-2 py-2 text-sm text-left border border-dashed rounded-lg cursor-not-allowed text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600"
                        type="button"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Settings2 className="w-4 h-4" />
                          Account settings (coming soon)
                        </span>
                      </button>
                    </div>
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Paintbrush
                            size={16}
                            className="transition-colors"
                            style={{ color: darkMode ? "#a5b4fc" : "#64748b" }}
                          />
                          <span
                            className="text-sm font-medium text-slate-700 dark:text-slate-200"
                            style={{ color: darkMode ? "#e5e7eb" : "#0f172a" }}
                          >
                            Theme
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Sun
                            className={`h-4 w-4 transition-colors ${
                              darkMode ? "text-slate-400" : "text-amber-500"
                            }`}
                          />
                          <button
                            type="button"
                            aria-label="Toggle theme"
                            onClick={toggleDarkMode}
                            className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                              darkMode ? "bg-indigo-500/80" : "bg-slate-300"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                darkMode ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                          <Moon
                            className={`h-4 w-4 transition-colors ${
                              darkMode ? "text-indigo-300" : "text-slate-400"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <button
                        type="button"
                        className="flex items-center w-full gap-2 text-sm font-semibold text-left text-rose-500 hover:text-rose-600"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          logout();
                        }}
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="md:hidden">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
              style={{
                borderColor: darkMode
                  ? "rgba(148, 163, 184, 0.3)"
                  : "rgba(148, 163, 184, 0.35)",
                backgroundColor: darkMode
                  ? "rgba(15, 23, 42, 0.6)"
                  : "rgba(255, 255, 255, 0.95)",
                color: darkMode ? "#ffffff" : "#1e293b",
              }}
            />
            <div
              className="absolute -translate-y-1/2 left-3 top-1/2"
              style={{ color: darkMode ? "#9ca3af" : "#94a3b8" }}
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                ></path>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
