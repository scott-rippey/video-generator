import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

export interface TypingTextProps {
  text: string;
  startFrame?: number;
  charsPerSec?: number;
  cursor?: boolean;
  cursorColor?: string;
  cursorBlinksPerSec?: number;
  style?: React.CSSProperties;
  // Render a subtle natural pause every N characters (rough human cadence)
  jitterEveryNChars?: number;
  jitterPauseFrames?: number;
}

/**
 * Animates the typing of `text` one character at a time at `charsPerSec`.
 *
 * Uses an integer frame budget (not a smooth interpolation) so each character
 * lands on a distinct frame. Adds small periodic pauses to feel less robotic.
 */
export const TypingText: React.FC<TypingTextProps> = ({
  text,
  startFrame = 0,
  charsPerSec = 28,
  cursor = true,
  cursorColor,
  cursorBlinksPerSec = 1.6,
  style,
  jitterEveryNChars = 18,
  jitterPauseFrames = 4,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - startFrame;

  if (localFrame < 0) {
    return <span style={style} />;
  }

  // Each character takes (fps / charsPerSec) frames; periodic pauses add extra frames.
  const framesPerChar = fps / charsPerSec;
  // Number of completed natural pauses fully consumed BEFORE the current local frame.
  // We solve for charIdx by stepping forward; for length up to ~600 this is fine.
  let elapsedFrames = 0;
  let charIdx = 0;
  while (charIdx < text.length) {
    if (elapsedFrames >= localFrame) break;
    elapsedFrames += framesPerChar;
    charIdx += 1;
    if (jitterEveryNChars > 0 && charIdx % jitterEveryNChars === 0) {
      elapsedFrames += jitterPauseFrames;
    }
  }

  const shown = text.slice(0, Math.min(charIdx, text.length));
  const finished = shown.length === text.length;

  const blinkProgress = (localFrame / fps) * cursorBlinksPerSec;
  const cursorVisible = !finished || blinkProgress % 1 < 0.55;

  return (
    <span style={style}>
      {shown}
      {cursor ? (
        <span
          style={{
            display: 'inline-block',
            width: '0.06em',
            marginLeft: '0.04em',
            backgroundColor: cursorColor ?? 'currentColor',
            height: '1em',
            verticalAlign: 'text-bottom',
            opacity: cursorVisible ? 1 : 0,
          }}
        >
          &nbsp;
        </span>
      ) : null}
    </span>
  );
};
