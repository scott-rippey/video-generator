# Video Studio: Setup Spec

This file lives at `docs/setup.md` inside the video studio workspace. It is the specification for how to set up the workspace and the reference doc for how the workspace operates over time.

## How to use this file

When I open Claude Code in the workspace root and ask you to set up the studio, the flow is:

1. Read this entire file first.
2. Build a checklist from the "Interactive setup steps" section using your todo system. Show me the checklist before starting.
3. Walk through the checklist one step at a time. Ask me one thing at a time when you need input. Confirm each step before moving on. Do not dump multiple files at once.
4. After setup completes, this file remains as the authoritative reference. Future sessions should refer back to it when I'm working in this workspace and you need to understand how things fit together.

Important: this file lives in `docs/` but everything you create during setup goes in the workspace root, not inside `docs/`. The `docs/` folder is just for documentation. The actual working folders (`briefs/`, `videos/`, `runs/`, `templates/`, `lib/`, `.claude/`, etc.) all sit at the workspace root alongside `docs/`.

---

This is a programmable video studio where I describe what I want and the pipeline composes it from AI-generated voice, music, imagery, video clips, and Remotion compositions. I have Remotion experience already. What I want is the orchestration layer on top of it.

The point of this workspace is to **level up past hand-coding Remotion compositions** by adding:

