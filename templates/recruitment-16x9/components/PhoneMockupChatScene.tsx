import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from 'remotion';
import type { Brand } from '../../../lib/config.ts';
import type { Scene } from '../../../lib/scenes.ts';
import { PhoneFrame } from '../primitives/PhoneFrame.tsx';
import { TypingText } from '../primitives/TypingText.tsx';
import { MODERN_SYSTEM_FONT } from '../primitives/fonts.ts';

interface Props {
  scene: Extract<Scene, { type: 'phone-mockup-chat' }>;
  brand: Brand;
  format: { width: number; height: number; fps: number };
  assetMap: Record<string, string>;
  slug: string;
}

type ChatHighlight = { phrase: string; at_seconds: number; color?: string };

type ResolvedMessage = Extract<
  Scene,
  { type: 'phone-mockup-chat' }
>['messages'][number] & {
  resolvedStartFrame: number;
  typingDurationFrames: number;
  thinkingDurationFrames: number;
  effectiveHighlights: ChatHighlight[];
};

function resolveMessageTiming(
  messages: Extract<Scene, { type: 'phone-mockup-chat' }>['messages'],
  fps: number,
): ResolvedMessage[] {
  const out: ResolvedMessage[] = [];
  let cursor = 0;

  for (const msg of messages) {
    const thinkingFrames = Math.round(msg.thinking_pulse_seconds * fps);
    const typingFrames = Math.max(
      1,
      Math.round((msg.text.length / msg.chars_per_sec) * fps),
    );
    const startFrame =
      msg.start_at === 'auto'
        ? cursor + thinkingFrames
        : Math.round(msg.start_at * fps);

    // Merge legacy single highlight + new array form
    const effectiveHighlights: ChatHighlight[] = [...(msg.highlight_phrases ?? [])];
    if (msg.highlight_phrase && msg.highlight_at_seconds !== undefined) {
      effectiveHighlights.push({
        phrase: msg.highlight_phrase,
        at_seconds: msg.highlight_at_seconds,
      });
    }

    out.push({
      ...msg,
      resolvedStartFrame: startFrame,
      typingDurationFrames: typingFrames,
      thinkingDurationFrames: thinkingFrames,
      effectiveHighlights,
    });
    cursor = startFrame + typingFrames + Math.round(msg.hold_after_seconds * fps);
  }

  return out;
}

