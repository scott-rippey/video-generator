---
description: Interview a first-time user about their workflow, then configure services, run the setup steps they need, and propose a workspace shape.
argument-hint: [show|redo]
---

# /onboard

Turn a fresh clone into a studio shaped around what the user actually makes. Nine questions at most, one at a time. Then configure, document, run only the setup steps their answers need, and write a proposal for how the workspace could be laid out. Nothing is moved or restructured by this command; the proposal is an offer.

## Arguments

- `show`: print the `## Your workflow` section from `CLAUDE.md` and stop.
- `redo`: rerun the interview using the current answers as defaults, then rewrite the section and the proposal.
- No argument when `## Your workflow` already exists in `CLAUDE.md`: ask "You already have a workflow section. Redo it, or show it?" and stop unless they say redo.

## Interview rules

- One question per turn. Wait for the answer. Never show the whole list.
- Offer lettered options and always add "or something else, tell me". Accept free text and map it to the nearest option, confirming in one sentence when the mapping is not obvious.
- It is a conversation, not a form. If an answer covers two questions, take both and skip ahead. If the user says "just use defaults", fill the rest with the defaults marked below and go straight to the summary.
- No em dashes in anything you write for the user (this command, CLAUDE.md, brand files, the proposal).
- Nothing is written, installed, or changed until the summary screen is approved.

## Steps you take

1. **Check state.** Read `CLAUDE.md`. If `## Your workflow` exists, follow the argument rules above. Otherwise start the interview.

2. **Q1. What you make.**
   "First one. What do you mainly want to make here?
   (a) Videos with generated visuals and an AI voiceover
   (b) Videos with a person on camera, real or an avatar
   (c) Still images only, like thumbnails, covers, or key art
   (d) Something else, tell me in a sentence"
   Writes `Produces:`. If (c), skip Q3, Q4 and Q5 and record `Script: none`, `Voice: none`, `Presenter: none`, `Music: none`. If (d), map to the nearest of a, b, c and confirm before moving on. Default: (a).

3. **Q2. Brand.**
   "Is this studio for one brand, or will you make things for several?
   (a) One. What is it called?
   (b) Several. Which one comes first?"
   Writes `Brand:`. For (a), the root `brand.json` becomes that brand: offer the three branches from `docs/video-studio-setup.md` step 8 (talk it through now, import existing assets such as a logo, a brand guide or a website, or defer and keep the neutral defaults). Only `colors`, `fonts`, `logo_path` and `tone` are touched here; the voice is Q4. For (b), the root stays neutral and you scaffold `assets-library/brand/<name>/brand.json` (a copy of root without the `voice` block, because `resolveBrand()` in `lib/config.ts` never overrides `voice.id`). Default: (a) with defer.

4. **Q3. Words.** (skip if Q1 = c)
   "Who writes the words?
   (a) I give a rough brief and Claude expands it into scenes and a script
   (b) I write the script myself, in beats or chunks, and Claude builds around it
   (c) No script. Visuals only, no narration"
   Writes `Script:`. For (b), ask in the same turn "Roughly how long is a chunk?" and record it; if Q5 turns out to be a HeyGen avatar, cap chunks at 165 seconds and say why (HeyGen renders top out at 180 seconds). If (c), skip Q4 and record `Voice: none`. Default: (a).

5. **Q4. Voice.** (skip if Q1 = c or Q3 = c)
   "Where does the voice come from?
   (a) An ElevenLabs library voice. I will pick one
   (b) My own ElevenLabs clone, already made or about to be
   (c) No AI voice. I record it, or the person on camera speaks"
   Writes `Voice:`. For (a) and (b), the ElevenLabs key and voice steps join the checklist; after the checklist, run the `/voice list` flow so the user picks a voice, then write `voice.id` and `voice.name` into `brand.json` exactly as `/voice update` does. Record the model as `eleven_multilingual_v2` with client-side break tags (stated, not asked; changeable later in conversation). For (c), leave `voice.id` null, and note for the proposal that `lib/scenes.ts` currently requires a `voiceover` block, so running the orchestrator without one is a follow-up they can ask for. Default: (a).

6. **Q5. Presenter.** (skip if Q1 = c)
   "Is there a person on screen?
   (a) A HeyGen avatar, a photo avatar or digital twin
   (b) Real footage I record myself
   (c) Nobody. Generated visuals only"
   Writes `Presenter:`. For (a), HeyGen is suggested on in Q6, and after its OAuth step you write the chosen group and look ids into the brand file's `heygen` block (root `brand.json` for a single brand, the per-brand file otherwise) following `.claude/skills/heygen/SKILL.md`. Also record `Unit of work cap: 165s per avatar chunk (HeyGen 180s render limit)`. Default: (c).

