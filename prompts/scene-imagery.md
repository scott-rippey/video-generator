# Scene to Image Prompt

Apply this prompt when expanding a scene's short visual description into a finished image-generation prompt. The orchestrator runs this for every scene whose visual is `source: "higgsfield"` (the default) before invoking the `higgsfield generate create <model>` CLI.

## Default: assume the model will hallucinate text

Production experience: if a scene includes a screen, dashboard, UI, document, sign, or any surface that "should have text," the model will invent text. That text is almost always garbage placeholder. Two patterns work:

1. **Hide the text.** Blur the screen, hold camera far enough back that any text is illegible, or describe the surface in a way that doesn't require text ("an abstract data visualization", "only graphs and isolated numerical values, no text labels").
2. **Replace the text moment with a non-text visual.** Often the BETTER choice. Instead of "dashboard with metrics", describe "a calm professional gazing thoughtfully out a window after a productive morning." The "Better Results" beat is the same either way; the second prompt has no text-hallucination risk.

When the user wants a tech/office scene specifically, default to the blur-or-hide pattern unless they explicitly want a legible UI.

## Inputs

- The scene definition from scenes.json (type, text, intent).
- The resolved brand (root `brand.json` merged with `assets-library/brand/<name>/brand.json` if the brief named a brand).
- The video's overall tone and purpose from the brief.
- The target output size (`target_width`, typically 2048 or 3840; the orchestrator maps this to Higgsfield's 1k/2k/4k tier).

## Output

A single prompt string written back into the scene's `background.prompt` (or wherever the image is referenced). The Higgsfield image models (Nano Banana Pro, GPT Image 2, FLUX.2, Soul V2, etc.) do **not** accept a negative_prompt parameter, so all negation belongs inside the positive prompt (see "Negation inline" below).

Also set: `aspect_ratio` (string like "16:9", "9:16", "1:1"), `target_width` (the orchestrator maps to 1k/2k/4k), and `model` if you want something other than the default.

## The single rule that matters most

**Specific beats generic.** Generic prompts ("modern office", "professional", "abstract tech background") produce stock-AI mush that screams "AI made this". Specific prompts ("a focused founder at a walnut desk, single window light from camera left, MacBook open showing a clean analytics dashboard, light blue accent on screen, 35mm lens depth of field") produce images that look like real photographs or considered illustrations.

Always include at least three of: subject, environment, lens/framing, lighting, color palette, mood, time of day, materials, era.

## Available Higgsfield image models

(Verified 2026-05-18 via `higgsfield model list --image`.)

| job_set_type | What it's good for | Notes |
|--------------|--------------------|-------|
| `nano_banana_2` | **Default.** Nano Banana Pro. Strong photo-realism, fast, mid-cost. | Accepts `input_images` for reference work. 1k/2k/4k resolutions. |
| `flux_2` | FLUX.2 from Black Forest Labs via Higgsfield. Excellent prompt following. | Same workflow as nano_banana_2. |
| `gpt_image_2` | Best for text rendering, UI mockups, diagrams. | Has a `quality` flag (low/medium/high). |
| `text2image_soul_v2` | Stylized cinematic. Strong for hero visuals. | Pairs with `higgsfield-soul-id` for character consistency. |
| `cinematic_studio_2_5` | Cinematic style transfer. | When the brief wants a specific film look. |
| `seedream_v4_5` / `seedream_v5_lite` | ByteDance Seedream. Strong for product photo aesthetic. | Lite is cheaper. |
| `flux_kontext` | FLUX Kontext for edit/composition. | When you need to refine an existing image. |

For most scenes, leave the model unspecified (defaults to `nano_banana_2`). Only override when the scene genuinely needs a different model's strength.

## Anatomy of an image prompt

Order matters. Image models weight early tokens more heavily.

```
[primary subject with key attributes],
[secondary subjects or context],
[environment/setting with materials],
[lighting description],
[lens/camera/composition],
[color palette tied to brand],
[mood/atmosphere],
[style anchors: photoreal / illustration / graphic / cinematic],
[aspect ratio + resolution hints]
```

Example:

```
A focused professional sitting at a walnut desk in a bright modern home office,
laptop open showing a clean analytics dashboard with line charts trending up,
soft morning window light from camera left,
shallow depth of field at 50mm,
muted blue and warm beige palette tied to brand accent #3b82f6,
calm focused mood,
photoreal cinematic,
16:9 landscape composition, 4K ready
```

## Negation inline (since Higgsfield image models don't take negative_prompt)

Higgsfield image models accept only a positive `prompt`. To push away from common failure modes, embed negations directly in the prompt text. Use phrases like "no watermark", "no stock photo aesthetic", "no AI clichés", "no plastic skin", "no text artifacts".

**Baseline inline negations (good defaults to append):**
```
no watermark, no logo, no readable text, no stock photo cliches, no plastic skin, no AI artifact look
```

**Scene-specific additions:**
- Brand/lifestyle scenes: `no cheesy poses, no obvious business stock photography, no exaggerated smiles`
- Office/dashboard scenes: `no lorem ipsum, no fake brand logos, readable but generic UI text`
- Outdoor/cinematic: `no obvious CGI water, no plastic-looking foliage`
- Faces: `no morphed features, no asymmetric eyes, no extra fingers`

If a model variant (e.g., a future FLUX.2 self-hosted via Modal) does accept a negative_prompt, the scenes.json schema already has a `negative_prompt` field reserved for it. The Higgsfield CLI route just ignores it for now.

## Brand consistency

When the brief references a brand:
- Pull `colors.accent` and weave it into the prompt as a color hint: "blue accent color matching #3b82f6"
- Pull `fonts.primary` only if the image has text on it (rare; usually text goes on top in Remotion, not in the generated image)
- Pull `tone` and reflect it in mood adjectives (e.g., tone="grounded conversational" suggests warm natural light, real materials, no overproduced gloss)
- If the brand has a `references/` folder with mood-board images, mention them in the prompt as style anchors only when the image-edit (qwen-edit) flow can ingest them; otherwise rely on text description

## Aspect ratio and resolution mapping

Higgsfield image models accept these aspect_ratio values: `1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 9:16, 16:9, 21:9` (some models support a subset). And resolution tiers: `1k`, `2k`, `4k`.

| scenes.json format | aspect_ratio | resolution tier | target_width hint |
|--------------------|--------------|-----------------|-------------------|
| 3840x2160 (4K horizontal) | 16:9 | 4k | 3840 |
| 2160x3840 (vertical 4K) | 9:16 | 4k | 2160 |
| 2160x2160 (square 4K) | 1:1 | 4k | 2160 |
| 1920x1080 (1080p horizontal) | 16:9 | 2k | 2048 |
| 1080x1920 (vertical 1080p) | 9:16 | 2k | 2048 |

The orchestrator (`lib/assets.ts`) maps `target_width` to the right tier: <=1024 → 1k, <=2048 → 2k, >2048 → 4k. Set `target_width` to ~2048 for 1080p videos and >=3840 for 4K finals.

## Prompts for common scene types

**`text-overlay` background image:** the image is a backdrop, not the focal point. Keep it slightly out of focus, low contrast, with negative space where text will land. Example: "soft gradient texture, dark navy blue with subtle particle motes, cinematic, 16:9, no faces, no readable text, vignette".

**`generated-image-bg` with text on top:** similar to above but with intentional composition for text placement. Reserve the lower third or right third for text. Example: "wide product shot with main subject in the left third, right two thirds clean for text overlay, soft natural light, brand accent in foreground prop".

**`split-screen` regions:** each region gets its own prompt. Make sure both prompts cohere stylistically (same time of day, same color treatment) so the split doesn't feel like two different videos. Example pair: ("agent sleeping peacefully, warm low light, photoreal") + ("clean AI dashboard UI on dark background, blue accent matching the warmth of the bedroom light").

**Hero shot for `fullscreen-clip` when no clip is needed:** treat as a still establishing shot. Heavy on lens / composition / lighting language.

## When to escalate or switch models

- If a scene needs reliable text rendering (logos, exact words on signs, accurate UI text), Nano Banana still struggles. Switch to `gpt_image_2` with `quality: "high"`, or generate the image without text and overlay it in Remotion.
- If a scene needs photo-real human faces with high consistency across multiple scenes, use the `higgsfield-soul-id` skill to train a Soul ref first, then reference the soul_id in the prompt.
- If Nano Banana isn't producing what you want after 2 retries with prompt variations, switch to `flux_2` (often follows complex prompts better) or `text2image_soul_v2` (more cinematic).
- For product photos specifically, use `higgsfield-product-photoshoot` skill workflow, not raw image gen.

## Reproducibility

Higgsfield image jobs don't currently expose a seed parameter in the CLI, so reproducibility is limited to keeping the same prompt and same model. If the user says "remix this image", regenerate with the same prompt and accept the variation.

## Output to scenes.json

Replace the short prompt in the scene with the expanded version:

Before:
```json
{
  "type": "generated-image",
  "source": "higgsfield",
  "prompt": "agent dashboard mock filled with leads",
  "target_width": 3840
}
```

After:
```json
{
  "type": "generated-image",
  "source": "higgsfield",
  "model": "nano_banana_2",
  "prompt": "polished SaaS analytics dashboard mockup, line charts trending up with anonymized labels, modern flat design with depth, soft glow on key metrics, blue accent matching brand #3b82f6, dark navy background, 16:9 composition with breathing room on the right third for text overlay, photoreal UI screenshot quality, no lorem ipsum, no fake brand logos, no stock photo cliches, no watermark",
  "target_width": 3840,
  "aspect_ratio": "16:9"
}
```

The orchestrator translates `target_width: 3840` to `--resolution 4k` and passes `--prompt`, `--aspect-ratio`, and `--resolution` to `higgsfield generate create nano_banana_2 --wait --json`.
