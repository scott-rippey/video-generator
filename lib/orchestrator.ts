import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv, exit } from 'node:process';
import { briefPath, runDir, PATHS } from './config.ts';
import { readScenes, validateTimeline, type Scenes } from './scenes.ts';
import { generateVoiceover, generateMusic } from './audio.ts';
import { generateSceneAssets, type AssetMap } from './assets.ts';
import { renderTemplate, type ResolutionOverride } from './render.ts';

interface CliOptions {
  slug: string;
  variant: string | null;
  resolution: ResolutionOverride;
  template: string | null;
  yes: boolean;
  briefOnly: boolean;
}

function parseArgs(args: string[]): CliOptions {
  if (args.length === 0) {
    console.error(
      'Usage: tsx lib/orchestrator.ts <slug> [--template <name>] [--variant <name>] [--resolution <4k|1080p>] [--yes] [--brief-only]',
    );
    exit(1);
  }
  const opts: CliOptions = {
    slug: '',
    variant: null,
    resolution: null,
    template: null,
    yes: false,
    briefOnly: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--variant') opts.variant = args[++i] ?? null;
    else if (a === '--template') opts.template = args[++i] ?? null;
    else if (a === '--resolution') {
      const next = args[++i];
      if (next !== '4k' && next !== '1080p') {
        throw new Error(`--resolution must be 4k or 1080p (got ${next})`);
      }
      opts.resolution = next;
    } else if (a === '--yes' || a === '-y') opts.yes = true;
    else if (a === '--brief-only') opts.briefOnly = true;
    else if (!a.startsWith('--') && !opts.slug) opts.slug = a;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!opts.slug) throw new Error('Missing required slug argument.');
  return opts;
}

interface HfCostResponse {
  credits?: number;
  cost?: { credits?: number };
}

async function higgsfieldCost(model: string, params: Record<string, string | number>): Promise<number> {
  const args = ['generate', 'cost', model, '--json'];
  for (const [k, v] of Object.entries(params)) {
    // Higgsfield CLI uses underscore flag names, not dashes.
    args.push(`--${k}`, String(v));
  }
  const { code, stdout: out, stderr: err } = await runCmd('higgsfield', args);
  if (code !== 0) {
    // cost endpoint can be flaky for some models; fall back to 0 with a warning
    console.warn(`[cost] higgsfield generate cost ${model} failed: ${err.trim()}`);
    // Try to scrape a number from stdout: e.g., "22.5 credits"
    const m = out.match(/([\d.]+)\s*credits?/i);
    if (m) return parseFloat(m[1]!);
    return 0;
  }
  try {
    const parsed = JSON.parse(out) as HfCostResponse;
    return parsed.credits ?? parsed.cost?.credits ?? 0;
  } catch {
    // Some CLI versions just print "22.5 credits"
    const m = out.match(/([\d.]+)\s*credits?/i);
    if (m) return parseFloat(m[1]!);
    return 0;
  }
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function runCmd(cmd: string, args: string[]): Promise<RunResult> {
  return new Promise<RunResult>((resolveOk, rejectFail) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d: Buffer) => (out += d.toString()));
    proc.stderr.on('data', (d: Buffer) => (err += d.toString()));
    proc.on('error', rejectFail);
    proc.on('close', (code: number | null) =>
      resolveOk({ code: code ?? -1, stdout: out, stderr: err }),
    );
  });
}

interface CostEstimate {
  totalCredits: number;
  perScene: Array<{ sceneId: string; model: string; credits: number }>;
  elevenlabsVoiceoverChars: number;
  elevenlabsMusicSeconds: number;
}

async function estimateCost(scenes: Scenes): Promise<CostEstimate> {
  const perScene: CostEstimate['perScene'] = [];
  for (const scene of scenes.scenes) {
    if (scene.type === 'fullscreen-clip' && scene.clip.type === 'generated-clip') {
      const credits = await higgsfieldCost(scene.clip.model, {
        prompt: scene.clip.prompt,
        duration: scene.clip.duration,
        aspect_ratio: scene.clip.aspect_ratio,
        resolution: scene.clip.resolution,
        mode: scene.clip.mode,
      });
      perScene.push({ sceneId: scene.id, model: scene.clip.model, credits });
    } else if (
      (scene.type === 'text-overlay' || scene.type === 'generated-image-bg') &&
      scene.background.type === 'generated-image' &&
      (scene.background.source ?? 'higgsfield') === 'higgsfield'
    ) {
      const model = scene.background.model ?? 'nano_banana_2';
      const credits = await higgsfieldCost(model, { prompt: scene.background.prompt });
      perScene.push({ sceneId: scene.id, model, credits });
    } else if (scene.type === 'split-screen') {
      for (const side of ['left', 'right'] as const) {
        const m = scene[side];
        if (m.type === 'generated-image' && (m.source ?? 'higgsfield') === 'higgsfield') {
          const model = m.model ?? 'nano_banana_2';
          const credits = await higgsfieldCost(model, { prompt: m.prompt });
          perScene.push({ sceneId: `${scene.id}.${side}`, model, credits });
        } else if (m.type === 'generated-clip') {
          const credits = await higgsfieldCost(m.model, {
            prompt: m.prompt,
            duration: m.duration,
            aspect_ratio: m.aspect_ratio,
            resolution: m.resolution,
            mode: m.mode,
          });
          perScene.push({ sceneId: `${scene.id}.${side}`, model: m.model, credits });
        }
      }
    }
  }
  return {
    totalCredits: perScene.reduce((a, b) => a + b.credits, 0),
    perScene,
    elevenlabsVoiceoverChars: scenes.voiceover.script.length,
    elevenlabsMusicSeconds:
      scenes.music.source === 'elevenlabs-music' ? scenes.music.duration_seconds : 0,
  };
}

