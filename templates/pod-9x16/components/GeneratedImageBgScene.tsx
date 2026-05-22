import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, interpolate } from 'remotion';
import type { Brand } from '../../../lib/config.ts';
import type { Scene } from '../../../lib/scenes.ts';
import { assetUrl } from './SceneRouter.tsx';

interface Props {
  scene: Extract<Scene, { type: 'generated-image-bg' }>;
  brand: Brand;
  format: { width: number; height: number; fps: number };
  assetMap: Record<string, string>;
  slug: string;
}

export const GeneratedImageBgScene: React.FC<Props> = ({ scene, brand, format, assetMap }) => {
  const frame = useCurrentFrame();
  const kenBurns = interpolate(frame, [0, scene.duration * format.fps], [1, 1.08], {
    extrapolateRight: 'clamp',
  });
  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const src = assetUrl(assetMap, scene.id);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity: fadeIn }}>
      {src ? (
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${kenBurns})`,
            transformOrigin: 'center',
          }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%)',
        }}
      />
      {scene.text ? (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: `${Math.round(format.width / 18)}px`,
            textAlign: scene.align,
          }}
        >
          <div
            style={{
              maxWidth: '80%',
              fontFamily: brand.fonts.primary ?? 'Inter',
              color: brand.colors.text ?? '#ffffff',
              textShadow: '0 4px 24px rgba(0,0,0,0.6)',
            }}
          >
            <div
              style={{
                fontSize: Math.round(format.width / 28),
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
              }}
            >
              {scene.text}
            </div>
            {scene.subtext ? (
              <div
                style={{
                  marginTop: 18,
                  fontSize: Math.round(format.width / 60),
                  fontWeight: 500,
                  opacity: 0.9,
                }}
              >
                {scene.subtext}
              </div>
            ) : null}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
