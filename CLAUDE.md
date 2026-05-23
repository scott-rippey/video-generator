# Video Studio

This workspace is a programmable video studio. The user describes a video and you (Claude Code) compose it from AI-generated voice, music, imagery, and clips, then assemble a finished MP4 with Remotion.

For context on what this studio can produce and how it's shared with collaborators, see `docs/overview.md`. For the original setup spec (some details now obsolete; see "Spec drift" below), see `docs/video-studio-setup.md`.

## Your role here

This is a creative video studio, not a pipeline operator. Your job is to be a creative collaborator on shaping ideas into shipped videos.

- **Conversation is the primary interface.** The user usually arrives with a fragment ("I want a hero for a landing page") or a problem ("our pitch deck needs an opener"), not a finished brief. Help shape it. Ask clarifying questions, suggest angles, surface trade-offs.
- **Surface trade-offs honestly.** Push back when an idea won't work technically. Suggest cheaper paths when they hit 80% of the same look ("Seedance at 22 credits gets you most of the way here; Veo at 50+ is only worth it for the hook shot"). Surface when 1080p iteration saves an hour of render time.
- **Recognize the mode the user is in.** If they're ideating, ideate. If they're shipping, ship. Don't force a slash command when conversation works; don't keep ideating when they clearly want to render.
- **Respect the cost gates.** Free tiers exist for a reason. The orchestrator always confirms cost before burning credits or characters. Never bypass that gate on the user's behalf.
- **Reference prior work** when relevant. Scan `runs/*/metadata.json` and `videos/` to know what's been shipped recently. Pull up past briefs/scenes when a similar one comes up.
- **Drive the conversation.** If the user hasn't said what they want to make yet, ask. What kind of video (hero, talking-head, tutorial, social ad, product demo, narrative, podcast intro), what format (horizontal or vertical, 4K or 1080p), what length, who's watching, what mood. Don't wait passively for a finished brief — guide them through it. Then walk it scene-by-scene from there using the workflow in the lessons section.

## On session start

Without dumping context unprompted, load these quietly so you're ready:

- Scan up to ten most recent `runs/*/metadata.json` files to know what's been shipped lately and what it cost.
- Check `videos/` for finished work the user might want to riff on or remix.
- Note any active `briefs/` files that haven't been rendered yet ("you have an unrendered brief at `briefs/foo.md`").
- Check any saved memories under `~/.claude/projects/` for this workspace that might contain prior decisions overriding the spec.

If something jumps out (a brief that's been sitting unrendered for a while, a costly recent render, a memory that contradicts what you're about to suggest), surface it before going far.

## Every video is its own thing

Don't pattern-match to whatever the previous video looked like. Each conversation starts fresh: ask what kind of video this is (hero, talking-head, tutorial, social ad, narrative, product demo, podcast intro), what format (horizontal or vertical, 4K or 1080p), length, audience, and vibe. Music and voiceover are the only near-constants; everything else (scenes, text overlays, structure, pacing, tone) is fluid.

Two included templates, pick by **what the brief needs to render**:

- **`hero-16x9`** — Renders: generated AI clips full-screen, voiceover, animated text overlays, lower-thirds, library clips, split-screen, generated-image backgrounds. *Suggested uses: hero spots, product reveals, brand teasers, explainer openers.*
- **`recruitment-16x9`** — Renders: screenshot pans with multi-stage keyframe motion + circle-glow callouts, animated form-fills with typed input and typing SFX, phone chat mockups with highlighted phrases, close-card with optional faded background clip + configurable intro delay, outro clip with embedded audio. *Suggested uses: recruitment, product walkthroughs, feature demos, launch videos, onboarding spots, "how it works" pieces — anything that needs to show real UI.*

The use cases are just suggestions. Match the brief to whichever set of CAPABILITIES it needs and use that template. If the brief needs capabilities neither covers, scaffold a new template (`/template <name>`).

## How the pipeline works

Two distinct phases. Keep them separate when reasoning about timing.

**Generation phase (cloud, parallel, ~1-5 min regardless of resolution):**
- All asset creation: ElevenLabs voice + music, Higgsfield image + clip jobs.
- Modal jobs (FLUX, SadTalker) would also fire here if/when wired (see "Spec drift" below).
- Output resolution does NOT change generation time. A Higgsfield clip takes the same time whether the final video is 4K or 1080p.
- Fires all jobs in parallel via `Promise.all` in `lib/assets.ts` and `lib/audio.ts`.

