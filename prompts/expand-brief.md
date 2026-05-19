# Expand Brief to scenes.json

Apply this prompt when converting a markdown brief at `briefs/<slug>.md` into a structured `runs/<slug>/scenes.json`. The result is the contract between the human-readable brief and the orchestrator that fires asset generation + Remotion render.

## Before expanding — recommend the scene-by-scene conversation

If the brief feels like a one-pass draft (the user wrote it quickly, or you wrote it together but never walked each beat in detail), pause before expanding and recommend a scene-by-scene conversation FIRST. Production experience shows this front-loads creative judgment and back-loads API spend.

The scene-by-scene flow:
1. Confirm the overall concept arc and beat count.
2. For each beat in order: discuss the visual (what we see), the overlay text (if any), the voiceover line that lands during this scene, and any pacing notes.
3. After all beats are discussed, expand the brief into scenes.json reflecting what was decided.

This usually saves 30-50% of iteration credits because the first generated video already incorporates the user's judgment on each scene. Skip this only if the user explicitly says "just draft it and run."

## Inputs you have access to

- `briefs/<slug>.md` — the brief (free-form markdown, sections roughly per the example below).
- `brand.json` — workspace defaults (voice clone, fonts, colors, tone).
- `assets-library/brand/<brand-name>/brand.json` — per-project brand overrides when the brief includes a `brand: <name>` field. Merge onto defaults.
- The catalog of installed templates under `templates/<name>/`.
- Recent prior `runs/*/scenes.json` files for style reference.
- The Higgsfield CLI for confirming model availability and credit cost (`higgsfield model list --video`, `higgsfield generate cost <model> --prompt "..."`).

## What you output

Write `runs/<slug>/scenes.json` matching the schema in `lib/scenes.ts`. Validate before writing; if validation fails, fix and retry without bothering the user.

Then write `runs/<slug>/brief.md` as a copy of the source brief for the record.

## Reading the brief

Briefs are loose markdown. Look for these sections (any subset may be present):

- **Purpose** - what is this for, who watches it, where it lives
- **Length target** - 15s, 30s, 60s, 90s
- **Format** - default is horizontal 4K (3840x2160 at 30fps). Specify vertical 4K (2160x3840), square 4K (2160x2160), 1080p variants, or 21:9 cinematic only if different.
- **Brand** - name of an `assets-library/brand/<name>/` folder. Omit to use defaults.
- **Template** - which template under `templates/` to use, or "freeform" to compose from scratch (default: `hero-16x9`).
- **Hook** - the opening line or moment
- **Beats** - rough scene-by-scene plan
- **Voiceover** - full script if exact words are required, or "improvise from beats"
- **Music** - vibe description for ElevenLabs Music, or a filename from `assets-library/music/`
- **Assets** - any specific imagery or clips to generate, or "auto from scenes"
- **CTA** - call to action at the end

If a section is missing, infer sensible defaults. Surface anything unclear to the user before writing the scenes.json rather than guessing on something material like the voice script or the CTA text.

## Mapping beats to scene types

Each beat becomes one or more scenes. Scene types supported by the default `hero-16x9` template:

| type | when to use |
|------|-------------|
| `text-overlay` | Hook lines, CTAs, full-screen statements. Has a `text` field and a `background` (solid, gradient, or generated image). |
| `fullscreen-clip` | A single full-bleed video clip. Has a `clip` field describing the source (library file or generated). |
| `split-screen` | Two regions side by side or stacked. Each region has its own `media` reference. |
| `generated-image-bg` | A still image as background with optional text on top. Cheaper than `fullscreen-clip` when motion isn't critical. |
| `library-clip` | An MP4 already in `assets-library/stock/`. |
| `lower-third` | Name/title plate over another clip. Reads brand colors for the strip. |

Always honor what the template actually defines. If a brief references a scene type the chosen template doesn't ship with, either pick a different template or downgrade the type (e.g., `fullscreen-clip` to `generated-image-bg` if no clip budget remains).

## Duration math

- Sum of scene durations must equal `duration_seconds`. If beats add up to more or less, redistribute proportionally rather than dropping the user's specified target.
- Hook scenes are usually 3-5s. CTA scenes 4-8s. Body scenes 4-10s.
- A Higgsfield clip caps at the model's native max duration (Seedance 2.0 default 5s, extendable to 10s; Veo 3.1 up to ~8s). If a beat requires longer than the model supports, plan to chain clips or stretch in Remotion (CSS slow-mo, motion-interpolation is risky).

