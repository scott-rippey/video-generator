import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia } from '@remotion/renderer';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename, extname } from 'node:path';
import { PATHS, runDir, videoOutputPath, resolveBrand, WORKSPACE_ROOT } from './config.ts';
import type { Scenes } from './scenes.ts';
import type { AssetMap } from './assets.ts';
import type { MusicResult, VoiceoverResult } from './audio.ts';

export type ResolutionOverride = '4k' | '1080p' | null;

export interface RenderOptions {
  variant?: string;
  resolution?: ResolutionOverride;
  voiceover: VoiceoverResult;
  music: MusicResult;
  assets: AssetMap;
}

export interface RenderResult {
  path: string;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
}

function templateEntry(templateName: string): string {
  const entry = resolve(PATHS.templates, templateName, 'index.ts');
  if (!existsSync(entry)) {
    throw new Error(
      `Template entry not found: ${entry}. Templates need an index.ts that registers compositions.`,
    );
  }
  return entry;
}

function resolveFormat(scenes: Scenes, override: ResolutionOverride) {
  const { width, height, fps } = scenes.format;
  if (override === '1080p') {
    if (width >= height) return { width: 1920, height: 1080, fps };
    return { width: 1080, height: 1920, fps };
  }
  if (override === '4k') {
    if (width >= height) return { width: 3840, height: 2160, fps };
    return { width: 2160, height: 3840, fps };
  }
  return { width, height, fps };
}

/**
 * Stage all assets for this render into a flat per-render publicDir so the
 * Remotion bundler/renderer can reach them via staticFile(). Remotion does
 * not allow absolute filesystem paths from <Img>/<OffthreadVideo>/<Audio>
 * because Chromium blocks file:// during render. The staging dir contains:
 *   _public/
 *     voiceover.mp3
 *     music.mp3              (optional)
 *     assets/<sceneId>.<ext>
 */
function stagePublicDir(
  slug: string,
  scenes: Scenes,
  voiceover: VoiceoverResult,
  music: MusicResult,
  assets: AssetMap,
): {
  publicDir: string;
  voiceoverFile: string;
  musicFile: string | null;
  assetMap: Record<string, string>;
} {
  const publicDir = resolve(runDir(slug), 'render', '_public');
  const assetsDir = resolve(publicDir, 'assets');
  mkdirSync(assetsDir, { recursive: true });

  // Voiceover
  const voiceoverFile = 'voiceover.mp3';
  copyFileSync(voiceover.path, resolve(publicDir, voiceoverFile));

  // Music (optional)
  let musicFile: string | null = null;
  if (music.path && existsSync(music.path)) {
    musicFile = 'music.mp3';
    copyFileSync(music.path, resolve(publicDir, musicFile));
  }

  // Per-scene assets (generated)
  const assetMap: Record<string, string> = {};
  for (const [sceneId, r] of Object.entries(assets)) {
    const fileName = basename(r.path);
    const stagedPath = resolve(assetsDir, fileName);
    copyFileSync(r.path, stagedPath);
    assetMap[sceneId] = `assets/${fileName}`;
  }

  // Library files referenced from scenes (not generated, but must be staged)
  const stageLibrary = (sceneId: string, filePath: string): void => {
    const src = resolve(WORKSPACE_ROOT, filePath);
    if (!existsSync(src)) {
      throw new Error(
        `Library file referenced by scene ${sceneId} not found: ${src}`,
      );
    }
    const ext = extname(filePath);
    const fileName = `${sceneId.replace(/[^a-zA-Z0-9._-]/g, '_')}${ext}`;
    copyFileSync(src, resolve(assetsDir, fileName));
    assetMap[sceneId] = `assets/${fileName}`;
  };

  // SFX files (any scene type can declare sfx entries)
  const stagedSfx = new Set<string>();
  const stageSfx = (filePath: string): void => {
    if (stagedSfx.has(filePath)) return;
    const src = resolve(WORKSPACE_ROOT, filePath);
    if (!existsSync(src)) {
      throw new Error(`SFX file not found: ${src}`);
    }
    const stagedRel = filePath.startsWith('assets-library/')
      ? filePath.slice('assets-library/'.length)
      : basename(filePath);
    const dst = resolve(publicDir, stagedRel);
    mkdirSync(resolve(dst, '..'), { recursive: true });
    copyFileSync(src, dst);
    stagedSfx.add(filePath);
  };
  for (const scene of scenes.scenes) {
    for (const s of scene.sfx ?? []) {
      stageSfx(s.file);
    }
  }

  for (const scene of scenes.scenes) {
    if (scene.type === 'library-clip') {
      stageLibrary(scene.id, scene.clip.file);
    } else if (scene.type === 'text-overlay' && scene.background.type === 'library-image') {
      stageLibrary(scene.id, scene.background.file);
    } else if (
      scene.type === 'lower-third' &&
      (scene.background.type === 'library-image' || scene.background.type === 'library-clip')
    ) {
      stageLibrary(scene.id, scene.background.file);
    } else if (scene.type === 'split-screen') {
      for (const side of ['left', 'right'] as const) {
        const m = scene[side];
        if (m.type === 'library-image' || m.type === 'library-clip') {
          stageLibrary(`${scene.id}.${side}`, m.file);
        }
      }
    } else if (scene.type === 'fullscreen-clip' && scene.clip.type === 'library-clip') {
      stageLibrary(scene.id, scene.clip.file);
    } else if (scene.type === 'ui-static-reveal' || scene.type === 'ui-form-fill') {
      stageLibrary(scene.id, scene.image.file);
    } else if (scene.type === 'outro-clip') {
      stageLibrary(scene.id, scene.clip.file);
    }
  }

  return { publicDir, voiceoverFile, musicFile, assetMap };
}

