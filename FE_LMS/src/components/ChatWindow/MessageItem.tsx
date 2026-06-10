import { useEffect, useState } from "react";
import type { Message } from "../../services/messageService";
import { useTheme } from "../../hooks/useTheme";
import MarkdownContent from "../markdown/MarkdownContent";
import DOMPurify from "dompurify";

type MessageItemProps = Message & {
  isFirstInBlock?: boolean;
  isLastInBlock?: boolean;
};

// Check if message contains a Google Maps iframe
const hasGoogleMapEmbed = (content: string): boolean => {
  return content.includes('<iframe') && content.includes('google.com/maps');
};

// Check if message is a location message (has map pin emoji and google maps link)
const isLocationMessage = (content: string): boolean => {
  return content.includes('📍') && content.includes('google.com/maps');
};

// Check if message contains a YouTube URL
const isYouTubeMessage = (content: string): boolean => {
  return /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)/.test(content);
};

// Extract YouTube video ID from various URL formats
const extractYouTubeId = (content: string): string | null => {
  // Match youtube.com/watch?v=VIDEO_ID
  let match = content.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];
  
  // Match youtube.com/embed/VIDEO_ID
  match = content.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];
  
  // Match youtube.com/shorts/VIDEO_ID
  match = content.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];
  
  // Match youtu.be/VIDEO_ID
  match = content.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];
  
  return null;
};

// Extract the original YouTube URL from content
const extractYouTubeUrl = (content: string): string | null => {
  const match = content.match(/(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[^\s<]+)/);
  return match ? match[1] : null;
};

