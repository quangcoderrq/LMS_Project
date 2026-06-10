import React from "react";
import { File as FileIcon, FileArchive, FileSpreadsheet, FileText } from "lucide-react";

interface AttachmentPreviewProps {
  files?: string[];
  onImageClick?: (payload: { src: string; alt?: string }) => void;
  size?: "xs" | "sm" | "md";
  className?: string;
  caption?: string;
}

const sizeToClasses: Record<
  NonNullable<AttachmentPreviewProps["size"]>,
  { container: string; image: string; docWidth: string }
> = {
  xs: { container: "w-24 h-24", image: "h-24", docWidth: "min-w-[8.5rem]" },
  sm: { container: "w-28 h-28", image: "h-28", docWidth: "min-w-[10rem]" },
  md: { container: "w-36 h-32", image: "h-32", docWidth: "min-w-[12rem]" },
};

const imageExtensions = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg"]);
const spreadsheetExtensions = new Set(["xls", "xlsx", "csv"]);
const archiveExtensions = new Set(["zip", "rar", "7z", "tar", "gz"]);

const getFileExtension = (fileUrl: string): string => {
  const sanitized = fileUrl.split(/[?#]/)[0];
  const lastSegment = sanitized.split("/").pop() || "";
  const hasExtension = lastSegment.includes(".");
  return hasExtension ? lastSegment.split(".").pop()?.toLowerCase() || "" : "";
};

const getFileName = (fileUrl: string, fallback: string): string => {
  const sanitized = fileUrl.split(/[?#]/)[0];
  const segments = sanitized.split("/");
  const rawName = segments[segments.length - 1] || "";
  if (!rawName) return fallback;
  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
};

const getFileIcon = (extension: string) => {
  if (spreadsheetExtensions.has(extension)) return FileSpreadsheet;
  if (archiveExtensions.has(extension)) return FileArchive;
  return FileText;
};

const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  files,
  onImageClick,
  size = "md",
  className = "",
  caption,
}) => {
  if (!files || files.length === 0) return null;
  const sizing = sizeToClasses[size];

  const handleImageClick = (src: string) => {
    if (onImageClick) {
      onImageClick({ src, alt: caption });
      return;
    }
    window.open(src, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={`mt-3 flex gap-3 overflow-x-auto pb-1 ${className}`}>
      {files.map((fileUrl, index) => {
        const extension = getFileExtension(fileUrl);
        const isImage = Boolean(extension) && imageExtensions.has(extension);
        if (isImage) {
          return (
        <button
          type="button"
          key={`${fileUrl}-${index}`}
              onClick={() => handleImageClick(fileUrl)}
          className={`shrink-0 rounded-2xl border border-slate-200 bg-white/30 p-1 transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/60 ${sizing.container}`}
          aria-label={`View attachment ${index + 1}`}
        >
              <div className="h-full w-full overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-900/50">
            <img
              src={fileUrl}
              alt={caption || `Attachment ${index + 1}`}
              loading="lazy"
              className={`w-full rounded-2xl object-cover ${sizing.image}`}
            />
          </div>
        </button>
          );
        }

        const displayName = getFileName(fileUrl, `Attachment ${index + 1}`);
        const Icon = extension ? getFileIcon(extension) : FileIcon;

        return (
          <a
            key={`${fileUrl}-${index}`}
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`shrink-0 ${sizing.docWidth} rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/60`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-100">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{displayName}</p>
                <p className="text-[11px] uppercase text-slate-400">{extension || "FILE"}</p>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
};

export default AttachmentPreview;