## Voiceover handling

- **"improvise from beats"**: draft a script that matches the beats and total duration. Aim for ~150 words per minute for conversational pace, ~120 wpm for dramatic. The script field gets the actual words.
- **Verbatim script**: copy text exactly. Do not paraphrase.
- Always set voice.id from the resolved brand (the root `brand.json` default, or per-brand override from `assets-library/brand/<name>/brand.json`). voice.settings come from the brand. Model id default = `eleven_multilingual_v2`.

## Music selection

- **Vibe description (default)**: set `music.source = "elevenlabs-music"`, `prompt = "<vibe text>"`, `duration_seconds = <total length>`. Prompt the ElevenLabs Music API in the orchestrator.
- **Specific file**: set `music.source = "library"`, `file = "assets-library/music/<name>.mp3"`. Use only when the brief explicitly names a file.

## Imagery vs clip selection per scene

For scenes that need visuals, choose between Modal FLUX (image) and Higgsfield (clip) based on the beat's needs:

- **Generated image (Modal FLUX)** when: motion isn't important, you want precise composition control, or the brief calls for "a still", "a photo", "a graphic", or describes a static subject. Cheaper (~$0.02 per image vs ~22.5 credits per Seedance clip).
- **Generated clip (Higgsfield)** when: motion is part of the scene's value (push-in, character moving, environmental motion), or the brief explicitly says "clip", "footage", "video", "cinematic".

Always request FLUX images at 2048+ on the long edge so they don't pixelate in 4K compositions.

## Higgsfield model selection

Per workspace preference (saved memory: feedback-default-video-model):

- **Default for any `generated-clip`**: `seedance_2_0`. Best balance of quality and cost. Use unless the brief justifies otherwise.
- **Hero/cinematic/"the brief calls for premium"**: `veo3_1`. Eats more credits; only use when the brief explicitly demands it and the budget allows. Outputs 4K natively (skip the upscale).
- **Brief specifies a model by name** (e.g., "Kling 3.0", "Cinematic Studio"): honor that exactly. Map common names to job_set_type via `higgsfield model list`.
- **Anime/stylized**: Soul Cast for character-driven anime, Cinematic Studio 3.0 for cinematic style transfer.

Run `higgsfield generate cost <model> --prompt "..."` for each clip scene before finalizing scenes.json so the orchestrator can show an accurate total cost to the user before burning credits.

## Output resolution and upscaling

- scenes.json `format` defaults to `{ "width": 3840, "height": 2160, "fps": 30 }` (4K horizontal).
- For clip scenes whose model's native max is below 4K (Seedance 2.0 tops at 1080p), set `clip.native_resolution` and `clip.upscale_to_4k: true`. The orchestrator handles the upscale in Remotion (CSS transform with proper smoothing) or via ffmpeg pre-ingest.
- Veo 3.1 outputs 4K natively. Set `upscale_to_4k: false`.

## Example I/O

Given this brief:

```markdown
# Slug: focused-work-hero

## Purpose
30-second hero video for a productivity SaaS landing page.

## Length target
30 seconds

## Format
Horizontal 4K

## Template
hero-16x9

## Hook
"Your team is losing hours to busywork they shouldn't have to do."

## Beats
1. Hook text on screen + voiceover (4s)
2. Cinematic clip: cluttered desk at night, notifications piling up (6s)
3. Bridge: automation working while the office is empty + split-screen visual (6s)
4. Proof: clean dashboard mock with metrics moving the right direction (8s)
5. CTA: visit example.com (6s)

## Voiceover
Improvise from beats. Punchy, short sentences, no jargon.

## Music
Upbeat but professional. Like a tech product launch. ElevenLabs Music.

## CTA
"Visit example.com" with branded button graphic.
```

Output `runs/focused-work-hero/scenes.json`:

