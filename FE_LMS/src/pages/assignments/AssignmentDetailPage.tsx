import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import Navbar from "../../components/layout/Navbar.tsx";
import Sidebar from "../../components/layout/Sidebar.tsx";
import {
  SubmissionModal,
  ViewSubmissionModal,
  AllSubmissionsModal,
  GradeSubmissionModal,
  AssignmentStatsModal,
  AssignmentReportModal,
} from "../../components";
import { httpClient } from "../../utils/http";
import {
  ArrowLeft,
  Calendar,
  User,
  Award,
  Clock,
  FileText,
  Upload,
  Eye,
  BarChart3,
  ClipboardList,
  X,
} from "lucide-react";

interface Course {
  _id: string;
  title: string;
  code?: string;
}

interface CreatedBy {
  _id: string;
  username: string;
  email: string;
  fullname: string;
}

interface Assignment {
  _id: string;
  courseId: Course;
  title: string;
  description: string;
  createdBy: CreatedBy;
  maxScore: number;
  dueDate: string;
  allowLate: boolean;
  createdAt: string;
  updatedAt: string;
  fileOriginalName?: string;
  fileMimeType?: string;
  fileKey?: string;
  fileSize?: number;
  publicURL?: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data: Assignment;
}

interface AssignmentStatsData {
  totalStudents?: number;
  submissionRate?: string | number;
  onTimeRate?: string | number;
  averageGrade?: number;
}

interface SubmissionReportData {
  stats?: AssignmentStatsData;
  distribution?: Array<{
    range: string;
    count: number;
    percentage: string;
  }>;
  details?: Array<{
    _id: string;
    grade?: number;
    submittedAt?: string;
    studentId?: {
      fullname?: string;
      email?: string;
    };
  }>;
}

const AssignmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const { user } = useAuth();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingFile, setViewingFile] = useState<{
    url: string;
    mimeType: string;
    name: string;
    size?: number;
  } | null>(null);

  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [showViewSubmissionModal, setShowViewSubmissionModal] = useState(false);
  const [showAllSubmissionsModal, setShowAllSubmissionsModal] = useState(false);

  const [allSubmissions, setAllSubmissions] = useState<
    Array<{
      _id: string;
      studentId: { fullname?: string; email: string };
      originalName?: string;
      size?: number;
      submittedAt?: string;
      isLate?: boolean;
      status?: string;
      grade?: number;
      feedback?: string;
      key?: string;
    }>
  >([]);

  const [loadingAllSubmissions, setLoadingAllSubmissions] = useState(false);

  const [submissionStatus, setSubmissionStatus] = useState<{
    status: string;
    message?: string;
    isLate?: boolean;
    grade?: number;
    feedback?: string;
    submittedAt?: string;
  } | null>(null);

  const [submissionDetails, setSubmissionDetails] = useState<{
    _id?: string;
    status: string;
    isLate?: boolean;
    grade?: number;
    feedback?: string;
    submittedAt?: string;
    originalName?: string;
    size?: number;
    key?: string;
  } | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingSubmission, setLoadingSubmission] = useState(false);

  const [gradingSubmission, setGradingSubmission] = useState<{
    _id: string;
    grade?: number;
    feedback?: string;
  } | null>(null);
  const [gradingGrade, setGradingGrade] = useState<string>("");
  const [gradingFeedback, setGradingFeedback] = useState<string>("");
  const [grading, setGrading] = useState(false);

  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [statsData, setStatsData] = useState<AssignmentStatsData | null>(null);
  const [reportData, setReportData] = useState<SubmissionReportData | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Viewer state cho Assignment File
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerObjectUrl, setViewerObjectUrl] = useState<string | null>(null);

  // === Resize state (giống LessonMaterial) ===
  const [popupSize, setPopupSize] = useState<{ width: number; height: number }>(
    { width: 0, height: 0 }
  );
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>({ x: 0, y: 0, width: 0, height: 0 });
  const [resizeMode, setResizeMode] = useState<
    "horizontal" | "vertical" | null
  >(null);

  const popupRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const sizeRef = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const rafRef = useRef<number | null>(null);
  const resizingRef = useRef(false);

  const normalizedRole = user?.role?.toLowerCase();
  const getSubmissionCacheKey = (assignmentId: string) =>
    `submission:${assignmentId}`;

  const fetchSubmissionDetailsById = async (submissionId: string) => {
    try {
      const response = await httpClient.get(`/submissions/${submissionId}`, {
        withCredentials: true,
      });
      if (response.data?.success) {
        return response.data.data;
      }
    } catch (error) {
      console.error("Error fetching submission details:", error);
    }
    return null;
  };

  const scrubMessage = (message: string): string => {
    if (!message) return "";
    return message
      .replace(/https?:\/\/[^\s]+/gi, "")
      .replace(/localhost[^\s]*/gi, "")
      .replace(/[^\s]+\.(com|net|org|edu|io|dev)[^\s]*/gi, "")
      .trim()
      .replace(/\s+/g, " ");
  };

  const showSwalError = async (message: string) => {
    try {
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: scrubMessage(message),
        confirmButtonColor: darkMode ? "#4c1d95" : "#4f46e5",
        background: darkMode ? "#1f2937" : "#ffffff",
        color: darkMode ? "#ffffff" : "#1e293b",
        didOpen: () => {
          const swalContainer = document.querySelector(
            ".swal2-container"
          ) as HTMLElement;
          const swalBackdrop = document.querySelector(
            ".swal2-backdrop-show"
          ) as HTMLElement;
          if (swalContainer) swalContainer.style.zIndex = "99999";
          if (swalBackdrop) swalBackdrop.style.zIndex = "99998";
        },
      });
    } catch {
      alert(scrubMessage(message));
    }
  };

  const showSwalSuccess = async (message: string) => {
    try {
      const Swal = (await import("sweetalert2")).default;
      await Swal.fire({
        icon: "success",
        title: "Success",
        text: scrubMessage(message),
        confirmButtonColor: darkMode ? "#4c1d95" : "#4f46e5",
        background: darkMode ? "#1f2937" : "#ffffff",
        color: darkMode ? "#ffffff" : "#1e293b",
        didOpen: () => {
          const swalContainer = document.querySelector(
            ".swal2-container"
          ) as HTMLElement;
          const swalBackdrop = document.querySelector(
            ".swal2-backdrop-show"
          ) as HTMLElement;
          if (swalContainer) swalContainer.style.zIndex = "99999";
          if (swalBackdrop) swalBackdrop.style.zIndex = "99998";
        },
      });
    } catch {
      alert(scrubMessage(message));
    }
  };

  useEffect(() => {
    if (id) {
      fetchAssignment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    console.log("AssignmentDetailPage - User:", user);
    console.log("AssignmentDetailPage - User role:", user?.role);

    if (assignment?._id && user?.role?.toLowerCase() === "student") {
      fetchSubmissionStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment?._id, user?.role]);

  // ESC + lock scroll cho viewer
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isViewerOpen) {
        closeAssignmentViewer();
      }
    };
    if (isViewerOpen) {
      window.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isViewerOpen]);

  // Khởi tạo size popup lần đầu mở
  useEffect(() => {
    if (isViewerOpen && popupSize.width === 0) {
      const w = window.innerWidth * 0.9;
      const h = window.innerHeight * 0.9;
      setPopupSize({ width: w, height: h });
      sizeRef.current = { width: w, height: h };
    }
  }, [isViewerOpen, popupSize.width]);

  // Resize logic (copy từ LessonMaterial, rút gọn)
  useEffect(() => {
    if (!isResizing || !resizeMode) {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      return;
    }

    document.body.style.cursor =
      resizeMode === "horizontal" ? "ew-resize" : "ns-resize";
    document.body.style.userSelect = "none";
    resizingRef.current = true;

    if (contentRef.current) {
      contentRef.current.style.pointerEvents = "none";
      contentRef.current.style.willChange = "opacity";
      contentRef.current.style.transform = "translateZ(0)";
    }

    const frameUpdate = (nextWidth?: number, nextHeight?: number) => {
      if (!popupRef.current) return;
      if (typeof nextWidth === "number") {
        popupRef.current.style.width = `${nextWidth}px`;
      }
      if (typeof nextHeight === "number") {
        popupRef.current.style.height = `${nextHeight}px`;
      }
    };

    const onMove = (e: MouseEvent) => {
      e.preventDefault();
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      const baseW =
        resizeStart.width || sizeRef.current.width || window.innerWidth * 0.9;
      const baseH =
        resizeStart.height ||
        sizeRef.current.height ||
        window.innerHeight * 0.9;

      let w = sizeRef.current.width || baseW;
      let h = sizeRef.current.height || baseH;

      if (resizeMode === "horizontal") {
        w = Math.max(400, Math.min(window.innerWidth - 40, baseW + deltaX));
      }
      if (resizeMode === "vertical") {
        h = Math.max(300, Math.min(window.innerHeight - 40, baseH + deltaY));
      }

      sizeRef.current = { width: w, height: h };

      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          frameUpdate(
            resizeMode === "horizontal" ? w : undefined,
            resizeMode === "vertical" ? h : undefined
          );
        });
      }
    };

    const onUp = () => {
      resizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      if (contentRef.current) {
        contentRef.current.style.pointerEvents = "";
        contentRef.current.style.willChange = "";
        contentRef.current.style.transform = "";
      }

      setPopupSize({ ...sizeRef.current });

      setIsResizing(false);
      setResizeMode(null);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, resizeMode, resizeStart]);

  const handleResizeStart = (
    e: React.MouseEvent,
    mode: "horizontal" | "vertical"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeMode(mode);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: popupSize.width || window.innerWidth * 0.9,
      height: popupSize.height || window.innerHeight * 0.9,
    });
  };

  const fetchSubmissionStatus = async () => {
    if (!assignment?._id) return;
    try {
      const response = await httpClient.get(
        `/submissions/${assignment._id}/status`,
        {
          withCredentials: true,
        }
      );
      if (response.data?.success) {
        const statusData = response.data.data;
        setSubmissionStatus(statusData);

        if (statusData.status !== "not_submitted") {
          const cacheKey = getSubmissionCacheKey(assignment._id);
          const cachedId = (() => {
            try {
              return localStorage.getItem(cacheKey);
            } catch {
              return null;
            }
          })();

          const submissionId =
            statusData._id || statusData.submissionId || cachedId;
          let details = statusData;

          if (submissionId) {
            if (!statusData._id) {
              try {
                localStorage.setItem(cacheKey, submissionId);
              } catch {
                // ignore
              }
            }
            const submissionData = await fetchSubmissionDetailsById(
              submissionId
            );
            if (submissionData) {
              details = {
                ...submissionData,
                status: submissionData.status || statusData.status,
                grade: submissionData.grade ?? statusData.grade,
                feedback: submissionData.feedback ?? statusData.feedback,
                submittedAt:
                  submissionData.submittedAt || statusData.submittedAt,
              };
            } else {
              details = { ...statusData, _id: submissionId };
            }
          }

          setSubmissionDetails(details);
        } else {
          setSubmissionDetails(null);
        }
      }
    } catch (error) {
      console.error("Error fetching submission status:", error);
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { data?: { message?: string } };
        };
        const errorMessage = axiosError.response?.data?.message || "";
        if (
          errorMessage.includes("Student not found") ||
          errorMessage.includes("Missing user ID")
        ) {
          console.warn("User may not be a student or authentication issue");
        }
      }
    }
  };

  const handleViewSubmission = async () => {
    if (!assignment?._id) return;
    setLoadingSubmission(true);
    try {
      const response = await httpClient.get(
        `/submissions/${assignment._id}/status`,
        {
          withCredentials: true,
        }
      );
      if (
        response.data?.success &&
        response.data.data.status !== "not_submitted"
      ) {
        const statusData = response.data.data;
        const cacheKey = getSubmissionCacheKey(assignment._id);
        const cachedId = (() => {
          try {
            return localStorage.getItem(cacheKey);
          } catch {
            return null;
          }
        })();
        const submissionId =
          statusData._id || statusData.submissionId || cachedId;
        let details = statusData;

        if (submissionId) {
          try {
            localStorage.setItem(cacheKey, submissionId);
          } catch {
            // ignore
          }
          const submissionData = await fetchSubmissionDetailsById(submissionId);
          if (submissionData) {
            details = {
              ...submissionData,
              status: submissionData.status || statusData.status,
              grade: submissionData.grade ?? statusData.grade,
              feedback: submissionData.feedback ?? statusData.feedback,
              submittedAt: submissionData.submittedAt || statusData.submittedAt,
            };
          } else {
            details = { ...statusData, _id: submissionId };
          }
        }

        setSubmissionDetails(details);
        setShowViewSubmissionModal(true);
      } else {
        await showSwalError("You haven't submitted this assignment yet.");
      }
    } catch (error) {
      console.error("Error fetching submission:", error);
      let errorMessage = "Failed to load submission";
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        errorMessage =
          axiosError.response?.data?.message ||
          axiosError.message ||
          errorMessage;
      }
      await showSwalError(errorMessage);
    } finally {
      setLoadingSubmission(false);
    }
  };

  const handleViewAllSubmissions = async () => {
    if (!assignment?._id) {
      console.error("Assignment ID is missing");
      return;
    }
    setLoadingAllSubmissions(true);
    setShowAllSubmissionsModal(true);
    try {
      const response = await httpClient.get(
        `/submissions/${assignment._id}/all`,
        {
          withCredentials: true,
        }
      );
      if (response.data?.success) {
        const submissions = Array.isArray(response.data.data)
          ? response.data.data
          : [];
        setAllSubmissions(submissions);
      } else {
        setAllSubmissions([]);
      }
    } catch (error) {
      console.error("Error fetching all submissions:", error);
      let errorMessage = "Failed to load submissions";
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        errorMessage =
          axiosError.response?.data?.message ||
          axiosError.message ||
          errorMessage;
      }
      await showSwalError(errorMessage);
      setAllSubmissions([]);
    } finally {
      setLoadingAllSubmissions(false);
    }
  };

  const handleDownloadSubmission = async (submissionId: string) => {
    try {
      const response = await httpClient.get(`/submissions/${submissionId}`, {
        withCredentials: true,
      });
      if (response.data?.success && response.data.data?.publicURL) {
        window.open(response.data.data.publicURL, "_blank");
      } else {
        await showSwalError("Failed to get download URL");
      }
    } catch (error) {
      console.error("Error downloading submission:", error);
      let errorMessage = "Failed to download file";
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        errorMessage =
          axiosError.response?.data?.message ||
          axiosError.message ||
          errorMessage;
      }
      await showSwalError(errorMessage);
    }
  };

  const handleDownloadAssignmentFile = async () => {
    if (!assignment?.publicURL) {
      await showSwalError("Assignment file is not available for download.");
      return;
    }
    window.open(assignment.publicURL, "_blank");
  };

  const handleViewAssignmentReport = async () => {
    if (!assignment?._id) {
      await showSwalError(
        "Assignment not found. Please reload the page and try again."
      );
      return;
    }
    setShowReportModal(true);
    setLoadingReport(true);
    try {
      const response = await httpClient.get(
        `/submissions/${assignment._id}/report`,
        {
          withCredentials: true,
        }
      );
      if (response.data?.success) {
        const data = response.data.data;
        const externalUrl =
          data?.publicURL || data?.url || data?.link || data?.reportUrl;
        if (externalUrl) {
          window.open(externalUrl, "_blank");
          setShowReportModal(false);
          setReportData(null);
        } else {
          setReportData(data || null);
        }
      } else {
        setShowReportModal(false);
        setReportData(null);
        await showSwalError(
          scrubMessage(response.data?.message || "Failed to fetch report")
        );
      }
    } catch (error) {
      console.error("Error fetching submission report:", error);
      setShowReportModal(false);
      setReportData(null);
      let errorMessage = "Failed to fetch report";
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        errorMessage =
          axiosError.response?.data?.message ||
          axiosError.message ||
          errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      await showSwalError(scrubMessage(errorMessage));
    } finally {
      setLoadingReport(false);
    }
  };

  const handleViewAssignmentStats = async () => {
    if (!assignment?._id) {
      await showSwalError(
        "Assignment not found. Please reload the page and try again."
      );
      return;
    }
    setShowStatsModal(true);
    setLoadingStats(true);
    try {
      const response = await httpClient.get(
        `/submissions/${assignment._id}/stats`,
        {
          withCredentials: true,
        }
      );
      if (response.data?.success) {
        const data = response.data.data;
        const externalUrl =
          data?.publicURL || data?.url || data?.link || data?.statsUrl;
        if (externalUrl) {
          window.open(externalUrl, "_blank");
          setShowStatsModal(false);
          setStatsData(null);
        } else {
          setStatsData(data || null);
        }
      } else {
        setShowStatsModal(false);
        setStatsData(null);
        await showSwalError(
          scrubMessage(response.data?.message || "Failed to fetch statistics")
        );
      }
    } catch (error) {
      console.error("Error fetching submission statistics:", error);
      setShowStatsModal(false);
      setStatsData(null);
      let errorMessage = "Failed to fetch statistics";
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        errorMessage =
          axiosError.response?.data?.message ||
          axiosError.message ||
          errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      await showSwalError(errorMessage);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleGradeSubmission = async (submissionId: string) => {
    if (!gradingGrade || gradingGrade === "") {
      await showSwalError("Please enter a grade");
      return;
    }

    const grade = parseFloat(gradingGrade);
    if (isNaN(grade) || grade < 0) {
      await showSwalError("Please enter a valid grade (>= 0)");
      return;
    }

    if (assignment && grade > assignment.maxScore) {
      await showSwalError(
        `Grade cannot exceed maximum score of ${assignment.maxScore}`
      );
      return;
    }

    setGrading(true);
    try {
      await httpClient.put(
        `/submissions/by-submission/${submissionId}/grade`,
        {
          grade,
          feedback: gradingFeedback || undefined,
        },
        {
          withCredentials: true,
        }
      );

      await showSwalSuccess("Submission graded successfully!");
      setGradingSubmission(null);
      setGradingGrade("");
      setGradingFeedback("");
      await handleViewAllSubmissions();
    } catch (error) {
      console.error("Error grading submission:", error);
      let errorMessage = "Failed to grade submission";
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        errorMessage =
          axiosError.response?.data?.message ||
          axiosError.message ||
          errorMessage;
      }
      await showSwalError(errorMessage);
    } finally {
      setGrading(false);
    }
  };

  const fetchAssignment = async () => {
    if (!id) return;

    setLoading(true);
    setError("");
    try {
      const response = await httpClient.get<ApiResponse>(`/assignments/${id}`, {
        withCredentials: true,
      });

      const data = response.data;
      if (data.success && data.data) {
        setAssignment(data.data);
      } else {
        setError(data.message || "Failed to load assignment");
      }
    } catch (err) {
      console.error("Error fetching assignment:", err);
      let errorMessage = "An error occurred while fetching assignment";
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        errorMessage =
          axiosError.response?.data?.message ||
          axiosError.message ||
          errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes && bytes !== 0) return "";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDueDateStatus = (dueDate: string) => {
    const daysUntilDue = getDaysUntilDue(dueDate);
    if (daysUntilDue < 0) {
      return {
        text: "Overdue",
        color: darkMode ? "#fca5a5" : "#dc2626",
        bg: darkMode ? "rgba(239, 68, 68, 0.2)" : "rgba(239, 68, 68, 0.1)",
      };
    } else if (daysUntilDue === 0) {
      return {
        text: "Due today",
        color: darkMode ? "#fbbf24" : "#d97706",
        bg: darkMode ? "rgba(251, 191, 36, 0.2)" : "rgba(251, 191, 36, 0.1)",
      };
    } else if (daysUntilDue <= 3) {
      return {
        text: `Due in ${daysUntilDue} day${daysUntilDue > 1 ? "s" : ""}`,
        color: darkMode ? "#fbbf24" : "#d97706",
        bg: darkMode ? "rgba(251, 191, 36, 0.2)" : "rgba(251, 191, 36, 0.1)",
      };
    } else {
      return {
        text: `Due in ${daysUntilDue} days`,
        color: darkMode ? "#86efac" : "#16a34a",
        bg: darkMode ? "rgba(34, 197, 94, 0.2)" : "rgba(34, 197, 94, 0.1)",
      };
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const maxSize = 20 * 1024 * 1024; // logic 20MB nhưng message 5MB (giữ nguyên theo code cũ)
      if (file.size > maxSize) {
        await showSwalError(
          `File size exceeds the maximum limit of 5MB. Your file is ${(
            file.size /
            (1024 * 1024)
          ).toFixed(2)}MB.`
        );
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }
      setSelectedFile(file);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmitAssignment = async () => {
    if (!selectedFile || !assignment?._id) {
      await showSwalError("Please select a file to submit.");
      return;
    }

    if (!user) {
      await showSwalError(
        "You must be logged in to submit assignments. Please log in and try again."
      );
      return;
    }

    const userRole = user.role?.toLowerCase();
    if (userRole !== "student") {
      await showSwalError(
        `Only students can submit assignments. Your current role is: ${
          user.role || "unknown"
        }. Please contact an administrator if you believe this is an error.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("assignmentId", assignment._id);

      const isResubmit =
        submissionStatus?.status && submissionStatus.status !== "not_submitted";
      const method = isResubmit ? "put" : "post";

      const response = await httpClient[method]("/submissions", formData, {
        withCredentials: true,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data?.success) {
        const submissionData = response.data.data;
        if (submissionData?._id) {
          try {
            localStorage.setItem(
              getSubmissionCacheKey(assignment._id),
              submissionData._id
            );
          } catch {
            // ignore
          }
        }
        await showSwalSuccess(
          isResubmit
            ? "Assignment resubmitted successfully!"
            : "Assignment submitted successfully!"
        );
        setShowSubmissionModal(false);
        setSelectedFile(null);
        clearFile();
        await fetchSubmissionStatus();
      } else {
        throw new Error(
          response.data?.message || "Failed to submit assignment"
        );
      }
    } catch (error) {
      console.error("Error submitting assignment:", error);
      let errorMessage = "Failed to submit assignment";
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        errorMessage =
          axiosError.response?.data?.message ||
          axiosError.message ||
          errorMessage;

        if (
          errorMessage.includes("Student not found") ||
          errorMessage.includes("Missing user ID")
        ) {
          errorMessage =
            "You must be logged in as a student to submit assignments. Please check your account role.";
        } else if (errorMessage.includes("deadline has expired")) {
          errorMessage =
            "The submission deadline has expired. Late submissions are not allowed.";
        } else if (errorMessage.includes("already submitted")) {
          errorMessage =
            "You have already submitted this assignment. Resubmission is not allowed.";
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      await showSwalError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // ===== Viewer cho Assignment File =====

  const closeAssignmentViewer = () => {
    setIsViewerOpen(false);
    setViewerLoading(false);
    if (viewerObjectUrl) {
      URL.revokeObjectURL(viewerObjectUrl);
      setViewerObjectUrl(null);
    }
    setPopupSize({ width: 0, height: 0 });
    sizeRef.current = { width: 0, height: 0 };
    setViewingFile(null);
  };

  const handleViewAssignmentFilePreview = async () => {
    if (!assignment?.publicURL || !assignment.fileMimeType) {
      await showSwalError("Assignment file is not available for preview.");
      return;
    }

    setViewingFile({
      url: assignment.publicURL,
      mimeType: assignment.fileMimeType,
      name: assignment.fileOriginalName || "Assignment File",
      size: assignment.fileSize,
    });

    setIsViewerOpen(true);
    setViewerLoading(true);

    try {
      if (viewerObjectUrl) {
        URL.revokeObjectURL(viewerObjectUrl);
      }
      setViewerObjectUrl(null);
    } catch (error) {
      console.error("Error preparing assignment file for viewing:", error);
      await showSwalError("Failed to load assignment file for viewing");
      closeAssignmentViewer();
    } finally {
      setViewerLoading(false);
    }
  };

  const handleViewSubmissionFile = async (submission: any) => {
    try {
      setLoadingAllSubmissions(true);
      const response = await httpClient.get(`/submissions/${submission._id}`, {
        withCredentials: true,
      });
      if (response.data?.success && response.data.data?.publicURL) {
        const subData = response.data.data;
        const mimeType = (subData.fileMimeType || "").toLowerCase();

        setViewingFile({
          url: subData.publicURL,
          mimeType: mimeType || "application/octet-stream",
          name:
            subData.originalName ||
            subData.fileOriginalName ||
            "Submission File",
          size: subData.size || subData.fileSize,
        });

        setIsViewerOpen(true);
        setViewerLoading(true);

        if (viewerObjectUrl) {
          URL.revokeObjectURL(viewerObjectUrl);
        }
        setViewerObjectUrl(null);
      } else {
        await showSwalError("Failed to get submission file URL");
      }
    } catch (error) {
      console.error("Error viewing submission:", error);
      await showSwalError("Failed to view submission file");
    } finally {
      setLoadingAllSubmissions(false);
      setViewerLoading(false);
    }
  };

  const renderAssignmentViewerContent = () => {
    const file =
      viewingFile ||
      (assignment && assignment.fileMimeType
        ? {
            url: assignment.publicURL!,
            mimeType: assignment.fileMimeType,
            name: assignment.fileOriginalName || "Assignment",
            size: assignment.fileSize,
          }
        : null);

    if (!file) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8">
          <FileText
            size={64}
            style={{
              color: darkMode ? "#9ca3af" : "#6b7280",
              marginBottom: "1rem",
            }}
          />
          <p
            style={{
              color: darkMode ? "#d1d5db" : "#6b7280",
              marginBottom: "1rem",
            }}
          >
            No preview available for this file.
          </p>
        </div>
      );
    }

    if (viewerLoading) {
      return (
        <div className="flex items-center justify-center p-10">
          <div
            className="animate-spin rounded-full h-10 w-10 border-b-2"
            style={{ borderColor: darkMode ? "#a5b4fc" : "#4f46e5" }}
          />
        </div>
      );
    }

    const mimeType = file.mimeType.toLowerCase();
    const fileName = (file.name || "").toLowerCase();
    const baseUrl = file.url;
    const srcUrl = viewerObjectUrl || baseUrl;

    if (mimeType.includes("pdf") || fileName.endsWith(".pdf")) {
      return (
        <iframe
          src={srcUrl}
          className="w-full h-full border-0"
          title={file.name || "PDF Viewer"}
          style={{ backgroundColor: "#fff" }}
        />
      );
    }

    if (
      mimeType.startsWith("image/") ||
      /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName)
    ) {
      return (
        <div className="flex items-center justify-center p-4 h-full">
          <img
            src={srcUrl}
            alt={file.name || "Image"}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      );
    }

    if (
      mimeType.startsWith("video/") ||
      /\.(mp4|webm|ogg|mov)$/i.test(fileName)
    ) {
      return (
        <div className="flex items-center justify-center p-4 h-full">
          <video src={srcUrl} controls className="max-w-full max-h-full">
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    if (mimeType.startsWith("text/")) {
      return (
        <iframe
          src={srcUrl}
          className="w-full h-full border-0"
          title={file.name || "Text Viewer"}
          style={{ backgroundColor: "#fff" }}
        />
      );
    }

    if (
      mimeType.includes("word") ||
      mimeType.includes("excel") ||
      mimeType.includes("powerpoint") ||
      mimeType.includes("presentation") ||
      mimeType.includes("spreadsheet") ||
      file.name?.match(/\.(doc|docx|xls|xlsx|ppt|pptx)$/i)
    ) {
      const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(
        baseUrl
      )}&embedded=true`;
      return (
        <iframe
          src={viewerUrl}
          className="w-full h-full border-0"
          title={file.name || "Document Viewer"}
          style={{ backgroundColor: "#fff" }}
        />
      );
    }

    return (
      <div className="flex flex-col items-center justify-center p-8 h-full">
        <FileText
          size={64}
          style={{
            color: darkMode ? "#9ca3af" : "#6b7280",
            marginBottom: "1rem",
          }}
        />
        <p
          className="text-center mb-4"
          style={{ color: darkMode ? "#d1d5db" : "#6b7280" }}
        >
          This file type cannot be previewed directly.
        </p>
        <p
          className="text-center text-sm mb-4"
          style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
        >
          Please download the file to view it.
        </p>
        <button
          onClick={() => window.open(file.url, "_blank")}
          className="px-4 py-2 rounded-lg text-white transition-all duration-200 hover:shadow-lg flex items-center"
          style={{ backgroundColor: darkMode ? "#059669" : "#10b981" }}
        >
          <FileText size={20} className="mr-2" />
          Download to view
        </button>
      </div>
    );
  };

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{
        backgroundColor: darkMode ? "#1a202c" : "#f8fafc",
        color: darkMode ? "#ffffff" : "#1e293b",
      }}
    >
      <Navbar />
      <Sidebar
        role={(user?.role as "admin" | "teacher" | "student") || "student"}
      />

      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 mt-16 sm:pl-24 md:pl-28">
          <div className="max-w-4xl mx-auto px-4">
            {/* Header */}
            <div className="mb-8">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center mb-4 text-sm hover:opacity-80 transition-opacity"
                style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
              >
                <ArrowLeft size={20} className="mr-2" />
                Back to Assignments
              </button>

              {/* Assignment Information */}
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div
                    className="animate-spin rounded-full h-8 w-8 border-b-2"
                    style={{
                      borderColor: darkMode ? "#6366f1" : "#4f46e5",
                    }}
                  ></div>
                </div>
              ) : error ? (
                <div
                  className="p-4 rounded-lg mb-6 flex items-center"
                  style={{
                    backgroundColor: darkMode
                      ? "rgba(239, 68, 68, 0.1)"
                      : "#fee2e2",
                    color: darkMode ? "#fca5a5" : "#dc2626",
                  }}
                >
                  <svg
                    className="w-5 h-5 mr-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {error}
                </div>
              ) : assignment ? (
                <div
                  className="rounded-lg shadow-md overflow-hidden mb-6 p-6"
                  style={{
                    backgroundColor: darkMode
                      ? "rgba(31, 41, 55, 0.8)"
                      : "rgba(255, 255, 255, 0.9)",
                    border: darkMode
                      ? "1px solid rgba(75, 85, 99, 0.3)"
                      : "1px solid rgba(229, 231, 235, 0.5)",
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span
                      className="inline-block px-3 py-1 text-xs font-semibold rounded-full"
                      style={{
                        backgroundColor: darkMode
                          ? "rgba(99, 102, 241, 0.2)"
                          : "rgba(99, 102, 241, 0.1)",
                        color: darkMode ? "#a5b4fc" : "#6366f1",
                      }}
                    >
                      {assignment.courseId.title}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      {normalizedRole === "student" &&
                        submissionStatus?.status &&
                        submissionStatus.status !== "not_submitted" && (
                          <button
                            onClick={handleViewSubmission}
                            disabled={loadingSubmission}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              backgroundColor: darkMode
                                ? "rgba(34, 197, 94, 0.2)"
                                : "#10b981",
                              color: darkMode ? "#86efac" : "#ffffff",
                            }}
                            onMouseEnter={(e) => {
                              if (!loadingSubmission) {
                                e.currentTarget.style.backgroundColor = darkMode
                                  ? "rgba(34, 197, 94, 0.3)"
                                  : "#059669";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!loadingSubmission) {
                                e.currentTarget.style.backgroundColor = darkMode
                                  ? "rgba(34, 197, 94, 0.2)"
                                  : "#10b981";
                              }
                            }}
                          >
                            <Eye size={16} />
                            {loadingSubmission ? "Loading..." : "View Submit"}
                          </button>
                        )}

                      {(normalizedRole === "teacher" ||
                        normalizedRole === "admin") && (
                        <>
                          <button
                            onClick={handleViewAssignmentStats}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 hover:shadow-md"
                            style={{
                              backgroundColor: darkMode
                                ? "rgba(16, 185, 129, 0.2)"
                                : "#10b981",
                              color: darkMode ? "#6ee7b7" : "#ffffff",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = darkMode
                                ? "rgba(16, 185, 129, 0.3)"
                                : "#059669";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = darkMode
                                ? "rgba(16, 185, 129, 0.2)"
                                : "#10b981";
                            }}
                          >
                            <BarChart3 size={16} />
                            Statistics
                          </button>
                          <button
                            onClick={handleViewAssignmentReport}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 hover:shadow-md"
                            style={{
                              backgroundColor: darkMode
                                ? "rgba(59, 130, 246, 0.2)"
                                : "#2563eb",
                              color: darkMode ? "#bfdbfe" : "#ffffff",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = darkMode
                                ? "rgba(59, 130, 246, 0.3)"
                                : "#1d4ed8";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = darkMode
                                ? "rgba(59, 130, 246, 0.2)"
                                : "#2563eb";
                            }}
                          >
                            <ClipboardList size={16} />
                            Report
                          </button>
                        </>
                      )}

                      <button
                        onClick={async () => {
                          if (
                            normalizedRole === "admin" ||
                            normalizedRole === "teacher"
                          ) {
                            await handleViewAllSubmissions();
                          } else if (normalizedRole === "student") {
                            setShowSubmissionModal(true);
                          } else {
                            await showSwalError(
                              `Please log in to access assignments. Your current role is: ${
                                user?.role || "unknown"
                              }.`
                            );
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 hover:shadow-md"
                        style={{
                          backgroundColor: darkMode
                            ? "rgba(99, 102, 241, 0.2)"
                            : "#4f46e5",
                          color: darkMode ? "#a5b4fc" : "#ffffff",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = darkMode
                            ? "rgba(99, 102, 241, 0.3)"
                            : "#4338ca";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = darkMode
                            ? "rgba(99, 102, 241, 0.2)"
                            : "#4f46e5";
                        }}
                      >
                        {normalizedRole === "admin" ||
                        normalizedRole === "teacher" ? (
                          <>
                            <Eye size={16} />
                            View Submit
                          </>
                        ) : (
                          <>
                            <Upload size={16} />
                            {submissionStatus?.status &&
                            submissionStatus.status !== "not_submitted"
                              ? "Resubmit"
                              : "Submit"}
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <h1
                    className="text-3xl font-bold mb-4"
                    style={{ color: darkMode ? "#ffffff" : "#1f2937" }}
                  >
                    {assignment.title}
                  </h1>

                  {assignment.description && (
                    <div className="mb-6">
                      <div className="flex items-center mb-2">
                        <FileText
                          className="w-5 h-5 mr-2"
                          style={{
                            color: darkMode ? "#9ca3af" : "#6b7280",
                          }}
                        />
                        <h2
                          className="text-lg font-semibold"
                          style={{
                            color: darkMode ? "#ffffff" : "#1f2937",
                          }}
                        >
                          Description
                        </h2>
                      </div>
                      <p
                        className="text-base whitespace-pre-wrap break-words"
                        style={{
                          color: darkMode ? "#d1d5db" : "#6b7280",
                        }}
                      >
                        {assignment.description}
                      </p>
                    </div>
                  )}

                  {assignment.fileOriginalName && (
                    <div className="mb-6">
                      <div className="flex items-center mb-2">
                        <FileText
                          className="w-5 h-5 mr-2"
                          style={{
                            color: darkMode ? "#9ca3af" : "#6b7280",
                          }}
                        />
                        <h2
                          className="text-lg font-semibold"
                          style={{
                            color: darkMode ? "#ffffff" : "#1f2937",
                          }}
                        >
                          Assignment File
                        </h2>
                      </div>
                      <div
                        className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 rounded-lg"
                        style={{
                          backgroundColor: darkMode
                            ? "rgba(59, 130, 246, 0.08)"
                            : "rgba(59, 130, 246, 0.08)",
                          border: darkMode
                            ? "1px solid rgba(59, 130, 246, 0.3)"
                            : "1px solid rgba(59, 130, 246, 0.3)",
                        }}
                      >
                        <div>
                          {/* click tên file => download */}
                          <p
                            className="text-sm font-medium underline cursor-pointer hover:opacity-80 transition"
                            style={{
                              color: darkMode ? "#93c5fd" : "#1d4ed8",
                            }}
                            onClick={handleDownloadAssignmentFile}
                          >
                            {assignment.fileOriginalName}
                          </p>
                          <p
                            className="text-xs mt-1"
                            style={{
                              color: darkMode ? "#9ca3af" : "#6b7280",
                            }}
                          >
                            {assignment.fileMimeType || "Unknown type"} •{" "}
                            {formatFileSize(assignment.fileSize)}
                          </p>
                        </div>

                        {assignment.publicURL && assignment.fileMimeType && (
                          <button
                            onClick={handleViewAssignmentFilePreview}
                            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:shadow-md"
                            style={{
                              backgroundColor: darkMode
                                ? "rgba(37, 99, 235, 0.3)"
                                : "#2563eb",
                              color: darkMode ? "#bfdbfe" : "#ffffff",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = darkMode
                                ? "rgba(37, 99, 235, 0.4)"
                                : "#1d4ed8";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = darkMode
                                ? "rgba(37, 99, 235, 0.3)"
                                : "#2563eb";
                            }}
                          >
                            <Eye size={16} />
                            View Assignment
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t mb-4"
                    style={{
                      borderColor: darkMode
                        ? "rgba(75, 85, 99, 0.3)"
                        : "rgba(229, 231, 235, 0.5)",
                    }}
                  >
                    <div
                      className="flex items-center text-sm"
                      style={{
                        color: darkMode ? "#9ca3af" : "#6b7280",
                      }}
                    >
                      <Award className="w-5 h-5 mr-3 flex-shrink-0" />
                      <div>
                        <span className="font-semibold block">Max Score</span>
                        <span>{assignment.maxScore} points</span>
                      </div>
                    </div>
                    <div
                      className="flex items-center text-sm"
                      style={{
                        color: darkMode ? "#9ca3af" : "#6b7280",
                      }}
                    >
                      <Calendar className="w-5 h-5 mr-3 flex-shrink-0" />
                      <div>
                        <span className="font-semibold block">Due Date</span>
                        <span>{formatDate(assignment.dueDate)}</span>
                      </div>
                    </div>
                    <div
                      className="flex items-center text-sm"
                      style={{
                        color: darkMode ? "#9ca3af" : "#6b7280",
                      }}
                    >
                      <User className="w-5 h-5 mr-3 flex-shrink-0" />
                      <div>
                        <span className="font-semibold block">Created By</span>
                        <span>
                          {assignment.createdBy.fullname ||
                            assignment.createdBy.username}
                        </span>
                      </div>
                    </div>
                    <div
                      className="flex items-center text-sm"
                      style={{
                        color: darkMode ? "#9ca3af" : "#6b7280",
                      }}
                    >
                      <Clock className="w-5 h-5 mr-3 flex-shrink-0" />
                      <div>
                        <span className="font-semibold block">
                          Late Submissions
                        </span>
                        <span>
                          {assignment.allowLate ? "Allowed" : "Not Allowed"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-between pt-4 border-t gap-4"
                    style={{
                      borderColor: darkMode
                        ? "rgba(75, 85, 99, 0.3)"
                        : "rgba(229, 231, 235, 0.5)",
                    }}
                  >
                    <span
                      className="inline-flex items-center px-3 py-2 text-sm font-semibold rounded whitespace-nowrap"
                      style={{
                        backgroundColor: getDueDateStatus(assignment.dueDate)
                          .bg,
                        color: getDueDateStatus(assignment.dueDate).color,
                      }}
                    >
                      {getDueDateStatus(assignment.dueDate).text}
                    </span>
                    <div
                      className="text-xs"
                      style={{
                        color: darkMode ? "#9ca3af" : "#6b7280",
                      }}
                    >
                      Created: {formatDate(assignment.createdAt)}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>

      {/* Assignment File Viewer Modal (resizable) */}
      {isViewerOpen && (viewingFile || assignment) && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeAssignmentViewer();
            }
          }}
        >
          <div
            ref={popupRef}
            className="relative rounded-lg overflow-hidden flex flex-col"
            style={{
              backgroundColor: darkMode ? "#1f2937" : "#ffffff",
              boxShadow:
                "0 20px 25px -5px rgba(0,0,0,0.3), 0 10px 10px -5px rgba(0,0,0,0.2)",
              width: popupSize.width || "90vw",
              height: popupSize.height || "90vh",
              maxWidth: "1100px",
              maxHeight: "95vh",
              minWidth: "600px",
              minHeight: "400px",
              willChange: "width, height",
              contain: "layout paint size",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between p-4 border-b"
              style={{
                borderColor: darkMode
                  ? "rgba(75, 85, 99, 0.3)"
                  : "rgba(229, 231, 235, 0.5)",
                backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                position: "sticky",
                top: 0,
                zIndex: 10,
              }}
            >
              <div className="flex-1 min-w-0">
                <h3
                  className="text-xl font-semibold truncate"
                  style={{ color: darkMode ? "#ffffff" : "#1f2937" }}
                >
                  {viewingFile?.name ||
                    assignment?.fileOriginalName ||
                    "View File"}
                </h3>
                {(viewingFile?.mimeType || assignment?.fileMimeType) && (
                  <p
                    className="text-xs mt-1 truncate"
                    style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
                  >
                    {viewingFile?.mimeType || assignment?.fileMimeType} •{" "}
                    {formatFileSize(viewingFile?.size || assignment?.fileSize)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                {/* <button
                  onClick={handleDownloadAssignmentFile}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-md"
                  style={{
                    backgroundColor: darkMode
                      ? "rgba(16, 185, 129, 0.15)"
                      : "rgba(16, 185, 129, 0.12)",
                    color: darkMode ? "#6ee7b7" : "#059669",
                  }}
                >
                  Download
                </button> */}
                <button
                  onClick={closeAssignmentViewer}
                  className="p-2 rounded-lg transition-all duration-200 hover:shadow-md"
                  style={{
                    backgroundColor: darkMode
                      ? "rgba(239, 68, 68, 0.1)"
                      : "rgba(239, 68, 68, 0.1)",
                    color: darkMode ? "#fca5a5" : "#dc2626",
                  }}
                  title="Close (ESC)"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div
              ref={contentRef}
              className="flex-1 overflow-auto"
              style={{
                minHeight: 0,
                backgroundColor: darkMode ? "#111827" : "#f9fafb",
              }}
            >
              {renderAssignmentViewerContent()}
            </div>

            {/* Resize handle - Right */}
            <div
              onMouseDown={(e) => handleResizeStart(e, "horizontal")}
              className="absolute top-0 right-0 h-full w-3 cursor-ew-resize flex items-center justify-center"
              style={{ backgroundColor: "transparent" }}
            >
              <div
                className="w-1 rounded-full"
                style={{
                  height: "60px",
                  background: darkMode
                    ? "rgba(148, 163, 184, 0.6)"
                    : "rgba(71, 85, 105, 0.4)",
                }}
              />
            </div>

            {/* Resize handle - Bottom */}
            <div
              onMouseDown={(e) => handleResizeStart(e, "vertical")}
              className="absolute bottom-0 left-0 w-full h-3 cursor-ns-resize flex items-center justify-center"
              style={{ backgroundColor: "transparent" }}
            >
              <div
                className="h-1 rounded-full"
                style={{
                  width: "60px",
                  background: darkMode
                    ? "rgba(148, 163, 184, 0.6)"
                    : "rgba(71, 85, 105, 0.4)",
                }}
              />
            </div>
          </div>
        </div>
      )}

      <SubmissionModal
        isOpen={showSubmissionModal}
        isResubmit={
          submissionStatus?.status !== undefined &&
          submissionStatus.status !== "not_submitted"
        }
        selectedFile={selectedFile}
        submitting={submitting}
        onClose={() => {
          setShowSubmissionModal(false);
          clearFile();
        }}
        onFileChange={handleFileChange}
        onSubmit={handleSubmitAssignment}
        onClearFile={clearFile}
      />

      {submissionDetails && (
        <ViewSubmissionModal
          isOpen={showViewSubmissionModal}
          submissionDetails={submissionDetails}
          assignment={assignment}
          onClose={() => setShowViewSubmissionModal(false)}
          onResubmit={() => {
            setShowViewSubmissionModal(false);
            setShowSubmissionModal(true);
          }}
          onDownload={handleDownloadSubmission}
          formatDate={formatDate}
        />
      )}

      <AllSubmissionsModal
        isOpen={showAllSubmissionsModal}
        submissions={allSubmissions}
        assignment={assignment}
        loading={loadingAllSubmissions}
        onClose={() => setShowAllSubmissionsModal(false)}
        onDownload={handleDownloadSubmission}
        onGrade={(submission) => {
          setGradingSubmission(submission);
          setGradingGrade(submission.grade?.toString() || "");
          setGradingFeedback(submission.feedback || "");
        }}
        onView={handleViewSubmissionFile}
        formatDate={formatDate}
      />

      <GradeSubmissionModal
        isOpen={!!gradingSubmission}
        maxScore={assignment?.maxScore || 10}
        grading={grading}
        grade={gradingGrade}
        feedback={gradingFeedback}
        onClose={() => {
          setGradingSubmission(null);
          setGradingGrade("");
          setGradingFeedback("");
        }}
        onGradeChange={setGradingGrade}
        onFeedbackChange={setGradingFeedback}
        onSubmit={() =>
          gradingSubmission && handleGradeSubmission(gradingSubmission._id)
        }
      />

      <AssignmentStatsModal
        isOpen={showStatsModal}
        loading={loadingStats}
        data={statsData}
        onClose={() => {
          setShowStatsModal(false);
          setStatsData(null);
        }}
      />

      <AssignmentReportModal
        isOpen={showReportModal}
        loading={loadingReport}
        data={reportData}
        formatDate={formatDate}
        onClose={() => {
          setShowReportModal(false);
          setReportData(null);
        }}
      />
    </div>
  );
};

export default AssignmentDetailPage;
