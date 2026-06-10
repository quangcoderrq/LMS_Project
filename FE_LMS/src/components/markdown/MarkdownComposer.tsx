import React, { useRef } from "react";
import { Paperclip } from "lucide-react";
import MarkdownContent from "./MarkdownContent";

interface MarkdownComposerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  darkMode?: boolean;
  attachment?: File | null;
  onAttachmentChange?: (file: File | null) => void;
  attachmentAccept?: string;
  disabled?: boolean;
}

type ToolbarAction =
  | "bold"
  | "italic"
  | "code"
  | "quote"
  | "bullet"
  | "numbered"
  | "codeblock"
  | "heading";

const MarkdownComposer: React.FC<MarkdownComposerProps> = ({
  value,
  onChange,
  placeholder,
  darkMode,
  attachment,
  onAttachmentChange,
  attachmentAccept,
  disabled = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const applyWrap = (prefix: string, suffix = prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd } = textarea;
    const selected = value.slice(selectionStart, selectionEnd);
    const nextValue = `${value.slice(0, selectionStart)}${prefix}${selected}${suffix}${value.slice(selectionEnd)}`;
    onChange(nextValue);
    requestAnimationFrame(() => {
      const caretPosition = selectionEnd + prefix.length + suffix.length;
      textarea.setSelectionRange(caretPosition, caretPosition);
      textarea.focus();
    });
  };

  const applyLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd } = textarea;
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const selected = value.slice(selectionStart, selectionEnd) || "text";
    const lines = selected.split("\n").map((line) => (line.trim().length ? `${prefix} ${line}` : prefix));
    const formatted = lines.join("\n");
    const nextValue = `${before}${formatted}${after}`;
    onChange(nextValue);
    requestAnimationFrame(() => {
      const caretPosition = selectionStart + formatted.length;
      textarea.setSelectionRange(caretPosition, caretPosition);
      textarea.focus();
    });
  };

  const handleToolbarClick = (action: ToolbarAction) => {
    if (disabled) return;
    switch (action) {
      case "bold":
        applyWrap("**");
        break;
      case "italic":
        applyWrap("_");
        break;
      case "code":
        applyWrap("`");
        break;
      case "quote":
        applyLinePrefix(">");
        break;
      case "bullet":
        applyLinePrefix("-");
        break;
      case "numbered":
        applyLinePrefix("1.");
        break;
      case "codeblock":
        applyWrap("\n```\n", "\n```\n");
        break;
      case "heading":
        applyLinePrefix("##");
        break;
      default:
        break;
    }
  };

  const toolbarButtons: { action: ToolbarAction; label: string }[] = [
    { action: "bold", label: "B" },
    { action: "italic", label: "I" },
    { action: "heading", label: "H2" },
    { action: "quote", label: "“" },
    { action: "bullet", label: "•" },
    { action: "numbered", label: "1." },
    { action: "code", label: "</>" },
    { action: "codeblock", label: "{ }" },
  ];

  const formatFileSize = (size?: number) => {
    if (!size || Number.isNaN(size)) return "";
    const units = ["B", "KB", "MB", "GB"];
    const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
    const value = size / 1024 ** exponent;
    const formatted = exponent === 0 || value >= 10 ? value.toFixed(0) : value.toFixed(1);
    return `${formatted} ${units[exponent]}`;
  };

  const editorClasses = `w-full rounded-2xl border px-4 py-3 resize-y min-h-[160px] focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
    darkMode ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
  }`;

  const triggerAttachmentPicker = () => {
    if (!onAttachmentChange) return;
    fileInputRef.current?.click();
  };

  const handleAttachmentInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!onAttachmentChange) return;
    const file = event.target.files?.[0] ?? null;
    onAttachmentChange(file);
    event.target.value = "";
  };

  return (
    <div className={`rounded-2xl border ${darkMode ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 text-xs font-semibold dark:border-slate-800">
        {toolbarButtons.map((button) => (
          <button
            key={button.action}
            type="button"
            onClick={() => handleToolbarClick(button.action)}
            disabled={disabled}
            className={`rounded-xl px-2.5 py-1 transition ${
              darkMode
                ? "bg-slate-800 text-slate-100 hover:bg-slate-700"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            } ${disabled ? "opacity-50 cursor-not-allowed hover:bg-inherit" : ""}`}
          >
            {button.label}
          </button>
        ))}
        {onAttachmentChange && (
          <>
            <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
            <button
              type="button"
              onClick={triggerAttachmentPicker}
              disabled={disabled}
              className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 ${
                disabled ? "opacity-50 cursor-not-allowed hover:bg-inherit dark:hover:bg-inherit" : ""
              }`}
            >
              <Paperclip className="w-3.5 h-3.5" />
              Add attachment
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={attachmentAccept}
              onChange={handleAttachmentInput}
            />
          </>
        )}
      </div>

      <textarea
        ref={textareaRef}
        className={editorClasses}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />

      <div className={`border-t px-4 py-4 space-y-3 ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
        {attachment && onAttachmentChange && (
          <div
            className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${
              darkMode ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"
            }`}
          >
            <span className="truncate pr-2">
              {attachment.name} • {formatFileSize(attachment.size)}
            </span>
            <button
              type="button"
              onClick={() => onAttachmentChange(null)}
              className="text-rose-500 font-semibold hover:text-rose-400"
            >
              Remove
            </button>
          </div>
        )}
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">Live preview</p>
          <div className="text-sm prose max-w-none dark:prose-invert">
            {value ? (
              <MarkdownContent content={value} />
            ) : (
              <p className="text-slate-400">Start typing above. Styling, lists, code blocks, and images render instantly.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownComposer;

