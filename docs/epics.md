---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - docs/prds/prd-stellar-intents-gateway-2026-08-25/prd.md
  - docs/prds/prd-stellar-intents-gateway-2026-08-25/addendum.md
  - docs/ux-design-specification.md
  - docs/architecture.md
project_name: 'zephyroute'
user_name: 'JafetCHVDev'
date: '2026-09-13'
status: 'complete'
completedAt: '2026-09-13'
---

# Zephyroute - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Zephyroute, decomposing the requirements from the PRD, UX Design Specification, and Architecture Decision Document into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Request and display a live cross-chain quote (fee, ETA, slippageTolerance, minAmountOut, refund fields verbatim; unsupported/down routes rejected before signing).
FR2: Attribute every quote to the gateway's integrator ID (100% of quotes; independently queryable from 1Click's own records).
FR3: Validate destination trustline before quoting (routes to onboarding path FR6 if missing; runs before the quote request, not after).
FR4: Execute settlement and detect arrival (live status quoted to submitted to settled; detection based on the user's actual Horizon balance, not 1Click's status field alone).
FR5: Connect an existing Stellar wallet (Stellar Wallets Kit / Freighter; never requests or stores a private key or seed phrase).
FR6: Onboard a brand-new-to-Stellar user (embedded wallet via DFNS, confirmed live, Open Question 1 resolved 2026-09-20; documented manual fallback for edge cases).
FR7: Build an unsigned deposit transaction (default USDC Blend Autocompound vault; `invest: true` by default; `amounts_min` always a real slippage-protected value).
FR8: Sign and submit within the authorization window (visible countdown; automatic graceful XDR rebuild on expiry without repeating FR1-FR4).
FR9: Confirm and resume deposit state (reads back dfToken balance; resumable from any device, any later time, skipping FR1-FR4 on resume).
FR10: Record attributable flow data (settled volume, origin chain/asset, destination vault, address, timestamp; reconstructable independently from public sources; no PII).
FR11: Expose cumulative traction metrics (attributable volume, net-new TVL, unique funded addresses, recurrence rate; same figures used in any SCF submission).
FR12: Ship as an embeddable widget (decoupled from partner confirmation; ships in v1 regardless of whether any specific embed partnership is confirmed).
FR13: Standalone web app as reference implementation (100% of FR1-FR11 reachable without any partner integration).

### NonFunctional Requirements

NFR1: Non-custodial by construction, the gateway process never holds a private key or unilateral transfer capability at any layer.
NFR2: Upstream availability transparency, 1Click and DeFindex degradation is always surfaced visibly, never silent or generic.
NFR3: Signature-window UX, the Soroban authorization window never produces an opaque error on expiry, the system re-quotes/rebuilds gracefully every time.
NFR4: Independent auditability, every completed or partially completed flow is reconstructable from public on-chain/API data alone (Horizon, 1Click integrator records, DeFindex vault state).
NFR5: Every transaction is presented for explicit user signature, the system never submits a Soroban authorization entry on the user's behalf.
NFR6: Amounts below the practical economic floor (~$10) are flagged with a cost warning rather than blocked outright.
NFR7: Minimum data collection, only public on-chain addresses, volumes, and timestamps; no personal identity data collected by the gateway itself.
NFR8: v1 infrastructure cost stays near-zero by design, no funds database, no custody ledger, at most one stateless serverless function per API credential.

### Additional Requirements

