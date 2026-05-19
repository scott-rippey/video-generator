---
description: Run the full brief-to-MP4 pipeline for a slug.
argument-hint: <slug> [--resolution 1080p|4k] [--variant <name>] [--template <name>]
---

# /video

Run the full video pipeline end to end for the slug `$ARGUMENTS`.

Steps you take:

1. Verify `briefs/$ARGUMENTS.md` exists. If not, ask the user whether to draft one together (use `/brief $ARGUMENTS` for the expansion-only path).
2. If `runs/$ARGUMENTS/scenes.json` doesn't exist yet, apply `prompts/expand-brief.md` to the brief and write the scenes.json. Show a one-paragraph summary and let the user tweak before proceeding.
3. Run the orchestrator: `tsx lib/orchestrator.ts $ARGUMENTS` (pass through any flags the user supplied). The orchestrator handles its own cost-confirmation gate, generation phase, render phase, and metadata write.
4. After the run completes, show the user the final video path, the generation/render durations, and the cost breakdown from `runs/$ARGUMENTS/metadata.json`.
5. If anything failed, surface the error verbatim and offer recovery options (rerun with `--resolution 1080p` for a cheaper retry, edit scenes.json, etc.).

Things to keep in mind:

- Default output format is horizontal 4K. Suggest `--resolution 1080p` if the user is iterating on the brief and just wants to see the result fast.
- When the user is shipping a final, render at 4K.
- The `--resolution` flag reuses already-generated assets and only re-runs the Remotion render. This is the fast path for resolution-swap renders. The orchestrator detects existing assets via the `.complete` marker in `runs/$ARGUMENTS/assets/`.
- Never proceed past the cost-confirmation gate on behalf of the user.
