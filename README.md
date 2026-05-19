# Video Studio

A programmable video studio for [Claude Code](https://claude.com/claude-code). Describe a video in a markdown brief, and Claude composes it from AI-generated voice, music, imagery, and clips, then assembles a finished MP4 with [Remotion](https://www.remotion.dev/).

Built to be driven through conversation, not pipeline operation. You arrive with a fragment or a problem; Claude helps you shape it, walks each beat with you, then runs the render.

## What it produces

- 5-60 second hero / explainer / brand videos.
- 4K horizontal, 4K vertical, 1080p variants from the same scenes.json (see `docs/overview.md`).
- AI voiceover, AI music bed, AI clips, AI imagery, text overlays, all composited in Remotion.

## Stack

| Layer | Tool | Cost |
|---|---|---|
| Voice + Music | [ElevenLabs](https://elevenlabs.io/) | Paid plan |
| Image + Clip generation | [Higgsfield](https://higgsfield.ai/) via official CLI + skill | Plus plan $49/mo, 1000 credits |
| (Optional) Self-hosted FLUX, SadTalker | [Modal](https://modal.com/) | Free $30/mo credit |
| Render | [Remotion](https://www.remotion.dev/) 4.x | Free, local CPU |
| Audio leveling | FFmpeg 8.x | Free |
| Orchestration | TypeScript + tsx | Free |

## Quickstart

**Prereqs**

- macOS or Linux (Windows untested)
- Node.js 20+
- FFmpeg 8.x (`brew install ffmpeg`)
- A Claude Code subscription
- An [ElevenLabs](https://elevenlabs.io/) account with API key
- A [Higgsfield](https://higgsfield.ai/) account (Plus plan recommended)

**Setup**

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
# It will check your env, voices, brand defaults, and confirm the pipeline works.
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

1. **Generation phase** (cloud, parallel, ~1-5 min): ElevenLabs voice + music, Higgsfield image + clip jobs all fire in parallel.
2. **Render phase** (local, Remotion, ~2-12 min depending on resolution): Stitches the generated assets into the final MP4.

Output resolution does NOT affect generation time. A clip is the same cost whether the final is 4K or 1080p. **Render at 1080p while iterating, render at 4K when shipping** (`--resolution 4k|1080p` flag).

## Folder layout

```
briefs/             INBOX: drop <slug>.md briefs here
videos/             OUTBOX: <slug>.mp4 and variants land here
runs/<slug>/        per-render workspace (scenes.json, audio, assets, metadata)
templates/          Remotion compositions (hero-16x9 included)
assets-library/     per-brand identities, music, stock B-roll
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
