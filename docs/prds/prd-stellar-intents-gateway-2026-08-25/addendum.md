# Addendum — PRD: Stellar Intents Gateway

Depth that belongs to the record but doesn't belong in the PRD's main narrative: full evidence tables, rejected-alternative rationale, and competitive/sizing data gathered during Discovery. The PRD references specific sections of this file inline; treat this as supporting evidence, not as requirements.

## §A. Competitive Landscape

### A.1 On Stellar — adjacent products

No project found doing the exact combined flow (NEAR Intents/1Click + HOT Bridge → Stellar → auto-deposit into DeFindex/Blend) as a single product. Closest adjacent players (via LumenLoop/stellar-raven):

| Project | SCF Award | Status | What it does | Gap vs. this product |
|---|---|---|---|---|
| **WOWMAX** | $98,560 | Live | Multi-chain DEX + bridge aggregator; aggregates NEAR Intents, Allbridge, Axelar as Stellar↔EVM bridge options, plus Stellar-side swap routing (SDEX/Soroswap/Phoenix/Aquarius). Live on 20+ EVM chains, $2B+ volume, 336k+ traders. | Stops at swap/bridge — no yield-landing leg. Nearest precedent for the acquisition half only. |
| **Rozo** | $248,000 | Live | Intent-based stablecoin *payments* network ("Rozo Intent Pay"); cross-chain USDC bridge (bridge.rozo.ai) on Circle CCTP v2, not NEAR Intents. | Payments-first, not a yield-deposit product; different bridge tech entirely. |
| **BIM Exchange** | $107,700 | Live | Aggregation layer across swap/bridge routing *plus* automated staking/yield with auto-compounding — closest conceptual analog to "bridge + auto-yield" as one pitch. | Not NEAR-Intents-sourced; not explicitly Blend/DeFindex-routed. |
| **For Yield** | $144,000 | Live | French MiCA-regulated product composing DeFindex + Blend v2 + Aquarius + Soroswap + Allbridge to route EU capital into Stellar yield, EURC-first. Validates the "compose Integration List building blocks, no new contracts" pattern this project also relies on. | Sourced via Allbridge/fiat rails, not NEAR Intents; targets regulated EU institutional capital, not retail cross-chain swappers. |
| **Templar Protocol** | Not SCF-funded (Stellar integration announced Nov 2025) | Live | "Cypher lending" — borrow USDC against XLM collateral using NEAR's MPC network / Chain Signatures, no bridges/wrapped tokens. Only other Stellar project wired into NEAR's cross-chain stack; confirmed 2026-09-20 as the SCF Handbook's own cited example integration on the official Integration List's Near Intents entry, an independent corroboration of this project's own finding, not just this project's own research. | Different primitive (borrowing, not swap-in/yield-deposit). |
| **DeFindex** (itself) | $150,000 | Live | The yield-vault infrastructure this product routes into — a component/potential partner, not a competitor. | N/A |
| Generic bridge aggregators present on Stellar | $60k–$115k typical | Live/mixed | Rubic, Rango, Houdiniswap (privacy-focused), Squid (via Axelar), Allbridge, Axelar, Spectra Bridge (in dev). | None combine with an auto-yield-deposit landing step. |

**Read:** the acquisition half (NEAR Intents → Stellar) has a partial precedent (WOWMAX). The destination half (→ DeFindex/Blend yield) has full precedent (DeFindex, For Yield, BIM Exchange). Nobody has fused specifically these two. That fusion is the differentiation.

