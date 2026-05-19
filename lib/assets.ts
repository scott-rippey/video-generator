import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runDir } from './config.ts';
import type { Scene, Scenes } from './scenes.ts';

// ---------- Types ----------

export interface AssetResult {
  sceneId: string;
  path: string;
  kind: 'image' | 'clip';
  source: 'higgsfield' | 'modal-flux' | 'library';
  cost: {
    credits?: number;
    usd?: number;
  };
  durationMs: number;
}

export interface AssetMap {
  [sceneId: string]: AssetResult;
}

// ---------- Helpers ----------

function assetsDir(slug: string): string {
  const dir = resolve(runDir(slug), 'assets');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function imagePath(slug: string, sceneId: string): string {
  return resolve(assetsDir(slug), `${sceneId}.png`);
}

function clipPath(slug: string, sceneId: string): string {
  return resolve(assetsDir(slug), `${sceneId}.mp4`);
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function run(cmd: string, args: string[]): Promise<RunResult> {
  return new Promise<RunResult>((resolveOk, rejectFail) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    proc.on('error', rejectFail);
    proc.on('close', (code: number | null) =>
      resolveOk({ code: code ?? -1, stdout, stderr }),
    );
  });
}

function parseJson<T>(label: string, text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new Error(
      `Failed to parse JSON from ${label}: ${(err as Error).message}\n--- raw ---\n${text}`,
    );
  }
}

// ---------- Higgsfield CLI helpers ----------

interface HfJob {
  id?: string;
  job_id?: string;
  job_set_id?: string;
  status?: string;
  result_url?: string;
  url?: string;
  asset_url?: string;
  download_url?: string;
  cost?: { credits?: number };
  credits?: number;
  credits_exact?: number;
}

/**
 * Higgsfield `generate create --wait --json` returns an array of jobs.
 * Extract the single job result, tolerating both array and object forms.
 */
function firstJob(parsed: unknown): HfJob {
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw new Error('Higgsfield returned empty job array');
    }
    return parsed[0] as HfJob;
  }
  return parsed as HfJob;
}

function extractAssetUrl(job: HfJob): string | null {
  return (
    job.result_url ??
    job.url ??
    job.asset_url ??
    job.download_url ??
    null
  );
}

function extractJobId(job: HfJob): string {
  const id = job.id ?? job.job_id ?? job.job_set_id;
  if (!id) {
    throw new Error(
      `Higgsfield create response missing job id: ${JSON.stringify(job)}`,
    );
  }
  return id;
}

async function downloadTo(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}): ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
}

async function higgsfieldGenerate(
  jobSetType: string,
  params: Record<string, string | number | boolean | string[]>,
): Promise<{ jobId: string; credits: number; resultUrl: string }> {
  const args = ['generate', 'create', jobSetType, '--wait', '--json'];
  for (const [k, v] of Object.entries(params)) {
    // Higgsfield CLI uses underscore flag names (e.g. --aspect_ratio), not dashes.
    const flag = `--${k}`;
    if (Array.isArray(v)) {
      for (const item of v) args.push(flag, String(item));
    } else if (typeof v === 'boolean') {
      if (v) args.push(flag);
    } else {
      args.push(flag, String(v));
    }
  }

  const res = await run('higgsfield', args);
  if (res.code !== 0) {
    throw new Error(
      `higgsfield generate create ${jobSetType} --wait failed:\nstderr:\n${res.stderr}\nstdout:\n${res.stdout}`,
    );
  }

  // The CLI emits a single JSON document (array of jobs) at the end of --wait.
  // Parse the whole stdout first; if that fails, fall back to the last JSON-looking line.
  let parsed: unknown;
  try {
    parsed = JSON.parse(res.stdout);
  } catch {
    const lines = res.stdout.trim().split('\n').filter((l: string) => {
      const t = l.trim();
      return t.startsWith('{') || t.startsWith('[');
    });
    if (lines.length === 0) {
      throw new Error(
        `Could not parse JSON from higgsfield create --wait output:\n${res.stdout}`,
      );
    }
    parsed = JSON.parse(lines[lines.length - 1]!);
  }

  const job = firstJob(parsed);
  if (
    job.status &&
    !['completed', 'success', 'done'].includes(job.status.toLowerCase())
  ) {
    throw new Error(`Higgsfield job ended with status ${job.status}: ${JSON.stringify(job)}`);
  }

  const url = extractAssetUrl(job);
  if (!url) {
    throw new Error(
      `Higgsfield job returned no asset url:\n${JSON.stringify(job, null, 2)}`,
    );
  }
  const jobId = extractJobId(job);
  const credits = job.credits_exact ?? job.credits ?? job.cost?.credits ?? 0;
  return { jobId, credits, resultUrl: url };
}

