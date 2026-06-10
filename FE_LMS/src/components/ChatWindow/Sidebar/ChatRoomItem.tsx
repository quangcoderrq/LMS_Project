// import type { Conversation } from "../../contexts/ConversationsContext";
// import { useAuthStore } from "../../stores/authStore";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChatRoomStore } from "../../../stores/chatRoomStore";
import type { ChatRoom } from "../../../context/ChatRoomContext";
import { useTheme } from "../../../hooks/useTheme";

const ChatRoomItem = ({
  chatRoomId,
  name,
  course,
  participants,
  unreadCounts,
  lastMessage,
}: ChatRoom) => {
  const [user, setUser] = useState(null);
  const { darkMode } = useTheme();
  const { selectedChatRoom, setSelectedChatRoom } = useChatRoomStore();
  const navigate = useNavigate();

  let displayTime = "";

  const isSelected = selectedChatRoom?.chatRoomId === chatRoomId;
  const pronounce =
    lastMessage?.senderId._id === (user as any)?._id
      ? "You"
      : lastMessage?.senderId?.username;

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("lms:user") || "{}");
    setUser(user);
  }, []);

  if (lastMessage?.timestamp) {
    const createdAt = new Date(lastMessage.timestamp);
    const now = new Date();

    const diffInMs = now.getTime() - createdAt.getTime();
    const diffInDays = diffInMs / (60 * 60 * 24 * 1000);

    const time = createdAt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const date = createdAt.toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    displayTime = diffInDays >= 1 ? `${date} ${time}` : time;
  }

  return (
    <div
      className="p-4 border-b flex items-center space-x-3 cursor-pointer transition-colors"
      style={{
        backgroundColor: isSelected
          ? darkMode
            ? "rgba(99, 102, 241, 0.2)"
            : "rgba(99, 102, 241, 0.1)"
          : darkMode
          ? "transparent"
          : "#f9fafb",
        borderColor: darkMode ? "rgba(71, 85, 105, 0.3)" : "rgba(229, 231, 235, 0.7)",
      }}
      onClick={() => {
        if (isSelected) {
          setSelectedChatRoom(null);
          // Update URL to remove the room ID
          navigate('/chat-rooms', { replace: true });
        } else {
          setSelectedChatRoom({
            chatRoomId,
            name,
            course,
            participants,
            lastMessage,
            unreadCounts,
          });
          // Update URL to reflect the selected room
          navigate(`/chat-rooms/${chatRoomId}`, { replace: true });
        }
      }}
    >
      <div className="relative">
        <img
          src={course?.logo || "https://shorturl.at/ARotg"}
          alt="User"
          className="object-cover rounded-full size-10"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h2 
            className="text-sm font-semibold truncate"
            style={{ color: darkMode ? "#e5e7eb" : "#1f2937" }}
          >
            {name}
          </h2>
          {lastMessage?.timestamp && (
            <span 
              className="text-xs"
              style={{ color: darkMode ? "#94a3b8" : "#6b7280" }}
            >
              {displayTime}
            </span>
          )}
        </div>

        <div className="flex items-center">
          <p
            className="text-sm truncate min-h-5"
            style={{
              color: unreadCounts[(user as any)?._id] > 0
                ? darkMode ? "#94a3b8" : "#6b7280"
                : darkMode ? "#a78bfa" : "#6366f1",
            }}
          >
            {lastMessage?.content
              ? lastMessage.isNotification
                ? lastMessage.content
                : `${pronounce}: ${lastMessage.content}`
              : "There is no message yet"}
          </p>
          {user && unreadCounts[(user as any)?._id] > 0 && (
            <div className="flex items-center justify-center ml-2 text-xs text-white rounded-full bg-indigo-600 size-5 shrink-0">
              {unreadCounts[(user as any)?._id]}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatRoomItem;