- AI-generated imagery inline in scenes (FLUX.2 via Modal cloud GPU)
- AI-generated video clips (Higgsfield's aggregator gives access to Veo, Kling, Soul, Seedance, and others through one connection)
- AI-generated background music (ElevenLabs Music, same account I use for voice)
- Voiceover with my cloned voice (existing ElevenLabs account)
- Talking head from a still portrait + audio (SadTalker via Modal)
- Compositional pattern: brief → JSON scenes → Remotion render → MP4
- Multi-variant renders (one composition, N data inputs, N outputs)

I have Remotion experience already, so the base tech is familiar. What I want is the orchestration layer on top.

## Remotion's role in this workflow

Remotion is the centerpiece, not a side player. Everything else in this pipeline generates raw ingredients (an image here, a clip there, a voiceover track, a music bed). Remotion is what turns those ingredients into a finished video with motion, timing, transitions, typography, and brand styling.

Specifically, Remotion is:

- **The compositional engine.** Each template in `templates/` is a Remotion project with React/TSX components that define how scenes get laid out, how text animates in, how clips transition, how the music ducks under the voiceover.
- **The branding layer.** Templates read `brand.json` at render time so colors, fonts, and motion language stay consistent across every video without hardcoding.
- **The final renderer.** `lib/render.ts` invokes the Remotion CLI with the scenes.json and the asset paths, and Remotion produces the output MP4. This runs locally on my CPU (4K renders take noticeably longer than 1080p, plan accordingly).
- **The thing that makes assets cohere.** A raw Higgsfield clip on its own looks like AI slop. The same clip placed inside a Remotion composition with proper timing, branded lower-thirds, smooth transitions, and synced music sounds and feels like real content. That gap is where the value sits.

Practically: when the orchestrator finishes generating all assets, it hands scenes.json + the asset path map to Remotion, and Remotion does the assembly. Without Remotion this whole workspace is just a directory of disconnected files.

## How I actually use this workspace

This is meant to be conversational. When I open Claude Code in this folder, I usually don't come in with a finished brief. More often I arrive with a fragment ("I want a hero video for the AI Advantage landing page") or a problem ("our pitch deck section needs an opener") and I want to think out loud first.

Claude Code reads CLAUDE.md on session start, so it knows what tools are available, what the brand looks like, what costs what, and what work has shipped recently (it can scan `videos/` and `runs/*/metadata.json` to see prior projects). From there, the conversation drives everything.

A typical session might go:

1. I describe a rough idea or problem.
2. Claude Code asks clarifying questions or suggests angles, drawing on the toolset (which Higgsfield models would fit, whether AI imagery or library assets work better, what voice/music vibe matches the brand).
3. We iterate on the concept. Claude Code surfaces trade-offs honestly: "Veo 3 would look incredible here but eats 58 credits; Kling at half that gets you 80% of the way."
4. When I'm satisfied, Claude Code drafts a brief and writes it to `briefs/<slug>.md`.
5. I review. Edits happen as natural conversation, not document markup. Claude Code updates the file as we talk.
6. When I'm ready, I say "render it" or run `/video <slug>` explicitly. The pipeline runs (with cost confirmation gate before any credits burn).

Nothing generates without my explicit go-ahead. The conversation can run for as long as I want before anything hits an API. Even after I've okayed a brief, the pipeline still pauses at the cost-confirmation gate before kicking off Modal and Higgsfield jobs.

Slash commands exist (`/video`, `/brief`, `/scene-review`, etc.) for when I want a structured entry point. They're optional. Natural conversation with Claude Code is the primary interface, and the slash commands are shortcuts for parts of that flow.

What this means for the role of Claude Code in this workspace:

- **Creative collaborator, not vending machine.** Push back when an idea won't work technically. Suggest better angles. Reference past work I've shipped when relevant.
- **Surface trade-offs honestly.** Don't just do what I say; tell me when 1080p will save 80% of render time for a draft, or when a music track already in my library would fit better than a fresh ElevenLabs Music generation for a particular vibe.
- **Recognize the mode I'm in.** If I'm ideating, ideate with me. If I'm shipping, ship with me. Don't make me hit a slash command when conversation works, and don't keep ideating when I clearly want to render.
- **Respect the cost gates.** Free tiers exist for a reason. Warn me before I burn through Higgsfield credits on a Veo experiment that probably won't land.

## Output formats

Default to 4K. I'm mostly shipping horizontal widescreen content for product websites, app front pages, and YouTube. Occasionally I'll want vertical for social, but it's the exception. 1080p is available as an option when render speed matters more than visual ceiling.

**Default output (always assume this unless brief says otherwise):**
- **Horizontal 4K:** 3840 x 2160 at 30fps. 16:9 widescreen.

**Available alternates the brief can specify:**
- **Horizontal 1080p:** 1920 x 1080 at 30fps. 16:9. Use for fast iteration, draft previews, or content where 4K isn't justified.
- **Vertical 4K:** 2160 x 3840 at 30fps. 9:16 for Reels, TikTok, Shorts.
- **Vertical 1080p:** 1080 x 1920 at 30fps. 9:16 fast/draft variant.
- **Square 4K:** 2160 x 2160 at 30fps. 1:1. Rare.

## Generation vs render: two different timing concepts

This pipeline has two distinct phases and they scale differently. Keep them separate in my head:

**Generation phase (cloud, parallel):**
- All asset creation: Modal jobs for FLUX images, Higgsfield jobs for video clips, ElevenLabs for voice and music
- Runs entirely on cloud services, not my machine
- Parallelized: all assets generate simultaneously
- Typical total time: 1-5 minutes regardless of output resolution
- Output resolution does NOT change generation time. FLUX takes the same time whether the final video is 4K or 1080p, because it generates the source image at the same resolution either way.

**Render phase (local, Remotion):**
- Remotion stitches all the generated assets together into the final MP4
- Runs on my local CPU
- This is the ONLY phase that scales with output resolution
- 1080p render is roughly 4x faster than 4K render
- A 60s video might render in 2-3 minutes at 1080p vs 8-12 minutes at 4K

What this means in practice: if I'm iterating on a brief and just want to see the result fast, render at 1080p first. Once the brief is dialed in, re-render the final at 4K. The cloud generation cost is the same either way, so iteration is cheap.

The brief format defaults to 4K; only specify 1080p when I want speed over quality. Variants can re-render an existing scenes.json at a different resolution without re-generating assets.

## 4K considerations for asset generation

Even though generation time doesn't change with output resolution, the source asset quality does need to match. The pipeline handles this:

1. **Generated images (Modal FLUX):** request at 2048 minimum on the long edge so they don't pixelate when placed in 4K compositions. FLUX.2 can output 2K natively; anything more goes through an upscale step (qwen-edit skill or ffmpeg lanczos as a fallback).
2. **Generated video clips (Higgsfield):** most models top out at 1080p natively. The pipeline accepts the native resolution and upscales to 4K during the Remotion composition (CSS transform or ffmpeg pass before ingest, whichever is cleaner). 4K-native models like Veo 3 should be used directly when the brief calls for hero quality and skip the upscale.
3. **Asset duration budgeting:** higher resolution doesn't change clip duration limits. Higgsfield model limits (typically 5-10 seconds per clip) still apply. Long scenes still need to be assembled from multiple clips or stretched with motion effects in Remotion.

The scenes.json schema includes a `format` field that defaults to horizontal 4K. The brief can override per video.

## Seed repo, not a checkout

There is an existing open-source toolkit at `https://github.com/digitalsamba/claude-code-video-toolkit` (MIT licensed) that has most of the skills I want. **Do not use it directly.** Clone it once into `_seed/` as reference, then build my own clean workspace beside it, copying only the skills I need and adapting the ones I keep. I want this workspace to be mine, not a fork of someone else's opinions.

**Skip these from the seed:**
- Anything tied to playwright-recording unless I explicitly opt in during setup
- Any avatar-rendering integrations that aren't relevant to this AI-asset compositional workflow

**Copy and adapt these from the seed:**
- remotion skill
- elevenlabs skill (handles both voice and music)
- ffmpeg skill
- qwen-edit skill (image editing)
- moviepy skill (post-production edits)
- modal skill (cloud GPU orchestration for FLUX images and SadTalker)
- frontend-design skill (for designing Remotion scenes that don't look generic AI)

**Add a new skill not in the seed:**
- higgsfield skill (video clip generation via REST API, gives access to Veo, Kling, Soul, Seedance, etc.)

If the seed already includes Higgsfield references somewhere, those are fine to look at for ideas. Build the higgsfield skill fresh based on current Higgsfield REST API docs.

## Stack

- Node 22, TypeScript (Remotion's native stack)
- Python 3.11+ via uv (for Modal jobs and any moviepy work)
- Modal for cloud GPU (FLUX images, SadTalker talking heads)
- Higgsfield for cloud video clip generation (Veo, Kling, etc.)
- ElevenLabs for voice and music (cloud)
- Remotion for local final composition and rendering
- FFmpeg for local audio/video processing

## Accounts and pricing breakdown

My preference is to start every service on its free tier and only upgrade when I hit a real limit. Mark each service clearly during setup so I know exactly what I'm signing up for.

**Free, no account at all:**
- **Remotion** — open source, free for individuals and companies under $1M ARR (covers me). Just `npm install`. No API key, no signup.
- **FFmpeg** — open source, already installed locally. No account.

**Free account, API key for orchestration, $0/month if I stay within limits:**
- **Modal** — pay-as-you-go cloud GPU with $30/month in free credits. Realistic usage for this workspace lands at ~$1-2/month, well under the free credit. No monthly subscription required. Sign up at modal.com, install CLI with `pip install modal`, run `modal token new` to get credentials.
- **Higgsfield** — free tier gives 150 credits/month, enough for evaluation and modest production (a single Kling clip is ~7 credits, Veo 3 is ~58). REST API with Bearer token auth. No monthly subscription required if I stay under 150 credits. Upgrade only when I'm actually hitting the cap.

**Existing paid subscriptions I already have:**
- **ElevenLabs** — I'm already on a plan with my voice clone configured. The API key is what the pipeline uses. No new spending.

**What this means in practice for setup:**
- Three accounts to create or verify: Modal (new free), Higgsfield (new free), ElevenLabs (existing).
- Three API credentials to put in .env: `MODAL_TOKEN_ID` + `MODAL_TOKEN_SECRET`, `HIGGSFIELD_API_KEY`, `ELEVENLABS_API_KEY`.
- Zero new monthly subscriptions to start. I can run the entire pipeline on free tiers (plus my existing ElevenLabs plan) until I hit a real volume need.

If during setup any of these services have changed their free tier terms, surface it to me explicitly before I create the account. Reality Filter applies: don't assume pricing from training data.

## What actually costs money per video

Even on free tiers, asset generation has marginal cost (drawn from Modal credits or Higgsfield credits, both of which deplete the free pool). Rough per-video estimates:

- **ElevenLabs voiceover and music:** both consume character credits from my existing plan. My $99/mo Pro plan includes 500K characters/month, which covers normal voice + music usage many times over.
- **Modal image generation (FLUX):** ~$0.02 per image, drawn from $30/mo free credit.
- **Higgsfield video clips:** drawn from 150 free credits/month. Kling ~7 credits/clip, Veo 3 ~58 credits/clip. A 60s video with 3 Kling clips uses ~21 credits, leaving plenty of headroom. A video that uses Veo for everything will eat the free tier fast; reserve Veo for hero shots.
- **Remotion render:** $0. Runs locally, uses my CPU and electricity.

A typical 60s video with 4 FLUX images, 2 Kling clips, voice and music both via ElevenLabs stays well within the free tiers across the board. If I'm doing one or two videos a week, I should never see a bill beyond what I already pay for ElevenLabs.

## The mental model: inbox, workspace, outbox, library

- **`briefs/`** is the inbox. I drop a brief here as `<slug>.md` describing the video I want: purpose, length target, tone, hooks, scene ideas, music vibe, references.
- **`videos/`** is the outbox. Finished MP4s land here as `<slug>.mp4`. Variants get suffixes like `<slug>-square.mp4` or `<slug>-en.mp4`.
- **`runs/<slug>/`** is the per-render workspace. Holds the expanded scenes.json, generated audio, generated assets, render output, and metadata.
- **`templates/`** is reusable Remotion compositions (social-short, explainer-60s, product-demo, etc.). Each is a folder with its own components.
- **`assets-library/`** is reusable brand and content assets I curate manually: logos, fonts, motion graphics, stock footage, occasional licensed audio if a project needs it.

## What "interactive videos" means here

Not video games. I mean videos that are programmable, parameterized, and composable rather than hand-edited:

- **Data-driven renders:** feed in a CSV or JSON of clients/products/leads, output one personalized video per row.
- **Multi-variant:** one composition rendered with different voiceover languages, aspect ratios, brand themes.
- **Modular scenes:** a scene is a self-contained JSON object that any composition can include.
- **AI assets on demand:** scenes describe what image or clip they need, the pipeline generates it.
- **Branch points:** brief can specify alternate paths (different hooks, different CTAs) and the pipeline renders all of them.

## Folder layout to create

```
briefs/                        (INBOX: I drop video briefs here as <slug>.md)
videos/                        (OUTBOX: finished MP4s land here as <slug>.mp4)
runs/                          (workspace per render)
  <slug>/
    brief.md                   (copy of input brief for record)
    scenes.json                (expanded scene plan)
    audio/
      voiceover.mp3            (ElevenLabs)
      music.mp3                (ElevenLabs Music, or copied from library)
    assets/                    (generated images and clips per scene)
    render/                    (Remotion output, intermediate)
    metadata.json
templates/                     (reusable Remotion compositions)
  hero-16x9/                   (DEFAULT: 30-90s horizontal 4K for product pages, hero videos)
  explainer-16x9/              (60-90s horizontal 4K voiceover-driven, more text overlay)
  social-9x16/                 (15-60s vertical 4K for Reels and TikTok when needed)
  product-demo/                (screen recording overlay style, horizontal 4K)
  testimonial-card/            (data-driven, multi-variant)
assets-library/
  brand/
    logo.svg
    fonts/
    colors.json
  music/                       (optional manually-added tracks if a project needs them)
  stock/                       (reusable B-roll, transitions)
.claude/
  skills/
    remotion/SKILL.md
    elevenlabs/SKILL.md
    ffmpeg/SKILL.md
    qwen-edit/SKILL.md
    higgsfield/SKILL.md
    moviepy/SKILL.md
    modal/SKILL.md
    frontend-design/SKILL.md
  commands/
    video.md                   (the main one: brief to MP4)
    brief.md                   (expand a brief into scenes.json without rendering)
    scene-review.md            (review and tweak scenes.json)
    template.md                (scaffold a new template)
    voice.md                   (manage ElevenLabs voice settings)
lib/
  orchestrator.ts              (brief to scenes to render coordination)
  scenes.ts                    (scenes.json reader, validator)
  audio.ts                     (voiceover + music orchestration)
  assets.ts                    (image gen via Modal, clip gen via Higgsfield)
  render.ts                    (Remotion render wrapper)
  config.ts                    (loads .env and brand.json)
prompts/
  expand-brief.md              (turns a brief into a scenes.json)
  scene-imagery.md             (turns a scene description into image gen prompts)
  scene-clip.md                (turns a scene description into video clip prompts)
docs/
  setup.md                     (THIS FILE: setup spec and operational reference)
brand.json                     (my brand colors, fonts, voice settings, music vibes)
_seed/                         (the cloned toolkit, reference only)
.env
.gitignore
CLAUDE.md
package.json
tsconfig.json
pyproject.toml                 (uv-managed Python for Modal jobs)
```

## Critical workflow facts

These come from the seed toolkit's documented behavior and my prior pipeline work. Do not deviate without surfacing first.

1. **Remotion is the assembly layer, not optional.** Every render goes through a Remotion template. The templates live in `templates/<name>/` as React/TSX projects. `lib/render.ts` invokes Remotion CLI with scenes.json and the asset path map as input props. If a Remotion render fails, the most common cause is mismatched scene types between scenes.json and the template's available components. Logs from Remotion are surfaced verbatim, not summarized.
2. **Default format is 4K horizontal** (3840x2160 at 30fps). Vertical 4K (2160x3840) is the alternate. 1080p variants of both are supported for fast iteration. Always validate the scenes.json `format` field against what the chosen template supports. A template built for 16:9 will not gracefully handle 9:16; either pick the right template or render a variant.
3. **Generation vs render are separate phases.** Generation runs in the cloud (Modal + Higgsfield + ElevenLabs) and takes 1-5 minutes regardless of output resolution. Render runs locally in Remotion and is the only phase that scales with resolution (~4x slower at 4K vs 1080p). When iterating on a brief, render at 1080p; when shipping the final, render at 4K. Asset generation cost is the same either way.
4. **Generated assets need to feed 4K renders cleanly.** Request FLUX images at 2048 minimum on the long edge. Accept Higgsfield clips at their native resolution (often 1080p) and either upscale them via qwen-edit or use Remotion's CSS scaling with proper smoothing. Veo 3 outputs 4K natively, prefer it for hero shots where the brief justifies the cost.
5. **Two generation backends, two reasons.** Modal hosts open models I can run cheaply and predictably (FLUX for images, SadTalker for talking heads). Higgsfield aggregates closed/proprietary video models (Veo, Kling, Soul, Seedance) through their REST API. Voice and music both run through ElevenLabs since my existing plan already covers both. Use the right tool for the job: Modal for fast deterministic image gen, Higgsfield when the brief calls for high-quality cinematic clips, ElevenLabs for everything audio.
6. **Modal cold starts are slow** (30-90s for image gen, longer for video). The orchestrator should kick off all Modal jobs for a render in parallel, then assemble once they're all back. Don't serialize.
7. **Higgsfield jobs are also async.** The orchestrator hits the REST API to submit a job, gets a job ID back, polls until complete. Same parallel pattern as Modal: fire all of them at once, wait together.
8. **Higgsfield model selection logic:**
   - Brief says "cinematic", "high quality", or "hero" → Veo 3 (expensive, save for hero moments; outputs 4K natively which is a bonus)
   - Brief says "fast b-roll" or just generic "clip" → Kling (cheap default, upscale needed for 4K)
   - Brief specifies a model by name → use that one
   - The scene-clip prompt expansion picks the model based on what the scene needs
9. **ElevenLabs settings for my voice clone:** stability 0.5, similarity_boost 0.78, style 0. Model `eleven_multilingual_v2`. For long voiceovers, chunk them and apply `ffmpeg -filter:a dynaudnorm` per chunk to handle the known volume fade on long ElevenLabs generations.
10. **Music sources, in priority order:**
    - Default: generate via ElevenLabs Music using the brief's music description. Comes out of my existing $99/mo plan credits, same as voiceover.
    - If `briefs/<slug>.md` references a specific filename from `assets-library/music/`, use that file directly. Reserved for the rare case where a project needs a specific licensed track or pre-existing piece of music.
11. **Image generation prompts come from the scene definition,** but the orchestrator runs `prompts/scene-imagery.md` to expand short scene descriptions into proper image-gen prompts before sending to FLUX.2. Same pattern for video clips via `prompts/scene-clip.md` before sending to Higgsfield.
12. **Remotion uses the brand.json values for colors and fonts.** Never hardcode in components. This is what makes templates reusable across brands later.
13. **Free tier first.** I run every service on its free tier until I demonstrably need more. Modal has $30/mo free credit, Higgsfield gives 150 credits/mo free. If the orchestrator detects I'm approaching either limit, log a warning before kicking off jobs.
14. **Output paths:**
    - Single render: `videos/<slug>.mp4`
    - Variants: `videos/<slug>-<variant>.mp4` (e.g. `<slug>-vertical.mp4`, `<slug>-1080p.mp4`)
    - All metadata in `runs/<slug>/metadata.json`

## Brief format

Briefs at `briefs/<slug>.md` are markdown. Loose structure. The expand-brief prompt handles the conversion to structured scenes.json.

Recommended sections:
- **Purpose** (what is this for, who watches it, where it lives)
- **Length target** (15s, 30s, 60s, 90s)
- **Format** (default is horizontal 4K 3840x2160; specify "vertical 4K" or "square 4K" only if different)
- **Template** (which template to use, or "freeform" to compose from scratch)
- **Hook** (the opening line or moment)
- **Beats** (rough scene-by-scene plan)
- **Voiceover** (full script if I want exact words, or "improvise from beats")
- **Music** (vibe description, or filename from assets-library/music/)
- **Assets** (any specific imagery or clips to generate, or "auto from scenes")
- **CTA** (call to action at the end)

Example brief:

```markdown
# Slug: saas-hero-promo

## Purpose
30-second hero video for a productivity SaaS sign-up page. Plays autoplay-muted at the top of the landing page, with optional sound-on.

## Length target
30 seconds

## Format
16:9 horizontal, 4K (3840x2160). Hero positioning, big visual impact.

## Template
hero-16x9

## Hook
"Your team is losing hours to busywork they shouldn't have to do."

## Beats
1. Hook (text on screen + voiceover, 4s)
2. Problem: notifications piling up after hours (cinematic clip via Higgsfield Seedance, 6s)
3. Bridge: automation working while the office is empty (split screen visual with generated image, 6s)
4. Proof: clean dashboard showing the right metrics moving (8s)
5. CTA: visit example.com (6s)

## Voiceover
Use the brand voice. Improvise from beats but keep it punchy. Short sentences. No jargon.

## Music
Upbeat but professional. Like a tech product launch. ElevenLabs Music is fine.

## Assets
Auto-generate per scene. Style: clean, modern, no stock photo cliches.

## CTA
"Visit example.com" with branded button graphic.
```

## scenes.json shape

The expanded version produced by `/brief` looks like:

```json
{
  "slug": "focused-work-hero",
  "template": "hero-16x9",
  "format": { "width": 3840, "height": 2160, "fps": 30 },
  "duration_seconds": 30,
  "voiceover": {
    "source": "elevenlabs",
    "voice_id": "<your-voice-id>",
    "script": "Your team is losing hours to busywork they shouldn't have to do...",
    "settings": { "stability": 0.5, "similarity_boost": 0.78, "style": 0 }
  },
  "music": {
    "source": "elevenlabs-music",
    "prompt": "upbeat professional tech ad, driving but not aggressive, 110 bpm",
    "duration_seconds": 30
  },
  "scenes": [
    {
      "id": "hook",
      "start": 0,
      "duration": 4,
      "type": "text-overlay",
      "text": "Most agents are losing leads to AI.",
      "background": { "type": "generated-image", "source": "modal-flux", "prompt": "...", "target_width": 2048 }
    },
    {
      "id": "problem",
      "start": 4,
      "duration": 6,
      "type": "fullscreen-clip",
      "clip": { "type": "generated-clip", "source": "higgsfield", "model": "veo-3", "prompt": "phone ringing in dark room at night, dramatic lighting, slow zoom", "native_resolution": "1920x1080", "upscale_to_4k": true }
    }
  ]
}
```

The orchestrator reads scenes.json, fans out Modal and Higgsfield asset generation jobs in parallel, waits for them all, drops assets into `runs/<slug>/assets/<scene-id>.{png,mp4}`, then invokes the Remotion template with the scenes data and asset paths.

## Interactive setup steps

Do these in order. Ask me one thing at a time when you need input. Confirm each major step before moving on. Do not dump every file at once.

### 1. Folder structure and scaffolding

Create the folder structure listed above. Generate package.json with Remotion, tsx, dotenv, undici. Generate tsconfig.json for Node 22 ESM. Generate pyproject.toml for uv. Write .gitignore covering:
- `.env`
- `node_modules/`
- `.venv/`
- `_seed/`
- `runs/*/assets/`
- `runs/*/render/`
- `videos/*.mp4`
- `runs/*/audio/*.mp3`

Keep `briefs/*.md`, `runs/*/scenes.json`, `runs/*/metadata.json`, and `templates/` tracked.

### 2. Clone the seed toolkit

`git clone https://github.com/digitalsamba/claude-code-video-toolkit.git _seed`. Then `cd _seed && git log --oneline -5` to record the commit I cloned in CLAUDE.md. Do not modify `_seed/`. It's reference only.

### 3. Collect credentials

Reminder: every service here can start on a free plan. I do not want to be signed up for any monthly subscriptions during initial setup. If any service has changed its free tier terms since this prompt was written, surface that before having me create the account.

Prompt me for:
- `ELEVENLABS_API_KEY` (existing paid plan with voice clone already configured; same plan covers music)
- `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` (from `modal token new` after I install the CLI, free tier with $30/mo credit)
- `HIGGSFIELD_API_KEY` (free tier with 150 credits/mo, no monthly subscription)

For my ElevenLabs voice ID: don't ask me to look it up. In step 5 you'll list my voices and I can identify the clone. It's usually named something like "My Voice Clone" or similar. Store the resolved ID in brand.json once we identify it, not in .env.

Write the three API keys to .env. Do not echo them back.

### 4. Install Modal CLI and verify all key-based services

Walk me through `pip install modal` (or `uv tool install modal`), then `modal token new`. Verify with `modal app list`.

Then verify ElevenLabs works and discover my voice clone ID:
- Hit ElevenLabs list-voices with my API key
- Show me the list with names and metadata
- I'll point to which one is my voice clone (likely named "My Voice Clone" or similar)
- Store that voice_id in brand.json under a `voice.id` field

Record the verification date in CLAUDE.md. Higgsfield gets its own step next.

### 5. Set up Higgsfield connection

Higgsfield has a direct REST API: Bearer token auth in `Authorization` header, standard async POST-then-poll pattern, supports text-to-video, image-to-video, and Soul Mode. The orchestrator uses the REST API for everything.

Walk me through:
- Sign in at higgsfield.ai if I haven't
- Generate an API key from their dashboard
- Stay on the free tier. Free gives 150 credits/month, plenty for evaluation. Do not let me click into a paid plan unless I explicitly ask.
- Verify the API key works by hitting the models list endpoint and confirming current per-model credit costs

### 6. Fetch current docs

Before writing pipeline code, fetch and confirm:
- Modal SDK: `https://modal.com/docs`
- Remotion 4 API: `https://www.remotion.dev/docs`
- ElevenLabs API: `https://elevenlabs.io/docs/api-reference`
- Higgsfield: `https://higgsfield.ai/docs` for current model list, credit costs per model, and exact REST endpoint paths (already confirmed Bearer token auth and async POST-then-poll pattern; just verify current model lineup and pricing)
- FLUX.2 current status: search "FLUX.2 image generation 2026"
- ElevenLabs Music: confirm current API endpoint and any constraints (max duration, quality tiers). I've confirmed it works via my Pro plan; just verify the technical specifics.

If any model has been superseded by something better and free/cheap, surface it to me and ask if I want to swap. Record what you confirmed and the date in CLAUDE.md.

### 7. Copy and adapt skills from seed

For each skill in this list, copy the SKILL.md from `_seed/.claude/skills/<name>/` into `.claude/skills/<name>/` and adapt:
- Strip any avatar-rendering integration references that aren't relevant here
- Update paths to match my structure (briefs/, runs/, templates/)
- Keep credentials handling consistent with my .env

Skills to copy: `remotion`, `elevenlabs`, `ffmpeg`, `qwen-edit`, `moviepy`, `modal`, `frontend-design`.

Then build `.claude/skills/higgsfield/SKILL.md` fresh based on the docs you confirmed in step 6. Cover: how to call the Higgsfield REST API, how to pick a model based on scene description, how to poll for job completion, how to download finished clips, current credit costs per model, and the model selection logic from "Critical workflow facts" #4.

For each skill, show me a brief summary of what you did and ask me to approve before writing the next.

### 8. Write brand.json (conversational)

Don't run me through a form here. When you reach this step, just ask: "We're at the brand setup. Want to talk through it now, or do you have existing brand assets I can import?"

From there, the path branches:

**If I want to discuss:** have a real conversation. Ask about my work, the kinds of videos I want to make, the vibe I'm going for. Suggest color directions or font pairings based on what I describe. Propose options and let me react. The goal is to land on a brand.json that actually fits what I do, not to check boxes.

**If I have existing assets:** I'll point you to them. Could be a logo file in a folder somewhere, a brand guide PDF, an existing brand.json from another project, or a website I run that already has the visual identity figured out. Read whatever I give you and extract the relevant fields into brand.json.

**If I'm not ready to decide:** that's also fine. Write a minimal brand.json with the voice clone ID (already in there from step 4) and leave the rest empty. Brand will fill in over the first few real videos as I make decisions in the moment.

The brand.json schema should be flexible enough to grow:

```json
{
  "voice": { "id": "..." },
  "colors": { "primary": "...", "accent": "...", "background": "..." },
  "fonts": { "primary": "...", "weights": [...] },
  "logo_path": "assets-library/brand/logo.svg",
  "tone": "..."
}
```

Any field can be omitted if I haven't decided yet. The templates handle missing fields gracefully (falling back to clean modern defaults like Inter for fonts, neutral palette for colors).

### 9. Write prompts/expand-brief.md

Document the rules for converting a brief into scenes.json. Include the example brief and example scenes.json from above. Explain how to interpret beats, how to map them to scene types (text-overlay, fullscreen-clip, split-screen, etc.), how to set durations, how to handle voiceover (script vs improvise), how to choose between generated-image (Modal FLUX) and generated-clip (Higgsfield) per scene, how to choose between AI-generated assets vs library assets.

This is the prompt the `/brief` and `/video` slash commands apply when expanding a brief.

### 10. Write prompts/scene-imagery.md

Document the rules for taking a scene description and turning it into a proper image-gen prompt for FLUX.2. Should reference brand.json for style consistency. Should produce prompts that don't look like stock AI imagery: specific subjects, specific lighting, specific composition.

### 11. Write prompts/scene-clip.md

Document the rules for taking a scene description and turning it into a Higgsfield video clip prompt. Includes the model selection logic (Kling for cheap b-roll, Veo for hero, etc.) and how to translate a scene's vibe and motion description into the prompt format each model expects.

### 12. Build lib/config.ts

Loads .env and brand.json. Exports typed config objects.

### 13. Build lib/scenes.ts

`readScenes(slug)`: reads `runs/<slug>/scenes.json`, validates against schema.
`writeScenes(slug, scenes)`: writes scenes.json.
`scenesSchema`: zod schema for the structure above.

### 14. Build lib/audio.ts

`generateVoiceover(slug, scenes)`: calls ElevenLabs with the voiceover script. Chunks if over 150s. Applies dynaudnorm via FFmpeg. Outputs `runs/<slug>/audio/voiceover.mp3`.

`generateMusic(slug, scenes)`: if scenes.music.source is "library", copies from `assets-library/music/<name>`. If "elevenlabs-music" (default), calls ElevenLabs Music API with the brief's prompt and desired duration. Trims to scenes.duration_seconds with a small fade out. Outputs `runs/<slug>/audio/music.mp3`.

### 15. Build lib/assets.ts

`generateSceneAssets(slug, scenes)`: for each scene that needs generated imagery or clips:
- `generated-image` scenes → submit Modal FLUX job
- `generated-clip` scenes → submit Higgsfield job, model selected per scene's spec

Submit all jobs in parallel across both Modal and Higgsfield. Poll until each completes. Save outputs to `runs/<slug>/assets/<scene-id>.{png,mp4}`. Returns a map of scene-id to asset path plus per-asset cost.

### 16. Build lib/render.ts

`renderTemplate(slug, scenes, assetMap)`: invokes Remotion CLI with the appropriate template, passes scenes + asset paths as input props, outputs to `runs/<slug>/render/out.mp4`. Then copies (or moves) the final to `videos/<slug>.mp4`.

### 17. Build lib/orchestrator.ts

`runVideo(slug, opts)`:
a. Verify `briefs/<slug>.md` exists. If not, error.
b. Verify `runs/<slug>/scenes.json` exists. If not, run brief expansion in-session via Claude Code (no API call, uses my Max plan): apply `prompts/expand-brief.md` to the brief, write scenes.json, show me preview, confirm.
c. Show me scenes.json summary: scene count, total duration, output resolution (4K vs 1080p), asset count split by source (Modal images, Higgsfield clips), voiceover length, music source. **Confirm before burning credits.** Include a cost estimate: "About to spend ~$X on Modal jobs, ~Y Higgsfield credits, ~$Z on ElevenLabs."
d. **Generation phase (cloud, parallel):** kick off voiceover, music, image, and clip jobs concurrently across Modal, Higgsfield, and ElevenLabs. Show progress for each backend. Wait for all to complete.
e. **Render phase (local):** invoke Remotion via lib/render.ts. Log render start, progress, and completion separately from the generation phase so I can see which phase is taking how long.
f. Write metadata.json with all costs broken out by service, plus generation duration and render duration as separate fields.
g. Print: "Done. Video at videos/<slug>.mp4. Generation took Xm Ys, render took Am Bs. Total cost: ~$X.XX."

CLI: `tsx lib/orchestrator.ts <slug> [--template <name>] [--variant <name>] [--resolution <4k|1080p>]`.

The `--resolution` flag overrides scenes.json format for the render phase only. Assets get reused; only the Remotion render runs again. This is the fast path for iterating: generate once at 4K, render previews at 1080p, render final at 4K.

### 18. Scaffold the first template

Walk me through creating `templates/hero-16x9/`. This is the default template since most of my videos are horizontal 4K for product pages and hero placements. It should include:
- A Remotion composition (`Composition.tsx`) that takes scenes + assets + voiceover + music as input props
- Components for the scene types referenced in the scenes.json schema (text-overlay, fullscreen-clip, split-screen, generated-image-bg)
- Reads brand.json for colors and fonts
- 16:9 horizontal at 3840x2160 (4K) at 30fps as the default render
- Supports rendering the same composition at 1920x1080 (1080p) when `--resolution 1080p` is passed; this is just a Remotion config flag, not a separate template
- Renders cleanly when sources are mixed resolution (Higgsfield 1080p clips upscaled, FLUX 2048 images placed, etc.)

Make it actually visually decent, not generic. Use the frontend-design skill. Real motion, real timing, real typography hierarchy. The default look should be confident and clean enough to ship as a hero video on a product page without me touching it.

Ask me after this one whether to scaffold any of the alternates now:
- `templates/social-9x16/` (vertical 4K 2160x3840 for Reels/TikTok when I need it)
- `templates/explainer-16x9/` (horizontal 4K, more text overlay, voiceover-driven)
- `templates/product-demo/` (screen recording overlay style)

My default answer is "wait until I have a use case" unless I say otherwise. Don't scaffold templates I won't use this week.

### 19. Write slash commands

`.claude/commands/video.md`: takes a slug, runs the full orchestrator.

`.claude/commands/brief.md`: takes a slug, only expands the brief to scenes.json. Useful for reviewing the scene plan before rendering.

`.claude/commands/scene-review.md`: takes a slug, opens scenes.json and walks through it with me, suggests tweaks based on the brief, applies changes I approve. Especially useful for adjusting which Higgsfield model gets picked per scene.

`.claude/commands/template.md`: takes a template name, scaffolds a new template folder with starter files and a SKILL.md describing it.

`.claude/commands/voice.md`: lists my ElevenLabs voices, lets me test settings, updates brand.json voice section.

### 20. Write CLAUDE.md

CLAUDE.md is the most important file in this workspace because it's what shapes how Claude Code shows up every time I open a session here. It's not just a reference doc; it's the personality and capability primer for every conversation that happens in this folder.

Cover:

**Role and stance:**
- This is a creative video studio. Claude Code is my collaborator on shaping ideas into shipped videos, not just an operator running a pipeline.
- The conversational entry point is primary. I often arrive with an idea, not a brief. Help me shape it.
- Nothing generates without explicit go-ahead from me. Even after a brief is approved, the cost-confirmation gate stays.
- Surface trade-offs honestly. Push back when an idea won't work. Suggest better angles. Reference my prior work when relevant.

**On session start, do this:**
- Scan `runs/*/metadata.json` (most recent 5-10) to know what I've shipped recently. Reference this when relevant.
- Check `videos/` for finished work I can pull up if I want to riff on it.
- Don't dump this context unprompted; just have it loaded.

**Capabilities reference:**
- Stack and folder layout (briefs/, videos/, runs/, templates/, assets-library/)
- The brief to scenes.json to render flow
- The two generation backends: Modal (FLUX images, SadTalker talking heads) and Higgsfield (video clips via Veo, Kling, Soul, Seedance). Voice and music both flow through ElevenLabs.
- The Higgsfield model selection logic (Kling default, Veo for hero)
- **Generation phase (cloud, parallel, fixed time) vs render phase (local Remotion, scales with resolution).** Most important conceptual distinction.
- **Default output is 4K horizontal (3840x2160 at 30fps).** 1080p is the fast-iteration option. Vertical 4K and 1080p for social when needed.
- Asset resolution handling for 4K renders

**Brand and voice:**
- Pull from brand.json for technical specifics
- Writing/speaking style: conversational, grounded, no jargon dumps, no em dashes. Override per-brand in `tone` field.
- The voice clone is per-user; set your own ElevenLabs voice id in `brand.json`.

**Costs and free tiers:**
- Every service runs on free tiers by default. Modal $30/mo credit, Higgsfield 150 credits/mo, ElevenLabs existing paid plan, Remotion and FFmpeg always free.
- Warn before suggesting anything that would exceed free tier limits.
- Music is generated by ElevenLabs Music by default, same plan that covers voiceover. Manually-added tracks in `assets-library/music/` are the exception, not the rule.

**Slash commands and when to use them:**
- `/video <slug>` runs the full pipeline end to end
- `/brief <slug>` only expands a brief to scenes.json
- `/scene-review <slug>` walks through a scenes.json with me
- `/template <name>` scaffolds a new template
- `/voice` manages voice settings
- Slash commands are optional shortcuts. Conversation works for everything they do.

**The list of skills you copied from the seed, and what you changed**

**API endpoints and versions confirmed, with the date**

**Reality Filter applies:** label unverified API behavior, do not guess at payload shapes

**Pointer to brand.json, prompts/, and the seed at _seed/**

### 21. Smoke test (simple, Modal-only, 1080p for speed)

- Create `briefs/000-smoke-test.md` with a 15-second horizontal 1080p video brief: one beat, one generated image (no Higgsfield clip yet), one line of voiceover, default music vibe, use the hero-16x9 template, format set to 1920x1080 at 30fps for fast iteration
- Run `/video 000-smoke-test`
- Watch brief expansion, confirm scenes.json has format 1920x1080
- Watch generation phase: Modal job fires (image gen at 2048+ on long edge) while ElevenLabs generates voiceover and music in parallel in the cloud
- Watch render phase: Remotion render runs locally, should complete in 1-2 minutes for 15s at 1080p
- Confirm `videos/000-smoke-test.mp4` exists, plays at 1080p, looks reasonable
- Print full breakdown: generation duration, render duration, cost per service, total cost

After 1080p passes, re-render the same scenes.json at 4K to validate the resolution flag works:
- `tsx lib/orchestrator.ts 000-smoke-test --resolution 4k`
- Confirm assets are reused (no new generation jobs fire)
- Confirm render at 4K takes ~4x longer than the 1080p render
- Confirm output lands at `videos/000-smoke-test-4k.mp4` (or similar variant naming)

### 22. Smoke test (with Higgsfield)

After the simple Modal-only test passes:

- Create `briefs/000-clip-test.md` with a 20-second brief that includes one Higgsfield clip scene (default to Kling to keep it cheap, will need upscale to 4K), one Modal image scene, voiceover, ElevenLabs Music backing track, hero-16x9 template
- Run `/video 000-clip-test`
- Watch both Modal and Higgsfield jobs fire in parallel
- Confirm the Higgsfield clip downloads at native resolution, gets upscaled to fit the 4K composition cleanly
- Confirm the final render integrates the clip cleanly with proper duration and timing
- Verify the final MP4 is actually 4K (check with `ffprobe videos/000-clip-test.mp4`)
- Print cost breakdown including Higgsfield credit usage and render duration

### 23. Smoke test (complex, multi-asset)

- Create `briefs/000-multi-scene.md` with a 60-second brief, 4-5 beats, mix of generated images and a couple Higgsfield clips, full voiceover script provided, music from library
- Drop a placeholder MP3 in `assets-library/music/test-track.mp3` for the music reference
- Run `/video 000-multi-scene`
- Confirm parallel asset generation kicked off correctly across both Modal and Higgsfield (watch the logs)
- Confirm final render stitches everything cleanly
- Spot-check sync between voiceover, music, and visuals
- Validate that the metadata.json correctly records every cost line item

## Constraints

- No em dashes anywhere (code, scripts, docs, generated content, prompts)
- If unsure about an API or model, fetch live docs first
- Keep dependencies minimal
- All credentials in .env, never echoed
- Asset generation runs on Modal or Higgsfield, never locally. Remotion renders run locally.
- Default to cheap models (Kling for clips, FLUX for images) unless the brief specifically asks for premium (Veo). Save expensive models for hero moments.
- Brand consistency: templates always reference brand.json, never hardcode colors or fonts
- This is manual per-video. Human-in-the-loop confirmation gates stay even when I trust the workflow.
- The seed toolkit is reference, not dependency. I own this workspace.

When you are ready, start with step 1 and ask me for the first input you need.
