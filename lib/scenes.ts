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

// Sound effect attached to a scene; plays at `at_seconds` offset from scene start.
// `file` is relative to the workspace (e.g. "assets-library/sfx/whoosh.mp3").
// `at_seconds` may be negative to pre-roll the SFX before the scene begins (e.g. -0.2
// to start a whoosh 0.2s before its scene's first motion).
// `duration_seconds` (optional) clips the SFX to that length (useful when reusing a long
// typing-loop file for a specific typing event that should stop when the field is full).
const sceneSfxSchema = z.object({
  file: z.string().min(1),
  at_seconds: z.number().default(0),
  duration_seconds: z.number().positive().optional(),
  volume: z.number().min(0).max(2).default(1),
});

const baseSceneFields = {
  id: z.string().min(1),
  start: z.number().min(0),
  duration: z.number().positive(),
  sfx: z.array(sceneSfxSchema).default([]),
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

// ---------- UI animation scene types (recruitment-16x9 and similar templates) ----------

const sceneLabelSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  position: z
    .enum(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
    .default('bottom-left'),
});

const motionKeyframeSchema = z.object({
  // Normalized time within the scene, 0-1
  t: z.number().min(0).max(1),
  // Scale multiplier (1 = no zoom)
  scale: z.number().positive().default(1),
  // Pan offsets as percentage of viewport (positive x = shift right, positive y = shift down)
  x: z.number().default(0),
  y: z.number().default(0),
});

const sceneMotionSchema = z.object({
  kind: z
    .enum([
      'scroll-down',
      'scroll-up',
      'zoom-in',
      'zoom-out',
      'pan-right',
      'pan-left',
      'ken-burns',
      'push-in',
      'static',
      'keyframes',
    ])
    .default('push-in'),
  intensity: z.number().min(0).max(1).default(0.4),
  easing: z
    .enum(['linear', 'ease-in', 'ease-out', 'ease-in-out'])
    .default('ease-in-out'),
  // Used only when kind === 'keyframes'. Linear interpolation between keyframes
  // with the chosen easing applied per segment.
  keyframes: z.array(motionKeyframeSchema).optional(),
});

const highlightSchema = z.object({
  kind: z
    .enum(['pulse-glow', 'underline', 'box-outline', 'circle-glow'])
    .default('pulse-glow'),
  // bounding box in original screenshot pixel coordinates
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  at_seconds: z.number().min(0).default(0),
  duration_seconds: z.number().positive().default(1.2),
  // For circle-glow: time spent drawing the ring in (0 = instant pop-in, no stroke animation).
  // Pulse begins after draw-in completes.
  draw_in_seconds: z.number().min(0).default(0.6),
  // For circle-glow: pulse the glow intensity after draw-in completes
  pulse_after: z.boolean().default(true),
  // For circle-glow: corner radius. 999 = pill shape, smaller = match a card's existing rounded corners.
  border_radius: z.number().min(0).default(999),
  // For circle-glow: padding (in natural-image pixels) between the target box and the ring.
  // If omitted, defaults to auto-padding (~6% of smaller dimension, min 8 render px).
  // Set to 0 to put the stroke centered on the target edge (tight to the gray line of a card).
  padding: z.number().min(0).optional(),
  color: z.string().optional(),
});

// ui-static-reveal: scroll / zoom over a screenshot with optional highlights
// Used by: Beat 2 (Website class page scroll), Beat 8 (Brand Voice landing scroll)
export const uiStaticRevealSceneSchema = z.object({
  ...baseSceneFields,
  type: z.literal('ui-static-reveal'),
  image: libraryImageSchema,
  // Natural pixel dimensions of the source screenshot. Used to scale highlight
  // bounding boxes from screenshot-native coords into the rendered viewport.
  image_natural_width: z.number().int().positive().optional(),
  image_natural_height: z.number().int().positive().optional(),
  motion: sceneMotionSchema.default({
    kind: 'push-in',
    intensity: 0.35,
    easing: 'ease-in-out',
  }),
  // How the screenshot is fit into the viewport.
  fit: z.enum(['contain', 'cover']).default('contain'),
  highlights: z.array(highlightSchema).default([]),
  label: sceneLabelSchema.optional(),
  background_color: z.string().default('#000000'),
});

// ui-form-fill: cover existing form values, animate typed input, button press, confirmation
// Used by: Beat 6 (Agent Services Form), Beat 7 (Vendor Form)
const formFieldSchema = z.object({
  // bounding box of the field on the screenshot (original pixel coords)
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  // color to "erase" the screenshot's existing field value before retyping
  cover_color: z.string().default('#ffffff'),
  // text to animate IN
  text: z.string().min(1),
  // animation start within the scene (seconds)
  start_at: z.number().min(0).default(0),
  // typing speed
  chars_per_sec: z.number().positive().default(28),
  // text styling (defaults derived from brand if absent)
  font_size: z.number().positive().optional(),
  font_color: z.string().optional(),
  font_weight: z.union([z.string(), z.number()]).optional(),
  font_family: z.string().optional(),
  text_align: z.enum(['left', 'center', 'right']).default('left'),
  padding_x: z.number().min(0).default(12),
});