- Starter template: Next.js 16 (App Router) + Vercel. Command: `npx create-next-app@latest zephyroute --typescript --app --no-tailwind --src-dir --import-alias "@/*"`. This is Epic 1 Story 1.
- Correlation-layer persistence: Upstash Redis, shared for the correlation record and `@upstash/ratelimit` rate limiting; explicit fallback to querying Horizon/DeFindex directly if Redis is unavailable, never a hard dependency.
- Correlation-layer read authorization: a concrete signed-nonce protocol (wallet signs `zephyroute:correlation-read:{unixTimestamp}`, sent as `x-nonce-signature: {timestamp}.{signature}`, verified server-side within a 60-second window), no nonce-issuing endpoint or server-side nonce storage needed.
- AC #4 (review before signing) enforced at the TypeScript type level via a branded `ValidatedTransactionXDR` type that only the validation layer can produce; the wallet-signing function accepts only that type.
- State management: TanStack Query v5, no global client-state library; two distinct shared union types in `lib/types.ts`, `FlowStage` (`'quoted' | 'submitted' | 'settled' | 'depositing' | 'earning'`) and `DepositTransactionStatus` (`'submitted' | 'confirming on-chain' | 'completed' | 'failed' | 'expired' | 'reverted'`), matching the UX spec's exact literals verbatim.
- CI/CD: GitHub Actions enforcing hard, merge-blocking gates: contrast/ARIA linting, TypeScript strict-mode compilation, and the AC #7 transaction-building test suite, all required before merge, independent of and prior to Vercel's own deploy.
- Secrets: 1Click and DeFindex API keys live in Vercel environment variables only, scoped separately per environment, never committed to the repo.
- Monitoring: an interim lightweight uptime/error-tracking tool wired in from day one; the full threat model and monitoring plan (PRD Open Question 10) remains a separate, later deliverable required before SCF tranche #2.
- Project structure: `components/ui/` (headless-primitive skins) vs. `components/features/` (4 bespoke components) split; all cross-cutting code under `lib/`; API routes limited to `app/api/correlation/[address]/route.ts`; tests co-located as `*.test.ts`, no separate test tree, no `prisma/` directory (no relational database).
- Iframe-embedded widget (`/embed` route): requires explicit CSP (`frame-ancestors`) configuration on Zephyroute's side and, once an embed partnership is confirmed, verification that the partner's own CSP permits framing the Zephyroute origin and that the origin is added to the WalletConnect project's allowed-origins list, or wallet connection fails.
- FR-3's trustline pre-check is implemented in `lib/horizon.ts`, called from the entry page before the quote request fires, and its result drives the UJ-1/UJ-2 fork.
- No proprietary Soroban contract in v1 (Architecture A' only, per Rule #3 and CLAUDE.md AC #8).

### UX Design Requirements

UX-DR1: Implement the Signal Cyan dark design system as CSS custom properties (background `#0E1116`, surface `#171B22`, accent `#3FD6D0`/`#04211F` ink, warning `#E8A33D`, error-ui `#E5484D`, error-text `#FF7A80`), no Tailwind, token-first over headless primitives.
UX-DR2: Implement the three-typeface system with explicit fallback stacks: Fraunces (display/headings, falls back to Georgia/serif), Public Sans (body/UI, falls back to system-ui), IBM Plex Mono (all numeric/verbatim data, falls back to ui-monospace).
UX-DR3: Build the Trust Badge component (static, non-dismissible, one mechanism-backed sentence, no color-only signaling).
UX-DR4: Build the Custody Fund-Flow Diagram component (progressive disclosure inside "See full quote," accessible text-equivalent description that also serves as the rendering fallback).
UX-DR5: Build the Timestamped Step Tracker component as the persistent Guided Status rail (states: upcoming, active with reduced-motion-aware pulse, done with on-demand timestamp, failed with accessible error color; `aria-current` on the active step).
UX-DR6: Build the Signature-Window Countdown component (tabular-mono mm:ss, server-time-synced not client-clock-dependent, `aria-live` polite announcement on automatic rebuild, reduced-motion aware).
UX-DR7: Implement the Guided Status screen composition: persistent rail plus a two-depth plain-language quote line (full sentence for new users, compressed numbers-first for returning users, keyed off the same trustline-fork signal), a secondary fee row, and the "See full quote" progressive disclosure.
UX-DR8: Implement the UX Consistency Patterns: button hierarchy (primary/secondary/tertiary), feedback patterns attached inline to their element (never a generic toast stack), no scattered boolean `isLoading` flags (TanStack Query status only), no modal dialogs except a genuinely destructive/irreversible confirmation (none exists in this product).
UX-DR9: Implement the responsive strategy: a single narrow content column (480 to 560px max width) at every viewport size, mobile-first, no breakpoint ever triggers a structural layout change.
UX-DR10: Implement accessibility as CI-blocking gates, not advisory: WCAG 2.1 AA contrast minimum (AAA specifically for error/warning text), 44x44px minimum touch targets, full keyboard-only completability of the critical path, and `prefers-reduced-motion` support on every animated indicator.
UX-DR11: Implement all three user journey flows exactly as mapped (UJ-1 partner embed with the compressed status line, UJ-2 standalone onboarding with the full status line and the trustline-driven fork, UJ-3 cross-device/cross-session resumability that skips directly to the deposit step), including the settlement-failure/refund branch and the signature-window-expiry rebuild in every journey.

### FR Coverage Map

FR1: Epic 1, live cross-chain quote request and display.
FR2: Epic 1, integrator ID attribution on every quote.
FR3: Epic 1, trustline check that also decides whether Epic 2 is needed for this user.
FR4: Epic 1, settlement execution and arrival detection.
FR5: Epic 1, connect an existing Stellar wallet.
FR6: Epic 2, brand-new-user onboarding.
FR7: Epic 1, unsigned deposit transaction build.
FR8: Epic 1, sign and submit within the authorization window.
FR9: Epic 1, confirm and resume deposit state, including cross-device resumability.
FR10: Epic 3, record attributable flow data.
FR11: Epic 3, expose cumulative traction metrics.
FR12: Epic 4, embeddable widget.
FR13: Epic 1, standalone web app as the reference implementation.

NFRs, Additional Requirements, and UX Design Requirements are not separate epics, per the "organize by user value, not technical layers" principle. Each is woven into the epic that first touches its relevant surface: Epic 1 (foundational) carries the starter template, the design token and typography system, all 4 bespoke components, CI/CD gates, `ValidatedTransactionXDR`, and NFR1-NFR8 from day one. The signed-nonce read-authorization protocol is exercised end-to-end inside Epic 1 itself (Story 1.12, where a user proves ownership of their own address to resume a session), not deferred to Epic 3, whose FR11 metrics view is a project-team-facing aggregate, not a per-address lookup. Epic 4 is where the CSP/WalletConnect configuration from the Architecture Step 3 finding lives.

## Epic List

### Epic 1: Returning User Signs In and Starts Earning Yield

A returning Stellar user connects an already-funded wallet, gets a live cross-chain quote, executes the swap, and signs the DeFindex deposit, ending up earning yield on Stellar, resumable from any device if they step away mid-flow.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR7, FR8, FR9, FR13.

**Story sequence guidance for Step 3:** foundation first (starter init, design tokens, CI/CD gates), then wallet connection (a precondition for the trustline check that follows), then cross-chain acquisition (quote, integrator attribution, trustline check, settlement), then the deposit flow (build, sign, confirm), then resumability last, since it depends on the deposit flow already existing to have something to resume.

### Epic 1 Stories

#### Story 1.1: Project Scaffolding with the Chosen Starter

As a developer,
I want the Zephyroute repository initialized from the approved Next.js starter with the exact architectural conventions locked in,
So that every subsequent story builds on a consistent, correctly-configured foundation instead of re-deciding basics.

**Acceptance Criteria:**

**Given** a clean project-root directory
**When** the starter is initialized with `npx create-next-app@latest zephyroute --typescript --app --no-tailwind --src-dir --import-alias "@/*"`
**Then** the project uses TypeScript in strict mode (AC #6), the App Router, and no Tailwind dependency
**And** the directory structure matches Project Structure & Boundaries exactly: `src/app/`, `src/components/ui/`, `src/components/features/`, `src/lib/` (including `src/lib/hooks/`), with no `prisma/` directory and no root `tests/` directory
**And** a `.env.example` file is committed listing the required environment variable names (1Click and DeFindex API keys) with no real values, and `.env.local` is git-ignored
**And** `src/middleware.ts` sets a `script-src` CSP directive restricting script execution to Zephyroute's own bundled code, no inline scripts, no third-party script origins beyond what is strictly needed (Threat Model, Tampering)

#### Story 1.2: Design Token and Typography Foundation

As a returning user,
I want the interface to render in Zephyroute's locked visual system from the first screen,
So that the product feels calm and trustworthy, consistent with the UX design already established.

**Acceptance Criteria:**

**Given** the project scaffolding from Story 1.1 exists
**When** `globals.css` is implemented
**Then** it defines the Signal Cyan dark palette as CSS custom properties (background `#0E1116`, surface `#171B22`, accent `#3FD6D0`/`#04211F` ink, warning `#E8A33D`, error-ui `#E5484D`, error-text `#FF7A80`), with no hardcoded, non-token color value anywhere in the codebase (UX-DR1)
**And** it loads Fraunces, Public Sans, and IBM Plex Mono with the exact fallback stacks already specified (Georgia/serif, system-ui, ui-monospace respectively) (UX-DR2)
**And** an automated lint rule or CI check flags any raw color or spacing value that bypasses the token system, per the token-discipline hard gate

**Given** the token foundation exists
**When** the base UI primitives in `components/ui/` are styled
**Then** button hierarchy (primary filled, secondary underlined-accent, tertiary muted-text), feedback-pattern colors (success reuses the accent, error/warning use their dedicated colors, always paired with a label or icon), and the no-generic-toast-stack rule are all implemented as shared, reusable styles, not redecided per screen (UX-DR8)
**And** the single narrow content column (480 to 560px max width) is implemented as the permanent layout at every viewport size, with no breakpoint ever triggering a structural change (UX-DR9)

#### Story 1.3: Accessibility and Quality CI Gates

As the project team,
I want every pull request checked against the hard gates already promised in the UX spec and CLAUDE.md,
So that accessibility and type-safety regressions never reach the deployed product.

**Acceptance Criteria:**

**Given** a pull request is opened against `master`
**When** `.github/workflows/ci.yml` runs
**Then** it blocks the merge on any WCAG contrast or ARIA linting failure, any TypeScript strict-mode compilation error, and any failing test in the AC #7-required transaction-building test suite (UX-DR10)
**And** it also blocks the merge on any secret-scanning finding (for example a leaked API key), as a merge-blocking gate rather than a policy that relies on developer discipline alone (Threat Model, Information Disclosure)
**And** the workflow runs independently of and prior to Vercel's own preview deployment, never gating on Vercel's build status

**Given** any API route returns an error to the client
**When** the error envelope is constructed
**Then** it never includes the raw request payload, a full transaction XDR, or a server-side stack trace, only a safe code and message; detailed diagnostic information stays in the monitoring tool, never in the response body (Threat Model, Information Disclosure)

#### Story 1.4: Connect an Existing Stellar Wallet

As a returning Stellar user,
I want to connect my existing Stellar wallet (Freighter or another Stellar Wallets Kit-supported wallet),
So that the gateway knows where to detect incoming funds and can later request my deposit signature, without it ever touching my keys.

**Acceptance Criteria:**

**Given** I am on the entry screen with no wallet connected
**When** I choose to connect my wallet via Stellar Wallets Kit
**Then** the gateway receives only my public Stellar address, never a private key or seed phrase (AC #1, FR5)
**And** my connected address becomes the sole identifier used for balance detection and deposit signing later in the flow
**And** the Trust Badge component is visible on this and every subsequent screen in the flow, static and non-dismissible, showing its one mechanism-backed sentence (UX-DR3)

**Given** the wallet extension fails to inject into the page or I cancel the connection
**When** the connection attempt fails
**Then** the interface surfaces this explicitly, never silently retrying or leaving the button in an ambiguous state (AC #5)

#### Story 1.5: Request and Display a Live Cross-Chain Quote

As a returning Stellar user,
I want to request a quote to swap an asset I hold on Ethereum, Arbitrum, or Bitcoin into Stellar USDC or XLM,
So that I can see the real cost and timing before committing to anything.

**Acceptance Criteria:**

**Given** I have selected a supported origin asset, amount, and destination asset
**When** I request a quote
**Then** the gateway calls 1Click's production endpoint with `dry:false`, and the resulting fee, ETA, `slippageTolerance`, `minAmountOut`, and refund fields (`refundTo`, `refundType`, `refundFee`) are displayed verbatim, never paraphrased or rounded (FR1)

**Given** the selected origin route is currently down (Base or Solana today)
**When** I attempt to request a quote for it
**Then** the request is rejected before I am ever asked to sign anything, with a clear explanation, never a silent failure (AC #5, FR1)

**Given** a quote is displayed
**When** the Guided Status screen composition renders
**Then** it shows the compressed, numbers-first plain-language line for a returning user (the full-sentence variant is Story 2.1's concern for new users), a secondary fee row, and a "See full quote" disclosure that expands to reveal the remaining verbatim quote fields plus the Custody Fund-Flow Diagram, with an accessible text-equivalent description that also serves as its rendering fallback (UX-DR4, UX-DR7)

#### Story 1.6: Attribute Every Quote to the Gateway's Integrator ID

As the project team,
I want every quote request to carry Zephyroute's registered integrator ID,
So that settled volume is independently attributable without relying on the gateway's own database.

**Acceptance Criteria:**

**Given** any quote request is made from the standalone app
**When** the request reaches 1Click
**Then** it includes the registered integrator ID field, with zero requests sent anonymously (FR2)
**And** this attribution is independently verifiable later by querying 1Click's own integrator-attributed records directly, not only through Zephyroute's own logs

#### Story 1.7: Validate Destination Trustline Before Quoting

As a returning Stellar user,
I want the gateway to confirm my Stellar account already holds the right trustline before it even requests a quote,
So that I never hit a confusing mid-flow rejection from 1Click.

**Acceptance Criteria:**

**Given** my Stellar wallet is connected
**When** I request a quote
**Then** `lib/horizon.ts` checks trustline status for the destination asset against Horizon before the quote request fires (FR3, Integration Coupling Map)

**Given** the trustline already exists
**When** the check completes
**Then** the flow proceeds directly to the quote request, with no additional onboarding step shown

**Given** the trustline does not exist
**When** the check completes
**Then** I am routed into the onboarding path (Epic 2, FR6) rather than receiving an opaque API rejection

#### Story 1.8: Execute Settlement and Detect Arrival

As a returning Stellar user,
I want to sign the origin-chain swap and watch live status until my funds land in my own Stellar account,
So that I have confidence the cross-chain step actually worked before I'm asked to do anything else.

**Acceptance Criteria:**

**Given** I have reviewed and confirmed a quote
**When** I sign the origin-chain swap
**Then** the interface shows live status through quoted, submitted, and settled states via the Timestamped Step Tracker component (upcoming/active/done/failed states, `aria-current` on the active step, reduced-motion-aware pulse), never a static "processing" spinner (FR4, `FlowStage`, UX-DR5)

**Given** settlement completes normally
**When** Horizon confirms the destination balance change
**Then** detection is based on my actual Stellar account balance via Horizon, not solely on 1Click's own status field (FR4)

**Given** the route fails or degrades beyond recovery during settlement
**When** this is detected
**Then** the refund mechanism triggers and is visibly disclosed, with funds returned to origin, never a silent dead end (User Journey Flows, AC #5)

**Given** settlement completes normally
**When** the correlation record is written
**Then** it captures the settled volume, origin chain/asset, my Stellar address, and timestamp, tied to the integrator ID, through `lib/validation.ts` before persisting to Redis, never persisted unvalidated (FR10 groundwork, AC #3), since this is the moment this data first becomes known

#### Story 1.9: Build an Unsigned Deposit Transaction

As a returning Stellar user,
I want the gateway to prepare my DeFindex deposit automatically the instant my funds arrive,
So that I don't have to manually initiate anything once settlement is done.

**Acceptance Criteria:**

**Given** Horizon confirms funds have landed in my Stellar account
**When** the deposit transaction is built
**Then** `lib/defindex-client.ts` constructs an unsigned `deposit()` XDR against the default USDC Blend Autocompound vault, with `invest: true` by default and `amounts_min` populated with a real, non-zero slippage-protected value (FR7)
**And** the built XDR passes through `lib/validation.ts` internally before being returned, producing a `ValidatedTransactionXDR`, never returned unvalidated to the caller (AC #3, AC #4)

#### Story 1.10: Sign and Submit Within the Authorization Window

As a returning Stellar user,
I want to see exactly how much time I have to sign my deposit, and never lose progress if I miss it,
So that the short Soroban window never feels like a trap.

**Acceptance Criteria:**

**Given** the unsigned deposit XDR is ready
**When** it is presented for signature
**Then** the destination vault, exact amount, and minimum guaranteed balance are rendered visibly on screen, and a visible countdown appears alongside the Sign action (FR8, UX-DR6)
**And** the countdown derives its remaining time from the server-issued authorization window expiry, not the client's local clock, resyncing periodically

**Given** the signature window expires before I sign
**When** the expiry is detected
**Then** a fresh unsigned XDR rebuilds automatically, announced via an `aria-live` polite region, without repeating the cross-chain swap steps (FR8, NFR3)

**Given** my wallet disconnects mid-signature
**When** this is detected
**Then** an explicit reconnect state is shown, never assuming the signature succeeded or silently retrying

**Given** my Stellar account does not hold enough XLM to cover the deposit transaction's network fee
**When** this is detected before the signature prompt is shown
**Then** I see a plain-language explanation of the shortfall, never a cryptic transaction-submission failure after I've already signed (PRD Open Question 12)

#### Story 1.11: Confirm Deposit Success and Reflect Earning Status

As a returning Stellar user,
I want clear confirmation that my deposit actually worked and I'm now earning yield,
So that I don't have to guess or check somewhere else.

**Acceptance Criteria:**

**Given** I have signed and submitted the deposit transaction
**When** the transaction is broadcast
**Then** the flow moves through the `submitted` and `confirming on-chain` states, each visibly labeled and never collapsed into one, with a transaction hash shown starting at `submitted` (FR9, `DepositTransactionStatus`)

**Given** the deposit confirms on-chain
**When** the dfToken balance is read back from DeFindex
**Then** it is displayed as the confirmed "earning" outcome, matching what an independent Horizon/RPC query for that address would show (FR9)

**Given** the deposit reverts on-chain (for example, slippage exceeded)
**When** this is detected
**Then** it is surfaced explicitly with a clear next step, never left as a silent dead end (`DepositTransactionStatus: 'reverted'`)

**Given** the deposit confirms on-chain
**When** the correlation record already written in Story 1.8 is updated
**Then** it now also captures the destination vault and deposit-confirmed status, through `lib/validation.ts` before persisting, completing the record FR10 requires (no personally identifying data, per NFR7)

#### Story 1.12: Resume an Incomplete Deposit From Any Device

As any user who settled funds but didn't finish depositing,
I want to pick up exactly where I left off, from any device or wallet, whenever I come back,
So that I never worry about losing my place or my funds.

**Acceptance Criteria:**

**Given** I previously settled a swap but never signed the deposit, and I return later from any device
**When** I reconnect the same Stellar address
**Then** I sign the fixed challenge string with my wallet (`zephyroute:correlation-read:{unixTimestamp}`) and the gateway verifies that signed-nonce proof before returning any status for that address, never an open lookup by address alone (Authentication & Security, closing the enumeration/privacy gap)
**And** the gateway queries Horizon and DeFindex directly (with the correlation record already written in Story 1.8 as a convenience lookup, falling back to direct queries if Redis is unavailable or the record predates it) to detect the undeposited balance (FR9, AC #9)
**And** I am resumed directly at the deposit-signing step, never asked to re-quote or re-sign the origin-chain swap

**Given** the address already has a completed deposit
**When** I reconnect
**Then** I see my current earning position instead, with nothing presented as needing to resume

### Epic 2: New-to-Stellar User Onboards From Any Supported Chain

A user with zero prior Stellar presence goes through the same flow as Epic 1, with the account-creation and trustline fork handled explicitly and visibly, reaching the same "earning yield" outcome.

**FRs covered:** FR6.

### Epic 2 Stories

#### Story 2.1: Detect New User and Present the Onboarding Fork Explicitly

As a user with no existing Stellar presence,
I want the gateway to notice I have no trustline and clearly show me I'm on a different, slightly longer path,
So that I understand what's happening instead of hitting a confusing dead end.

**Acceptance Criteria:**

**Given** Story 1.7's trustline check finds no trustline for my address
**When** the fork is triggered
**Then** the flow explicitly shows me I'm being routed into account setup, as a visible, named step, never an invisible check that silently changes what I see
**And** the full-sentence plain-language quote line for new users (UX-DR7) is used throughout my journey, not the compressed returning-user variant

#### Story 2.2: Onboard via Embedded Wallet

As a brand-new-to-Stellar user,
I want a funded Stellar account with the right trustline created for me automatically, without leaving the flow or handing my keys to anyone,
So that I can go straight from "I've never used Stellar" to "I'm earning yield" in one sitting.

**Note:** confirmed live 2026-09-20 as the primary path, not a conditional one. Both Privy and DFNS support Stellar account creation and trustline setup; DFNS additionally supports fee-sponsored account creation and trustline setup on Stellar specifically, letting this entire story run gasless for the new user. DFNS is the stronger candidate for that reason, final vendor choice still open. Story 2.3 is retained as a defensive fallback, not an equally-likely alternative.

**Acceptance Criteria:**

**Given** the embedded-wallet provider (DFNS or Privy) is invoked during onboarding
**When** I go through onboarding
**Then** an account is created, funded with the ~0.5 XLM base reserve, and the required trustline is established, all without a separate manual step
**And** if the provider is DFNS, account creation and trustline setup are fee-sponsored, so I never need to hold XLM myself for this step
**And** the embedded wallet's key material is controlled by the provider under my own authentication (biometric, email, or social), never by the gateway itself (AC #1, FR6 Out of Scope)

#### Story 2.3: Manual Pre-Step Fallback for Account Funding

As a brand-new-to-Stellar user, when embedded-wallet onboarding isn't available at launch,
I want clear, documented instructions to fund a minimal account myself before continuing,
So that I still have a real path to using Zephyroute, even without the automated option.

**Note:** retained as a defensive fallback now that Open Question 1 resolved positively (2026-09-20), not the assumed default path; still needed for edge cases (a specific provider outage, a region the chosen provider doesn't cover, or a user who opts out of the embedded-wallet flow).

**Acceptance Criteria:**

**Given** embedded-wallet onboarding is unavailable for this user at this moment
**When** I reach the new-user fork
**Then** I see clear, step-by-step documented instructions for funding a minimal Stellar account and establishing the destination trustline myself, before the flow resumes at the quote step
**And** this fallback never implies the gateway holds custody at any point in the manual process

**Cross-epic note:** with Epic 2's stories complete, all three mapped user journeys (UJ-1 returning user, UJ-2 new user, UJ-3 cross-device resumability, User Journey Flows) become reachable end to end through the combination of Epic 1 and Epic 2 (UX-DR11). This is a consequence of both epics existing together, not a new capability either epic alone claims to deliver.

### Epic 3: Traction Evidence for SCF Reporting

The project team can see cumulative attributable volume, net-new TVL, unique funded addresses, and recurrence rate, all independently reconstructable from public data, ready to back any SCF tranche claim. Kept independent of Epic 4 since the PRD requires this live from the first transaction (§7.1), while Epic 4's partnership is explicitly parallel and non-blocking (§7.2), and coupling them would tie a hard MVP requirement to an optional one.

**FRs covered:** FR10, FR11.

### Epic 3 Stories

#### Story 3.1: Verify Attributable Flow Data Is Complete and Reconstructable

As the project team,
I want confirmation that the correlation record already written incrementally by Stories 1.8 and 1.11 satisfies FR10 in full,
So that traction is provable without relying on the gateway's own database as the source of truth.

**Note:** the record is written as the underlying data becomes known during the flow itself (Story 1.8 for settlement data, Story 1.11 for deposit data), not created fresh here. This story's job is to verify completeness and independent reconstructability, not to introduce the first write.

**Acceptance Criteria:**

**Given** a flow completes (deposit confirmed, per Story 1.11)
**When** the resulting correlation record is inspected
**Then** it contains settled volume, origin chain/asset, destination vault, the user's Stellar address, and timestamp, tied to the integrator ID, with every field having passed through `lib/validation.ts` before it was persisted (FR10, AC #3)
**And** no personally identifying data is present (NFR7)
**And** the same record can be independently reconstructed from public sources alone (1Click's integrator-attributed records, Horizon, DeFindex vault state), verified by deliberately discarding the Redis record for a test flow and confirming the fallback query produces the same result (AC #9)

#### Story 3.2: Expose Cumulative Traction Metrics

As the project team,
I want a view of cumulative attributable volume, net-new TVL, unique funded addresses, and recurrence rate,
So that I can report the same numbers to the SCF panel that the product itself shows, with no separate "marketing" figure.

**Acceptance Criteria:**

**Given** completed flow records exist
**When** the metrics view is requested
**Then** it displays cumulative attributable volume, net-new TVL, unique funded addresses, and 7/30-day recurrence rate (FR11)
**And** these are the exact figures usable in any SCF tranche submission, never a separately maintained or rounded set of numbers
**And** this view is a project-team-facing aggregate, distinct from the per-address signed-nonce lookup already built in Story 1.12, since it never exposes individual address-level data to an arbitrary caller
**And** the route is protected by Vercel's own deployment protection (password or team-member-only access), not open to any anonymous visitor, since this was a real gap found in the Threat Model (Elevation of Privilege) rather than a new admin-auth system, consistent with Rule #9's minimal-infrastructure philosophy

### Epic 4: Embedded Distribution Inside Partner Wallets

A partner wallet embeds Zephyroute's flow directly as a swap corridor, without building its own DeFindex integration, feeling native inside their app. THORWallet was the originally assumed target partner but is now deprioritized (decided 2026-09-20, `addendum.md` §A.4): they already shipped their own native NEAR Intents plus Blend loop into Stellar, so they no longer need a third-party corridor for that exact use case. The widget itself stays generic, built for any partner, not rewritten; the next candidate partner should specifically lack an existing native swap-to-Stellar-yield loop.

**FRs covered:** FR12.

### Epic 4 Stories

#### Story 4.1: Ship the Flow as an Embeddable Widget Route

As a partner wallet without an existing native swap-to-Stellar-yield loop,
I want to embed Zephyroute's flow as a swap corridor inside my own app,
So that I can offer Stellar yield to my users without building my own DeFindex integration.

**Acceptance Criteria:**

**Given** the standalone app's flow (Epic 1, and Epic 2 or Epic 3 if already built) already works end to end
**When** the `/embed` route is built
**Then** it renders the same component layer (`components/features/`, `components/ui/`) as the standalone app, reusing whichever stories already exist rather than a separate implementation (FR12)
**And** the token layer lets the embedding partner override Zephyroute's own token values via scoped CSS custom properties at the widget's root, without forking components (Container Fidelity)
**And** the `/embed` route carries its own tighter bundle-size budget than the standalone app, since it loads inside an already-loaded partner page
**And** the widget builds and ships as part of v1 regardless of whether any specific embed partnership is confirmed

**Given** a flow originates inside the embedded widget rather than the standalone app
**When** the quote request and the correlation record (Story 1.8) are attributed
**Then** this story explicitly decides and documents which integrator ID is used (Zephyroute's own, the partner's, or a sub-attributed value), since this is flagged as unresolved in the Integration Coupling Map, not something to silently inherit from the standalone app's behavior
**And** the same attribution is wired identically for widget-originated flows as for standalone-originated ones, so Epic 3's traction metrics remain accurate regardless of entry point

#### Story 4.2: Configure Cross-Origin Wallet Connectivity for the Embed

As a user inside a partner's embedded widget,
I want my wallet connection and signing to work exactly as it does in the standalone app,
So that being inside someone else's page never breaks the core flow.

**Note:** this story is gated on a future embed partner's confirmation for actual deployment (THORWallet, the original target, was deprioritized 2026-09-20 per PRD Open Question 7's resolution, so no partner is currently confirmed), but the CSP and WalletConnect configuration work itself is not partner-specific and can be built and verified independently.

**Acceptance Criteria:**

**Given** the `/embed` route is served from its own origin inside a partner's iframe
**When** Zephyroute's own `frame-ancestors` CSP directive is configured
**Then** it explicitly allowlists confirmed partner origins by name (for example `https://<confirmed-partner-domain>`, whichever partner is actually pursued once THORWallet is deprioritized), never a wildcard, so no arbitrary site can frame the widget and impersonate a legitimate partner (Threat Model, Spoofing)
**And** the exact serving origin of `/embed` is added to the WalletConnect project's allowed-origins list, verified before this story is considered done, not assumed to work

**Given** either prerequisite is not yet satisfied for a given partner
**When** the embed is loaded there
**Then** wallet connection fails with a clear, surfaced error, never a silent broken state (AC #5)
