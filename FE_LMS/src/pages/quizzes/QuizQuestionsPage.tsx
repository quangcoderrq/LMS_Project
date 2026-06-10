import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit3, Trash2 } from "lucide-react";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { quizService } from "../../services";
import type { QuizResponse, SnapshotQuestion } from "../../services/quizService";
import type { QuizQuestion } from "../../services";
import type { EditFormState } from "../../types/quiz";
import { EditQuestionModal } from "../../components/quiz/EditQuestionModal";
import { QuizPageHeader } from "../../components/quiz/QuizPageHeader";

const MIN_OPTIONS = 2;

export default function QuizQuestionsPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const newImageInputRef = useRef<HTMLInputElement | null>(null);

  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<SnapshotQuestion | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const resolvedRole = (user?.role as "admin" | "teacher" | "student") || "student";
  const canManageSnapshots = resolvedRole === "admin" || resolvedRole === "teacher";

  const getSwalBaseOptions = () => ({
    confirmButtonColor: "#4f46e5",
    cancelButtonColor: "#94a3b8",
    focusCancel: false,
    background: darkMode ? "#1e293b" : "#ffffff",
    color: darkMode ? "#e2e8f0" : "#1e293b",
  });

  const showSwalConfirm = useCallback(async (message: string) => {
    const Swal = (await import("sweetalert2")).default;
    const base = getSwalBaseOptions();
    const result = await Swal.fire({
      ...base,
      icon: "warning",
      title: "Confirm action",
      text: message,
      showCancelButton: true,
      confirmButtonText: "Yes",
      cancelButtonText: "Cancel",
    });
    return result.isConfirmed;
  }, [darkMode]);

  const showSwalError = useCallback(async (message: string) => {
    const Swal = (await import("sweetalert2")).default;
    const base = getSwalBaseOptions();
    await Swal.fire({
      ...base,
      icon: "error",
      title: "Error",
      text: message,
      confirmButtonText: "Got it",
      showCancelButton: false,
    });
  }, [darkMode]);

  const showSwalSuccess = useCallback(async (message: string) => {
    const Swal = (await import("sweetalert2")).default;
    const base = getSwalBaseOptions();
    await Swal.fire({
      ...base,
      icon: "success",
      title: "Success",
      text: message,
      timer: 1500,
      showConfirmButton: false,
    });
  }, [darkMode]);

  useEffect(() => {
    if (!quizId) {
      setError("Quiz ID is required");
      setLoading(false);
      return;
    }

    const fetchQuiz = async () => {
      try {
        setLoading(true);
        setError(null);
        const quizData = await quizService.getQuizById(quizId);
        setQuiz(quizData);
      } catch (err) {
        console.error("Failed to fetch quiz:", err);
        const message =
          typeof err === "object" && err !== null && "message" in err
            ? String((err as { message?: string }).message)
            : "Failed to load quiz";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId]);

  const questions = quiz?.snapshotQuestions?.filter((q) => !q.isDeleted) || [];

  const resolveSnapshotId = (question?: SnapshotQuestion | null) => {
    if (!question) return "";
    return question.id || question._id || "";
  };

  const openEditModal = (question: SnapshotQuestion) => {
    const options = Array.isArray(question.options) && question.options.length > 0 ? question.options : ["", ""];
    const normalizedOptions = options.length >= MIN_OPTIONS ? options : [...options, ""];
    const correct = Array.isArray(question.correctOptions) ? question.correctOptions : [];
    const flags = normalizedOptions.map((_, idx) => correct[idx] === 1);

    setEditingQuestion(question);
    setEditForm({
      text: question.text || "",
      points: Number(question.points) || 1,
      explanation: question.explanation || "",
      options: normalizedOptions,
      correctFlags: flags,
      existingImages: question.images || [],
      deletedImageUrls: [],
      newImageFiles: [],
      newImagePreviews: [],
    });
  };

  const closeEditModal = () => {
    setEditingQuestion(null);
    setEditForm(null);
    setSavingEdit(false);
  };

  const handleEditInputChange = (field: keyof EditFormState, value: string | number) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      [field]: field === "points" ? Number(value) : value,
    });
  };

  const handleOptionChange = (index: number, value: string) => {
    setEditForm((prev) =>
      prev
        ? {
          ...prev,
          options: prev.options.map((opt, idx) => (idx === index ? value : opt)),
        }
        : prev
    );
  };

  const handleToggleCorrect = (index: number) => {
    setEditForm((prev) =>
      prev
        ? {
          ...prev,
          correctFlags: prev.correctFlags.map((flag, idx) => (idx === index ? !flag : flag)),
        }
        : prev
    );
  };

  const handleAddOption = () => {
    setEditForm((prev) =>
      prev
        ? {
          ...prev,
          options: [...prev.options, ""],
          correctFlags: [...prev.correctFlags, false],
        }
        : prev
    );
  };

  const handleRemoveOption = (index: number) => {
    setEditForm((prev) => {
      if (!prev) return prev;
      const newOptions = prev.options.filter((_, idx) => idx !== index);
      const newFlags = prev.correctFlags.filter((_, idx) => idx !== index);
      return { ...prev, options: newOptions, correctFlags: newFlags };
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

  const handleSelectNewImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!quizId || !editForm) return;

    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      // Convert FileList to File array
      const fileArray = Array.from(files);

      // Upload images
      const uploadedImages = await quizService.uploadQuestionImages(quizId, fileArray);

      // Add uploaded images to editForm
      setEditForm({
        ...editForm,
        existingImages: [...(editForm.existingImages || []), ...uploadedImages],
      });

      // Clear input so user can select same file again if needed
      if (newImageInputRef.current) {
        newImageInputRef.current.value = '';
      }
    } catch (err: any) {
      await showSwalError(err?.response?.data?.message || err?.message || "Failed to upload images");
    }
  };

  const handleRemoveNewImage = (index: number) => {
    // No-op
  };

  const handleDeleteQuestion = async (question: SnapshotQuestion) => {
    if (!quizId) return;
    const snapshotId = resolveSnapshotId(question);
    if (!snapshotId) {
      await showSwalError("Cannot delete this question (missing ID).");
      return;
    }

    const confirmed = await showSwalConfirm("Are you sure you want to remove this question from the quiz?");
    if (!confirmed) return;

    try {
      setDeletingId(snapshotId);
      const updatedQuiz = await quizService.deleteQuestionById(quizId, snapshotId);
      setQuiz(updatedQuiz);
      await showSwalSuccess("Question removed.");
    } catch (err) {
      console.error("Failed to delete snapshot question:", err);
      await showSwalError("Failed to remove question.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmitEdit = async () => {
    if (!quizId || !editingQuestion || !editForm) return;

    const snapshotId = resolveSnapshotId(editingQuestion);
    if (!snapshotId) {
      await showSwalError("Missing question ID.");
      return;
    }

    const trimmedText = editForm.text.trim();
    const cleanedOptions = editForm.options.map((opt) => opt.trim());
    const hasValidOptions = cleanedOptions.every((opt) => opt.length > 0);
    const hasCorrectAnswer = editForm.correctFlags.some(Boolean);
    const selectedCorrectCount = editForm.correctFlags.filter(Boolean).length;
    const originalType = editingQuestion.type || "mcq";

    if (!trimmedText) {
      await showSwalError("Please provide question text.");
      return;
    }

    if (cleanedOptions.length < MIN_OPTIONS || !hasValidOptions) {
      await showSwalError("Each question must have at least two valid options.");
      return;
    }

    if (!hasCorrectAnswer) {
      await showSwalError("Select at least one correct option.");
      return;
    }

    const canBeMulti = originalType === "mcq" || originalType === "multichoice";
    if (selectedCorrectCount > 1 && !canBeMulti) {
      await showSwalError("This question allows only one correct option.");
      return;
    }

    let nextType = originalType;
    if (selectedCorrectCount > 1 && canBeMulti) {
      nextType = "multichoice";
    } else if (selectedCorrectCount === 1 && originalType === "multichoice") {
      nextType = "mcq";
    }

    try {
      setSavingEdit(true);

      // Filter out deleted images
      const remainingImages = (editForm.existingImages || []).filter(
        img => !editForm.deletedImageUrls.includes(img.url)
      );

      const updatedQuiz = await quizService.updateQuestionById(quizId, snapshotId, {
        text: trimmedText,
        points: editForm.points,
        explanation: editForm.explanation?.trim() || undefined,
        options: cleanedOptions,
        correctOptions: editForm.correctFlags.map((flag) => (flag ? 1 : 0)),
        type: nextType,
        images: remainingImages, // Send remaining images
      });

      setQuiz(updatedQuiz);
      await showSwalSuccess("Question updated.");
      closeEditModal();
    } catch (err) {
      console.error("Failed to update snapshot question:", err);
      await showSwalError("Failed to update question. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const renderMarkup = (content?: string | number) => ({ __html: content ? String(content) : "" });

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: darkMode ? "#0f172a" : "#f8fafc" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6 pt-28" style={{ backgroundColor: "var(--page-bg)", color: "var(--page-text)" }}>
          <div className="max-w-6xl mx-auto">
            <QuizPageHeader
              title={quiz ? quiz.title : "Loading..."}
              onBack={() => navigate(-1)}
              darkMode={darkMode}
              textColor={darkMode ? "#e2e8f0" : "#1e293b"}
            />

            {quiz?.description && (
              <p className="text-sm mb-6 md:ml-[50px]" style={{ color: "var(--muted-text)" }}>
                {quiz.description}
              </p>
            )}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <p style={{ color: "var(--muted-text)" }}>Loading questions...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div
                className="rounded-lg p-4 mb-6"
                style={{ backgroundColor: "var(--error-bg)", color: "var(--error-text)" }}
              >
                {error}
              </div>
            )}

            {/* Questions List */}
            {!loading && !error && (
              <>
                {questions.length === 0 ? (
                  <div
                    className="rounded-lg p-8 text-center md:ml-[50px]"
                    style={{ backgroundColor: "var(--card-surface)", border: "1px solid var(--card-border)" }}
                  >
                    <p style={{ color: "var(--muted-text)" }}>No questions available.</p>
                  </div>
                ) : (
                  <div className="space-y-4 md:ml-[50px]">
                    {questions.map((question, index) => (
                      <div
                        key={question.id || index}
                        className="border rounded-xl p-4 relative group"
                        style={{ borderColor: "var(--card-row-border)", backgroundColor: "var(--card-row-bg)" }}
                      >
                        {canManageSnapshots && (
                          <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditModal(question)}
                              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="Edit question"
                            >
                              <Edit3 className="w-4 h-4 text-blue-500" />
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(question)}
                              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="Delete question"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        )}

                        <div className="flex items-start gap-3">
                          <span className="font-semibold text-lg" style={{ color: "var(--heading-text)" }}>
                            {index + 1}.
                          </span>
                          <div className="flex-1 pr-16">
                            <div
                              className="mb-3 prose prose-sm max-w-none"
                              style={{ color: "var(--heading-text)" }}
                              dangerouslySetInnerHTML={renderMarkup(question.text)}
                            />

                            {/* Images */}
                            {question.images && question.images.length > 0 && (
                              <div className="flex flex-wrap gap-4 mb-4">
                                {question.images.map((img, i) => (
                                  <img
                                    key={i}
                                    src={img.url}
                                    alt={`Question image ${i + 1}`}
                                    className="h-32 w-auto object-contain rounded-lg border"
                                    style={{ borderColor: "var(--card-border)" }}
                                  />
                                ))}
                              </div>
                            )}

                            {Array.isArray(question.options) && question.options.length > 0 && (
                              <ul className="space-y-2">
                                {question.options.map((opt, idx) => (
                                  <li
                                    key={idx}
                                    className={`text-sm ${question.correctOptions?.[idx] === 1
                                      ? "font-semibold text-emerald-600"
                                      : ""
                                      }`}
                                    style={{
                                      color:
                                        question.correctOptions?.[idx] === 1
                                          ? "#10b981"
                                          : "var(--muted-text)",
                                    }}
                                  >
                                    <span className="font-semibold mr-1">
                                      {String.fromCharCode(65 + idx)}.
                                    </span>
                                    <span dangerouslySetInnerHTML={renderMarkup(opt)} />
                                    {question.correctOptions?.[idx] === 1 && (
                                      <span className="ml-2 text-xs">✓ Correct</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {question.explanation && (
                              <div className="mt-3 p-2 rounded" style={{ backgroundColor: "var(--card-surface)" }}>
                                <p className="text-xs font-medium mb-1" style={{ color: "var(--muted-text)" }}>
                                  Explanation:
                                </p>
                                <div
                                  className="text-sm prose prose-sm max-w-none"
                                  style={{ color: "var(--heading-text)" }}
                                  dangerouslySetInnerHTML={renderMarkup(question.explanation)}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {editingQuestion && editForm && (
        <EditQuestionModal
          question={editingQuestion as unknown as QuizQuestion}
          editForm={editForm}
          darkMode={darkMode}
          textColor={darkMode ? "#e2e8f0" : "#1e293b"}
          borderColor={darkMode ? "rgba(148,163,184,0.2)" : "rgba(148,163,184,0.2)"}
          savingEdit={savingEdit}
          newImageInputRef={newImageInputRef}
          onClose={closeEditModal}
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
      )}
    </div>
  );
}
