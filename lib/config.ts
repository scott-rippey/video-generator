import { config as dotenvConfig } from 'dotenv';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const WORKSPACE_ROOT = resolve(__dirname, '..');

dotenvConfig({ path: resolve(WORKSPACE_ROOT, '.env') });

export interface VoiceConfig {
  id: string;
  name?: string;
  model?: string;
  settings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

export interface BrandColors {
  primary?: string;
  accent?: string;
  background?: string;
  text?: string;
  muted?: string;
}

export interface BrandFonts {
  primary?: string;
  display?: string;
  weights?: number[];
}

export interface Brand {
  voice: VoiceConfig;
  colors: BrandColors;
  fonts: BrandFonts;
  logo_path: string | null;
  tone: string;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function loadRootBrand(): Brand {
  const path = resolve(WORKSPACE_ROOT, 'brand.json');
  const raw = readJson<Partial<Brand> & { voice: VoiceConfig }>(path);
  if (!raw.voice?.id) {
    throw new Error('brand.json must include voice.id');
  }
  return {
    voice: raw.voice,
    colors: raw.colors ?? {},
    fonts: raw.fonts ?? {},
    logo_path: raw.logo_path ?? null,
    tone: raw.tone ?? '',
  };
}

/**
 * Resolves the effective brand for a brief.
 * If brandName is provided and assets-library/brand/<name>/brand.json exists,
 * its fields shallow-merge onto the workspace root brand. voice.id is never overridden.
 */
export function resolveBrand(brandName?: string | null): Brand {
  const root = loadRootBrand();
  if (!brandName) return root;

  const overridePath = resolve(
    WORKSPACE_ROOT,
    'assets-library',
    'brand',
    brandName,
    'brand.json',
  );
  if (!existsSync(overridePath)) {
    console.warn(`[config] brand '${brandName}' not found at ${overridePath}; using root defaults`);
    return root;
  }

  const override = readJson<Partial<Brand>>(overridePath);
  return {
    voice: {
      id: root.voice.id,
      name: override.voice?.name ?? root.voice.name,
      model: override.voice?.model ?? root.voice.model,
      settings: { ...root.voice.settings, ...override.voice?.settings },
    },
    colors: { ...root.colors, ...override.colors },
    fonts: { ...root.fonts, ...override.fonts },
    logo_path: override.logo_path ?? root.logo_path,
    tone: override.tone ?? root.tone,
  };
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}. Check .env.`);
  return v;
}

export interface EnvConfig {
  elevenlabs: {
    apiKey: string;
    musicEndpoint: string;
    ttsEndpoint: string;
  };
  modal: {
    tokenId: string;
    tokenSecret: string;
  };
}

export function loadEnv(): EnvConfig {
  return {
    elevenlabs: {
      apiKey: required('ELEVENLABS_API_KEY'),
      musicEndpoint: 'https://api.elevenlabs.io/v1/music',
      ttsEndpoint: 'https://api.elevenlabs.io/v1/text-to-speech',
    },
    modal: {
      tokenId: required('MODAL_TOKEN_ID'),
      tokenSecret: required('MODAL_TOKEN_SECRET'),
    },
  };
}

export const PATHS = {
  briefs: resolve(WORKSPACE_ROOT, 'briefs'),
  videos: resolve(WORKSPACE_ROOT, 'videos'),
  runs: resolve(WORKSPACE_ROOT, 'runs'),
  templates: resolve(WORKSPACE_ROOT, 'templates'),
  assetsLibrary: resolve(WORKSPACE_ROOT, 'assets-library'),
  prompts: resolve(WORKSPACE_ROOT, 'prompts'),
  modalJobs: resolve(WORKSPACE_ROOT, 'modal_jobs'),
} as const;

export function runDir(slug: string): string {
  return resolve(PATHS.runs, slug);
}

export function briefPath(slug: string): string {
  return resolve(PATHS.briefs, `${slug}.md`);
}

export function videoOutputPath(slug: string, variant?: string): string {
  const name = variant ? `${slug}-${variant}.mp4` : `${slug}.mp4`;
  return resolve(PATHS.videos, name);
}
