import {
  OneClickService,
  OpenAPI,
  QuoteRequest,
  ApiError,
  type QuoteResponse,
} from '@defuse-protocol/one-click-sdk-typescript';

OpenAPI.BASE = 'https://1click.chaindefuser.com';
OpenAPI.TOKEN = () => Promise.resolve(process.env.ONECLICK_API_KEY ?? '');

export class QuoteRequestError extends Error {}
export class QuoteRejectedError extends Error {}

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
export async function requestQuote(params: RequestQuoteParams): Promise<QuoteResponse> {
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
      referral: process.env.ONECLICK_INTEGRATOR_ID,
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
