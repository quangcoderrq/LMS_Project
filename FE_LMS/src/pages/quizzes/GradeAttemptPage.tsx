import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Save, ArrowLeft } from "lucide-react";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useTheme } from "../../hooks/useTheme";
import { quizAttemptService } from "../../services";
import type { AttemptDetailsResponse, AnswerDetail, RegradePayload } from "../../types/quizAttemptGrading";
import Swal from "sweetalert2";

export default function GradeAttemptPage() {
    const { attemptId } = useParams<{ attemptId: string }>();
    const navigate = useNavigate();
    const { darkMode } = useTheme();

    const [attempt, setAttempt] = useState<AttemptDetailsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Local state for editing grades
    const [grades, setGrades] = useState<{ [questionId: string]: number }>({});
    const [feedbacks, setFeedbacks] = useState<{ [questionId: string]: string }>({});
    const [generalFeedback, setGeneralFeedback] = useState("");

    useEffect(() => {
        if (attemptId) {
            loadAttemptDetails();
        }
    }, [attemptId]);

    const loadAttemptDetails = async () => {
        if (!attemptId) return;
        try {
            setLoading(true);
            const response = await quizAttemptService.getAttemptDetailsForGrading(attemptId);
            setAttempt(response);

            //Initialize local state
            const initialGrades: { [key: string]: number } = {};
            const initialFeedbacks: { [key: string]: string } = {};

            response.data.answers.forEach(ans => {
                initialGrades[ans.questionId] = ans.pointsEarned;
                if (ans.feedback) initialFeedbacks[ans.questionId] = ans.feedback;
            });

            setGrades(initialGrades);
            setFeedbacks(initialFeedbacks);

        } catch (err: any) {
            console.error("Failed to load attempt details:", err);
            Swal.fire({
                icon: "error",
                title: "Error",
                text: "Failed to load attempt details",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleGradeChange = (questionId: string, value: string) => {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
            setGrades(prev => ({ ...prev, [questionId]: numValue }));
        }
    };

    const handleFeedbackChange = (questionId: string, value: string) => {
        setFeedbacks(prev => ({ ...prev, [questionId]: value }));
    };

    const calculateTotalScore = () => {
        return Object.values(grades).reduce((sum, current) => sum + current, 0);
    };

    const getTotalQuizScore = () => {
        if (attempt && typeof attempt.data.quizId === 'object') {
            return attempt.data.quizId.snapshotQuestions.reduce((sum: number, q: any) => sum + (q.points || 1), 0);
        }
        return 0;
    };

    const handleSubmitRegrade = async () => {
        if (!attemptId || !attempt) return;

        const totalQuizScore = getTotalQuizScore();
        const confirmed = await Swal.fire({
            title: "Confirm Regrade",
            text: `Total Score: ${calculateTotalScore().toFixed(2)} / ${totalQuizScore}. Save changes?`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Save",
        });

        if (!confirmed.isConfirmed) return;

        try {
            setSaving(true);

            const payload: RegradePayload = {
                answers: Object.keys(grades).map(qId => ({
                    questionId: qId,
                    pointsEarned: grades[qId],
                    feedback: feedbacks[qId]
                })),
                totalScore: calculateTotalScore(),
                feedback: generalFeedback
            };

            await quizAttemptService.submitRegrade(attemptId, payload);

            await Swal.fire({
                icon: "success",
                title: "Success",
                text: "Regrade submitted successfully",
            });

            // Reload to show updated history
            loadAttemptDetails();

        } catch (err: any) {
            console.error("Failed to submit regrade:", err);
            Swal.fire({
                icon: "error",
                title: "Error",
                text: err.message || "Failed to submit regrade",
            });
        } finally {
            setSaving(false);
        }
    };

    const renderMarkup = (content?: string) => ({ __html: content || "" });

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center" style={{ backgroundColor: darkMode ? "#0f172a" : "#f8fafc", color: "var(--muted-text)" }}>
                Loading attempt details...
            </div>
        );
    }

    if (!attempt) {
        return (
            <div className="flex h-screen items-center justify-center" style={{ backgroundColor: darkMode ? "#0f172a" : "#f8fafc", color: "var(--error-text)" }}>
                Attempt not found
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: darkMode ? "#0f172a" : "#f8fafc" }}>
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Navbar />
                <main className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "var(--page-bg)", color: "var(--page-text)" }}>
                    <div className="max-w-5xl mx-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <button
                                    onClick={() => navigate(-1)}
                                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-2"
                                >
                                    <ArrowLeft className="w-4 h-4" /> Back to List
                                </button>
                                <h1 className="text-2xl font-bold" style={{ color: "var(--heading-text)" }}>
                                    Grading Attempt
                                </h1>
                                <p className="text-sm mt-1" style={{ color: "var(--muted-text)" }}>
                                    Student ID: <span className="font-medium text-blue-600">{attempt.data.studentId}</span>
                                </p>
                                <p className="text-sm" style={{ color: "var(--muted-text)" }}>
                                    Submitted: {attempt.data.submittedAt ? new Date(attempt.data.submittedAt).toLocaleString() : 'N/A'}
                                </p>
                            </div>

                            <div className="text-right">
                                <div className="text-3xl font-bold text-blue-600">
                                    {calculateTotalScore().toFixed(1)} <span className="text-lg text-gray-500">/ {getTotalQuizScore()}</span>
                                </div>
                                <p className="text-sm text-gray-500">Current Score</p>
                            </div>
                        </div>

                        {/* Questions List */}
                        <div className="space-y-6 mb-8">
                            {attempt.data.answers.map((ans: AnswerDetail, index: number) => (
                                <div
                                    key={ans.questionId}
                                    className="rounded-xl border p-6"
                                    style={{ backgroundColor: "var(--card-surface)", borderColor: "var(--card-border)" }}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="font-semibold text-lg" style={{ color: "var(--heading-text)" }}>
                                            Question {index + 1}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium" style={{ color: "var(--muted-text)" }}>
                                                Points:
                                            </span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.5"
                                                value={grades[ans.questionId] ?? 0}
                                                onChange={(e) => handleGradeChange(ans.questionId, e.target.value)}
                                                className="w-20 p-1 rounded border text-center font-bold"
                                                style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--card-border)" }}
                                            />
                                            <span className="text-sm text-gray-500">/ {ans.points || 1}</span>
                                        </div>
                                    </div>

                                    {/* Question Content */}
                                    <div className="mb-4 prose prose-sm max-w-none" style={{ color: "var(--page-text)" }}>
                                        <div dangerouslySetInnerHTML={renderMarkup(ans.text)} />
                                        {ans.images && ans.images.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {ans.images.map((img, i) => (
                                                    <img key={i} src={img.url} alt="Question" className="h-32 object-contain rounded border" />
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Options / Answer */}
                                    <div className="space-y-2 mb-4">
                                        {ans.options.map((opt, optIdx) => {
                                            const isSelected = ans.answer[optIdx] === 1;
                                            const isCorrect = ans.correctOptions ? ans.correctOptions[optIdx] === 1 : false; // Assuming correctOptions is available or derived
                                            // Note: API response might need to include correctOptions explicitly if not present in AnswerDetail

                                            let optionClass = "p-3 rounded border flex items-center justify-between ";
                                            if (isSelected && isCorrect) optionClass += "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800";
                                            else if (isSelected && !isCorrect) optionClass += "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800";
                                            else if (!isSelected && isCorrect) optionClass += "bg-green-50 border-green-200 border-dashed dark:bg-green-900/10 dark:border-green-800";
                                            else optionClass += "border-gray-200 dark:border-gray-700";

                                            return (
                                                <div key={optIdx} className={optionClass}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300"
                                                            }`}>
                                                            {String.fromCharCode(65 + optIdx)}
                                                        </div>
                                                        <span dangerouslySetInnerHTML={renderMarkup(opt)} />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {isSelected && <span className="text-xs font-bold text-blue-600">Student Answer</span>}
                                                        {isCorrect && <span className="text-xs font-bold text-green-600">Correct Answer</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Teacher Feedback */}
                                    <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--card-border)" }}>
                                        <label className="block text-sm font-medium mb-2" style={{ color: "var(--muted-text)" }}>
                                            Teacher Feedback
                                        </label>
                                        <textarea
                                            value={feedbacks[ans.questionId] || ""}
                                            onChange={(e) => handleFeedbackChange(ans.questionId, e.target.value)}
                                            placeholder="Add feedback for this question..."
                                            className="w-full p-2 rounded border text-sm"
                                            rows={2}
                                            style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--card-border)", color: "var(--page-text)" }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* General Feedback & Actions */}
                        <div className="rounded-xl border p-6 mb-20" style={{ backgroundColor: "var(--card-surface)", borderColor: "var(--card-border)" }}>
                            <h3 className="font-semibold text-lg mb-4" style={{ color: "var(--heading-text)" }}>
                                Overall Feedback
                            </h3>
                            <textarea
                                value={generalFeedback}
                                onChange={(e) => setGeneralFeedback(e.target.value)}
                                placeholder="General comments for the student..."
                                className="w-full p-3 rounded border"
                                rows={4}
                                style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--card-border)", color: "var(--page-text)" }}
                            />
                        </div>

                        {/* Floating Action Bar */}
                        <div className="fixed bottom-0 left-0 right-0 p-4 border-t shadow-lg z-10"
                            style={{ backgroundColor: darkMode ? "#1e293b" : "white", borderColor: "var(--card-border)", marginLeft: "250px" /* Sidebar width approx */ }}>
                            <div className="max-w-5xl mx-auto flex justify-between items-center">
                                <div className="text-sm">
                                    <span className="font-medium" style={{ color: "var(--heading-text)" }}>Total Score: </span>
                                    <span className="text-xl font-bold text-blue-600">{calculateTotalScore().toFixed(1)}</span>
                                    <span style={{ color: "var(--muted-text)" }}> / {getTotalQuizScore()}</span>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => navigate(-1)}
                                        className="px-4 py-2 rounded border hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                        style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSubmitRegrade}
                                        disabled={saving}
                                        className="flex items-center gap-2 px-6 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                                    >
                                        <Save className="w-4 h-4" />
                                        {saving ? "Saving..." : "Save Regrade"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
