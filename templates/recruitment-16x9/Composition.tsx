import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import type { Scenes, Scene } from '../../lib/scenes.ts';
import type { Brand } from '../../lib/config.ts';
import { SceneRouter } from './components/SceneRouter.tsx';

export interface MainInputProps {
  scenes: Scenes;
  format: { width: number; height: number; fps: number };
  brand: Brand;
  voiceoverFile: string | null;
  musicFile: string | null;
  assetMap: Record<string, string>;
  slug: string;
}

export const Main: React.FC<MainInputProps> = (props) => {
  const { scenes, format, brand, voiceoverFile, musicFile, assetMap, slug } = props;
  const fontFamily = brand.fonts.primary ?? 'Inter';
  const backgroundColor = brand.colors.background ?? '#000000';

  return (
    <AbsoluteFill style={{ backgroundColor, fontFamily }}>
      {scenes.scenes.map((scene: Scene) => (
        <Sequence
          key={scene.id}
          from={Math.round(scene.start * format.fps)}
          durationInFrames={Math.round(scene.duration * format.fps)}
        >
          <SceneRouter
            scene={scene}
            brand={brand}
            format={format}
            assetMap={assetMap}
            slug={slug}
          />
        </Sequence>
      ))}

      {/* Per-scene SFX. `file` is workspace-relative; staged to publicDir
          mirroring its assets-library/* path so staticFile() can find it. */}
      {scenes.scenes.flatMap((scene: Scene) =>
        (scene.sfx ?? []).map((s, i) => {
          const stagedPath = s.file.startsWith('assets-library/')
            ? s.file.slice('assets-library/'.length)
            : s.file;
          const fromFrame = Math.max(
            0,
            Math.round((scene.start + s.at_seconds) * format.fps),
          );
          const durationFrames =
            s.duration_seconds !== undefined
              ? Math.max(1, Math.round(s.duration_seconds * format.fps))
              : undefined;
          return (
            <Sequence
              key={`${scene.id}-sfx-${i}`}
              from={fromFrame}
              durationInFrames={durationFrames}
            >
              <Audio src={staticFile(stagedPath)} volume={s.volume} />
            </Sequence>
          );
        }),
      )}

      {/* Voiceover plays from frame 0; the file's natural duration ends before the
          outro begins. */}
      {voiceoverFile ? (
        <Audio src={staticFile(voiceoverFile)} volume={0.85} />
      ) : null}

      {/* Music plays from frame 0; the file already has a fade-out baked in via
          ffmpeg loudnorm + afade, so we don't need a frame-callback volume here.
          The file's duration matches the non-outro timeline so it ends silently
          before the outro begins. */}
      {musicFile ? (
        <Audio src={staticFile(musicFile)} volume={0.55} />
      ) : null}
    </AbsoluteFill>
  );
};
