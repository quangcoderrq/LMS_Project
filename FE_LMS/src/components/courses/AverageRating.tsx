import { useEffect, useState } from "react";
import { useTheme } from "../../hooks/useTheme";
import { feedbackService } from "../../services/feedbackService";
import type { Feedback } from "../../types/feedback";

export default function AverageRating() {
  const { darkMode } = useTheme();
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAverageRating = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all system feedbacks - start with page 1
        let allFeedbacks: Feedback[] = [];
        let currentPage = 1;
        let hasMore = true;
        const limit = 100; // Reasonable page size

        // Fetch all pages of feedbacks
        while (hasMore) {
          const response = await feedbackService.getFeedbacks({
            type: "system",
            limit,
            page: currentPage,
          });

          const feedbacks: Feedback[] = response.feedbacks || [];
          allFeedbacks = [...allFeedbacks, ...feedbacks];

          // Check if there are more pages
          if (response.pagination) {
            hasMore = response.pagination.hasNextPage && feedbacks.length === limit;
            currentPage++;
          } else {
            // If no pagination info, stop after first page
            hasMore = false;
          }
        }

        if (allFeedbacks.length === 0) {
          setAverageRating(null);
          setLoading(false);
          return;
        }

        // Calculate average rating from all feedbacks
        const totalRating = allFeedbacks.reduce((sum, fb) => sum + (fb.rating || 0), 0);
        const avg = totalRating / allFeedbacks.length;
        setAverageRating(Number(avg.toFixed(1)));
      } catch (err) {
        console.error("Error fetching average rating:", err);
        setError("Unable to load average rating");
      } finally {
        setLoading(false);
      }
    };

    void fetchAverageRating();
  }, []);

  return (
    <div
      className="rounded-2xl shadow-lg p-6 transition-all duration-300"
      style={{
        backgroundColor: darkMode ? "rgba(15, 23, 42, 0.95)" : "#ffffff",
        border: darkMode
          ? "1px solid rgba(148, 163, 184, 0.1)"
          : "1px solid rgba(148, 163, 184, 0.1)",
        boxShadow: darkMode
          ? "0 12px 35px rgba(0, 0, 0, 0.3)"
          : "0 12px 35px rgba(15, 23, 42, 0.08)",
      }}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-4">
          <div
            className="text-sm mb-2"
            style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
          >
            AVERAGE RATING
          </div>
          <div
            className="text-3xl font-bold"
            style={{ color: darkMode ? "#e5e7eb" : "#1f2937" }}
          >
            ...
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-4">
          <div
            className="text-sm mb-2"
            style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
          >
            AVERAGE RATING
          </div>
          <div
            className="text-sm"
            style={{ color: darkMode ? "#ef4444" : "#dc2626" }}
          >
            {error}
          </div>
        </div>
      ) : averageRating === null ? (
        <div className="flex flex-col items-center justify-center py-4">
          <div
            className="text-sm mb-2"
            style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
          >
            AVERAGE RATING
          </div>
          <div
            className="text-3xl font-bold"
            style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
          >
            N/A
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          <div
            className="text-sm font-medium mb-3 uppercase tracking-wide"
            style={{ color: darkMode ? "#9ca3af" : "#6b7280" }}
          >
            AVERAGE RATING
          </div>
          <div
            className="text-4xl font-bold"
            style={{ color: darkMode ? "#e5e7eb" : "#1f2937" }}
          >
            {averageRating}/5
          </div>
        </div>
      )}
    </div>
  );
}

