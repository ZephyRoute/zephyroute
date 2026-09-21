import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Disclosure } from './Disclosure';

describe('Disclosure', () => {
  it('hides its content until the trigger is activated', async () => {
    const user = userEvent.setup();
    render(<Disclosure summary="See full quote">Full quote details</Disclosure>);

    expect(screen.queryByText('Full quote details')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'See full quote' }));

    expect(screen.getByText('Full quote details')).toBeInTheDocument();
  });

  it('exposes its expanded state via aria-expanded, never relying on visuals alone', async () => {
    const user = userEvent.setup();
    render(<Disclosure summary="See full quote">Full quote details</Disclosure>);

    const trigger = screen.getByRole('button', { name: 'See full quote' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(<Disclosure summary="See full quote">Full quote details</Disclosure>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