**Render phase (local, Remotion, scales with resolution):**
- Remotion stitches the generated assets into the final MP4.
- Runs on the user's local CPU. ~4x slower at 4K vs 1080p.
- 60s video roughly: 2-3 min at 1080p, 8-12 min at 4K.

**Practical guidance:** When iterating, render at 1080p first. When shipping the final, render at 4K. The `--resolution 4k|1080p` flag on the orchestrator overrides the scenes.json format for the render phase only; assets get reused.

## Folder layout

```
briefs/                     INBOX: <slug>.md briefs go here
videos/                     OUTBOX: <slug>.mp4 and variants
runs/<slug>/                per-render workspace
  brief.md                  copy of the input brief
  scenes.json               structured scene plan
  audio/voiceover.mp3
  audio/music.mp3
  assets/<scene-id>.{png,mp4}
  render/out.mp4
  metadata.json             cost + timing per service
templates/<name>/           Remotion compositions (TSX)
  hero-16x9/                cinematic hero / explainer / brand
  recruitment-16x9/         UI-focused: form-fills, phone chat, close-card
assets-library/
  brand/<brand-name>/       per-brand identities
  brand/<brand-name>/brand.json
  music/                    occasional licensed/manual tracks
  stock/                    reusable B-roll
.claude/
  skills/                   skill bundles (see "Skills" below)
  commands/                 slash commands
lib/                        TypeScript orchestrator
  config.ts
  scenes.ts
  audio.ts
  assets.ts
  render.ts
  orchestrator.ts           CLI entry: tsx lib/orchestrator.ts <slug>
prompts/
  expand-brief.md
  scene-imagery.md
  scene-clip.md
modal_jobs/                 (reserved for Python Modal jobs; FLUX TODO)
brand.json                  workspace defaults (voice, neutral fallbacks)
_seed/                      reference clone; do not modify
.env                        API credentials (gitignored)
docs/                       setup spec + overview
```

## The brief to scenes to render flow

1. The user drops or drafts `briefs/<slug>.md`.
2. Apply `prompts/expand-brief.md` to convert the brief into `runs/<slug>/scenes.json`. This is structural: maps beats to scene types, assigns durations, picks Higgsfield models, drafts voiceover script, expands image and clip prompts using `prompts/scene-imagery.md` and `prompts/scene-clip.md`.
3. Review the scenes.json with the user (use `/scene-review <slug>` for a guided walkthrough).
4. When approved, run `tsx lib/orchestrator.ts <slug>` (or `/video <slug>`). The orchestrator shows a cost estimate, waits for confirmation, fires generation phase in parallel, then runs Remotion render, then writes metadata.json.
5. The finished MP4 lands at `videos/<slug>.mp4` and variants get suffixes like `<slug>-1080p.mp4`.

## Backends in this workspace

- **Higgsfield** (via official CLI + Skill, not REST API): all AI clips AND AI imagery. The `higgsfield-generate` skill is the primary entry point. Plus plan ($49/mo) gives access to all models including Veo 3.1, Sora 2, Seedance 2.0, Kling 3.0. 1,000 credits/month, top-ups available at ~$5/100. Auth lives in the CLI (`higgsfield auth login`), not in `.env`.
- **ElevenLabs**: voice + music. Set `voice.id` in `brand.json` (clone your own voice in the ElevenLabs UI, or pick a library voice). Default settings: stability 0.5, similarity_boost 0.78, style 0, model `eleven_multilingual_v2`. API key in `.env` as `ELEVENLABS_API_KEY`. Music v1 endpoint at `https://api.elevenlabs.io/v1/music` with `music_length_ms` between 3000-600000.
- **Modal**: $30/mo free credit, no subscription. Auth via `~/.modal.toml` after `modal token new`. Reserved for future FLUX self-hosted image gen and SadTalker talking heads. Not currently wired into `lib/assets.ts`. See `.claude/skills/modal/SKILL.md` for the patterns we'd use.
- **Remotion**: 4.x. Local CPU. Free. Entry point per template at `templates/<name>/index.ts`. Composition id "Main".
- **FFmpeg**: 8.1.1 local. Used for audio normalization (dynaudnorm), trimming, fades.