export const uiFormFillSceneSchema = z.object({
  ...baseSceneFields,
  type: z.literal('ui-form-fill'),
  image: libraryImageSchema,
  image_natural_width: z.number().int().positive().optional(),
  image_natural_height: z.number().int().positive().optional(),
  fit: z.enum(['contain', 'cover']).default('contain'),
  motion: sceneMotionSchema.default({
    kind: 'push-in',
    intensity: 0.25,
    easing: 'ease-in-out',
  }),
  field_fills: z.array(formFieldSchema).default([]),
  // Button to glow + press animation at end of fill
  button_pulse: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
      at_seconds: z.number().min(0),
      glow_color: z.string().default('#3b82f6'),
      pressed_scale: z.number().positive().default(0.97),
    })
    .optional(),
  // Optional confirmation overlay that appears at end
  confirmation: z
    .object({
      text: z.string().min(1),
      position: z
        .enum(['center', 'top', 'bottom', 'top-right', 'bottom-right'])
        .default('center'),
      at_seconds: z.number().min(0),
      background_color: z.string().default('rgba(16,185,129,0.95)'),
      text_color: z.string().default('#ffffff'),
    })
    .optional(),
  highlights: z.array(highlightSchema).default([]),
  label: sceneLabelSchema.optional(),
  background_color: z.string().default('#000000'),
});

// phone-mockup-chat: React-built phone bezel + animated chat thread (no screenshot)
// Used by: Beat 5 (Hey Josh chat)
const chatHighlightSchema = z.object({
  phrase: z.string().min(1),
  at_seconds: z.number().min(0),
  color: z.string().optional(),
});

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().min(1),
  animation: z.enum(['typing', 'fade-in']).default('typing'),
  chars_per_sec: z.number().positive().default(28),
  // start time relative to scene start (seconds). 'auto' = right after previous message
  start_at: z.union([z.number().min(0), z.literal('auto')]).default('auto'),
  // hold after this message finishes before the next one
  hold_after_seconds: z.number().min(0).default(0.4),
  // optional thinking-dots indicator BEFORE this message appears
  thinking_pulse_seconds: z.number().min(0).default(0),
  // assistant-only: legacy single-phrase highlight (kept for backwards compatibility)
  highlight_phrase: z.string().optional(),
  highlight_at_seconds: z.number().min(0).optional(),
  // assistant-only: multiple phrases each with their own start time
  highlight_phrases: z.array(chatHighlightSchema).default([]),
});

export const phoneMockupChatSceneSchema = z.object({
  ...baseSceneFields,
  type: z.literal('phone-mockup-chat'),
  header: z.object({
    title: z.string().min(1),
    subtitle: z.string().optional(),
    background_color: z.string().default('#dc3545'),
    text_color: z.string().default('#ffffff'),
    avatar_initials: z.string().optional(),
  }),
  screen_background_color: z.string().default('#0a0a0a'),
  user_bubble_color: z.string().default('#dc3545'),
  user_bubble_text_color: z.string().default('#ffffff'),
  assistant_bubble_color: z.string().default('#262626'),
  assistant_bubble_text_color: z.string().default('#e5e5e5'),
  messages: z.array(chatMessageSchema).min(1),
  // background outside the phone bezel
  background: z
    .discriminatedUnion('type', [solidBackgroundSchema, gradientBackgroundSchema])
    .default({ type: 'solid', color: '#0a0a14' }),
  // phone framing: where it sits in the 16:9 frame
  phone_position: z.enum(['center', 'left', 'right']).default('left'),
  label: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
  }).optional(),
});

// close-card: brand-themed CTA card with optional faded clip background
// Used by: Beat 9
export const closeCardSceneSchema = z.object({
  ...baseSceneFields,
  type: z.literal('close-card'),
  primary_text: z.string().min(1),
  secondary_text: z.string().optional(),
  contact: z
    .object({
      phone: z.string().optional(),
      email: z.string().optional(),
      website: z.string().optional(),
    })
    .default({}),
  show_logo: z.boolean().default(true),
  logo_text: z.string().optional(), // wordmark text if no logo image is provided
  background: backgroundSchema,
  // Optional: reference another scene's already-generated clip as a faded background overlay
  background_clip_scene_id: z.string().optional(),
  background_clip_opacity: z.number().min(0).max(1).default(0.18),
  background_clip_start_offset_seconds: z.number().min(0).default(0),
  // intensity of the Ken Burns push-in over the clip (0-1)
  background_clip_motion_intensity: z.number().min(0).max(1).default(0.5),
  // Fade the background clip's opacity to 0 over the last N seconds of the scene.
  // Useful when the clip is shorter than the scene to hide the frozen-last-frame.
  background_clip_fade_out_seconds: z.number().min(0).default(0),
  // music begins its fade-out at this offset within the scene (seconds from scene start)
  // (Note: actual music fade is baked into the audio file via ffmpeg; this field is informational.)
  music_fade_out_seconds: z.number().min(0).optional(),
  // Delay before the title/details text starts animating in (seconds from scene start).
  // Lets the background settle / breathe before the CTA copy appears.
  intro_delay_seconds: z.number().min(0).default(0),
});

// outro-clip: library video with its own audio (unlike library-clip which mutes).
// Used by recruitment-16x9 / similar templates when the brief includes a
// user-supplied closing video (logo + music). Optional — only present in scenes
// that explicitly opt into it.
export const outroClipSceneSchema = z.object({
  ...baseSceneFields,
  type: z.literal('outro-clip'),
  clip: libraryClipSchema,
  crossfade_in_seconds: z.number().min(0).default(0.5),
  include_audio: z.boolean().default(true),
  // optional volume for the embedded audio (0-1)
  audio_volume: z.number().min(0).max(1).default(1),
});

export const sceneSchema = z.discriminatedUnion('type', [
  textOverlaySceneSchema,
  fullscreenClipSceneSchema,
  generatedImageBgSceneSchema,
  splitScreenSceneSchema,
  lowerThirdSceneSchema,
  libraryClipSceneSchema,
  uiStaticRevealSceneSchema,
  uiFormFillSceneSchema,
  phoneMockupChatSceneSchema,
  closeCardSceneSchema,
  outroClipSceneSchema,
]);

export type Scene = z.infer<typeof sceneSchema>;

// ---------- Full scenes.json ----------

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
