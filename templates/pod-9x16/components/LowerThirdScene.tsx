import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import type { Brand } from '../../../lib/config.ts';
import type { Scene } from '../../../lib/scenes.ts';
import { assetUrl, resolveColor } from './SceneRouter.tsx';

interface Props {
  scene: Extract<Scene, { type: 'lower-third' }>;
  brand: Brand;
  format: { width: number; height: number; fps: number };
  assetMap: Record<string, string>;
  slug: string;
}

export const LowerThirdScene: React.FC<Props> = ({ scene, brand, format, assetMap }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({
    frame: Math.max(frame - 8, 0),
    fps,
    config: { damping: 200, stiffness: 80 },
  });
  const fadeIn = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' });

  const bg = scene.background;
  const src = assetUrl(assetMap, scene.id);

  const bgIsVideo = bg.type === 'generated-clip' || bg.type === 'library-clip';

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity: fadeIn }}>
      {src ? (
        bgIsVideo ? (
          <OffthreadVideo src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
        ) : (
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )
      ) : null}

      <AbsoluteFill style={{ display: 'flex', alignItems: 'flex-end' }}>
        <div
          style={{
            transform: `translateX(${(slide - 1) * 100}%)`,
            margin: `0 0 ${Math.round(format.height / 12)}px ${Math.round(format.width / 20)}px`,
            padding: `${Math.round(format.height / 60)}px ${Math.round(format.width / 30)}px`,
            background: resolveColor('primary', brand) ?? '#0f172a',
            borderLeft: `${Math.round(format.width / 360)}px solid ${resolveColor('accent', brand) ?? '#3b82f6'}`,
            color: '#ffffff',
            fontFamily: brand.fonts.primary ?? 'Inter',
            boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          }}
        >
          <div
            style={{
              fontSize: Math.round(format.width / 42),
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
            }}
          >
            {scene.title}
          </div>
          {scene.subtitle ? (
            <div
              style={{
                marginTop: 8,
                fontSize: Math.round(format.width / 80),
                fontWeight: 500,
                opacity: 0.85,
              }}
            >
              {scene.subtitle}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
