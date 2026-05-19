# Scene to Higgsfield Clip Prompt

Apply this prompt when expanding a scene's short visual description into a finished Higgsfield clip-generation prompt. The orchestrator runs this for every scene whose visual is `source: "higgsfield"` before invoking the `higgsfield generate` CLI.

## Inputs

- The scene definition from scenes.json (type, intent, duration).
- The resolved brand (root `brand.json` merged with `assets-library/brand/<name>/brand.json` if the brief named one).
- The video's overall tone and purpose from the brief.
- The chosen Higgsfield model (the orchestrator passes this in; see the model selection logic below if it's not already chosen).

## Output

A finalized clip configuration written back into the scene:
```json
{
  "type": "generated-clip",
  "source": "higgsfield",
  "model": "<job_set_type>",
  "prompt": "<expanded prompt>",
  "duration": <integer seconds>,
  "aspect_ratio": "<16:9|9:16|...>",
  "resolution": "<480p|720p|1080p>",
  "mode": "<std|fast>",
  "genre": "<auto|action|horror|comedy|noir|drama|epic>",
  "medias": [...] // optional, for image-to-video
}
```

## Model selection logic

**Default: Seedance 2.0 (`seedance_2_0`).** Workspace preference (saved memory: feedback-default-video-model). Best balance of quality and credit cost. Use unless something below applies.

Escalation tree:

1. **Brief explicitly names a model** → use that one. Translate name to `job_set_type` via `higgsfield model list --video`.
2. **Brief says "cinematic", "hero", "premium", "highest quality", or the scene is the visual hook of a $50K+ pitch deck moment** → `veo3_1` (Veo 3.1). Eats ~10x more credits than Seedance. Outputs 4K natively, skip the upscale step.
3. **Brief says "fast b-roll", "draft", "iterate quickly"** → still Seedance 2.0 but with `mode: "fast"` for cheaper credit cost.
4. **Brief describes anime, stylized character animation, or distinct cinematic style** → `soul_cast` (Soul Cast) for character-led anime, `cinematic_studio_3_0` (Cinematic Studio 3.0) for cinematic style transfer.
5. **Image-to-video** (scene has a source image to animate) → still Seedance 2.0 by default. Add `medias: ["<upload_id>"]`. Kling 3.0 is also strong here; switch if the scene calls for liquid motion or specific Kling strengths.
6. **Veo 3.1 Lite** (`veo3_1_lite`) is a budget Veo option when the brief wants Veo's look but credits are tight. Worth surfacing as an option to the user when Veo would blow the monthly allowance.

Always run `higgsfield generate cost <model> --prompt "..." --duration N --resolution 1080p` to get the actual credit cost for the chosen config before committing. Surface this to the user via the orchestrator's cost confirmation gate.

## Seedance 2.0 parameter cheat sheet

(Verified 2026-05-18 via `higgsfield model get seedance_2_0`.)

| param | values | default | notes |
|-------|--------|---------|-------|
| `aspect_ratio` | auto, 16:9, 9:16, 4:3, 3:4, 1:1, 21:9 | 16:9 | Match the scenes.json format |
| `duration` | integer | 5 | Native max 10s; longer needs chaining |
| `genre` | auto, action, horror, comedy, noir, drama, epic | auto | Bias for narrative mood |
| `medias` | array | none | Upload IDs for image-to-video |
| `mode` | std, fast | std | `fast` ~half cost, lower quality |
| `prompt` | string | required | The prompt you write below |
| `resolution` | 480p, 720p, 1080p | 720p | 1080p for finals, 720p for drafts |

Veo 3.1, Kling 3.0, and others have different param schemas. Run `higgsfield model get <type>` before writing the config.

## Anatomy of a clip prompt

Higgsfield video models, especially Seedance and Veo, respond well to cinematographer-style prompts. Structure:

```
[subject and action],
[camera motion / framing],
[environment with materials and light],
[time of day / mood],
[secondary motion / atmosphere],
[style anchors: cinematic / documentary / commercial / anime]
```

The single most leveraged field is **camera motion**. Static prompts produce static-feeling videos. Always include one of: slow push-in, slow pull-out, slow pan left/right, slow dolly, slow tilt, handheld follow, locked-off observation, slow rack focus, drone overhead, low-angle dolly, top-down product shot.

Example:

```
A phone screen lights up on a walnut desk in a dimly lit home office, slow cinematic push-in toward the screen,
desk in the foreground with scattered notes and a coffee cup, single warm lamp light from camera left,
night, calm tense mood, dust motes drifting through the light beam,
photoreal cinematic film grain, 35mm aesthetic
```

## Genre tag use (Seedance specifically)

Seedance 2.0 accepts a `genre` flag. Use it intentionally:

- `action` = fast motion, dynamic camera, kinetic energy. Good for sports, chase, reveal moments.
- `horror` = unsettling tone, low light, slow uncomfortable motion. Rarely used; reserve for thriller content.
- `comedy` = brighter palette, lighter motion, often unexpected timing. Rarely fits brand or product hero content.
- `noir` = high contrast, deep shadows, moody atmosphere. Great for "dramatic stakes" hero shots.
- `drama` = balanced motion, emotional cinematography, controlled palette. The default for most narrative beats.
- `epic` = wide vistas, sweeping motion, big music energy. Good for opening sequences and CTAs.
- `auto` = let Seedance decide. Fine for utility b-roll. Default if unsure.

## Brand consistency

When the brief names a brand:
- Reflect `tone` in the prompt's mood adjectives. Brand tone "grounded conversational" maps to "natural light, real materials, no over-stylization".
- Weave `colors.accent` into the prompt where a color is naturally present (e.g., "blue accent on the screen", "warm lamp matching brand warm tone").
- If the brand has reference clips in `assets-library/brand/<name>/references/`, you may upload one as a `media` for image-to-video runs (where supported by the model) to anchor the look.

## Duration math

- Seedance 2.0 max native = 10s.
- Veo 3.1 max ~8s (verify via `higgsfield model get veo3_1`).
- Kling 3.0 max ~10s.
- If the scene needs more than the model's max, choose one of: a) split into two consecutive clip scenes with continuity prompts, b) stretch in Remotion (motion interpolation is risky beyond 1.3x), c) switch to a generated-image-bg with motion overlays in Remotion (Ken Burns + parallax) for static scenes.

## Resolution and upscale flags

- Seedance 2.0 at 1080p is the natural setting for 4K final renders. Mark `upscale_to_4k: true` and the orchestrator/Remotion handle scaling.
- Veo 3.1 at 4K is native; set `upscale_to_4k: false`.
- 720p is acceptable for draft/iteration renders at 1080p target; bump to 1080p before a 4K final.

## Negative prompts and avoid lists

Higgsfield's CLI doesn't expose negative prompts as a flag, but the prompt body can include "no <thing>" hints when needed. Use sparingly; the models respond better to positive direction. Examples:

- "no watermark, no logo, no text overlay" (when text will be added later in Remotion)
- "no body horror, no face distortion" (for character scenes)

## Default visual defaults (apply by default, especially for tech / office scenes)

Production experience shows these patterns produce cleaner first-render results:

- **"No legible text/UI on screens" is the default.** AI video models hallucinate placeholder text on any visible monitor. For scenes that include a screen, default to one of:
  - Screen is intentionally out of focus / blurred ("shallow depth of field where the screen is intentionally blurred and unreadable")
  - Screen shows only abstract data visualizations and isolated numbers ("only graphs and circular progress meters, no text labels, no captions, no axis labels")
  - Camera holds far enough back that any text would be tiny
  - Or: no screen visible at all; computers are present but turned away or closed
- **For "people working" scenes, default to implying tech without showing it.** Closed laptops on the desk, notebooks and pens, people focused on each other rather than at a screen. Read better than the "two people pointing at a monitor with hallucinated text on it" trap.
- **Group contexts are safer than solo shots** with the NSFW filter. When you can frame the scene as "two or three professionals collaborating" or similar, do.
- **Avoid specific person descriptors that combine age + action.** "A professional sitting at a desk" passes. "A woman in her late thirties leaning back" gets NSFW-flagged.
- **Cinematic prestige direction works:** slow camera motion, drama genre, photoreal documentary feel, shallow depth of field at 50mm, deep navy + warm amber palette. These cues consistently produce confident, non-AI-slop output.

## Common failure modes and fixes

- **NSFW false positive rejections**: Higgsfield Seedance has an aggressive content filter that rejects ordinary-looking prompts with `status: "nsfw"`. Verified triggers (2026-05-18): the words "pulsing", "transforming", "chaotic", and the phrase "person in their [age] [doing thing]" all caused false positives on innocuous prompts (a CRM dashboard, a person closing a laptop). Mitigations:
  - Avoid loaded motion verbs ("pulsing", "throbbing", "transforming", "exploding"). Use plainer language ("rising", "moving", "growing", "shifting").
  - Avoid "chaotic", "cluttered", "violent", "intense" — even when describing UI states.
  - **Don't show people directly when you can imply them via environment.** "Empty office chair turned away from a desk, coffee mug still warm" gets across the same "human just left" mood without tripping the filter on the human figure.
  - Failed jobs ARE refunded (verified: 45-credit job rejected, balance restored), so the safety filter doesn't cost credits, just time.
- **Subject morphs mid-clip**: tighten the subject description, add concrete physical anchors (hair color, outfit, posture), and consider chaining with higgsfield-soul-id for identity consistency across multiple clips.
- **Static / boring motion**: explicitly call out camera motion in the prompt.
- **Wrong era or wrong materials**: be specific. "Modern home office" returns 2010s open-plan; "2024 minimalist home office with walnut desk and brass lamp" returns what you actually want.
- **Branded text in the clip**: avoid asking Higgsfield to render text. Add text in Remotion afterwards.

## Output to scenes.json

Replace the short prompt with the expanded clip config:

Before:
```json
{
  "type": "generated-clip",
  "source": "higgsfield",
  "model": "seedance_2_0",
  "prompt": "phone ringing in dark room at night"
}
```

After:
```json
{
  "type": "generated-clip",
  "source": "higgsfield",
  "model": "seedance_2_0",
  "prompt": "A phone screen lights up on a walnut desk in a dimly lit home office, slow cinematic push-in toward the screen, desk in the foreground with scattered notes and a coffee cup, single warm lamp light from camera left, late night, calm tense mood, dust motes drifting through the light beam, photoreal cinematic film grain, 35mm aesthetic, no watermark, no text",
  "duration": 6,
  "aspect_ratio": "16:9",
  "resolution": "1080p",
  "mode": "std",
  "genre": "drama",
  "native_resolution": "1920x1080",
  "upscale_to_4k": true
}
```

The orchestrator then calls:
```bash
higgsfield generate create seedance_2_0 \
  --prompt "..." \
  --duration 6 \
  --aspect-ratio 16:9 \
  --resolution 1080p \
  --mode std \
  --genre drama \
  --json
```

…and polls until the job completes via `higgsfield generate wait <job_id>` (or `higgsfield generate list` for batches). Output MP4 lands at `runs/<slug>/assets/<scene-id>.mp4`.
