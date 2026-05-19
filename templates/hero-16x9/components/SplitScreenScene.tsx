import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, useCurrentFrame, interpolate } from 'remotion';
import type { Brand } from '../../../lib/config.ts';
import type { Scene } from '../../../lib/scenes.ts';
import { assetUrl, resolveColor } from './SceneRouter.tsx';

interface Props {
  scene: Extract<Scene, { type: 'split-screen' }>;
  brand: Brand;
  format: { width: number; height: number; fps: number };
  assetMap: Record<string, string>;
  slug: string;
}

interface SideMedia {
  type: 'generated-image' | 'generated-clip' | 'library-image' | 'library-clip';
  file?: string;
}

function MediaSlot({
  media,
  src,
}: {
  media: SideMedia;
  src: string | undefined;
}) {
  if (!src) {
    return (
      <div
        style={{
          flex: 1,
          backgroundColor: '#0f172a',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Missing media
      </div>
    );
  }
  if (media.type === 'generated-clip' || media.type === 'library-clip') {
    return (
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <OffthreadVideo
          src={src}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          muted
        />
      </div>
    );
  }
  return (
    <div style={{ flex: 1, overflow: 'hidden' }}>
      <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
}

export const SplitScreenScene: React.FC<Props> = ({ scene, brand, format, assetMap }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const leftSrc = assetUrl(assetMap, `${scene.id}.left`);
  const rightSrc = assetUrl(assetMap, `${scene.id}.right`);

  const dividerColor = scene.divider_color
    ? resolveColor(scene.divider_color, brand)
    : brand.colors.background ?? '#ffffff';
  const dividerSize = Math.round(format.width / 320);

  const isHorizontal = scene.orientation === 'horizontal';

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity: fadeIn }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: isHorizontal ? 'column' : 'row',
          gap: dividerSize,
          backgroundColor: dividerColor,
        }}
      >
        <MediaSlot media={scene.left} src={leftSrc} />
        <MediaSlot media={scene.right} src={rightSrc} />
      </div>
    </AbsoluteFill>
  );
};