// ---------- Per-scene asset gen ----------

/**
 * Maps pixel-width preferences from scenes.json into Higgsfield's tier-based
 * resolution flag. Higgsfield image models accept "1k", "2k", or "4k" rather
 * than arbitrary pixel sizes.
 */
function pickImageResolution(targetWidth: number | undefined): '1k' | '2k' | '4k' {
  if (!targetWidth) return '2k';
  if (targetWidth <= 1024) return '1k';
  if (targetWidth <= 2048) return '2k';
  return '4k';
}

async function generateImage(
  slug: string,
  scene: Scene,
  spec: {
    prompt: string;
    aspect_ratio?: string;
    source?: 'modal-flux' | 'higgsfield';
    model?: string;
    target_width?: number;
  },
): Promise<AssetResult> {
  const startedAt = Date.now();
  const outPath = imagePath(slug, scene.id);
  const source = spec.source ?? 'higgsfield';

  if (source === 'modal-flux') {
    throw new Error(
      `scene.source="modal-flux" is not wired (Modal FLUX self-hosting is a future task). ` +
        `Use source="higgsfield" with model="flux_2" or model="nano_banana_2" instead. Scene: ${scene.id}`,
    );
  }

  const model = spec.model ?? 'nano_banana_2';
  const params: Record<string, string | number | boolean | string[]> = {
    prompt: spec.prompt,
    resolution: pickImageResolution(spec.target_width),
  };
  if (spec.aspect_ratio) params.aspect_ratio = spec.aspect_ratio;
  const { credits, resultUrl } = await higgsfieldGenerate(model, params);
  await downloadTo(resultUrl, outPath);
  return {
    sceneId: scene.id,
    path: outPath,
    kind: 'image',
    source: 'higgsfield',
    cost: { credits },
    durationMs: Date.now() - startedAt,
  };
}

async function generateClip(
  slug: string,
  scene: Scene,
  spec: {
    model: string;
    prompt: string;
    duration: number;
    aspect_ratio: string;
    resolution: string;
    mode: string;
    genre?: string;
    medias?: string[];
  },
): Promise<AssetResult> {
  const startedAt = Date.now();
  const outPath = clipPath(slug, scene.id);
  const params: Record<string, string | number | boolean | string[]> = {
    prompt: spec.prompt,
    duration: spec.duration,
    aspect_ratio: spec.aspect_ratio,
    resolution: spec.resolution,
    mode: spec.mode,
  };
  if (spec.genre) params.genre = spec.genre;
  if (spec.medias && spec.medias.length > 0) params.medias = spec.medias;
  const { credits, resultUrl } = await higgsfieldGenerate(spec.model, params);
  await downloadTo(resultUrl, outPath);
  return {
    sceneId: scene.id,
    path: outPath,
    kind: 'clip',
    source: 'higgsfield',
    cost: { credits },
    durationMs: Date.now() - startedAt,
  };
}

// ---------- Scene fan-out ----------

interface AssetJob {
  sceneId: string;
  kind: 'image' | 'clip';
  outPath: string;
  run: () => Promise<AssetResult>;
}

