import { z } from 'zod';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { runDir } from './config.ts';

// ---------- Common ----------

export const formatSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive().default(30),
});

export const voiceSettingsSchema = z.object({
  stability: z.number().min(0).max(1).optional(),
  similarity_boost: z.number().min(0).max(1).optional(),
  style: z.number().min(0).max(1).optional(),
  use_speaker_boost: z.boolean().optional(),
  speed: z.number().min(0.7).max(1.2).optional(),
});

export const voiceoverSchema = z.object({
  source: z.literal('elevenlabs'),
  voice_id: z.string().min(1),
  model_id: z.string().default('eleven_multilingual_v2'),
  script: z.string().min(1),
  settings: voiceSettingsSchema.optional(),
});

export const musicSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('elevenlabs-music'),
    prompt: z.string().min(1),
    duration_seconds: z.number().positive(),
    model_id: z.string().default('music_v1'),
    force_instrumental: z.boolean().optional(),
  }),
  z.object({
    source: z.literal('library'),
    file: z.string().min(1),
    duration_seconds: z.number().positive(),
  }),
  z.object({
    source: z.literal('none'),
    duration_seconds: z.number().positive(),
  }),
]);

// ---------- Asset sources used inside scenes ----------

const generatedImageSchema = z.object({
  type: z.literal('generated-image'),
  source: z.enum(['modal-flux', 'higgsfield']).default('higgsfield'),
  // For source=higgsfield, model is a Higgsfield image job_set_type
  // (e.g., "nano_banana_2", "gpt_image_2"). Defaults to nano_banana_2.
  // For source=modal-flux, model defaults to flux2-dev and is ignored if not set.
  model: z.string().optional(),
  prompt: z.string().min(1),
  negative_prompt: z.string().optional(),
  target_width: z.number().int().positive().default(2048),
  target_height: z.number().int().positive().optional(),
  aspect_ratio: z
    .enum(['auto', '16:9', '9:16', '4:3', '3:4', '1:1', '21:9'])
    .optional(),
  seed: z.number().int().nullable().optional(),
  guidance: z.number().optional(),
});

const generatedClipSchema = z.object({
  type: z.literal('generated-clip'),
  source: z.literal('higgsfield'),
  model: z.string().min(1), // job_set_type, e.g., seedance_2_0
  prompt: z.string().min(1),
  duration: z.number().int().positive(),
  aspect_ratio: z
    .enum(['auto', '16:9', '9:16', '4:3', '3:4', '1:1', '21:9'])
    .default('16:9'),
  resolution: z.enum(['480p', '720p', '1080p']).default('1080p'),
  mode: z.enum(['std', 'fast']).default('std'),
  genre: z
    .enum(['auto', 'action', 'horror', 'comedy', 'noir', 'drama', 'epic'])
    .optional(),
  medias: z.array(z.string()).optional(),
  native_resolution: z.string().optional(),
  upscale_to_4k: z.boolean().default(true),
});

const libraryClipSchema = z.object({
  type: z.literal('library-clip'),
  file: z.string().min(1),
  start_offset: z.number().min(0).optional(),
});

const libraryImageSchema = z.object({
  type: z.literal('library-image'),
  file: z.string().min(1),
});

const solidBackgroundSchema = z.object({
  type: z.literal('solid'),
  color: z.string().min(1), // hex or brand color key like "primary"
});

const gradientBackgroundSchema = z.object({
  type: z.literal('gradient'),
  from: z.string().min(1),
  to: z.string().min(1),
  angle: z.number().default(180),
});

const backgroundSchema = z.discriminatedUnion('type', [
  generatedImageSchema,
  libraryImageSchema,
  solidBackgroundSchema,
  gradientBackgroundSchema,
]);

const mediaSchema = z.discriminatedUnion('type', [
  generatedImageSchema,
  generatedClipSchema,
  libraryImageSchema,
  libraryClipSchema,
]);

// ---------- Scene types ----------

const baseSceneFields = {
  id: z.string().min(1),
  start: z.number().min(0),
  duration: z.number().positive(),
};

