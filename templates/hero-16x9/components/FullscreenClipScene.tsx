import React from 'react';
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import type { Brand } from '../../../lib/config.ts';
import type { Scene } from '../../../lib/scenes.ts';
import { assetUrl } from './SceneRouter.tsx';

interface Props {
  scene: Extract<Scene, { type: 'fullscreen-clip' }>;
  brand: Brand;
  format: { width: number; height: number; fps: number };
  assetMap: Record<string, string>;
  slug: string;
}

export const FullscreenClipScene: React.FC<Props> = ({ scene, format, assetMap, brand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneFade = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' });

  const src = assetUrl(assetMap, scene.id);

  if (!src) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', color: '#fff', fontSize: 60 }}>
        Missing clip asset for scene {scene.id}
      </AbsoluteFill>
    );
  }

  // Text overlay (top-right): slow fade-in (~2.3s) + gentle slide from off-screen left
  const textFade = interpolate(frame, [6, 75], [0, 1], { extrapolateRight: 'clamp' });
  const slideSpring = spring({
    frame: Math.max(frame - 6, 0),
    fps,
    config: { damping: 220, stiffness: 35, mass: 0.9 },
    durationInFrames: 70,
  });
  const slideOffset = interpolate(slideSpring, [0, 1], [-60, 0]);

  const displayFont = brand.fonts.display ?? brand.fonts.primary ?? 'Impact, sans-serif';
  const accent = brand.colors.accent ?? '#4ec1ff';

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity: sceneFade }}>
      <OffthreadVideo
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        muted
      />
      {scene.overlay_text ? (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            padding: `${Math.round(format.width / 24)}px`,
          }}
        >
          <div
            style={{
              fontSize: Math.round(format.width / 24),
              fontWeight: 900,
              color: brand.colors.text ?? '#ffffff',
              textShadow: '0 6px 36px rgba(0,0,0,0.9)',
              fontFamily: displayFont,
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              opacity: textFade,
              transform: `translateX(${slideOffset}px)`,
              lineHeight: 0.95,
            }}
          >
            {scene.overlay_text}
          </div>
        </AbsoluteFill>
      ) : null}
      {scene.hud_visual === 'ai-core' ? (
        <AiBrainHud frame={frame} fps={fps} format={format} accent={accent} />
      ) : null}
    </AbsoluteFill>
  );
};

// Stylized AI brain HUD: cyan brain silhouette with neurons firing and
// pulses traveling along synaptic connections. No text. Says "AI is thinking."
const BRAIN_NODES: Array<{ x: number; y: number }> = [
  // Left hemisphere
  { x: -32, y: -18 }, // 0
  { x: -14, y: -8 },  // 1
  { x: -44, y: -2 },  // 2
  { x: -24, y: 8 },   // 3
  { x: -40, y: 22 },  // 4
  { x: -10, y: 24 },  // 5
  // Right hemisphere
  { x: 32, y: -18 },  // 6
  { x: 14, y: -8 },   // 7
  { x: 44, y: -2 },   // 8
  { x: 24, y: 8 },    // 9
  { x: 40, y: 22 },   // 10
  { x: 10, y: 24 },   // 11
];

