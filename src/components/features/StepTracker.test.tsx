import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { StepTracker } from './StepTracker';

describe('StepTracker', () => {
  it('marks Quoted as the active step at the quoted stage', () => {
    render(<StepTracker stage="quoted" />);
    const quoted = screen.getByText('Quoted').closest('li')!;
    expect(quoted).toHaveAttribute('aria-current', 'step');
  });

  it('shows Settled as active while submitted (in flight toward settlement)', () => {
    render(<StepTracker stage="submitted" />);
    const settled = screen.getByText('Settled').closest('li')!;
    expect(settled).toHaveAttribute('aria-current', 'step');
  });

  it('shows Earning as active while depositing (in flight toward the deposit landing)', () => {
    render(<StepTracker stage="depositing" />);
    const earning = screen.getByText('Earning').closest('li')!;
    expect(earning).toHaveAttribute('aria-current', 'step');
  });

  it('marks every step failed with a text label, never color alone, when failed is true', () => {
    render(<StepTracker stage="submitted" failed />);
    expect(screen.getByText('Quoted (failed)')).toBeInTheDocument();
    expect(screen.getByText('Settled (failed)')).toBeInTheDocument();
  });

  it('shows a completion timestamp sourced from the caller, not the local clock', () => {
    const settledAt = '2026-09-21T12:00:00.000Z';
    const { container } = render(
      <StepTracker stage="earning" timestamps={{ quoted: settledAt, settled: settledAt }} />
    );

    const times = container.querySelectorAll('time[datetime]');
    expect(times.length).toBeGreaterThan(0);
    expect(times[0].getAttribute('datetime')).toBe(settledAt);
  });

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(<StepTracker stage="settled" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
