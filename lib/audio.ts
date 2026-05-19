import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { request } from 'undici';
import { loadEnv, runDir, WORKSPACE_ROOT } from './config.ts';
import type { Scenes } from './scenes.ts';

const env = loadEnv();

// ---------- Helpers ----------

function audioDir(slug: string): string {
  const dir = resolve(runDir(slug), 'audio');
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function ffmpeg(args: string[], label: string): Promise<void> {
  await new Promise<void>((resolveOk, rejectFail) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    proc.on('error', rejectFail);
    proc.on('close', (code: number | null) => {
      if (code === 0) resolveOk();
      else rejectFail(new Error(`ffmpeg ${label} failed (exit ${code}):\n${stderr}`));
    });
  });
}

/**
 * Splits a long script into chunks at sentence boundaries.
 * ElevenLabs handles ~5000 chars per request comfortably; we cap at ~2500
 * to keep latency reasonable and reduce the long-voiceover volume fade issue.
 */
function chunkScript(script: string, maxChars = 2500): string[] {
  if (script.length <= maxChars) return [script];
  const sentences = script.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if ((current + ' ' + s).trim().length > maxChars && current) {
      chunks.push(current.trim());
      current = s;
    } else {
      current = (current ? current + ' ' : '') + s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ---------- Voiceover ----------

export interface VoiceoverResult {
  path: string;
  durationSeconds: number;
  charactersUsed: number;
}

// Voiceover loudness/levelling chain.
// dynaudnorm smooths per-chunk volume swings (ElevenLabs is known to fade volume across long generations).
// loudnorm targets a consistent integrated loudness (-14 LUFS, broadcast-loud for video) with a -1.5 dBTP
// true-peak limiter to prevent clipping. The result is voice that stays evenly present front to back.
const VOICEOVER_FILTER = 'dynaudnorm=p=0.95:s=20:f=200:g=11,loudnorm=I=-14:TP=-1.5:LRA=7';

export async function generateVoiceover(slug: string, scenes: Scenes): Promise<VoiceoverResult> {
  const { voiceover } = scenes;
  if (voiceover.source !== 'elevenlabs') {
    throw new Error(`Unsupported voiceover source: ${(voiceover as { source: string }).source}`);
  }

  const dir = audioDir(slug);
  const finalPath = resolve(dir, 'voiceover.mp3');
  const rawPath = resolve(dir, 'voiceover.raw.mp3');

  // Full cache hit: nothing to do.
  if (existsSync(finalPath)) {
    const duration = await probeDuration(finalPath);
    console.log(`[audio] voiceover CACHED at ${finalPath} (${duration.toFixed(1)}s)`);
    return { path: finalPath, durationSeconds: duration, charactersUsed: 0 };
  }

  // Raw cache hit: skip the ElevenLabs API call and just re-apply the leveller.
  // Iterating on audio post-processing is free this way.
  let charactersUsed = 0;
  if (!existsSync(rawPath)) {
    const chunks = chunkScript(voiceover.script);
    const chunkPaths: string[] = [];
    console.log(`[audio] voiceover: ${voiceover.script.length} chars, ${chunks.length} chunk(s)`);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const chunkPath = resolve(dir, `voiceover.chunk-${i}.mp3`);
      const url = `${env.elevenlabs.ttsEndpoint}/${voiceover.voice_id}?output_format=mp3_44100_128`;
      const body = {
        text: chunk,
        model_id: voiceover.model_id,
        voice_settings: voiceover.settings ?? {
          stability: 0.5,
          similarity_boost: 0.78,
          style: 0,
        },
      };
      const res = await request(url, {
        method: 'POST',
        headers: {
          'xi-api-key': env.elevenlabs.apiKey,
          'content-type': 'application/json',
          accept: 'audio/mpeg',
        },
        body: JSON.stringify(body),
      });
      if (res.statusCode !== 200) {
        const text = await res.body.text();
        throw new Error(`ElevenLabs TTS chunk ${i} failed (${res.statusCode}): ${text}`);
      }
      const buf = Buffer.from(await res.body.arrayBuffer());
      writeFileSync(chunkPath, buf);
      chunkPaths.push(chunkPath);
      console.log(`[audio] voiceover chunk ${i + 1}/${chunks.length} written (${buf.length} bytes)`);
    }

    if (chunkPaths.length === 1) {
      copyFileSync(chunkPaths[0]!, rawPath);
    } else {
      const listFile = resolve(dir, 'voiceover.concat.txt');
      writeFileSync(
        listFile,
        chunkPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'),
      );
      await ffmpeg(
        ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', rawPath],
        'voiceover concat',
      );
    }
    charactersUsed = voiceover.script.length;
  } else {
    console.log(`[audio] voiceover.raw.mp3 cached; re-applying leveller without TTS API call`);
  }

  await ffmpeg(
    [
      '-y',
      '-i',
      rawPath,
      '-af',
      VOICEOVER_FILTER,
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      finalPath,
    ],
    'voiceover leveller',
  );

  const duration = await probeDuration(finalPath);
  return { path: finalPath, durationSeconds: duration, charactersUsed };
}

// ---------- Music ----------

export interface MusicResult {
  path: string;
  durationSeconds: number;
  source: 'elevenlabs-music' | 'library' | 'none';
  charactersUsed: number;
}

export async function generateMusic(slug: string, scenes: Scenes): Promise<MusicResult> {
  const dir = audioDir(slug);
  const { music } = scenes;
  const finalPath = resolve(dir, 'music.mp3');

  if (music.source === 'none') {
    return { path: '', durationSeconds: 0, source: 'none', charactersUsed: 0 };
  }

  if (existsSync(finalPath)) {
    const duration = await probeDuration(finalPath);
    console.log(`[audio] music CACHED at ${finalPath} (${duration.toFixed(1)}s)`);
    return {
      path: finalPath,
      durationSeconds: duration,
      source: music.source,
      charactersUsed: 0,
    };
  }

  // Music levelling chain: loudnorm to -22 LUFS (sits comfortably under voice),
  // then afade-out at the end. Music gets normalized BEFORE the fade so the fade is clean.
  const musicFilter = `loudnorm=I=-22:TP=-1.5:LRA=9,afade=t=out:st=${(music.duration_seconds - 1.5).toFixed(2)}:d=1.5`;

  if (music.source === 'library') {
    const src = resolve(WORKSPACE_ROOT, music.file);
    if (!existsSync(src)) {
      throw new Error(`Library music file not found: ${src}`);
    }
    await ffmpeg(
      [
        '-y',
        '-i',
        src,
        '-t',
        music.duration_seconds.toString(),
        '-af',
        musicFilter,
        '-c:a',
        'libmp3lame',
        '-b:a',
        '192k',
        finalPath,
      ],
      'library music level+fade',
    );
    return {
      path: finalPath,
      durationSeconds: music.duration_seconds,
      source: 'library',
      charactersUsed: 0,
    };
  }

  const rawPath = resolve(dir, 'music.raw.mp3');
  let charactersUsed = 0;
  if (!existsSync(rawPath)) {
    const lengthMs = Math.round(music.duration_seconds * 1000);
    if (lengthMs < 3000 || lengthMs > 600000) {
      throw new Error(
        `music_length_ms must be between 3000 and 600000; got ${lengthMs} (${music.duration_seconds}s)`,
      );
    }
    const url = `${env.elevenlabs.musicEndpoint}?output_format=mp3_44100_192`;
    const body: Record<string, unknown> = {
      prompt: music.prompt,
      music_length_ms: lengthMs,
      model_id: music.model_id,
    };
    if (music.force_instrumental !== undefined) {
      body.force_instrumental = music.force_instrumental;
    }
    console.log(`[audio] music: ${music.duration_seconds}s, prompt="${music.prompt.slice(0, 80)}..."`);
    const res = await request(url, {
      method: 'POST',
      headers: {
        'xi-api-key': env.elevenlabs.apiKey,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify(body),
    });
    if (res.statusCode !== 200) {
      const text = await res.body.text();
      throw new Error(`ElevenLabs Music failed (${res.statusCode}): ${text}`);
    }
    const buf = Buffer.from(await res.body.arrayBuffer());
    writeFileSync(rawPath, buf);
    charactersUsed = music.prompt.length;
  } else {
    console.log(`[audio] music.raw.mp3 cached; re-applying leveller without API call`);
  }

  await ffmpeg(
    [
      '-y',
      '-i',
      rawPath,
      '-t',
      music.duration_seconds.toString(),
      '-af',
      musicFilter,
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      finalPath,
    ],
    'music level+fade',
  );

  return {
    path: finalPath,
    durationSeconds: music.duration_seconds,
    source: 'elevenlabs-music',
    charactersUsed,
  };
}

// ---------- ffprobe helper ----------

async function probeDuration(path: string): Promise<number> {
  return new Promise<number>((resolveOk, rejectFail) => {
    const proc = spawn(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    proc.on('error', rejectFail);
    proc.on('close', (code: number | null) => {
      if (code !== 0) {
        rejectFail(new Error(`ffprobe failed (exit ${code}): ${stderr}`));
        return;
      }
      const seconds = parseFloat(stdout.trim());
      if (Number.isNaN(seconds)) {
        rejectFail(new Error(`ffprobe returned non-numeric: ${stdout}`));
        return;
      }
      resolveOk(seconds);
    });
  });
}
