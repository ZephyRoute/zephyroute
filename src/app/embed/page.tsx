import type { CSSProperties } from 'react';
import { ZephyrouteFlow } from '@/components/features/ZephyrouteFlow';

/**
 * Story 4.1, AC #1 (Container Fidelity): the token layer a partner can
 * override, scoped to the widget's own root element, never `:root`
 * globally, and never anything beyond these named color tokens.
 * Structural tokens (spacing, fonts, the single content column) stay
 * fixed, only color identity is overridable, keeping the widget's
 * accessibility guarantees (contrast ratios already verified against
 * the default palette, Story 1.3) from being silently broken by an
 * arbitrary partner-supplied color.
 */
const OVERRIDABLE_TOKENS: Record<string, string> = {
  accent: '--color-accent',
  background: '--color-background',
  surface: '--color-surface',
};

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/;

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const overrides: Record<string, string> = {};

  for (const [param, cssVariable] of Object.entries(OVERRIDABLE_TOKENS)) {
    const value = params[param];
    // Validated as a strict hex color before ever reaching a style
    // attribute, an untrusted URL parameter must never become an
    // opportunity to inject arbitrary CSS.
    if (typeof value === 'string' && HEX_COLOR_PATTERN.test(value)) {
      overrides[cssVariable] = value;
    }
  }

  return (
    <div style={overrides as CSSProperties}>
      <ZephyrouteFlow />
    </div>
  );
}
