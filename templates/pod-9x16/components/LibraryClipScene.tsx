import React from 'react';
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, interpolate } from 'remotion';
import type { Brand } from '../../../lib/config.ts';
import type { Scene } from '../../../lib/scenes.ts';
import { assetUrl } from './SceneRouter.tsx';

interface Props {
  scene: Extract<Scene, { type: 'library-clip' }>;
  brand: Brand;
  format: { width: number; height: number; fps: number };
  assetMap: Record<string, string>;
  slug: string;
}

const INK = '#0A0A0A';
const EMBER = '#FF4A0D';
const CHALK = '#F5F5F5';
const FOG = '#9A9A9A';

export const LibraryClipScene: React.FC<Props> = ({ scene, brand, format, assetMap }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' });
  const src = assetUrl(assetMap, scene.id);
  const eyebrow = scene.overlay_text ?? '';

  // Editorial 16:9-in-9:16 layout:
  //   top 14%: Ember eyebrow caps + thin Ember rule
  //   middle 56%: 16:9 clip with Ember hairline border, rounded corners
  //   bottom 30%: Ink void (caption space, currently empty)
  const clipBoxHeight = Math.round(format.height * 0.56);
  const clipBoxWidth = Math.round(format.width * 0.92);
  // 16:9 inside that box: respect aspect, letterbox vertical edges if needed
  const clipAspect = 16 / 9;
  const clipDisplayHeight = Math.min(clipBoxHeight, Math.round(clipBoxWidth / clipAspect));
  const clipDisplayWidth = Math.round(clipDisplayHeight * clipAspect);

  return (
    <AbsoluteFill style={{ backgroundColor: INK, opacity: fadeIn }}>
      {/* Eyebrow */}
      {eyebrow ? (
        <div
          style={{
            position: 'absolute',
            top: `${Math.round(format.height * 0.06)}px`,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              fontFamily: brand.fonts.primary ?? 'Inter',
              fontSize: Math.round(format.width / 30),
              fontWeight: 600,
              letterSpacing: '0.18em',
              color: EMBER,
              textTransform: 'uppercase',
            }}
          >
            {eyebrow}
          </div>
          <div style={{ width: Math.round(format.width * 0.18), height: 2, backgroundColor: EMBER }} />
        </div>
      ) : null}

      {/* Centered 16:9 clip */}
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: clipDisplayWidth,
            height: clipDisplayHeight,
            marginTop: Math.round(format.height * 0.04), // shift slightly above center
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            border: `1px solid ${EMBER}`,
            backgroundColor: INK,
          }}
        >
          {src ? (
            <OffthreadVideo
              src={src}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              muted
              startFrom={Math.round((scene.clip.start_offset ?? 0) * format.fps)}
            />
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