export async function renderTemplate(
  slug: string,
  scenes: Scenes,
  options: RenderOptions,
): Promise<RenderResult> {
  const startedAt = Date.now();
  const entry = templateEntry(scenes.template);

  console.log(`[render] staging publicDir for ${slug}`);
  const { publicDir, voiceoverFile, musicFile, assetMap } = stagePublicDir(
    slug,
    scenes,
    options.voiceover,
    options.music,
    options.assets,
  );

  console.log(`[render] bundling template ${scenes.template} from ${entry}`);
  const serveUrl = await bundle({
    entryPoint: entry,
    publicDir,
    webpackOverride: (config) => config,
    enableCaching: true,
  });

  const format = resolveFormat(scenes, options.resolution ?? null);
  const brand = resolveBrand(scenes.brand);
  const inputProps = {
    scenes,
    format,
    brand,
    voiceoverFile,
    musicFile,
    assetMap,
    slug,
  } as Record<string, unknown>;

  const compositionId = 'Main';
  console.log(
    `[render] selecting composition '${compositionId}' at ${format.width}x${format.height}@${format.fps}`,
  );
  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps,
  });

  const durationInFrames = Math.round(scenes.duration_seconds * format.fps);
  const compositionForRender = {
    ...composition,
    width: format.width,
    height: format.height,
    fps: format.fps,
    durationInFrames,
  };

  const renderRoot = resolve(runDir(slug), 'render');
  mkdirSync(renderRoot, { recursive: true });
  const intermediatePath = resolve(renderRoot, 'out.mp4');

  console.log(`[render] rendering ${durationInFrames} frames to ${intermediatePath}`);
  let lastPct = -1;
  await renderMedia({
    composition: compositionForRender,
    serveUrl,
    codec: 'h264',
    outputLocation: intermediatePath,
    inputProps,
    chromiumOptions: { headless: true },
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct !== lastPct && pct % 10 === 0) {
        lastPct = pct;
        console.log(`[render] ${pct}%`);
      }
    },
  });

  const finalPath = videoOutputPath(slug, options.variant ?? options.resolution ?? undefined);
  mkdirSync(dirname(finalPath), { recursive: true });
  copyFileSync(intermediatePath, finalPath);
  console.log(`[render] copied final to ${finalPath}`);

  return {
    path: finalPath,
    width: format.width,
    height: format.height,
    fps: format.fps,
    durationMs: Date.now() - startedAt,
  };
}
