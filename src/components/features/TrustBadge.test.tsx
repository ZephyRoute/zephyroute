import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { TrustBadge } from './TrustBadge';

describe('TrustBadge', () => {
  it('renders its mechanism-backed sentence, meaning never depends on the dot alone', () => {
    render(<TrustBadge />);

    expect(
      screen.getByText('Non-custodial. Funds go straight to your wallet.')
    ).toBeInTheDocument();
  });

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(<TrustBadge />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
