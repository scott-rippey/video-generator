# Video Studio Overview

A programmable video studio. You describe a video in plain English; the studio composes it from AI-generated voice, music, imagery, and clips, then assembles a finished MP4.

Built for the case where hand-editing one video at a time stops scaling but agencies aren't the right answer either. You stay creatively in charge; the studio handles everything between idea and shipped MP4.

## What it produces

- **Hero videos** for landing pages and product fronts. Default output: horizontal 4K (3840x2160 at 30fps).
- **Social video** for Reels, TikTok, Shorts. Vertical 4K (2160x3840) when needed.
- **1080p iteration cuts** when you want to see the result fast before committing to a 4K final.
- **Multi-variant renders**: one composition, N data inputs, N outputs. Useful for personalized outreach, A/B hooks, or rendering the same script with different brands.

Voice, music, imagery, and clips are all generated to spec rather than pulled from stock. The result looks composed, not assembled.

## How it works

You drop a markdown brief into the `briefs/` folder describing the video you want. Hook, beats, voiceover style, music vibe, length, target format. As loose or as tight as you like.

From there, the studio:

1. **Expands the brief into a scene plan** (a structured `scenes.json` that maps each beat to a scene type, asset source, and duration). You review and tweak before anything generates.
2. **Generates the raw ingredients in parallel** in the cloud: voiceover from your cloned voice, a music bed, AI imagery for still scenes, AI video clips for motion scenes. Takes 1 to 5 minutes regardless of final resolution.
3. **Assembles the finished video locally** using a Remotion composition that handles motion, timing, transitions, typography, and brand styling. Render time scales with resolution; 1080p is about 4x faster than 4K.

Nothing burns credits without explicit approval. Even after a brief is locked, the studio pauses at a cost-confirmation gate before kicking off cloud jobs.

## Services it uses

- **Higgsfield** for AI video clips and AI imagery. One subscription gets access to Seedance 2.0, Veo 3.1, Kling 3.0, Cinematic Studio, Nano Banana, GPT Image 2, and more through a single CLI.
- **ElevenLabs** for voiceover (using your cloned voice) and AI music generation. Both run off the same paid plan.
- **Modal** for cloud GPU jobs (FLUX.2 image generation when wired, SadTalker talking heads when added). Pay-as-you-go with $30/month free credit.
- **Remotion** for the final composition and render. Open source; runs locally on your CPU.
- **FFmpeg** for audio normalization (the dynaudnorm pass that fixes the volume fade on long voiceovers) and any pre-ingest video processing.

You authenticate once per service and the studio handles the rest. API keys live in a single `.env` file that never gets committed.

## Mental model

Four folders capture the entire workflow:

- **`briefs/`** is the inbox. Drop a markdown brief as `<slug>.md`.
- **`videos/`** is the outbox. Finished MP4s land here as `<slug>.mp4`, with variants like `<slug>-1080p.mp4` or `<slug>-vertical.mp4`.
- **`runs/<slug>/`** is the per-render workspace. Holds the expanded scene plan, generated audio and assets, render output, and a metadata file recording cost and timing per service.
- **`assets-library/`** holds reusable brand assets and the multi-brand registry. Logos, fonts, brand-specific color palettes, occasional licensed music. Different folder per brand, so the studio can serve any project you're working on.

Templates under `templates/` define how scenes get laid out and animated. Each template is a Remotion composition that reads the brand and the scene plan and produces the final pixels.

## How conversation drives it

The studio is built to be conversational, not form-based. You don't fill out a brief template; you start a session, describe what you have in mind, and Claude Code drafts a brief with you as you talk.

A typical session looks like:

1. You arrive with a fragment ("I want a hero for the AI Advantage landing page") or a problem ("our pitch deck needs an opener").
2. Claude Code asks clarifying questions, suggests angles, references what you've shipped before, and surfaces trade-offs honestly (when Veo 3.1 is worth the credits versus when Seedance 2.0 hits 80% of the look for a tenth of the cost).
3. When you're satisfied with the concept, the brief lands in `briefs/<slug>.md`.
4. You review. Edits happen as natural conversation; the file updates as you talk.
5. When you're ready, you say "render it" and the pipeline runs.

Slash commands exist for when you want structured entry points (`/video`, `/brief`, `/scene-review`, `/template`, `/voice`). They're shortcuts, not requirements. Conversation works for everything they do.

## What costs money per video

Most videos run within free tiers and existing subscriptions. Rough per-video estimates:

- **ElevenLabs voiceover and music**: both pull from the existing paid plan's monthly character allowance. A typical 30 to 60 second video stays well under normal usage.
- **Higgsfield clips and AI imagery**: pulls from the monthly Higgsfield credit allowance. Seedance 2.0 at 1080p costs about 22.5 credits per 5 second clip. A 60 second video with a couple of clips and a few images lands around 60 to 80 credits.
- **Modal**: $0 for now while Higgsfield handles both clips and images. Becomes relevant if you wire up FLUX.2 self-hosted for cheaper bulk image generation, or add SadTalker talking heads.
- **Remotion render**: $0. Runs locally.

The studio surfaces a cost estimate before every render so you see exactly what's about to get charged.

## What "interactive" means here

Not video games. Videos that are programmable, parameterized, and composable rather than hand-edited:

- **Data-driven renders**: feed a CSV of clients or products, output one personalized video per row.
- **Multi-variant**: one composition rendered with different voiceover languages, aspect ratios, or brand themes.
- **Modular scenes**: each scene is a self-contained JSON object that any composition can include.
- **AI assets on demand**: scenes describe what they need; the studio generates it.
- **Branch points**: briefs can specify alternate paths (different hooks, different CTAs); the studio renders all of them.

The same composition can produce 30 personalized videos for a sales pipeline overnight, or one polished hero video for a website. Same workflow either way.

## Who this is for

People who:
- Already produce video content and want to stop hand-editing one at a time.
- Have a story to tell more often than they have time to edit.
- Want the visual quality of AI generation without the slop look that comes from posting raw AI output.
- Value owning the composition layer (templates, brand, motion language) rather than handing it to a third party.

Familiarity with Remotion helps, but isn't required. The studio's templates handle the React/TSX side; you live in markdown briefs and conversation.
