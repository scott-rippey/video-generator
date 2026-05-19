---
description: Scaffold a new Remotion template folder.
argument-hint: <template-name> [--format 16x9|9x16|1x1] [--from hero-16x9]
---

# /template

Scaffold a new Remotion template at `templates/$ARGUMENTS/`.

Steps you take:

1. Ask the user a few quick questions if not already implied by the arguments:
   - Format: 16x9 horizontal, 9x16 vertical, 1x1 square. Default 16x9.
   - Default resolution: 4K, 1080p. Default 4K.
   - Starting from an existing template? Default: copy from `templates/hero-16x9/` and adapt.
   - What's unique about this template? (More text overlay? Different motion language? Specific use case like screen-recording overlay?)
2. Create the folder structure:
   ```
   templates/<name>/
     index.ts          (registerRoot)
     Root.tsx          (Composition registration)
     Composition.tsx   (the actual composition)
     components/
       SceneRouter.tsx
       <SceneType>Scene.tsx for each scene type the template supports
   ```
3. Either copy from the source template or generate fresh files. Either way, reference `brand.json` for colors and fonts; never hardcode.
4. Apply the `frontend-design` skill for the visual design. Make it actually decent: real motion, real timing, real typography hierarchy. Not generic.
5. Document what makes this template distinct in a `templates/<name>/README.md`: format, default scene types supported, motion language, what kind of brief it's best for.
6. Add the template to the list in CLAUDE.md under "templates".
7. Show the user the new files and suggest they test with a small brief before relying on it.

If the user wants to render at a non-standard size (vertical 4K for Reels, square for Instagram feed, etc.), that's the right time to scaffold a new template rather than overload `hero-16x9`.
