---
description: Walk through an existing scenes.json with the user and apply tweaks.
argument-hint: <slug>
---

# /scene-review

Open `runs/$ARGUMENTS/scenes.json` and walk through it with the user scene by scene.

For each scene:

1. Show the scene's id, type, duration, and what it generates (image prompt, clip model + prompt, text, etc.).
2. Reference the corresponding beat in the original brief at `briefs/$ARGUMENTS.md` so the user can see the mapping.
3. Suggest improvements based on the brief's intent. Common things to flag:
   - Higgsfield model that doesn't match the scene's vibe (e.g., Seedance for "cinematic hero" when Veo 3.1 might be worth the credits — but ask first since Veo is ~3x more credits).
   - FLUX/image prompt too generic (apply `prompts/scene-imagery.md` to expand).
   - Clip prompt missing camera motion (apply `prompts/scene-clip.md` to add).
   - Duration too short or too long for the beat's content.
   - Format mismatch (e.g., scene assets at 9:16 in a 16:9 composition).
4. Ask the user which changes they want. Apply approved changes directly to scenes.json.
5. After all scenes are reviewed, re-validate the timeline (start + duration sums to total) and re-show the cost estimate (run `higgsfield generate cost <model> --prompt "..."` for each clip).
6. Save the updated scenes.json.

This command is for adjusting a plan after the brief expansion but before running the orchestrator. Especially useful for:
- Swapping Higgsfield models when the budget is tight (Seedance fast mode instead of std, downgrading hero shots, etc.).
- Tightening image prompts that look generic.
- Splitting a beat that ended up too long for a single clip.

Don't run the orchestrator from this command. End by suggesting `/video $ARGUMENTS` if the user is happy.
