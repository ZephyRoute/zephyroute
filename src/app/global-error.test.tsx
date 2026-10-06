import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GlobalError from './global-error';

describe('global-error.tsx (Issue #55)', () => {
  it('renders a visible fallback and logs the error, never a blank page', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new window.Error('boom');

    render(<GlobalError error={error} retry={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(consoleError).toHaveBeenCalledWith(error);
    consoleError.mockRestore();
  });
});
