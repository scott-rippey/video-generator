import React from 'react';
import { Composition } from 'remotion';
import { Main, type MainInputProps } from './Composition.tsx';

const defaultProps: MainInputProps = {
  scenes: {
    slug: 'preview',
    template: 'hero-16x9',
    format: { width: 3840, height: 2160, fps: 30 },
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
        subtext: 'No scenes.json passed; this is the default preview.',
        align: 'center',
        background: { type: 'solid', color: '#0f172a' },
        sfx: [],
      },
    ],
  },
  format: { width: 3840, height: 2160, fps: 30 },
  brand: {
    voice: { id: 'placeholder' },
    colors: {
      primary: '#0f172a',
      accent: '#3b82f6',
      background: '#ffffff',
      text: '#0f172a',
      muted: '#64748b',
    },
    fonts: { primary: 'Inter', weights: [400, 600, 700] },
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
