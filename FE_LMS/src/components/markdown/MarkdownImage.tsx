import React, { useState } from "react";
import { X } from "lucide-react";

interface MarkdownImageProps {
  src?: string;
  alt?: string;
  title?: string;
  darkMode?: boolean;
  maxWidth?: string;
  maxHeight?: string;
}

const MarkdownImage: React.FC<MarkdownImageProps> = ({
  src,
  alt,
  title,
  darkMode = false,
  maxWidth = "100%",
  maxHeight = "400px",
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!src) {
    return null;
  }

  const handleImageClick = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleCloseModal();
    }
  };

  return (
    <>
      <img
        src={src}
        alt={alt || title || "Image"}
        title={title}
        onClick={handleImageClick}
        className="cursor-pointer rounded-lg border transition-all duration-200 hover:opacity-90 hover:shadow-lg"
        style={{
          maxWidth,
          maxHeight,
          width: "auto",
          height: "auto",
          objectFit: "contain",
          borderColor: darkMode ? "rgba(75, 85, 99, 0.3)" : "#e5e7eb",
        }}
      />

      {/* Modal for full-size image */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(4px)",
          }}
          onClick={handleBackdropClick}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center">
            {/* Close button */}
            <button
              onClick={handleCloseModal}
              className="absolute -top-12 right-0 z-10 p-2 rounded-full transition-all duration-200 hover:bg-white/20"
              style={{
                color: "#ffffff",
              }}
              aria-label="Close image"
            >
              <X size={24} />
            </button>

            {/* Full-size image */}
            <img
              src={src}
              alt={alt || title || "Image"}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              style={{
                border: `1px solid ${darkMode ? "rgba(75, 85, 99, 0.5)" : "rgba(255, 255, 255, 0.2)"}`,
              }}
            />

            {/* Image caption */}
            {(alt || title) && (
              <div
                className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg text-sm text-center max-w-md"
                style={{
                  backgroundColor: darkMode ? "rgba(15, 23, 42, 0.9)" : "rgba(255, 255, 255, 0.9)",
                  color: darkMode ? "#e5e7eb" : "#1f2937",
                }}
              >
                {alt || title}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default MarkdownImage;

