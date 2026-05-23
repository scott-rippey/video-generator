import React from 'react';
import { Composition } from 'remotion';
import { Main, type MainInputProps } from './Composition.tsx';

const defaultProps: MainInputProps = {
  scenes: {
    slug: 'preview',
    template: 'recruitment-16x9',
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
        id: 'preview',
        start: 0,
        duration: 5,
        type: 'close-card',
        primary_text: 'Recruitment template preview',
        secondary_text: 'No scenes.json passed.',
        background: { type: 'solid', color: '#0a0a14' },
        contact: {},
        show_logo: false,
        background_clip_opacity: 0.18,
        background_clip_start_offset_seconds: 0,
        background_clip_motion_intensity: 0.5,
      },
    ],
  },
  format: { width: 3840, height: 2160, fps: 30 },
  brand: {
    voice: { id: 'placeholder' },
    colors: {
      primary: '#0f172a',
      accent: '#dc3545',
      background: '#ffffff',
      text: '#0f172a',
      muted: '#64748b',
    },
    fonts: { primary: 'Inter', weights: [400, 500, 600, 700] },
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
