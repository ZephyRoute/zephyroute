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
