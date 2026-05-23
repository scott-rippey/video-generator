import React from 'react';
import { useCurrentFrame, useVideoConfig, Easing } from 'remotion';

export interface HighlightPulseProps {
  kind?: 'pulse-glow' | 'underline' | 'box-outline' | 'circle-glow';
  // Bounding box in parent's local coordinate system (or screenshot-native if scaling
  // info is provided).
  x: number;
  y: number;
  width: number;
  height: number;
  atSeconds: number;
  durationSeconds: number;
  color?: string;
  // For circle-glow: how long the stroke takes to draw itself in (0 = instant pop-in).
  drawInSeconds?: number;
  // For circle-glow: pulse after draw-in completes.
  pulseAfter?: boolean;
  // For circle-glow: corner radius. 999 = pill. Smaller to match a UI card's corners.
  borderRadius?: number;
  // For circle-glow: padding in natural-image pixels around the target. If undefined, uses auto.
  padding?: number;
  // optional scaling from screenshot-native coords -> rendered coords
  imageNaturalWidth?: number;
  imageNaturalHeight?: number;
  renderedWidth?: number;
  renderedHeight?: number;
}

function roundedRectPerimeter(w: number, h: number, r: number): number {
  const cr = Math.min(r, w / 2, h / 2);
  return 2 * (w - 2 * cr) + 2 * (h - 2 * cr) + 2 * Math.PI * cr;
}

export const HighlightPulse: React.FC<HighlightPulseProps> = ({
  kind = 'pulse-glow',
  x,
  y,
  width,
  height,
  atSeconds,
  durationSeconds,
  color = '#22d3a4',
  drawInSeconds = 0.6,
  pulseAfter = true,
  borderRadius = 999,
  padding,
  imageNaturalWidth,
  imageNaturalHeight,
  renderedWidth,
  renderedHeight,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = frame / fps - atSeconds;

  if (elapsed < 0 || elapsed > durationSeconds) return null;

  // Optional coord-space scaling
  let rx = x;
  let ry = y;
  let rw = width;
  let rh = height;
  let scaleForPadding = 1;
  if (
    imageNaturalWidth &&
    imageNaturalHeight &&
    renderedWidth &&
    renderedHeight
  ) {
    const sx = renderedWidth / imageNaturalWidth;
    const sy = renderedHeight / imageNaturalHeight;
    rx = x * sx;
    ry = y * sy;
    rw = width * sx;
    rh = height * sy;
    scaleForPadding = sx;
  }

  if (kind === 'circle-glow') {
    // Padding between the target rect and the ring container.
    // If `padding` (natural px) is provided in the highlight config, use it; else use auto.
    const pad =
      padding !== undefined
        ? padding * scaleForPadding
        : Math.max(8, Math.min(rw, rh) * 0.06);
    const ringW = rw + pad * 2;
    const ringH = rh + pad * 2;
    const r = Math.min(borderRadius, ringW / 2, ringH / 2);

    const strokeWidth = Math.max(4, Math.min(ringW, ringH) * 0.012);
    const perimeter = roundedRectPerimeter(ringW, ringH, r);

    // Draw-in animation
    const drawProgress = drawInSeconds <= 0
      ? 1
      : Math.min(1, elapsed / drawInSeconds);
    const easedDraw = Easing.inOut(Easing.cubic)(drawProgress);
    const dashOffset = perimeter * (1 - easedDraw);

    // After draw-in: pulsing glow intensity (sine wave)
    const postDraw = Math.max(0, elapsed - drawInSeconds);
    const pulseOmega = 2 * Math.PI * 1.1; // ~1.1 Hz pulse
    const pulseBase = pulseAfter && drawProgress >= 1
      ? 0.5 + 0.5 * Math.sin(postDraw * pulseOmega - Math.PI / 2)
      : 0;

    // Overall fade out near the end of the highlight window
    const fadeOutStart = durationSeconds - 0.4;
    const opacity =
      elapsed > fadeOutStart
        ? Math.max(0, 1 - (elapsed - fadeOutStart) / 0.4)
        : 1;

    const glowBase = 14;
    const glowExtra = pulseBase * 22;
    const fillExtra = pulseBase * 0.05;

    // SVG viewBox = ringW x ringH; positioned absolutely over the target with padding
    return (
      <div
        style={{
          position: 'absolute',
          left: rx - pad,
          top: ry - pad,
          width: ringW,
          height: ringH,
          pointerEvents: 'none',
          opacity,
        }}
      >
        {/* Soft glow layer behind the stroke */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: r,
            boxShadow: `0 0 ${glowBase + glowExtra}px ${color}, 0 0 ${(glowBase + glowExtra) * 2}px ${color}66`,
            backgroundColor: `${color}${Math.round(fillExtra * 255)
              .toString(16)
              .padStart(2, '0')}`,
            opacity: easedDraw,
          }}
        />
        <svg
          width={ringW}
          height={ringH}
          viewBox={`0 0 ${ringW} ${ringH}`}
          style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        >
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={ringW - strokeWidth}
            height={ringH - strokeWidth}
            rx={Math.max(0, r - strokeWidth / 2)}
            ry={Math.max(0, r - strokeWidth / 2)}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth + pulseBase * 1.5}
            strokeLinecap="round"
            strokeDasharray={perimeter}
            strokeDashoffset={dashOffset}
            style={{
              filter: `drop-shadow(0 0 ${6 + glowExtra * 0.5}px ${color})`,
            }}
          />
        </svg>
      </div>
    );
  }

  // Legacy kinds (pulse-glow, underline, box-outline)
  const t = Math.max(0, Math.min(1, elapsed / durationSeconds));
  const envelope = Math.sin(t * Math.PI);
  const ripple = 0.6 + 0.4 * Math.sin(t * Math.PI * 4);
  const opacity = envelope * ripple * 0.95;

  if (kind === 'underline') {
    return (
      <div
        style={{
          position: 'absolute',
          left: rx,
          top: ry + rh - 6,
          width: rw,
          height: 6,
          backgroundColor: color,
          opacity,
          borderRadius: 3,
          pointerEvents: 'none',
        }}
      />
    );
  }

  if (kind === 'box-outline') {
    return (
      <div
        style={{
          position: 'absolute',
          left: rx - 4,
          top: ry - 4,
          width: rw + 8,
          height: rh + 8,
          border: `4px solid ${color}`,
          borderRadius: 8,
          opacity,
          pointerEvents: 'none',
        }}
      />
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: rx,
        top: ry,
        width: rw,
        height: rh,
        boxShadow: `0 0 ${24 + 40 * opacity}px ${12 + 24 * opacity}px ${color}`,
        backgroundColor: `${color}33`,
        borderRadius: 8,
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
};
