# Video Studio

A programmable video studio for [Claude Code](https://claude.com/claude-code). Describe a video in a markdown brief, and Claude composes it from AI-generated voice, music, imagery, and clips, then assembles a finished MP4 with [Remotion](https://www.remotion.dev/).

Built to be driven through conversation, not pipeline operation. You arrive with a fragment or a problem; Claude helps you shape it, walks each beat with you, then runs the render.

## What it produces

- 5-60 second hero / explainer / brand / UI-walkthrough videos.
- 4K horizontal, 4K vertical, 1080p variants from the same scenes.json.
- AI voiceover (with reliable client-side `<break>` tag pauses), AI music bed, AI clips, AI imagery, animated UI overlays, per-scene sound effects, all composited in Remotion.

## Stack

| Layer | Tool | Cost |
|---|---|---|
| Voice + Music + SFX | [ElevenLabs](https://elevenlabs.io/) | Paid plan |
| Image + Clip generation | [Higgsfield](https://higgsfield.ai/) via official CLI + skill | Plus plan $49/mo, 1000 credits |
| (Optional) Self-hosted FLUX, SadTalker | [Modal](https://modal.com/) | Free $30/mo credit |
| Render | [Remotion](https://www.remotion.dev/) 4.x | Free, local CPU |
| Audio leveling | FFmpeg 8.x | Free |
| Word-level VO transcription | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) (`whisper-cli`) | Free, local |
| Pixel-precise UI measurement | Python + [Pillow](https://pillow.readthedocs.io/) | Free, local |
| Orchestration | TypeScript + tsx | Free |

## Quickstart

**Prereqs**

- macOS or Linux (Windows untested)
- Node.js 20+
- A Claude Code subscription
- An [ElevenLabs](https://elevenlabs.io/) account with API key
- A [Higgsfield](https://higgsfield.ai/) account (Plus plan recommended)

> **Note**: FFmpeg, whisper.cpp, and Python (with Pillow for pixel-precise UI measurement) are used internally by the pipeline. Claude Code will check for them on first run and install via Homebrew / pip if missing. You don't have to set them up by hand.

**Setup**

> **Easiest path: just open the repo in Claude Code and say *"finish the setup."*** Claude will walk through each step interactively — clone tools via Homebrew, install JS deps, install the Higgsfield skills, prompt you for ElevenLabs / Higgsfield credentials, and verify the pipeline works. The manual commands below are the same steps if you'd rather run them yourself.

```bash
# 1. Clone
git clone https://github.com/scott-rippey/video-generator.git
cd video-generator

# 2. Install JS deps
npm install

# 3. Install the Higgsfield Claude Code skills
npx skills add higgsfield-ai/skills

# 4. Authenticate Higgsfield CLI
npx higgsfield auth login

# 5. Copy and fill in API keys
cp .env.example .env
# Edit .env: set ELEVENLABS_API_KEY
# (Modal and Higgsfield REST keys are NOT used; the Higgsfield CLI handles auth on its own)

# 6. Open in Claude Code
claude

# 7. Inside Claude Code, walk through the setup spec
# Tell Claude: "Read docs/video-studio-setup.md and finish any pending setup."
# It will check your env, voices, brand defaults, install any missing local tools
# (FFmpeg / whisper.cpp / Python+Pillow), and confirm the pipeline works.
```

**First render**

Inside Claude Code:

```
/video 000-smoke-test
```

This runs the included smoke-test brief end to end (~$0.10 of credits) and lands an MP4 in `videos/`.

**Your first real video**

Either drop a brief in `briefs/<slug>.md` or just describe one to Claude:

> "I want a 30-second hero video for my landing page. Confident, modern, no jargon. Show focused work, then the tagline 'Power Your Process.'"

Claude will walk you through concept → beats → scene-by-scene voice/visuals → brief → render. See the **"Workflow: scene-by-scene conversation BEFORE the brief"** section of `CLAUDE.md` for the recommended flow.

## How it works

Two distinct phases:

1. **Generation phase** (cloud, parallel, ~1-5 min): ElevenLabs voice + music + SFX, Higgsfield image + clip jobs all fire in parallel.
2. **Render phase** (local, Remotion, ~2-12 min depending on resolution): Stitches the generated assets into the final MP4.

Output resolution does NOT affect generation time. A clip is the same cost whether the final is 4K or 1080p. **Render at 1080p while iterating, render at 4K when shipping** (`--resolution 4k|1080p` flag).

## Templates included

- **`hero-16x9`** — Ships with: generated AI clips full-screen, voiceover, animated text overlays, lower-thirds, library clips, split-screen, generated-image backgrounds. *Suggested uses: hero spots, product reveals, brand teasers, explainer openers.*
- **`recruitment-16x9`** — Ships with these scene types: screenshot pans with multi-stage motion + circle-glow callouts, animated form-fills with typed input + typing SFX, phone chat mockups with highlighted phrases, close-card CTA with optional faded background clip + intro delay, and an `outro-clip` scene type that plays a user-supplied library video with its own audio (optional). *Suggested uses: any video that needs to show real UI — recruitment, product walkthroughs, feature demos, launch videos, onboarding spots, "how it works" pieces.*

Both are extensible. The capabilities above are each template's **innate / out-of-the-box** scene types — you can always add new scene types, primitives, or motion effects to either one as a brief evolves. The "suggested uses" are downstream of what each ships with; if your brief overlaps either capability set, that template is a fine starting point regardless of category. Scaffold a brand-new template via `/template <name>` only when neither's built-in scene set is a good base to extend.

## Folder layout

```
briefs/             INBOX: drop <slug>.md briefs here
videos/             OUTBOX: <slug>.mp4 and variants land here
runs/<slug>/        per-render workspace (scenes.json, audio, assets, metadata)
templates/          Remotion compositions
  hero-16x9/        cinematic hero / explainer / brand
  recruitment-16x9/ UI-focused: form-fills, phone chat, close-card
assets-library/     per-brand identities, music, stock B-roll, sfx
  brand/<name>/     per-project brand
  sfx/              shared sound effects (whoosh, typing, etc.)
.claude/            slash commands + skills
lib/                TypeScript orchestrator (config, scenes, audio, assets, render)
prompts/            brief → scenes.json expansion prompts
docs/               setup spec + architecture overview
CLAUDE.md           Claude Code project instructions (read first)
brand.json          workspace default brand (voice, fonts, colors)
.env                API keys (gitignored, copy from .env.example)
```

## Slash commands

- `/video <slug>` — full pipeline: expand brief if needed, generate assets, render.
- `/brief <slug>` — expand a brief into scenes.json only, no generation.
- `/scene-review <slug>` — walk through a scenes.json, suggest tweaks, apply edits.
- `/template <name>` — scaffold a new Remotion template.
- `/voice` — list voices, test current voice, update settings in brand.json.

Slash commands are shortcuts. Natural conversation works for everything; don't force a command when a conversation moves faster.

## Multi-brand

The workspace is multi-brand by default. `brand.json` at the root is the workspace fallback (your default voice, fonts, neutral colors). Real per-project brands live in `assets-library/brand/<name>/brand.json` and merge over the defaults. Briefs include a `brand: <name>` field to pick.

## Cost gates

The orchestrator runs `higgsfield generate cost` for each scene and shows a real credit estimate before burning anything. It waits for human confirmation. Don't bypass this gate — mental shortcuts undercount by 2-3x.

A typical 30-60s video with 2-3 clips + 4-5 images + voice + music stays well within the monthly Higgsfield Plus allowance (1000 credits).

## Conventions

- **No em dashes** anywhere (code, prompts, briefs, generated content). Use hyphens or restructured sentences.
- **All credentials in `.env`**, never echoed in logs or commits.
- **Asset generation in the cloud**, render local.
- **Cheap models by default** (Seedance 2.0 for clips, Nano Banana 2 for images). Premium models (Veo 3.1, Sora 2) are opt-in per scene.
- **Human-in-the-loop confirmation gates stay** even when the workflow is trusted.
- **Templates always read `brand.json`** (or the resolved per-brand brand.json). Never hardcode colors, fonts, or voice IDs in Remotion components.

See `CLAUDE.md` for full project instructions and lessons-learned that Claude reads on every session.

## Credits

The skills layer started as a fork of [digitalsamba/claude-code-video-toolkit](https://github.com/digitalsamba/claude-code-video-toolkit) and was adapted heavily: Higgsfield replaces the seed's RunPod-driven clip generation, ElevenLabs Music replaces ACEStep, and a custom TypeScript orchestrator was built on top.

## License

[MIT](LICENSE) © 2026 Scott Rippey

---

## Versions

### v2 — 2026-05-23

**New templates**
- `recruitment-16x9` — UI-focused brand video template with five new scene types: `ui-static-reveal` (screenshot pan + zoom + circle-glow highlights), `ui-form-fill` (animated typing into form fields with typing SFX), `phone-mockup-chat` (animated chat thread with highlighted phrases), `close-card` (CTA with optional faded background clip), `outro-clip` (library video with embedded audio).

**Voiceover / audio**
- Client-side `<break time="Nms"/>` tag handling. `eleven_multilingual_v2` ignores SSML breaks (gives ~270ms regardless of value), so the studio now splits the script on break tags, TTSs each text segment, generates real silence via `ffmpeg anullsrc`, and concatenates with re-encode. Break times are honored exactly.
- Voiceover concat fixed (`libmp3lame` re-encode instead of `-c copy`) to prevent silently-dropped content when MP3 encoder params differ between segments.

**Per-scene SFX**
- New `sfx` field on every scene: `{ file, at_seconds, duration_seconds?, volume }`. Files staged into publicDir mirroring their `assets-library/sfx/*` path. Composition renders a Sequence per entry.
- `at_seconds` may be **negative** for pre-roll (so a whoosh's transient lands AT motion start, not after it).
- `duration_seconds` clips the SFX via `durationInFrames` — useful for reusing one typing-loop file across multiple field-fill events of different durations.

**Close-card improvements**
- `intro_delay_seconds`: delay before title/details animate in (lets the background settle).
- `background_clip_fade_out_seconds`: fade the reused-clip background's opacity to 0 over the last N seconds. Eliminates the frozen-last-frame artifact when the clip is shorter than the scene.

**UI form fill scenes**
- `FieldFill` now treats `font_size` and `padding_x` as natural-image pixels (scaled by `sx` at render time, matching `x/y/width/height`). One set of coords renders identically at 1080p and 4K.
- Pixel-precise PIL workflow documented in CLAUDE.md for measuring input box borders before authoring covers.

**Circle-glow highlights**
- New `padding` field on highlights — set to `0` to make the ring sit tight against a card edge (default auto-padding adds breathing room).

**Orchestrator**
- `.complete` marker bug fixed. Marker existence alone no longer skips regeneration — now validates that all cached asset files actually exist on disk. Deleting a single asset MP4 to iterate on one scene now works as documented.

**Documentation**
- New CLAUDE.md lessons: "Voiceover scripts: use SSML break tags by default", "Per-scene SFX", "UI form fill scenes: measure pixel-precisely", "Motion: push-in tops out at ~8% zoom".

### v1 — 2026-05-18

- Initial Video Studio release.
- `hero-16x9` template with 6 scene-type components (text-overlay, fullscreen-clip, lower-third, library-clip, split-screen, generated-image-bg).
- Higgsfield CLI + skill integration (Seedance 2.0 default).
- ElevenLabs voiceover + music with loudnorm/dynaudnorm leveling.
- TypeScript orchestrator with cost-gating, per-scene asset caching, audio raw-cache for free post-processing iteration.
- Five slash commands: `/video`, `/brief`, `/scene-review`, `/template`, `/voice`.
