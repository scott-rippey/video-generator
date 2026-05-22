import React from 'react';
import { staticFile } from 'remotion';
import type { Scene } from '../../../lib/scenes.ts';
import type { Brand } from '../../../lib/config.ts';
import { TextOverlayScene } from './TextOverlayScene.tsx';
import { FullscreenClipScene } from './FullscreenClipScene.tsx';
import { GeneratedImageBgScene } from './GeneratedImageBgScene.tsx';
import { SplitScreenScene } from './SplitScreenScene.tsx';
import { LowerThirdScene } from './LowerThirdScene.tsx';
import { LibraryClipScene } from './LibraryClipScene.tsx';

export interface SceneProps {
  scene: Scene;
  brand: Brand;
  format: { width: number; height: number; fps: number };
  assetMap: Record<string, string>;
  slug: string;
}

export const SceneRouter: React.FC<SceneProps> = (props) => {
  const { scene } = props;
  switch (scene.type) {
    case 'text-overlay':
      return <TextOverlayScene {...props} scene={scene} />;
    case 'fullscreen-clip':
      return <FullscreenClipScene {...props} scene={scene} />;
    case 'generated-image-bg':
      return <GeneratedImageBgScene {...props} scene={scene} />;
    case 'split-screen':
      return <SplitScreenScene {...props} scene={scene} />;
    case 'lower-third':
      return <LowerThirdScene {...props} scene={scene} />;
    case 'library-clip':
      return <LibraryClipScene {...props} scene={scene} />;
    default: {
      const exhaustiveCheck: never = scene;
      throw new Error(`Unhandled scene type: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
};

/**
 * Resolves a relative path from the per-render publicDir into a URL Remotion
 * can load. Returns undefined for missing entries so callers can render a
 * placeholder.
 */
export function assetUrl(
  assetMap: Record<string, string>,
  key: string,
): string | undefined {
  const rel = assetMap[key];
  if (!rel) return undefined;
  return staticFile(rel);
}

/**
 * Resolves a library file path (e.g., assets-library/music/foo.mp3) into a
 * URL Remotion can load. Library paths are workspace-relative and the
 * per-render publicDir does NOT include assets-library by default. For
 * library-clip scenes, the orchestrator stages the library file into the
 * publicDir like any other asset.
 */
export function libraryUrl(libraryPath: string): string {
  return staticFile(libraryPath);
}

export function resolveColor(color: string, brand: Brand): string {
  if (color.startsWith('#')) return color;
  const colorMap = brand.colors as Record<string, string | undefined>;
  const resolved: string | undefined = colorMap[color];
  return resolved ?? color;
}