export const PhoneMockupChatScene: React.FC<Props> = ({
  scene,
  brand,
  format,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const resolved = resolveMessageTiming(scene.messages, fps);
  const totalFrames = scene.duration * fps;

  const phoneWidth = Math.round(format.height * 0.36);

  // 3D tilt: starts moving immediately on frame 1 (ease-out) so the scene
  // feels alive from the first frame rather than waiting for motion to begin.
  const tiltT = interpolate(frame, [0, totalFrames], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const rotateY = interpolate(tiltT, [0, 1], [8, -8]);
  const rotateX = interpolate(tiltT, [0, 1], [-4, 2]);

  // Push-in on the phone itself across the scene
  const pushIn = interpolate(tiltT, [0, 1], [1.0, 1.06]);

  // Gentle vertical drift
  const floatT = (frame / fps) * Math.PI * 0.35;
  const driftY = Math.sin(floatT) * (phoneWidth * 0.006);

  // Scene-wide push-in over the full scene duration. Starts immediately on
  // frame 1 (ease-out) so the camera feels like it's already moving when the
  // bubble appears, not waiting to begin.
  const sceneScale = interpolate(frame, [0, totalFrames], [1.0, 1.05], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${sceneScale})`,
        transformOrigin: 'center center',
        willChange: 'transform',
      }}
    >
      {/* Background */}
      {scene.background.type === 'solid' ? (
        <AbsoluteFill style={{ backgroundColor: scene.background.color }} />
      ) : (
        <AbsoluteFill
          style={{
            background: `linear-gradient(${scene.background.angle}deg, ${scene.background.from}, ${scene.background.to})`,
          }}
        />
      )}

      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 40% 50% at center, rgba(220,53,69,0.10) 0%, rgba(10,10,20,0) 70%)',
        }}
      />

      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          perspective: '2800px',
          perspectiveOrigin: '50% 50%',
        }}
      >
        <div
          style={{
            transform: `translateY(${driftY}px) scale(${pushIn}) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
            transformStyle: 'preserve-3d',
            willChange: 'transform',
            filter:
              'drop-shadow(0 80px 80px rgba(0,0,0,0.55)) drop-shadow(0 30px 40px rgba(0,0,0,0.4))',
          }}
        >
          <PhoneFrame width={phoneWidth}>
            <PhoneScreenContent
              scene={scene}
              brand={brand}
              resolved={resolved}
              phoneWidth={phoneWidth}
            />
          </PhoneFrame>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const PhoneScreenContent: React.FC<{
  scene: Extract<Scene, { type: 'phone-mockup-chat' }>;
  brand: Brand;
  resolved: ResolvedMessage[];
  phoneWidth: number;
}> = ({ scene, resolved, phoneWidth }) => {
  const frame = useCurrentFrame();
  const headerHeight = Math.round(phoneWidth * 0.22);
  const messageFontSize = Math.round(phoneWidth * 0.048);

  return (
    <AbsoluteFill style={{ backgroundColor: scene.screen_background_color }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: headerHeight,
          backgroundColor: scene.header.background_color,
          color: scene.header.text_color,
          display: 'flex',
          alignItems: 'center',
          padding: `0 ${Math.round(phoneWidth * 0.05)}px`,
          paddingTop: Math.round(phoneWidth * 0.085),
          gap: Math.round(phoneWidth * 0.035),
          zIndex: 50,
          boxShadow: '0 6px 24px rgba(0,0,0,0.22)',
          fontFamily: MODERN_SYSTEM_FONT,
        }}
      >
        {scene.header.avatar_initials ? (
          <div
            style={{
              width: Math.round(phoneWidth * 0.105),
              height: Math.round(phoneWidth * 0.105),
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: Math.round(phoneWidth * 0.046),
              fontWeight: 600,
              letterSpacing: '-0.01em',
              flexShrink: 0,
            }}
          >
            {scene.header.avatar_initials}
          </div>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: Math.round(phoneWidth * 0.05),
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: '-0.015em',
            }}
          >
            {scene.header.title}
          </div>
          {scene.header.subtitle ? (
            <div
              style={{
                fontSize: Math.round(phoneWidth * 0.031),
                fontWeight: 500,
                opacity: 0.92,
                marginTop: 3,
                letterSpacing: '-0.005em',
              }}
            >
              {scene.header.subtitle}
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: headerHeight,
          left: 0,
          right: 0,
          bottom: 0,
          padding: `${Math.round(phoneWidth * 0.065)}px ${Math.round(phoneWidth * 0.045)}px`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: Math.round(phoneWidth * 0.035),
          fontFamily: MODERN_SYSTEM_FONT,
        }}
      >
        {resolved.map((msg, i) => (
          <ChatBubble
            key={i}
            msg={msg}
            scene={scene}
            currentFrame={frame}
            messageFontSize={messageFontSize}
            phoneWidth={phoneWidth}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const ChatBubble: React.FC<{
  msg: ResolvedMessage;
  scene: Extract<Scene, { type: 'phone-mockup-chat' }>;
  currentFrame: number;
  messageFontSize: number;
  phoneWidth: number;
}> = ({ msg, scene, currentFrame, messageFontSize, phoneWidth }) => {
  const isUser = msg.role === 'user';
  const showFrom = msg.resolvedStartFrame - msg.thinkingDurationFrames;

  if (currentFrame < showFrom) return null;

  const bubbleColor = isUser
    ? scene.user_bubble_color
    : scene.assistant_bubble_color;
  const textColor = isUser
    ? scene.user_bubble_text_color
    : scene.assistant_bubble_text_color;

  const inThinking =
    msg.thinkingDurationFrames > 0 && currentFrame < msg.resolvedStartFrame;

  return (
    <div
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '84%',
      }}
    >
      {inThinking ? (
        <ThinkingDots
          phoneWidth={phoneWidth}
          bubbleColor={bubbleColor}
          textColor={textColor}
        />
      ) : (
        <div
          style={{
            backgroundColor: bubbleColor,
            color: textColor,
            padding: `${Math.round(phoneWidth * 0.028)}px ${Math.round(phoneWidth * 0.038)}px`,
            borderRadius: Math.round(phoneWidth * 0.045),
            fontFamily: MODERN_SYSTEM_FONT,
            fontSize: messageFontSize,
            lineHeight: 1.36,
            fontWeight: 400,
            letterSpacing: '-0.01em',
            wordBreak: 'break-word',
            boxShadow: isUser
              ? '0 4px 18px rgba(220,53,69,0.22)'
              : '0 4px 16px rgba(0,0,0,0.25)',
          }}
        >
          {msg.animation === 'typing' ? (
            <TypingText
              text={msg.text}
              startFrame={msg.resolvedStartFrame}
              charsPerSec={msg.chars_per_sec}
              cursor={false}
            />
          ) : (
            <FadeInText
              text={msg.text}
              startFrame={msg.resolvedStartFrame}
              currentFrame={currentFrame}
              highlights={msg.effectiveHighlights}
              phoneWidth={phoneWidth}
            />
          )}
        </div>
      )}
    </div>
  );
};

const FadeInText: React.FC<{
  text: string;
  startFrame: number;
  currentFrame: number;
  highlights: ChatHighlight[];
  phoneWidth: number;
}> = ({ text, startFrame, currentFrame, highlights, phoneWidth }) => {
  const opacity = Math.min(1, Math.max(0, (currentFrame - startFrame) / 12));

  // Find each highlight's match position and sort by index. Drop any that don't match.
  const matches = highlights
    .map((h) => ({ ...h, index: text.indexOf(h.phrase) }))
    .filter((h) => h.index >= 0)
    .sort((a, b) => a.index - b.index);

  if (matches.length === 0) {
    return <span style={{ opacity }}>{text}</span>;
  }

  // Resolve non-overlapping match windows. Keep first-match-wins.
  type Segment =
    | { kind: 'text'; content: string }
    | { kind: 'highlight'; content: string; at_seconds: number; color?: string };
  const segments: Segment[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.index < cursor) continue; // overlapping match, skip
    if (m.index > cursor) {
      segments.push({ kind: 'text', content: text.slice(cursor, m.index) });
    }
    const end = m.index + m.phrase.length;
    segments.push({
      kind: 'highlight',
      content: text.slice(m.index, end),
      at_seconds: m.at_seconds,
      color: m.color,
    });
    cursor = end;
  }
  if (cursor < text.length) {
    segments.push({ kind: 'text', content: text.slice(cursor) });
  }

  return (
    <span style={{ opacity }}>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') return <span key={i}>{seg.content}</span>;
        return (
          <HighlightedSpan
            key={i}
            text={seg.content}
            atSeconds={seg.at_seconds}
            currentFrame={currentFrame}
            color={seg.color ?? '#22d3a4'}
            phoneWidth={phoneWidth}
          />
        );
      })}
    </span>
  );
};

