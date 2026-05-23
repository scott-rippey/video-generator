import React from 'react';
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { Brand } from '../../../lib/config.ts';
import type { Scene } from '../../../lib/scenes.ts';
import { assetUrl } from './SceneRouter.tsx';

interface Props {
  scene: Extract<Scene, { type: 'outro-clip' }>;
  brand: Brand;
  format: { width: number; height: number; fps: number };
  assetMap: Record<string, string>;
  slug: string;
}

/**
 * Plays a library video with its own audio. Used for a user-supplied outro MP4
 * that carries its own logo + music. Distinct from `library-clip` which always mutes.
 */
export const OutroClipScene: React.FC<Props> = ({ scene, assetMap }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const crossfadeFrames = Math.max(1, Math.round(scene.crossfade_in_seconds * fps));
  const fadeIn = interpolate(frame, [0, crossfadeFrames], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const src = assetUrl(assetMap, scene.id);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity: fadeIn }}>
      {src ? (
        <OffthreadVideo
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          muted={!scene.include_audio}
          volume={scene.include_audio ? scene.audio_volume : 0}
          startFrom={Math.round((scene.clip.start_offset ?? 0) * fps)}
        />
      ) : (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            color: '#fff',
            fontSize: 60,
          }}
        >
          Missing outro clip for scene {scene.id}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
