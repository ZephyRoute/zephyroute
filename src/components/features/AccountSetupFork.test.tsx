import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { AccountSetupFork } from './AccountSetupFork';

describe('AccountSetupFork', () => {
  it('shows a visible, explicitly named step, never a silent or generic alert (AC #1)', () => {
    render(<AccountSetupFork status="idle" errorMessage={null} stellarAddress={null} onCreateAccount={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent('Setting up your Stellar account');
    expect(screen.getByText(/routing you through a quick account setup step/)).toBeInTheDocument();
  });

  it('requires an email before the create-account button is enabled', async () => {
    const user = userEvent.setup();
    const onCreateAccount = vi.fn();
    render(
      <AccountSetupFork
        status="idle"
        errorMessage={null}
        stellarAddress={null}
        onCreateAccount={onCreateAccount}
      />
    );

    const button = screen.getByRole('button', { name: 'Create my Stellar account' });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText(/Email/), 'user@example.com');
    expect(button).toBeEnabled();

    await user.click(button);
    expect(onCreateAccount).toHaveBeenCalledWith('user@example.com');
  });

  it('shows a distinct status label at each stage of onboarding, never a silent wait', () => {
    render(<AccountSetupFork status="signing" errorMessage={null} stellarAddress={null} onCreateAccount={vi.fn()} />);

    expect(screen.getByText('Waiting for your passkey...')).toBeInTheDocument();
  });

  it('surfaces a failure explicitly, never a silent dead end', () => {
    render(
      <AccountSetupFork
        status="failed"
        errorMessage="Could not create your passkey. Try again."
        stellarAddress={null} onCreateAccount={vi.fn()}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not create your passkey.');
  });

  it('shows the new account is ready once onboarding completes', () => {
    render(
      <AccountSetupFork
        status="completed"
        errorMessage={null}
        stellarAddress="GNEWACCOUNTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        onCreateAccount={vi.fn()}
      />
    );

    expect(screen.getByText(/account is ready/)).toBeInTheDocument();
  });

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(
      <AccountSetupFork status="idle" errorMessage={null} stellarAddress={null} onCreateAccount={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
