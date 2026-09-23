import {
  OneClickService,
  AccountService,
  OpenAPI,
  QuoteRequest,
  ApiError,
  HistoryItem,
  type QuoteResponse,
} from '@defuse-protocol/one-click-sdk-typescript';

OpenAPI.BASE = 'https://1click.chaindefuser.com';
OpenAPI.TOKEN = () => Promise.resolve(process.env.ONECLICK_API_KEY ?? '');

export class QuoteRequestError extends Error {}
export class QuoteRejectedError extends Error {}
export class MissingIntegratorIdError extends Error {}

export interface RequestQuoteParams {
  originAsset: string;
  destinationAsset: string;
  amount: string;
  recipient: string;
  refundTo: string;
  slippageToleranceBps: number;
  deadline: string;
}

/**
 * FR1/FR2: requests a real (dry:false) quote from 1Click's production
 * endpoint, carrying Zephyroute's registered integrator ID on every
 * request (FR2, Story 1.6). EXACT_INPUT/ORIGIN_CHAIN/DESTINATION_CHAIN
 * mirrors the standard "swap from my origin wallet, land directly in my
 * own destination-chain account" shape this product is built around,
 * the user's funds are never routed through a NEAR Intents or
 * Confidential Intents account.
 *
 * Stellar's deposit-mode quirk (the 1Click API's own type declares some
 * chains, for example Stellar, require `depositMode: MEMO` on their
 * deposit address) does not apply to this call: Zephyroute's supported
 * origin chains are Ethereum, Arbitrum, and Bitcoin, never Stellar, so
 * `depositMode: SIMPLE` is correct here. This would need revisiting only
 * if a future version ever supported a Stellar-origin route.
 */
/**
 * FR2, Story 1.6: zero requests may ever be sent anonymously. This is a
 * hard precondition, not a best-effort default, an unconfigured
 * integrator ID fails loudly before any network call, rather than
 * silently sending an unattributed quote request.
 */
function requiredIntegratorId(): string {
  const referral = process.env.ONECLICK_INTEGRATOR_ID;
  if (!referral) {
    throw new MissingIntegratorIdError(
      'ONECLICK_INTEGRATOR_ID is not configured. Refusing to send an unattributed quote request.'
    );
  }
  return referral;
}

export async function requestQuote(params: RequestQuoteParams): Promise<QuoteResponse> {
  const referral = requiredIntegratorId();
  try {
    return await OneClickService.getQuote({
      dry: false,
      depositMode: QuoteRequest.depositMode.SIMPLE,
      swapType: QuoteRequest.swapType.EXACT_INPUT,
      slippageTolerance: params.slippageToleranceBps,
      originAsset: params.originAsset,
      depositType: QuoteRequest.depositType.ORIGIN_CHAIN,
      destinationAsset: params.destinationAsset,
      amount: params.amount,
      refundTo: params.refundTo,
      refundType: QuoteRequest.refundType.ORIGIN_CHAIN,
      recipient: params.recipient,
      recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
      deadline: params.deadline,
      referral,
    });
  } catch (cause) {
    if (cause instanceof ApiError) {
      // AC #5: a down/unsupported route is rejected explicitly here,
      // before the caller ever presents anything for the user to sign.
      throw new QuoteRejectedError(
        cause.body?.message ?? 'This route is currently unavailable. Try a different route.',
        { cause }
      );
    }
    throw new QuoteRequestError('Could not reach the quote service. Try again.', { cause });
  }
}

export class HistoryQueryError extends Error {}

export interface AttributedSettlement {
  originChainAsset: string;
  /**
   * A human-readable amount (for example "9.969 USDC"), not the raw
   * smallest-units string `CorrelationRecord.settledAmount` stores.
   * `getHistory` exposes no raw-units field at all, only this
   * formatted one, so reconstruction can confirm the same underlying
   * value (after unit conversion), never byte-for-byte string
   * equality; named distinctly here so that difference is never
   * mistaken for a bug.
   */
  settledAmountFormatted: string;
  settledAt: string;
}

/**
 * Story 3.1, AC #9: independent reconstruction source for settled
 * volume, no Redis involved. `getHistory` (`AccountService`, not
 * `OneClickService`, a real correction caught by `tsc` against this
 * SDK's actual class layout, not assumed from its free-floating doc
 * comment) is authenticated with the same JWT `requestQuote` already
 * carries, so its "authenticated user" is Zephyroute's own integrator
 * identity, not an individual end-user NEAR Intents account, the same
 * "1Click's integrator-attributed records" the AC names, though this
 * hasn't been confirmed against a live call (no real 1Click credential
 * exists yet in this environment, the same honest gap
 * `DEFINDEX_VAULT_ADDRESS` already has). A single page is searched, not
 * the full paginated history: this function reconstructs one specific
 * address's settlement (the same use the correlation record itself
 * serves), not the aggregate reporting Story 3.2 covers separately.
 */
export async function findAttributedSettlement(
  stellarAddress: string
): Promise<AttributedSettlement | null> {
  let history;
  try {
    history = await AccountService.getHistory(
      undefined,
      undefined,
      [HistoryItem.status.SUCCESS],
      100
    );
  } catch (cause) {
    throw new HistoryQueryError('Could not reach the settlement history service. Try again.', {
      cause,
    });
  }

  const match = history.items.find((item) => item.recipient === stellarAddress);
  if (!match || !match.originAsset || !match.amountOutFormatted || !match.createdAt) {
    return null;
  }

  return {
    originChainAsset: match.originAsset,
    settledAmountFormatted: match.amountOutFormatted,
    settledAt: match.createdAt,
  };
}
