/**
 * Two distinct state layers (architecture.md, Communication Patterns),
 * matching the UX spec's exact string literals verbatim: `FlowStage`
 * for the persistent Guided Status rail, `DepositTransactionStatus`
 * for the deposit-signing moment's own micro-states. Never flatten
 * these into one union or paraphrase a literal (for example shortening
 * "confirming on-chain" to "confirming"), that was a real bug this
 * project already found and fixed once during architecture validation.
 */
export type FlowStage = 'quoted' | 'submitted' | 'settled' | 'depositing' | 'earning';

export type DepositTransactionStatus =
  | 'submitted'
  | 'confirming on-chain'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'reverted';

/**
 * AC #4 (review before signing), enforced at the type level, not just
 * convention (architecture.md, Architectural Boundaries): a branded
 * type only `lib/validation.ts` can produce, so `wallet-kit.ts`'s sign
 * function accepting anything else is a compile error, not a runtime
 * risk. The brand is a private symbol, never exported, so no other
 * module can fabricate one by just matching the shape.
 */
declare const validatedTransactionXdrBrand: unique symbol;
export type ValidatedTransactionXDR = string & { readonly [validatedTransactionXdrBrand]: true };
