---
stepsCompleted: [1]
inputDocuments:
  - docs/prds/prd-stellar-intents-gateway-2026-08-25/prd.md
  - docs/prds/prd-stellar-intents-gateway-2026-08-25/addendum.md
  - docs/ux-design-specification.md
  - docs/architecture.md
project_name: 'zephyroute'
user_name: 'JafetCHVDev'
date: '2026-09-13'
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
FR6: Onboard a brand-new-to-Stellar user (embedded wallet via Privy/DFNS if Open Question 1 resolves positively; documented manual fallback otherwise).
FR7: Build an unsigned deposit transaction (default USDC Blend Autocompound vault; `invest: true` by default; `amounts_min` always a real slippage-protected value).
FR8: Sign and submit within the authorization window (visible countdown; automatic graceful XDR rebuild on expiry without repeating FR1-FR4).
FR9: Confirm and resume deposit state (reads back dfToken balance; resumable from any device, any later time, skipping FR1-FR4 on resume).
FR10: Record attributable flow data (settled volume, origin chain/asset, destination vault, address, timestamp; reconstructable independently from public sources; no PII).
FR11: Expose cumulative traction metrics (attributable volume, net-new TVL, unique funded addresses, recurrence rate; same figures used in any SCF submission).
FR12: Ship as an embeddable widget (decoupled from partner confirmation; ships in v1 regardless of THORWallet partnership status).
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
- Iframe-embedded widget (`/embed` route): requires explicit CSP (`frame-ancestors`) configuration on Zephyroute's side and, once the THORWallet partnership resolves, verification that THORWallet's own CSP permits framing the Zephyroute origin and that the origin is added to the WalletConnect project's allowed-origins list, or wallet connection fails.
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
UX-DR11: Implement all three user journey flows exactly as mapped (UJ-1 THORWallet embed with the compressed status line, UJ-2 standalone onboarding with the full status line and the trustline-driven fork, UJ-3 cross-device/cross-session resumability that skips directly to the deposit step), including the settlement-failure/refund branch and the signature-window-expiry rebuild in every journey.

### FR Coverage Map

_To be completed once epics are designed._

## Epic List

_To be completed in the next step._
