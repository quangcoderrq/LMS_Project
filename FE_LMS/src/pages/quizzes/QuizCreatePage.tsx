import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileText, Search, ChevronDown, Check } from "lucide-react";
import Navbar from "../../components/layout/Navbar.tsx";
import Sidebar from "../../components/layout/Sidebar.tsx";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import http from "../../utils/http";
import { quizService, subjectService, quizQuestionService } from "../../services";
import type { Course } from "../../types/course";
import type { Subject } from "../../types/subject";
import type { QuizQuestion } from "../../services/quizQuestionService";
import { QuizPagination } from "../../components/quiz/QuizPagination";

interface CreateQuizForm {
  courseId: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  shuffleQuestions: boolean;
  isPublished: boolean;
}

interface DraftQuestion {
  id: string;
  text: string;
  options: string[];
  correctOptions: number[];
}

interface SnapshotQuestion {
  id: string;
  text: string | number;
  type: string | number;
  options: (string | number)[];
  correctOptions: number[];
  points: number | string;
  explanation?: string | number;
  images?: Array<{ url: string; fromDB?: boolean }>;
  isExternal: boolean;
  isNewQuestion: boolean;
  isDeleted: boolean;
  isDirty: boolean;
}

const emptyDraftQuestion = (): DraftQuestion => ({
  id: crypto.randomUUID(),
  text: "",
  options: ["", "", "", ""],
  correctOptions: [0, 0, 0, 0],
});

/**
 * Converts a datetime-local string to ISO UTC string
 * @param datetimeLocal - String in format "YYYY-MM-DDTHH:mm" (local time)
 * @returns ISO UTC string in format "YYYY-MM-DDTHH:mm:ss.sssZ"
 */
const convertToISOUTC = (datetimeLocal: string): string => {
  if (!datetimeLocal) return "";
  // Create Date object from local datetime string
  // JavaScript will parse it as local time
  const localDate = new Date(datetimeLocal);
  // Convert to ISO UTC string
  return localDate.toISOString();
};

// Fix nested p tags in HTML text (e.g., <p><p>...</p></p> -> <p>...</p>)
// Also ensure the value is converted to string
const fixNestedPTags = (html: string | number | undefined | null): string => {
  // Convert to string first
  if (html === null || html === undefined) return "";
  if (typeof html === 'number') return String(html);
  if (typeof html !== 'string') return String(html);

  // Remove nested <p> tags: replace <p><p> with <p> and </p></p> with </p>
  let fixed = html;

  // Fix multiple nested opening p tags
  fixed = fixed.replace(/<p\s*[^>]*>\s*<p\s*[^>]*>/gi, '<p>');

  // Fix multiple nested closing p tags
  fixed = fixed.replace(/<\/p>\s*<\/p>/gi, '</p>');

  // Also handle cases with attributes: <p class="..."><p> -> <p>
  fixed = fixed.replace(/<p[^>]*>\s*<p[^>]*>/gi, '<p>');

  return fixed;
};

const stripHtmlTags = (value: string): string => {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
};

const loadSwal = async () => (await import("sweetalert2")).default;

const getSwalTheme = (darkMode: boolean) => ({
  background: darkMode ? "#1f2937" : "#ffffff",
  color: darkMode ? "#e2e8f0" : "#1f2937",
  confirmButtonColor: darkMode ? "#6d28d9" : "#6d28d9",
  confirmButtonText: darkMode ? "#ffffff" : "#ffffff",
  cancelButtonColor: darkMode ? "#4b5563" : "#9ca3af",
  popup: darkMode ? "#1f2937" : "#ffffff",
  backdrop: darkMode ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.4)",
});

const showSwalSuccess = async (message: string, darkMode: boolean = false) => {
  const Swal = await loadSwal();
  const theme = getSwalTheme(darkMode);
  await Swal.fire({
    icon: "success",
    title: "Success",
    text: message,
    confirmButtonText: "OK",
    background: theme.background,
    color: theme.color,
    confirmButtonColor: theme.confirmButtonColor,
    backdrop: theme.backdrop,
  });
};

const showSwalError = async (message: string, darkMode: boolean = false) => {
  const Swal = await loadSwal();
  const theme = getSwalTheme(darkMode);
  await Swal.fire({
    icon: "error",
    title: "Error",
    text: message,
    confirmButtonText: "OK",
    background: theme.background,
    color: theme.color,
    confirmButtonColor: theme.confirmButtonColor,
    backdrop: theme.backdrop,
  });
};

const showRandomResultSwal = async (count: number, darkMode: boolean = false) => {
  const Swal = await loadSwal();
  const theme = getSwalTheme(darkMode);
  await Swal.fire({
    icon: "success",
    title: "Random Questions",
    text: `Randomly selected ${count} question${count !== 1 ? "s" : ""}.`,
    timer: 2000,
    showConfirmButton: false,
    background: theme.background,
    color: theme.color,
    backdrop: theme.backdrop,
  });
};

const normalizeQuestionTypeValue = (type: string | number | undefined | null): string => {
  if (type === null || type === undefined) return "mcq";
  const raw =
    typeof type === "string"
      ? type
      : typeof type === "number"
        ? String(type)
        : "";
  const cleaned = raw.trim().toLowerCase().replace(/[\s-]/g, "_");

  if (cleaned === "mcq" || cleaned === "multiple_choice" || cleaned === "multiplechoice") {
    return "mcq";
  }
  if (
    cleaned === "multichoice" ||
    cleaned === "multi_choice" ||
    cleaned === "multi" ||
    cleaned === "multiple_correct"
  ) {
    return "multichoice";
  }
  if (
    cleaned === "true_false" ||
    cleaned === "truefalse" ||
    cleaned === "true_or_false"
  ) {
    return "true_false";
  }
  if (
    cleaned === "fill_blank" ||
    cleaned === "fillintheblank" ||
    cleaned === "fill_in_the_blank" ||
    cleaned === "fill_in_blank"
  ) {
    return "fill_blank";
  }

  return "mcq";
};

