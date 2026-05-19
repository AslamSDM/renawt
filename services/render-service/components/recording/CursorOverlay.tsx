/**
 * Cursor Overlay Component for Remotion
 * Renders an animated cursor on top of recorded videos
 */

import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";

interface CursorOverlayProps {
  x: number;
  y: number;
  isClick: boolean;
  style: "normal" | "hand";
}

// ============================================================================
// CURSOR SVG COMPONENTS (64px size)
// ============================================================================

// Mac cursor SVG
const MacCursorSVG = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ transform: "translate(0, 0)" }}
  >
    <path
      d="M8.5 2.5L8.5 22.5L13.5 17.5L18.5 25.5L22.5 23.5L17.5 15.5L24.5 14.5L8.5 2.5Z"
      fill="white"
      stroke="black"
      strokeWidth="1.5"
    />
  </svg>
);

// Windows cursor SVG
const WindowsCursorSVG = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5.5 3.5L5.5 26.5L11.5 20.5L16.5 28.5L20.5 26.5L15.5 18.5L24.5 17.5L5.5 3.5Z"
      fill="white"
      stroke="black"
      strokeWidth="1.5"
    />
  </svg>
);

// Hand Pointing - Cartoon/emoji style pointing finger
const HandPointingSVG = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Hand base */}
    <path
      d="M18 48C18 48 15 52 12 50C9 48 10 44 12 42L22 32C24 30 24 26 22 24L20 22C18 20 18 16 20 14C22 12 26 12 28 14L32 18C34 20 38 20 40 18L46 12C48 10 52 10 54 12C56 14 56 18 54 20L48 26C46 28 46 32 48 34L52 38C54 40 54 44 52 46C50 48 46 48 44 46L38 40"
      fill="#FFD93D"
      stroke="#E6B800"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Finger pointing */}
    <path
      d="M28 24L32 20C34 18 38 18 40 20C42 22 42 26 40 28L32 36"
      fill="#FF6B9D"
      stroke="#E6005C"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Index finger tip */}
    <ellipse cx="42" cy="18" rx="8" ry="6" fill="#FF6B9D" stroke="#E6005C" strokeWidth="2" />
    {/* Nail */}
    <ellipse cx="44" cy="17" rx="3" ry="2" fill="#FFE4EC" />
    {/* Shadow */}
    <ellipse cx="32" cy="58" rx="20" ry="4" fill="rgba(0,0,0,0.15)" />
  </svg>
);

// Hand Pressing - Hand with index finger pressing down
const HandPressingSVG = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Hand base */}
    <path
      d="M20 52C20 52 16 56 14 54C11 52 12 48 14 46L28 32C30 30 30 26 28 24L26 22C24 20 24 16 26 14C28 12 32 12 34 14L38 18"
      fill="#FFD93D"
      stroke="#E6B800"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Index finger pointing down */}
    <path
      d="M34 18L38 14C40 12 44 12 46 14C48 16 48 20 46 22L38 32L38 48"
      fill="#FF6B9D"
      stroke="#E6005C"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Finger tip pressing */}
    <ellipse cx="38" cy="52" rx="6" ry="4" fill="#E6005C" />
    <ellipse cx="38" cy="50" rx="4" ry="3" fill="#FF6B9D" />
    {/* Ripple effect indication */}
    <ellipse cx="38" cy="56" rx="12" ry="4" fill="none" stroke="#FF6B9D" strokeWidth="2" strokeDasharray="4 2" opacity="0.6" />
    {/* Shadow */}
    <ellipse cx="32" cy="60" rx="18" ry="3" fill="rgba(0,0,0,0.15)" />
  </svg>
);

// Touch Hand - iOS-style touch indicator with circle
const TouchHandSVG = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Touch circle glow */}
    <circle cx="32" cy="32" r="28" fill="rgba(59, 130, 246, 0.1)" stroke="rgba(59, 130, 246, 0.3)" strokeWidth="1" />
    <circle cx="32" cy="32" r="22" fill="rgba(59, 130, 246, 0.15)" stroke="rgba(59, 130, 246, 0.4)" strokeWidth="1.5" />
    {/* Hand */}
    <path
      d="M24 44C24 44 20 48 18 46C15 44 16 40 18 38L30 26C32 24 32 20 30 18"
      fill="#FFD93D"
      stroke="#E6B800"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Index finger */}
    <path
      d="M30 18L32 16C34 14 38 14 40 16C42 18 42 22 40 24L38 26L38 40"
      fill="#FF6B9D"
      stroke="#E6005C"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Touch point */}
    <circle cx="38" cy="44" r="6" fill="rgba(59, 130, 246, 0.5)" stroke="#3B82F6" strokeWidth="2" />
    <circle cx="38" cy="44" r="3" fill="white" />
  </svg>
);

