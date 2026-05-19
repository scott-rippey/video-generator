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

export const LibraryClipScene: React.FC<Props> = ({ scene, brand, format, assetMap }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' });
  const src = assetUrl(assetMap, scene.id);
  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity: fadeIn }}>
      {src ? (
        <OffthreadVideo
          src={src}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          muted
          startFrom={Math.round((scene.clip.start_offset ?? 0) * format.fps)}
        />
      ) : null}
      {scene.overlay_text ? (
        <AbsoluteFill style={{ display: 'flex', alignItems: 'flex-end', padding: format.width / 24 }}>
          <div
            style={{
              fontFamily: brand.fonts.primary ?? 'Inter',
              fontSize: Math.round(format.width / 32),
              fontWeight: 700,
              color: brand.colors.text ?? '#fff',
              textShadow: '0 2px 18px rgba(0,0,0,0.6)',
            }}
          >
            {scene.overlay_text}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
