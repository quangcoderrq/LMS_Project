import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Search, X } from "lucide-react";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import { feedbackService } from "../../services/feedbackService";
import { userService } from "../../services/userService";
import { renderMarkdown } from "../../utils/markdown";
import type { FeedbackType } from "../../types/feedback";
import type { User } from "../../types/auth";

interface FeedbackFormState {
	type: FeedbackType;
	rating: number;
	title: string;
	description: string;
	targetId?: string;
}

const categories: { value: FeedbackType; label: string }[] = [
	{ value: "system", label: "System" },
	{ value: "teacher", label: "Teacher" },
	{ value: "other", label: "Other" }
];

export default function Feedback() {
	const { darkMode } = useTheme();
	const { user } = useAuth();
	const navigate = useNavigate();
	const isAdmin = (user?.role as string) === "admin";
	const isTeacher = (user?.role as string) === "teacher";
	const [submitting, setSubmitting] = useState(false);
	const [success, setSuccess] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [teachers, setTeachers] = useState<User[]>([]);
	const [loadingTeachers, setLoadingTeachers] = useState(false);
	const [teacherError, setTeacherError] = useState<string | null>(null);
	const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
	const [teacherSearchTerm, setTeacherSearchTerm] = useState("");
	const [highlightedTeacherIndex, setHighlightedTeacherIndex] = useState(-1);
	const teacherModalRef = useRef<HTMLDivElement>(null);
	const teacherSearchInputRef = useRef<HTMLInputElement>(null);
	const [form, setForm] = useState<FeedbackFormState>({
		type: "system",
		rating: 5,
		title: "",
		description: "",
		targetId: undefined
	});
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	const emojiOptions = ["😀", "🙂", "😐", "😕", "😡", "❤️", "🚀"];
	const categoryOptions = useMemo(
		() => (isTeacher ? categories.filter((c) => c.value !== "teacher") : categories),
		[isTeacher]
	);

	const isValid = useMemo(() => {
		const commonValid = form.title.trim().length >= 6 && form.description.trim().length >= 10 && form.rating > 0;
		// Nếu là feedback cho giáo viên thì bắt buộc phải chọn một giáo viên
		if (form.type === "teacher") {
			return commonValid && !!form.targetId;
		}
		return commonValid;
	}, [form.title, form.description, form.rating, form.type, form.targetId]);

	useEffect(() => {
		if (isAdmin) {
			navigate("/help/feedback-list", { replace: true });
		}
	}, [isAdmin, navigate]);

	useEffect(() => {
		if (!isTeacher || form.type !== "teacher") return;
		setForm((prev) => ({
			...prev,
			type: "system",
			targetId: undefined
		}));
	}, [isTeacher, form.type]);

	// Tự động load danh sách giáo viên khi người dùng chọn type = "teacher"
	useEffect(() => {
		const shouldLoadTeachers = form.type === "teacher" && teachers.length === 0 && !loadingTeachers;
		if (!shouldLoadTeachers) return;

		const fetchTeachers = async () => {
			setLoadingTeachers(true);
			setTeacherError(null);
			try {
				const response = await userService.getUsers({ role: "teacher", limit: 50 });
				setTeachers(response.users);
			} catch {
				setTeacherError("Unable to load teachers. Please try again later.");
			} finally {
				setLoadingTeachers(false);
			}
		};

		void fetchTeachers();
	}, [form.type, teachers.length, loadingTeachers]);

	// Filter teachers based on search term
	const filteredTeachers = useMemo(() => {
		if (!teacherSearchTerm.trim()) return teachers;
		const searchLower = teacherSearchTerm.toLowerCase();
		return teachers.filter(
			(t) =>
				(t.fullname || "").toLowerCase().includes(searchLower) ||
				(t.username || "").toLowerCase().includes(searchLower) ||
				(t.email || "").toLowerCase().includes(searchLower)
		);
	}, [teachers, teacherSearchTerm]);

	// Focus search input when modal opens
	useEffect(() => {
		if (isTeacherModalOpen) {
			setTimeout(() => {
				teacherSearchInputRef.current?.focus();
			}, 100);
		}
	}, [isTeacherModalOpen]);

	// Handle keyboard navigation
	useEffect(() => {
		if (!isTeacherModalOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setHighlightedTeacherIndex((prev) =>
					prev < filteredTeachers.length - 1 ? prev + 1 : prev
				);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setHighlightedTeacherIndex((prev) => (prev > 0 ? prev - 1 : -1));
			} else if (e.key === "Enter" && highlightedTeacherIndex >= 0) {
				e.preventDefault();
				const teacher = filteredTeachers[highlightedTeacherIndex];
				if (teacher) {
					setForm((f) => ({ ...f, targetId: teacher._id }));
					setIsTeacherModalOpen(false);
					setTeacherSearchTerm("");
					setHighlightedTeacherIndex(-1);
				}
			} else if (e.key === "Escape") {
				setIsTeacherModalOpen(false);
				setTeacherSearchTerm("");
				setHighlightedTeacherIndex(-1);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isTeacherModalOpen, filteredTeachers, highlightedTeacherIndex]);

	const handleCloseTeacherModal = () => {
		setIsTeacherModalOpen(false);
		setTeacherSearchTerm("");
		setHighlightedTeacherIndex(-1);
	};

	const handleSelectTeacher = (teacherId: string) => {
		setForm((f) => ({ ...f, targetId: teacherId }));
		handleCloseTeacherModal();
	};

	if (isAdmin) {
		return null;
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isValid) return;
		setSubmitting(true);
		setSuccess(null);
		setError(null);

		try {
			await feedbackService.submitFeedback({
				type: form.type,
				title: form.title.trim(),
				description: form.description.trim(),
				rating: form.rating,
				// targetId chỉ gửi khi là feedback cho giáo viên
				targetId: form.type === "teacher" ? form.targetId : undefined
			});
			setSuccess("Thank you! Your feedback has been recorded.");
			setForm((prev) => ({
				...prev,
				title: "",
				description: "",
				rating: 5,
				type: "system",
				targetId: undefined
			}));
			navigate("/help/feedback-list");
		} catch {
			setError("Failed to send feedback. Please try again.");
		} finally {
			setSubmitting(false);
		}
	};

	const markdownPreview = useMemo(() => renderMarkdown(form.description), [form.description]);

	const handleEmojiInsert = (emoji: string) => {
		setForm((prev) => ({
			...prev,
			description: prev.description ? `${prev.description} ${emoji}` : emoji
		}));
	};

	type MarkdownAction =
		| "bold"
		| "italic"
		| "code"
		| "strike"
		| "unordered-list"
		| "ordered-list"
		| "link";

	const applyMarkdown = (action: MarkdownAction) => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		const { selectionStart = 0, selectionEnd = 0, value } = textarea;
		const hasSelection = selectionEnd > selectionStart;
		const selectedText = hasSelection ? value.slice(selectionStart, selectionEnd) : "";
		let insertText = "";
		let cursorStart = selectionStart;
		let cursorEnd: number;

		const wrap = (prefix: string, suffix = prefix, placeholder = "text") => {
			const inner = selectedText || placeholder;
			insertText = `${prefix}${inner}${suffix}`;
			const offset = prefix.length;
			cursorStart = selectionStart + offset;
			cursorEnd = cursorStart + inner.length;
		};

		switch (action) {
			case "bold":
				wrap("**");
				break;
			case "italic":
				wrap("_", "_");
				break;
			case "code":
				wrap("`");
				break;
			case "strike":
				wrap("~~");
				break;
			case "unordered-list": {
				const text = selectedText || "List item";
				const lines = text.split("\n").map((line) => (line.startsWith("- ") ? line : `- ${line}`));
				insertText = lines.join("\n");
				cursorStart = selectionStart;
				cursorEnd = selectionStart + insertText.length;
				break;
			}
			case "ordered-list": {
				const text = selectedText || "Step one";
				const lines = text
					.split("\n")
					.map((line, index) => (line.match(/^\d+\.\s/) ? line : `${index + 1}. ${line}`));
				insertText = lines.join("\n");
				cursorStart = selectionStart;
				cursorEnd = selectionStart + insertText.length;
				break;
			}
			case "link": {
				const label = selectedText || "Link text";
				insertText = `[${label}](https://example.com)`;
				cursorStart = selectionStart + 1;
				cursorEnd = cursorStart + label.length;
				break;
			}
			default:
				return;
		}

		const updatedValue = `${value.slice(0, selectionStart)}${insertText}${value.slice(selectionEnd)}`;
		setForm((prev) => ({ ...prev, description: updatedValue }));

		requestAnimationFrame(() => {
			if (!textarea) return;
			textarea.focus();
			textarea.selectionStart = cursorStart;
			textarea.selectionEnd = cursorEnd;
		});
	};

	return (
		<>
			<div
				className="flex h-screen overflow-hidden relative"
			style={{
				backgroundColor: darkMode ? "#0b1220" : "#f5f7fb",
				color: darkMode ? "#e5e7eb" : "#1f2937"
			}}
		>
			<Navbar />
			<Sidebar role={(user?.role as "admin" | "teacher" | "student") || "student"} />

			<main className="flex-1 overflow-y-auto pt-24 px-6 sm:px-10">
				<style>
					{`
					@keyframes fadeInUp {
						from { opacity: 0; transform: translateY(8px); }
						to { opacity: 1; transform: translateY(0); }
					}
					@keyframes slideIn {
						from { opacity: 0; transform: translateX(6px); }
						to { opacity: 1; transform: translateX(0); }
					}
					@keyframes gentleFloat {
						0% { transform: translateY(0); }
						50% { transform: translateY(-2px); }
						100% { transform: translateY(0); }
					}
					@keyframes shimmer {
						0% { background-position: -200% 0; }
						100% { background-position: 200% 0; }
					}
					@keyframes popIn {
						0% { opacity: 0; transform: scale(0.9); }
						60% { opacity: 1; transform: scale(1.04); }
						100% { transform: scale(1); }
					}
					@keyframes progress {
						0% { transform: translateX(-100%); }
						100% { transform: translateX(0%); }
					}
					.fade-in-up { animation: fadeInUp 420ms ease both; }
					.slide-in { animation: slideIn 300ms ease both; }
					.gentle-float { animation: gentleFloat 4s ease-in-out infinite; }
					.pop-in { animation: popIn 280ms ease-out both; }
					.progress-bar { transform-origin: left center; animation: progress 900ms ease forwards; }
					`}
				</style>
				<div className="max-w-4xl mx-auto">
					<div
						className="h-1.5 w-28 rounded-full mb-2"
						style={{
							backgroundImage: "linear-gradient(90deg, #525fe1, #7c3aed, #22d3ee)",
							animation: "shimmer 2.4s linear infinite",
							backgroundSize: "200% 100%"
						}}
					/>
					<header className="mb-6 fade-in-up flex items-center justify-between" style={{ animationDelay: "40ms" }}>
						<div>
							<h1
								className="text-2xl sm:text-3xl font-bold tracking-tight"
								style={{ color: darkMode ? "#ffffff" : "#111827" }}
							>
								Feedback
							</h1>
							<p className="mt-2 text-sm" style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}>
								Tell us about your experience so we can improve the platform.
							</p>
						</div>

						<button
							type="button"
							onClick={() => navigate(-1)}
							className="px-3 py-2 rounded-full font-semibold border transition-all pulse-button relative click-animate flex items-center justify-center"
							style={{
								background: darkMode ? "rgba(30,41,59,0.85)" : "rgba(226,232,255,0.8)",
								color: darkMode ? "#e0e7ff" : "#4338ca",
								borderColor: darkMode ? "rgba(148,163,184,0.5)" : "rgba(99,102,241,0.35)",
								width: "48px",
								height: "40px"
							}}
							aria-label="Go back"
						>
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
								<path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
							</svg>
						</button>
					</header>
					{submitting && (
						<div className="w-full h-1 overflow-hidden rounded-full mb-3" style={{ background: darkMode ? "#111827" : "#e5e7eb" }}>
							<div
								className="h-full progress-bar"
								style={{
									width: "100%",
									backgroundImage: "linear-gradient(90deg, #525fe1, #7c3aed)",
									boxShadow: "0 0 12px rgba(124,58,237,0.35)",
									transform: "translateX(-100%)"
								}}
							/>
						</div>
					)}

					<div
						className="rounded-2xl shadow-lg p-6 sm:p-8 fade-in-up"
						style={{
							background: darkMode ? "rgba(17, 24, 39, 0.8)" : "rgba(255,255,255,0.95)",
							border: "1px solid rgba(148, 163, 184, 0.15)",
							backdropFilter: "blur(8px)"
						}}
					>
						<form onSubmit={handleSubmit} className="space-y-6">
							{/* Category & Rating */}
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div className="fade-in-up" style={{ animationDelay: "80ms" }}>
									<label className="block text-sm font-medium mb-1">Category</label>
									<select
										value={form.type}
										onChange={(e) =>
											setForm((f) => ({
												...f,
												type: e.target.value as FeedbackType,
												// Reset teacher khi đổi sang loại feedback khác
												targetId: e.target.value === "teacher" ? f.targetId : undefined
											}))
										}
										className="w-full rounded-xl px-3 py-2 outline-none transition-colors"
										style={{
											backgroundColor: darkMode ? "#0f172a" : "#f9fafb",
											border: "1px solid rgba(148,163,184,0.25)"
										}}
									>
										{categoryOptions.map((c) => (
											<option key={c.value} value={c.value}>
												{c.label}
											</option>
										))}
									</select>
								</div>
								<div className="fade-in-up" style={{ animationDelay: "120ms" }}>
									<label className="block text-sm font-medium mb-1">Rating</label>
									<div className="flex items-center gap-1 gentle-float">
										{Array.from({ length: 5 }).map((_, i) => {
											const active = i < form.rating;
											return (
												<button
													type="button"
													key={i}
													onClick={() => setForm((f) => ({ ...f, rating: i + 1 }))}
													className="p-2 rounded-lg transition-transform hover:scale-110 hover:rotate-3"
													aria-label={`Rate ${i + 1} star${i === 0 ? "" : "s"}`}
													style={{
														backgroundColor: "transparent"
													}}
												>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														viewBox="0 0 24 24"
														fill={active ? "#fbbf24" : "none"}
														stroke={active ? "#f59e0b" : darkMode ? "#64748b" : "#94a3b8"}
														className="w-7 h-7 transition-colors"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth="1.5"
															d="M11.48 3.499a.562.562 0 011.04 0l2.012 5.111a.563.563 0 00.475.354l5.518.403c.499.036.701.663.322.988l-4.204 3.57a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0l-4.725 2.885a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557l-4.204-3.57a.563.563 0 01.322-.988l5.518-.403a.563.563 0 00.475-.354l2.012-5.11z"
														/>
													</svg>
												</button>
											);
										})}
										<span className="ml-2 text-sm" style={{ color: darkMode ? "#cbd5e1" : "#475569" }}>
											{form.rating}/5
										</span>
									</div>
								</div>
							</div>

							{/* Teacher selector (only when type = teacher) */}
							{form.type === "teacher" && (
								<div className="fade-in-up" style={{ animationDelay: "140ms" }}>
									<label className="block text-sm font-medium mb-1">Teacher</label>
									<button
										type="button"
										onClick={() => !loadingTeachers && setIsTeacherModalOpen(true)}
										disabled={loadingTeachers}
										className="w-full rounded-xl px-3 py-2 outline-none transition-colors text-left flex items-center justify-between"
										style={{
											backgroundColor: darkMode ? "#0f172a" : "#f9fafb",
											border: "1px solid rgba(148,163,184,0.25)",
											color: darkMode ? "#ffffff" : "#000000",
											cursor: loadingTeachers ? "not-allowed" : "pointer",
											opacity: loadingTeachers ? 0.6 : 1
										}}
									>
										<span style={{ color: form.targetId ? (darkMode ? "#ffffff" : "#000000") : (darkMode ? "#64748b" : "#94a3b8") }}>
											{loadingTeachers
												? "Loading teachers..."
												: form.targetId
												? teachers.find((t) => t._id === form.targetId)?.fullname ||
												  teachers.find((t) => t._id === form.targetId)?.username ||
												  "Select a teacher"
												: "Select a teacher"}
										</span>
										<div className="flex items-center gap-2">
											{form.targetId && !loadingTeachers && (
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														setForm((f) => ({ ...f, targetId: undefined }));
														setTeacherSearchTerm("");
													}}
													className="p-0.5 rounded hover:bg-opacity-20"
													style={{ color: darkMode ? "#94a3b8" : "#64748b" }}
												>
													<X size={14} />
												</button>
											)}
											<ChevronDown
												size={16}
												style={{ color: darkMode ? "#94a3b8" : "#64748b" }}
											/>
										</div>
									</button>
									{teacherError && (
										<p className="mt-1 text-xs" style={{ color: "#ef4444" }}>
											{teacherError}
										</p>
									)}
								</div>
							)}

							{/* Title */}
							<div className="fade-in-up" style={{ animationDelay: "160ms" }}>
								<label className="block text-sm font-medium mb-1">Title</label>
								<input
									type="text"
									value={form.title}
									onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
									placeholder="A short summary of your feedback"
									className="w-full rounded-xl px-3 py-2 outline-none placeholder-gray-400 transition-shadow focus:shadow-lg"
									style={{
										backgroundColor: darkMode ? "#0f172a" : "#f9fafb",
										border: "1px solid rgba(148,163,184,0.25)"
									}}
								/>
							</div>

							{/* Message */}
							<div className="fade-in-up" style={{ animationDelay: "200ms" }}>
								<label className="block text-sm font-medium mb-1 flex items-center gap-2">
									Detailed description
									<span
										className="text-[11px] px-2 py-0.5 rounded-full"
										style={{
											backgroundColor: darkMode ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.15)",
											color: darkMode ? "#bfdbfe" : "#1d4ed8"
										}}
									>
										Supports Markdown
									</span>
								</label>
								<div className="flex flex-wrap gap-2 mb-2">
									<button
										type="button"
										onClick={() => applyMarkdown("bold")}
										className="px-2 py-1 text-xs rounded-lg border font-semibold click-animate"
										style={{
											borderColor: darkMode ? "rgba(148,163,184,0.4)" : "rgba(148,163,184,0.4)",
											backgroundColor: darkMode ? "rgba(15,23,42,0.6)" : "rgba(248,250,252,0.8)"
										}}
									>
										<strong>B</strong>
									</button>
									<button
										type="button"
										onClick={() => applyMarkdown("italic")}
										className="px-2 py-1 text-xs rounded-lg border italic click-animate"
										style={{
											borderColor: darkMode ? "rgba(148,163,184,0.4)" : "rgba(148,163,184,0.4)",
											backgroundColor: darkMode ? "rgba(15,23,42,0.6)" : "rgba(248,250,252,0.8)"
										}}
									>
										I
									</button>
									<button
										type="button"
										onClick={() => applyMarkdown("code")}
										className="px-2 py-1 text-xs rounded-lg border font-mono click-animate"
										style={{
											borderColor: darkMode ? "rgba(148,163,184,0.4)" : "rgba(148,163,184,0.4)",
											backgroundColor: darkMode ? "rgba(15,23,42,0.6)" : "rgba(248,250,252,0.8)"
										}}
									>
										`code`
									</button>
									<button
										type="button"
										onClick={() => applyMarkdown("strike")}
										className="px-2 py-1 text-xs rounded-lg border click-animate"
										style={{
											borderColor: darkMode ? "rgba(148,163,184,0.4)" : "rgba(148,163,184,0.4)",
											backgroundColor: darkMode ? "rgba(15,23,42,0.6)" : "rgba(248,250,252,0.8)"
										}}
									>
										<del>S</del>
									</button>
									<button
										type="button"
										onClick={() => applyMarkdown("unordered-list")}
										className="px-2 py-1 text-xs rounded-lg border click-animate"
										style={{
											borderColor: darkMode ? "rgba(148,163,184,0.4)" : "rgba(148,163,184,0.4)",
											backgroundColor: darkMode ? "rgba(15,23,42,0.6)" : "rgba(248,250,252,0.8)"
										}}
									>
										• List
									</button>
									<button
										type="button"
										onClick={() => applyMarkdown("ordered-list")}
										className="px-2 py-1 text-xs rounded-lg border click-animate"
										style={{
											borderColor: darkMode ? "rgba(148,163,184,0.4)" : "rgba(148,163,184,0.4)",
											backgroundColor: darkMode ? "rgba(15,23,42,0.6)" : "rgba(248,250,252,0.8)"
										}}
									>
										1. List
									</button>
									<button
										type="button"
										onClick={() => applyMarkdown("link")}
										className="px-2 py-1 text-xs rounded-lg border click-animate"
										style={{
											borderColor: darkMode ? "rgba(148,163,184,0.4)" : "rgba(148,163,184,0.4)",
											backgroundColor: darkMode ? "rgba(15,23,42,0.6)" : "rgba(248,250,252,0.8)"
										}}
									>
										Link
									</button>
								</div>
								<textarea
									ref={textareaRef}
									value={form.description}
									onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
									placeholder="Describe the issue or proposal with steps, expected vs actual, etc."
									rows={6}
									className="w-full rounded-xl px-3 py-2 outline-none resize-y placeholder-gray-400 transition-shadow focus:shadow-lg"
									style={{
										backgroundColor: darkMode ? "#0f172a" : "#f9fafb",
										border: "1px solid rgba(148,163,184,0.25)"
									}}
								/>
								<div className="flex flex-wrap gap-2 mt-3">
									{emojiOptions.map((emoji) => (
										<button
											key={emoji}
											type="button"
											onClick={() => handleEmojiInsert(emoji)}
											className="px-3 py-1 rounded-full border text-lg click-animate"
											style={{
												borderColor: darkMode ? "rgba(148,163,184,0.4)" : "rgba(148,163,184,0.6)",
												backgroundColor: darkMode ? "rgba(15,23,42,0.7)" : "#fff"
											}}
											aria-label={`Insert emoji ${emoji}`}
										>
											{emoji}
										</button>
									))}
								</div>
								<p className="mt-2 text-xs" style={{ color: darkMode ? "#94a3b8" : "#6b7280" }}>
									Add context, reproduction steps (if any), and screenshots if possible. Mix in Markdown for clearer sections.
								</p>
								<div className="mt-4">
									<div
										className="rounded-2xl p-4 border"
										style={{
											borderColor: darkMode ? "rgba(148,163,184,0.35)" : "rgba(148,163,184,0.4)",
											backgroundColor: darkMode ? "rgba(15,23,42,0.9)" : "#fff"
										}}
									>
										<div className="flex items-center justify-between mb-2 text-xs font-semibold" style={{ color: darkMode ? "#94a3b8" : "#374151" }}>
											<span>Live preview</span>
											<span>Rendered Markdown</span>
										</div>
										<div
											className="prose prose-sm max-w-none text-sm"
											style={{
												color: darkMode ? "#e5e7eb" : "#111827"
											}}
											dangerouslySetInnerHTML={{
												__html:
													markdownPreview ||
													"<p class='text-xs' style='opacity:0.6'>Start typing Markdown (lists, code, links…) to preview here.</p>"
											}}
										/>
									</div>
								</div>
							</div>

							{/* Submit */}
							<div className="flex items-center gap-3 fade-in-up" style={{ animationDelay: "320ms" }}>
								<button
									type="submit"
									disabled={!isValid || submitting}
									className={`px-5 py-2.5 rounded-xl font-semibold transition-all active:scale-[0.98] relative overflow-hidden ${
										submitting || !isValid
											? "opacity-60 cursor-not-allowed"
											: "hover:shadow-lg hover:-translate-y-0.5"
									}`}
									style={{
										background: "linear-gradient(135deg, #525fe1 0%, #7c3aed 100%)",
										color: "#fff"
									}}
								>
									{submitting ? "Sending..." : "Submit feedback"}
									{!submitting && isValid && (
										<span
											aria-hidden
											className="absolute inset-0"
											style={{
												background:
													"linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.25) 20%, transparent 40%)",
												backgroundSize: "200% 100%",
												animation: "shimmer 1800ms linear infinite"
											}}
										/>
									)}
								</button>
								{success && <span className="text-sm slide-in pop-in px-3 py-1 rounded-lg" style={{ color: "#10b981", background: darkMode ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>{success}</span>}
								{error && <span className="text-sm slide-in" style={{ color: "#ef4444" }}>{error}</span>}
							</div>
						</form>
					</div>

					<section className="mt-8">
						<h2 className="text-lg font-semibold mb-3" style={{ color: darkMode ? "#e5e7eb" : "#111827" }}>
							How to write effective feedback
						</h2>
						<ul className="list-disc pl-5 space-y-1 text-sm" style={{ color: darkMode ? "#cbd5e1" : "#374151" }}>
							<li>State clearly the goal you want to achieve.</li>
							<li>For bugs, include steps to reproduce, expected vs actual result.</li>
							<li>Attach screenshots if possible to speed up triage.</li>
						</ul>
					</section>
				</div>
			</main>
		</div>

		{/* Teacher Selection Modal */}
		{isTeacherModalOpen && (
			<div
				className="fixed inset-0 z-50 flex items-center justify-center p-4"
				style={{ backgroundColor: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(4px)" }}
				onClick={handleCloseTeacherModal}
			>
				<div
					ref={teacherModalRef}
					className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden"
					style={{
						backgroundColor: darkMode ? "rgba(15, 23, 42, 0.98)" : "#ffffff",
						borderColor: darkMode ? "rgba(148, 163, 184, 0.3)" : "rgba(148, 163, 184, 0.2)",
						maxHeight: "80vh",
						display: "flex",
						flexDirection: "column"
					}}
					onClick={(e) => e.stopPropagation()}
				>
					{/* Modal Header */}
					<div
						className="flex items-center justify-between p-4 border-b"
						style={{
							borderColor: darkMode ? "rgba(148, 163, 184, 0.25)" : "rgba(148, 163, 184, 0.25)"
						}}
					>
						<h3
							className="text-lg font-semibold"
							style={{ color: darkMode ? "#ffffff" : "#1f2937" }}
						>
							Select a Teacher
						</h3>
						<button
							type="button"
							onClick={handleCloseTeacherModal}
							className="p-1.5 rounded-lg hover:bg-opacity-20 transition-colors"
							style={{
								color: darkMode ? "#94a3b8" : "#64748b",
								backgroundColor: darkMode ? "rgba(148, 163, 184, 0.1)" : "rgba(148, 163, 184, 0.1)"
							}}
						>
							<X size={20} />
						</button>
					</div>

					{/* Search Input */}
					<div
						className="p-4 border-b"
						style={{
							borderColor: darkMode ? "rgba(148, 163, 184, 0.25)" : "rgba(148, 163, 184, 0.25)",
							backgroundColor: darkMode ? "rgba(15, 23, 42, 0.5)" : "#f9fafb"
						}}
					>
						<div className="relative">
							<Search
								size={18}
								className="absolute left-3 top-1/2 transform -translate-y-1/2"
								style={{ color: darkMode ? "#94a3b8" : "#64748b" }}
							/>
							<input
								ref={teacherSearchInputRef}
								type="text"
								value={teacherSearchTerm}
								onChange={(e) => {
									setTeacherSearchTerm(e.target.value);
									setHighlightedTeacherIndex(-1);
								}}
								placeholder="Search by name, username, or email..."
								className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm outline-none transition-shadow focus:shadow-lg"
								style={{
									backgroundColor: darkMode ? "rgba(15, 23, 42, 0.8)" : "#ffffff",
									borderColor: darkMode ? "rgba(148, 163, 184, 0.25)" : "rgba(148, 163, 184, 0.25)",
									color: darkMode ? "#ffffff" : "#000000"
								}}
							/>
						</div>
					</div>

					{/* Teachers List */}
					<div
						className="flex-1 overflow-y-auto p-2"
						style={{ maxHeight: "calc(80vh - 140px)" }}
					>
						{loadingTeachers ? (
							<div
								className="flex items-center justify-center py-12"
								style={{ color: darkMode ? "#94a3b8" : "#64748b" }}
							>
								<span className="text-sm">Loading teachers...</span>
							</div>
						) : filteredTeachers.length === 0 ? (
							<div
								className="flex flex-col items-center justify-center py-12 px-4"
								style={{ color: darkMode ? "#94a3b8" : "#64748b" }}
							>
								<Search size={48} className="mb-3 opacity-50" />
								<p className="text-sm font-medium">
									{teacherSearchTerm ? "No teachers found" : "No teachers available"}
								</p>
								{teacherSearchTerm && (
									<p className="text-xs mt-1 opacity-75">
										Try a different search term
									</p>
								)}
							</div>
						) : (
							<div className="space-y-1">
								{filteredTeachers.map((teacher, index) => {
									const displayName = teacher.fullname || teacher.username || "Unknown";
									const isSelected = teacher._id === form.targetId;
									const isHighlighted = highlightedTeacherIndex === index;

									return (
										<button
											key={teacher._id}
											type="button"
											onClick={() => handleSelectTeacher(teacher._id)}
											className="w-full px-4 py-3 rounded-xl text-left transition-all"
											style={{
												backgroundColor: isSelected
													? darkMode
														? "rgba(99, 102, 241, 0.3)"
														: "rgba(99, 102, 241, 0.1)"
													: isHighlighted
													? darkMode
														? "rgba(75, 85, 99, 0.3)"
														: "#f3f4f6"
													: "transparent",
												color: darkMode ? "#ffffff" : "#1f2937",
												border: isSelected
													? darkMode
														? "1px solid rgba(99, 102, 241, 0.5)"
														: "1px solid rgba(99, 102, 241, 0.3)"
													: "1px solid transparent"
											}}
											onMouseEnter={() => setHighlightedTeacherIndex(index)}
										>
											<div className="flex items-center justify-between">
												<div className="flex-1 min-w-0">
													<p className="font-medium text-sm truncate">{displayName}</p>
													{teacher.email && (
														<p
															className="text-xs mt-0.5 truncate"
															style={{ color: darkMode ? "#94a3b8" : "#64748b" }}
														>
															{teacher.email}
														</p>
													)}
													{teacher.username && teacher.username !== displayName && (
														<p
															className="text-xs mt-0.5 truncate"
															style={{ color: darkMode ? "#94a3b8" : "#64748b" }}
														>
															@{teacher.username}
														</p>
													)}
												</div>
												{isSelected && (
													<div
														className="ml-3 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
														style={{
															backgroundColor: darkMode
																? "rgba(99, 102, 241, 0.5)"
																: "rgba(99, 102, 241, 0.2)"
														}}
													>
														<div
															className="w-2 h-2 rounded-full"
															style={{
																backgroundColor: darkMode ? "#a5b4fc" : "#6366f1"
															}}
														/>
													</div>
												)}
											</div>
										</button>
									);
								})}
							</div>
						)}
					</div>

					{/* Modal Footer */}
					{filteredTeachers.length > 0 && (
						<div
							className="p-3 border-t text-xs text-center"
							style={{
								borderColor: darkMode ? "rgba(148, 163, 184, 0.25)" : "rgba(148, 163, 184, 0.25)",
								color: darkMode ? "#94a3b8" : "#64748b"
							}}
						>
							{filteredTeachers.length} {filteredTeachers.length === 1 ? "teacher" : "teachers"} found
							{teacherSearchTerm && ` matching "${teacherSearchTerm}"`}
						</div>
					)}
				</div>
			</div>
		)}
		</>
	);
}


