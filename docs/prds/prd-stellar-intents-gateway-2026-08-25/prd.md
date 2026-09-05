---
title: Zephyroute
created: 2026-08-25
updated: 2026-08-25
status: draft
---

# PRD: Zephyroute
*Product name confirmed 2026-08-25 (domains `zephyroute.com` and `zephyroute.app` verified available via RDAP). Internally referred to as "Stellar Intents Gateway" in prior research artifacts — same product, this is the public-facing name.*

## 0. Document Purpose

This PRD is for whoever picks up this project next — a downstream architecture doc, an SCF Integration Track application, or a future collaborator — and it builds on two prior research artifacts rather than duplicating them: **"Intents Gateway Live Test"** (live technical validation of the swap→deposit flow against real production APIs) and **"Integrate First, Build Last"** (the same idea re-scored against the project's 10 Integration-First master rules, 13 questions answered). Vocabulary is Glossary-anchored; functional requirements (FR) are grouped under features and globally numbered; inline `[ASSUMPTION]` tags mark places this draft inferred rather than confirmed, indexed in §15. Deep evidence tables (fee data, audit findings, full route-test results, competitive comparisons) live in `addendum.md` — this document carries only what's load-bearing for scope and requirements.

## 1. Vision

Stellar Intents Gateway lets someone holding stablecoins or BTC on Ethereum, Arbitrum, or Bitcoin put that capital to work earning yield on Stellar — in two signatures, without learning Stellar's account model, without a bridge the product operates itself, and without the product ever touching their funds.

It is not a new protocol. It is a composition of two things that already work in production: **NEAR Intents** (cross-chain swap settlement via solver-run, MPC-secured bridging) gets external capital into the user's own Stellar account; **DeFindex** (audited, non-custodial yield vaults routing into Blend v2) gives that capital somewhere productive to land. Nobody has fused these two specific pieces before — research turned up adjacent products (a bridge aggregator that lists NEAR Intents as one route, several products that land capital in DeFindex from other rails) but none that chain NEAR Intents' cross-chain settlement directly into a DeFindex deposit as a single flow. That gap, not a new smart contract, is the product.

The gateway's job is to be the thinnest possible layer between two already-live, already-audited systems — and to prove, with real on-chain volume, that composing existing Stellar ecosystem infrastructure can pull in external capital faster and cheaper than building anything new.

## 2. Why Now

- Both core dependencies became production-credible recently and independently: DeFindex crossed **$19.47M TVL** with an OtterSec audit whose every Critical/High/Medium finding has a confirmed patch commit; NEAR Intents' HOT Bridge solvers are confirmed live for 3 of 5 tested Stellar-bound routes (Ethereum, Arbitrum, Bitcoin → Stellar USDC/XLM) with real quotes, real fees, real ETAs.
- **The specific composition is still open.** WOWMAX aggregates NEAR Intents as one of several bridge options into Stellar but stops at the swap — no yield landing. For Yield and BIM Exchange land capital into DeFindex/Blend-style yield but arrive via Allbridge or fiat rails, not NEAR Intents. Templar Protocol uses NEAR's MPC stack on Stellar but for borrowing, not swap-and-earn. Nobody currently does NEAR-Intents-in → DeFindex-out as one flow. *[ref: addendum §A — Competitive Landscape]*
- The SCF Integration Track has a demonstrated pattern of funding exactly this product shape — aggregator/gateway products composing existing building blocks — in the **$50k–$250k** band (WOWMAX $98,560; Rozo $248,000; BIM Exchange $107,700; For Yield $144,000). This is not a track-eligibility risk; it's a well-precedented fit. *[ref: addendum §A]*
- Analogous "bridge-and-earn" patterns (Superform, Jumper/LI.FI Earn, Enso) are proving the UX works elsewhere, chain-agnostically. None specialize in landing users specifically on Stellar — leaving room for a Stellar-first framing before someone else builds it generically and includes Stellar as an afterthought.

## 3. Target User

### 3.1 Primary Persona

**The Cross-Chain Yield Seeker** — a self-custody crypto user, moderately technical (already operates a wallet, has done a cross-chain swap before), holding idle USDC or BTC on Ethereum, Arbitrum, or Bitcoin. They know Stellar has cheap, audited yield infrastructure but have no reason to learn its account/trustline model just to try it — until the two-signature version exists.

### 3.2 Jobs To Be Done

- When I hold idle stablecoins on Ethereum or Arbitrum, I want to put them to work earning yield on Stellar, without learning Stellar's account model or bridging manually first.
- When I already use a cross-chain swap wallet (e.g. THORWallet), I want a one-more-step "earn on Stellar" option instead of leaving that app to learn an entirely new one.
- When I'm already a Stellar-native user with a funded account, I want an easy way to bring in more outside capital without re-deriving the NEAR Intents flow myself.

### 3.3 Non-Users (v1)

- People with **no crypto on any chain yet** — they need a fiat on/off-ramp, which is explicitly deferred (Rule #13, MEDIUM priority — see §11).
- **Regulated/institutional capital** needing compliance guarantees this flow does not yet provide — contrast with For Yield's MiCA-regulated approach, which this product is not attempting to replicate in v1.
- Anyone wanting **yield strategy choice beyond DeFindex's existing vault menu** — the gateway does not build or curate its own strategies.

### 3.4 Key User Journeys

- **UJ-1. Priya swaps Arbitrum USDC into Stellar yield from inside THORWallet.**
  - **Persona + context:** Returning Stellar user (has a G-account + USDC trustline already), currently inside THORWallet holding USDC on Arbitrum.
  - **Entry state:** Authenticated in THORWallet; the gateway is embedded as a "Earn on Stellar" corridor.
  - **Path:** Requests a quote → signs the origin-chain swap → waits ~40s for HOT Bridge settlement → gateway detects funds landed in her Stellar account → prompts the DeFindex `deposit()` → she signs within the ~1–5 min authorization window.
  - **Climax:** Her dfToken balance updates, confirming the capital is now earning yield on Stellar.
  - **Resolution:** Position visible in-app; volume recorded against the gateway's integrator ID (realizes FR-2, FR-10).
  - **Edge case:** If she misses the signature window, the gateway rebuilds a fresh unsigned deposit XDR — the cross-chain swap step is never repeated (realizes FR-8).

- **UJ-2. Marcus, brand-new to Stellar, onboards from Ethereum via the standalone web app.**
  - **Persona + context:** Holds USDC on Ethereum; has never touched Stellar.
  - **Entry state:** Unauthenticated, no Stellar presence at all.
  - **Path:** Opens the gateway web app → connects his EVM wallet → requests a quote to Stellar USDC → **[ASSUMPTION, Open Question 1]** an embedded wallet (Privy/DFNS) auto-creates, funds, and establishes a trustline on a new Stellar account in-flow; if that capability isn't confirmed by launch, he instead follows a short manual pre-step to fund a minimal account first → signs the origin swap → signs the DeFindex deposit once funds land.
  - **Climax:** His first-ever Stellar address is funded and earning yield without him ever reading about reserves or trustlines directly.
  - **Resolution:** Counted as a newly-funded unique address (realizes SM-3).
  - **Edge case:** If onboarding-in-flow isn't ready at launch, this journey degrades to a documented manual step rather than blocking entirely (realizes FR-6's fallback).

- **UJ-3. A user closes the browser mid-flow and returns three days later.**
  - **Persona + context:** Any user; the origin-chain swap settled but the DeFindex deposit was never signed.
  - **Entry state:** Funds already sitting in their own Stellar account — never at risk, since the gateway never held them.
  - **Path:** Returns later, from any device or wallet, connects the same Stellar address; the gateway detects the undeposited balance and resumes directly at the deposit step.
  - **Climax:** Completes the deposit days later with zero funds ever having left their exclusive control.
  - **Resolution:** Counted normally, just later (realizes FR-9's resumability property).

## 4. Glossary

- **NEAR Intents** — Intent-based cross-chain settlement network. The gateway's acquisition engine: it swaps a user's asset on an origin chain into an asset the user receives directly in their own Stellar account.
- **1Click API** — NEAR Intents' quote/settlement REST API (`1click.chaindefuser.com/v0/quote`), the concrete integration point the gateway calls.
- **HOT Bridge** — The MPC-secured solver network that executes NEAR Intents settlements; confirmed live for Ethereum, Arbitrum, and Bitcoin → Stellar routes.
- **Solver** — A market maker matched by NEAR Intents to fulfill a swap; holds funds only transitorily during matching, never custodies on the gateway's behalf.
- **Integrator ID** — An identifier the gateway attaches to every 1Click quote, enabling per-partner attribution of volume and (optionally) an integrator fee. Load-bearing for both SM-1/SM-2 and monetization (§9).
- **Stellar G-account** — A user's own Stellar account (address starting with `G`), which receives settled funds directly; the gateway never controls its key.
- **Trustline** — A Stellar account's explicit opt-in to hold a given non-native asset (e.g. USDC); must exist before that account can receive the asset.
- **DeFindex** — Non-custodial, audited Soroban vault infrastructure. The gateway's yield engine: receives the user's deposit and routes it (autocompounding) into underlying strategies.
- **dfToken** — The share token DeFindex mints to a depositor, representing their position in a vault.
- **Blend v2** — The lending protocol DeFindex's default vaults route into; one layer beneath the gateway's direct integrations, not integrated directly by the gateway itself.
- **SorobanAuthorizationEntry** — The signed, time-bound authorization Soroban requires for a `deposit()` call; expires in 12–60 ledgers (~1–5 minutes), with no ERC-20-style indefinite allowance.
- **Architecture A′** — The MVP architecture this PRD scopes: NEAR Intents → user's Stellar account → DeFindex vault, zero proprietary Soroban contracts.
- **Architecture B** — A rejected/deferred alternative: a proprietary Soroban smart-account contract that would collapse the flow to one signature. Only justified if Open Question 1 resolves negatively (§14).
- **SCF Integration Track** — The Stellar Community Fund's funding track for products that compose existing ecosystem integrations rather than build new protocols; pays its largest tranche (40%) against a panel-ratified on-chain metric, not mere mainnet launch.
- **Tranche #3** — That final, metric-gated SCF Integration Track payment; this PRD's Success Metrics (§8) are written to be usable as that metric.

## 5. Features

### 5.1 Cross-Chain Acquisition (NEAR Intents)

**Description:** The entry point of the flow. The user picks an origin chain/asset they hold and a Stellar destination asset (USDC or XLM); the gateway requests a live quote from 1Click, shows cost/ETA, and — once the user confirms — executes a real settlement that lands funds in the user's own Stellar account. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-1: Request and display a live cross-chain quote

User can request a quote to swap a supported origin-chain asset (Ethereum USDC, Arbitrum USDC, Bitcoin BTC at MVP) into Stellar USDC or XLM.

**Consequences (testable):**
- Quote request always calls the production 1Click endpoint with `dry:false` for real execution (not the `dry:true` mode used during research).
- Displayed quote includes fee, ETA, `slippageTolerance`, `minAmountOut`, and refund fields (`refundTo`, `refundType`, `refundFee`) verbatim from the API response — nothing paraphrased or estimated by the gateway.
- A quote for an unsupported/currently-down route (Base, Solana at MVP) is rejected before the user is asked to sign anything.

#### FR-2: Attribute every quote to the gateway's integrator ID

System attaches a registered integrator ID to every 1Click request.

**Consequences (testable):**
- 100% of quotes carry the integrator ID field; none are sent anonymously.
- Integrator-attributed volume is queryable independent of the gateway's own database (i.e. reconstructable from 1Click's own records), satisfying the audit-trail NFR in §8.

#### FR-3: Validate destination trustline before quoting

System checks whether the destination Stellar address already holds a trustline for the destination asset before submitting the quote.

**Consequences (testable):**
- If no trustline exists, the user is routed into the onboarding path (FR-6) rather than receiving an API rejection mid-flow.
- **[ASSUMPTION — Open Question 2]**: This FR assumes destination trustline is confirmed to remain a hard precondition for settlement; if further testing (Open Question 2) shows HOT Bridge can fund and establish a brand-new account directly, this check becomes advisory rather than blocking.

#### FR-4: Execute settlement and detect arrival

User can execute the real (non-dry) swap; system polls or listens for settlement and confirms once funds are visible in the user's Stellar account via Horizon.

**Consequences (testable):**
- System shows live status (quoted → submitted → settled) rather than a static "processing" spinner.
- Detection is based on the user's actual Stellar account balance, not solely on 1Click's own status field, so a discrepancy is visible rather than silently trusted.

### 5.2 Wallet & Signing Layer

**Description:** Handles connecting an existing Stellar wallet for returning users, and — pending Open Question 1 — onboarding brand-new users via an embedded wallet. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-5: Connect an existing Stellar wallet

User can connect a Stellar Wallets Kit-supported wallet (Freighter and others) to receive settlement funds and later sign the DeFindex deposit.

**Consequences (testable):**
- Gateway never requests or stores a private key or seed phrase at any point.
- Connected wallet's public address is the sole identifier used for balance detection (FR-4) and deposit signing (FR-8).

#### FR-6: Onboard a brand-new-to-Stellar user

**[ASSUMPTION — Open Question 1, unconfirmed]** New user can have a funded account + trustline created via an embedded wallet provider (Privy or DFNS) without ever leaving the flow or the gateway holding custody.

**Consequences (testable):**
- If confirmed feasible: account creation, funding of the ~0.5 XLM base reserve, and trustline establishment happen without a separate manual step, and the embedded wallet's key material is controlled by the provider under the user's own auth (biometric/email/social), never by the gateway.
- If not confirmed by launch: this FR's scope degrades to a documented manual "fund your account first" fallback (see §7 Out of Scope), and UJ-2 is updated accordingly.

**Out of Scope:**
- Gateway-operated custody of the embedded wallet's keys, under any resolution of this FR.

### 5.3 Yield Deposit (DeFindex)

**Description:** Once funds have landed in the user's own Stellar account, the gateway builds the deposit transaction against a DeFindex vault and gets the user's signature within Soroban's short authorization window. Realizes UJ-1, UJ-2, UJ-3.

**Functional Requirements:**

#### FR-7: Build an unsigned deposit transaction

System builds an unsigned `deposit()` XDR against the user-selected DeFindex vault (default: USDC Blend Autocompound) via DeFindex's SDK/API.

**Consequences (testable):**
- Built transaction always sets `invest: true` by default so deposited funds route into the underlying yield strategy in the same or immediately following operation, unless the user explicitly opts out.
- `amounts_min` is populated with a real slippage-protected value, never left at zero.

#### FR-8: Sign and submit within the authorization window

User signs and submits the deposit within the ~1–5 minute (12–60 ledger) Soroban authorization window; system surfaces the remaining time and gracefully rebuilds a fresh XDR if the window lapses.

**Consequences (testable):**
- A visible countdown is shown once the unsigned XDR is presented for signature.
- On expiry, system automatically rebuilds a new unsigned XDR without re-running the cross-chain swap step (FR-1–FR-4 are not repeated).

#### FR-9: Confirm and resume deposit state

System confirms deposit success by reading back the user's dfToken balance / vault position, and can resume an incomplete flow (settled-but-not-deposited) at any later time, from any device.

**Consequences (testable):**
- A user who left funds undeposited can reconnect the same Stellar address later and be routed directly to FR-7/FR-8, skipping FR-1–FR-4 entirely.
- Vault position display matches what an independent Horizon/RPC query for that address would show — no cached-only state.

### 5.4 Traction Instrumentation

**Description:** Realizes Rule #5/#12 and directly produces the evidence the SCF Integration Track's tranche #3 requires. Not optional polish — it is the mechanism by which this project proves it did what it says it does. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-10: Record attributable flow data

For every completed flow, system records settled volume, origin chain/asset, destination vault, the user's Stellar address, and timestamp, tied to the gateway's integrator ID.

**Consequences (testable):**
- Every record is reconstructable independently from public sources (1Click's integrator-attributed records + Horizon + DeFindex vault state) — the gateway's own database is a convenience cache, not the source of truth.
- No personally identifying data is captured in this record (see §9 Privacy).

#### FR-11: Expose cumulative traction metrics

System exposes a view of cumulative attributable volume, net-new TVL, unique funded addresses, and recurrence rate.

**Consequences (testable):**
- Figures in this view are the same figures reported in any SCF tranche submission — no separate "marketing" number is maintained.

### 5.5 Distribution Surface

**Description:** Because Architecture A′ deliberately has almost no proprietary backend, the main lever the team controls is distribution. Realizes UJ-1.

**Functional Requirements:**

#### FR-12: Ship as an embeddable widget

**[ASSUMPTION — Open Question 7, unconfirmed partnership]** Gateway is packaged as an embeddable widget/SDK component, not only a standalone site, so a partner wallet (e.g. THORWallet) can integrate it as a swap corridor without building their own DeFindex integration.

**Consequences (testable):**
- Widget build is decoupled from any specific partner's approval — it ships as part of v1 regardless of whether a THORWallet partnership is confirmed by launch (see §7).

#### FR-13: Standalone web app as reference implementation

Gateway also ships as a standalone web app, serving as both the v1 launch surface (given the aggressive weeks-scale timeline and unconfirmed partner integration lead time) and the reference implementation the widget is built from.

**Consequences (testable):**
- 100% of FR-1–FR-11 functionality is reachable from the standalone app without requiring any partner integration.

## 6. Non-Goals (Explicit)

- No proprietary Soroban contracts in v1 (Architecture A′ only; Architecture B stays deferred pending Open Question 1).
- No custody of user funds or keys, at any layer, under any circumstance.
- No fiat on/off-ramp in v1 (Rule #13 MEDIUM priority — deferred, not core).
- No proprietary yield strategy logic — the gateway only ever offers DeFindex's existing vault menu, never its own strategy.
- No mobile-native app in v1 — web-first, with the embeddable widget (FR-12) covering wallet-embedded reach instead of a separate app.
- No identity/KYC collection performed by the gateway itself in v1 — any such obligation is inherited from 1Click's Terms of Service between the end user and NEAR Intents, and is a legal open item (§14, Open Question 5), not something this architecture builds infrastructure around.

## 7. MVP Scope

### 7.1 In Scope

- Origin routes: Ethereum, Arbitrum, Bitcoin → Stellar USDC or XLM (the 3 confirmed-live routes).
- Default destination: DeFindex USDC Blend Autocompound vault; EURC/XLM vaults included if trivial to add on top of the same SDK call.
- Returning-Stellar-user flow (FR-5, FR-7–FR-9) at full confidence.
- New-to-Stellar user flow (FR-6) at whatever confidence Open Question 1 resolves to by launch — embedded-wallet path if confirmed, documented manual pre-step if not.
- Traction instrumentation (FR-10, FR-11) live from the first transaction, not retrofitted later.
- Integrator-fee monetization (§9) enabled by default.
- Standalone web app (FR-13) as the v1 launch surface.

### 7.2 Out of Scope for MVP

- Base and Solana origin routes — blocked upstream at 1Click, not a gateway limitation; revisit per Open Question 3's retest.
- Formal THORWallet (or any other) distribution partnership — pursued in parallel, not a launch blocker; the widget (FR-12) ships regardless so integration can happen whenever a partner is ready. `[NOTE FOR PM]` — this is the single highest-leverage lever for real traction; revisit urgently once v1 is live.
- Fiat on/off-ramp integrations (Anchor Platform, Moneygram, BlindPay, Mercuryo) — Rule #13 MEDIUM priority, deferred to a post-MVP phase.
- Stellar Disbursement Platform-based recurring payments from accrued yield — Rule #13 SPECULATIVE priority (Phase 4 idea), not MVP.
- Architecture B (proprietary smart account) — only revisited if Open Question 1 resolves negatively.
- DeFindex revenue-share negotiation — upside pursued once volume is provable (v1.1+), not a v1 dependency.

## 8. Monetization

v1's revenue model is NEAR Intents' native, anonymous **integrator fee**, attached automatically to every quote via the gateway's integrator ID (FR-2) — zero additional user friction beyond what the flow already requires, zero proprietary billing code, consistent with Rule #9 (minimum proprietary code). The fee is embedded in the quoted price the user already sees before confirming (per the Phase 2 economics table), not itemized as a separate charge.

`[ASSUMPTION]` Exact fee rate is not yet known — it's set by whatever NEAR Intents' partner program grants upon integrator-ID registration, tracked as Open Question 9. DeFindex revenue-share (§7.2) is explicitly a v1.1+ upside, not a v1 dependency.

## 9. Success Metrics

*Written to double as the on-chain metric the SCF Integration Track panel would ratify for tranche #3 release — not a separate "internal" set of numbers.*

**Primary**
- **SM-1**: Cumulative settled volume attributable to the gateway's integrator ID. Target TBD jointly with the SCF panel (Open Question 8). Validates FR-1, FR-2, FR-4, FR-10.
- **SM-2**: Net-new TVL attributable to gateway-originated deposits across DeFindex vaults. Validates FR-7, FR-8, FR-9, FR-10.

**Secondary**
- **SM-3**: Unique Stellar addresses funded for the first time through the gateway. Validates FR-3, FR-4, FR-6.
- **SM-4**: 7/30-day recurrence rate — share of addresses that deposit again after their first flow. Validates FR-10, FR-11.

**Counter-metrics (do not optimize)**
- **SM-C1**: Abandonment rate between quote and settled deposit. A rising rate is a UX/upstream signal to fix (e.g. signature-window friction), never something to mask by hiding failure states or pressuring users past an expired window. Counterbalances SM-1, SM-2.
- **SM-C2**: Share of volume from wash or self-generated activity — must stay at effectively 0%. The SCF panel explicitly disregards gamed activity when ratifying tranche #3; optimizing SM-1 this way would be worse than not optimizing it at all. Counterbalances SM-1.

## 10. Cross-Cutting NFRs

- **Non-custodial by construction**: the gateway process must never hold a private key or any unilateral transfer capability at any layer — this is an architectural invariant, not a policy choice, and is what makes the custody/regulatory analysis in `addendum.md` §B hold.
- **Upstream availability transparency**: both dependencies (1Click, DeFindex) must have visible status surfaced to the user when a route or vault is degraded (e.g. Base/Solana today), rather than a silent or generic failure.
- **Signature-window UX**: the ~1–5 minute Soroban authorization window (FR-8) must never produce an opaque error on expiry — the system re-quotes/rebuilds gracefully every time.
- **Independent auditability**: every completed (or partially completed) flow must be reconstructable from public on-chain data alone (Horizon, 1Click's own integrator records, DeFindex vault state) — confirmed as an architectural property in Phase 2's failure-mode analysis, and a requirement this PRD keeps intact rather than something a future refactor could quietly break.

## 11. Constraints and Guardrails

**Safety**
- Every transaction is presented for explicit user signature; the system never submits a Soroban authorization entry on the user's behalf.
- Amounts below the practical economic floor (~$10, where the flat ~$0.02 fee starts dominating relative cost) are flagged with a cost warning rather than blocked outright — the technical minimum is ~$0.30 and the product should stay usable at small sizes, just honest about the economics.

**Privacy**
- Gateway collects the minimum data necessary for traction instrumentation (public on-chain addresses, volumes, timestamps) — no personal identity data collection of its own.
- Any KYC/AML obligation inherited from 1Click's Terms of Service applies between the end user and NEAR Intents; this remains a legal open item (§14, Open Question 5) and is explicitly not something v1's architecture is built to route around.

**Cost**
- v1 infrastructure cost stays near-zero by design: no funds database, no custody ledger. The only recurring cost is hosting a stateless frontend and, at most, a stateless serverless function for one API credential — directly enforcing Rule #9 (minimum proprietary code).

## 12. Integration and Dependencies

- **NEAR Intents / 1Click API** (external, production, no SLA held by the gateway) — critical path for FR-1–FR-4. Base and Solana origins are currently down upstream; outside the gateway's control (Open Question 3).
- **DeFindex API/SDK** (external, production, auth-gated) — critical path for FR-7–FR-9. The 12–60 ledger authorization window is a hard upstream constraint the UX must design around, not something the gateway can extend.
- **Wallet layer**: Stellar Wallets Kit / Freighter for returning users (FR-5, high confidence); Privy or DFNS for new-user onboarding (FR-6, capability unconfirmed — Open Question 1).
- **Distribution**: THORWallet as a candidate embed partner (FR-12, unconfirmed — Open Question 7); DeFindex/PaltaLabs as a candidate revenue-share partner (§7.2, v1.1+ upside, not a dependency).
- **SCF Integration Track**: funding/credibility channel; the exact tranche #3 metric and target window is to be negotiated with the panel (Open Question 8), directly shaping SM-1/SM-2's targets.

## 13. Risk and Mitigations

| Risk | Mitigation |
|---|---|
| Base/Solana origin routes stay down beyond a few weeks | Launch v1 scoped to the 3 confirmed routes only; retest per Open Question 3 and expand later — do not block launch on this. |
| Privy/DFNS cannot actually auto-create + fund + trustline a new Stellar account (Open Question 1 resolves negatively) | Architecture B becomes a live, Rule #3-justified question rather than an assumption; until then, FR-6 falls back to a documented manual pre-step for brand-new users. |
| 1Click ToS KYC/AML obligation on the "Developer" creates legal exposure if unaddressed | Legal review completed before any SCF submission claims the flow is "KYC-free" (Open Question 5) — this is a hard gate on go-to-market claims, not just documentation hygiene. |
| Solver takes origin funds but fails to settle at destination (structural risk of the intents model) | Mitigated structurally by NEAR's Verifier contract and the confirmed-live refund mechanism (`refundTo`/`refundType`/`refundFee` present on every real quote); this residual risk is inherited and disclosed, not eliminable by the gateway. |
| DeFindex's deployed mainnet WASM doesn't match the audited/patched commits | Verify bytecode hash against the OtterSec-confirmed patch commits before/at launch (Open Question 4) — cheap, non-blocking, but must happen before any "audited" claim is made publicly. |
| Zephyroute has no Soroban contract, issuing account, or app-operated wallet of its own to register as an "on-chain footprint" at SCF award time — the mechanism the Integration Track uses to attribute tranche #3 activity assumes a footprint that a zero-custody, zero-proprietary-contract architecture doesn't naturally produce | The address-correlation layer already identified in `architecture.md`'s Integration Coupling Map is the closest candidate footprint (the integrator-ID-tagged Stellar addresses 1Click settles to); confirm directly with the SCF panel whether this is an acceptable substitute before final submission (Open Question 11). |

## 14. Open Questions

1. Can Privy or DFNS create + fund + establish a trustline on a brand-new Stellar account without the gateway holding custody? Blocks FR-6; determines whether Architecture B is ever justified under Rule #3.
2. Does settlement strictly require the destination Stellar account to already hold a trustline, or can HOT Bridge fund a brand-new, unfunded account directly? Blocks FR-3 and FR-6's exact shape.
3. Will Base and Solana origin routes recover, and on what timeline? If down beyond ~1-2 weeks, treat as structural per Phase 2's plan.
4. What is DeFindex's exact fee schedule, and does the deployed mainnet WASM match the OtterSec-audited, patched commits?
5. Is the flow legally clear of KYC/AML exposure inherited from 1Click's ToS? If not, what geofencing or screening is required before any SCF submission or public launch claim?
6. Has a real funded (non-dry) end-to-end swap + deposit been executed yet, confirming the full mechanism works with real money, not just quotes?
7. Is THORWallet's routing already able to add Stellar as a destination, and are they open to embedding this gateway (FR-12) as a corridor?
8. What exact on-chain metric (NAV target vs. cumulative volume, over what window) will the SCF panel ratify for tranche #3 release? Directly shapes SM-1/SM-2 targets.
9. What is the gateway's actual integrator fee rate once registered with NEAR Intents, and how does it move the Phase 2 economics-table break-even points?
10. What threat model and monitoring plan will accompany the tranche #2 submission? The SCF Build panel requires both as a tranche #2 condition (verified live against the SCF Handbook), and neither has been drafted yet — the failure-mode table in `addendum.md` §C is the raw material but isn't yet reframed as a threat model.
11. What on-chain footprint will Zephyroute register at SCF award time given it holds no Soroban contract, issuing account, or app-operated wallet of its own? Is the integrator-ID-tagged address correlation layer (Integration Coupling Map, `architecture.md`) an acceptable substitute in the panel's eyes? Directly affects whether SM-1/SM-2 are attributable the way the Integration Track's tranche #3 mechanic expects.
12. Does the user's Stellar account, whether pre-existing for UJ-1 or newly created via Privy/DFNS for UJ-2, reliably hold enough XLM to cover the DeFindex deposit transaction's network fee at the moment of the second signature? Surfaced during UX design (`ux-design-specification.md`, Core User Experience, Experience Mechanics) as a plausible late, cryptic failure for a first-time user with no prior concept of a separate fee asset. Directly affects FR-6's new-user path and whether the account-creation step (Open Question 1) needs to pre-fund a fee reserve, not just the minimum account balance.

## 15. Assumptions Index

- §3.4 (UJ-2) / §5.2 (FR-6): Brand-new-to-Stellar users can be onboarded via Privy/DFNS embedded wallets without gateway custody — unconfirmed, tracked as Open Question 1.
- §5.1 (FR-3): Destination trustline is assumed to remain a hard precondition for settlement rather than something HOT Bridge can resolve on a brand-new account — unconfirmed, tracked as Open Question 2.
- §5.5 (FR-12): THORWallet is assumed to be a willing, technically-ready distribution partner — unconfirmed, tracked as Open Question 7.
- §8: Integrator fee is assumed enabled by default at whatever rate NEAR Intents' partner program grants — exact rate unconfirmed, tracked as Open Question 9.
- §11 (Privacy): No proprietary KYC/identity collection is assumed necessary in v1, pending legal confirmation per Open Question 5.
