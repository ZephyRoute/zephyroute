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

Zephyroute fuses two already-live systems into one continuous flow: NEAR Intents' 1Click API for the cross-chain settlement leg, and DeFindex for the yield-deposit leg. DeFindex has undergone a third-party security audit (OtterSec, March 2025); the deployed mainnet contracts sampled and checked directly against DeFindex's own published bytecode hashes matched exactly, with zero discrepancies found, though the full deployment was not exhaustively checked and this internal verification is not itself a substitute for stating "audited" in the way OtterSec's own published report would support. A user connects a wallet, requests a live quote, signs the origin-chain swap, watches funds settle directly into their own Stellar account (the gateway never touches them), and signs one DeFindex deposit. Two signatures, start to finish. The product holds zero custody at any point and deploys zero proprietary Soroban contracts, it is deliberately the thinnest possible layer between two systems that already work.

Nobody has fused NEAR Intents settlement with DeFindex's yield vault specifically into a single flow yet. THORWallet independently validated the broader pattern in November 2025, shipping its own NEAR Intents-into-Stellar swap paired with direct Blend lending access, evidence the underlying demand is real, not a signal Zephyroute arrived late. The gap that remains is specific: DeFindex is a multi-strategy yield vault (composable strategies with a built-in rebalance function, per its own documentation), not a single-protocol integration like direct Blend access, so the yield delivered through Zephyroute can be structurally better, not just differently branded. That gap, and it being confirmed timely since NEAR Intents/1Click is a live, current SCF Integration List building block, is the differentiation.

**Stellar Integration:**

- **NEAR Intents / 1Click API** (confirmed present in the current SCF Integration List, Cross-Chain & Interoperability category) handles cross-chain settlement, landing funds directly in the user's own Stellar account, never the gateway's.
- **DeFindex SDK/API** (confirmed as its own separate current Integration List entry, "Yield Infrastructure for Stellar Wallets & DeFi Apps") for the yield deposit (default USDC Blend Autocompound vault). Zero proprietary Soroban contracts.
- **Stellar Wallets Kit / Freighter** for wallet connection and transaction signing. Non-custodial by construction, the gateway never requests or stores a private key or seed phrase at any layer.
- **Embedded wallet onboarding (DFNS, confirmed present on the current Integration List, estimated 1-5 day integration time)** for users with no existing Stellar account: automated account creation and trustline setup, fee-sponsored so the new user never has to hold XLM to get started. Key material stays with the provider under the user's own authentication, never the gateway, preserving the same non-custodial invariant as the returning-user path.
- **Horizon** for live settlement detection and destination-trustline validation before a quote is even requested.

Three of these (NEAR Intents/1Click, DeFindex, DFNS) are independently confirmed, separately-listed entries on the current SCF Integration List (verified live 2026-09-20 by reading the list itself, not assumed), well beyond the track's minimum of integrating just one.

**Team:**

- [Name], [Role], [Experience], [Link]

**Current Stage:** Idea stage, by the honest definition (no code has been written yet), but unusually de-risked for that stage. Before any planning document existed, the core route was tested live against production: 9 real quotes against the production 1Click API confirmed Ethereum-to-Stellar-USDC, Arbitrum-to-Stellar-USDC, Bitcoin-to-Stellar-USDC, and Ethereum-to-Stellar-XLM all settle successfully (fees ~0.31 to 0.53 percent, 40 to 60 second ETA for the EVM routes, real correlation IDs, real HTTP 201 responses), with a confirmed real technical minimum of about $0.30 on the ETH-to-Stellar-USDC route. The PRD, UX Design Specification, Architecture Decision Document, Epics and Stories breakdown, and a STRIDE threat model are all complete and internally validated (multiple rounds of adversarial review caught and fixed real gaps rather than assuming completeness). This is a deliberate choice, not a delay: the team tested the real integration and defined the full product and its security posture before writing any implementation code.

**Requested Budget Range:** $100K to $150K, consistent with the Financial Protocols category's real distribution researched in `addendum.md` (median $149,820 across 134 funded awards) and within SCF #46's own $150K maximum.

---

### Draft Notes

- **Track decision made, 2026-09-20: staying on Integration Track, real traction is now the explicit goal.** The founder confirmed the decision after reviewing the tension flagged above (the track's own repeated "existing traction" framing versus Zephyroute's current pre-code stage): rather than switch to Instawards or wait, the plan is to actively pursue genuine traction so the fit is real, not argued around. Full detail in `addendum.md` §A.3 and PRD Open Question 14, both updated to reflect this as a decision, not an open tension.
- **AI-disclosure: founder's call made, 2026-09-20, not disclosing.** The founder decided not to mention AI assistance in this submission or in any public-facing material. This draft is written in the founder's own voice, with no AI-authorship framing anywhere. One boundary flagged and acknowledged: if the actual SCF submission form ever asks a direct yes/no question about AI use, answer it truthfully at that point rather than actively denying it, since the Open Track's own page states an explicit AI-disclosure expectation and the Official Rules require representing compliance with all applicable terms when submitting. Not disclosing proactively is the founder's decision to make; falsely denying if directly asked carries real risk (the Official Rules permit clawback and disqualification for misrepresentation) and isn't something this draft is written to support.
- **Team: confirmed sufficient, 2026-09-20.** The founder confirmed the team meets the Official Rules' 2-Eligible-Individual minimum. Still fill in real names, roles, and links before this goes anywhere, an anonymous or unnamed Team section is one of the most common reasons Interest Forms don't advance, but this is no longer flagged as a blocker.
- **Not submitted anywhere.** This is a local draft only. Fill in the Team section and confirm before actually submitting through communityfund.stellar.org.