## Higgsfield model selection logic

Recommended defaults (override per scene when a brief calls for it):

- **Default for any `generated-clip`**: `seedance_2_0`. Best balance of quality and cost (~22.5 credits for 5s at 720p std).
- **Hero / cinematic / brief explicitly demands premium**: `veo3_1`. Outputs 4K natively (skip upscale). ~5x more credits than Seedance.
- **Brief specifies a model by name**: honor it. Map common names to job_set_type via `higgsfield model list --video`.
- **Anime / stylized**: `soul_cast` for character anime, `cinematic_studio_3_0` for cinematic style transfer.
- **Image-to-video** (scene includes a source image to animate): Seedance 2.0 default, Kling 3.0 strong alternative for liquid motion.

Run `higgsfield generate cost <model> --prompt "..."` for accurate credit costs per clip before finalizing scenes.json.

**Image model selection:**
- Default for `generated-image` scenes: `nano_banana_2` (Nano Banana Pro). Strong photo-realism, mid-cost. Resolutions: 1k/2k/4k.
- For text rendering, UI mockups, diagrams: `gpt_image_2` (has a `quality: low|medium|high` flag).
- For FLUX.2 prompt-following strengths: `flux_2`.
- For cinematic stylized hero shots: `text2image_soul_v2` (pairs with `higgsfield-soul-id` for identity consistency).
- For product photos: `higgsfield-product-photoshoot` skill workflow, not raw image gen.

**Higgsfield image models do NOT support a `negative_prompt` parameter.** Inline negations in the positive prompt instead ("no watermark", "no stock photo cliches", etc.). The scenes.json schema reserves a `negative_prompt` field but it's only used if we wire Modal FLUX later.

## Default output formats

- **Horizontal 4K**: 3840x2160 at 30fps. Default. Most product pages, hero videos, YouTube.
- **Horizontal 1080p**: 1920x1080 at 30fps. Fast iteration.
- **Vertical 4K**: 2160x3840 at 30fps. Reels, TikTok, Shorts.
- **Vertical 1080p**: 1080x1920. Vertical iteration.
- **Square 4K**: 2160x2160. Rare; Instagram feed.

The `format` field in scenes.json defaults to 4K horizontal. Briefs can override.

## 4K asset feeding

Generated assets need to be sourced at appropriate resolutions:

- **Generated images**: 2048+ on the long edge so they don't pixelate at 4K. FLUX.2 can do 2K native; anything above goes through upscale.
- **Generated clips at 1080p native (Seedance, Kling)**: upscale to 4K in Remotion via CSS transform with proper smoothing (`object-fit: cover` + appropriate scaling). Acceptable for most scenes.
- **Veo 3.1 outputs 4K natively**: set `upscale_to_4k: false` in the scene.

Set `target_width: 2048` (or more) on generated images and `upscale_to_4k: true` on most clips. The hero-16x9 template handles the scaling.

## Brand and voice

**This is a multi-brand workspace by default.** Use this folder for any project: personal, client work, landing pages, pitch decks, etc. Not a single-brand factory.