function cachedResult(
  sceneId: string,
  kind: 'image' | 'clip',
  outPath: string,
): AssetResult {
  console.log(`[assets] CACHED ${sceneId} (${kind}) -> ${outPath}`);
  return {
    sceneId,
    path: outPath,
    kind,
    source: 'higgsfield',
    cost: { credits: 0 },
    durationMs: 0,
  };
}

function collectAssetJobs(slug: string, scenes: Scenes): AssetJob[] {
  const jobs: AssetJob[] = [];

  for (const scene of scenes.scenes) {
    // Top-level scene clip (fullscreen-clip)
    if (scene.type === 'fullscreen-clip' && scene.clip.type === 'generated-clip') {
      const clip = scene.clip;
      const out = clipPath(slug, scene.id);
      jobs.push({
        sceneId: scene.id,
        kind: 'clip',
        outPath: out,
        run: () =>
          existsSync(out)
            ? Promise.resolve(cachedResult(scene.id, 'clip', out))
            : generateClip(slug, scene, {
                model: clip.model,
                prompt: clip.prompt,
                duration: clip.duration,
                aspect_ratio: clip.aspect_ratio,
                resolution: clip.resolution,
                mode: clip.mode,
                genre: clip.genre,
                medias: clip.medias,
              }),
      });
      continue;
    }

    // text-overlay or generated-image-bg with generated-image background
    if (
      (scene.type === 'text-overlay' || scene.type === 'generated-image-bg') &&
      scene.background.type === 'generated-image'
    ) {
      const bg = scene.background;
      const out = imagePath(slug, scene.id);
      jobs.push({
        sceneId: scene.id,
        kind: 'image',
        outPath: out,
        run: () =>
          existsSync(out)
            ? Promise.resolve(cachedResult(scene.id, 'image', out))
            : generateImage(slug, scene, {
                prompt: bg.prompt,
                aspect_ratio: bg.aspect_ratio,
                source: bg.source,
                model: bg.model,
                target_width: bg.target_width,
              }),
      });
      continue;
    }

    // split-screen: two media slots, may include generated content
    if (scene.type === 'split-screen') {
      for (const side of ['left', 'right'] as const) {
        const media = scene[side];
        const sceneId = `${scene.id}.${side}`;
        if (media.type === 'generated-image') {
          const out = resolve(assetsDir(slug), `${sceneId}.png`);
          jobs.push({
            sceneId,
            kind: 'image',
            outPath: out,
            run: () =>
              existsSync(out)
                ? Promise.resolve(cachedResult(sceneId, 'image', out))
                : (async () => {
                    const startedAt = Date.now();
                    const params: Record<string, string | number | boolean | string[]> = {
                      prompt: media.prompt,
                      resolution: pickImageResolution(media.target_width),
                    };
                    if (media.aspect_ratio) params.aspect_ratio = media.aspect_ratio;
                    const { credits, resultUrl } = await higgsfieldGenerate(
                      media.model ?? 'nano_banana_2',
                      params,
                    );
                    await downloadTo(resultUrl, out);
                    return {
                      sceneId,
                      path: out,
                      kind: 'image' as const,
                      source: 'higgsfield' as const,
                      cost: { credits },
                      durationMs: Date.now() - startedAt,
                    };
                  })(),
          });
        } else if (media.type === 'generated-clip') {
          const out = resolve(assetsDir(slug), `${sceneId}.mp4`);
          jobs.push({
            sceneId,
            kind: 'clip',
            outPath: out,
            run: () =>
              existsSync(out)
                ? Promise.resolve(cachedResult(sceneId, 'clip', out))
                : (async () => {
                    const startedAt = Date.now();
                    const params: Record<string, string | number | boolean | string[]> = {
                      prompt: media.prompt,
                      duration: media.duration,
                      aspect_ratio: media.aspect_ratio,
                      resolution: media.resolution,
                      mode: media.mode,
                    };
                    if (media.genre) params.genre = media.genre;
                    const { credits, resultUrl } = await higgsfieldGenerate(
                      media.model,
                      params,
                    );
                    await downloadTo(resultUrl, out);
                    return {
                      sceneId,
                      path: out,
                      kind: 'clip' as const,
                      source: 'higgsfield' as const,
                      cost: { credits },
                      durationMs: Date.now() - startedAt,
                    };
                  })(),
          });
        }
      }
      continue;
    }

    // lower-third: background media
    if (scene.type === 'lower-third') {
      const media = scene.background;
      if (media.type === 'generated-image') {
        const out = imagePath(slug, scene.id);
        jobs.push({
          sceneId: scene.id,
          kind: 'image',
          outPath: out,
          run: () =>
            existsSync(out)
              ? Promise.resolve(cachedResult(scene.id, 'image', out))
              : generateImage(slug, scene, {
                  prompt: media.prompt,
                  aspect_ratio: media.aspect_ratio,
                  source: media.source,
                  model: media.model,
                  target_width: media.target_width,
                }),
        });
      } else if (media.type === 'generated-clip') {
        const out = clipPath(slug, scene.id);
        jobs.push({
          sceneId: scene.id,
          kind: 'clip',
          outPath: out,
          run: () =>
            existsSync(out)
              ? Promise.resolve(cachedResult(scene.id, 'clip', out))
              : generateClip(slug, scene, {
                  model: media.model,
                  prompt: media.prompt,
                  duration: media.duration,
                  aspect_ratio: media.aspect_ratio,
                  resolution: media.resolution,
                  mode: media.mode,
                  genre: media.genre,
                  medias: media.medias,
                }),
        });
      }
    }
  }

  return jobs;
}