const BRAIN_EDGES: Array<[number, number]> = [
  // Left hemisphere internal
  [0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [2, 4], [3, 4], [3, 5], [4, 5],
  // Right hemisphere internal
  [6, 7], [6, 8], [7, 8], [7, 9], [8, 9], [8, 10], [9, 10], [9, 11], [10, 11],
  // Cross-hemisphere (corpus callosum)
  [1, 7], [3, 9], [5, 11],
];

const AiBrainHud: React.FC<{
  frame: number;
  fps: number;
  format: { width: number; height: number; fps: number };
  accent: string;
}> = ({ frame, fps, format, accent }) => {
  const t = frame / fps;

  // Entry animation
  const hudFade = interpolate(frame, [0, 22], [0, 1], { extrapolateRight: 'clamp' });
  const entrySpring = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 60 },
    durationInFrames: 36,
  });
  const entryScale = interpolate(entrySpring, [0, 1], [0.9, 1]);

  // Whole-brain "breath" pulse, ~0.4 Hz
  const breath = 1 + 0.025 * Math.sin(t * Math.PI * 2 * 0.4);

  // Five synaptic pulses, each cycling through random edges with phase offset
  const NUM_PULSES = 5;
  const PULSE_SPEED = 0.65; // edges traversed per second
  const pulses = Array.from({ length: NUM_PULSES }, (_, i) => {
    const phase = i * 1.31; // offset (prime-ish) so they don't sync
    const totalProgress = t * PULSE_SPEED + phase;
    const edgeIndex = Math.floor(totalProgress) % BRAIN_EDGES.length;
    const edgeT = totalProgress - Math.floor(totalProgress);
    const [a, b] = BRAIN_EDGES[edgeIndex]!;
    const nA = BRAIN_NODES[a]!;
    const nB = BRAIN_NODES[b]!;
    return {
      x: nA.x + (nB.x - nA.x) * edgeT,
      y: nA.y + (nB.y - nA.y) * edgeT,
      // Fade in then out across the edge journey for a "traveling spark" feel
      opacity: Math.sin(edgeT * Math.PI),
    };
  });

  // Per-node "firing" intensity, each node fires asynchronously
  const nodeIntensity = (i: number): number => {
    const phase = ((t * 0.9 + i * 0.21) % 1);
    if (phase < 0.08) return 1.0 - phase / 0.08 * 0.4; // brief flash
    return 0.55;
  };

  const size = Math.round(format.width / 3.8); // ~1010px at 4K

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: hudFade,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          position: 'relative',
          transform: `scale(${entryScale * breath})`,
          filter: `drop-shadow(0 0 28px ${accent}88) drop-shadow(0 0 60px ${accent}55)`,
        }}
      >
        <svg
          viewBox="-70 -55 140 110"
          width="100%"
          height="100%"
          style={{ overflow: 'visible' }}
        >
          {/* Brain outer silhouette: two hemispheres + center dip for fissure */}
          <path
            d="
              M -52 -8
              C -56 -32, -34 -48, -14 -42
              C -10 -46, -4 -46, 0 -42
              C 4 -46, 10 -46, 14 -42
              C 34 -48, 56 -32, 52 -8
              C 56 14, 44 34, 22 38
              C 12 41, 4 38, 0 34
              C -4 38, -12 41, -22 38
              C -44 34, -56 14, -52 -8
              Z
            "
            fill="none"
            stroke={accent}
            strokeWidth="1.6"
            opacity="0.85"
          />

          {/* Central fissure */}
          <path
            d="M 0 -42 Q 3 -10, 0 34"
            fill="none"
            stroke={accent}
            strokeWidth="1.1"
            opacity="0.5"
          />

          {/* Suggested cortical folds, left hemisphere */}
          <g stroke={accent} strokeWidth="0.9" fill="none" opacity="0.35" strokeLinecap="round">
            <path d="M -42 -26 Q -28 -22, -30 -12" />
            <path d="M -48 -4 Q -32 -2, -36 10" />
            <path d="M -42 18 Q -28 16, -22 26" />
          </g>
          {/* Suggested cortical folds, right hemisphere */}
          <g stroke={accent} strokeWidth="0.9" fill="none" opacity="0.35" strokeLinecap="round">
            <path d="M 42 -26 Q 28 -22, 30 -12" />
            <path d="M 48 -4 Q 32 -2, 36 10" />
            <path d="M 42 18 Q 28 16, 22 26" />
          </g>

          {/* Synaptic connections between neurons */}
          {BRAIN_EDGES.map(([a, b], i) => {
            const nA = BRAIN_NODES[a]!;
            const nB = BRAIN_NODES[b]!;
            return (
              <line
                key={i}
                x1={nA.x}
                y1={nA.y}
                x2={nB.x}
                y2={nB.y}
                stroke={accent}
                strokeWidth="0.7"
                opacity="0.45"
                strokeLinecap="round"
              />
            );
          })}

          {/* Neurons */}
          {BRAIN_NODES.map((n, i) => {
            const intensity = nodeIntensity(i);
            return (
              <g key={i}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={3.6}
                  fill={accent}
                  opacity={intensity * 0.35}
                />
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={1.8}
                  fill={accent}
                  opacity={intensity}
                  style={{ filter: `drop-shadow(0 0 3px ${accent})` }}
                />
              </g>
            );
          })}

          {/* Traveling synaptic pulses */}
          {pulses.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r="2.4"
                fill="#ffffff"
                opacity={p.opacity}
                style={{ filter: `drop-shadow(0 0 5px ${accent}) drop-shadow(0 0 10px ${accent})` }}
              />
            </g>
          ))}
        </svg>
      </div>
    </AbsoluteFill>
  );
};
