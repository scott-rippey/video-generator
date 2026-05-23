import React from 'react';
import { AbsoluteFill, Img } from 'remotion';
import type { Brand } from '../../../lib/config.ts';
import type { Scene } from '../../../lib/scenes.ts';
import { assetUrl } from './SceneRouter.tsx';
import { ScrollMotion } from '../primitives/ScrollMotion.tsx';
import { HighlightPulse } from '../primitives/HighlightPulse.tsx';

interface Props {
  scene: Extract<Scene, { type: 'ui-static-reveal' }>;
  brand: Brand;
  format: { width: number; height: number; fps: number };
  assetMap: Record<string, string>;
  slug: string;
}

function computeImagePlacement(
  natW: number | undefined,
  natH: number | undefined,
  fmtW: number,
  fmtH: number,
  fit: 'contain' | 'cover',
): { scale: number; offsetX: number; offsetY: number; renderedW: number; renderedH: number } {
  if (!natW || !natH) {
    return {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      renderedW: fmtW,
      renderedH: fmtH,
    };
  }
  const scaleX = fmtW / natW;
  const scaleY = fmtH / natH;
  const scale =
    fit === 'contain' ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY);
  const renderedW = natW * scale;
  const renderedH = natH * scale;
  const offsetX = (fmtW - renderedW) / 2;
  const offsetY = (fmtH - renderedH) / 2;
  return { scale, offsetX, offsetY, renderedW, renderedH };
}

export const UiStaticRevealScene: React.FC<Props> = ({
  scene,
  brand,
  format,
  assetMap,
}) => {
  const src = assetUrl(assetMap, scene.id);

  const placement = computeImagePlacement(
    scene.image_natural_width,
    scene.image_natural_height,
    format.width,
    format.height,
    scene.fit,
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: scene.background_color ?? '#000000',
      }}
    >
      {src ? (
        <ScrollMotion
          kind={scene.motion.kind}
          intensity={scene.motion.intensity}
          easing={scene.motion.easing}
          durationSeconds={scene.duration}
          keyframes={scene.motion.keyframes}
        >
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Img
              src={src}
              style={{
                width: '100%',
                height: '100%',
                objectFit: scene.fit,
                display: 'block',
              }}
            />
            {scene.highlights.length > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  left: placement.offsetX,
                  top: placement.offsetY,
                  width: placement.renderedW,
                  height: placement.renderedH,
                  pointerEvents: 'none',
                }}
              >
                {scene.highlights.map((h, i) => (
                  <HighlightPulse
                    key={`${scene.id}-h-${i}`}
                    kind={h.kind}
                    x={h.x}
                    y={h.y}
                    width={h.width}
                    height={h.height}
                    atSeconds={h.at_seconds}
                    durationSeconds={h.duration_seconds}
                    color={h.color ?? brand.colors.accent ?? '#22d3a4'}
                    drawInSeconds={h.draw_in_seconds}
                    pulseAfter={h.pulse_after}
                    borderRadius={h.border_radius}
                    padding={h.padding}
                    imageNaturalWidth={scene.image_natural_width}
                    imageNaturalHeight={scene.image_natural_height}
                    renderedWidth={placement.renderedW}
                    renderedHeight={placement.renderedH}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </ScrollMotion>
      ) : (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            color: '#fff',
            fontSize: 60,
          }}
        >
          Missing screenshot for scene {scene.id}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