export async function generateSceneAssets(slug: string, scenes: Scenes): Promise<AssetMap> {
  const jobs = collectAssetJobs(slug, scenes);
  if (jobs.length === 0) {
    console.log('[assets] no generated assets needed; all scenes use library media or text only');
    return {};
  }

  const imageJobs = jobs.filter((j) => j.kind === 'image');
  const clipJobs = jobs.filter((j) => j.kind === 'clip');
  console.log(
    `[assets] ${jobs.length} total job(s): ${imageJobs.length} image(s) parallel, ${clipJobs.length} clip(s) serialized`,
  );

  const map: AssetMap = {};
  const failures: string[] = [];

  const captureResult = (jobMeta: AssetJob, settled: PromiseSettledResult<AssetResult>): void => {
    if (settled.status === 'fulfilled') {
      map[settled.value.sceneId] = settled.value;
      if (settled.value.durationMs > 0) {
        console.log(
          `[assets] ${settled.value.sceneId} (${settled.value.kind}) -> ${settled.value.path}  ${
            settled.value.cost.credits ?? 0
          } credits, ${(settled.value.durationMs / 1000).toFixed(1)}s`,
        );
      }
    } else {
      const msg = (settled.reason as Error).message;
      failures.push(`${jobMeta.sceneId}: ${msg}`);
      console.error(`[assets] FAILED ${jobMeta.sceneId}: ${msg}`);
    }
  };

  // Images in parallel: safe and faster.
  const imageSettled = await Promise.allSettled(imageJobs.map((j) => j.run()));
  imageJobs.forEach((j, i) => captureResult(j, imageSettled[i]!));

  // Video clips serialized: Higgsfield rejects too-many-parallel video jobs with
  // "not_enough_credits" even when balance is sufficient (reservation behavior on Plus tier).
  for (const job of clipJobs) {
    const settled = await Promise.allSettled([job.run()]);
    captureResult(job, settled[0]!);
  }

  if (failures.length > 0) {
    throw new Error(`Asset generation failed for ${failures.length} scene(s):\n${failures.join('\n')}`);
  }
  return map;
}