// YouTube Embed Component
const YouTubeContent: React.FC<{ content: string }> = ({ content }) => {
  const videoId = extractYouTubeId(content);
  const originalUrl = extractYouTubeUrl(content);
  
  if (!videoId) return <p className="text-sm">{content}</p>;

  return (
    <div className="youtube-message">
      {originalUrl && (
        <a 
          href={originalUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm mb-2 hover:underline"
          style={{ color: 'inherit' }}
        >
          ▶️ YouTube Video
        </a>
      )}
      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          width="320"
          height="180"
          style={{ border: 0, display: 'block' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </div>
  );
};

// Check if message contains a Spotify URL
const isSpotifyMessage = (content: string): boolean => {
  return /open\.spotify\.com\/(playlist|track|album|artist|episode|show)\//.test(content);
};

// Extract Spotify content type and ID from URL
const extractSpotifyInfo = (content: string): { type: string; id: string } | null => {
  // Match open.spotify.com/{type}/{id}
  const match = content.match(/open\.spotify\.com\/(playlist|track|album|artist|episode|show)\/([a-zA-Z0-9]+)/);
  if (match) {
    return { type: match[1], id: match[2] };
  }
  return null;
};

// Extract the original Spotify URL from content
const extractSpotifyUrl = (content: string): string | null => {
  const match = content.match(/(https?:\/\/open\.spotify\.com\/(?:playlist|track|album|artist|episode|show)\/[^\s<]+)/);
  return match ? match[1] : null;
};

// Get Spotify content type emoji
const getSpotifyEmoji = (type: string): string => {
  switch (type) {
    case 'playlist': return '🎵';
    case 'track': return '🎧';
    case 'album': return '💿';
    case 'artist': return '🎤';
    case 'episode': return '🎙️';
    case 'show': return '📻';
    default: return '🎵';
  }
};

// Spotify Embed Component
const SpotifyContent: React.FC<{ content: string }> = ({ content }) => {
  const spotifyInfo = extractSpotifyInfo(content);
  const originalUrl = extractSpotifyUrl(content);
  
  if (!spotifyInfo) return <p className="text-sm">{content}</p>;

  // Determine height based on content type
  const height = spotifyInfo.type === 'track' ? 152 : 352;
  const emoji = getSpotifyEmoji(spotifyInfo.type);
  const typeLabel = spotifyInfo.type.charAt(0).toUpperCase() + spotifyInfo.type.slice(1);

  return (
    <div className="spotify-message">
      {originalUrl && (
        <a 
          href={originalUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm mb-2 hover:underline"
          style={{ color: 'inherit' }}
        >
          {emoji} Spotify {typeLabel}
        </a>
      )}
      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
        <iframe
          src={`https://open.spotify.com/embed/${spotifyInfo.type}/${spotifyInfo.id}?utm_source=generator`}
          width="100%"
          height={height}
          style={{ border: 0, display: 'block', borderRadius: 12 }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </div>
  );
};

// Extract iframe src from location message - handle both quoted styles
const extractMapSrc = (content: string): string | null => {
  // Try double quotes first
  let match = content.match(/src="([^"]*google\.com\/maps\/embed[^"]*)"/);
  if (match) return match[1];
  
  // Try single quotes
  match = content.match(/src='([^']*google\.com\/maps\/embed[^']*)'/);
  if (match) return match[1];
  
  // Try without quotes (in case of encoding issues)
  match = content.match(/src=([^\s>]*google\.com\/maps\/embed[^\s>]*)/);
  if (match) return match[1];
  
  return null;
};

// Extract location link from message
const extractLocationLink = (content: string): string | null => {
  // Match markdown link format [text](url)
  const match = content.match(/\[([^\]]*)\]\((https?:\/\/[^\s)]+google\.com\/maps[^\s)]*)\)/);
  if (match) return match[2];
  
  // Match plain URL
  const plainMatch = content.match(/(https?:\/\/[^\s<]+google\.com\/maps[^\s<]*)/);
  if (plainMatch) return plainMatch[1];
  
  return null;
};

// Location Message Component - renders the map directly
const LocationContent: React.FC<{ content: string }> = ({ content }) => {
  const mapSrc = extractMapSrc(content);
  const locationLink = extractLocationLink(content);
  
  // Debug: log what we're extracting
  console.log('Location content:', content);
  console.log('Extracted mapSrc:', mapSrc);
  console.log('Extracted locationLink:', locationLink);

  // If we can't extract the map src, try to build it from the location link
  let finalMapSrc = mapSrc;
  if (!finalMapSrc && locationLink) {
    // Extract coordinates from the location link
    const coordMatch = locationLink.match(/[?&]q=([0-9.-]+),([0-9.-]+)/);
    if (coordMatch) {
      const lat = coordMatch[1];
      const lng = coordMatch[2];
      finalMapSrc = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1000!2d${lng}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zM!5e0!3m2!1sen!2s!4v1700000000000`;
    }
  }

  return (
    <div className="location-message">
      {locationLink && (
        <a 
          href={locationLink} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm mb-2 hover:underline"
          style={{ color: 'inherit' }}
        >
          📍 My Location
        </a>
      )}
      {finalMapSrc ? (
        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <iframe
            src={finalMapSrc}
            width="300"
            height="200"
            style={{ border: 0, display: 'block' }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      ) : (
        // Fallback: show link if we can't render the map
        locationLink && (
          <div className="text-xs text-slate-500 mt-1">
            (Map preview unavailable - click link to view)
          </div>
        )
      )}
    </div>
  );
};

// Check if content has HTML formatting tags (but NOT iframe for maps)
const hasHtmlFormatting = (content: string): boolean => {
  // Don't treat iframe-only content as HTML formatting - let it go to markdown renderer
  if (hasGoogleMapEmbed(content)) return false;
  return /<(b|strong|i|em|u|s|strike|code|pre|blockquote|ul|ol|li|a|br|div|p)[^>]*>/i.test(content);
};

// Check if content has markdown syntax
const hasMarkdownSyntax = (content: string): boolean => {
  return content.includes('**') || 
    content.includes('```') || 
    content.includes('##') ||
    content.includes('> ') ||
    content.includes('- ') ||
    content.includes('_') ||
    content.includes('~~') ||
    (content.includes('[') && content.includes(']('));
};

// Render formatted content (HTML or Markdown)
const FormattedContent: React.FC<{ content: string; darkMode: boolean; isOwnMessage?: boolean }> = ({ 
  content, 
  darkMode,
  isOwnMessage = false 
}) => {
  // Debug
  console.log('FormattedContent called with:', content.substring(0, 100));
  console.log('isLocationMessage:', isLocationMessage(content));
  console.log('hasGoogleMapEmbed:', hasGoogleMapEmbed(content));
  console.log('isYouTubeMessage:', isYouTubeMessage(content));
  console.log('isSpotifyMessage:', isSpotifyMessage(content));

  // Check if it's a location message with map - render directly
  if (isLocationMessage(content) || hasGoogleMapEmbed(content)) {
    console.log('Rendering LocationContent');
    return <LocationContent content={content} />;
  }

  // Check if it's a YouTube message - render embedded video
  if (isYouTubeMessage(content)) {
    console.log('Rendering YouTubeContent');
    return <YouTubeContent content={content} />;
  }

  // Check if it's a Spotify message - render embedded player
  if (isSpotifyMessage(content)) {
    console.log('Rendering SpotifyContent');
    return <SpotifyContent content={content} />;
  }

  // Check if it's HTML formatted content
  if (hasHtmlFormatting(content)) {
    // Sanitize HTML to prevent XSS but allow formatting tags
    const sanitizedHtml = DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'br', 'div', 'p', 'span'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
    });

    // Add styles for formatted content
    const preBgColor = 'rgb(39, 40, 34)';
    const formattedStyles = `
      .formatted-message b, .formatted-message strong { font-weight: 700; }
      .formatted-message i, .formatted-message em { font-style: italic; }
      .formatted-message u { text-decoration: underline; }
      .formatted-message s, .formatted-message strike { text-decoration: line-through; }
      .formatted-message code { 
        background: ${isOwnMessage ? 'rgba(255,255,255,0.2)' : (darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)')}; 
        padding: 2px 6px; 
        border-radius: 4px; 
        font-family: monospace;
        font-size: 0.875em;
      }
      .formatted-message pre {
        background: ${preBgColor};
        padding: 12px;
        border-radius: 8px;
        overflow-x: auto;
        max-width: 100%;
        white-space: pre;
        font-family: monospace;
        font-size: 0.875em;
        color: #e2e8f0;
      }
      .formatted-message pre * {
        background: ${preBgColor};
      }
      .formatted-message pre code {
        background: ${preBgColor};
        padding: 0;
        display: block;
        min-width: fit-content;
      }
      .formatted-message blockquote { 
        border-left: 3px solid ${isOwnMessage ? 'rgba(255,255,255,0.5)' : (darkMode ? '#6366f1' : '#4f46e5')}; 
        padding-left: 12px; 
        margin: 8px 0;
        opacity: 0.9;
      }
      .formatted-message ul, .formatted-message ol { 
        padding-left: 20px; 
        margin: 4px 0;
      }
      .formatted-message li { margin: 2px 0; }
      .formatted-message a { 
        color: ${isOwnMessage ? '#c7d2fe' : (darkMode ? '#818cf8' : '#4f46e5')}; 
        text-decoration: underline; 
      }
      .formatted-message a:hover { opacity: 0.8; }
    `;

    return (
      <>
        <style>{formattedStyles}</style>
        <div 
          className={`formatted-message text-sm whitespace-pre-wrap ${isOwnMessage ? 'text-white' : ''}`}
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      </>
    );
  }

  // Check if it needs markdown rendering (code blocks, bold, etc.)
  if (hasMarkdownSyntax(content)) {
    return (
      <div className={`prose prose-sm max-w-none ${isOwnMessage ? 'prose-invert [&_a]:text-indigo-200' : 'dark:prose-invert [&_a]:text-indigo-600 dark:[&_a]:text-indigo-400'} [&_a]:underline`}>
        <MarkdownContent content={content} />
      </div>
    );
  }

  // Plain text
  return <p className="text-sm whitespace-pre-wrap">{content}</p>;
};

const MessageItem: React.FC<MessageItemProps> = ({
  _id,
  senderId,
  content,
  file,
  isLink,
  isNotification,
  createdAt,
  isFirstInBlock = true,
  isLastInBlock = true,
}) => {
  const [user, setUser] = useState(null);
  const { darkMode } = useTheme();
  const userIsSender = senderId._id === (user as any)?._id;

  const created = new Date(createdAt);
  const now = new Date();

  const diffInMs = now.getTime() - created.getTime();
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

  const time = created.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const date = created.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const displayTime = diffInDays > 1 ? `${date} ${time}` : time;

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("lms:user") || "{}");

    setUser(user);
  }, []);

  if (isNotification) {
    console.log("ISNOTIFICATION", isNotification);

    return (
      <div className="flex items-center justify-center gap-2 my-4">
        <div 
          className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-full"
          style={{
            backgroundColor: darkMode ? "rgba(99, 102, 241, 0.15)" : "rgba(219, 234, 254, 1)",
            borderColor: darkMode ? "rgba(99, 102, 241, 0.3)" : "rgba(147, 197, 253, 1)",
            color: darkMode ? "#a5b4fc" : "#1e40af",
            border: "1px solid",
          }}
        >
          <span className="text-sm"></span>
          <p>{content}</p>
        </div>
      </div>
    );
  }

  // Check if content needs special rendering
  const isLocation = isLocationMessage(content);
  const hasMap = hasGoogleMapEmbed(content);
  const hasYouTube = isYouTubeMessage(content);
  const hasSpotify = isSpotifyMessage(content);
  const hasHtml = hasHtmlFormatting(content);
  const hasMarkdown = hasMarkdownSyntax(content);
  
  // Debug log
  if (content.includes('google.com/maps') || content.includes('📍') || content.includes('youtube') || content.includes('youtu.be') || content.includes('spotify')) {
    console.log('=== Message Detection ===');
    console.log('Content:', content.substring(0, 200));
    console.log('isLocation:', isLocation);
    console.log('hasMap:', hasMap);
    console.log('hasYouTube:', hasYouTube);
    console.log('hasSpotify:', hasSpotify);
    console.log('hasHtml:', hasHtml);
    console.log('hasMarkdown:', hasMarkdown);
    console.log('isLink:', isLink);
    console.log('userIsSender:', userIsSender);
  }
  
  const needsFormattedRender = isLocation || hasMap || hasYouTube || hasSpotify || hasHtml || hasMarkdown;

  // For location/youtube/spotify messages, always use FormattedContent regardless of isLink
  const shouldRenderFormatted = needsFormattedRender || isLocation || hasMap || hasYouTube || hasSpotify;

  if (userIsSender) {
    return (
      <div
        className="flex flex-col items-end mb-1"
        style={{
          marginTop: isFirstInBlock ? "1rem" : "0.15rem",
          marginBottom: isLastInBlock ? "0.9rem" : "0.15rem",
        }}
      >
        {isFirstInBlock && (
          <span className="text-xs text-gray-400 mb-1 mr-1">
            {senderId.username}
          </span>
        )}
        <div className={`p-3 text-sm text-white bg-indigo-600 rounded-2xl rounded-br-sm ${isLocation || hasYouTube || hasSpotify ? 'max-w-sm' : 'max-w-xs lg:max-w-md'}`}>
          {/* Location/YouTube/Spotify messages get special treatment - render embed */}
          {isLocation || hasMap || hasYouTube || hasSpotify ? (
            <FormattedContent content={content} darkMode={darkMode} isOwnMessage={true} />
          ) : isLink ? (
            <a href={content} className="text-sm underline" target="_blank">
              {content}
            </a>
          ) : needsFormattedRender ? (
            <FormattedContent content={content} darkMode={darkMode} isOwnMessage={true} />
          ) : (
            <p className="text-sm">{content}</p>
          )}
          <span className="flex items-center gap-1 mt-1 text-[11px] text-indigo-100">
            {displayTime}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex gap-2"
      style={{
        marginTop: isFirstInBlock ? "1rem" : "0.15rem",
        marginBottom: isLastInBlock ? "0.9rem" : "0.15rem",
      }}
    >
      {/* Avatar - always show on first block, spacer for subsequent */}
      {isFirstInBlock ? (
        <img
          src={senderId.avatar_url || "https://shorturl.at/0Xbnm"}
          alt={senderId.username}
          className="object-cover rounded-full size-8 flex-shrink-0"
        />
      ) : (
        <div className="size-8 flex-shrink-0" />
      )}
      
      {/* Username and message content stacked vertically */}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {/* Username - only show on first block */}
        {isFirstInBlock && (
          <span className="text-xs text-gray-400">
            {senderId.username}
          </span>
        )}
        
        {/* Message bubble */}
        <div 
          className={`p-3 text-sm rounded-2xl rounded-bl-sm border w-fit ${isLocation || hasYouTube || hasSpotify ? 'max-w-sm' : 'max-w-xs lg:max-w-md'}`}
          style={{
            backgroundColor: darkMode ? "rgba(51, 65, 85, 0.6)" : "#f3f4f6",
            borderColor: darkMode ? "rgba(71, 85, 105, 0.4)" : "rgba(229, 231, 235, 0.8)",
            color: darkMode ? "#e5e7eb" : "#1f2937",
          }}
        >
          {/* Location/YouTube/Spotify messages get special treatment - render embed */}
          {isLocation || hasMap || hasYouTube || hasSpotify ? (
            <FormattedContent content={content} darkMode={darkMode} isOwnMessage={false} />
          ) : isLink ? (
            <a href={content} className="text-sm underline" target="_blank">
              {content}
            </a>
          ) : needsFormattedRender ? (
            <FormattedContent content={content} darkMode={darkMode} isOwnMessage={false} />
          ) : (
            <p className="text-sm">{content}</p>
          )}
          <span 
            className="flex items-center gap-1 mt-1 text-xs"
            style={{
              color: darkMode ? "#94a3b8" : "#6b7280",
            }}
          >
            {displayTime}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MessageItem;
