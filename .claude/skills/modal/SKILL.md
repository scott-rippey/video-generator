---
name: modal
description: Cloud GPU orchestration via Modal for FLUX.2 image generation and (optional) SadTalker talking-head jobs. Use when generating images via Modal, scaling up cloud GPU work, deploying Python functions to Modal, debugging Modal job failures, or budgeting against the $30/month free credit. Triggers include "generate image via Modal", "FLUX", "FLUX.2", "Modal job", "spawn Modal function", "modal run", "Modal deploy".
---

# Modal Skill

Modal is the cloud-GPU orchestration layer in this workspace. It hosts the open-source generation jobs (FLUX.2 for images, SadTalker if we add talking heads later). Higgsfield handles closed/proprietary video models. ElevenLabs handles voice and music.

## When to use Modal

- Generating images from a text prompt. Default model: **FLUX.2** at 2048+ on the long edge so output feeds 4K compositions cleanly.
- Editing existing images (Qwen-Image-Edit). See the `qwen-edit` skill for prompt patterns.
- Talking head from a still portrait + audio (SadTalker). Optional; only add when a brief calls for it.
- Any other open-weight workload that needs a GPU we don't have locally.

## When NOT to use Modal

- Video clip generation. Use the Higgsfield CLI + `higgsfield-generate` skill. Closed models (Seedance, Veo, Kling, etc.) live there.
- Voice or music. Use ElevenLabs. See the `elevenlabs` skill.
- Final composition / render. Remotion runs locally on CPU. See the `remotion` skill.

## Auth and account

- Free tier: $30/month of compute credit, no monthly subscription required.
- Auth lives in `~/.modal.toml` after `modal token new`. The `.env` also has `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` for orchestrator use.
- Workspace: your Modal workspace name (set during `modal token new`).
- Check balance and recent jobs: `modal app list`, `modal app logs <app-id>`.

## Pattern: defining and invoking a Modal function

Modal jobs live in `modal_jobs/` at the workspace root (Python). The orchestrator (`lib/assets.ts`) shells out to `modal run modal_jobs/<job>.py` with arguments, or uses the Modal HTTP endpoint if the function is deployed.

```python
# modal_jobs/flux.py
import modal

app = modal.App("video-studio-flux")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("diffusers", "transformers", "accelerate", "torch", "pillow")
)

@app.function(gpu="L40S", image=image, timeout=600)
def generate(prompt: str, width: int = 2048, height: int = 1152, seed: int | None = None) -> bytes:
    # Load FLUX.2 weights, run inference, return PNG bytes.
    ...
```

Invocation from the orchestrator:

```bash
# Synchronous (waits for result)
modal run modal_jobs/flux.py::generate --prompt "..." --width 2048 --height 1152

# Async (returns immediately, poll via call ID)
modal run --detach modal_jobs/flux.py::generate --prompt "..."
```

The orchestrator fires multiple Modal jobs in parallel from `lib/assets.ts` using `modal run --detach` (or by deploying the function and hitting the HTTPS endpoint with parallel fetches).

## GPU selection guide

| GPU | VRAM | Cost tier | Good for |
|-----|------|-----------|----------|
| `T4` | 16 GB | cheapest | small models, prototyping |
| `L4` | 24 GB | cheap | SD 1.5, simple inference |
| `L40S` | 48 GB | **mid (recommended for FLUX.2)** | FLUX, SDXL, mid-size inference |
| `A10G` | 24 GB | mid | older option, prefer L4 or L40S |
| `A100-40GB` | 40 GB | high | large models when L40S is tight |
| `A100-80GB` | 80 GB | high | bigger contexts, heavy inference |
| `H100` | 80 GB | premium | largest models, lowest latency |
| `H200` / `B200` | 80-141 GB | premium+ | when you need bleeding edge |

Default to **L40S** for FLUX.2. SadTalker fits on L4 or A10G if added later.

## Cost model

- Per-second billing based on GPU type.
- $30/month free credit auto-applies. Real-world usage for this workspace (handful of FLUX images per video, occasional SadTalker) lands well under the credit.
- Cold start ~30-90s for image gen, longer for video. Orchestrator should fire all Modal jobs at once, not serialize.

## Cold start mitigation

- `@modal.enter()` hooks pre-load weights into VRAM once per container.
- `keep_warm=N` keeps N containers alive (costs idle compute; only use during a burst).
- For development, prefer `modal serve` to get hot-reload without deploying.

## Common failures and fixes

- **Token expired or wrong workspace**: `modal token new` reissues. `modal config show` confirms active profile.
- **Out of memory**: bump GPU tier (L40S to A100-80GB) or reduce batch.
- **Timeout**: increase `timeout=` on the `@app.function` decorator. Default is 5 min.
- **Cold start too slow for orchestrator**: deploy the function (`modal deploy modal_jobs/flux.py`), then hit the HTTPS endpoint; containers stay warmer between calls.

## Workspace pointers

- Job source: `modal_jobs/<name>.py`
- Output destination: `runs/<slug>/assets/<scene-id>.png` (or .mp4 for SadTalker)
- Orchestrator wiring: `lib/assets.ts`
- Cost tracking per render: `runs/<slug>/metadata.json` records `cost.modal_usd` and per-job credit usage.

## Docs reference (verified 2026-05-18)

- Modal guide: https://modal.com/docs/guide
- GPU types: https://modal.com/docs/guide/gpu (L40S recommended for FLUX-class work)
- Pricing: https://modal.com/pricing ($30/mo Starter credit confirmed)
