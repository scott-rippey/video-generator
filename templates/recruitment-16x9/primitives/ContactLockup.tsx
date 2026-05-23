import React from 'react';

export interface ContactLockupProps {
  phone?: string;
  email?: string;
  website?: string;
  fontFamily?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: number | string;
  layout?: 'inline' | 'stacked';
  separator?: string;
  separatorColor?: string;
}

export const ContactLockup: React.FC<ContactLockupProps> = ({
  phone,
  email,
  website,
  fontFamily = 'Inter',
  color = '#ffffff',
  fontSize = 36,
  fontWeight = 500,
  layout = 'inline',
  separator = '•',
  separatorColor,
}) => {
  const items = [phone, email, website].filter(
    (s): s is string => Boolean(s),
  );
  if (items.length === 0) return null;

  if (layout === 'stacked') {
    return (
      <div
        style={{
          fontFamily,
          color,
          fontSize,
          fontWeight,
          lineHeight: 1.45,
          textAlign: 'center',
        }}
      >
        {items.map((item, i) => (
          <div key={i}>{item}</div>
        ))}
      </div>
    );
  }

  // Use a system font stack so every character renders with the same metrics
  // (relying on 'Inter' alone risks inconsistent fallback per character, which
  // produces different ascent/descent and visibly misaligns the items).
  const stableFontFamily =
    fontFamily && fontFamily !== 'Inter'
      ? fontFamily
      : '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", "Inter", "Helvetica Neue", system-ui, sans-serif';
  return (
    <div
      style={{
        fontFamily: stableFontFamily,
        color,
        fontSize,
        fontWeight,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: `0 ${Math.round(fontSize * 0.7)}px`,
        flexWrap: 'wrap',
      }}
    >
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <span style={{ lineHeight: 1, display: 'inline-block' }}>{item}</span>
          {i < items.length - 1 ? (
            <span
              style={{
                color: separatorColor ?? color,
                opacity: separatorColor ? 1 : 0.45,
                lineHeight: 1,
                display: 'inline-block',
              }}
            >
              {separator}
            </span>
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
};
