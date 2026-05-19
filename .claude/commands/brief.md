---
description: Expand a markdown brief into scenes.json without rendering.
argument-hint: <slug>
---

# /brief

Expand the brief at `briefs/$ARGUMENTS.md` into a structured `runs/$ARGUMENTS/scenes.json` without burning any credits or running the orchestrator.

Steps you take:

1. Read `briefs/$ARGUMENTS.md`. If it doesn't exist, ask the user to draft one together and create it.
2. Read `prompts/expand-brief.md` and apply its rules to the brief.
3. Read `brand.json` for default voice and style. If the brief specifies `brand: <name>`, also read `assets-library/brand/<name>/brand.json` and merge.
4. Run `higgsfield model list --video` and `higgsfield model get <model>` for any models the scene plan references; confirm they exist and the parameters are valid.
5. Write the structured scene plan to `runs/$ARGUMENTS/scenes.json`. Validate the timeline (start + duration sums to total) before writing.
6. Show the user a summary: scene count, duration, format, voiceover length, music source, list of asset jobs (model and rough cost estimate).
7. Ask if the plan looks right. Apply edits the user requests directly to the scenes.json.

Don't run the orchestrator or kick off generation. This command is for reviewing the plan before committing credits.

If the user is happy, suggest they run `/video $ARGUMENTS` next.
