import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { AccountSetupFork } from './AccountSetupFork';

describe('AccountSetupFork', () => {
  it('shows a visible, explicitly named step, never a silent or generic alert (AC #1)', () => {
    render(<AccountSetupFork />);

    expect(screen.getByRole('status')).toHaveTextContent('Setting up your Stellar account');
    expect(screen.getByText(/routing you through a quick account setup step/)).toBeInTheDocument();
  });

  it('shows the honest not-yet-available warning by default, until Story 2.2 provides a real mechanism', () => {
    render(<AccountSetupFork />);

    expect(screen.getByRole('alert')).toHaveTextContent("isn't available in this build yet");
  });

  it('hides the not-yet-available warning once a real mechanism is available', () => {
    render(<AccountSetupFork mechanismAvailable />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(<AccountSetupFork />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