export const textOverlaySceneSchema = z.object({
  ...baseSceneFields,
  type: z.literal('text-overlay'),
  text: z.string().min(1),
  subtext: z.string().optional(),
  align: z.enum(['left', 'center', 'right']).default('center'),
  background: backgroundSchema,
  button: z
    .object({
      label: z.string(),
      style: z.string().optional(),
    })
    .optional(),
});

export const fullscreenClipSceneSchema = z.object({
  ...baseSceneFields,
  type: z.literal('fullscreen-clip'),
  clip: z.discriminatedUnion('type', [generatedClipSchema, libraryClipSchema]),
  overlay_text: z.string().optional(),
  hud_visual: z.enum(['ai-core']).optional(),
});

export const generatedImageBgSceneSchema = z.object({
  ...baseSceneFields,
  type: z.literal('generated-image-bg'),
  background: generatedImageSchema,
  text: z.string().optional(),
  subtext: z.string().optional(),
  align: z.enum(['left', 'center', 'right']).default('center'),
});

export const splitScreenSceneSchema = z.object({
  ...baseSceneFields,
  type: z.literal('split-screen'),
  orientation: z.enum(['horizontal', 'vertical']).default('vertical'),
  left: mediaSchema,
  right: mediaSchema,
  divider_color: z.string().optional(),
});

export const lowerThirdSceneSchema = z.object({
  ...baseSceneFields,
  type: z.literal('lower-third'),
  background: mediaSchema,
  title: z.string().min(1),
  subtitle: z.string().optional(),
});

export const libraryClipSceneSchema = z.object({
  ...baseSceneFields,
  type: z.literal('library-clip'),
  clip: libraryClipSchema,
  overlay_text: z.string().optional(),
});

export const sceneSchema = z.discriminatedUnion('type', [
  textOverlaySceneSchema,
  fullscreenClipSceneSchema,
  generatedImageBgSceneSchema,
  splitScreenSceneSchema,
  lowerThirdSceneSchema,
  libraryClipSceneSchema,
]);

export type Scene = z.infer<typeof sceneSchema>;

// ---------- Full scenes.json ----------

export const captionSchema = z.object({
  start: z.number().min(0),
  end: z.number().positive(),
  lines: z.array(z.string().min(1)).min(1).max(3),
});
export type Caption = z.infer<typeof captionSchema>;

export const scenesSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase kebab-case'),
  template: z.string().min(1).default('hero-16x9'),
  format: formatSchema.default({ width: 3840, height: 2160, fps: 30 }),
  duration_seconds: z.number().positive(),
  brand: z.string().nullable().default(null),
  voiceover: voiceoverSchema,
  music: musicSchema,
  scenes: z.array(sceneSchema).min(1),
  captions: z.array(captionSchema).optional(),
});

export type Scenes = z.infer<typeof scenesSchema>;

// ---------- IO helpers ----------

export function scenesPath(slug: string): string {
  return resolve(runDir(slug), 'scenes.json');
}

export function readScenes(slug: string): Scenes {
  const path = scenesPath(slug);
  if (!existsSync(path)) {
    throw new Error(`scenes.json not found at ${path}. Run brief expansion first.`);
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  const parsed = scenesSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid scenes.json at ${path}:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`,
    );
  }
  return parsed.data;
}

export function writeScenes(slug: string, scenes: Scenes): void {
  const parsed = scenesSchema.parse(scenes);
  const path = scenesPath(slug);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
}

/**
 * Validates that scene start/duration pairs form a continuous timeline
 * from 0 to duration_seconds with no overlaps and no gaps.
 */
export function validateTimeline(scenes: Scenes): void {
  let cursor = 0;
  for (const s of scenes.scenes) {
    if (Math.abs(s.start - cursor) > 0.001) {
      throw new Error(
        `Scene ${s.id} starts at ${s.start}s but expected ${cursor}s (gap or overlap).`,
      );
    }
    cursor = s.start + s.duration;
  }
  if (Math.abs(cursor - scenes.duration_seconds) > 0.001) {
    throw new Error(
      `Scenes sum to ${cursor}s but duration_seconds is ${scenes.duration_seconds}s.`,
    );
  }
}
