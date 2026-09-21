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

- **NEAR Intents / 1Click API** (confirmed present in the current SCF Integration List, Cross-chain category) handles cross-chain settlement, landing funds directly in the user's own Stellar account, never the gateway's.
- **DeFindex SDK/API** for the yield deposit (default USDC Blend Autocompound vault). Zero proprietary Soroban contracts; the architecture composes only existing Integration List building blocks.
- **Stellar Wallets Kit / Freighter** for wallet connection and transaction signing. Non-custodial by construction, the gateway never requests or stores a private key or seed phrase at any layer.
- **Embedded wallet onboarding (DFNS, confirmed live 2026-09-20)** for users with no existing Stellar account: automated account creation and trustline setup, fee-sponsored so the new user never has to hold XLM to get started. Key material stays with the provider under the user's own authentication, never the gateway, preserving the same non-custodial invariant as the returning-user path.
- **Horizon** for live settlement detection and destination-trustline validation before a quote is even requested.

**Team:**

- [Name], [Role], [Experience], [Link]

**Current Stage:** Idea stage, by the honest definition (no code has been written yet), but unusually de-risked for that stage. Before any planning document existed, the core route was tested live against production: 9 real quotes against the production 1Click API confirmed Ethereum-to-Stellar-USDC, Arbitrum-to-Stellar-USDC, Bitcoin-to-Stellar-USDC, and Ethereum-to-Stellar-XLM all settle successfully (fees ~0.31 to 0.53 percent, 40 to 60 second ETA for the EVM routes, real correlation IDs, real HTTP 201 responses), with a confirmed real technical minimum of about $0.30 on the ETH-to-Stellar-USDC route. The PRD, UX Design Specification, Architecture Decision Document, Epics and Stories breakdown, and a STRIDE threat model are all complete and internally validated (multiple rounds of adversarial review caught and fixed real gaps rather than assuming completeness). This is a deliberate choice, not a delay: the team tested the real integration and defined the full product and its security posture before writing any implementation code.

**Requested Budget Range:** $100K to $150K, consistent with the Financial Protocols category's real distribution researched in `addendum.md` (median $149,820 across 134 funded awards) and within SCF #46's own $150K maximum.

---

### Draft Notes

- **Read this before anything else in this list: is Integration Track even the right track yet?** Reading the Integration Track's own page in full (2026-09-20) surfaced a real tension this draft has not resolved. The track's "Who This Track Is For / Not For" section describes it as being for teams with an **already-live application that already has real traction**, integrating Stellar into that existing product, and explicitly states: "Teams building net-new applications (including wallets) without existing traction → Better fit for Instawards." Zephyroute today has no code and no users. There is a real counter-argument (the Submission Criteria page allows "a clearly validated need identified by a team... with relevant experience in the Stellar ecosystem" as an alternative to existing traction), but that depends on your team's actual Stellar/crypto background, which this draft doesn't know. Instawards are not a real substitute for this $100K-$150K goal (capped at $15,000, requires local Ambassador Chapter engagement, and is explicitly framed as a precursor rather than a competing path), so this isn't a simple swap, it's a real strategic call: submit to Integration Track now betting on the "validated need" alternative, engage a local Ambassador Chapter and consider an Instaward first, or something else entirely. Full detail in `addendum.md` §A.3 and PRD Open Question 14. Worth resolving before the other notes below, since it could change whether this draft is even the right document to be polishing.
- **AI-disclosure decision needed before submission.** Verified live 2026-09-20: the SCF Handbook's Open Track page explicitly requires "full-disclosure on the use of AI-generated and AI-assisted artifacts (docs, code, etc.)." The Integration Track's own page doesn't repeat this clause, so it isn't confirmed as a formal requirement here, but this project's entire planning document set (PRD, architecture, UX spec, epics, threat model) was substantially produced with AI assistance (Claude), and the Open Track's stated norm suggests panels likely expect similar transparency regardless of track. This draft does not currently include any AI-disclosure language, deliberately: how you want to characterize your own process is your call, not something to write on your behalf. Decide before submitting whether and how to disclose this (accurately scoped to planning/documentation, since no code has been written yet).
- **Team section is a placeholder, and check it against a hard eligibility rule before filling it in.** This was not fabricated; fill in real names, roles, and links (GitHub/LinkedIn) before this goes anywhere. An anonymous or unnamed team section is one of the most common reasons Interest Forms don't advance, per this skill's own guidance. Separately, and more importantly: the Official Rules for Submissions (read directly 2026-09-20) require "at least 2 Eligible Individuals to be available during the preparation webinars, actively participate in bootcamp activities, and... present during the investor demo day." This is stated as a hard eligibility condition, not a suggestion. Confirm the team already has (or can add) a second Eligible Individual willing to commit to this before submitting, since a solo-founder team as currently drafted would not meet this requirement.
- **Not submitted anywhere.** This is a local draft only. Review, correct the team section, and confirm before actually submitting through communityfund.stellar.org.
