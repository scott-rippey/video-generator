import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
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

export const FullscreenClipScene: React.FC<Props> = ({
  scene,
  format,
  assetMap,
  brand,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const src = assetUrl(assetMap, scene.id);

  if (!src) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#000',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#fff',
          fontSize: 60,
        }}
      >
        Missing clip asset for scene {scene.id}
      </AbsoluteFill>
    );
  }

  // Overlay text reveal: fade + gentle slide from off-screen left
  const textFade = interpolate(frame, [6, 75], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const slideSpring = spring({
    frame: Math.max(frame - 6, 0),
    fps,
    config: { damping: 220, stiffness: 35, mass: 0.9 },
    durationInFrames: 70,
  });
  const slideOffset = interpolate(slideSpring, [0, 1], [-60, 0]);

  const displayFont =
    brand.fonts.display ?? brand.fonts.primary ?? 'Impact, sans-serif';

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
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
              fontSize: Math.round(format.width / 32),
              fontWeight: 800,
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
    </AbsoluteFill>
  );
};
