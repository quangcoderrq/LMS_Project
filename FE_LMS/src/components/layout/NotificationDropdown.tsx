import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { format, formatDistanceToNow } from "date-fns";
import { createPortal } from "react-dom";
import {
  Loader2,
  Plus,
  RefreshCcw,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { notificationService } from "../../services/notificationService";
import type { NotificationItem, RecipientType } from "../../types/notification";
import "./NotificationDropdown.css";
import { useAuth } from "../../hooks/useAuth";
import http from "../../utils/http";
import type { User } from "../../types/auth";
import type { Course } from "../../types/course";
import toast from "react-hot-toast";

interface NotificationDropdownProps {
  isDarkMode: boolean;
}

const LIMIT = 10;

const classNames = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const formatRelativeTime = (isoDate: string) => {
  const createdDate = new Date(isoDate);
  const now = new Date();
  const diffInDays = (now.getTime() - createdDate.getTime()) / 86400000;

  if (Number.isNaN(diffInDays)) {
    return "-";
  }

  if (diffInDays > 3) {
    return format(createdDate, "dd/MM/yyyy HH:mm");
  }

  return formatDistanceToNow(createdDate, { addSuffix: true }).replace(
    "about ",
    ""
  );
};

const getSenderInitial = (notification: NotificationItem) => {
  const source =
    notification.sender?.username || notification.recipientType || "N";
  return source.charAt(0).toUpperCase();
};

const getSenderDisplayName = (notification: NotificationItem) => {
  return (
    notification.sender?.fullname || notification.sender?.username || "System"
  );
};

const truncate = (value: string, length = 80) =>
  value.length > length ? `${value.slice(0, length)}…` : value;

export default function NotificationDropdown({
  isDarkMode,
}: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailNotification, setDetailNotification] =
    useState<NotificationItem | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean;
    ids: string[];
  }>({
    open: false,
    ids: [],
  });

  // Sound and mute state
  const [isMuted, setIsMuted] = useState(() => {
    const stored = localStorage.getItem("notification-sound-muted");
    return stored === "true";
  });
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());

  const unreadCount = useMemo(
    () => items.filter((notification) => !notification.isRead).length,
    [items]
  );

  const { user } = useAuth();
  const role =
    ((user?.role as "admin" | "teacher" | "student" | undefined) ??
      "student") ||
    "student";
  const canCreate = role === "admin" || role === "teacher";

  const closeDropdown = () => {
    setIsOpen(false);
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const fetchNotifications = useCallback(
    async (options?: { reset?: boolean; silent?: boolean }) => {
      if (isLoading && !options?.silent) return;
      if (!options?.silent) setIsLoading(true);
      setError(null);
      try {
        // For polling (silent), always fetch page 1 to get latest notifications
        // For reset, fetch page 1
        // For normal pagination, use current page
        const nextPage = options?.silent || options?.reset ? 1 : page;
        const response = await notificationService.getNotifications({
          page: nextPage,
          limit: LIMIT,
        });
        const newItems = response.data ?? [];

        // Check for new notifications (not seen before) - only when polling silently
        if (options?.silent && !options?.reset) {
          const seenIds = seenNotificationIdsRef.current;
          const newNotifications = newItems.filter(
            (item) => !seenIds.has(item._id)
          );

          // Show toast and play sound for new notifications
          newNotifications.forEach((notification) => {
            seenIds.add(notification._id);

            // Show toast notification
            toast(
              () => (
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-semibold">
                    {notification.title}
                  </div>
                  <div className="text-xs opacity-90 line-clamp-2">
                    {notification.message}
                  </div>
                </div>
              ),
              {
                duration: 5000,
                position: "top-right",
                style: {
                  background: isDarkMode ? "#1e293b" : "#ffffff",
                  color: isDarkMode ? "#ffffff" : "#1f2937",
                  border: `1px solid ${
                    isDarkMode ? "rgba(75, 85, 99, 0.3)" : "#e5e7eb"
                  }`,
                  borderRadius: "0.75rem",
                  padding: "12px 16px",
                  boxShadow:
                    "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                },
                icon: "🔔",
              }
            );

            // Play sound if not muted
            if (!isMuted && notificationSoundRef.current) {
              try {
                notificationSoundRef.current.currentTime = 0;
                notificationSoundRef.current.play().catch((err) => {
                  console.warn("Failed to play notification sound:", err);
                });
              } catch (err) {
                console.warn("Failed to play notification sound:", err);
              }
            }
          });

          // Update items list with new notifications (prepend to top)
          setItems((prev) => {
            const existingIds = new Set(prev.map((item) => item._id));
            const toAdd = newItems.filter((item) => !existingIds.has(item._id));
            return [...toAdd, ...prev];
          });
        } else {
          // On reset or normal fetch, mark all as seen and update items normally
          if (options?.reset) {
            newItems.forEach((item) => {
              seenNotificationIdsRef.current.add(item._id);
            });
          }

          setItems((prev) =>
            options?.reset
              ? newItems
              : [
                  ...prev,
                  ...newItems.filter(
                    (item) =>
                      !prev.some((existing) => existing._id === item._id)
                  ),
                ]
          );
          setHasNext(response.pagination?.hasNext ?? false);
          setPage(nextPage + 1);
        }
      } catch (err) {
        if (!options?.silent) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load notifications. Please try again."
          );
        }
      } finally {
        if (!options?.silent) setIsLoading(false);
      }
    },
    [page, isLoading, isDarkMode, isMuted]
  );

  const handleToggleOpen = () => {
    if (!isOpen && items.length === 0) {
      fetchNotifications({ reset: true }).catch(() => undefined);
    }
    setIsOpen((prev) => !prev);
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await fetchNotifications({ reset: true });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelect = (notificationId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(notificationId)) {
        next.delete(notificationId);
      } else {
        next.add(notificationId);
      }
      return next;
    });
  };

  const handleMarkSelectedAsRead = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      await notificationService.markNotificationsAsRead(ids);
      setItems((prev) =>
        prev.map((item) =>
          ids.includes(item._id) ? { ...item, isRead: true } : item
        )
      );
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequestDeleteSelected = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setConfirmDelete({ open: true, ids });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete.ids.length) return;
    const ids = [...confirmDelete.ids];
    try {
      await notificationService.deleteNotifications(ids);
      setRemovingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
      setTimeout(() => {
        setItems((prev) => prev.filter((item) => !ids.includes(item._id)));
        setRemovingIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      }, 200);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setConfirmDelete({ open: false, ids: [] });
    }
  };

  const handleOpenDetail = async (notification: NotificationItem) => {
    setDetailNotification(notification);
    if (!notification.isRead) {
      try {
        await notificationService.markNotificationAsRead(notification._id);
        setItems((prev) =>
          prev.map((item) =>
            item._id === notification._id ? { ...item, isRead: true } : item
          )
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllNotificationsAsRead();
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (detailNotification || confirmDelete.open) {
        return;
      }
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (detailNotification || confirmDelete.open) {
        return;
      }
      if (event.key === "Escape") {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, detailNotification, confirmDelete.open]);

  // Initialize notification sound
  useEffect(() => {
    notificationSoundRef.current = new Audio(
      "https://admin.toandz.id.vn/fstudy/sound/notification.mp3"
    );
    notificationSoundRef.current.volume = 0.5;
    notificationSoundRef.current.preload = "auto";

    return () => {
      if (notificationSoundRef.current) {
        notificationSoundRef.current.pause();
        notificationSoundRef.current = null;
      }
    };
  }, []);

  // Polling for new notifications every 5 seconds
  useEffect(() => {
    // Initial fetch
    fetchNotifications({ reset: true, silent: true }).catch(() => undefined);

    // Set up polling interval
    const intervalId = setInterval(() => {
      fetchNotifications({ silent: true }).catch(() => undefined);
    }, 15000); // Poll every 5 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchNotifications]);

  // Handle mute/unmute toggle
  const handleToggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    localStorage.setItem("notification-sound-muted", String(newMutedState));
  };

  useEffect(() => {
    if (!isOpen || !hasNext || isLoading || error) return;
    const listElement = listRef.current;
    const sentinelElement = sentinelRef.current;
    if (!listElement || !sentinelElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && hasNext && !isLoading) {
            fetchNotifications().catch(() => undefined);
          }
        });
      },
      {
        root: listElement,
        threshold: 0.1,
      }
    );

    observer.observe(sentinelElement);

    return () => {
      observer.disconnect();
    };
  }, [isOpen, hasNext, isLoading, error, fetchNotifications]);

  const dropdownTheme = isDarkMode
    ? "bg-slate-800 text-white"
    : "bg-white text-slate-900";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        aria-label="Notifications"
        onClick={handleToggleOpen}
        className={classNames(
          "relative p-2 rounded-full transition-colors",
          isDarkMode
            ? "text-white hover:bg-white/10"
            : "text-slate-700 hover:bg-slate-100"
        )}
      >
        <svg
          viewBox="64 64 896 896"
          focusable="false"
          data-icon="bell"
          width="22"
          height="22"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M816 768h-24V428c0-141.1-104.3-257.7-240-277.1V112c0-22.1-17.9-40-40-40s-40 17.9-40 40v38.9c-135.7 19.4-240 136-240 277.1v340h-24c-17.7 0-32 14.3-32 32v32c0 4.4 3.6 8 8 8h216c0 61.8 50.2 112 112 112s112-50.2 112-112h216c4.4 0 8-3.6 8-8v-32c0-17.7-14.3-32-32-32zM512 888c-26.5 0-48-21.5-48-48h96c0 26.5-21.5 48-48 48zM304 768V428c0-55.6 21.6-107.8 60.9-147.1S456.4 220 512 220c55.6 0 107.8 21.6 147.1 60.9S720 372.4 720 428v340H304z"></path>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={classNames(
            "fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 mt-3 sm:w-96 shadow-2xl rounded-2xl border border-slate-200/30 overflow-hidden z-[120] transition-all duration-200 ease-out sm:origin-top-right notification-dropdown-panel",
            dropdownTheme,
            "data-[state=open]:scale-100 data-[state=open]:opacity-100"
          )}
          style={{ top: 'calc(100% + 0.75rem)', maxWidth: 'calc(100vw - 1rem)' }}
          data-state={isOpen ? "open" : "closed"}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/30">
            <div>
              <p className="text-sm font-semibold">Notifications</p>
              <p className="text-xs opacity-70">
                {unreadCount > 0 ? `${unreadCount} Unread` : "All read"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Mute/Unmute Button */}
              <button
                onClick={handleToggleMute}
                className={classNames(
                  "inline-flex items-center justify-center rounded-full transition-colors w-7 h-7",
                  isMuted
                    ? "text-slate-400 hover:bg-slate-100/20"
                    : "text-indigo-500 hover:bg-indigo-500/20"
                )}
                title={isMuted ? "Unmute notifications" : "Mute notifications"}
              >
                {isMuted ? (
                  <VolumeX className="h-3.5 w-3.5" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
              </button>
              {canCreate && (
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="inline-flex items-center justify-center text-xs font-semibold text-white transition-colors bg-indigo-500 rounded-full hover:bg-indigo-600 w-7 h-7"
                  title="Create notification"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setSelectMode((prev) => !prev)}
                className="px-3 py-1 text-xs text-indigo-500 transition-colors border rounded-full border-indigo-400/60 hover:bg-indigo-500 hover:text-white"
              >
                {selectMode ? "Cancel" : "Select"}
              </button>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="text-xs px-3 py-1 rounded-full border border-slate-300/50 hover:bg-slate-100/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCcw
                  className={classNames(
                    "h-3.5 w-3.5",
                    (isRefreshing || isLoading) &&
                      "notification-refresh-icon--spinning"
                  )}
                />
              </button>
            </div>
          </div>

          {selectMode && (
            <div className="flex items-center gap-2 px-4 py-2 text-xs border-b border-slate-200/30">
              <span className="opacity-70">
                Selected {selectedIds.size} item
                {selectedIds.size === 1 ? "" : "s"}
              </span>
              <button
                disabled={!selectedIds.size}
                onClick={handleMarkSelectedAsRead}
                className="px-2 py-1 text-white rounded-lg bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Mark read
              </button>
              <button
                disabled={!selectedIds.size}
                onClick={handleRequestDeleteSelected}
                className="px-2 py-1 rounded-lg bg-rose-500 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          )}

          <div
            className="max-h-[420px] overflow-y-auto custom-scrollbar transition-all duration-200 notification-list"
            ref={listRef}
          >
            {error && (
              <div className="px-4 py-6 text-sm text-center text-rose-400">
                {error}
              </div>
            )}
            {!error && items.length === 0 && !isLoading && (
              <div className="px-4 py-10 text-sm text-center opacity-70">
                No notifications found
              </div>
            )}
            {items.map((notification, index) => {
              const isSelected = selectedIds.has(notification._id);
              return (
                <button
                  key={notification._id}
                  type="button"
                  onClick={() =>
                    selectMode
                      ? handleSelect(notification._id)
                      : handleOpenDetail(notification)
                  }
                  className={classNames(
                    "w-full flex items-start gap-3 px-4 py-3 text-left transition-all duration-150 border-b border-slate-200/20 hover:bg-slate-50/10 notification-item",
                    notification.isRead
                      ? "opacity-70"
                      : "bg-indigo-500/5 border-l-4 border-indigo-400/80",
                    selectMode && "pr-6",
                    removingIds.has(notification._id) &&
                      "notification-item-removing"
                  )}
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div className="flex items-start flex-1 min-w-0 gap-3">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center w-10 h-10 font-semibold rounded-full bg-slate-200 text-slate-700">
                        {getSenderInitial(notification)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pr-2 overflow-hidden">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p
                          className="flex-1 min-w-0 text-sm font-semibold truncate"
                          style={{ maxWidth: "200px" }}
                        >
                          {truncate(notification.title, 30)}
                        </p>
                        <span
                          className="text-[11px] opacity-60 whitespace-nowrap flex-shrink-0 ml-2"
                          style={{ minWidth: "50px", textAlign: "right" }}
                        >
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                      </div>
                      <p
                        className="text-xs opacity-80 line-clamp-2"
                        style={{ maxWidth: "250px" }}
                      >
                        {truncate(notification.message, 50)}
                      </p>
                    </div>
                  </div>
                  {selectMode && (
                    <div className="flex-shrink-0">
                      <input
                        type="checkbox"
                        className="w-4 h-4 cursor-pointer"
                        checked={isSelected}
                        onChange={() => handleSelect(notification._id)}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </div>
                  )}
                </button>
              );
            })}
            {isLoading && (
              <div className="flex items-center justify-center gap-2 px-4 py-4 text-xs text-center opacity-80">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            )}
            {!isLoading && hasNext && items.length > 0 && (
              <div className="px-4 py-3 text-xs text-center opacity-60 animate-pulse">
                Scroll to load more...
              </div>
            )}
            <div ref={sentinelRef} />
          </div>

          <div className="flex items-center justify-between px-4 py-3 text-xs border-t border-slate-200/30">
            <button
              onClick={handleMarkAllAsRead}
              className="font-medium text-indigo-500 hover:text-indigo-400"
            >
              Mark all as read
            </button>
            <button
              onClick={closeDropdown}
              className="text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {detailNotification && (
        <DetailModal
          isDarkMode={isDarkMode}
          notification={detailNotification}
          onClose={() => setDetailNotification(null)}
        />
      )}
      {confirmDelete.open && (
        <ConfirmDeleteModal
          count={confirmDelete.ids.length}
          isDarkMode={isDarkMode}
          onCancel={() => setConfirmDelete({ open: false, ids: [] })}
          onConfirm={handleConfirmDelete}
        />
      )}
      {isCreateOpen && (
        <CreateNotificationModal
          isDarkMode={isDarkMode}
          role={role}
          onClose={() => setIsCreateOpen(false)}
          onCreated={async () => {
            await fetchNotifications({ reset: true });
            setIsCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}

interface DetailModalProps {
  notification: NotificationItem;
  isDarkMode: boolean;
  onClose: () => void;
}

function DetailModal({ notification, isDarkMode, onClose }: DetailModalProps) {
  const modalContent: ReactNode = (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 px-4 notification-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        className={classNames(
          "w-full max-w-lg rounded-2xl shadow-2xl p-6 relative notification-modal-content",
          isDarkMode ? "bg-slate-900 text-white" : "bg-white text-slate-900"
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          aria-label="Close notification detail"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
          onClick={onClose}
        >
          ✕
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-12 h-12 text-lg font-semibold text-white bg-indigo-500 rounded-full">
            {getSenderInitial(notification)}
          </div>
          <div>
            <p className="text-sm tracking-wide text-indigo-400 uppercase">
              {notification.recipientType === "course" ? "Course" : "System"}
            </p>
            <p className="text-xs opacity-70">
              {formatRelativeTime(notification.createdAt)}
            </p>
            <p className="mt-1 text-sm font-medium">
              From: {getSenderDisplayName(notification)}
            </p>
          </div>
        </div>
        <h3 className="mb-3 text-xl font-semibold">{notification.title}</h3>
        <p className="text-sm leading-relaxed whitespace-pre-line">
          {notification.message}
        </p>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return <>{modalContent}</>;
  }

  return createPortal(modalContent, document.body);
}

interface ConfirmDeleteModalProps {
  count: number;
  isDarkMode: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

function ConfirmDeleteModal({
  count,
  isDarkMode,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const content = (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 px-4 notification-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <div
        className={classNames(
          "w-full max-w-sm rounded-2xl shadow-xl p-6 notification-modal-content",
          isDarkMode ? "bg-slate-900 text-white" : "bg-white text-slate-900"
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h3 className="mb-2 text-lg font-semibold">Remove notifications?</h3>
        <p className="mb-6 text-sm opacity-80">
          Do you want to remove {count} notification{count === 1 ? "" : "s"}?
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border rounded-lg border-slate-300 hover:bg-slate-100/40"
          >
            No, keep them
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm text-white rounded-lg bg-rose-500 hover:bg-rose-600"
          >
            Yes, remove
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return <>{content}</>;
  }

  return createPortal(content, document.body);
}

interface CreateNotificationModalProps {
  isDarkMode: boolean;
  role: "admin" | "teacher" | "student";
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}

interface PagedResult<T> {
  items: T[];
  page: number;
  hasNext: boolean;
  loading: boolean;
  search: string;
  error?: string | null;
}

function CreateNotificationModal({
  isDarkMode,
  role,
  onClose,
  onCreated,
}: CreateNotificationModalProps) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [recipientType, setRecipientType] = useState<RecipientType>(
    role === "admin" ? "all" : "user"
  );
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    () => new Set()
  );
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(
    () => new Set()
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userState, setUserState] = useState<PagedResult<User>>({
    items: [],
    page: 1,
    hasNext: true,
    loading: false,
    search: "",
    error: null,
  });
  const [courseState, setCourseState] = useState<PagedResult<Course>>({
    items: [],
    page: 1,
    hasNext: true,
    loading: false,
    search: "",
    error: null,
  });
  const [userSearchInput, setUserSearchInput] = useState("");
  const [courseSearchInput, setCourseSearchInput] = useState("");
  const userSearchDebounceRef = useRef<number | null>(null);
  const courseSearchDebounceRef = useRef<number | null>(null);
  const userListRef = useRef<HTMLDivElement | null>(null);
  const userSentinelRef = useRef<HTMLDivElement | null>(null);
  const courseListRef = useRef<HTMLDivElement | null>(null);
  const courseSentinelRef = useRef<HTMLDivElement | null>(null);

  const canUseAll = role === "admin";
  const canUseCourse = role === "admin" || role === "teacher";

  useEffect(() => {
    return () => {
      if (userSearchDebounceRef.current) {
        window.clearTimeout(userSearchDebounceRef.current);
      }
      if (courseSearchDebounceRef.current) {
        window.clearTimeout(courseSearchDebounceRef.current);
      }
    };
  }, []);

  const loadUsers = useCallback(
    async (options?: { reset?: boolean; search?: string }) => {
      if (userState.loading) return;
      setUserState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const nextPage = options?.reset ? 1 : userState.page;
        const params = new URLSearchParams();
        params.append("page", String(nextPage));
        params.append("limit", "10");
        const searchTerm =
          options?.search !== undefined ? options.search : userState.search;
        if (searchTerm) params.append("search", searchTerm);
        const response = await http.get<User[]>(`/users?${params.toString()}`);
        const newItems = (response.data as User[]) ?? [];
        const apiPagination =
          (response as any).pagination ?? (response as any).meta?.pagination;
        const hasNext =
          apiPagination && typeof apiPagination === "object"
            ? Boolean(
                apiPagination.hasNext ??
                  apiPagination.hasNextPage ??
                  (typeof apiPagination.totalPages === "number" &&
                    typeof apiPagination.page === "number" &&
                    apiPagination.page < apiPagination.totalPages)
              )
            : newItems.length === 10;
        setUserState((prev) => ({
          ...prev,
          items: options?.reset ? newItems : [...prev.items, ...newItems],
          page: nextPage + 1,
          hasNext,
          loading: false,
          error: null,
        }));
      } catch (err) {
        console.error(err);
        setUserState((prev) => ({
          ...prev,
          loading: false,
          error:
            err instanceof Error
              ? err.message
              : "Failed to load users. Please retry.",
        }));
      }
    },
    [userState.page, userState.loading, userState.search]
  );

  const loadCourses = useCallback(
    async (options?: { reset?: boolean; search?: string }) => {
      if (courseState.loading) return;
      setCourseState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const nextPage = options?.reset ? 1 : courseState.page;
        const params = new URLSearchParams();
        params.append("page", String(nextPage));
        params.append("limit", "10");
        const searchTerm =
          options?.search !== undefined ? options.search : courseState.search;
        if (searchTerm) params.append("search", searchTerm);
        const response = await http.get<Course[]>(
          `/courses?${params.toString()}`
        );
        const newItems = (response.data as Course[]) ?? [];
        const apiPagination =
          (response as any).pagination ?? (response as any).meta?.pagination;
        const hasNext =
          apiPagination && typeof apiPagination === "object"
            ? Boolean(
                apiPagination.hasNext ??
                  apiPagination.hasNextPage ??
                  (typeof apiPagination.totalPages === "number" &&
                    typeof apiPagination.page === "number" &&
                    apiPagination.page < apiPagination.totalPages)
              )
            : newItems.length === 10;
        setCourseState((prev) => ({
          ...prev,
          items: options?.reset ? newItems : [...prev.items, ...newItems],
          page: nextPage + 1,
          hasNext,
          loading: false,
          error: null,
        }));
      } catch (err) {
        console.error(err);
        setCourseState((prev) => ({
          ...prev,
          loading: false,
          error:
            err instanceof Error
              ? err.message
              : "Failed to load courses. Please retry.",
        }));
      }
    },
    [courseState.page, courseState.loading, courseState.search]
  );

  const scheduleUserSearch = useCallback(
    (value: string) => {
      if (userSearchDebounceRef.current) {
        window.clearTimeout(userSearchDebounceRef.current);
      }
      userSearchDebounceRef.current = window.setTimeout(() => {
        setUserState((prev) => ({
          ...prev,
          search: value,
          page: 1,
          hasNext: true,
        }));
        loadUsers({ reset: true, search: value }).catch(() => undefined);
      }, 350);
    },
    [loadUsers]
  );

  const scheduleCourseSearch = useCallback(
    (value: string) => {
      if (courseSearchDebounceRef.current) {
        window.clearTimeout(courseSearchDebounceRef.current);
      }
      courseSearchDebounceRef.current = window.setTimeout(() => {
        setCourseState((prev) => ({
          ...prev,
          search: value,
          page: 1,
          hasNext: true,
        }));
        loadCourses({ reset: true, search: value }).catch(() => undefined);
      }, 350);
    },
    [loadCourses]
  );

  const handleUserSearchInputChange = useCallback(
    (value: string) => {
      setUserSearchInput(value);
      scheduleUserSearch(value);
    },
    [scheduleUserSearch]
  );

  const handleCourseSearchInputChange = useCallback(
    (value: string) => {
      setCourseSearchInput(value);
      scheduleCourseSearch(value);
    },
    [scheduleCourseSearch]
  );

  useEffect(() => {
    if (
      recipientType === "user" &&
      userState.items.length === 0 &&
      !userState.loading &&
      !userState.error
    ) {
      loadUsers({ reset: true }).catch(() => undefined);
    }
    if (
      recipientType === "course" &&
      courseState.items.length === 0 &&
      !courseState.loading &&
      !courseState.error
    ) {
      loadCourses({ reset: true }).catch(() => undefined);
    }
  }, [
    recipientType,
    userState.items.length,
    userState.loading,
    userState.error,
    courseState.items.length,
    courseState.loading,
    courseState.error,
    loadUsers,
    loadCourses,
  ]);

  useEffect(() => {
    if (recipientType !== "user") return;
    const listElement = userListRef.current;
    const sentinel = userSentinelRef.current;
    if (!listElement || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (
            entry.isIntersecting &&
            userState.hasNext &&
            !userState.loading &&
            !userState.error
          ) {
            loadUsers().catch(() => undefined);
          }
        });
      },
      { root: listElement, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    recipientType,
    userState.hasNext,
    userState.loading,
    userState.error,
    loadUsers,
  ]);

  useEffect(() => {
    if (recipientType !== "course") return;
    const listElement = courseListRef.current;
    const sentinel = courseSentinelRef.current;
    if (!listElement || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (
            entry.isIntersecting &&
            courseState.hasNext &&
            !courseState.loading &&
            !courseState.error
          ) {
            loadCourses().catch(() => undefined);
          }
        });
      },
      { root: listElement, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    recipientType,
    courseState.hasNext,
    courseState.loading,
    courseState.error,
    loadCourses,
  ]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!title.trim() || !message.trim()) {
      setError("Title and message are required.");
      return;
    }

    if (recipientType === "user" && selectedUserIds.size === 0) {
      setError("Please select at least one user.");
      return;
    }

    if (recipientType === "course" && selectedCourseIds.size === 0) {
      setError("Please select at least one course.");
      return;
    }

    try {
      setSubmitting(true);

      const basePayload = {
        title: title.trim(),
        message: message.trim(),
      };

      if (recipientType === "all") {
        await notificationService.createNotification({
          ...basePayload,
          recipientType: "all",
        });
      } else if (recipientType === "user") {
        const ids = Array.from(selectedUserIds);
        await Promise.all(
          ids.map((id) =>
            notificationService.createNotification({
              ...basePayload,
              recipientType: "user",
              recipientUser: id,
            })
          )
        );
      } else if (recipientType === "course") {
        const ids = Array.from(selectedCourseIds);
        await Promise.all(
          ids.map((id) =>
            notificationService.createNotification({
              ...basePayload,
              recipientType: "course",
              recipientCourse: id,
            })
          )
        );
      }

      await onCreated();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create notification. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const allowedRecipientTypes: RecipientType[] = [
    ...(canUseAll ? (["all"] as RecipientType[]) : []),
    "user",
    ...(canUseCourse ? (["course"] as RecipientType[]) : []),
  ];

  const overlayOnMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      event.stopPropagation();
      onClose();
    }
  };

  const modalBgClass = isDarkMode
    ? "bg-slate-900 text-white"
    : "bg-white text-slate-900";

  const content = (
    <div
      className="fixed inset-0 z-[135] flex items-center justify-center bg-black/50 px-4 notification-modal-overlay"
      onMouseDown={overlayOnMouseDown}
    >
      <div
        className={classNames(
          "w-full max-w-xl rounded-2xl shadow-2xl p-6 notification-modal-content",
          modalBgClass
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Create notification</h3>
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium tracking-wide uppercase opacity-70">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-transparent border rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium tracking-wide uppercase opacity-70">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium tracking-wide uppercase opacity-70">
              Recipient type
            </label>
            <div className="flex gap-2">
              {allowedRecipientTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setRecipientType(type)}
                  className={classNames(
                    "px-3 py-1 rounded-full text-xs border",
                    recipientType === type
                      ? "bg-indigo-500 text-white border-indigo-500"
                      : "border-slate-300 text-slate-600 hover:bg-slate-100/60"
                  )}
                >
                  {type === "all" ? "All" : type === "user" ? "User" : "Course"}
                </button>
              ))}
            </div>
          </div>

          {recipientType === "user" && (
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide uppercase opacity-70">
                Select users
              </label>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="opacity-70">
                  {selectedUserIds.size > 0
                    ? `${selectedUserIds.size} user${
                        selectedUserIds.size > 1 ? "s" : ""
                      } selected`
                    : "Select users to send notification"}
                </span>
                <button
                  type="button"
                  className="text-indigo-500 hover:text-indigo-400"
                  onClick={() => loadUsers({ reset: true })}
                  disabled={userState.loading}
                >
                  Refresh
                </button>
              </div>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={userSearchInput}
                onChange={(e) => handleUserSearchInputChange(e.target.value)}
                className="w-full px-3 py-2 mb-2 text-sm bg-transparent border rounded-lg"
              />
              <div
                ref={userListRef}
                className="overflow-y-auto text-xs border rounded-lg max-h-40"
              >
                {userState.items.map((u) => {
                  const isSelected = selectedUserIds.has(u._id);
                  const toggleUser = () => {
                    setSelectedUserIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(u._id)) {
                        next.delete(u._id);
                      } else {
                        next.add(u._id);
                      }
                      return next;
                    });
                  };
                  return (
                    <button
                      key={u._id}
                      type="button"
                      onClick={toggleUser}
                      className={classNames(
                        "w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-100/50",
                        isSelected && "bg-indigo-50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="h-3.5 w-3.5 accent-indigo-500"
                        />
                        <img
                          src={
                            (u as any).avatar_url ||
                            (u as any).profileImageUrl ||
                            "https://api.dicebear.com/9.x/thumbs/svg?seed=" +
                              encodeURIComponent(
                                u.username || u.fullname || "user"
                              )
                          }
                          alt={u.fullname || u.username}
                          className="flex-shrink-0 object-cover rounded-full h-7 w-7"
                        />
                        <div className="flex flex-col text-left">
                          <span className="font-medium">
                            {u.fullname || u.username}
                          </span>
                          {u.username && (
                            <span className="opacity-70 truncate max-w-[140px]">
                              {u.username}
                            </span>
                          )}
                        </div>
                      </div>
                      {u.role && (
                        <span className="ml-2 text-[11px] uppercase tracking-wide opacity-80">
                          {u.role}
                        </span>
                      )}
                    </button>
                  );
                })}
                {userState.loading && (
                  <div className="px-3 py-2 text-center text-[11px] opacity-70 flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading users...
                  </div>
                )}
                {userState.error && !userState.loading && (
                  <div className="px-3 py-2 text-center text-[11px] text-rose-500">
                    {userState.error}
                  </div>
                )}
                {!userState.loading &&
                  !userState.error &&
                  !userState.items.length && (
                    <div className="px-3 py-2 text-center text-[11px] opacity-70">
                      No users found
                    </div>
                  )}
                <div ref={userSentinelRef} />
              </div>
            </div>
          )}

          {recipientType === "course" && (
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide uppercase opacity-70">
                Select courses
              </label>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="opacity-70">
                  {selectedCourseIds.size > 0
                    ? `${selectedCourseIds.size} course${
                        selectedCourseIds.size > 1 ? "s" : ""
                      } selected`
                    : "Select courses to send notification"}
                </span>
                <button
                  type="button"
                  className="text-indigo-500 hover:text-indigo-400"
                  onClick={() => loadCourses({ reset: true })}
                  disabled={courseState.loading}
                >
                  Refresh
                </button>
              </div>
              <input
                type="text"
                placeholder="Search by title or code..."
                value={courseSearchInput}
                onChange={(e) => handleCourseSearchInputChange(e.target.value)}
                className="w-full px-3 py-2 mb-2 text-sm bg-transparent border rounded-lg"
              />
              <div
                ref={courseListRef}
                className="overflow-y-auto text-xs border rounded-lg max-h-40"
              >
                {courseState.items.map((c) => {
                  const id = ((c as any)._id ?? (c as any).id) as string;
                  const isSelected = selectedCourseIds.has(id);
                  const toggleCourse = () => {
                    setSelectedCourseIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) {
                        next.delete(id);
                      } else {
                        next.add(id);
                      }
                      return next;
                    });
                  };
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={toggleCourse}
                      className={classNames(
                        "w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-100/50",
                        isSelected && "bg-indigo-50"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="h-3.5 w-3.5 mt-1 accent-indigo-500"
                        />
                        <img
                          src={
                            (c as any).logo ||
                            "https://api.dicebear.com/9.x/shapes/svg?seed=" +
                              encodeURIComponent(
                                (c as any).title || (c as any).code || "course"
                              )
                          }
                          alt={(c as any).title || (c as any).code}
                          className="flex-shrink-0 object-cover w-8 h-8 rounded-md"
                        />
                        <div className="flex flex-col text-left">
                          <span className="font-medium">
                            {(c as any).title ?? (c as any).code}
                          </span>
                          {(c as any).code && (
                            <span className="opacity-70 text-[11px]">
                              Code: {(c as any).code}
                            </span>
                          )}
                          {(c as any).description && (
                            <span className="opacity-70 text-[11px] line-clamp-2">
                              {(c as any).description}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {courseState.loading && (
                  <div className="px-3 py-2 text-center text-[11px] opacity-70 flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading courses...
                  </div>
                )}
                {courseState.error && !courseState.loading && (
                  <div className="px-3 py-2 text-center text-[11px] text-rose-500">
                    {courseState.error}
                  </div>
                )}
                {!courseState.loading &&
                  !courseState.error &&
                  !courseState.items.length && (
                    <div className="px-3 py-2 text-center text-[11px] opacity-70">
                      No courses found
                    </div>
                  )}
                <div ref={courseSentinelRef} />
              </div>
            </div>
          )}

          {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded-lg border-slate-300 hover:bg-slate-100/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-indigo-500 rounded-lg hover:bg-indigo-600 disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return <>{content}</>;
  }

  return createPortal(content, document.body);
}