7. **Q6. Services.** (always, one screen, all services at once)
   "Here is what this studio can hook into. I have marked what your answers suggest; tell me which ones you want on, or say "looks right".

   | Service | What it does here | How it connects | Need it? | Your setup |
   |---|---|---|---|---|
   | Remotion | Assembles every video: scenes, overlays, audio, the final MP4 | npm library, renders on your machine, no account | Required, free | on |
   | FFmpeg | Levels the voiceover and music so they stay even, adds the pauses in your script, trims and fades audio, converts clips Remotion can't decode reliably | Command-line tool on your machine, setup installs it | Required, free | on |
   | whisper.cpp | Transcribes the finished voiceover with a timestamp on every word, so scene cuts land right after each sentence instead of at guessed times | Command-line tool plus a one-time speech model download (about 490 MB), setup installs both | Required, free | on |
   | Python + Pillow | Measures screenshots pixel by pixel, so typed text in form-fill scenes sits exactly inside the input boxes | Python library on your machine, setup installs it | Required, free | on |
   | Higgsfield | Generates the AI images and video clips (Nano Banana, Seedance, Kling, Veo and more) | Official CLI plus Claude Code skills, signs in through the browser | Optional, paid, but nearly everyone wants it | <on/off> |
   | ElevenLabs | AI voiceover (a library voice or your own clone), music beds, sound effects | REST API, one API key in `.env` | Optional, paid | <on/off> |
   | HeyGen | Talking-head avatar clips, a photo avatar or digital twin speaking on screen | Remote MCP server in `.mcp.json`, signs in through the browser with `/mcp` | Optional, paid | <on/off> |

   The free tools are always installed: they cost nothing, run on your machine, and the pipeline uses them. The paid services are your call; turn on only what you will use."

   Fill the Your setup column from earlier answers: the four free tools are always on, for every user including stills-only (never offer to turn them off; if asked, explain what each one does and keep it); Higgsfield on unless the user brings all their own visuals; ElevenLabs on when `Voice:` is an ElevenLabs voice, off otherwise (say it can still be on just for music beds); HeyGen on only when `Presenter:` is a HeyGen avatar. Fill the table with these values before showing it, never the `<on/off>` placeholders. Writes `Services:`.

   For every service turned on, ask in the same turn "Do you already have a <name> account?" and for any they lack, point them to sign up (they make the account; the checklist does the connecting):
   - Higgsfield: https://higgsfield.ai
   - ElevenLabs: https://elevenlabs.io/app/sign-up
   - HeyGen: https://app.heygen.com/signup

   If a choice conflicts with an earlier answer (HeyGen off with a HeyGen avatar presenter, ElevenLabs off with an ElevenLabs voice, Higgsfield off for a stills user), say what breaks in one sentence and ask which to change. Higgsfield off means no `generated-image` or `generated-clip` scenes, only supplied footage, screenshots, and avatar clips; skip Q7 in that case. HeyGen off means `.mcp.json` is rewritten to `{ "mcpServers": {} }`; tell the user the one-line entry to restore is in `.claude/skills/heygen/SKILL.md`. Default: the Your setup column as filled.

8. **Q7. Models.** (skip if Higgsfield is off; stills users see only b and c)
   "Which generators do you want to lock in? The defaults are Nano Banana 2 for stills and Seedance 2.0 for clips, with Kling 3.0 for animating a still.
   (a) Keep the defaults and pick per scene when it matters
   (b) Lock one or two. Tell me which
   (c) Stills only: Nano Banana 2 unless you say otherwise"
   Writes `Models:`. No config file reads this line; `prompts/expand-brief.md` and your `higgsfield-generate` calls honor it. Default: (a), or (c) for stills.

9. **Q8. Format.** (always)
   Video: "Default output? (a) Horizontal 4K at 30fps (b) Horizontal 1080p (c) Vertical 4K (d) Something else. Give me width x height and fps"
   Stills: "Default image size? For example 1280x720 for a YouTube thumbnail, 3000x3000 for a podcast cover. Give me the size, or tell me what it is for and I will suggest one."
   Writes `Format:`. `prompts/expand-brief.md` reads this line before falling back to its 4K default. Default: (a) for video.

10. **Q9. Unit of work and layout.** (always)
   "Last one. Today the workspace is laid out as a brief in briefs/, a working folder in runs/<slug>/, and the finished file in videos/. What is one unit of work for you, and how do you want it filed?
   (a) One video per brief. Keep the layout as it is
   (b) One episode per folder, something like episodes/episode-12/
   (c) Numbered script folders, something like scripts/012-slug/
   (d) Describe it"
   Writes `Unit of work:` and `Layout:`. Anything other than (a) goes into the proposal only, with the honest note that `PATHS` in `lib/config.ts` reads `briefs/`, `runs/` and `videos/`, so pipeline users who rename them need a small `PATHS` edit later or keep those three folders and add their own beside them. Stills users never run the pipeline, so any layout works for them. Default: (a).

