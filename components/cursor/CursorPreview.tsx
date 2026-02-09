"use client";

import React from "react";
import Image from "next/image";

interface CursorPreviewProps {
  cursorStyle: "normal" | "hand";
  isClick?: boolean;
  size?: "sm" | "md" | "lg";
}

// Normal cursor SVG (Mac style)
const NormalCursorSVG = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M8.5 2.5L8.5 22.5L13.5 17.5L18.5 25.5L22.5 23.5L17.5 15.5L24.5 14.5L8.5 2.5Z"
      fill="white"
      stroke="black"
      strokeWidth="1.5"
    />
  </svg>
);

// Click animation ring
const ClickRing = () => (
  <div
    style={{
      position: "absolute",
      left: "50%",
      top: "50%",
      width: 40,
      height: 40,
      marginLeft: -20,
      marginTop: -20,
      borderRadius: "50%",
      border: "3px solid rgba(255, 107, 157, 0.9)",
      backgroundColor: "transparent",
      transform: "scale(1.5)",
      opacity: 0.8,
      pointerEvents: "none",
      boxShadow: "0 0 10px rgba(255, 107, 157, 0.9)",
    }}
  />
);

export const CursorPreview: React.FC<CursorPreviewProps> = ({
  cursorStyle,
  isClick = false,
  size = "md",
}) => {
  const getCursorComponent = () => {
    switch (cursorStyle) {
      case "normal":
        return <NormalCursorSVG />;
      case "hand":
        return (
          <Image 
            src="/handcursor.svg" 
            alt="Hand cursor" 
            width={96} 
            height={96}
            style={{ 
              filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.25))",
              width: "64px",
              height: "64px"
            }}
          />
        );
      default:
        return <NormalCursorSVG />;
    }
  };

  const sizeScale = {
    sm: 0.5,
    md: 0.75,
    lg: 1,
  };

  const scale = sizeScale[size];

  return (
    <div
      style={{
        position: "relative",
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        display: "inline-block",
      }}
    >
      <div
        style={{
          filter: cursorStyle === "normal" ? "drop-shadow(0 3px 6px rgba(0,0,0,0.25))" : "none",
        }}
      >
        {getCursorComponent()}
      </div>
      {isClick && <ClickRing />}
    </div>
  );
};

// Cursor style info for display
export const cursorStyleInfo: Record<
  string,
  { label: string; description: string; emoji: string }
> = {
  "normal": { label: "Normal", description: "Default arrow", emoji: "🖱️" },
  "hand": { label: "Hand", description: "Pointing hand", emoji: "👆" },
};

export default CursorPreview;
