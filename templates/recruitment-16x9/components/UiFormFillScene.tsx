import React from 'react';
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import type { Brand } from '../../../lib/config.ts';
import type { Scene } from '../../../lib/scenes.ts';
import { assetUrl } from './SceneRouter.tsx';
import { ScrollMotion } from '../primitives/ScrollMotion.tsx';
import { HighlightPulse } from '../primitives/HighlightPulse.tsx';
import { TypingText } from '../primitives/TypingText.tsx';
import { MODERN_SYSTEM_FONT } from '../primitives/fonts.ts';

interface Props {
  scene: Extract<Scene, { type: 'ui-form-fill' }>;
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

export const UiFormFillScene: React.FC<Props> = ({
  scene,
  brand,
  format,
  assetMap,
}) => {
  const { fps } = useVideoConfig();
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

            {/* Overlay container aligned with the rendered image bounds. All
                screenshot-native coords get scaled relative to this container. */}
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
              {scene.field_fills.map((field, i) => (
                <FieldFill
                  key={`${scene.id}-fill-${i}`}
                  field={field}
                  brand={brand}
                  fps={fps}
                  natW={scene.image_natural_width ?? 1}
                  natH={scene.image_natural_height ?? 1}
                  renderedW={placement.renderedW}
                  renderedH={placement.renderedH}
                />
              ))}

              {scene.button_pulse ? (
                <ButtonPulseLayer
                  button={scene.button_pulse}
                  fps={fps}
                  natW={scene.image_natural_width ?? 1}
                  natH={scene.image_natural_height ?? 1}
                  renderedW={placement.renderedW}
                  renderedH={placement.renderedH}
                />
              ) : null}

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

      {/* Confirmation overlay sits OUTSIDE the motion wrapper — it floats over
          the camera, not tied to the screenshot. */}
      {scene.confirmation ? (
        <ConfirmationOverlay
          confirmation={scene.confirmation}
          format={format}
          fps={fps}
          brand={brand}
        />
      ) : null}
    </AbsoluteFill>
  );
};

const FieldFill: React.FC<{
  field: Extract<Scene, { type: 'ui-form-fill' }>['field_fills'][number];
  brand: Brand;
  fps: number;
  natW: number;
  natH: number;
  renderedW: number;
  renderedH: number;
}> = ({ field, brand, fps, natW, natH, renderedW, renderedH }) => {
  const sx = renderedW / natW;
  const sy = renderedH / natH;
  const left = field.x * sx;
  const top = field.y * sy;
  const width = field.width * sx;
  const height = field.height * sy;

  const startFrame = Math.round(field.start_at * fps);
  const fontSize =
    field.font_size != null
      ? field.font_size * sx
      : Math.round(height * 0.5);
  const paddingX = field.padding_x * sx;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        backgroundColor: field.cover_color,
        display: 'flex',
        alignItems: 'center',
        justifyContent:
          field.text_align === 'right'
            ? 'flex-end'
            : field.text_align === 'center'
              ? 'center'
              : 'flex-start',
        padding: `0 ${paddingX}px`,
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          fontFamily: field.font_family ?? MODERN_SYSTEM_FONT,
          fontSize,
          fontWeight: field.font_weight ?? 500,
          color: field.font_color ?? '#111827',
          whiteSpace: 'nowrap',
        }}
      >
        <TypingText
          text={field.text}
          startFrame={startFrame}
          charsPerSec={field.chars_per_sec}
          cursor
        />
      </span>
    </div>
  );
};

const ButtonPulseLayer: React.FC<{
  button: NonNullable<Extract<Scene, { type: 'ui-form-fill' }>['button_pulse']>;
  fps: number;
  natW: number;
  natH: number;
  renderedW: number;
  renderedH: number;
}> = ({ button, fps, natW, natH, renderedW, renderedH }) => {
  const frame = useCurrentFrame();
  const sx = renderedW / natW;
  const sy = renderedH / natH;
  const left = button.x * sx;
  const top = button.y * sy;
  const width = button.width * sx;
  const height = button.height * sy;

  const atFrame = button.at_seconds * fps;
  const localFrame = frame - atFrame;

  const glowFrames = Math.round(fps * 0.5);
  const pressStartFrame = glowFrames;
  const pressFrames = Math.round(fps * 0.18);

  const glowOpacity =
    localFrame < 0
      ? 0
      : localFrame < glowFrames
        ? Math.sin((localFrame / glowFrames) * Math.PI)
        : 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: left - 8,
        top: top - 8,
        width: width + 16,
        height: height + 16,
        boxShadow: `0 0 ${40 + 60 * glowOpacity}px ${20 + 30 * glowOpacity}px ${button.glow_color}`,
        borderRadius: 14,
        opacity: glowOpacity,
        pointerEvents: 'none',
      }}
    />
  );
};

const ConfirmationOverlay: React.FC<{
  confirmation: NonNullable<Extract<Scene, { type: 'ui-form-fill' }>['confirmation']>;
  format: { width: number; height: number; fps: number };
  fps: number;
  brand: Brand;
}> = ({ confirmation, format, fps, brand }) => {
  const frame = useCurrentFrame();
  const atFrame = confirmation.at_seconds * fps;
  const local = frame - atFrame;
  if (local < 0) return null;

  const totalFrames = Math.round(fps * 2);
  const fadeIn = Math.round(fps * 0.4);
  const fadeOut = Math.round(fps * 0.6);
  if (local > totalFrames) return null;

  const opacity =
    local < fadeIn
      ? local / fadeIn
      : local > totalFrames - fadeOut
        ? (totalFrames - local) / fadeOut
        : 1;

  const enterSpring = spring({
    frame: Math.max(0, local),
    fps,
    config: { damping: 200, stiffness: 90 },
    durationInFrames: 30,
  });
  const scale = interpolate(enterSpring, [0, 1], [0.9, 1]);

  let justifyContent: React.CSSProperties['justifyContent'] = 'center';
  let alignItems: React.CSSProperties['alignItems'] = 'center';
  if (confirmation.position === 'top') alignItems = 'flex-start';
  if (confirmation.position === 'bottom') alignItems = 'flex-end';
  if (confirmation.position === 'top-right') {
    alignItems = 'flex-start';
    justifyContent = 'flex-end';
  }
  if (confirmation.position === 'bottom-right') {
    alignItems = 'flex-end';
    justifyContent = 'flex-end';
  }

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems,
        justifyContent,
        padding: `${Math.round(format.width / 30)}px`,
        pointerEvents: 'none',
        opacity,
      }}
    >
      <div
        style={{
          background: confirmation.background_color,
          color: confirmation.text_color,
          padding: `${Math.round(format.height / 60)}px ${Math.round(format.width / 36)}px`,
          borderRadius: 12,
          fontFamily: brand.fonts.primary ?? 'Inter',
          fontSize: Math.round(format.width / 52),
          fontWeight: 700,
          letterSpacing: '-0.005em',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          transform: `scale(${scale})`,
        }}
      >
        {confirmation.text}
      </div>
    </AbsoluteFill>
  );
};