const normalizeCorrectFlag = (value: unknown): number => {
  if (typeof value === "number") {
    return value > 0 ? 1 : 0;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "true" || trimmed === "1" || trimmed === "yes" || trimmed === "correct") {
      return 1;
    }
    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed > 0 ? 1 : 0;
    }
  }
  return 0;
};

const buildCorrectOptions = (snapshot: SnapshotQuestion, normalizedOptions: string[]): number[] => {
  const raw = (Array.isArray(snapshot.correctOptions)
    ? snapshot.correctOptions
    : []) as Array<number | string>;
  if (raw.length === normalizedOptions.length) {
    return raw.map((value) => normalizeCorrectFlag(value));
  }

  if (raw.length > 0) {
    const normalizedOptionTexts = normalizedOptions.map((opt) =>
      stripHtmlTags(String(opt || "")).toLowerCase()
    );

    const bitStringSource = raw.find(
      (value): value is string =>
        typeof value === "string" &&
        value.replace(/[\s,|;]/g, "").match(/^[01]+$/) !== null
    );

    if (bitStringSource) {
      const cleanedBits = bitStringSource.replace(/[\s,|;]/g, "");
      if (cleanedBits.length === normalizedOptions.length) {
        const bits = cleanedBits.split("").map((char: string) => (char === "1" ? 1 : 0));
        return bits;
      }
    }

    const indexFlags = raw
      .map((value) => {
        if (typeof value === "number" && Number.isFinite(value)) {
          return value;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      })
      .filter((idx): idx is number => idx !== null && idx >= 0 && idx < normalizedOptions.length);

    if (indexFlags.length > 0) {
      return normalizedOptions.map((_, idx) => (indexFlags.includes(idx) ? 1 : 0));
    }

    const textFlags = raw
      .map((value) => {
        if (value === null || value === undefined) return null;
        const text = stripHtmlTags(String(value)).trim();
        if (!text) return null;

        const letterMatch = text.match(/^[A-Da-d]/);
        if (letterMatch) {
          const idx = letterMatch[0].toUpperCase().charCodeAt(0) - 65;
          if (idx >= 0 && idx < normalizedOptions.length) return idx;
        }

        const normalizedText = text.toLowerCase();
        const idx = normalizedOptionTexts.findIndex((opt) => opt === normalizedText);
        return idx >= 0 ? idx : null;
      })
      .filter((idx): idx is number => idx !== null && idx >= 0 && idx < normalizedOptions.length);

    if (textFlags.length > 0) {
      return normalizedOptions.map((_, idx) => (textFlags.includes(idx) ? 1 : 0));
    }
  }

  return normalizedOptions.map(() => 0);
};

// Force convert snapshot question to ensure all text fields are strings
const normalizeSnapshotQuestion = (snapshot: SnapshotQuestion) => {
  const normalizedOptions = Array.isArray(snapshot.options)
    ? snapshot.options.map((opt: string | number) => String(opt ?? ""))
    : [];

  return {
    ...snapshot,
    text: String(snapshot.text ?? ""),
    type: normalizeQuestionTypeValue(snapshot.type),
    options: normalizedOptions,
    correctOptions: buildCorrectOptions(snapshot, normalizedOptions),
    points: Number(snapshot.points) || 1,
    explanation: snapshot.explanation ? String(snapshot.explanation) : undefined,
    images: Array.isArray(snapshot.images) ? snapshot.images : undefined,
    id: snapshot.id ? String(snapshot.id) : undefined,
    isExternal: Boolean(snapshot.isExternal),
    isNewQuestion: Boolean(snapshot.isNewQuestion ?? false),
    isDeleted: Boolean(snapshot.isDeleted ?? false),
    isDirty: Boolean(snapshot.isDirty ?? false),
  };
};

interface SearchableSelectProps {
  options: { value: string; label: string; code?: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  searchPlaceholder?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  loading = false,
  searchPlaceholder = "Search...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const lowerSearch = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lowerSearch) ||
        (opt.code && opt.code.toLowerCase().includes(lowerSearch))
    );
  }, [options, search]);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative" ref={containerRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 rounded-lg border flex items-center justify-between cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-indigo-500"
          }`}
        style={{
          backgroundColor: "var(--input-bg)",
          borderColor: "var(--input-border)",
          color: "var(--input-text)",
        }}
      >
        <span className={!selectedOption ? "text-gray-400" : ""}>
          {selectedOption
            ? `${selectedOption.code ? selectedOption.code + " - " : ""}${selectedOption.label}`
            : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 opacity-50" />
      </div>

      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 rounded-lg border shadow-lg overflow-hidden"
          style={{
            backgroundColor: "var(--card-surface)",
            borderColor: "var(--card-border)",
          }}
        >
          <div className="p-2 border-b" style={{ borderColor: "var(--card-border)" }}>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 opacity-50" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500"
                style={{
                  borderColor: "var(--input-border)",
                  color: "var(--heading-text)",
                }}
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
            ) : filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className="px-3 py-2 text-sm cursor-pointer flex items-center justify-between hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                  style={{ color: "var(--heading-text)" }}
                >
                  <span>
                    {option.code && <span className="font-mono opacity-70 mr-2">{option.code}</span>}
                    {option.label}
                  </span>
                  {value === option.value && <Check className="w-4 h-4 text-indigo-600" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const QuizCreatePage: React.FC = () => {
  const { user } = useAuth();
  const resolvedRole = (user?.role as "admin" | "teacher" | "student") || "teacher";
  const isTeacherOrAdmin = resolvedRole === "teacher" || resolvedRole === "admin";
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  const [courses, setCourses] = useState<Course[]>([]);
  const [wizardCourses, setWizardCourses] = useState<Course[]>([]); // All courses for wizard dropdown
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [quizCounts, setQuizCounts] = useState<Record<string, number>>({});
  const [searchParams, setSearchParams] = useSearchParams();

  const parsePageParam = useCallback((value: string | null) => {
    const pageNumber = Number(value);
    if (!Number.isFinite(pageNumber) || pageNumber <= 0) {
      return 1;
    }
    return Math.floor(pageNumber);
  }, []);

  const [coursesPage, setCoursesPageState] = useState(() => parsePageParam(searchParams.get("page")));

  const setCoursesPage = useCallback(
    (value: number | ((prev: number) => number)) => {
      setCoursesPageState((prev) => {
        const nextValue = typeof value === "function" ? (value as (p: number) => number)(prev) : value;
        const normalized = Math.max(1, Math.floor(nextValue) || 1);
        setSearchParams((prevParams) => {
          const params = new URLSearchParams(prevParams);
          if (normalized === 1) {
            params.delete("page");
          } else {
            params.set("page", String(normalized));
          }
          return params;
        });
        return normalized;
      });
    },
    [setSearchParams]
  );

  useEffect(() => {
    const pageFromUrl = parsePageParam(searchParams.get("page"));
    if (pageFromUrl !== coursesPage) {
      setCoursesPageState(pageFromUrl);
    }
  }, [searchParams, parsePageParam, coursesPage]);
  const [coursesPageSize] = useState(10);
  const [coursesPagination, setCoursesPagination] = useState<{
    totalItems: number;
    currentPage: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  } | null>(null);

  // Helper to wrap pagination values with quotes for /courses/:courseId/quizzes endpoint
  // Backend expects quoted strings like "100" instead of plain numbers
  const wrapPaginationValue = (value: number) => `"${value}"`;

  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<"details" | "select">("details");

  const [bankQuestions, setBankQuestions] = useState<QuizQuestion[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [randomCount, setRandomCount] = useState(0);
  const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set());

  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([emptyDraftQuestion()]);
  const [currentDraftPage, setCurrentDraftPage] = useState(1);
  const createMarkup = (content?: string) => ({ __html: content || "" });
  const [quizDetails, setQuizDetails] = useState<CreateQuizForm>({
    courseId: "",
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    shuffleQuestions: false,
    isPublished: true,
  });

  const [submittingQuiz, setSubmittingQuiz] = useState(false);


  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setLoadingSubjects(true);
        // Fetch subjects with max allowed limit
        const { data } = await subjectService.getAllSubjects({ limit: 100 });
        setSubjects(data);
      } catch (err) {
        console.error("Failed to load subjects", err);
        showSwalError("Failed to load subjects. Please refresh.", darkMode);
      } finally {
        setLoadingSubjects(false);
      }
    };
    fetchSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoadingCourses(true);
        const response = await http.get("/courses/my-courses", {
          params: {
            page: coursesPage,
            limit: coursesPageSize,
          },
        });

        const coursesList: Course[] = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.data)
            ? response.data.data
            : Array.isArray(response)
              ? (response as Course[])
              : [];

        setCourses(coursesList);

        const pagination = response?.pagination || response?.meta?.pagination;

        if (pagination && typeof pagination === 'object') {
          const paginationData = pagination as Record<string, unknown>;
          const totalItems =
            Number(paginationData.totalItems) ||
            Number(paginationData.total) ||
            coursesList.length;
          setCoursesPagination({
            totalItems,
            currentPage:
              Number(paginationData.currentPage) ||
              Number(paginationData.page) ||
              coursesPage,
            limit: Number(paginationData.limit) || coursesPageSize,
            totalPages:
              Number(paginationData.totalPages) ||
              Math.ceil(totalItems / coursesPageSize) ||
              1,
            hasNext:
              Boolean(paginationData.hasNext) ||
              Boolean(paginationData.hasNextPage) ||
              false,
            hasPrev:
              Boolean(paginationData.hasPrev) ||
              Boolean(paginationData.hasPrevPage) ||
              false,
          });
        } else {
          setCoursesPagination({
            totalItems: coursesList.length,
            currentPage: coursesPage,
            limit: coursesPageSize,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          });
        }
      } catch (err) {
        console.error("Failed to load courses", err);
        showSwalError("Failed to load courses. Please refresh.", darkMode);
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coursesPage, coursesPageSize]);

  useEffect(() => {
    const fetchQuizCounts = async () => {
      if (courses.length === 0) {
        setQuizCounts({});
        return;
      }

      const counts: Record<string, number> = {};
      await Promise.all(
        courses.map(async (course) => {
          try {
            const response = await quizService.getQuizzesByCourseId(course._id, {
              limit: wrapPaginationValue(1),
              page: wrapPaginationValue(1),
              isDeleted: false,
            });
            const paginationTotal = Number(response.pagination?.total);
            if (!Number.isNaN(paginationTotal)) {
              counts[course._id] = paginationTotal;
              return;
            }
            counts[course._id] = (response.data || []).filter((quiz) => !quiz.deletedAt).length;
          } catch (err) {
            console.error(`Failed to fetch quiz count for course ${course._id}:`, err);
            counts[course._id] = 0;
          }
        })
      );
      setQuizCounts(counts);
    };

    fetchQuizCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses]);

  const openWizardWithoutCourse = () => {
    setQuizDetails({
      courseId: "",
      title: "",
      description: "",
      startTime: "",
      endTime: "",
      shuffleQuestions: false,
      isPublished: true,
    });
    setDraftQuestions([emptyDraftQuestion()]);
    setSelectedBankIds(new Set());
    setWizardStep("details");
    setDraftQuestions([emptyDraftQuestion()]);
    setSelectedBankIds(new Set());
    setWizardStep("details");
    setShowWizard(true);
  };

  const fetchQuestionBank = async (subjectId: string) => {
    try {
      setBankLoading(true);
      const { data } = await quizQuestionService.getAllQuizQuestions({ subjectId, limit: 100 });
      // Ensure all text fields are strings (API might return number)
      const normalizedQuestions = data.map((q) => ({
        ...q,
        text: String(q.text || ""),
        options: Array.isArray(q.options) ? q.options.map((opt) => String(opt || "")) : [],
        explanation: q.explanation ? String(q.explanation) : undefined,
      }));
      setBankQuestions(normalizedQuestions);
    } catch (err) {
      console.error("Failed to fetch question bank", err);
      showSwalError("Failed to load questions from question bank.", darkMode);
    } finally {
      setBankLoading(false);
    }
  };

  const filteredBankQuestions = useMemo(() => {
    if (!bankSearch.trim()) return bankQuestions;
    const term = bankSearch.toLowerCase();
    return bankQuestions.filter((q) => q.text.toLowerCase().includes(term));
  }, [bankQuestions, bankSearch]);

  const toggleBankQuestion = (id: string) => {
    setSelectedBankIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const randomPickBankQuestions = async () => {
    // Validate: randomCount must be positive and less than available questions
    const availableCount = filteredBankQuestions.length;
    if (!randomCount || randomCount <= 0) {
      await showSwalError("Random count must be greater than 0.", darkMode);
      return;
    }
    if (randomCount > availableCount) {
      await showSwalError(`Random count (${randomCount}) cannot be greater than available questions (${availableCount}).`, darkMode);
      return;
    }
    if (availableCount === 0) {
      await showSwalError("No questions available to select.", darkMode);
      return;
    }
    const shuffled = [...filteredBankQuestions].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, randomCount);
    setSelectedBankIds(new Set(picked.map((q) => q._id)));
    await showRandomResultSwal(picked.length, darkMode);
  };

  const addDraftQuestion = () => {
    setDraftQuestions((prev) => [...prev, emptyDraftQuestion()]);
    setCurrentDraftPage(draftQuestions.length + 1); // Navigate to new question
  };
  const removeDraftQuestion = (id: string) => {
    setDraftQuestions((prev) => {
      const filtered = prev.filter((dq) => dq.id !== id);
      // Adjust current page if needed
      if (currentDraftPage > filtered.length) {
        setCurrentDraftPage(Math.max(1, filtered.length));
      }
      return filtered.length > 0 ? filtered : [emptyDraftQuestion()];
    });
  };
  const addOptionToDraft = (draftId: string) => {
    updateDraftQuestion(draftId, (prev) => ({
      ...prev,
      options: [...prev.options, ""],
      correctOptions: [...prev.correctOptions, 0],
    }));
  };
  const removeOptionFromDraft = (draftId: string, optionIndex: number) => {
    updateDraftQuestion(draftId, (prev) => {
      if (prev.options.length <= 2) return prev; // Minimum 2 options
      const newOptions = prev.options.filter((_, idx) => idx !== optionIndex);
      const newCorrectOptions = prev.correctOptions.filter((_, idx) => idx !== optionIndex);
      return { ...prev, options: newOptions, correctOptions: newCorrectOptions };
    });
  };
  const updateDraftQuestion = (id: string, updater: (draft: DraftQuestion) => DraftQuestion) => {
    setDraftQuestions((prev) => prev.map((dq) => (dq.id === id ? updater(dq) : dq)));
  };

  const buildSnapshot = (question: QuizQuestion, fromBank: boolean) => {
    const options = Array.isArray(question.options) ? question.options : [];
    const correct =
      Array.isArray(question.correctOptions) && question.correctOptions.length === options.length
        ? question.correctOptions
        : options.map((_, idx) =>
          question.correctOptions && question.correctOptions.includes(idx) ? 1 : 0
        );
    return {
      id: question._id ?? crypto.randomUUID(),
      text: String(fixNestedPTags(question.text || "")),
      type: normalizeQuestionTypeValue(question.type),
      options: options.map(opt => String(fixNestedPTags(opt))),
      correctOptions: correct,
      points: Number(question.points) || 1,
      explanation: question.explanation ? String(fixNestedPTags(question.explanation)) : undefined,
      images: Array.isArray(question.images)
        ? question.images.map((img) =>
          typeof img === "string" ? { url: img, fromDB: true } : { url: img.url, fromDB: img.fromDB ?? true }
        )
        : undefined,
      isExternal: !fromBank,
      isNewQuestion: !fromBank,
      isDeleted: false,
      isDirty: false,
    };
  };

  const createDraftQuestion = async (draft: DraftQuestion) => {
    if (!draft.text.trim()) return null;

    const sanitizedText = fixNestedPTags(draft.text.trim());
    const sanitizedOptions = draft.options.map((opt) => fixNestedPTags(opt));
    const normalizedCorrect = draft.correctOptions.map((flag) => (flag > 0 ? 1 : 0));
    const selectedType = normalizedCorrect.filter((flag) => flag === 1).length > 1 ? "multichoice" : "mcq";

    if (isTeacherOrAdmin) {
      return {
        _id: draft.id,
        subjectId: selectedSubjectId,
        text: sanitizedText,
        type: selectedType,
        options: sanitizedOptions,
        correctOptions: normalizedCorrect,
        points: 1,
        explanation: undefined,
      } as QuizQuestion;
    }

    const formData = new FormData();
    formData.append("subjectId", selectedSubjectId);
    formData.append("text", sanitizedText);
    formData.append("type", selectedType);
    formData.append("options", JSON.stringify(sanitizedOptions));
    formData.append("correctOptions", JSON.stringify(normalizedCorrect));

    const response = await http.post("/quiz-questions", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const created = response?.data as QuizQuestion;
    if (created) {
      created.text = String(created.text || "");
      if (Array.isArray(created.options)) {
        created.options = created.options.map((opt) => String(opt || ""));
      }
      if (created.explanation) {
        created.explanation = String(created.explanation);
      }
    }
    return created;
  };

  const submitQuiz = async () => {
    if (!selectedSubjectId) {
      await showSwalError("Please select a subject before creating the quiz.", darkMode);
      return;
    }
    if (!quizDetails.courseId) {
      await showSwalError("Please select a course before creating the quiz.", darkMode);
      return;
    }
    if (!quizDetails.title.trim()) {
      await showSwalError("Please enter a quiz title.", darkMode);
      return;
    }
    if (!quizDetails.startTime || !quizDetails.endTime) {
      await showSwalError("Please choose both start time and end time.", darkMode);
      return;
    }
    const start = new Date(quizDetails.startTime);
    const end = new Date(quizDetails.endTime);
    if (start >= end) {
      await showSwalError("End time must be later than start time.", darkMode);
      return;
    }
    try {
      setSubmittingQuiz(true);
      const snapshotQuestions = [];
      const selectedQuestions = bankQuestions.filter((q) => selectedBankIds.has(q._id));
      selectedQuestions.forEach((q) => snapshotQuestions.push(buildSnapshot(q, true)));

      for (const draft of draftQuestions) {
        if (!draft.text.trim()) continue;
        const created = await createDraftQuestion(draft);
        if (created) snapshotQuestions.push(buildSnapshot(created, false));
      }

      if (snapshotQuestions.length === 0) {
        await showSwalError("No questions have been selected. Please add questions to the quiz.", darkMode);
        return;
      }

      // Final normalization: ensure all text fields are strings before sending
      // This is MANDATORY - all text fields must be strings
      const normalizedSnapshots = snapshotQuestions.map((snapshot) => {
        const normalized = normalizeSnapshotQuestion(snapshot);
        // Double check: ensure text is definitely a string
        if (typeof normalized.text !== 'string') {
          console.error('Text is not string after normalization:', normalized.text, typeof normalized.text);
          normalized.text = String(normalized.text ?? "");
        }
        // Ensure options are strings
        normalized.options = normalized.options.map((opt: string | number) => {
          if (typeof opt !== 'string') {
            console.error('Option is not string:', opt, typeof opt);
            return String(opt ?? "");
          }
          return opt;
        });
        return normalized;
      });

      for (let i = 0; i < normalizedSnapshots.length; i++) {
        const snapshot = normalizedSnapshots[i];
        const optionTexts = (snapshot.options || []).map((opt) =>
          stripHtmlTags(String(opt ?? "")).toLowerCase()
        );
        if (optionTexts.length !== new Set(optionTexts).size) {
          const plainQuestion = stripHtmlTags(snapshot.text).slice(0, 120) || `Question ${i + 1}`;
          await showSwalError(
            `Question "${plainQuestion}" has duplicate answer options. Please ensure each option is unique.`,
            darkMode
          );
          return;
        }
      }

      normalizedSnapshots.forEach((snapshot) => {
        const trueCount = snapshot.correctOptions.filter((flag: number) => flag === 1).length;
        if (trueCount > 1) {
          snapshot.type = "multichoice";
        } else {
          snapshot.type = "mcq";
        }
      });

      const invalidSnapshot = normalizedSnapshots.find((snapshot) =>
        !snapshot.correctOptions.some((flag: number) => flag === 1)
      );
      if (invalidSnapshot) {
        const plainQuestion = stripHtmlTags(invalidSnapshot.text).slice(0, 120) || "Unnamed question";
        throw new Error(
          `Question "${plainQuestion}" does not have a correct answer. Please update it before creating the quiz.`
        );
      }

      await quizService.createQuiz({
        courseId: quizDetails.courseId,
        title: quizDetails.title.trim(),
        description: quizDetails.description.trim() || undefined,
        startTime: convertToISOUTC(quizDetails.startTime),
        endTime: convertToISOUTC(quizDetails.endTime),
        shuffleQuestions: quizDetails.shuffleQuestions,
        isPublished: quizDetails.isPublished,
        snapshotQuestions: normalizedSnapshots,
      });

      await showSwalSuccess("Quiz created successfully.", darkMode);
      setShowWizard(false);
    } catch (err) {
      console.error("Failed to create quiz", err);
      let message = "Failed to create quiz.";

      if (err && typeof err === "object") {
        if ("response" in err) {
          const axiosError = err as { response?: { data?: { message?: string; error?: { message?: string } } } };
          message = axiosError.response?.data?.message
            || axiosError.response?.data?.error?.message
            || message;
        } else if ("message" in err) {
          message = (err as { message: string }).message;
        }
      }

      await showSwalError(message, darkMode);
    } finally {
      setSubmittingQuiz(false);
    }
  };

  // Fetch all courses for the wizard dropdown when wizard opens
  useEffect(() => {
    if (showWizard && wizardCourses.length === 0) {
      const fetchAllCourses = async () => {
        try {
          // Use my-courses if teacher, or getAllCourses if admin
          // But for simplicity and consistency with current logic, let's use my-courses with high limit
          // If admin, they might want to see all courses? The current logic uses /courses/my-courses for the main list too.
          // Let's assume /courses/my-courses is correct for the user context.
          const response = await http.get<any>("/courses/my-courses", {
            params: { page: 1, limit: 100 },
          });

          let list: Course[] = [];
          if (Array.isArray(response?.data)) {
            list = response.data;
          } else if (Array.isArray(response?.data?.data)) {
            list = response.data.data;
          } else if (Array.isArray(response)) {
            list = response as Course[];
          }

          console.log("Wizard courses fetched:", list);
          setWizardCourses(list);
        } catch (error) {
          console.error("Failed to fetch courses for wizard", error);
        }
      };
      fetchAllCourses();
    }
  }, [showWizard, wizardCourses.length]);

  const handleDetailsNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId) {
      await showSwalError("Please select a subject before continuing.", darkMode);
      return;
    }
    if (!quizDetails.courseId) {
      await showSwalError("Please select a course before continuing.", darkMode);
      return;
    }
    if (!quizDetails.title.trim()) {
      await showSwalError("Please enter a quiz title.", darkMode);
      return;
    }
    if (!quizDetails.startTime || !quizDetails.endTime) {
      await showSwalError("Please choose both start time and end time.", darkMode);
      return;
    }
    const start = new Date(quizDetails.startTime);
    const end = new Date(quizDetails.endTime);
    if (start >= end) {
      await showSwalError("End time must be later than start time.", darkMode);
      return;
    }
    setWizardStep("select");
    fetchQuestionBank(selectedSubjectId);
  };

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{ backgroundColor: "var(--page-bg)", color: "var(--page-text)" }}
    >
      <Navbar />
      <Sidebar role={resolvedRole} />

      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 mt-16 sm:pl-24 md:pl-28">
          <div className="max-w-6xl mx-auto px-4 space-y-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--heading-text)" }}>
                  Questions & Quiz Builder
                </h1>
                <p className="text-sm" style={{ color: "var(--muted-text)" }}>

                </p>
              </div>
              {isTeacherOrAdmin && (
                <button
                  type="button"
                  onClick={openWizardWithoutCourse}
                  className="self-start px-4 py-2 rounded-xl font-semibold shadow-lg"
                  style={{ backgroundColor: "#6d28d9", color: "#fff" }}
                >
                  Create quiz
                </button>
              )}
            </header>


            <section
              className="rounded-3xl shadow-lg p-6 space-y-6 border"
              style={{ backgroundColor: "var(--card-surface)", borderColor: "var(--card-border)" }}
            >
              <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--heading-text)" }}>
                Courses
              </h2>
              {loadingCourses ? (
                <p style={{ color: "var(--muted-text)" }}>Loading courses...</p>
              ) : courses.length === 0 ? (
                <p style={{ color: "var(--muted-text)" }}>No courses available.</p>
              ) : (
                <div className="grid gap-4">
                  {courses.map((course) => (
                    <div
                      key={course._id}
                      className="rounded-2xl border px-6 py-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg flex flex-col gap-3 cursor-pointer"
                      style={{
                        backgroundColor: "var(--card-row-bg)",
                        borderColor: "var(--card-row-border)",
                      }}
                      onClick={() => navigate(`/quizz/${course._id}`)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="text-base font-semibold" style={{ color: "var(--heading-text)" }}>
                            {course.title}
                          </div>
                          {course.code && (
                            <div className="text-xs mt-1 uppercase tracking-wide" style={{ color: "var(--muted-text)" }}>
                              {course.code}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <FileText className="w-4 h-4" style={{ color: "var(--muted-text)" }} />
                            <span className="text-xs" style={{ color: "var(--muted-text)" }}>
                              {quizCounts[course._id] !== undefined ? `${quizCounts[course._id]} quiz${quizCounts[course._id] !== 1 ? 'zes' : ''}` : 'Loading...'}
                            </span>
                          </div>
                        </div>
                        <span
                          className="text-xs font-semibold px-4 py-1.5 rounded-full shadow"
                          style={{ backgroundColor: "#1d4ed8", color: "#fff" }}
                        >
                          View quizzes
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: "var(--muted-text)" }}>
                        Click card to view or manage quizzes for this course.
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {coursesPagination && coursesPagination.totalPages > 1 && (
                <QuizPagination
                  currentPage={coursesPagination.currentPage}
                  totalPages={coursesPagination.totalPages}
                  textColor="var(--heading-text)"
                  borderColor="var(--card-border)"
                  hasPrev={coursesPagination.hasPrev}
                  hasNext={coursesPagination.hasNext}
                  pageOptions={Array.from({ length: Math.min(5, coursesPagination.totalPages) }, (_, i) => {
                    const start = Math.max(1, coursesPagination.currentPage - 2);
                    return Math.min(start + i, coursesPagination.totalPages);
                  }).filter((v, i, arr) => arr.indexOf(v) === i)}
                  onPrev={() => setCoursesPage((p) => Math.max(1, p - 1))}
                  onNext={() => setCoursesPage((p) => Math.min(coursesPagination!.totalPages, p + 1))}
                  onSelectPage={(page) => setCoursesPage(page)}
                />
              )}
            </section>
          </div>
        </main>
      </div>

      {showWizard && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowWizard(false)} />
          <div
            className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl p-6 space-y-4"
            style={{
              backgroundColor: "var(--card-surface)",
              color: "var(--heading-text)",
              border: "1px solid var(--card-border)",
            }}
          >
            {wizardStep === "details" ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold">Create Quiz</h2>
                    <p className="text-sm" style={{ color: "var(--muted-text)" }}>
                      Fill out the details below to publish a new quiz.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWizard(false)}
                    className="px-3 py-1 rounded-lg text-sm font-semibold"
                    style={{ backgroundColor: "var(--divider-color)", color: "var(--heading-text)" }}
                  >
                    Close
                  </button>
                </div>

                <form onSubmit={handleDetailsNext} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--muted-text)" }}>
                      Course
                    </label>
                    <SearchableSelect
                      options={wizardCourses.map((c) => ({ value: c._id, label: c.title, code: c.code }))}
                      value={quizDetails.courseId}
                      onChange={(val) => {
                        setQuizDetails((prev) => ({ ...prev, courseId: val }));
                        // Auto-select subject based on course
                        const selectedCourse = wizardCourses.find(c => c._id === val);
                        if (selectedCourse && selectedCourse.subjectId) {
                          const subjId = typeof selectedCourse.subjectId === 'object'
                            ? selectedCourse.subjectId._id
                            : selectedCourse.subjectId;
                          if (subjId) {
                            setSelectedSubjectId(subjId);
                          }
                        }
                      }}
                      placeholder="Select course..."
                      searchPlaceholder="Search course by title or code..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--muted-text)" }}>
                      Subject
                    </label>
                    <SearchableSelect
                      options={subjects.map((s) => ({ value: s._id, label: s.name, code: s.code }))}
                      value={selectedSubjectId}
                      onChange={(val) => setSelectedSubjectId(val)}
                      loading={loadingSubjects}
                      placeholder="Select subject..."
                      searchPlaceholder="Search subject by name or code..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--muted-text)" }}>
                      Title
                    </label>
                    <input
                      type="text"
                      value={quizDetails.title}
                      onChange={(e) => setQuizDetails((prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border"
                      style={{
                        backgroundColor: "var(--input-bg)",
                        borderColor: "var(--input-border)",
                        color: "var(--input-text)",
                      }}
                      placeholder="Enter quiz title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--muted-text)" }}>
                      Description
                    </label>
                    <textarea
                      value={quizDetails.description}
                      onChange={(e) => setQuizDetails((prev) => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border"
                      style={{
                        backgroundColor: "var(--input-bg)",
                        borderColor: "var(--input-border)",
                        color: "var(--input-text)",
                      }}
                      rows={3}
                      placeholder="Short description of the quiz"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: "var(--muted-text)" }}>
                        Start Time
                      </label>
                      <input
                        type="datetime-local"
                        value={quizDetails.startTime}
                        onChange={(e) => setQuizDetails((prev) => ({ ...prev, startTime: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border"
                        style={{
                          backgroundColor: "var(--input-bg)",
                          borderColor: "var(--input-border)",
                          color: "var(--input-text)",
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: "var(--muted-text)" }}>
                        End Time
                      </label>
                      <input
                        type="datetime-local"
                        value={quizDetails.endTime}
                        onChange={(e) => setQuizDetails((prev) => ({ ...prev, endTime: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border"
                        style={{
                          backgroundColor: "var(--input-bg)",
                          borderColor: "var(--input-border)",
                          color: "var(--input-text)",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={quizDetails.isPublished}
                        onChange={(e) => setQuizDetails((prev) => ({ ...prev, isPublished: e.target.checked }))}
                        className="w-4 h-4 rounded border"
                        style={{
                          backgroundColor: quizDetails.isPublished ? "var(--primary-color)" : "var(--input-bg)",
                          borderColor: "var(--input-border)",
                        }}
                      />
                      <span className="text-sm font-medium" style={{ color: "var(--muted-text)" }}>
                        Published
                      </span>
                    </label>
                  </div>


                  <div className="flex items-center justify-between pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowWizard(false)}
                      className="px-4 py-2 rounded-lg text-sm font-medium"
                      style={{ backgroundColor: "var(--divider-color)", color: "var(--heading-text)" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white"
                    >
                      Next: Add questions
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold">Add Questions</h2>
                    <p className="text-sm" style={{ color: "var(--muted-text)" }}>
                      Chọn câu hỏi từ question bank hoặc tạo câu mới để thêm vào quiz.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWizard(false)}
                    className="px-3 py-1 rounded-lg text-sm font-semibold"
                    style={{ backgroundColor: "var(--divider-color)", color: "var(--heading-text)" }}
                  >
                    Close
                  </button>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div
                    className="border rounded-2xl p-4 space-y-3"
                    style={{ backgroundColor: "var(--card-row-bg)", borderColor: "var(--card-row-border)" }}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Question Bank</h3>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max={filteredBankQuestions.length}
                          className="w-20 px-2 py-1 border rounded"
                          placeholder="Random"
                          value={randomCount || ""}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (val < 0) {
                              setRandomCount(0);
                            } else if (val > filteredBankQuestions.length) {
                              setRandomCount(filteredBankQuestions.length);
                            } else {
                              setRandomCount(val);
                            }
                          }}
                        />
                        <span className="text-xs" style={{ color: "var(--muted-text)" }}>
                          / {filteredBankQuestions.length}
                        </span>
                        <button
                          type="button"
                          onClick={randomPickBankQuestions}
                          className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
                        >
                          Random pick
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="Search question..."
                      value={bankSearch}
                      onChange={(e) => setBankSearch(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                      style={{ borderColor: "var(--card-row-border)", backgroundColor: "var(--card-row-bg)", color: "var(--heading-text)" }}
                    />
                    <div className="max-h-[360px] overflow-y-auto space-y-3">
                      {bankLoading ? (
                        <p className="text-sm" style={{ color: "var(--muted-text)" }}>
                          Loading questions...
                        </p>
                      ) : filteredBankQuestions.length === 0 ? (
                        <p className="text-sm" style={{ color: "var(--muted-text)" }}>
                          No questions found.
                        </p>
                      ) : (
                        filteredBankQuestions.map((question) => (
                          <label
                            key={question._id}
                            className="flex items-start gap-2 border rounded-xl p-3 cursor-pointer transition-colors"
                            style={{
                              borderColor: "var(--card-row-border)",
                              backgroundColor: "var(--card-row-bg)",
                            }}
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={selectedBankIds.has(question._id)}
                              onChange={() => toggleBankQuestion(question._id)}
                            />
                            <div>
                              <div
                                className="font-medium prose prose-sm max-w-none"
                                style={{ color: "var(--heading-text)" }}
                                dangerouslySetInnerHTML={createMarkup(question.text)}
                              />
                              {Array.isArray(question.options) && (
                                <ul className="text-sm list-disc pl-5 mt-1 space-y-0.5" style={{ color: "var(--muted-text)" }}>
                                  {question.options.map((opt, idx) => (
                                    <li key={idx}>
                                      {String.fromCharCode(65 + idx)}.{" "}
                                      <span
                                        className={
                                          question.correctOptions?.[idx] === 1 ? "text-emerald-600 font-semibold" : ""
                                        }
                                        dangerouslySetInnerHTML={createMarkup(opt)}
                                      />
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  <div
                    className="border rounded-2xl p-4 space-y-4"
                    style={{ backgroundColor: "var(--card-row-bg)", borderColor: "var(--card-row-border)" }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Create New Questions</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm" style={{ color: "var(--muted-text)" }}>
                          {draftQuestions.length} question{draftQuestions.length !== 1 ? 's' : ''}
                        </span>
                        <button
                          type="button"
                          onClick={addDraftQuestion}
                          className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
                        >
                          + Add question
                        </button>
                      </div>
                    </div>

                    {/* Pagination Navigation */}
                    {draftQuestions.length > 1 && (
                      <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: "var(--card-row-border)" }}>
                        <button
                          type="button"
                          onClick={() => setCurrentDraftPage(Math.max(1, currentDraftPage - 1))}
                          disabled={currentDraftPage === 1}
                          className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                          style={{ borderColor: "var(--card-row-border)" }}
                        >
                          ← Previous
                        </button>
                        <span className="text-sm font-medium" style={{ color: "var(--heading-text)" }}>
                          Question {currentDraftPage} of {draftQuestions.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCurrentDraftPage(Math.min(draftQuestions.length, currentDraftPage + 1))}
                          disabled={currentDraftPage === draftQuestions.length}
                          className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                          style={{ borderColor: "var(--card-row-border)" }}
                        >
                          Next →
                        </button>
                      </div>
                    )}

                    {/* Current Question Form */}
                    {draftQuestions[currentDraftPage - 1] && (() => {
                      const draft = draftQuestions[currentDraftPage - 1];
                      return (
                        <div
                          className="border rounded-xl p-4 space-y-3"
                          style={{ borderColor: "var(--card-row-border)", backgroundColor: "var(--input-bg)" }}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-semibold" style={{ color: "var(--heading-text)" }}>
                              Question {currentDraftPage}
                            </p>
                            {draftQuestions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeDraftQuestion(draft.id)}
                                className="text-sm text-red-500 hover:text-red-700"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <textarea
                            className="w-full border rounded-lg px-3 py-2"
                            placeholder="Enter question text..."
                            value={draft.text}
                            onChange={(e) =>
                              updateDraftQuestion(draft.id, (prev) => ({ ...prev, text: e.target.value }))
                            }
                            style={{
                              borderColor: "var(--card-row-border)",
                              backgroundColor: "var(--card-row-bg)",
                              color: "var(--heading-text)",
                            }}
                            rows={3}
                          />
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-sm font-medium" style={{ color: "var(--muted-text)" }}>
                                Options
                              </label>
                              <button
                                type="button"
                                onClick={() => addOptionToDraft(draft.id)}
                                className="text-xs px-2 py-1 rounded bg-indigo-600 text-white"
                              >
                                + Add option
                              </button>
                            </div>
                            {draft.options.map((option, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <label className="text-sm font-medium w-16" style={{ color: "var(--muted-text)" }}>
                                  {String.fromCharCode(65 + idx)}.
                                </label>
                                <input
                                  type="text"
                                  className="flex-1 border rounded-lg px-3 py-2"
                                  value={option}
                                  onChange={(e) =>
                                    updateDraftQuestion(draft.id, (prev) => {
                                      const nextOptions = [...prev.options];
                                      nextOptions[idx] = e.target.value;
                                      return { ...prev, options: nextOptions };
                                    })
                                  }
                                  style={{
                                    borderColor: "var(--card-row-border)",
                                    backgroundColor: "var(--card-row-bg)",
                                    color: "var(--heading-text)",
                                  }}
                                  placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                                />
                                <label className="flex items-center gap-1 text-sm" style={{ color: "var(--muted-text)" }}>
                                  <input
                                    type="checkbox"
                                    checked={draft.correctOptions[idx] === 1}
                                    onChange={(e) =>
                                      updateDraftQuestion(draft.id, (prev) => {
                                        const next = [...prev.correctOptions];
                                        next[idx] = e.target.checked ? 1 : 0;
                                        return { ...prev, correctOptions: next };
                                      })
                                    }
                                  />
                                  Correct
                                </label>
                                {draft.options.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => removeOptionFromDraft(draft.id, idx)}
                                    className="text-red-500 hover:text-red-700 text-sm px-2"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowWizard(false)}
                    className="px-4 py-2 rounded-lg border text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep("details")}
                    className="px-4 py-2 rounded-lg border text-sm font-medium"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={submitQuiz}
                    disabled={submittingQuiz}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingQuiz ? "Creating..." : "Create quiz"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizCreatePage;


