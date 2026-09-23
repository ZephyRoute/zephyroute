import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const computeTractionMetrics = vi.fn();

vi.mock('@/lib/traction-metrics', () => ({ computeTractionMetrics }));

const { default: MetricsPage } = await import('./page');

describe('MetricsPage', () => {
  it('renders the four cumulative figures and both recurrence rates as real percentages', async () => {
    computeTractionMetrics.mockResolvedValue({
      cumulativeAttributableVolume: '99690000',
      netNewTVL: '49690000',
      uniqueFundedAddresses: 3,
      recurrenceRate7d: 0.25,
      recurrenceRate30d: 0.5,
    });

    const element = await MetricsPage();
    render(element);

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders 0% recurrence, never "not available", when the log genuinely has no recurring addresses yet', async () => {
    computeTractionMetrics.mockResolvedValue({
      cumulativeAttributableVolume: '0',
      netNewTVL: '0',
      uniqueFundedAddresses: 0,
      recurrenceRate7d: 0,
      recurrenceRate30d: 0,
    });

    const element = await MetricsPage();
    render(element);

    expect(screen.getAllByText('0%')).toHaveLength(2);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('surfaces a genuine settlement-log read failure explicitly, never a fabricated rate (Issue #22 follow-on)', async () => {
    computeTractionMetrics.mockResolvedValue({
      cumulativeAttributableVolume: '0',
      netNewTVL: '0',
      uniqueFundedAddresses: 0,
      recurrenceRate7d: null,
      recurrenceRate30d: null,
    });

    const element = await MetricsPage();
    render(element);

    expect(screen.getAllByText('Not available right now')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('could not be read just now');
  });
});