function printSummary(scenes: Scenes, est: CostEstimate, resolution: ResolutionOverride): void {
  const fmt =
    resolution === '4k'
      ? '4K override'
      : resolution === '1080p'
        ? '1080p override'
        : `${scenes.format.width}x${scenes.format.height}@${scenes.format.fps}`;
  console.log('');
  console.log('=== Render Plan ===');
  console.log(`  slug:           ${scenes.slug}`);
  console.log(`  template:       ${scenes.template}`);
  console.log(`  duration:       ${scenes.duration_seconds}s, ${scenes.scenes.length} scenes`);
  console.log(`  format:         ${fmt}`);
  console.log(`  brand:          ${scenes.brand ?? '(workspace defaults)'}`);
  console.log('');
  console.log('  Higgsfield assets:');
  if (est.perScene.length === 0) {
    console.log('    (none)');
  } else {
    for (const p of est.perScene) {
      console.log(`    ${p.sceneId.padEnd(28)} ${p.model.padEnd(20)} ~${p.credits} credits`);
    }
  }
  console.log('');
  console.log(`  TOTAL HIGGSFIELD: ~${est.totalCredits.toFixed(1)} credits`);
  console.log(`  ElevenLabs voiceover: ${est.elevenlabsVoiceoverChars} chars`);
  console.log(`  ElevenLabs music:     ${est.elevenlabsMusicSeconds}s`);
  console.log('');
}