11. **Derive, do not ask:** `Approvals:` (pipeline users: the orchestrator cost gate, which stays; conversation-driven stages such as HeyGen renders and stills: confirm each generation), `Handoff:` (an mp4 in `videos/` for pipeline users, a finished still for stills users, or whatever the user described in Q1 or Q9), `Proposal:` (path and status). Show these on the summary screen as editable lines.

12. **Summary gate.** Show one screen: the workflow lines exactly as they will appear in `CLAUDE.md`, the services table from Q6 with the final on/off, and the filtered checklist that will run (see `CLAUDE.md` "First-time local setup" for which steps apply to which answers). Ask: "Good to go? I will write the section, then run the checklist one step at a time." Stop until they say yes. Invite corrections to any line.

13. **Write, in this order.**
    1. Insert the `## Your workflow` section into `CLAUDE.md` directly after `## On session start`, using the block below.
    2. `brand.json` per Q2, Q4 and Q5 (the `heygen` block only when HeyGen is on). Touch only `voice.id`, `voice.name`, `colors`, `fonts`, `logo_path`, `tone` and the `heygen` block. Multi-brand: scaffold the per-brand file.
    3. `.mcp.json` per Q6.
    4. Run the filtered checklist from `CLAUDE.md` "First-time local setup", one step at a time, reporting present versus missing before installing anything. Stop at the first failed step, as that section says.
    5. Write `docs/workflow.md` (see below) and make the offer.

14. **Close with the next step.** AI-voice video users: `/video 000-smoke-test`. Stills users: "Describe your first thumbnail and I will generate it." No-voice video users: point at the voiceover follow-up in the proposal.

## The `## Your workflow` block

```
## Your workflow

Written by /onboard on <date>. Run /onboard redo to change it, /onboard show to print it.

- Produces: <line>
- Brand: <single, name | multi; first brand name>
- Script: <Claude expands a brief | human-written beats in chunks of about Ns | none>
- Voice: <name (ElevenLabs library|clone), eleven_multilingual_v2 with client-side break tags | none>
- Presenter: <HeyGen avatar (ids in <brand file> heygen block) | real footage | none>
- Unit of work: <one video per brief | one chunk, capped at 165s (HeyGen 180s render limit) | one episode = one image | ...>
- Models: <line>
- Format: <WxH at fps | image size>
- Layout: <briefs/ runs/<slug>/ videos/ | ... (proposal, not applied)>
- Approvals: <line>
- Handoff: <line>
- Services: Remotion, FFmpeg, whisper.cpp, Pillow on (free, required); Higgsfield <on|off>, ElevenLabs <on|off>, HeyGen <on|off>
- Proposal: docs/workflow.md (status: proposed)
```

## The proposal, `docs/workflow.md`

```
# Workflow proposal
Status: proposed, not applied (written <date> by /onboard)

## What you told me
(the workflow lines, repeated)

## Proposed stages
(numbered, for this user's case; for a stills-only podcast:
 1 episode notes, 2 prompt from PROMPTS.md, 3 one Nano Banana generation at the chosen size,
 4 pick, title, hand off)

## Proposed folders
(a tree, and which of briefs/ runs/ videos/ they would stop using)

## Proposed docs
(derived: CHANNEL.md when it is a channel; VOICE.md when the human writes the script;
 PROMPTS.md as a verbatim prompt store when models are locked or for stills)

## Services
(on/off table with one reason each)

## What would change if applied
(file moves, CLAUDE.md sections to edit, the lib/config.ts PATHS note if the layout changes,
 the "voiceover is required by lib/scenes.ts" note if Voice is none)

## What stays
(lib/ and templates/ untouched)
```

Then say, exactly: "That is a proposal. Nothing has moved. We can walk it section by section now, or leave it for another session. If you want any part applied, say which part and we will do it together, then I will flip the status line at the top."

When a part is applied in a later session, change the status line to `Status: applied <date> (sections: ...)` and update the `Layout:` line in `CLAUDE.md`. This command never applies the proposal itself.

## Caveats

- Never install, move or delete anything before the summary gate.
- Never bypass the orchestrator cost gate; onboarding only decides which checklist steps run.
- Keep the interview short. If the user is clearly experienced and answers in one paragraph, map everything, show the summary, and skip straight to the gate.

Suggested next: `/video 000-smoke-test` for a first render, or describe the first thing you want to make.
