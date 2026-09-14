---
name: heygen
description: Render a talking-head avatar clip with HeyGen (remote MCP, browser OAuth, no API key) and place it in a video as a library clip. Use when a brief calls for a presenter, spokesperson, host, digital twin, or "me on camera" scene, or when the user mentions HeyGen or avatars. Covers avatar selection, the three audio paths (master voiceover segment, separate audio file, HeyGen text-to-speech), background plates, render settings, polling, and the scenes.json wiring.
---

# HeyGen avatar clips

HeyGen is wired as a **remote MCP server** (`.mcp.json`: `https://mcp.heygen.com/mcp/v1/`, HTTP).
Auth is OAuth in the browser: on first use run `/mcp` in Claude Code and approve. No API key,
nothing in `.env`. Renders spend the credits on the user's HeyGen plan.

The orchestrator (`lib/orchestrator.ts`) never calls HeyGen. This is a conversation-driven
stage: you drive the MCP tools, the finished MP4 lands in `runs/<slug>/assets/<scene-id>.mp4`,
and the scene references it as a `library-clip`. Everything below is a menu the user picks
from per video, not a default the pipeline imposes.

## 0. Ask before rendering

Confirm these with the user in conversation (one at a time works best):

1. **Which avatar** (see 1).
2. **Where the voice comes from** (see 2): the master voiceover, a separate audio file, or HeyGen's own TTS.
3. **Background**: a studio plate you supply (transparent avatar composited on it), HeyGen's default, or none.
4. **Resolution and expressiveness** (see 4). 4K is slower and costs more.
5. **Cost**: HeyGen bills from the plan's credits; say how many renders the plan is about to spend before firing. Never batch before a canary (see 5).

## 1. Pick the avatar

- `list_avatar_groups` (ownership `private`) → `list_avatar_looks` (groupId). **The look's `id` is the `avatarId`.**
- If the workspace brand file has a `heygen` block (`assets-library/brand/<name>/brand.json`), use its ids and prompts; they were established on real renders. Otherwise walk the user through their groups.
- No avatar yet? `create_photo_avatar` from a clean, well-lit still with a plain background. Consent and any motion reference are group-scoped.
- Sanity check the account with `get_current_user` when the groups look wrong; a missing avatar usually means the MCP is authorized against a different HeyGen account, not a deleted asset.

## 2. Choose the audio path

**A. Segment of the master voiceover** (exact sync, one voice track, no duplicated script)
1. `tsx lib/orchestrator.ts <slug> --audio-only` → produces the leveled `runs/<slug>/audio/voiceover.mp3`.
2. `tsx lib/vo-segment.ts <slug> <scene-id>` → cuts that scene's stretch to `runs/<slug>/audio/<scene-id>.vo.mp3`.
3. Upload the segment (see 3), render audio-driven (see 4).
4. Scene: `library-clip` with `audio: false` (the default). The master track plays underneath; the render's length equals the segment's, so it lines up at the scene's `start`.

**B. Separate audio file** (the clip carries its own voice)
1. Generate or supply the file (ElevenLabs via the `elevenlabs` skill, a recording, anything).
2. Upload, render audio-driven.
3. Scene: `library-clip` with **`audio: true`**, and make sure the master `voiceover.script` does not also speak those lines (use a `<break time="...">` of the clip's length, or leave that stretch silent).

**C. HeyGen text-to-speech** (simplest when the user has no cloned voice)
1. Pass the scene's lines and a HeyGen voice to `create_video_from_avatar` instead of an audio asset. Check the tool's input schema in `/mcp` for the exact text and voice fields; they are not documented here because they can drift.
2. Scene: `library-clip` with **`audio: true`**, same master-script rule as B.

A and B are the paths proven in production; C is documented from HeyGen's tool surface and should be canaried first.

## 3. Upload assets (audio and background plate use the same flow)

`create_asset_upload(filename, contentType, sizeBytes)` → **PUT** the bytes to the returned presigned URL with headers `content-type` and `x-amz-server-side-encryption: AES256` → `complete_asset_upload(assetId)`.

**Wait until `get_asset` returns the asset's URL before rendering.** An asset still `processing` at submit time is silently dropped, which shows up as a white background or a silent render.

## 4. Render

`create_video_from_avatar` with:
- `avatarId` (the look id), `audioAssetId` (paths A and B) or the TTS fields (path C)
- `background: { type: "image", asset_id: <plate> }` **plus `removeBackground: true`** when you supply a plate. Photo avatars carry an opaque background; without `removeBackground` it sits on top of the plate and the render comes out white behind the person. `removeBackground` renders are slower (matting pass).
- `resolution` (`"4k"` or `"1080p"`), `aspectRatio` (`"16:9"`, `"9:16"`)
- `expressiveness: "medium"` plus a **restrained `motionPrompt`** (natural, subtle gestures; balanced, never busy). Do not push expressiveness to `"high"`: the figure destabilizes (hand smears, artifacts).
- One render per scene. Keep each render **under 180 seconds** of audio; split longer speech across scenes.

Record the exact `motionPrompt` the user approves in their brand file's `heygen` block. A prompt is data, not prose.

## 5. Canary, poll, download

1. Render **one** scene first. Poll `get_video` until `completed`. Download `video_url` to `runs/<slug>/assets/<scene-id>.mp4`.
2. Extract a frame (`ffmpeg -ss 2 -i clip.mp4 -frames:v 1 check.png`) and confirm the background is there, then batch the rest.
3. Add the scene to `scenes.json`:

```json
{
  "id": "host-intro",
  "type": "library-clip",
  "start": 4,
  "duration": 12,
  "clip": { "type": "library-clip", "file": "runs/<slug>/assets/host-intro.mp4", "audio": false }
}
```

Then `tsx lib/orchestrator.ts <slug>`; the render phase picks the file up like any library clip (HEVC sources are auto-transcoded).

## Gotchas learned on real renders

- **Lock the audio before rendering.** Voice and face are decoupled; a render on unapproved audio is a wasted render.
- **Multiple renders concatenated outside Remotion drift.** Each HeyGen file's audio runs 15 to 31 ms longer than its video. Inside this pipeline every clip sits in its own scene, so nothing accumulates. If you ever stitch renders directly with ffmpeg, trim each clip's audio to its exact video sample count first.
- **The avatar's hands are generated fresh every render.** If jewelry or objects appear, add an explicit "hands bare and empty" sentence to the motion prompt; short forms of that clause are ignored.
- **Text on screen, props, captions** belong to Remotion overlays, not to the HeyGen render.