**Figures re-verified live 2026-09-20** against the SCF project directory itself (both had been flagged earlier as not matching an offline dataset, unconfirmed): WOWMAX's $98,560 is exact, one awarded submission in SCF #43 (Build, End-User Application), and its own GitHub repo (`wowmax-near-intents-integration`) confirms the NEAR Intents integration claimed above. Rozo's $248,000 is also correct, it is the sum of two separate awarded submissions ($98.0K in SCF #44, $150.0K in SCF #38), not a single-round figure; a third Rozo submission in SCF #43 ($150.0K requested) was not awarded and isn't counted. Both figures in the table above stand as originally written.

### A.2 Comparable "bridge-and-earn" products in other ecosystems

| Product | Chain scope | Mechanism | Positioning language |
|---|---|---|---|
| **Superform** | Multi-chain (own L2 + omnichain neobank) | User states an intent ("maximize yield," a risk profile); protocol handles bridge+swap+deposit into 1,000+ vaults across chains in one tx, via LayerZero/Wormhole/Hyperlane AMBs + ERC-7579 smart accounts ("Hooks"). | Closest overall analog to this product's UX pattern — just chain-agnostic rather than Stellar-destination-only. |
| **Jumper Exchange** (built on LI.FI Composer/Earn) | Multi-chain | One-click "bridge and earn"/zaps — e.g. deposit from Base into Aave on Arbitrum in one click; batches swap+bridge+approve+deposit into one smart-wallet call. | Curated blue-chip venues (Aave, Fluid, Lido, EtherFi, Morpho, Euler, Gearbox, Spark). |
| **Enso Finance** | Multi-chain (160+ protocols) | "Intent engine" — describe a goal, execution layer picks modular "Shortcuts" (swap/stake/lend/rebalance), now including Chainlink CCIP for cross-chain execution. | Markets as turning DeFi "fragmented to functional" — outcome-driven, not step-driven. |
| **Squid Router** (built on Axelar) | 50+ chains | Generalized message passing; positioned as composable infra other apps build on (yield-landing via composability partners like Portals.fi) rather than a consumer-facing surface itself. | "One-click transactions between any application and any user using any asset." |

**Pattern:** positioning converges on "intent," "one-click," "any chain/any token → outcome," abstracting away bridging/swapping/depositing into one action. None frame around a single destination chain the way this product would — legitimate narrowing angle: "the fastest way to land external capital into Stellar yield," not "yet another any-to-any router."

Sources: Superform docs (docs.superform.xyz/e2e-flows/cross-chain-deposit), LI.FI Earn (li.fi/knowledge-hub/introducing-li-fi-earn), Enso explainer (web3.bitget.com), Axelar/Squid case study (axelar.network/blog/cross-chain-liquidity-via-squid).

### A.3 SCF Integration Track mechanics (detail)

- **What "existing traction" actually looked like for the exact precedents, checked live 2026-09-20.** Pulled the real SCF submission text for all three closest comparables. WOWMAX: $2B+ volume, 336,000+ traders, but all from an already-operating multi-chain product, Stellar was the new integration. For Yield: not crypto traction at all, an already-regulated French fund with 50 HNW clients, ~€7-8M AUM, and 35,000+ newsletter subscribers via an existing media partner. **BIM Exchange is the closest comparable in scale and the most useful precedent**: a small, real, already-live DeFi protocol with just **~$525K TVL, 20 vaults, 160 total users** across 6 EVM chains, a 7-person team (CEO, CTO, Lead Developer, Lead DeFi, CMO, Operations, Content), and a founder with one prior project (Tokeshare, real-estate tokenization). Their Stellar integration itself was Tranche 1's actual deliverable, built in the weeks after the award, not before submission, they only needed a live testnet proof-of-concept page at application time. Read together, the "existing traction" bar these projects actually cleared is not massive scale, it's a real, live, even if modest product with genuine users, built before applying, with Stellar added as the new integration rather than the founding premise. This reframes what "build real traction" concretely requires for Zephyroute: not comparable volume to WOWMAX, but *something real and live*, however small, which is a different question from the documentation-completeness question this project has been focused on, and gets close to the project's own standing "no code before docs are perfect" gate, since a genuinely live product is hard to have without at least a minimal build. Surfaced clearly rather than acted on unilaterally, since crossing from documentation into implementation is a decision the founder has consistently kept for himself throughout this project.
- **Track-fit tension, decided 2026-09-20: staying on Integration Track, real traction is now the explicit goal, not an argued-around gap.** The track's own "Who This Track Is For" / "Who This Track Is Not For" section states it is for "teams that have applications with **existing traction**" integrating Stellar building blocks into that already-live product, and explicitly routes the opposite case elsewhere: "Teams building net-new applications (including wallets) **without existing traction** → Better fit for Instawards." Corroborated a third time via the Quarterly Governance Process page's own track table ("Applications with existing traction integrating building blocks to support Stellar"), consistent internal SCF language, not an isolated wording choice. Zephyroute, as currently scoped, is a net-new application with zero code and zero users, so this tension is real, not a misreading. The founder's decision: rather than switch to Instawards (not a real substitute for the $100K-$150K ask, capped at $15,000, requires local Ambassador Chapter engagement, framed as a precursor not a parallel path) or wait, actively build the traction the track expects before or alongside submission. This reframes the "validated need... team with relevant experience" alternate path in the Submission Criteria from a fallback argument into a secondary strength, not the primary plan.
- Reviewed via **Panel Review only** (no community vote for Integration Track); cutoff around 1/40 NQG score; 11–13 panel members.
- Tranches: #0–#2 (10/20/30%) milestone-based as usual; **#3 (40%, the largest single payment)** releases only against a **committed, panel-ratified on-chain success metric** (NAV target or cumulative volume/payments, over an agreed window) — the panel explicitly disregards self-generated, washed, or gamed activity.
- Eligibility guardrail: Open Track explicitly redirects "applications with traction primarily focused on integrating existing tools like wallets, anchors, or passkeys" to the Integration Track, and warns teams "replicating existing ecosystem solutions" to either use this track or articulate clear improvement if staying on Open Track — relevant given the WOWMAX/BIM Exchange/For Yield precedent above.
- Full/current Integration List rotates quarterly; **re-confirmed live 2026-09-20** via the SCF Handbook itself, NEAR Intents/1Click is present under the Cross-chain category as of that check. Since the list rotates, re-verify once more immediately before actual submission if significant time has passed.
- **Minimum team size, read directly from the Official Rules for Submissions, 2026-09-20:** "Your Team or Organization must appoint and authorize at least 2 Eligible Individuals to be available during the preparation webinars, actively participate in bootcamp activities, and should you be interested and get selected as one of the finalists, present during the investor demo day." This is a hard eligibility requirement, not a suggestion, and applies regardless of track. **Confirmed by the founder, 2026-09-20: met.** An "Eligible Individual" additionally must be 18+, not resident in a sanctioned jurisdiction (Cuba, Iran, North Korea, Russian-controlled Ukraine, or an OFAC-sanctioned region), not on the OFAC SDN list, and not in a jurisdiction where holding cryptocurrency is illegal or requires an unheld license.
- **Integration Track budget-use restriction, precise figure found 2026-09-20 in Budget & Deliverable Guidelines:** up to **one-third (1/3) of the total budget**, drawn from tranche #2 and tranche #3 specifically, may fund "narrow, validation-focused user testing activities to prove the flow with real initial users." Broad paid acquisition stays prohibited. The same page's general Budget DON'Ts list also excludes audit costs (covered separately by Audit Bank, not relevant here since Zephyroute has no proprietary contract to audit), bounties/token giveaways/prize pools, legal fees or entity registration costs, and reimbursement for past work, and states a **6-month maximum project timeline**, comfortably compatible with this project's own aggressive weeks-scale target. Directly relevant to how `scf-interest-form-draft.md`'s Requested Budget Range should eventually be allocated across tranches once a full Build application is drafted, not just the Interest Form stage.
- **Documentation-before-code, confirmed as SCF's own expectation, same page:** "Your technical architecture must already be complete at the time of application," "Tranche 1 should focus on actual development, not planning, research, or system design," and "Mapping out the system should be done before you submit." This directly validates the founder's own standing instruction throughout this project (documented in this project's own memory of prior instructions) not to begin `dev-story`/implementation until the documentation set is complete: it is not just a personal preference, SCF Build itself expects the architecture to already be finished before Tranche 1 work (real development) begins.
- **No false SDF/SCF endorsement claims, same source:** any Award-funded content or marketing must not represent or imply the product is "endorsed, audited, vetted, or approved by SDF or SCF," nor use SDF/SCF's logo or trademark without permission. Distinct from, but the same category of caution as, the existing hard gates on "audited" (DeFindex, Open Question 4) and "KYC-free" (Open Question 5) claims.
- **Registered Footprint detail, same source:** confirms and extends what `prd.md`'s Risk table already anticipated (the address-correlation layer as the best candidate footprint) by naming the exact eligible categories: "Soroban contract IDs, asset issuing accounts, application-operated wallets, and sponsored accounts (per CAP-33)." The correlation layer's integrator-ID-tagged addresses most likely register as application-operated wallets under this list, but this is still not independently confirmed acceptable to the panel (Open Question 11 stays open).
- **AI-disclosure, decided by the founder 2026-09-20: not disclosing.** The Handbook's Open Track page explicitly requires "full-disclosure on the use of AI-generated and AI-assisted artifacts (docs, code, etc.)" as part of what makes a strong submission; the Integration Track's own page doesn't repeat this clause, and the general Official Rules page doesn't contain a broader AI-disclosure clause either, so it isn't a confirmed formal Integration Track requirement. The founder's decision, after this was flagged: no AI-disclosure language anywhere in this submission or any public-facing material, written throughout in the founder's own voice. One boundary the founder acknowledged: not proactively disclosing is a legitimate choice, but if the actual submission form asks a direct yes/no AI-use question, it gets answered truthfully at that point rather than actively denied, since the Official Rules require representing compliance with all applicable program terms when submitting, and a false denial (as opposed to simply not volunteering) carries real risk under the Official Rules' remedies (clawback, disqualification from future programs) if discovered post-award.

### A.4 THORWallet detail

Self-custody, multi-chain DeFi "superapp" wallet (iOS/Android/Web) built around native cross-chain swaps, no bridges, no wrapped tokens, for BTC, ETH, SOL, and 20,000+ tokens, built on/around THORChain's native liquidity model. Swaps under $100 are free. Also offers staking/yield, multisig vaults, and a Swiss account with a global Mastercard. ~165k wallet users.

**[UPDATE, 2026-09-20, verified live]** THORWallet has already launched a native Stellar integration (announced November 2025): "swap into Stellar assets, access Blend lending, swap out across chains, all without leaving the app," using NEAR Intents for the cross-chain leg and Blend (not DeFindex) as the yield backend. This is materially different from the Phase 2 research's framing of THORWallet as an unconfirmed embed candidate: THORWallet did not wait for a third-party corridor, they built their own native version of essentially this product's core loop directly. No mention of DeFindex, open embeds, or third-party corridor arrangements was found in their own announcement.

**What this changes, decided with the user on 2026-09-20:**
- PRD Open Question 7 ("is THORWallet's routing already able to add Stellar as a destination") is now answered: yes, and they did it without Zephyroute.
- The FR12/Epic 4 embed pitch to THORWallet specifically ("integrate this gateway as a corridor without building their own DeFindex integration") is weakened for the swap-plus-yield use case, since they already built an in-house version, using Blend rather than DeFindex. **Decision: THORWallet is deprioritized as the primary Epic 4 target partner** (see FR12 note in `prd.md` §12 and `epics.md` Epic 4). The widget itself stays generic, per its original design; the next candidate partner should specifically be one that does not already have a native swap-to-Stellar-yield loop.
- **This is read as validation, not a threat.** A major multi-chain wallet independently building close to the same core loop (NEAR Intents settlement into Stellar yield) is evidence the underlying demand is real, reducing "is there demand" risk for Zephyroute's own thesis, even while direct competition now exists for that specific loop.
- **The DeFindex-specific differentiation is the angle to lean into, verified live:** DeFindex is not a single-protocol integration like THORWallet's direct Blend access. Per DeFindex's own documentation, it supports "multiple assets and strategies per asset" (composable strategies) with a built-in rebalance function, architected to extend to more strategies over time, consistent with the "Autocompound" naming already used for the default vault (PRD FR-7). A vault that can allocate across multiple yield strategies, of which Blend may be one, is a genuine structural difference from THORWallet's single-protocol access, not just a different brand of the same thing. This is the concrete "similar but improved" argument, not a marketing claim.

## §B. Custody / Regulatory Analysis (full table)

| Dependency | Present in Architecture A′? | Eliminable? |
|---|---|---|
| Legal entity to operate protocol | NO — A′ doesn't require an entity operating critical infra | Already eliminated by design |
| Custody of funds | NO (2-signature flow) | Would only appear if Architecture B is built with a badly-designed policy allowing arbitrary transfers; eliminable by scoping such a policy to `deposit()` only, never free transfers |
| Fiat on/off-ramp | NO | Already eliminated by design (fully crypto-to-crypto in v1) |
| End-user KYC/AML | **TENSION** | 1Click's ToS imposes the obligation on the "Developer" (integrator) calling the API, regardless of which architecture is chosen — probably resolvable via geoblocking/sanctions screening rather than identity KYC, but not confirmed legally sufficient (PRD Open Question 5) |
| Money transmitter / broker-dealer / banking license | NO | Already eliminated by design — no independent total control over funds under the 2019 FinCEN "independent control" test in Architecture A′ |

**Custody trace by flow stage:**

| Stage | Who controls funds | Can the gateway freeze/withdraw? |
|---|---|---|
| User → Solver | Market maker has transitory possession during matching (per NEAR's own docs: "temporarily transferring assets to a trusted swapping agent") | NO — the gateway never touches this step |
| Solver → Stellar G-account | User exclusively, via private key | NO |
| G-account → DeFindex vault | User signs the transfer; once inside, the vault contract (governed by PaltaLabs Manager/Emergency Manager roles) custodies the underlying asset — a DeFindex trust assumption, not introduced by the gateway | NO — gateway has no admin role in the vault |
| Vault shares (dfTokens) | User, via Stellar address | NO |

**Can a solver steal funds?** Structural risk of the intents model if a market maker receives the origin deposit and doesn't settle at destination. Mitigated by NEAR's Verifier contract and a confirmed-live refund mechanism — every real quote returns `refundTo`, `refundType`, and `refundFee` (an amount specifically reserved to refund on settlement failure).

**If the DeFindex deposit fails?** Funds are already in the user's own Stellar account from the prior step — a failure at this stage only costs the gas of a failed attempt; money never leaves the user's exclusive control.

## §C. Full Failure-Mode Table (Phase 2)

| Failure Mode | Evidence | User Loses Funds? |
|---|---|---|
| Solver unavailable | Observed live (Base, Solana) | No — quote fails before user sends anything |
| Insufficient liquidity/amount | Observed live ("Amount is too low for bridge") | No — rejected before send |
| Price change/slippage | `slippageTolerance` + `minAmountOut` present in every real quote | No, within configured tolerance |
| Timeout/expired deadline | `deadline` field present/accepted; exact refund behavior not tested end-to-end with a real failure | Probably not (refund mechanism exists) — not confirmed end-to-end |
| DeFindex deposit fails (tx expires, bad params) | Confirmed by Soroban design — atomic txs, no partial state | No — funds remain in user's account, already theirs |
| User closes browser between step 1 and 2 | Confirmed by architecture | No — settlement doesn't depend on frontend staying open; step 2 resumable anytime, even from another wallet, since it's a public vault call |
| Gateway frontend/backend disappears permanently | Confirmed by architecture — both APIs are public and independent of gateway infra | No — a technical user can complete the flow directly against both APIs without the product |

## §D. Economics / Fee Table (Phase 2, live-verified)

Cost ≈ **~$0.02 flat** (Stellar-side withdraw fee, consistent across the 3 successful routes) **+ ~0.11%–0.15% variable** (protocol + integrator fee + solver spread).

| Amount | Swap Cost | Effective % | Annual Yield @ 6.32% | Break-even |
|---|---|---|---|---|
| $10 | $0.031 | 0.31% | $0.63 | ~18 days |
| $100 | $0.13–$0.17 | ~0.15% | $6.32 | ~8.7 days |
| $1,000 | $1.12–$1.52 | ~0.13% | $63.20 | ~7.5 days |
| $10,000 | $11–$15 (extrapolated) | ~0.13% | $632 | ~7.5 days |
| $100,000 | Unverified (extrapolated) | — | $6,320 | — |

Practical economic floor: **~$10–20** — below this the flat ~$0.02 fee dominates disproportionately; above it, relative cost stabilizes at ~0.13–0.31% with a 1–3 week break-even. $10K–$100K figures are extrapolated from real $10–$80 data; HOT Bridge's actual per-chain liquidity depth at that size is the variable most likely to invalidate the extrapolation (PRD Open Question 9 territory once the actual integrator fee rate is known).

## §E. Live Route-Test Results (Phase 2, 9 real quotes against production 1Click API)

| Source Chain | Asset | Destination | Works? | Fee | ETA | Evidence |
|---|---|---|---|---|---|---|
| Ethereum | USDC | Stellar USDC | YES | ~0.31% | 60s | quote 21abd78e, HTTP 201 |
| Arbitrum | USDC | Stellar USDC | YES | ~0.31% | 40s | quote d44c182e, HTTP 201 |
| Bitcoin | BTC | Stellar USDC | YES | ~0.34%* | 822s (~14min) | quote 735cb3ee, HTTP 201 |
| Ethereum | USDC | Stellar XLM | YES | ~0.53% | 60s | quote 4e0cdcb0, HTTP 201 |
| Base | USDC | Stellar USDC | NO | — | — | 3 attempts, "Internal server error"; also fails Base→ETH (non-Stellar) |
| Solana | USDC | Stellar USDC | NO | — | — | 2 attempts, "Internal server error"; also fails SOL→ETH (non-Stellar) |

*BTC route adds a ~$1.66 (2,092 sats) refund reserve — capital reserved and returned if no refund needed, not a fee.

Minimum amount confirmed live: a 0.05 USDC quote returned "Amount is too low for bridge, try at least 300001" → **~$0.30 real technical minimum** for the ETH→Stellar USDC route (correlation ID cf0e83ce).

Base/Solana failures confirmed structural to the origin-side quoting engine, not Stellar-specific — reproduced identically with Stellar removed entirely (Base→ETH, Solana→ETH). Cannot tell from outside whether transient or longer-term without retesting later (PRD Open Question 3).

## §F. DeFindex Technical Detail

- Assets accepted: USDC, EURC, XLM, RWA (CETES/USTRY/TESOURO).
- TVL confirmed live: **$19,470,206**. Most active vault: USDC Blend Autocompound.
- `api.defindex.io` confirmed live in production (returned `403 Forbidden — "Forbidden resource"` without an API key — proof of an active, auth-gated service, not a mock).
- `deposit()` source (github.com/defindex-io/stellar-contracts):
```
fn deposit(
    amounts_desired: Vec<i128>, amounts_min: Vec<i128>,
    from: Address, invest: bool
) -> Result<...> {
    from.require_auth();  // only auth check
    ...
}
```
A third party (router/relayer/backend) can invoke the function — the tx invoker need not be `from` — but Soroban still requires a `SorobanAuthorizationEntry` signed by `from`, expiring in 12–60 ledgers (~1–5 minutes). No ERC-20-style indefinite allowance pattern exists; this forces a time-near user signature (drives FR-8).

**Audit (OtterSec, 30-page PDF, full text extracted):**
- Critical finding OS-DIX-ADV-00 (bRate manipulation): "Fixed in e69f390."
- 3 HIGH findings (ADV-01/02/03): fix commits `385c939`, `645312f`, `5659d64`.
- Of 16 total findings, all Critical/High/Medium have a documented patch commit.
- **[BYTECODE MATCH VERIFIED for sampled contracts, 2026-09-20]** (PRD Open Question 4): whether those commits are actually included in the currently-deployed mainnet WASM was checked live via Stellar Expert's public JSON API against DeFindex's own officially-published hashes. 3 mainnet contracts (Factory once, the Blend strategy contract at two addresses) matched exactly, zero discrepancies. The top-level `defindex_vault` contract itself was not distinctly isolated and checked, so this is strong evidence, not full exhaustive verification; see PRD Open Question 4's own entry for the complete picture.

## §G. Rejected/Deferred Architecture Alternatives

- **Architecture A** (NEAR Intents settling directly into the DeFindex contract as recipient) — **BLOCKED**, confirmed live: the API rejects a Soroban contract address as `recipient`.
- **Architecture B** (proprietary Soroban smart-account router collapsing the flow to one signature) — would achieve genuinely better UX but requires building and auditing new infrastructure. Deferred, not rejected outright: only justified if PRD Open Question 1 (can Privy/DFNS solve the same onboarding friction without proprietary code?) resolves negatively, per Rule #3's requirement to prove no existing integration can solve the need first.
- **Architecture C** (intermediate DEX swap via Soroswap/Aquarius before the DeFindex deposit) — unnecessary: NEAR Intents already settles natively in USDC/XLM, and DeFindex has native vaults for both. Would be "using an integration just to claim you used one," which the project's Rule #6 explicitly forbids.

## §H. Rule #13 — Future Integration Composition Table (Phase 3)

| Integration | Official Category | Friction It Solves | Priority |
|---|---|---|---|
| Privy / DFNS | Wallet Integration | The 4-signature worst case for a brand-new-to-Stellar user (create account, trustline, origin signature, deposit) — an embedded wallet could absorb the first two without proprietary code | HIGH — investigate before ever considering Architecture B |
| Anchor Platform / Moneygram / BlindPay / Mercuryo | On/Off-Ramping | The entire audience with no crypto on any chain today | MEDIUM — expands the funnel, doesn't block MVP |
| Stellar Disbursement Platform (SDP) | Payments | Converting accrued yield into recurring outbound payments — a separate product layer | SPECULATIVE — Phase 4, not MVP |
| Soroswap / Aquarius | DeFi | Only relevant if NEAR Intents later adds an origin asset with no native DeFindex vault — doesn't exist today | CONTINGENT — do not build preemptively |

## §I. The 10 Master Rules — Audit (Phase 3)

| Rule | Requirement | Status |
|---|---|---|
| #1 | Integration List first, not "what Soroban contract do we build?" | PASS — starts from two already-listed integrations |
| #2 | Integrate > Compose > Adapt > Build | PASS — MVP is 100% composition of two production APIs |
| #3 | Soroban only if no integration solves the need | PASS — only Soroban touched is DeFindex's already-deployed, audited vault |
| #4 | Clear path to Mainnet from day 1 | PASS — both integrations live in mainnet today, confirmed via real calls |
| #5 | Real traction: users, wallets, volume, TVL | OPEN — architecture permits it; instrumenting/acquiring users is this PRD's Features §5.4/§5.5 |
| #6 | Every integration must be LEVEL 3, not decorative | PASS — both used integrations are CORE |
| #7 | Value from composition, not a new protocol | PASS — the product is literally A+B, never combined before |
| #8 | Mainnet Day-One Test | YES |
| #9 | Minimal proprietary code | PASS — thin frontend + possible serverless function; zero contracts, zero custody backend |
| #10 | Distribution + traction, not technical complexity | Philosophical guide, reflected in this PRD's §5.5/§12/§13 emphasis on distribution over engineering |

## §J. find-stellar-idea Evidence Validation (2026-08-26)

*Run retroactively against the already-drafted Zephyroute concept, using the same offline datasets `find-stellar-idea` draws on (`~/.claude/skills/data/lumenloop/projects.json` — 728 projects, `lumenloop/scf/rounds.json`, and the a16z/YC/Alliance thesis files) rather than a live web pass. Not a re-ideation — no alternative ideas were generated or proposed; this is a grounding check on the existing concept.*

**Ecosystem gap evidence (LumenLoop catalog, 728 projects):**
- `"near intents"` and `"1click"` — **0 matches**. No project in the catalog is built on this specific rail.
- `"intent"` as a search term across the whole catalog — **1 match** (Rozo, an intent-based *payments* network on Circle CCTP, not NEAR Intents; already correctly distinguished in addendum §A). Confirms nobody else on Stellar is doing intent-based settlement, let alone landing it in a yield vault.
- `"defindex"` — 3 matches (DeFindex itself, Nectar Network, Soroswap) — confirms DeFindex's ecosystem presence as a real, citable integration, not an obscure choice.
- `"hot bridge"` — 1 match (HOT Protocol, the underlying chain-signature/MPC tech) — confirms the rail itself has ecosystem visibility even though no Stellar product yet composes it with a yield destination.
- **Net read:** the offline catalog independently confirms addendum §A's core claim — nobody has fused NEAR Intents-style cross-chain settlement with a DeFindex yield deposit as one flow.

**SCF funding-pattern evidence (`scf/rounds.json`):**
- DeFindex, Rozo, BIM Exchange, and Allbridge — the closest comparables — all landed in the **"Financial Protocols"** category.
- Across 134 Financial Protocols awards in the dataset: **median $149,820, mean $171,889, range $2,500–$572,162.** This independently corroborates the PRD §2 claim of a $50k–$250k precedent band for this product shape — Zephyroute's likely award size sits well inside a well-precedented range, not a speculative outlier.
- **Discrepancy to reconcile before any SCF submission cites these figures:** this offline dataset shows Rozo's total as $150,000 (one round) and does not contain WOWMAX at all, whereas addendum §A (sourced via live research/MCP) cites Rozo at $248,000 and WOWMAX at $98,560. Likely explanation is dataset lag or a multi-tranche total not captured in this snapshot, not a fabricated figure in either source — but exact competitor award totals should be re-verified live immediately before they're used in a public SCF submission, not carried forward from either source unchecked.

**Broader thesis fit:**
- a16z's *Big Ideas 2025* includes a directly on-point item — *"Crypto companies will begin with the end (-user experience), instead of letting the infrastructure determine the UX"* — arguing the industry should "abstract away [wallet providers, intent architectures, etc.] into a holistic, full-stack, plug-and-play approach" enabled by "chain abstraction." Zephyroute is close to a literal instance of this thesis: the entire product is Stellar's account model and Soroban's auth mechanics disappearing behind a two-signature UX.
- a16z's *State of Crypto 2025* and Alliance DAO's idea list both reference intent-based architecture as a live investor thesis, not a fringe pattern — this is broader-market corroboration on top of the Stellar-specific gap evidence, satisfying `find-stellar-idea`'s "broader thesis fit" criterion.

**SCF fit assessment (per `find-stellar-idea`'s framing):** **Likely yes** — direct category precedent (4 comparable Financial Protocols awards), a confirmed, uncontested ecosystem gap, and an Integration Track mechanic (§A.3) this project is already structured around.

**Why it might still fail (single biggest risk, per the skill's own required output):** distribution, not technology — per PRD §5.5/§12, no embed partnership is currently confirmed (THORWallet, the original target, was deprioritized 2026-09-20 once it shipped its own native integration, Open Question 7), and without a distribution channel beyond the standalone app, real (non-wash) volume for the tranche #3 metric is the harder problem, not the integration itself. This risk is now, if anything, more acute than when first written, since the original candidate partner is off the table and no replacement has been identified.
