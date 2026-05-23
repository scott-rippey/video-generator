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

// `eleven_multilingual_v2` only weakly honors <break> SSML tags (gives ~270ms
// regardless of requested duration). To make break tags reliable we split the
// script on break tags, TTS each text segment separately, generate real silence
// via ffmpeg between, and concat. Result: requested break time is honored exactly.
type ScriptPart =
  | { type: 'text'; text: string }
  | { type: 'silence'; ms: number };

function parseScriptParts(script: string): ScriptPart[] {
  const parts: ScriptPart[] = [];
  const breakRe = /<break\s+time\s*=\s*"(\d+)ms"\s*\/?\s*>/gi;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = breakRe.exec(script)) !== null) {
    const before = script.slice(lastIdx, match.index).trim();
    if (before) parts.push({ type: 'text', text: before });
    parts.push({ type: 'silence', ms: parseInt(match[1]!, 10) });
    lastIdx = match.index + match[0].length;
  }
  const after = script.slice(lastIdx).trim();
  if (after) parts.push({ type: 'text', text: after });
  return parts;
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
    // 1. Split script on <break> tags into text/silence parts.
    // 2. Further chunk long text parts (ElevenLabs ~2500-char limit).
    // 3. Generate audio for each part: TTS for text, ffmpeg anullsrc for silence.
    // 4. Concat all parts in order to produce raw voiceover.
    const parts = parseScriptParts(voiceover.script);
    const partPaths: string[] = [];
    const totalTextChars = parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .reduce((sum, p) => sum + p.text.length, 0);
    const silenceCount = parts.filter((p) => p.type === 'silence').length;
    console.log(
      `[audio] voiceover: ${totalTextChars} text chars, ${silenceCount} <break> tag(s), ${parts.length} parts`,
    );

    let partIdx = 0;
    for (const part of parts) {
      if (part.type === 'silence') {
        const silencePath = resolve(dir, `voiceover.part-${partIdx}.silence.mp3`);
        await ffmpeg(
          [
            '-y',
            '-f',
            'lavfi',
            '-i',
            'anullsrc=r=44100:cl=stereo',
            '-t',
            (part.ms / 1000).toString(),
            '-c:a',
            'libmp3lame',
            '-b:a',
            '128k',
            silencePath,
          ],
          `silence ${part.ms}ms`,
        );
        partPaths.push(silencePath);
        console.log(`[audio] voiceover part ${partIdx + 1}/${parts.length} silence ${part.ms}ms`);
        partIdx++;
        continue;
      }
      // Text part — may need further chunking for very long segments.
      const textChunks = chunkScript(part.text);
      for (const chunk of textChunks) {
        const chunkPath = resolve(dir, `voiceover.part-${partIdx}.mp3`);
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
          throw new Error(`ElevenLabs TTS part ${partIdx} failed (${res.statusCode}): ${text}`);
        }
        const buf = Buffer.from(await res.body.arrayBuffer());
        writeFileSync(chunkPath, buf);
        partPaths.push(chunkPath);
        console.log(
          `[audio] voiceover part ${partIdx + 1}/${parts.length} text ${chunk.length} chars (${buf.length} bytes)`,
        );
        partIdx++;
      }
    }

    if (partPaths.length === 1) {
      copyFileSync(partPaths[0]!, rawPath);
    } else {
      const listFile = resolve(dir, 'voiceover.concat.txt');
      writeFileSync(
        listFile,
        partPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'),
      );
      // Re-encode (not -c copy) because ElevenLabs MP3s and ffmpeg-generated
      // silence MP3s have different encoder parameters; concat-demuxer with
      // -c copy silently drops content when those mismatch.
      await ffmpeg(
        [
          '-y',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          listFile,
          '-c:a',
          'libmp3lame',
          '-b:a',
          '192k',
          rawPath,
        ],
        'voiceover concat',
      );
    }
    charactersUsed = totalTextChars;
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
