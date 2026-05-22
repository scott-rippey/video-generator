import React from 'react';
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, interpolate, useVideoConfig } from 'remotion';
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
  const { durationInFrames } = useVideoConfig();
  const sceneFade = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' });

  const src = assetUrl(assetMap, scene.id);

  if (!src) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', color: '#fff', fontSize: 60 }}>
        Missing clip asset for scene {scene.id}
      </AbsoluteFill>
    );
  }

  const captionInFade = interpolate(frame, [4, 12], [0, 1], { extrapolateRight: 'clamp' });
  const captionOutFade = interpolate(
    frame,
    [Math.max(durationInFrames - 8, 0), durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const captionOpacity = Math.min(captionInFade, captionOutFade);

  const primaryFont = brand.fonts.primary ?? 'Inter';
  const captionColor = brand.colors.primary ?? '#FF4A0D';
  const scrimColor = 'rgba(10, 10, 10, 0.78)';

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
            justifyContent: 'center',
            paddingBottom: Math.round(format.height * 0.22),
            paddingLeft: Math.round(format.width * 0.06),
            paddingRight: Math.round(format.width * 0.06),
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              backgroundColor: scrimColor,
              color: captionColor,
              fontFamily: primaryFont,
              fontWeight: 700,
              fontSize: Math.round(format.width / 24),
              lineHeight: 1.18,
              letterSpacing: '-0.01em',
              textAlign: 'center',
              padding: `${Math.round(format.width / 80)}px ${Math.round(format.width / 36)}px`,
              borderRadius: Math.round(format.width / 180),
              maxWidth: '92%',
              opacity: captionOpacity,
              whiteSpace: 'pre-line',
              boxShadow: '0 12px 48px rgba(0,0,0,0.55)',
            }}
          >
            {scene.overlay_text}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
