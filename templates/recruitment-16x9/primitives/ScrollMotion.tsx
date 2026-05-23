import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

export type MotionKind =
  | 'scroll-down'
  | 'scroll-up'
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-right'
  | 'pan-left'
  | 'ken-burns'
  | 'push-in'
  | 'static'
  | 'keyframes';

export type EasingKind = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export interface MotionKeyframe {
  t: number; // 0-1 normalized scene time
  scale: number;
  x: number; // pan in percent of viewport
  y: number;
}

export interface ScrollMotionProps {
  kind: MotionKind;
  intensity?: number;
  easing?: EasingKind;
  durationSeconds: number;
  children: React.ReactNode;
  keyframes?: MotionKeyframe[];
}

const easingFns: Record<EasingKind, (n: number) => number> = {
  linear: Easing.linear,
  'ease-in': Easing.in(Easing.cubic),
  'ease-out': Easing.out(Easing.cubic),
  'ease-in-out': Easing.inOut(Easing.cubic),
};

/**
 * Wraps children in a transformed div whose transform interpolates over the scene.
 * Supports simple motion types (push-in, ken-burns, etc.) and multi-stage `keyframes`
 * motion for whip pans, zoom + reposition sequences, and Apple-style cinematic moves.
 */
export const ScrollMotion: React.FC<ScrollMotionProps> = ({
  kind,
  intensity = 0.5,
  easing = 'ease-in-out',
  durationSeconds,
  children,
  keyframes,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const totalFrames = Math.max(1, durationSeconds * fps);

  let transform = 'none';
  let origin = 'center';

  if (kind === 'keyframes' && keyframes && keyframes.length >= 2) {
    const tNorm = Math.max(0, Math.min(1, frame / totalFrames));

    // Find surrounding keyframes
    let prev = keyframes[0]!;
    let next = keyframes[keyframes.length - 1]!;
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (keyframes[i]!.t <= tNorm && tNorm <= keyframes[i + 1]!.t) {
        prev = keyframes[i]!;
        next = keyframes[i + 1]!;
        break;
      }
    }

    const segmentSpan = Math.max(0.0001, next.t - prev.t);
    const segmentT = (tNorm - prev.t) / segmentSpan;
    const eased = easingFns[easing](Math.max(0, Math.min(1, segmentT)));

    const scale = prev.scale + (next.scale - prev.scale) * eased;
    const px = prev.x + (next.x - prev.x) * eased;
    const py = prev.y + (next.y - prev.y) * eased;

    // Apply translate first, then scale (right-to-left in CSS transforms),
    // so translate values are in pre-scale element coords.
    transform = `scale(${scale}) translate(${px}%, ${py}%)`;
  } else {
    const t = interpolate(frame, [0, totalFrames], [0, 1], {
      extrapolateRight: 'clamp',
      extrapolateLeft: 'clamp',
      easing: easingFns[easing],
    });

    switch (kind) {
      case 'scroll-down': {
        const ty = interpolate(t, [0, 1], [0, -intensity * 40]);
        transform = `translateY(${ty}%)`;
        origin = 'top center';
        break;
      }
      case 'scroll-up': {
        const ty = interpolate(t, [0, 1], [-intensity * 40, 0]);
        transform = `translateY(${ty}%)`;
        origin = 'top center';
        break;
      }
      case 'zoom-in': {
        const s = interpolate(t, [0, 1], [1, 1 + intensity * 0.3]);
        transform = `scale(${s})`;
        break;
      }
      case 'zoom-out': {
        const s = interpolate(t, [0, 1], [1 + intensity * 0.3, 1]);
        transform = `scale(${s})`;
        break;
      }
      case 'push-in': {
        const s = interpolate(t, [0, 1], [1, 1 + intensity * 0.08]);
        transform = `scale(${s})`;
        break;
      }
      case 'pan-right': {
        const tx = interpolate(t, [0, 1], [0, -intensity * 15]);
        transform = `translateX(${tx}%)`;
        break;
      }
      case 'pan-left': {
        const tx = interpolate(t, [0, 1], [0, intensity * 15]);
        transform = `translateX(${tx}%)`;
        break;
      }
      case 'ken-burns': {
        const s = interpolate(t, [0, 1], [1, 1 + intensity * 0.12]);
        const tx = interpolate(t, [0, 1], [0, -intensity * 5]);
        const ty = interpolate(t, [0, 1], [0, intensity * 3]);
        transform = `scale(${s}) translate(${tx}%, ${ty}%)`;
        break;
      }
      case 'static':
      case 'keyframes':
      default:
        transform = 'none';
    }
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        transform,
        transformOrigin: origin,
        willChange: 'transform',
      }}
    >
      {children}
    </div>
  );
};