async function confirm(question: string): Promise<boolean> {
  if (!stdin.isTTY) {
    console.error('[orchestrator] non-TTY; pass --yes to skip confirmation gate');
    return false;
  }
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

interface RunVideoResult {
  finalPath: string;
  generationDurationMs: number;
  renderDurationMs: number;
  cost: {
    higgsfield_credits: number;
    elevenlabs_voiceover_chars: number;
    elevenlabs_music_chars_or_seconds: number;
  };
}

export async function runVideo(opts: CliOptions): Promise<RunVideoResult> {
  const bPath = briefPath(opts.slug);
  if (!existsSync(bPath)) {
    throw new Error(
      `Brief not found at ${bPath}. Drop a markdown brief at briefs/${opts.slug}.md first.`,
    );
  }

  const rDir = runDir(opts.slug);
  const scenesPath = resolve(rDir, 'scenes.json');
  if (!existsSync(scenesPath)) {
    throw new Error(
      `scenes.json not found at ${scenesPath}.\nExpand the brief in Claude Code first (run "/brief ${opts.slug}" or ask Claude to apply prompts/expand-brief.md to briefs/${opts.slug}.md).`,
    );
  }

  // Copy the brief into the run dir for record
  mkdirSync(rDir, { recursive: true });
  copyFileSync(bPath, resolve(rDir, 'brief.md'));

  const scenes = readScenes(opts.slug);
  validateTimeline(scenes);

  if (opts.template && opts.template !== scenes.template) {
    console.log(`[orchestrator] --template override: ${scenes.template} -> ${opts.template}`);
    scenes.template = opts.template;
  }

  if (opts.briefOnly) {
    console.log(`[orchestrator] --brief-only: scenes.json is at ${scenesPath}`);
    console.log('Run again without --brief-only to generate assets and render.');
    return {
      finalPath: '',
      generationDurationMs: 0,
      renderDurationMs: 0,
      cost: { higgsfield_credits: 0, elevenlabs_voiceover_chars: 0, elevenlabs_music_chars_or_seconds: 0 },
    };
  }

  const est = await estimateCost(scenes);
  printSummary(scenes, est, opts.resolution);

  if (!opts.yes) {
    const ok = await confirm('Proceed with generation and burn the credits/characters above?');
    if (!ok) {
      console.log('Aborted before burning credits.');
      exit(0);
    }
  }

  // Audio and per-scene assets are cached independently. The audio functions
  // are self-caching at the file level (raw + leveled), so always call them:
  // they no-op when outputs exist, regen when the user deletes a file to iterate.
  // Per-scene clip/image gen is the expensive part and is gated by a marker.
  const assetsExistMarker = resolve(rDir, 'assets', '.complete');
  let assets: AssetMap = {};

  const generationStart = Date.now();
  console.log('[orchestrator] === GENERATION PHASE (cloud, parallel) ===');
  // Validate the marker: even if it exists, regen if any cached asset file
  // is missing on disk (user deleted one to iterate on a single scene).
  // generateSceneAssets is per-scene-cached internally, so this only regens
  // the missing scenes, not the whole batch.
  let skipClipGen = false;
  if (existsSync(assetsExistMarker)) {
    try {
      const cachedMap = JSON.parse(
        readFileSync(assetsExistMarker, 'utf8'),
      ) as AssetMap;
      const allExist = Object.values(cachedMap).every((r) =>
        existsSync(r.path),
      );
      if (allExist) {
        skipClipGen = true;
        console.log('[orchestrator] per-scene assets cached; voice/music will refresh if files were deleted');
      } else {
        console.log('[orchestrator] cache marker stale (one or more asset files missing); regenerating only the missing scenes');
      }
    } catch {
      console.log('[orchestrator] cache marker unreadable; regenerating');
    }
  }
  const [voiceover, music, am] = await Promise.all([
    generateVoiceover(opts.slug, scenes),
    generateMusic(opts.slug, scenes),
    skipClipGen
      ? (JSON.parse(readFileSync(assetsExistMarker, 'utf8')) as AssetMap)
      : generateSceneAssets(opts.slug, scenes),
  ]);
  assets = am;
  if (!skipClipGen) {
    writeFileSync(assetsExistMarker, JSON.stringify(assets, null, 2));
  }
  const generationDurationMs = Date.now() - generationStart;
  console.log(`[orchestrator] generation phase complete in ${(generationDurationMs / 1000).toFixed(1)}s`);

  console.log('');
  console.log('[orchestrator] === RENDER PHASE (local Remotion) ===');
  const renderStart = Date.now();
  const renderResult = await renderTemplate(opts.slug, scenes, {
    variant: opts.variant ?? undefined,
    resolution: opts.resolution,
    voiceover: voiceover!,
    music: music!,
    assets,
  });
  const renderDurationMs = Date.now() - renderStart;
  console.log(`[orchestrator] render phase complete in ${(renderDurationMs / 1000).toFixed(1)}s`);

  const metadata = {
    slug: opts.slug,
    template: scenes.template,
    format: { width: renderResult.width, height: renderResult.height, fps: renderResult.fps },
    durations: {
      video_seconds: scenes.duration_seconds,
      generation_ms: generationDurationMs,
      render_ms: renderDurationMs,
      total_ms: generationDurationMs + renderDurationMs,
    },
    cost: {
      higgsfield_credits: est.totalCredits,
      elevenlabs_voiceover_chars: voiceover!.charactersUsed,
      elevenlabs_music_chars_or_seconds: music!.charactersUsed,
    },
    assets: Object.entries(assets).map(([id, r]) => ({
      sceneId: id,
      kind: r.kind,
      source: r.source,
      path: r.path,
      credits: r.cost.credits ?? 0,
    })),
    voiceover_path: voiceover!.path,
    music_path: music!.path,
    final_path: renderResult.path,
    ran_at: new Date().toISOString(),
  };
  const metadataPath = resolve(rDir, 'metadata.json');
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n');

  console.log('');
  console.log(`Done. Video at ${renderResult.path}.`);
  console.log(
    `Generation took ${(generationDurationMs / 1000).toFixed(1)}s, render took ${(renderDurationMs / 1000).toFixed(1)}s.`,
  );
  console.log(
    `Total cost: ~${est.totalCredits.toFixed(1)} Higgsfield credits + ${voiceover!.charactersUsed} TTS chars.`,
  );

  return {
    finalPath: renderResult.path,
    generationDurationMs,
    renderDurationMs,
    cost: {
      higgsfield_credits: est.totalCredits,
      elevenlabs_voiceover_chars: voiceover!.charactersUsed,
      elevenlabs_music_chars_or_seconds: music!.charactersUsed,
    },
  };
}

// ---------- CLI entrypoint ----------

const opts = parseArgs(argv.slice(2));
runVideo(opts).catch((err: Error) => {
  console.error('\n[orchestrator] FAILED:', err.message);
  exit(1);
});
