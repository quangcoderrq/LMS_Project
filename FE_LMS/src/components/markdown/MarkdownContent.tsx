import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import type { Components } from "react-markdown";
import type { ImgHTMLAttributes, IframeHTMLAttributes } from "react";
import { useTheme } from "../../hooks/useTheme";

interface MarkdownContentProps {
  content: string;
  className?: string;
  onImageClick?: (payload: { src: string; alt?: string }) => void;
}

interface MarkdownImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  isClickable: boolean;
  onPreview?: () => void;
}

// Google Maps iframe component
const GoogleMapEmbed: React.FC<IframeHTMLAttributes<HTMLIFrameElement>> = (props) => {
  const { src, width = "300", height = "200", ...rest } = props;
  
  // Only render if it's a Google Maps embed
  if (!src?.includes("google.com/maps")) {
    return null;
  }

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 inline-block">
      <iframe
        src={src}
        width={width}
        height={height}
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        {...rest}
      />
    </div>
  );
};

// Code block component with horizontal scroll
const CodeBlock: React.FC<{ 
  inline?: boolean; 
  className?: string; 
  children?: React.ReactNode;
  darkMode?: boolean;
}> = ({ inline, className, children, darkMode }) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  
  if (inline) {
    return (
      <code 
        className="px-1.5 py-0.5 rounded text-sm font-mono"
        style={{
          backgroundColor: darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)',
        }}
      >
        {children}
      </code>
    );
  }

  const bgColor = 'rgb(39, 40, 34)';

  return (
    <div className="my-2 rounded-lg overflow-hidden" style={{ backgroundColor: bgColor }}>
      {language && (
        <div 
          className="px-3 py-1 text-xs font-medium border-b"
          style={{
            backgroundColor: darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)',
            borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.1)',
            color: '#94a3b8',
          }}
        >
          {language}
        </div>
      )}
      <div className="overflow-x-auto" style={{ backgroundColor: bgColor }}>
        <pre 
          className="p-3 text-sm"
          style={{
            margin: 0,
            whiteSpace: 'pre',
            wordBreak: 'normal',
            overflowWrap: 'normal',
            backgroundColor: bgColor,
            minWidth: 'fit-content',
          }}
        >
          <code 
            className={`font-mono ${className || ''}`}
            style={{ 
              color: '#e2e8f0',
              display: 'block',
              backgroundColor: bgColor,
            }}
          >
            {children}
          </code>
        </pre>
      </div>
    </div>
  );
};

const MarkdownImage: React.FC<MarkdownImageProps> = ({ isClickable, onPreview, className = "", onLoad, onError, style, ...props }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleLoad: ImgHTMLAttributes<HTMLImageElement>["onLoad"] = (event) => {
    setLoaded(true);
    onLoad?.(event);
  };

  const handleError: ImgHTMLAttributes<HTMLImageElement>["onError"] = (event) => {
    setFailed(true);
    onError?.(event);
  };

  const mergedClassName = [
    "max-h-64 w-auto rounded-2xl border border-slate-200 object-contain transition duration-200",
    isClickable ? "cursor-zoom-in hover:shadow-xl" : "",
    loaded ? "opacity-100" : "opacity-0",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const mergedStyle: React.CSSProperties = {
    maxWidth: "100%",
    ...(style || {}),
  };

  return (
    <figure className="my-4 flex flex-col items-center gap-2 w-full">
      <div className="relative w-full flex justify">
        {!loaded && !failed && (
          <div className="w-full max-w-3xl">
            <div className="h-48 w-full rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          </div>
        )}
        {!failed && (
          <img
            {...props}
            onClick={isClickable ? onPreview : undefined}
            className={mergedClassName}
            style={mergedStyle}
            onLoad={handleLoad}
            onError={handleError}
          />
        )}
      </div>
      {failed && <figcaption className="text-xs text-rose-500">Không thể tải ảnh</figcaption>}
      {!failed && (props.alt || isClickable) && (
        <div className="text-xs flex w-full justify-start text-slate-500">
          {props.alt || "Image"}
          {isClickable ? " • Click to enlarge" : ""}
        </div>
      )}
    </figure>
  );
};

const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, className = "", onImageClick }) => {
  const { darkMode } = useTheme();
  
  const components = useMemo<Components>(() => {
    return {
      img({ node, ...props }) {
        const { src = "", alt = "" } = props;
        const isClickable = Boolean(onImageClick && src);
        const handleClick = () => {
          if (isClickable && onImageClick && src) {
            onImageClick({ src, alt });
          }
        };

        return <MarkdownImage {...props} alt={alt} src={src} isClickable={isClickable} onPreview={handleClick} />;
      },
      iframe({ node, ...props }) {
        return <GoogleMapEmbed {...props} />;
      },
      code({ node, inline, className, children, ...props }: any) {
        return (
          <CodeBlock inline={inline} className={className} darkMode={darkMode}>
            {children}
          </CodeBlock>
        );
      },
      pre({ node, children, ...props }) {
        // Just pass through - let code handle the styling
        return <>{children}</>;
      },
    };
  }, [onImageClick, darkMode]);

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownContent;

