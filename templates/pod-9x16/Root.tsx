import React from 'react';
import { Composition } from 'remotion';
import { Main, type MainInputProps } from './Composition.tsx';

const defaultProps: MainInputProps = {
  scenes: {
    slug: 'preview',
    template: 'pod-9x16',
    format: { width: 2160, height: 3840, fps: 30 },
    duration_seconds: 5,
    brand: null,
    voiceover: {
      source: 'elevenlabs',
      voice_id: 'placeholder',
      model_id: 'eleven_multilingual_v2',
      script: 'Preview composition. Drop a brief in briefs/ and run the orchestrator.',
    },
    music: { source: 'none', duration_seconds: 5 },
    scenes: [
      {
        id: 'preview-hook',
        start: 0,
        duration: 5,
        type: 'text-overlay',
        text: 'Preview',
        subtext: 'pod-9x16 default composition',
        align: 'center',
        background: { type: 'solid', color: '#0A0A0A' },
      },
    ],
  },
  format: { width: 2160, height: 3840, fps: 30 },
  brand: {
    voice: { id: 'placeholder' },
    colors: {
      primary: '#FF4A0D',
      accent: '#FF4A0D',
      background: '#0A0A0A',
      text: '#F5F5F5',
      muted: '#9A9A9A',
    },
    fonts: { primary: 'Inter', weights: [400, 600, 700, 800] },
    logo_path: null,
    tone: '',
  },
  voiceoverFile: null,
  musicFile: null,
  assetMap: {},
  slug: 'preview',
};

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Main"
        component={Main as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={defaultProps.format.fps * defaultProps.scenes.duration_seconds}
        fps={defaultProps.format.fps}
        width={defaultProps.format.width}
        height={defaultProps.format.height}
        defaultProps={defaultProps as unknown as Record<string, unknown>}
      />
    </>
  );
};
