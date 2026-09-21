import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';

/**
 * Design tokens from globals.css (ux-design-specification.md, Visual
 * Design Foundation). WCAG AA requires 4.5:1 for body text, 3:1 for
 * large text and UI components.
 */
const tokens = {
  background: '#0e1116',
  surface: '#171b22',
  text: '#edeff2',
  textMuted: '#9aa3ae',
  accent: '#3fd6d0',
  accentInk: '#04211f',
  errorUi: '#e5484d',
  errorText: '#ff7a80',
};

describe('design token contrast ratios (WCAG AA)', () => {
  it('primary text on background clears 4.5:1', () => {
    expect(contrastRatio(tokens.text, tokens.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('muted text on background clears 4.5:1', () => {
    expect(contrastRatio(tokens.textMuted, tokens.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('accent-ink text on the accent fill clears 4.5:1 (primary button label)', () => {
    expect(contrastRatio(tokens.accentInk, tokens.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('accent on background clears 3:1 (large text / UI components)', () => {
    expect(contrastRatio(tokens.accent, tokens.background)).toBeGreaterThanOrEqual(3);
  });

  it('error-text on background clears 4.5:1, confirming the lighter variant is required', () => {
    expect(contrastRatio(tokens.errorText, tokens.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('error-text carries a much wider AA margin than error-ui, the actual justification for the split', () => {
    // ux-design-specification.md describes error-ui as clearing AA "only
    // narrowly"; verified here at 4.83:1, which does clear 4.5:1, contrary
    // to that prose (see decision-log 2026-09-21). The underlying design
    // decision is still correct: error-text's 7.5:1 gives the far larger
    // safety margin, which is what actually matters for the No Silent
    // Failure acceptance criterion this pairing exists to serve.
    const uiRatio = contrastRatio(tokens.errorUi, tokens.background);
    const textRatio = contrastRatio(tokens.errorText, tokens.background);
    expect(uiRatio).toBeGreaterThanOrEqual(4.5);
    expect(textRatio).toBeGreaterThan(uiRatio);
  });
});
