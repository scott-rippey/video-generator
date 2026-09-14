// Cut one scene's stretch out of the leveled master voiceover.
//
//   tsx lib/vo-segment.ts <slug> <scene-id> [--out <path>]
//
// Why: an avatar render (HeyGen, or anything audio-driven) lip-syncs to the
// audio it is given, and its output length matches that audio to the
// millisecond. Cutting the segment from the SAME voiceover.mp3 that the
// composition plays means the clip lines up exactly when placed at the scene's
// start with the master track underneath (library clip stays muted). One voice
// track, no duplicated script. See .claude/skills/heygen/SKILL.md.
//
// Requires runs/<slug>/audio/voiceover.mp3 (tsx lib/orchestrator.ts <slug> --audio-only).

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { argv, exit } from 'node:process';
import { runDir } from './config.ts';
import { readScenes } from './scenes.ts';

function usage(): never {
  console.error('Usage: tsx lib/vo-segment.ts <slug> <scene-id> [--out <path>]');
  exit(1);
}

const args = argv.slice(2);
let slug = '';
let sceneId = '';
let out: string | null = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i]!;
  if (a === '--out') out = args[++i] ?? null;
  else if (!slug) slug = a;
  else if (!sceneId) sceneId = a;
  else usage();
}
if (!slug || !sceneId) usage();

const scenes = readScenes(slug);
const scene = scenes.scenes.find((s) => s.id === sceneId);
if (!scene) {
  console.error(`Scene '${sceneId}' not found in runs/${slug}/scenes.json. Scenes: ${scenes.scenes.map((s) => s.id).join(', ')}`);
  exit(1);
}

const audioDir = resolve(runDir(slug), 'audio');
const master = resolve(audioDir, 'voiceover.mp3');
if (!existsSync(master)) {
  console.error(`Master voiceover not found at ${master}.\nRun: tsx lib/orchestrator.ts ${slug} --audio-only`);
  exit(1);
}
const target = out ? resolve(out) : resolve(audioDir, `${sceneId}.vo.mp3`);

// -ss after -i for sample-accurate seeking; re-encode so the cut is exact.
const ffArgs = [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-i', master,
  '-ss', scene.start.toFixed(3),
  '-t', scene.duration.toFixed(3),
  '-c:a', 'libmp3lame', '-b:a', '192k',
  target,
];
const proc = spawn('ffmpeg', ffArgs, { stdio: ['ignore', 'inherit', 'inherit'] });
proc.on('close', (code) => {
  if (code !== 0) {
    console.error(`ffmpeg failed (exit ${code})`);
    exit(1);
  }
  console.log(`${target}`);
  console.log(`scene ${sceneId}: start ${scene.start}s, duration ${scene.duration}s`);
});
