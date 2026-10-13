import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Error from './error';

describe('error.tsx (Issue #55)', () => {
  it('renders a visible fallback and logs the error, never a blank page', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const retry = vi.fn();
    const error = new window.Error('boom');

    render(<Error error={error} retry={retry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(consoleError).toHaveBeenCalledWith(error);
    consoleError.mockRestore();
  });

  it('calls retry when "Try again" is clicked', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const retry = vi.fn();
    const user = userEvent.setup();

    render(<Error error={new window.Error('boom')} retry={retry} />);
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(retry).toHaveBeenCalledOnce();
  });
});
