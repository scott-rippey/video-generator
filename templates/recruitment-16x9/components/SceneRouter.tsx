import React from 'react';
import { staticFile } from 'remotion';
import type { Scene } from '../../../lib/scenes.ts';
import type { Brand } from '../../../lib/config.ts';
import { FullscreenClipScene } from './FullscreenClipScene.tsx';
import { UiStaticRevealScene } from './UiStaticRevealScene.tsx';
import { UiFormFillScene } from './UiFormFillScene.tsx';
import { PhoneMockupChatScene } from './PhoneMockupChatScene.tsx';
import { CloseCardScene } from './CloseCardScene.tsx';
import { OutroClipScene } from './OutroClipScene.tsx';

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
    case 'fullscreen-clip':
      return <FullscreenClipScene {...props} scene={scene} />;
    case 'ui-static-reveal':
      return <UiStaticRevealScene {...props} scene={scene} />;
    case 'ui-form-fill':
      return <UiFormFillScene {...props} scene={scene} />;
    case 'phone-mockup-chat':
      return <PhoneMockupChatScene {...props} scene={scene} />;
    case 'close-card':
      return <CloseCardScene {...props} scene={scene} />;
    case 'outro-clip':
      return <OutroClipScene {...props} scene={scene} />;
    case 'text-overlay':
    case 'generated-image-bg':
    case 'split-screen':
    case 'lower-third':
    case 'library-clip':
      throw new Error(
        `Scene type "${scene.type}" is not supported by the recruitment-16x9 template. Use hero-16x9 or extend recruitment-16x9 to render it.`,
      );
    default: {
      const exhaustive: never = scene;
      throw new Error(`Unhandled scene type: ${JSON.stringify(exhaustive)}`);
    }
  }
};

export function assetUrl(
  assetMap: Record<string, string>,
  key: string,
): string | undefined {
  const rel = assetMap[key];
  if (!rel) return undefined;
  return staticFile(rel);
}

export function libraryUrl(libraryPath: string): string {
  return staticFile(libraryPath);
}

export function resolveColor(color: string, brand: Brand): string {
  if (color.startsWith('#') || color.startsWith('rgb') || color.startsWith('hsl')) {
    return color;
  }
  const colorMap = brand.colors as Record<string, string | undefined>;
  return colorMap[color] ?? color;
}
