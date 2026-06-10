import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Search, X, Trash2 } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { QuizPageHeader } from "../../components/quiz/QuizPageHeader";
import { QuizHeaderControls } from "../../components/quiz/QuizHeaderControls";
import { QuizQuestionCard } from "../../components/quiz/QuizQuestionCard";
import { QuizPagination } from "../../components/quiz/QuizPagination";
import { EditQuestionModal } from "../../components/quiz/EditQuestionModal";
import {
  quizQuestionService,
  subjectService,
  type QuizQuestion,
  type QuizQuestionImage,
} from "../../services";
import type { Subject } from "../../types/subject";
import type { EditFormState } from "../../types/quiz";

export default function QuizCoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("Quiz Questions");
  const [subjectInfo, setSubjectInfo] = useState<Subject | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);

  const updatePageURL = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    if (page === 1) {
      newParams.delete("page");
    } else {
      newParams.set("page", String(page));
    }
    setSearchParams(newParams, { replace: true }); // Prevent history pollution
  };

  // Get page from URL or default to 1
  const pageParam = searchParams.get("page");
  const currentPage = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;

  const [pageSize, setPageSize] = useState(100);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [paginationInfo, setPaginationInfo] = useState({
    totalItems: 0,
    currentPage: 1,
    limit: 20,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [manualQuestions, setManualQuestions] = useState<QuizQuestion[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const newImageInputRef = useRef<HTMLInputElement | null>(null);
  // Track current image index for each question
  const [currentImageIndices, setCurrentImageIndices] = useState<Record<string, number>>({});
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const resolvedRole = (user?.role as "admin" | "teacher" | "student") || "teacher";
  const canManageQuestions = resolvedRole !== "teacher";

  const apiBase = import.meta.env.VITE_BASE_API || "";
  const handleToggleSidebar = () => {
    setMobileSidebarOpen((prev) => !prev);
  };
  const handleCloseSidebar = () => {
    setMobileSidebarOpen(false);
  };

  const adjustImageIndex = (questionId: string, delta: number) => {
    setCurrentImageIndices((prev) => {
      const question = quizQuestions.find((q) => q._id === questionId);
      if (!question) return prev;
      const images = resolveImageSrc(question);
      if (images.length === 0) return prev;
      const current = prev[questionId] || 0;
      const nextIndex = Math.min(Math.max(0, current + delta), images.length - 1);
      if (nextIndex === current) return prev;
      return {
        ...prev,
        [questionId]: nextIndex,
      };
    });
  };

  const handleImagePrev = (questionId: string) => adjustImageIndex(questionId, -1);
  const handleImageNext = (questionId: string) => adjustImageIndex(questionId, 1);

  // Resolve image source from various possible fields
  const resolveImageSrc = (q: QuizQuestion): string[] => {
    const obj = q as unknown as Record<string, unknown>;
    const images: string[] = [];

    // Check for images array
    if (Array.isArray(obj["images"])) {
      const imageArray = obj["images"] as unknown[];
      imageArray.forEach((img) => {
        if (typeof img === "string") {
          images.push(img);
        } else if (typeof img === "object" && img !== null) {
          const imgObj = img as Record<string, unknown>;
          const url = imgObj["url"] || imgObj["publicUrl"] || imgObj["imageUrl"];
          if (typeof url === "string") {
            images.push(url);
          }
        }
      });
    }

    // Check for single image field
    const singleImage = obj["image"] || obj["imageUrl"] || obj["fileUrl"];
    if (typeof singleImage === "string" && !images.includes(singleImage)) {
      images.push(singleImage);
    }

    // Check for file object
    const fileObj = obj["file"] as Record<string, unknown> | undefined;
    if (fileObj) {
      const fileUrl = fileObj["url"] || fileObj["publicUrl"];
      if (typeof fileUrl === "string" && !images.includes(fileUrl)) {
        images.push(fileUrl);
      }
    }

    // Normalize URLs - add base URL if relative
    return images.map((img) => {
      if (!img) return "";
      return img.startsWith("http") ? img : (apiBase ? `${apiBase}/${img.replace(/^\/+/, "")}` : img);
    }).filter(Boolean);
  };

  type LocationState = {
    mergedQuestions?: QuizQuestion[];
    subjectInfo?: Subject;
  } | null;

  const locationState = location.state as LocationState;

  useEffect(() => {
    if (locationState?.mergedQuestions && locationState.mergedQuestions.length > 0) {
      setManualQuestions(locationState.mergedQuestions);
    } else {
      setManualQuestions(null);
    }
  }, [locationState?.mergedQuestions]);

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;

    const fetchSubject = async () => {
      try {
        const subject = await subjectService.getSubjectById(courseId);
        if (!cancelled) {
          setSubjectInfo(subject);
        }
      } catch (error) {
        console.error("QuizCoursePage: Failed to fetch subject info:", error);
        if (!cancelled) {
          setSubjectInfo(null);
        }
      }
    };

    if (locationState?.subjectInfo && locationState.subjectInfo._id === courseId) {
      setSubjectInfo(locationState.subjectInfo);
    } else {
      fetchSubject();
    }

    return () => {
      cancelled = true;
    };
  }, [courseId, locationState?.subjectInfo]);

  useEffect(() => {
    const subjectLabel = subjectInfo
      ? `${subjectInfo.code ? `${subjectInfo.code} · ` : ""}${subjectInfo.name}`
      : "Quiz Questions";
    const countLabel = totalQuestions > 0 ? ` (${totalQuestions} questions)` : "";
    setTitle(`${subjectLabel}${countLabel}`);
  }, [subjectInfo, totalQuestions]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      if (searchQuery !== debouncedSearchQuery) {
        updatePageURL(1); // Reset to page 1 when search changes
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, setSearchParams, debouncedSearchQuery]);

  useEffect(() => {
    if (!courseId) return;
    let mounted = true;

    const fetchQuestions = async () => {
      try {
        setLoading(true);

        if (manualQuestions && manualQuestions.length > 0) {
          const totalItems = manualQuestions.length;
          const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
          const safePage = Math.min(Math.max(1, currentPage), totalPages);

          // If URL page is invalid for manual data, update URL
          if (safePage !== currentPage) {
            updatePageURL(safePage);
            return;
          }

          const startIndex = (safePage - 1) * pageSize;
          const sliced = manualQuestions.slice(startIndex, startIndex + pageSize);

          if (mounted) {
            setQuizQuestions(sliced);
            setPaginationInfo({
              totalItems,
              currentPage: safePage,
              limit: pageSize,
              totalPages,
              hasNext: safePage < totalPages,
              hasPrev: safePage > 1,
            });
            setTotalQuestions(totalItems);
          }
          return;
        }

        const result = await quizQuestionService.getAllQuizQuestions({
          subjectId: courseId,
          // type: "mcq", // Remove type filter to show all questions
          page: currentPage,
          limit: pageSize,
          option: "subjectId",
          search: debouncedSearchQuery.trim() || undefined,
        });

        const pagination = result.pagination || {
          totalItems: result.data?.length || 0,
          currentPage,
          limit: pageSize,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        };

        if (pagination.totalPages > 0 && currentPage > pagination.totalPages) {
          updatePageURL(Math.max(1, pagination.totalPages));
          return;
        }

        if (mounted) {
          setQuizQuestions(result.data || []);
          setPaginationInfo({
            totalItems: pagination.totalItems ?? (result.data?.length || 0),
            currentPage: pagination.currentPage ?? currentPage,
            limit: pagination.limit ?? pageSize,
            totalPages: pagination.totalPages ?? 1,
            hasNext: pagination.hasNext ?? false,
            hasPrev: pagination.hasPrev ?? false,
          });
          setTotalQuestions(pagination.totalItems ?? (result.data?.length || 0));
        }
      } catch (error) {
        console.error("QuizCoursePage: Error fetching quiz questions:", error);
        if (mounted) {
          setQuizQuestions([]);
          setPaginationInfo({
            totalItems: 0,
            currentPage: 1,
            limit: pageSize,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          });
          setTotalQuestions(0);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchQuestions();

    return () => {
      mounted = false;
    };
  }, [courseId, manualQuestions, currentPage, pageSize, refreshKey, debouncedSearchQuery, setSearchParams]);

  useEffect(() => {
    if (!subjectInfo) return;

    const applySubject = (question: QuizQuestion): QuizQuestion => {
      if (typeof question.subjectId === "string" || !question.subjectId) {
        return {
          ...question,
          subjectId: {
            _id: subjectInfo._id,
            code: subjectInfo.code,
            name: subjectInfo.name,
          },
        };
      }
      return question;
    };

    setQuizQuestions((prev) => prev.map(applySubject));
    setManualQuestions((prev) => (prev ? prev.map(applySubject) : prev));
  }, [subjectInfo]);

  // Reset page when courseId changes
  useEffect(() => {
    updatePageURL(1);
  }, [courseId, setSearchParams]);

  // Reset page when pageSize changes
  useEffect(() => {
    updatePageURL(1);
  }, [pageSize, setSearchParams]);

  useEffect(() => {
    if (manualQuestions) {
      updatePageURL(1);
    }
  }, [manualQuestions, setSearchParams]);

  const getSwalBaseOptions = () => ({
    width: 360,
    background: darkMode ? "rgba(15,23,42,0.95)" : "#ffffff",
    color: darkMode ? "#e2e8f0" : "#1f2937",
    confirmButtonColor: "#6366f1",
  });

  const showSwalConfirm = async (message: string): Promise<boolean> => {
    const Swal = (await import("sweetalert2")).default;
    const base = getSwalBaseOptions();
    const result = await Swal.fire({
      ...base,
      title: "Confirm",
      text: message,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: darkMode ? "#334155" : "#e2e8f0",
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      reverseButtons: true,
      heightAuto: false,
    });
    return result.isConfirmed;
  };

  const showSwalError = async (message: string) => {
    const Swal = (await import("sweetalert2")).default;
    const base = getSwalBaseOptions();
    await Swal.fire({
      ...base,
      icon: "error",
      title: "Error",
      text: message,
      confirmButtonText: "Close",
      heightAuto: false,
    });
  };

  const showSwalSuccess = async (message: string) => {
    const Swal = (await import("sweetalert2")).default;
    const base = getSwalBaseOptions();
    await Swal.fire({
      ...base,
      icon: "success",
      title: "Success",
      text: message,
      timer: 1500,
      showConfirmButton: false,
      heightAuto: false,
    });
  };

  const handleDeleteQuestion = async (questionId: string) => {
    const confirmed = await showSwalConfirm("Delete this question?");
    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(questionId);
      const question = quizQuestions.find((q) => q._id === questionId);
      await quizQuestionService.deleteQuizQuestion(questionId, question);

      if (manualQuestions) {
        setManualQuestions((prev) => prev?.filter((q) => q._id !== questionId) || null);
      } else {
        setRefreshKey((prev) => prev + 1);
      }

      await showSwalSuccess("Question deleted.");
    } catch (error) {
      console.error("Error deleting question:", error);
      await showSwalError("Failed to delete question. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAllQuestions = async () => {
    if (!courseId || totalQuestions === 0) return;

    const confirmed = await showSwalConfirm(
      `Are you sure you want to delete ALL ${totalQuestions} question${totalQuestions !== 1 ? 's' : ''} from this subject? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setDeletingAll(true);
      await quizQuestionService.deleteAllQuestionsBySubject(courseId);

      // Reload questions
      if (manualQuestions) {
        setManualQuestions([]);
      } else {
        setRefreshKey((prev) => prev + 1);
      }

      await showSwalSuccess("All questions deleted successfully.");
    } catch (error) {
      console.error("Error deleting all questions:", error);
      await showSwalError("Failed to delete all questions. Please try again.");
    } finally {
      setDeletingAll(false);
    }
  };

  const pageSizeOptions = [20, 50, 100];
  const pageOptions = Array.from({ length: Math.max(1, paginationInfo.totalPages) }, (_, index) => index + 1);

  const goToPage = (page: number) => {
    const total = Math.max(1, paginationInfo.totalPages);
    const nextPage = Math.min(Math.max(1, page), total);
    updatePageURL(nextPage);
  };

  const handlePageChange = (direction: "prev" | "next") => {
    if (direction === "prev" && paginationInfo.hasPrev) {
      goToPage(currentPage - 1);
    }
    if (direction === "next" && paginationInfo.hasNext) {
      goToPage(currentPage + 1);
    }
  };

  const handlePageSizeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = Number(event.target.value);
    if (!Number.isNaN(value)) {
      setPageSize(value);
    }
  };

  const determineCorrectFlags = (question: QuizQuestion, options: string[]) => {
    const correctOptions = question.correctOptions || [];
    const isBinary =
      correctOptions.length === options.length && correctOptions.every((val) => val === 0 || val === 1);

    if (isBinary) {
      return correctOptions.map((val) => val === 1);
    }

    return options.map((_, idx) => correctOptions.includes(idx));
  };

  const normalizeQuestionImages = (question: QuizQuestion): QuizQuestionImage[] => {
    if (!question.images || !Array.isArray(question.images)) return [];
    const normalized: QuizQuestionImage[] = [];
    question.images.forEach((img) => {
      if (!img) return;
      if (typeof img === "string") {
        normalized.push({ url: img, fromDB: true });
        return;
      }
      if (typeof img === "object" && img !== null) {
        const candidate = img as Partial<QuizQuestionImage>;
        if (typeof candidate.url === "string") {
          normalized.push({ url: candidate.url, fromDB: candidate.fromDB });
        }
      }
    });
    return normalized;
  };

  const handleOpenEditQuestion = (question: QuizQuestion) => {
    const existingOptions = question.options && question.options.length > 0 ? [...question.options] : ["", ""];
    const flags = determineCorrectFlags(question, existingOptions);

    setEditForm({
      text: question.text,
      points: question.points || 1,
      options: existingOptions,
      correctFlags: flags.length === existingOptions.length ? flags : new Array(existingOptions.length).fill(false),
      explanation: question.explanation || "",
      existingImages: normalizeQuestionImages(question),
      deletedImageUrls: [],
      newImageFiles: [],
      newImagePreviews: [],
    });
    setEditingQuestion(question);
  };

  const handleCloseEdit = () => {
    if (savingEdit) return;
    setEditingQuestion(null);
    setEditForm(null);
  };

  const handleEditInputChange = (field: keyof EditFormState, value: string | number) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      [field]: field === "points" ? Number(value) : value,
    });
  };

  const handleOptionChange = (index: number, value: string) => {
    if (!editForm) return;
    const updatedOptions = [...editForm.options];
    updatedOptions[index] = value;
    setEditForm({
      ...editForm,
      options: updatedOptions,
    });
  };

  const handleToggleCorrect = (index: number) => {
    if (!editForm) return;
    const updatedFlags = [...editForm.correctFlags];
    updatedFlags[index] = !updatedFlags[index];
    setEditForm({
      ...editForm,
      correctFlags: updatedFlags,
    });
  };

  const handleAddOption = () => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      options: [...editForm.options, ""],
      correctFlags: [...editForm.correctFlags, false],
    });
  };

  const handleToggleExistingImage = (url: string) => {
    if (!editForm) return;
    const isMarked = editForm.deletedImageUrls.includes(url);
    setEditForm({
      ...editForm,
      deletedImageUrls: isMarked
        ? editForm.deletedImageUrls.filter((item) => item !== url)
        : [...editForm.deletedImageUrls, url],
    });
  };

  const handleSelectNewImages = (event: ChangeEvent<HTMLInputElement>) => {
    if (!editForm) return;
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;

    const readers = files.map(
      (file) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "");
          reader.readAsDataURL(file);
        })
    );

    Promise.all(readers).then((previews) => {
      setEditForm((prev) =>
        prev
          ? {
            ...prev,
            newImageFiles: [...prev.newImageFiles, ...files],
            newImagePreviews: [...prev.newImagePreviews, ...previews.filter(Boolean)],
          }
          : prev
      );
    });

    if (event.target) {
      event.target.value = "";
    }
  };

  const handleRemoveNewImage = (index: number) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      newImageFiles: editForm.newImageFiles.filter((_, idx) => idx !== index),
      newImagePreviews: editForm.newImagePreviews.filter((_, idx) => idx !== index),
    });
  };

  const handleRemoveOption = (index: number) => {
    if (!editForm || editForm.options.length <= 2) return;
    setEditForm({
      ...editForm,
      options: editForm.options.filter((_, idx) => idx !== index),
      correctFlags: editForm.correctFlags.filter((_, idx) => idx !== index),
    });
  };

  const handleSubmitEdit = async () => {
    if (!editingQuestion || !editForm) return;

    const trimmedText = editForm.text.trim();
    const cleanedOptions = editForm.options.map((opt) => opt.trim());
    const hasValidOptions = cleanedOptions.every((opt) => opt.length > 0);
    const hasCorrectAnswer = editForm.correctFlags.some(Boolean);

    if (!trimmedText) {
      await showSwalError("Vui lòng nhập nội dung câu hỏi.");
      return;
    }

    if (cleanedOptions.length < 2 || !hasValidOptions) {
      await showSwalError("Mỗi câu hỏi phải có ít nhất 2 lựa chọn hợp lệ.");
      return;
    }

    if (!hasCorrectAnswer) {
      await showSwalError("Please select at least one correct option.");
      return;
    }

    const selectedCorrectCount = editForm.correctFlags.filter(Boolean).length;
    const originalType = editingQuestion.type || "mcq";
    const canBecomeMulti = originalType === "mcq" || originalType === "multichoice";

    if (selectedCorrectCount > 1 && !canBecomeMulti) {
      await showSwalError("This question type allows only one correct option.");
      return;
    }

    let nextType = originalType;
    if (selectedCorrectCount > 1 && canBecomeMulti) {
      nextType = "multichoice";
    } else if (selectedCorrectCount <= 1 && originalType === "multichoice") {
      nextType = "mcq";
    }

    try {
      setSavingEdit(true);
      const subjectId =
        typeof editingQuestion.subjectId === "object" && editingQuestion.subjectId
          ? editingQuestion.subjectId._id
          : (editingQuestion.subjectId as string);

      const updatedQuestion = await quizQuestionService.updateQuizQuestion(editingQuestion._id, {
        subjectId,
        text: trimmedText,
        points: editForm.points,
        options: cleanedOptions,
        correctOptions: editForm.correctFlags.map((flag) => (flag ? 1 : 0)),
        type: nextType,
        explanation: editForm.explanation,
        deletedKeys: editForm.deletedImageUrls,
        newImages: editForm.newImageFiles,
      });

      setQuizQuestions((prev) =>
        prev.map((q) => (q._id === updatedQuestion._id ? { ...q, ...updatedQuestion } : q))
      );
      setManualQuestions((prev) =>
        prev ? prev.map((q) => (q._id === updatedQuestion._id ? { ...q, ...updatedQuestion } : q)) : prev
      );

      await showSwalSuccess("Question updated.");
      handleCloseEdit();
    } catch (error) {
      console.error("Error updating question:", error);
      await showSwalError("Failed to update question. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const textColor = darkMode ? "#e2e8f0" : "#1e293b";
  const bgColor = darkMode ? "#0f172a" : "#f8fafc";
  const cardBg = darkMode ? "rgba(15,23,42,0.6)" : "#ffffff";
  const borderColor = darkMode ? "rgba(148,163,184,0.2)" : "rgba(148,163,184,0.2)";
  const startItem =
    totalQuestions === 0 ? 0 : (paginationInfo.currentPage - 1) * paginationInfo.limit + 1;
  const endItem =
    totalQuestions === 0 ? 0 : Math.min(totalQuestions, startItem + quizQuestions.length - 1);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: bgColor }}>
      <Navbar onToggleSidebar={handleToggleSidebar} />
      <Sidebar
        variant="mobile"
        role={resolvedRole}
        isOpen={mobileSidebarOpen}
        onClose={handleCloseSidebar}
      />
      <div className="flex relative w-full pt-28 md:pt-24 lg:pt-20">
        <Sidebar role={resolvedRole} />
        <div className="flex-1 w-full px-4 sm:px-6 py-6 md:ml-[50px] relative overflow-x-hidden">
          <div className="max-w-6xl mx-auto">
            <QuizPageHeader
              title={title}
              onBack={() => navigate(-1)}
              darkMode={darkMode}
              textColor={textColor}
            />
            <div className="md:pl-12">
              {/* Search Input and Delete All Button */}
              <div className="mb-4 flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search questions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 pl-10 pr-10 rounded-lg border transition-colors"
                    style={{
                      backgroundColor: darkMode ? "rgba(15,23,42,0.6)" : "#ffffff",
                      borderColor: borderColor,
                      color: textColor,
                    }}
                  />
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5"
                    style={{ color: "var(--muted-text)" }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-gray-100 transition-colors"
                      style={{ color: "var(--muted-text)" }}
                      title="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {user?.role === "admin" && totalQuestions > 0 && (
                  <button
                    onClick={handleDeleteAllQuestions}
                    disabled={deletingAll}
                    className="px-4 py-2 rounded-lg font-semibold transition-all hover:opacity-80 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                    style={{
                      backgroundColor: "#ef4444",
                      color: "#ffffff",
                    }}
                    title={`Delete all ${totalQuestions} questions`}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Delete All</span>
                  </button>
                )}
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <p style={{ color: textColor }}>Loading...</p>
                </div>
              ) : quizQuestions.length === 0 ? (
                <div className="text-center py-12">
                  <p style={{ color: textColor }}>
                    {searchQuery || debouncedSearchQuery
                      ? "No questions found matching your search."
                      : "No questions."}
                  </p>
                </div>
              ) : (
                <>
                  <QuizHeaderControls
                    startItem={startItem}
                    endItem={endItem}
                    totalQuestions={totalQuestions}
                    subjectInfo={subjectInfo}
                    textColor={textColor}
                    darkMode={darkMode}
                    borderColor={borderColor}
                    pageSize={pageSize}
                    pageSizeOptions={pageSizeOptions}
                    onPageSizeChange={handlePageSizeChange}
                    paginationInfo={{
                      totalItems: paginationInfo.totalItems,
                      currentPage: paginationInfo.currentPage,
                      limit: paginationInfo.limit,
                      totalPages: paginationInfo.totalPages,
                      hasNext: paginationInfo.hasNext,
                      hasPrev: paginationInfo.hasPrev,
                    }}
                    onPrevPage={() => handlePageChange("prev")}
                    onNextPage={() => handlePageChange("next")}
                  />

                  <div className="flex flex-col w-full gap-6 overflow-x-hidden">
                    <div className="flex-1 space-y-6">
                      {quizQuestions.map((question, index) => (
                        <QuizQuestionCard
                          key={question._id}
                          question={question}
                          index={index}
                          startNumber={startItem}
                          textColor={textColor}
                          cardBg={cardBg}
                          borderColor={borderColor}
                          darkMode={darkMode}
                          deletingId={deletingId}
                          currentImageIndex={currentImageIndices[question._id] || 0}
                          resolveImageSrc={resolveImageSrc}
                          onImagePrev={handleImagePrev}
                          onImageNext={handleImageNext}
                          onEdit={handleOpenEditQuestion}
                          onDelete={handleDeleteQuestion}
                          canManage={canManageQuestions}
                        />
                      ))}
                    </div>
                  </div>

                  <QuizPagination
                    currentPage={paginationInfo.currentPage}
                    totalPages={paginationInfo.totalPages}
                    textColor={textColor}
                    borderColor={borderColor}
                    hasPrev={paginationInfo.hasPrev}
                    hasNext={paginationInfo.hasNext}
                    pageOptions={pageOptions}
                    onPrev={() => handlePageChange("prev")}
                    onNext={() => handlePageChange("next")}
                    onSelectPage={goToPage}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <EditQuestionModal
        question={editingQuestion}
        editForm={editForm}
        darkMode={darkMode}
        textColor={textColor}
        borderColor={borderColor}
        savingEdit={savingEdit}
        newImageInputRef={newImageInputRef}
        onClose={handleCloseEdit}
        onInputChange={handleEditInputChange}
        onOptionChange={handleOptionChange}
        onToggleCorrect={handleToggleCorrect}
        onAddOption={handleAddOption}
        onRemoveOption={handleRemoveOption}
        onToggleExistingImage={handleToggleExistingImage}
        onSelectNewImages={handleSelectNewImages}
        onRemoveNewImage={handleRemoveNewImage}
        onSubmit={handleSubmitEdit}
      />
    </div>
  );
}