const HighlightedSpan: React.FC<{
  text: string;
  atSeconds: number;
  currentFrame: number;
  color: string;
  phoneWidth: number;
}> = ({ text, atSeconds, currentFrame, color, phoneWidth }) => {
  // Frames-per-second is locked at scene level via Sequence; recompute locally.
  const fps = 30;
  const atFrame = atSeconds * fps;
  const elapsedFrames = currentFrame - atFrame;

  if (elapsedFrames < 0) {
    return <span>{text}</span>;
  }

  // Smooth fade-in of the ring over ~14 frames, then continuous gentle pulse.
  // Critical: the appearance is animated via alpha on the color values, NOT
  // via opacity on the span — so the text inside the highlight stays fully
  // opaque while the ring/glow/background fade in over the top.
  const appearProgress = Math.min(1, elapsedFrames / 14);
  const easedAppear = Easing.out(Easing.cubic)(appearProgress);
  const ringOpacity = easedAppear;

  const pulseT = Math.max(0, elapsedFrames - 14) / fps;
  const pulseBase = 0.5 + 0.5 * Math.sin(pulseT * Math.PI * 1.6 - Math.PI / 2);

  const borderPx = Math.max(2, Math.round(phoneWidth * 0.005));
  // Tight, equal padding on all four sides. Vertical is set slightly less than
  // horizontal because font line-height already contributes some visual space
  // above and below the glyphs, so equal numeric padding would look loose
  // vertically.
  const horizontalPad = Math.round(phoneWidth * 0.018);
  const verticalPad = Math.round(phoneWidth * 0.01);
  const radius = Math.round(phoneWidth * 0.018);
  // More pronounced pulse: bigger glow oscillation, stronger bg-alpha swing,
  // and the outer glow alphas now pulse too (they were constant before).
  const glowSize = (10 + 34 * pulseBase) * (phoneWidth / 800);

  const alphaHex = (a: number) =>
    Math.round(Math.min(255, Math.max(0, a))).toString(16).padStart(2, '0');
  const bgAlpha = (18 + pulseBase * 36) * ringOpacity;
  const ringAlpha = 255 * ringOpacity;
  const glow1Alpha = (0x55 + 0x88 * pulseBase) * ringOpacity;
  const glow2Alpha = (0x22 + 0x55 * pulseBase) * ringOpacity;

  return (
    <span
      style={{
        display: 'inline',
        WebkitBoxDecorationBreak: 'clone',
        boxDecorationBreak: 'clone',
        padding: `${verticalPad}px ${horizontalPad}px`,
        margin: `0 -${horizontalPad}px`,
        borderRadius: radius,
        backgroundColor: `${color}${alphaHex(bgAlpha)}`,
        boxShadow: `inset 0 0 0 ${borderPx}px ${color}${alphaHex(ringAlpha)}, 0 0 ${glowSize}px ${color}${alphaHex(glow1Alpha)}, 0 0 ${glowSize * 2}px ${color}${alphaHex(glow2Alpha)}`,
      }}
    >
      {text}
    </span>
  );
};

const ThinkingDots: React.FC<{
  phoneWidth: number;
  bubbleColor: string;
  textColor: string;
}> = ({ phoneWidth, bubbleColor, textColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <div
      style={{
        backgroundColor: bubbleColor,
        padding: `${Math.round(phoneWidth * 0.028)}px ${Math.round(phoneWidth * 0.042)}px`,
        borderRadius: Math.round(phoneWidth * 0.045),
        display: 'flex',
        gap: Math.round(phoneWidth * 0.013),
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      }}
    >
      {[0, 1, 2].map((i) => {
        const op =
          0.3 + 0.7 * Math.max(0, Math.sin((t * 3.2 + i * 0.32) * Math.PI));
        return (
          <div
            key={i}
            style={{
              width: Math.round(phoneWidth * 0.02),
              height: Math.round(phoneWidth * 0.02),
              borderRadius: '50%',
              backgroundColor: textColor,
              opacity: op,
            }}
          />
        );
      })}
    </div>
  );
};
