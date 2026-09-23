import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/features/ZephyrouteFlow', () => ({
  ZephyrouteFlow: () => <div data-testid="flow">flow</div>,
}));

const { default: EmbedPage } = await import('./page');

describe('EmbedPage', () => {
  it('applies a valid hex color override as a scoped CSS custom property, never on :root', async () => {
    const element = await EmbedPage({
      searchParams: Promise.resolve({ accent: '#ff0000' }),
    });
    const { container } = render(element);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.getPropertyValue('--color-accent')).toBe('#ff0000');
    expect(screen.getByTestId('flow')).toBeInTheDocument();
  });

  it('rejects a non-hex value, never passing untrusted input through as raw CSS (AC: Container Fidelity)', async () => {
    const element = await EmbedPage({
      searchParams: Promise.resolve({ accent: 'red; } body { display:none' }),
    });
    const { container } = render(element);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.getPropertyValue('--color-accent')).toBe('');
  });

  it('ignores an override param that is not in the allowed token list', async () => {
    const element = await EmbedPage({
      searchParams: Promise.resolve({ 'font-family': 'Comic Sans' }),
    });
    const { container } = render(element);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute('style') ?? '').not.toContain('font-family');
  });

  it('renders the exact same flow component the standalone app uses (FR12)', async () => {
    const element = await EmbedPage({ searchParams: Promise.resolve({}) });
    render(element);

    expect(screen.getByTestId('flow')).toBeInTheDocument();
  });
});
