import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import type { Brand } from '../../../lib/config.ts';
import type { Scene } from '../../../lib/scenes.ts';
import { assetUrl, resolveColor } from './SceneRouter.tsx';
import { ContactLockup } from '../primitives/ContactLockup.tsx';

interface Props {
  scene: Extract<Scene, { type: 'close-card' }>;
  brand: Brand;
  format: { width: number; height: number; fps: number };
  assetMap: Record<string, string>;
  slug: string;
}

/**
 * CTA close card. Optional faded clip background referenced by another scene's id
 * (so we can reuse, say, the broker-strategy clip from earlier in the timeline).
 */
export const CloseCardScene: React.FC<Props> = ({
  scene,
  brand,
  format,
  assetMap,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const backgroundClipSrc = scene.background_clip_scene_id
    ? assetUrl(assetMap, scene.background_clip_scene_id)
    : undefined;

  // Ken Burns on the faded clip background (subtle push-in over the whole scene)
  const knownDurationFrames = scene.duration * fps;
  const motionT = interpolate(frame, [0, knownDurationFrames], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const kbScale = interpolate(
    motionT,
    [0, 1],
    [1, 1 + scene.background_clip_motion_intensity * 0.1],
  );
  const kbX = interpolate(motionT, [0, 1], [0, -scene.background_clip_motion_intensity * 2]);

  // Spring-in for primary text. `intro_delay_seconds` lets the background settle
  // before the copy starts animating in (default 0).
  const delayFrames = Math.round((scene.intro_delay_seconds ?? 0) * fps);
  const titleStartFrame = 8 + delayFrames;
  const titleSpring = spring({
    frame: Math.max(0, frame - titleStartFrame),
    fps,
    config: { damping: 220, stiffness: 35, mass: 0.9 },
    durationInFrames: 70,
  });
  const titleSlide = interpolate(titleSpring, [0, 1], [-60, 0]);
  const titleFade = interpolate(
    frame,
    [titleStartFrame, titleStartFrame + 52],
    [0, 1],
    { extrapolateRight: 'clamp' },
  );

  const detailsFade = interpolate(
    frame,
    [28 + delayFrames, 70 + delayFrames],
    [0, 1],
    { extrapolateRight: 'clamp' },
  );

  const accent = brand.colors.accent ?? '#dc3545';
  const textColor = '#ffffff';
  const mutedColor = brand.colors.muted ?? '#a0a8c0';
  // Locked-in typography for the close card. These stacks are intentional and
  // produce stable visual output regardless of which fonts are installed:
  // - DISPLAY (headline): Impact-style bold sans for the loud CTA
  // - SECONDARY (invitation copy): editorial serif for warmth / contrast
  // - CONTACT lockup uses system sans inside ContactLockup itself
  const displayFont =
    brand.fonts.display ?? 'Impact, "Arial Black", "Helvetica Neue", sans-serif';
  const secondaryFont = '"Georgia", "Times New Roman", ui-serif, serif';

  const renderBackground = () => {
    const bg = scene.background;
    if (bg.type === 'solid') {
      return (
        <AbsoluteFill
          style={{ backgroundColor: resolveColor(bg.color, brand) }}
        />
      );
    }
    if (bg.type === 'gradient') {
      return (
        <AbsoluteFill
          style={{
            background: `linear-gradient(${bg.angle}deg, ${resolveColor(bg.from, brand)}, ${resolveColor(bg.to, brand)})`,
          }}
        />
      );
    }
    return null;
  };

  return (
    <AbsoluteFill>
      {renderBackground()}

      {/* Faded reused clip overlay. If background_clip_fade_out_seconds is set,
          the opacity ramps to 0 over the last N seconds of the scene — useful
          when the clip is shorter than the scene (hides the frozen final frame). */}
      {backgroundClipSrc ? (
        (() => {
          const fadeOut = scene.background_clip_fade_out_seconds ?? 0;
          const fadeOutOpacity =
            fadeOut > 0
              ? interpolate(
                  frame,
                  [
                    Math.max(0, knownDurationFrames - fadeOut * fps),
                    knownDurationFrames,
                  ],
                  [scene.background_clip_opacity, 0],
                  { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
                )
              : scene.background_clip_opacity;
          return (
        <AbsoluteFill
          style={{
            opacity: fadeOutOpacity,
            mixBlendMode: 'screen',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              transform: `scale(${kbScale}) translateX(${kbX}%)`,
              transformOrigin: 'center',
            }}
          >
            <OffthreadVideo
              src={backgroundClipSrc}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              muted
              startFrom={Math.round(scene.background_clip_start_offset_seconds * fps)}
            />
          </div>
        </AbsoluteFill>
          );
        })()
      ) : null}

      {/* Dark vignette over everything to make text pop */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(10,10,20,0.25) 30%, rgba(10,10,20,0.85) 90%)',
        }}
      />

      {/* Foreground stack: primary text, secondary, contact, logo */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: `${Math.round(format.height / 14)}px ${Math.round(format.width / 12)}px`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: displayFont,
            color: textColor,
            fontSize: Math.round(format.width / 22),
            fontWeight: 900,
            lineHeight: 0.96,
            letterSpacing: '-0.015em',
            textTransform: 'uppercase',
            opacity: titleFade,
            transform: `translateX(${titleSlide}px)`,
            maxWidth: '80%',
            textShadow: '0 6px 36px rgba(0,0,0,0.7)',
          }}
        >
          {scene.primary_text}
        </div>

        <div style={{ opacity: detailsFade, marginTop: Math.round(format.height / 26), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: Math.round(format.height / 36) }}>
          {scene.secondary_text ? (
            <div
              style={{
                fontFamily: secondaryFont,
                color: mutedColor,
                fontSize: Math.round(format.width / 56),
                fontWeight: 400,
              }}
            >
              {scene.secondary_text}
            </div>
          ) : null}

          <ContactLockup
            phone={scene.contact.phone}
            email={scene.contact.email}
            website={scene.contact.website}
            // Pass undefined so ContactLockup picks its locked-in system sans stack
            fontFamily={undefined}
            color={textColor}
            fontSize={Math.round(format.width / 64)}
            fontWeight={600}
            separatorColor={accent}
          />

          {scene.show_logo && scene.logo_text ? (
            <div
              style={{
                marginTop: Math.round(format.height / 30),
                fontFamily: displayFont,
                color: accent,
                fontSize: Math.round(format.width / 70),
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {scene.logo_text}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