```json
{
  "slug": "focused-work-hero",
  "template": "hero-16x9",
  "format": { "width": 3840, "height": 2160, "fps": 30 },
  "duration_seconds": 30,
  "brand": null,
  "voiceover": {
    "source": "elevenlabs",
    "voice_id": "YOUR_ELEVENLABS_VOICE_ID",
    "model_id": "eleven_multilingual_v2",
    "script": "Your team is losing hours to busywork they shouldn't have to do. Automation handles it while you focus. Imagine the calendar back. Visit example.com.",
    "settings": { "stability": 0.5, "similarity_boost": 0.78, "style": 0 }
  },
  "music": {
    "source": "elevenlabs-music",
    "prompt": "upbeat professional tech ad, driving but not aggressive, 110 bpm, modern synth pads, light percussion",
    "duration_seconds": 30
  },
  "scenes": [
    {
      "id": "hook",
      "start": 0,
      "duration": 4,
      "type": "text-overlay",
      "text": "Your team is losing hours to busywork.",
      "background": {
        "type": "generated-image",
        "source": "higgsfield",
        "model": "nano_banana_2",
        "prompt": "moody dark blue gradient with subtle particle texture, cinematic, 16:9, no text, no watermark",
        "target_width": 3840,
        "aspect_ratio": "16:9"
      }
    },
    {
      "id": "problem",
      "start": 4,
      "duration": 6,
      "type": "fullscreen-clip",
      "clip": {
        "type": "generated-clip",
        "source": "higgsfield",
        "model": "seedance_2_0",
        "prompt": "cluttered desk at night with a phone screen lighting up beside an open laptop, slow push-in, cinematic, moody single-source lamp light, scattered notes and a coffee cup, calm tension, photoreal cinematic film grain",
        "duration": 6,
        "aspect_ratio": "16:9",
        "resolution": "1080p",
        "native_resolution": "1920x1080",
        "upscale_to_4k": true
      }
    },
    {
      "id": "bridge",
      "start": 10,
      "duration": 6,
      "type": "split-screen",
      "left": {
        "type": "generated-image",
        "source": "higgsfield",
        "model": "nano_banana_2",
        "prompt": "an empty modern office at dusk, soft amber light through floor-to-ceiling windows, cinematic, photoreal, no people, calm atmosphere of work continuing autonomously",
        "target_width": 2048,
        "aspect_ratio": "9:16"
      },
      "right": {
        "type": "generated-image",
        "source": "higgsfield",
        "model": "gpt_image_2",
        "prompt": "abstract automation pipeline interface, clean modern UI, tasks completing in a flow diagram, blue accent color #3b82f6, dark background, 9:16 composition, no lorem ipsum, readable but anonymized data",
        "target_width": 2048,
        "aspect_ratio": "9:16"
      }
    },
    {
      "id": "proof",
      "start": 16,
      "duration": 8,
      "type": "generated-image-bg",
      "background": {
        "type": "generated-image",
        "source": "higgsfield",
        "model": "gpt_image_2",
        "prompt": "polished SaaS analytics dashboard mockup, line charts trending up and a row of stat cards with anonymized numbers, modern flat design with depth, soft glow on key metrics, blue accent matching brand, 16:9 composition with breathing room on the right third for text overlay, photoreal UI screenshot quality",
        "target_width": 3840,
        "aspect_ratio": "16:9"
      },
      "text": "Hours back. Every week."
    },
    {
      "id": "cta",
      "start": 24,
      "duration": 6,
      "type": "text-overlay",
      "text": "example.com",
      "background": {
        "type": "solid",
        "color": "primary"
      },
      "button": {
        "label": "Visit example.com",
        "style": "branded"
      }
    }
  ]
}
```

## Validation before writing

- All scene `start + duration` must form a continuous timeline from 0 to `duration_seconds`. No gaps, no overlaps.
- Every scene `id` is unique within the file.
- Every referenced model (`higgsfield.model`) must appear in `higgsfield model list --video` output.
- Every generated-image prompt should be specific enough to avoid generic AI aesthetics (see `prompts/scene-imagery.md`).
- Every clip scene whose duration exceeds the model's max should be flagged or split.

If validation fails, fix and retry. If you can't fix without user input, ask.

## After writing

Print a one-paragraph summary of the scenes.json to the user before the cost-confirmation gate runs:

> Wrote `runs/<slug>/scenes.json`. <N> scenes, total <X>s at <res>. Voiceover: <Y words via <voice name>>. Music: <ElevenLabs Music prompt>. Assets: <I Higgsfield images, J Higgsfield clips at K credits total>.

Then the orchestrator handles the actual generation gate.
