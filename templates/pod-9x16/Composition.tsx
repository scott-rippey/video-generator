import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import type { Scenes, Scene } from '../../lib/scenes.ts';
import type { Brand } from '../../lib/config.ts';
import { SceneRouter } from './components/SceneRouter.tsx';
import { Captions } from './components/Captions.tsx';

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
  const backgroundColor = brand.colors.background ?? '#ffffff';

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

      {scenes.captions && scenes.captions.length > 0 ? (
        <Captions captions={scenes.captions} brand={brand} format={format} />
      ) : null}

      {voiceoverFile ? <Audio src={staticFile(voiceoverFile)} volume={1} /> : null}
      {musicFile ? <Audio src={staticFile(musicFile)} volume={0.18} /> : null}
    </AbsoluteFill>
  );
};