// Finger Tap - Single finger with tap ring
const FingerTapSVG = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Tap rings */}
    <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255, 107, 157, 0.3)" strokeWidth="1" strokeDasharray="6 3" />
    <circle cx="32" cy="32" r="20" fill="none" stroke="rgba(255, 107, 157, 0.5)" strokeWidth="1.5" />
    {/* Finger */}
    <path
      d="M26 48C26 48 22 52 20 50C17 48 18 44 20 42L30 32C32 30 32 26 30 24"
      fill="#FFD93D"
      stroke="#E6B800"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Index finger pointing */}
    <path
      d="M30 24L34 20C36 18 40 18 42 20C44 22 44 26 42 28L38 32L38 46"
      fill="#FF6B9D"
      stroke="#E6005C"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Tap highlight */}
    <circle cx="38" cy="50" r="8" fill="rgba(255, 107, 157, 0.2)" />
    <circle cx="38" cy="50" r="4" fill="#FF6B9D" />
    {/* Shine effect */}
    <ellipse cx="40" cy="22" rx="2" ry="3" fill="white" opacity="0.6" />
  </svg>
);

// Hand Cursor - Clean minimal hand pointer
const HandCursorSVG = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Minimal hand outline */}
    <path
      d="M20 48L12 40C10 38 10 34 12 32C14 30 18 30 20 32L26 38L26 20C26 16 28 14 32 14C36 14 38 16 38 20L38 34L44 28C46 26 50 26 52 28C54 30 54 34 52 36L40 48C38 50 34 50 32 48"
      fill="white"
      stroke="black"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Index finger highlight */}
    <path
      d="M32 14L32 36"
      stroke="rgba(0,0,0,0.1)"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Drop shadow */}
    <path
      d="M22 50L14 42"
      stroke="rgba(0,0,0,0.2)"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

// ============================================================================
// CLICK ANIMATION COMPONENTS
// ============================================================================

// Multi-ripple rings on click
const MultiRippleRings: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <>
      {/* Ring 1 - Inner, fastest */}
      <RippleRing
        frame={frame}
        fps={fps}
        delay={0}
        maxScale={1.5}
        duration={15}
        color="rgba(255, 255, 255, 0.9)"
        strokeWidth={3}
      />
      {/* Ring 2 - Middle */}
      <RippleRing
        frame={frame}
        fps={fps}
        delay={3}
        maxScale={2.2}
        duration={20}
        color="rgba(255, 107, 157, 0.7)"
        strokeWidth={2.5}
      />
      {/* Ring 3 - Outer, slowest */}
      <RippleRing
        frame={frame}
        fps={fps}
        delay={6}
        maxScale={3}
        duration={25}
        color="rgba(59, 130, 246, 0.5)"
        strokeWidth={2}
      />
    </>
  );
};

// Individual ripple ring
const RippleRing: React.FC<{
  frame: number;
  fps: number;
  delay: number;
  maxScale: number;
  duration: number;
  color: string;
  strokeWidth: number;
}> = ({ frame, fps, delay, maxScale, duration, color, strokeWidth }) => {
  const adjustedFrame = Math.max(0, frame - delay);
  
  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  const opacity = Math.max(0, 1 - adjustedFrame / duration);

  return (
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
        border: `${strokeWidth}px solid ${color}`,
        backgroundColor: "transparent",
        transform: `scale(${1 + scale * (maxScale - 1)})`,
        opacity,
        pointerEvents: "none",
        boxShadow: `0 0 ${10 * opacity}px ${color}`,
      }}
    />
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const CursorOverlay: React.FC<CursorOverlayProps> = ({
  x,
  y,
  isClick,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Click pulse animation
  const clickScale = isClick
    ? spring({
        frame,
        fps,
        config: { damping: 8, stiffness: 200 },
      })
    : 1;

  // Get cursor component based on style
  const getCursorComponent = () => {
    switch (style) {
      case "normal":
        return <MacCursorSVG />;
      case "hand":
        return <HandPointingSVG />;
      default:
        return <MacCursorSVG />;
    }
  };

  // Calculate offset for larger cursors (64px vs 32px)
  const isLargeCursor = style === "hand";
  const cursorSize = isLargeCursor ? 64 : 32;
  const offsetX = isLargeCursor ? -10 : -2;
  const offsetY = isLargeCursor ? -10 : -2;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(${offsetX}px, ${offsetY}px) scale(${clickScale})`,
        pointerEvents: "none",
        zIndex: 100,
        filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.25))",
      }}
    >
      {getCursorComponent()}
      {isClick && <MultiRippleRings />}
    </div>
  );
};

export default CursorOverlay;
