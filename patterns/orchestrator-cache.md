# Orchestrator Cache Patterns

> **When to read:** Working on `lib/orchestrator.ts`, `lib/assets.ts`, or `lib/audio.ts` — anything that touches per-scene asset caching, the `.complete` marker, or scene-ID restructures. Project-local; specific to this video-generator codebase.

---

### `.complete` Marker Silently Skips Fresh Generation After Scene ID Changes (Discovered)

**Problem:** The orchestrator caches per-scene asset generation results via a marker JSON at `runs/<slug>/assets/.complete`. The marker is keyed by scene ID. When a scene is renamed (e.g., `reflective` → `stage-closeup`) or a new scene ID is introduced in `scenes.json`, the cached map doesn't include the new ID. The orchestrator's "check cache before generating" path silently treats the renamed/new scene as missing-but-not-fresh and skips generation. Render proceeds with the stale or missing asset, no warning. The bug looks like "my new scene didn't render" but the root cause is the stale marker.

**Solution:** Before any scene-ID restructure in `runs/<slug>/scenes.json`, delete the marker:

```bash
rm runs/<slug>/assets/.complete
```

Then re-run `tsx lib/orchestrator.ts <slug>`. The orchestrator re-evaluates every scene against the current `scenes.json` and generates the missing assets.

Belt-and-suspenders: if unsure whether a scene's asset is stale, also delete the specific asset file (`runs/<slug>/assets/<scene-id>.mp4` or `.png`) — the orchestrator's per-asset existence check kicks in independently of the marker.

**Why:** The `.complete` marker is an optimization to avoid re-running cost-estimate + dispatch loops for fully-cached runs. Its key set is the snapshot of scene IDs at the time of the last successful completion. It has no schema for "scenes.json has changed since last run" — restructures invalidate the marker but don't trigger an automatic reset. A better fix at the orchestrator level: hash the scene IDs from `scenes.json` and store the hash in the marker; invalidate if the hash mismatches. Until that lands, the operator must delete the marker manually on any restructure.

**Discovered:** While restructuring a `pod-9x16` brief mid-iteration (2026-05-22) — renamed a scene id; new scene-ID generation silently skipped because the cached marker map only knew the old IDs.
