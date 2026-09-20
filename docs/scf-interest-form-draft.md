---
status: 'draft, not submitted'
inputDocuments:
  - docs/prds/prd-stellar-intents-gateway-2026-08-25/prd.md
  - docs/prds/prd-stellar-intents-gateway-2026-08-25/addendum.md
  - docs/architecture.md
  - docs/threat-model.md
targetRound: 'SCF #46'
deadline: 'November 8, 2026'
date: '2026-09-20'
---

## Interest Form Draft: Zephyroute

**One-Line Description:** A non-custodial gateway that lets crypto holders on Ethereum, Arbitrum, and Bitcoin move idle capital into Stellar yield in two wallet signatures, using NEAR Intents to settle directly into the user's own Stellar account.

**Project Description:**

Self-custody crypto users holding idle stablecoins or BTC on Ethereum, Arbitrum, or Bitcoin have no fast path into Stellar's yield infrastructure without manually bridging funds, learning Stellar's account model (trustlines, reserves), and executing several disconnected steps across separate products. That friction, not a lack of yield opportunity on Stellar, is what keeps outside capital from reaching it.

Zephyroute fuses two already-live systems into one continuous flow: NEAR Intents' 1Click API for the cross-chain settlement leg, and DeFindex for the yield-deposit leg. DeFindex has undergone a third-party security audit (OtterSec); confirming the deployed mainnet bytecode matches the audited, patched commits is a final pre-submission verification step, tracked internally, before any "audited" claim is repeated in a public submission. A user connects a wallet, requests a live quote, signs the origin-chain swap, watches funds settle directly into their own Stellar account (the gateway never touches them), and signs one DeFindex deposit. Two signatures, start to finish. The product holds zero custody at any point and deploys zero proprietary Soroban contracts, it is deliberately the thinnest possible layer between two systems that already work.

Nobody has fused NEAR Intents settlement with DeFindex's yield vault specifically into a single flow yet. THORWallet independently validated the broader pattern in November 2025, shipping its own NEAR Intents-into-Stellar swap paired with direct Blend lending access, evidence the underlying demand is real, not a signal Zephyroute arrived late. The gap that remains is specific: DeFindex is a multi-strategy yield vault (composable strategies with a built-in rebalance function, per its own documentation), not a single-protocol integration like direct Blend access, so the yield delivered through Zephyroute can be structurally better, not just differently branded. That gap, and it being confirmed timely since NEAR Intents/1Click is a live, current SCF Integration List building block, is the differentiation.

**Stellar Integration:**

- **NEAR Intents / 1Click API** (confirmed present in the current SCF Integration List, Cross-chain category) handles cross-chain settlement, landing funds directly in the user's own Stellar account, never the gateway's.
- **DeFindex SDK/API** for the yield deposit (default USDC Blend Autocompound vault). Zero proprietary Soroban contracts; the architecture composes only existing Integration List building blocks.
- **Stellar Wallets Kit / Freighter** for wallet connection and transaction signing. Non-custodial by construction, the gateway never requests or stores a private key or seed phrase at any layer.
- **Horizon** for live settlement detection and destination-trustline validation before a quote is even requested.

**Team:**

- [Name], [Role], [Experience], [Link]

**Current Stage:** Idea stage, by the honest definition (no code has been written yet), but unusually de-risked for that stage. The PRD, UX Design Specification, Architecture Decision Document, Epics and Stories breakdown, and a STRIDE threat model are all complete and internally validated (multiple rounds of adversarial review caught and fixed real gaps rather than assuming completeness). This is a deliberate choice, not a delay: the team defined the full product and its security posture before writing any implementation code.

**Requested Budget Range:** $100K to $150K, consistent with the Financial Protocols category's real distribution researched in `addendum.md` (median $149,820 across 134 funded awards) and within SCF #46's own $150K maximum.

---

### Draft Notes

- **Team section is a placeholder.** This was not fabricated; fill in real names, roles, and links (GitHub/LinkedIn) before this goes anywhere. An anonymous or unnamed team section is one of the most common reasons Interest Forms don't advance, per this skill's own guidance.
- **"Idea stage" may read as a weak signal on its own.** The draft leans on the depth of planning as the mitigating evidence, which is honest, but consider whether to also mention any live technical validation already done (the Phase 2 research referenced in `addendum.md` §C tested real, non-dry quotes against 1Click; if that still holds as genuine evidence of feasibility, it is worth citing explicitly here, since "we tested the real APIs" is stronger than "we planned thoroughly" alone).
- **Not submitted anywhere.** This is a local draft only. Review, correct the team section, and confirm before actually submitting through communityfund.stellar.org.