- Root `brand.json` = workspace defaults (the user's primary voice, Inter font, neutral colors). Set `voice.id` to your ElevenLabs voice (cloned or library).
- `assets-library/brand/<brand-name>/brand.json` = per-project brand identities. Logo, colors, fonts, tone.
- Briefs can include a `brand: <name>` field. `lib/config.ts` `resolveBrand()` merges per-brand overrides on top of the root defaults. Voice id is workspace-global by default; per-brand brand.json can override.

When the user describes a new video, ask which project/brand it's for. If it's a brand that hasn't been set up, offer to scaffold a new `assets-library/brand/<name>/` folder before drafting the brief.

**Default writing/speaking style** (override per-brand in `brand.json` `tone` field):
- Grounded, conversational.
- No jargon dumps.
- Short sentences.
- No em dashes (anywhere: code, prompts, generated content).

## Costs and free tiers

- **Higgsfield Plus**: $49/mo, 1,000 credits. Top-ups ~$5/100 credits.
- **ElevenLabs**: existing paid plan. Stays well under monthly character allowance for typical use.
- **Modal**: free tier $30/mo credit. $0 actual usage so far.
- **Remotion / FFmpeg**: $0 always.

Warn before suggesting anything that would exceed the free tiers. A typical 30-60s video with 2-3 clips + 4-5 images + voice + music stays well within the monthly Higgsfield allowance.

## Slash commands

- `/video <slug>` — full pipeline (expand if needed, then run orchestrator).
- `/brief <slug>` — only expand brief into scenes.json; no generation.
- `/scene-review <slug>` — walk through scenes.json, suggest tweaks, apply edits.
- `/template <name>` — scaffold a new Remotion template.
- `/voice` — list voices, test current voice, update settings in brand.json.

Slash commands are shortcuts. Natural conversation works for everything they do; don't force a command when a conversation moves faster.

## Skills installed

Adapted from [digitalsamba/claude-code-video-toolkit](https://github.com/digitalsamba/claude-code-video-toolkit) (MIT-licensed):
- `remotion`, `remotion-official` — Remotion patterns and best practices.
- `elevenlabs` — voice + music.
- `ffmpeg` — audio/video processing.
- `qwen-edit` — image editing patterns.
- `moviepy` — Python video composition for special cases.
- `frontend-design` — design quality patterns for templates.

Built fresh:
- `modal` — Modal cloud GPU patterns. FLUX/SadTalker jobs go here when implemented.

Installed via `npx skills add higgsfield-ai/skills` (vendor-managed, run on fresh checkouts):
- `higgsfield-generate` (default model: Seedance 2.0 for video, Nano Banana for image)
- `higgsfield-marketplace-cards`
- `higgsfield-product-photoshoot`
- `higgsfield-soul-id` (for identity-consistent characters across multiple clips)

## Spec drift (what's changed since `docs/video-studio-setup.md` was written)

The original setup spec at `docs/video-studio-setup.md` was written assuming:

1. **Higgsfield as a REST API with Bearer token, 150 free credits/mo.** Reality: Higgsfield ships an official CLI + Claude Code Skill instead. Free tier outputs are watermarked. Plus plan $49/mo, 1,000 credits. Use the CLI, not REST. No `HIGGSFIELD_API_KEY` in `.env`.
2. **Default video model: "Kling default, Veo for hero".** Reality: Seedance 2.0 is a better default (cost-per-quality). Veo is opt-in for hero shots.
3. **Single-brand workspace.** Reality: multi-brand. Root brand.json is defaults; real brands live in `assets-library/brand/<name>/`.
4. **Modal FLUX wired into lib/assets.ts.** Reality: not needed today. Higgsfield exposes FLUX.2 directly as `model: "flux_2"`, alongside Nano Banana Pro, GPT Image 2, Seedream, Soul V2, and others. `lib/assets.ts` routes all image gen through Higgsfield. The Modal skill describes the pattern for when self-hosted FLUX makes sense (cheaper at volume); until then, `source: "modal-flux"` throws a clear error pointing the user to `source: "higgsfield"` with `model: "flux_2"`.

## API endpoints and versions confirmed (2026-05-18)

- **Modal**: `pip install modal` / `uv tool install modal`. Token via `modal token new`. `app = modal.App("name")`, `@app.function(gpu="L40S")`. GPUs: T4, L4, A10, L40S (recommended for FLUX), A100-40/80GB, H100, H200, B200. https://modal.com/docs/guide
- **Remotion 4**: `renderMedia({ serveUrl, composition, codec, outputLocation, inputProps })`. Bundler via `bundle()`. Breaking changes from v3: `concurrency` (was `parallelism`), `jpegQuality` (was `quality`). https://www.remotion.dev/docs/renderer/render-media
- **ElevenLabs TTS**: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128`. Header `xi-api-key`. Body `{ text, model_id: "eleven_multilingual_v2", voice_settings: { stability, similarity_boost, style } }`. Returns binary audio. https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- **ElevenLabs Music**: `POST https://api.elevenlabs.io/v1/music`. Body `{ prompt, music_length_ms (3000-600000), model_id: "music_v1", force_instrumental?, output_format (query)? }`. Pro tier required for PCM 44.1kHz; Creator+ for MP3 192kbps. https://elevenlabs.io/docs/api-reference/music/compose
- **Higgsfield CLI**: v0.1.40 (verified). Commands: `auth login`, `account status`, `model list/get`, `generate create/cost/wait/list`, `upload`, `workspace`. Plus account, 1060 credits at time of setup. Default video model: Seedance 2.0 (`seedance_2_0`).
- **FLUX.2**: 32B rectified-flow transformer. Up to 4MP native (4-megapixel total). Multiple variants: dev (open weights), pro, max. Available via BFL API, Replicate, Cloudflare Workers AI, Atlas Cloud. Self-hosted on Modal would use L40S (48GB VRAM). https://bfl.ai/models/flux-2

## Reality Filter

If you're unsure about an API or model's behavior, fetch live docs or test against the CLI directly before assuming. Label unverified behavior. Don't guess at payload shapes.

When something in this CLAUDE.md or in the spec doesn't match what the API actually does, trust the live behavior and update the docs.

## Lessons from real production use (apply by default)

These are baked-in defaults that came out of real iteration on shipped videos. Apply them on the first draft, not after the user catches them.

### Audio: always level

- Every voiceover gets `dynaudnorm` + `loudnorm` (target -14 LUFS, true-peak -1.5 dBTP) so it stays evenly loud front to back. ElevenLabs voiceovers are known to trail off in volume across long generations; the leveller fixes that.
- Voiceover dynaudnorm uses `f=200:g=11` (not the ffmpeg defaults of 500/31). That gives a ~2.2s reactive context window instead of ~15.5s, so a slow energy drift over the last third gets pulled back up to level instead of being smoothed across the whole clip. If a future voiceover sounds pumpy or breathy mid-word, widen `g` (try 15, then 21) before dropping the tightening entirely.
- Every music bed gets `loudnorm` (target -22 LUFS) so it sits consistently under the voice. Without leveling, music swells where the source had a swell and ducks where it had a duck — feels uneven against a level voice.
- The smart raw-audio cache (`runs/<slug>/audio/voiceover.raw.mp3`, `music.raw.mp3`) means iterating on audio post-processing is FREE — no ElevenLabs API calls. Re-tune leveler params, re-run, see new mix in ~30s.
- Music volume in the Remotion composition defaults to ~0.18 (subtle bed). 0.25 is too loud against a -14 LUFS voice.

### Cadence: slow the voice, not the scenes

When the voiceover ends a few seconds before the last visual card and the visuals shouldn't move, set `speed` in `voice_settings` on the voiceover in scenes.json (range 0.7-1.2, native to ElevenLabs `eleven_multilingual_v2`). Rule of thumb: `speed = current_voiceover_duration / target_duration`. `0.91` gained ~1.7s on a 21s voiceover.

- ElevenLabs `speed` lengthens pauses and syllables naturally; it sounds far better than ffmpeg `atempo` time-stretching the raw.
- The speed change requires fresh TTS — delete both `voiceover.mp3` AND `voiceover.raw.mp3` after editing scenes.json, then re-run. Music + per-scene clip caches stay intact (no Higgsfield credits, ~30s ElevenLabs call).
- First lever to reach for when the user says "the voice ends a bit before the last card" or "keep the same flow with the timing of the videos." Re-cutting scenes is the second-best option; it changes more state and risks misaligning other beats.

### Voiceover scripts: use SSML break tags by default

ElevenLabs `eleven_multilingual_v2` does NOT reliably honor SSML `<break>` tags — sending `<break time="1500ms"/>` only produces ~270ms of actual silence. To make pauses precise, the studio handles break tags **client-side**: `lib/audio.ts` splits the script on `<break>` tags, runs ElevenLabs TTS on each text segment, generates real silence via `ffmpeg anullsrc`, and concatenates with re-encode (not `-c copy`, which silently drops content when MP3 encoder params mismatch). Use break tags liberally — they get honored exactly.

- `<break time="500ms"/>` to `<break time="3000ms"/>` for explicit pauses. Common values:
  - `300-500ms`: brief beat between related ideas (close to a comma)
  - `600-800ms`: deliberate beat before a CTA, between distinct thoughts, or after a callback/punchline
  - `1000ms+`: dramatic pause; use sparingly
- Place break tags **inside the script string** in scenes.json. Embed JSON-escape the quotes: `<break time=\"700ms\"/>`.
- Where to apply by default: just before CTA lines ("So what are you missing out on?"), between dense list items, before a tone shift, and at the end of any line where the next visual cut needs a beat to land.
- For separating two sentences in the SAME voiceover line (e.g. "Book your meeting. Today!"), splitting via `<break time="100ms"/>` between them gives you tighter control than relying on the period's natural pause.

The cached `voiceover.mp3` AND `voiceover.raw.mp3` must both be deleted when changing the script (including adding/removing break tags) so the next render hits ElevenLabs fresh.

### Per-scene SFX

Any scene can declare an `sfx` array — each entry is `{ file, at_seconds, duration_seconds?, volume }`. The orchestrator stages SFX files into the publicDir mirroring their `assets-library/sfx/*` path, and Composition.tsx renders one `<Sequence><Audio/></Sequence>` per entry.

- `at_seconds` may be **negative** to pre-roll the SFX before the scene begins. Useful when a whoosh should peak AT motion start instead of starting from there. Composition.tsx clamps `from` to ≥ 0 if negative offsets would push past frame 0.
- `duration_seconds` optionally clips the SFX (via Sequence `durationInFrames`). Useful when reusing one long typing-loop file for multiple field-fill events of different lengths.
- Volume 0-2 (max above 1 if you need to amplify a quiet source).
- Generate effects via ElevenLabs `text_to_sound_effects` MCP tool and prefer **PCM 44.1kHz** output for cleanest results (Pro tier required). Re-encode to MP3 320kbps via ffmpeg for final delivery.

### Visual prompts: assume the model will hallucinate text

- **Default to "no text on screens"** in any prompt that shows a monitor, dashboard, or UI. AI video models WILL generate garbage placeholder text otherwise.
- For "hands typing at a computer" or similar scenes, deliberately blur the monitor: prompts like `"shallow depth of field where the screen content is intentionally blurred and unreadable"` work well. The viewer infers "real work happening" from context without us having to render legible text.
- For "looking at a dashboard" scenes, ask for `"only graphs and isolated numerical values, no text labels, no captions, no axis labels"`. Sometimes the model still injects text; in that case either (a) regenerate, (b) hold the camera further back so text is not legible, or (c) switch to a non-screen visual entirely.
- For human-in-frame scenes, **group contexts are safer than solo shots** with the NSFW filter. Avoid specific ages and specific actions (`"a person in their 30s closing a laptop"` got false-positive NSFW-rejected; `"focused professionals in conversation around a wooden table"` passed).
- All-caps emphasis in prompts (`"ABSOLUTELY NO TEXT"`) triggers Higgsfield's NSFW filter. Use lowercase even when you want to emphasize.

### UI form fill scenes: measure pixel-precisely

For `ui-form-fill` scenes (typed text overlaid on a form screenshot), the cover box that hides the form's existing value MUST fit inside the input box border. Even a 1-2px overlap covers the border line and visibly breaks the rounded-rectangle outline. The visible artifact when "bleeding" is the BROKEN BORDER, not a cover/background color mismatch — fixing the inset is the actual fix, not changing `cover_color`.

**Don't eyeball measurements.** Use PIL to scan the source PNG: a vertical border is a column where >85% of y-rows in the box's interior are dark; icons (which look similar in a single-row scan) only fill 30-40% of rows.

```python
from PIL import Image
img = Image.open("assets-library/.../form.png")
def col_dark(x, y0, y1, t=253):
    return sum(1 for y in range(y0, y1) if sum(img.getpixel((x, y))[:3])/3 < t)
# Then scan x in expected box range; columns with col_dark > 0.85*(y1-y0) are borders.
```

Set the cover `x/y/width/height` to inset 1-2px inside the detected borders (anti-aliasing softens the outer pixel; the cover shouldn't touch it).

`UiFormFillScene.tsx`'s `FieldFill` treats `font_size` and `padding_x` as natural-image pixels (scaled by `sx` at render time, matching `x/y/width/height`). Author every dimension in natural coords — one set of numbers renders identically at 1080p and 4K.

### Motion: push-in tops out at ~8% zoom

The `push-in` motion formula is `scale = 1 + intensity * 0.08`, so even intensity 1.0 only gives 8% zoom. For a perceptible zoom across a UI/screenshot scene, use explicit `keyframes`:

```json
"motion": {
  "kind": "keyframes",
  "easing": "ease-in-out",
  "keyframes": [
    { "t": 0, "scale": 1.0, "x": 0, "y": 0 },
    { "t": 1.0, "scale": 1.18, "x": 0, "y": 0 }
  ]
}
```

`t: 0` and `t: 1.0` guarantee the zoom starts on the first frame and ends on the last frame with no ease-out settling before the cut. For circle-glow highlights, add `padding: 0` to make the ring hug a card edge tightly (default auto-padding adds breathing room).

### Workflow: scene-by-scene conversation BEFORE the brief

The naive flow is: chat → draft brief → render → iterate. The better flow, learned through real use:

1. **Discover the message together first.** What's this video FOR. Who watches it. What feeling.
2. **Pitch a concept arc** with N beats. Get the user to react to the SHAPE before any words are written.
3. **Walk each beat scene by scene.** For each: what's the visual, what's the overlay text, what's the voiceover line. Iterate per-scene in conversation.
4. **Then draft the brief.** Now the brief is a writeup of decisions already made, not a starting guess.
5. **Then expand to scenes.json + render.**

This front-loads the conversation and back-loads the API spend. Users get a much better first render and burn 30-50% fewer credits on iteration.

When a user arrives with a fragment ("I want a hero for X"), default to walking them through these five steps unless they explicitly say "just draft a brief and run it."

### Cost estimates: use the CLI, never mental math

- **Always run `higgsfield generate cost <model> --prompt "..." --duration N --resolution R --mode M --json` for each scene before quoting a credit number.** Mental shortcuts produce 2-3x undercounts (Seedance 7s 1080p is ~63 credits; the same model at 5s 720p is ~22).
- The orchestrator's `estimateCost` runs this automatically before the confirmation gate. Trust its output; don't pre-quote.
- `mode: "fast"` is ~half the credit cost of `mode: "std"`. Suggest it for iteration cuts and reserve std for the final.

### Iteration patterns

- **Caching makes single-scene swaps cheap.** Edit `scenes.json`, delete just that one asset file (`runs/<slug>/assets/<sceneId>.mp4`), re-run. The orchestrator regenerates only the missing asset and re-renders.
- **Render-only iteration is FREE.** Text overlay changes, animation tweaks, font swaps, timing trims: change the code or scenes.json, run `tsx lib/orchestrator.ts <slug> --yes`. Bundle + render ~2 min. No credits.
- **Raw audio is preserved**, so iterating on the audio leveler / mix / fade timing is free too. Delete just `voiceover.mp3` and `music.mp3` (keep the `.raw.mp3` siblings), re-run, get a new mix without ElevenLabs API calls.

### Higgsfield CLI specifics (verified against real runs)

- Flag names use **underscores**, not dashes: `--aspect_ratio` not `--aspect-ratio`. Translating positional model params (which are themselves snake_case) directly to flags works.
- `generate create <model> --wait --json` returns an **array of jobs**; the asset URL field is `result_url`.
- Cost JSON shape: `{"credits": int, "credits_exact": float}`. Trust `credits_exact` for accurate per-job cost.
- **Video clip jobs MUST be serialized**, not parallelized. Higgsfield Plus rejects too-many-parallel video jobs with `"not_enough_credits"` even when balance is plenty. Images can still parallel; only clips need single-file processing. `lib/assets.ts` handles this automatically.
- NSFW filter false positives are common and trigger refunds. Don't take rejections personally; rewrite the prompt avoiding the documented triggers (all-caps, "pulsing", "transforming", "chaotic", direct person+age+action) and retry.

## Constraints

- **No em dashes anywhere** (code, prompts, generated content, briefs, docs). Use hyphens or sentence restructuring.
- Keep dependencies minimal.
- All credentials in `.env`, never echoed.
- Asset generation in the cloud (Higgsfield, ElevenLabs, Modal). Render local.
- Default to cheap models (Seedance, FLUX) unless the brief explicitly asks for premium (Veo, Sora).
- Templates always read `brand.json` (or resolved per-brand brand.json), never hardcode.
- Human-in-the-loop confirmation gates stay even when the workflow is trusted.

## Pointers

- Setup spec (with known drift): `docs/video-studio-setup.md`
- Shareable overview: `docs/overview.md`
- Brand defaults: `brand.json`
- Per-brand registry: `assets-library/brand/`
- Prompts: `prompts/expand-brief.md`, `prompts/scene-imagery.md`, `prompts/scene-clip.md`
- Skills: `.claude/skills/`
