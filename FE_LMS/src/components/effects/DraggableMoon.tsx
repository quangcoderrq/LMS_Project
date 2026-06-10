import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Position {
  x: number;
  y: number;
}

interface DragOffset {
  x: number;
  y: number;
}

interface MoonPositionData {
  position: Position;
  lightPosition: number[];
}

interface MoonSettings {
  lightStrength: number;
}

interface DraggableMoonProps {
  onPositionChange?: (data: MoonPositionData) => void;
  onSettingsChange?: (settings: MoonSettings) => void;
  initialPosition?: Position;
  containerWidth?: number;
  containerHeight?: number;
  moonSize?: number;
  initialLightStrength?: number;
}

const DraggableMoon: React.FC<DraggableMoonProps> = ({ 
  onPositionChange, 
  onSettingsChange,
  initialPosition = { x: 100, y: 100 },
  containerWidth = 450,
  containerHeight = 450,
  moonSize = 40,
  initialLightStrength = 15
}) => {
  const [position, setPosition] = useState<Position>(initialPosition);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<DragOffset>({ x: 0, y: 0 });
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [lightStrength, setLightStrength] = useState<number>(initialLightStrength);
  const moonRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Handle right-click for settings menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowSettings(true);
  };

  // Handle mouse/touch down
  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Don't start dragging on right-click
    if ('button' in e && e.button === 2) return;
    
    setIsDragging(true);
    
    if (!moonRef.current) return;
    const rect = moonRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const clientX = e.type.includes('touch') ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = e.type.includes('touch') ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    
    setDragOffset({
      x: clientX - centerX,
      y: clientY - centerY
    });
    
    e.preventDefault();
  };

  // Handle mouse/touch move
  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    
    const clientX = e.type.includes('touch') ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = e.type.includes('touch') ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
    
    if (!moonRef.current?.parentElement) return;
    const containerRect = moonRef.current.parentElement.getBoundingClientRect();
    const newX = clientX - containerRect.left - dragOffset.x;
    const newY = clientY - containerRect.top - dragOffset.y;
    
    // Constrain to container bounds
    const constrainedX = Math.max(0, Math.min(newX, containerWidth - moonSize));
    const constrainedY = Math.max(0, Math.min(newY, containerHeight - moonSize));
    
    const newPosition = { x: constrainedX, y: constrainedY };
    setPosition(newPosition);
    
    // Convert position to normalized coordinates (0-1) for 3D light positioning
    const normalizedX = constrainedX / (containerWidth - moonSize);
    const normalizedY = constrainedY / (containerHeight - moonSize);
    
    // Convert to 3D coordinates (assuming light moves in a hemisphere above the model)
    const lightX = (normalizedX - 0.5) * 8; // -4 to 4 range
    const lightY = 3 + (1 - normalizedY) * 2; // 3 to 5 range (height)
    const lightZ = (normalizedY - 0.5) * 8; // -4 to 4 range
    
    onPositionChange?.({
      position: newPosition,
      lightPosition: [lightX, lightY, lightZ]
    });
    
    e.preventDefault();
  }, [isDragging, dragOffset, containerWidth, containerHeight, moonSize, onPositionChange]);

  // Handle light strength change
  const handleLightStrengthChange = (newStrength: number) => {
    setLightStrength(newStrength);
    onSettingsChange?.({ lightStrength: newStrength });
  };

  // Close settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node) && 
          moonRef.current && !moonRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSettings]);

  // Handle mouse/touch up
  const handleEnd = useCallback((e: MouseEvent | TouchEvent) => {
    setIsDragging(false);
    e.preventDefault();
  }, []);

  // Add event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragOffset, handleMove, handleEnd]);

  // Create moon SVG as data URL
  const moonSvg = `
    <svg width="${moonSize}" height="${moonSize}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="moonGradient" cx="30%" cy="30%">
          <stop offset="0%" style="stop-color:#f8f8ff;stop-opacity:1" />
          <stop offset="70%" style="stop-color:#e6e6fa;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#d3d3d3;stop-opacity:1" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <circle cx="50" cy="50" r="45" fill="url(#moonGradient)" filter="url(#glow)" />
      <circle cx="35" cy="35" r="8" fill="#c0c0c0" opacity="0.6" />
      <circle cx="25" cy="25" r="5" fill="#a0a0a0" opacity="0.4" />
      <circle cx="60" cy="30" r="6" fill="#b0b0b0" opacity="0.5" />
      <circle cx="70" cy="60" r="4" fill="#a0a0a0" opacity="0.3" />
    </svg>
  `;

  const moonDataUrl = `data:image/svg+xml;base64,${btoa(moonSvg)}`;

  return (
    <>
      <div
        ref={moonRef}
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          width: moonSize,
          height: moonSize,
          cursor: isDragging ? 'grabbing' : 'grab',
          zIndex: 10,
          userSelect: 'none',
          touchAction: 'none',
          transition: isDragging ? 'none' : 'all 0.2s ease-out',
          filter: isDragging ? 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.8))' : 'drop-shadow(0 0 5px rgba(255, 255, 255, 0.5))',
        }}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
        onContextMenu={handleContextMenu}
      >
      <img
        src={moonDataUrl}
        alt="Moon"
        style={{
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
        draggable={false}
      />
      
        {/* Tooltip */}
        <div
          style={{
            position: 'absolute',
            bottom: '-30px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            opacity: isDragging ? 1 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: 'none',
          }}
        >
          Drag to control lighting • Right-click for settings
        </div>
      </div>

      {/* Moon Settings Panel */}
      {showSettings && (
        <div
          ref={settingsRef}
          style={{
            position: 'absolute',
            left: Math.min(position.x + moonSize + 10, containerWidth - 200),
            top: Math.max(position.y - 50, 10),
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
            zIndex: 20,
            minWidth: '180px',
            backdropFilter: 'blur(10px)',
          }}
        >
          <h3 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '14px', 
            fontWeight: 'bold',
            color: '#f8f8ff'
          }}>
            🌙 Moon Settings
          </h3>
          
          <div style={{ marginBottom: '12px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '12px', 
              marginBottom: '6px',
              color: '#e6e6fa'
            }}>
              Light Strength: {lightStrength.toFixed(1)}
            </label>
            <input
              type="range"
              min="0.1"
              max="100.0"
              step="0.1"
              value={lightStrength}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleLightStrengthChange(parseFloat(e.target.value))}
              style={{
                width: '100%',
                height: '6px',
                background: 'linear-gradient(to right, #1a1a2e, #16213e, #0f3460)',
                outline: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            />
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: '10px', 
              color: '#a0a0a0',
              marginTop: '4px'
            }}>
              <span>Dim</span>
              <span>Bright</span>
            </div>
          </div>

          <div style={{ 
            fontSize: '11px', 
            color: '#b0b0b0',
            lineHeight: '1.4'
          }}>
            💡 Drag moon to change light direction
            <br />
            🎛️ Adjust strength with slider
          </div>
        </div>
      )}
    </>
  );
};

export default DraggableMoon;