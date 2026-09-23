import { describe, expect, it } from 'vitest';
import { decodeFunctionData } from 'viem';
import { buildOriginSwapTransaction, UnsupportedOriginChainError } from './origin-swap';
import { SUPPORTED_ROUTES } from './routes';

const ethereumUsdcRoute = SUPPORTED_ROUTES.find((r) => r.label === 'Ethereum USDC to Stellar USDC')!;
const baseUsdcRoute = SUPPORTED_ROUTES.find((r) => r.originChain === 'base')!;
const bitcoinRoute = SUPPORTED_ROUTES.find((r) => r.originChain === 'bitcoin')!;

describe('buildOriginSwapTransaction', () => {
  it('builds an ERC-20 transfer() call to the deposit address, using the quoted amount verbatim, never a native value send', () => {
    const depositAddress = '0x1111111111111111111111111111111111111111';
    const tx = buildOriginSwapTransaction(ethereumUsdcRoute, depositAddress, '10000000');

    expect(tx.to).toBe(ethereumUsdcRoute.originContract);
    expect(tx.value).toBeUndefined();

    const decoded = decodeFunctionData({
      abi: [
        {
          name: 'transfer',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ name: '', type: 'bool' }],
        },
      ],
      data: tx.data!,
    });

    expect(decoded.functionName).toBe('transfer');
    expect(decoded.args[0].toLowerCase()).toBe(depositAddress);
    expect(decoded.args[1]).toBe(BigInt(10000000));
  });

  it('builds the same kind of ERC-20 transfer() call for the Base route (PRD Open Question 3, verified live 2026-09-22)', () => {
    const depositAddress = '0x2222222222222222222222222222222222222222';
    const tx = buildOriginSwapTransaction(baseUsdcRoute, depositAddress, '5000000');

    expect(tx.to).toBe(baseUsdcRoute.originContract);
    expect(baseUsdcRoute.chainId).toBe(8453);

    const decoded = decodeFunctionData({
      abi: [
        {
          name: 'transfer',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ name: '', type: 'bool' }],
        },
      ],
      data: tx.data!,
    });
    expect(decoded.args[1]).toBe(BigInt(5000000));
  });

  it('refuses to build a Bitcoin transaction rather than producing a meaningless EVM shape', () => {
    expect(() => buildOriginSwapTransaction(bitcoinRoute, 'bc1qxyz', '100000')).toThrow(
      UnsupportedOriginChainError
    );
  });
});
