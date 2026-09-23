import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const { depositToVault, getVaultBalance } = vi.hoisted(() => ({
  depositToVault: vi.fn(),
  getVaultBalance: vi.fn(),
}));

vi.mock('@defindex/sdk', () => ({
  DefindexSDK: class {
    depositToVault = depositToVault;
    getVaultBalance = getVaultBalance;
  },
  SupportedNetworks: { MAINNET: 'mainnet', TESTNET: 'testnet' },
}));

const { buildDepositTransaction, DepositBuildError, getDepositorVaultBalance, VaultBalanceQueryError } =
  await import('./defindex-client');
const { InvalidTransactionXDRError } = await import('./validation');

const VALID_XDR = 'AAAAAgAAAAB' + 'A'.repeat(50);

describe('buildDepositTransaction', () => {
  const originalVault = process.env.DEFINDEX_VAULT_ADDRESS;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEFINDEX_VAULT_ADDRESS = 'CVAULTTESTADDRESS';
  });

  afterEach(() => {
    process.env.DEFINDEX_VAULT_ADDRESS = originalVault;
  });

  it('refuses to build a deposit at all when the vault address is not configured, never guessing one', async () => {
    delete process.env.DEFINDEX_VAULT_ADDRESS;

    await expect(buildDepositTransaction('GDEPOSITOR', '10000000')).rejects.toBeInstanceOf(
      DepositBuildError
    );
    expect(depositToVault).not.toHaveBeenCalled();
  });

  it('builds with invest:true and a real, non-zero slippageBps by default (FR7)', async () => {
    depositToVault.mockResolvedValue({ xdr: VALID_XDR });

    await buildDepositTransaction('GDEPOSITOR', '10000000');

    const [vaultAddress, params] = depositToVault.mock.calls[0];
    expect(vaultAddress).toBe('CVAULTTESTADDRESS');
    expect(params.invest).toBe(true);
    expect(params.slippageBps).toBeGreaterThan(0);
    expect(params.caller).toBe('GDEPOSITOR');
    expect(params.amounts).toEqual([10000000]);
  });

  it('accepts a caller-specified slippageBps instead of the default', async () => {
    depositToVault.mockResolvedValue({ xdr: VALID_XDR });

    await buildDepositTransaction('GDEPOSITOR', '10000000', 250);

    expect(depositToVault.mock.calls[0][1].slippageBps).toBe(250);
  });

  it('returns a validated XDR, never a raw unvalidated string, to the caller (AC #3/#4)', async () => {
    depositToVault.mockResolvedValue({ xdr: VALID_XDR });

    const result = await buildDepositTransaction('GDEPOSITOR', '10000000');

    expect(result.xdr).toBe(VALID_XDR);
  });

  it('returns the vault address alongside the xdr, so the UI can render the real destination', async () => {
    depositToVault.mockResolvedValue({ xdr: VALID_XDR });

    const result = await buildDepositTransaction('GDEPOSITOR', '10000000');

    expect(result.vaultAddress).toBe('CVAULTTESTADDRESS');
  });

  it('rejects if DeFindex returns a response with no XDR at all', async () => {
    depositToVault.mockResolvedValue({ xdr: null });

    await expect(buildDepositTransaction('GDEPOSITOR', '10000000')).rejects.toBeInstanceOf(
      DepositBuildError
    );
  });

  it('propagates validation failure if DeFindex returns something that is not really an XDR', async () => {
    depositToVault.mockResolvedValue({ xdr: 'not-a-real-xdr' });

    await expect(buildDepositTransaction('GDEPOSITOR', '10000000')).rejects.toBeInstanceOf(
      InvalidTransactionXDRError
    );
  });

  it('wraps an SDK failure as DepositBuildError, never a silent failure', async () => {
    depositToVault.mockRejectedValue(new Error('DeFindex API is down'));

    await expect(buildDepositTransaction('GDEPOSITOR', '10000000')).rejects.toBeInstanceOf(
      DepositBuildError
    );
  });
});

describe('getDepositorVaultBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the real dfTokens and underlying balance from the vault', async () => {
    getVaultBalance.mockResolvedValue({ dfTokens: 100, underlyingBalance: [9900000] });

    const result = await getDepositorVaultBalance('CVAULT', 'GDEPOSITOR');

    expect(result).toEqual({ dfTokens: 100, underlyingBalance: [9900000] });
    expect(getVaultBalance).toHaveBeenCalledWith('CVAULT', 'GDEPOSITOR');
  });

  it('wraps an SDK failure as VaultBalanceQueryError, never a silent failure', async () => {
    getVaultBalance.mockRejectedValue(new Error('DeFindex API is down'));

    await expect(getDepositorVaultBalance('CVAULT', 'GDEPOSITOR')).rejects.toBeInstanceOf(
      VaultBalanceQueryError
    );
  });
});
