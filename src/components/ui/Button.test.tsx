import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Button } from './Button';

describe('Button', () => {
  it('defaults to the primary variant', () => {
    render(<Button>Continue</Button>);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('renders the secondary variant when specified', () => {
    render(<Button variant="secondary">Learn more</Button>);
    expect(screen.getByRole('button', { name: 'Learn more' })).toBeInTheDocument();
  });

  it('renders the tertiary variant when specified', () => {
    render(<Button variant="tertiary">Dismiss</Button>);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('calls onClick when activated', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Sign</Button>);

    await user.click(screen.getByRole('button', { name: 'Sign' }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled and non-interactive when the disabled prop is set', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button onClick={onClick} disabled>
        Sign
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Sign' });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('has no automatically detectable accessibility violations in any variant', async () => {
    const { container } = render(
      <>
        <Button variant="primary">Continue</Button>
        <Button variant="secondary">Learn more</Button>
        <Button variant="tertiary">Dismiss</Button>
      </>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
