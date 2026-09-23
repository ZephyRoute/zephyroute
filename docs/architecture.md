---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - docs/prds/prd-stellar-intents-gateway-2026-08-25/prd.md
  - docs/prds/prd-stellar-intents-gateway-2026-08-25/addendum.md
  - docs/prds/prd-stellar-intents-gateway-2026-08-25/.decision-log.md
workflowType: 'architecture'
project_name: 'stellar-intents-gateway'
user_name: 'JafetCHVDev'
date: '2026-08-25'
lastStep: 8
status: 'complete'
completedAt: '2026-09-13'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
13 FRs across 5 features: Cross-Chain Acquisition (FR-1–4, via NEAR Intents' 1Click API), Wallet & Signing Layer (FR-5–6, existing-wallet connect + unconfirmed embedded-wallet onboarding), Yield Deposit (FR-7–9, via DeFindex SDK, gated by Soroban's short authorization window), Traction Instrumentation (FR-10–11, the mechanism that evidences SCF Integration Track tranche #3), and Distribution Surface (FR-12–13, embeddable widget + standalone web app). Architecturally, this is an orchestration layer over two independent production APIs rather than a system with its own domain model.

**Non-Functional Requirements:**
- Non-custodial by construction (no private key or unilateral transfer capability at any layer) — the defining architectural invariant.
- Upstream availability transparency for both 1Click and DeFindex, given confirmed intermittent failures (Base/Solana routes).
- Signature-window UX: the ~1–5 minute Soroban authorization window must never surface as an opaque error; requires countdown + graceful rebuild.
- Independent auditability: every flow must be reconstructable from public on-chain/API data alone, not from the gateway's own database — qualified below, this holds only with a correlation step (see Integration Coupling Map).

**Scale & Complexity:**
- Primary domain: full-stack web with client-side blockchain SDK integration (Stellar/Soroban, EVM/Bitcoin wallet connectors via NEAR Intents' quote flow).
- Complexity level: Medium — two independent third-party blockchain integrations with strict timing constraints, a resumable multi-step user flow, and dual distribution surfaces (standalone app + embeddable widget).
- Estimated architectural components: cross-chain quote/settlement client, wallet connection/signing layer, Soroban transaction builder + signer flow, a correlation/attribution layer joining the two integrations by Stellar address (newly identified — see below), and a widget packaging layer for third-party embedding.

### Technical Constraints & Dependencies

- NEAR Intents / 1Click API (external, production, no SLA): Base origin confirmed live 2026-09-22 and added as a route; Solana confirmed live at the API level but needs its own non-EVM wallet integration before it can be added (Open Question 3). Confirmed to validate destination trustline against Horizon *before* accepting a quote, this makes trustline state a precondition of FR-1, not a downstream consequence of it.
- DeFindex API/SDK (external, production, auth-gated) — deposit() requires a `SorobanAuthorizationEntry` expiring in 12–60 ledgers; no ERC-20-style indefinite allowance exists. Carries no integrator ID concept of its own — attribution here depends entirely on the correlation layer, not on DeFindex's API.
- Wallet layer: Stellar Wallets Kit / Freighter confirmed viable; Privy/DFNS embedded-wallet onboarding capability confirmed live for both providers (Open Question 1, resolved 2026-09-20), DFNS additionally offering fee-sponsored account creation and trustline setup on Stellar specifically. Still a fork point for the onboarding architecture (returning wallet-connect vs. embedded-wallet onboarding), but no longer a hard technical unknown.
- Origin-chain wallet layer (Ethereum, Arbitrum, the two EVM origin chains): a real gap discovered during Story 1.8 implementation, no document had ever chosen this. Resolved with wagmi v3 + viem v2, the confirmed current standard, verified live rather than assumed. Bitcoin, the third origin chain, has no equivalent injected-provider signing convention and needs its own separate integration, not yet scoped; `src/lib/origin-swap.ts` throws explicitly rather than silently mishandling it.
- Distribution: THORWallet deprioritized as the target embed partner (Open Question 7, resolved for THORWallet specifically 2026-09-20, since they shipped their own native NEAR Intents plus Blend integration and no longer need a third party for the core loop); the widget still ships generic, targeting a future partner who lacks an existing native swap-to-Stellar-yield loop. Which integrator ID a widget-originated flow reports to 1Click (Zephyroute's, the host partner's, or a sub-attributed value) remains an open architectural question independent of which partner is chosen.
- No proprietary database of funds or custody ledger by design (Rule #9) — any persistence layer is a convenience cache, not a source of truth, except for the correlation record joining a user's Stellar address across the two integrations, which may be the one piece of state genuinely irreplaceable by public data alone.

### Cross-Cutting Concerns Identified

- Non-custodial invariant must hold across every component (wallet layer, any serverless function, the embeddable widget).
- Upstream dependency degradation (1Click, DeFindex) must be surfaced consistently across both distribution surfaces, not silently swallowed.
- The Soroban authorization time window affects state management, UX, and retry/resume logic across the entire deposit flow — and interacts with solver settlement time (60s on Ethereum/Arbitrum vs. ~14 min on Bitcoin): the deposit XDR (N6) must be built on-demand, triggered by confirmed settlement detection, never speculatively ahead of it, or it risks expiring before the user can act.
- Attribution/instrumentation (integrator ID, traction metrics) must be wired identically whether the user arrives via the standalone app or the embedded widget — this is the mechanism the SCF tranche #3 metric depends on, and it is more fragile than previously assessed (see Integration Coupling Map).
- The inherited KYC/AML ToS tension (Open Question 5) is a legal cross-cutting concern touching onboarding copy and any public marketing/SCF claims, even though it drives no new infrastructure.

### Integration Coupling Map

*Surfaced via Graph of Thoughts analysis — the system is not two integrations in series, as the PRD's Vision implies; it's a graph joined by one implicit correlation node.*

- **Trustline is a precondition, not a consequence.** 1Click validates the destination Stellar account's trustline against Horizon before it will even issue a quote. The trustline-check (FR-3) must architecturally sit before the quote request (FR-1), not after — this reorders the FR-1→FR-3 sequence implied by the PRD's feature ordering.
- **The deposit XDR must be built reactively, not speculatively.** Settlement time varies from 60s (Ethereum/Arbitrum) to ~14 minutes (Bitcoin), while the Soroban authorization window is a fixed ~1–5 minutes measured from XDR construction. Building the deposit XDR ahead of confirmed settlement risks it expiring before the user can sign; this requires an active settlement-detection component (Horizon polling or equivalent) as a first-class piece of the architecture, not an implementation detail.
- **The user's Stellar address is the hidden correlation key.** DeFindex's API has no integrator-ID concept, so net-new TVL (SM-2) can't be attributed from DeFindex's own records alone — it requires correlating the address that received funds via 1Click (which does carry the integrator ID) with that same address's later DeFindex deposits. This correlation step is likely the one piece of state that genuinely needs to persist somewhere, which tempers the "zero backend" framing from Rule #9 — the exception is narrow and specific, not a reopening of the custody question.
- **Widget-context attribution is unresolved.** When the flow runs inside a partner's embed, which integrator ID gets sent to 1Click — Zephyroute's, the partner's, or a sub-attributed value — is not yet decided. This is a partnership/architecture decision, not just a product one, and it directly affects whether SM-1/SM-2 can be correctly attributed by traffic source. (THORWallet, the original target partner for this widget, is no longer the assumed integration target, per Open Question 7's resolution on 2026-09-20, but the attribution question itself is partner-agnostic and applies to whichever partner is eventually pursued.)

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web with client-side blockchain SDK integration, per Scale & Complexity in Project Context Analysis, needing two distribution surfaces (standalone app, embeddable widget) and one minimal serverless correlation layer.

### Starter Options Considered

| Option | Trade-off | Decision |
|---|---|---|
| **Next.js (App Router)** | Full-stack, first-class Vercel deployment, API routes double as the correlation layer. | **Selected** |
| **Vite plus a separate lightweight backend** | More manual wiring, two deploy targets instead of one, no clear benefit given how thin the actual backend need is (Rule #9). | Rejected |
| **Remix** | A solid full-stack alternative, but the Next.js/Vercel pairing is more battle-tested for this exact app-plus-API-routes shape and has a larger ecosystem overlap with the wallet-kit and Soroban tooling this project depends on. | Rejected |

### Selected Starter: Next.js 16 (App Router)

**Rationale for Selection:**
One framework serves all three needs at once (standalone app, embeddable widget route, correlation-layer API routes), consistent with the PRD's "thinnest possible layer" framing. Deployment on Vercel is zero-config and auto-scaling for exactly this shape, verified live rather than assumed.

**Initialization Command:**

```bash
npx create-next-app@latest zephyroute --typescript --app --no-tailwind --src-dir --import-alias "@/*"
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
TypeScript, matching CLAUDE.md's AC #6 (strict mode) exactly, no gap to reconcile.

**Styling Solution:**
None imposed (Tailwind explicitly skipped), so the token-first CSS custom-properties system from Design System Foundation becomes the actual styling foundation from day one, not something to retrofit later.

**Build Tooling:**
Next.js's own build and dev toolchain (Turbopack in dev), zero extra configuration needed.

**Testing Framework:**
Not included by default, chosen in a later step, driven by AC #7's specific requirement for tests on transaction-building code.

**Code Organization:**
`src/` directory, App Router file-based routing. The embeddable widget lives as its own dedicated route (for example, `/embed`), rendered inside a partner's iframe, the standard and safest pattern for third-party embedding, which also gives the widget performance isolation from the partner's own app.

**Development Experience:**
Hot reload, zero-config TypeScript, App Router's file-based routing and layouts.

**Consequences of the iframe-embedded widget pattern:** wallet-extension injection (Freighter) and WalletConnect's origin allowlist do not automatically work inside a third-party iframe without explicit configuration. Two technical prerequisites must be verified during partner integration, not assumed: (1) THORWallet's own CSP (`frame-ancestors`) must permit framing the Zephyroute embed origin, and (2) the exact serving origin of `/embed` must be added to the WalletConnect project's allowed-origins list, or wallet connection fails with an origin-not-allowed error. This is now a technical dependency of PRD Open Question 7 (THORWallet partnership), not just a business one, and should be verified before the widget route is built, not discovered during integration.

**Note:** The correlation layer, the one piece of persisted state Rule #9 allows, is built as Next.js API routes, deployed automatically as isolated serverless functions on Vercel rather than a separate service. Its actual persistence choice is a Step 4 decision, not a starter decision.

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):** persistence choice for the correlation layer, the wallet-based session model, the error-handling contract (operationalizes AC #5).

**Important Decisions (Shape Architecture):** state management approach, rate limiting, CI/CD gate enforcement (already promised in the UX spec), an interim monitoring foundation.

**Deferred Decisions (Post-MVP, with rationale):** the full threat model and monitoring plan PRD Open Question 10 requires for SCF tranche #2. It deserves its own dedicated pass, not a rushed subsection here; this step only commits to an interim monitoring baseline, not the full deliverable.

### Data Architecture

Persistence for the correlation layer: Upstash Redis, via Vercel's native Marketplace integration. Verified live: Vercel's own KV product was sunset in December 2024, every existing and new setup now routes through Upstash Redis directly, not the deprecated `@vercel/kv` package. A key-value store fits the actual shape of this data exactly (Stellar address to 1Click settlement reference, DeFindex deposit reference, status, timestamps), and reusing the same instance for rate limiting avoids standing up a second piece of infrastructure.

Data modeling: one record type, keyed by Stellar address, holding just enough to answer "is this address's swap settled, and has it deposited yet," the exact question UJ-3 resumability depends on. This stays a convenience cache per Rule #9: if the record were lost entirely, the correct state remains reconstructable from Horizon and DeFindex directly, just slower.

Data validation: every field written here must already be validated against AC #3 before it's persisted.

Migration approach: minimal, a schema-version field from day one covers record-shape changes later.

Caching strategy: no durable caching of quote data, quotes are time-sensitive and always fetched live. Caching stays limited to short-lived client-side UI state for the active session, never a source of truth.

Fallback requirement, not an assumption: if Upstash Redis is unavailable, correlation-layer routes fall back to querying Horizon and DeFindex directly rather than failing. This is an explicit architectural commitment, not an implied consequence of Rule #9, since a convenience-cache principle that isn't actually wired into the failure path is exactly the kind of gap that surfaces silently in production under the No silent failure criterion.

### Authentication & Security

No traditional authentication system exists. Identity is the connected wallet address itself, consistent with the non-custodial invariant and the UX spec's Form Patterns rule.

Session model: reconnecting a wallet is the "login." No server-issued session token is needed beyond basic request correlation, since Horizon and DeFindex remain the actual source of truth for a given address's state.

Security middleware: rate limiting on the correlation-layer API routes via `@upstash/ratelimit`, reusing the same Redis instance chosen above.

Secrets: 1Click and DeFindex API keys live in Vercel environment variables only, scoped separately per environment, never committed to the repo.

API security for the iframe embed: the `/embed` route's CSP and frame-related headers need explicit configuration, not the framework default.

Read authorization for the correlation layer: reading another address's status is not an open lookup. A correlation-layer GET endpoint only returns data for an address that has proven ownership via a signed nonce in that request, closing an enumeration and privacy gap that would otherwise exist even though individual addresses are already public via Horizon.

Signed-nonce protocol, made concrete: the client signs the string `zephyroute:correlation-read:{unixTimestamp}` with the connected wallet, and sends both the timestamp and signature in the `x-nonce-signature` header as `{timestamp}.{signature}`. The server verifies the signature recovers to the requested address and that the timestamp is within a 60-second window, preventing replay without needing a nonce-issuing endpoint or server-side nonce storage, consistent with the session-less identity model already established. This exact format is what `lib/auth-nonce.ts` implements and what every client caller must produce identically.

### API & Communication Patterns

Internal API design: plain REST-style JSON endpoints over Next.js route handlers, no GraphQL.

Error handling standard: every API route returns a consistent error envelope (`{ error: { code, message } }`), and the frontend treats a failed response as something to surface, never something to catch and discard silently.

Communication with 1Click and DeFindex: their own official SDKs, wrapped in a thin validation layer per AC #3.

Rate limiting applies specifically to the correlation-layer routes, not to server-to-server calls toward 1Click/DeFindex.

### Frontend Architecture

State management: TanStack Query v5, not a global client-state library. Its polling/refetch model is a natural fit for the Timestamped Step Tracker and the settlement-detection component.

Component architecture: `components/ui/` for thin skins over headless primitives, `components/features/` for the 4 bespoke components already specified in Component Strategy.

Routing: App Router file-based routing; the standalone app and the `/embed` widget route share the same component layer.

Performance and bundle optimization: `/embed` gets its own tighter bundle-size budget than the standalone app.

### Infrastructure & Deployment

Hosting: Vercel, git-integrated deploys, automatic preview deployments per pull request.

CI/CD: GitHub Actions enforcing the hard gates already promised in the UX spec: contrast and ARIA linting as a merge-blocking check, TypeScript strict-mode compilation, and the transaction-building test suite required by AC #7, all required to pass before merge, not advisory.

Environment configuration: separate environment variable sets for preview and production in Vercel, holding the 1Click/DeFindex keys per AC #2; no `.env` file ever committed.

Monitoring and logging: PRD Open Question 10 is now resolved in `docs/threat-model.md`, a STRIDE threat model and monitoring plan built from the failure-mode table already gathered in `addendum.md` §C. It commits to a lightweight uptime/error-tracking tool wired in from day one, satisfying the Upstream availability transparency NFR, and connects the PRD's own SM-C1 counter-metric to an actual monitored, alertable signal for the first time.

Scaling: automatic via Vercel's serverless function model.

### Decision Impact Analysis

**Implementation Sequence:** starter init then environment/secrets setup then the correlation-layer Upstash Redis instance and its API routes then the settlement-detection/polling component then the four bespoke UI components then the `/embed` route and its CSP/WalletConnect configuration last.

**Cross-Component Dependencies:** the correlation layer's Redis instance is shared infrastructure for two purposes; the `/embed` route's viability is gated on the Step 3 CSP/WalletConnect finding being verified with whichever partner is eventually pursued (THORWallet deprioritized as that target 2026-09-20, per PRD Open Question 7's resolution, so this verification is no longer scheduled against a named partner); the monitoring decision here is interim, not a substitute for the full threat model PRD Open Question 10 still requires.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** naming for the shared Redis instance's two uses, component/file naming drift against the UX spec's exact component names, status-string naming for the deposit/settlement flow, error-response shape consistency across every API route, and the exact location and enforcement mechanism of the shared types module.

### Naming Patterns

**Redis (Data) Naming Conventions:**
`correlation:{stellarAddress}` for a correlation record, `ratelimit:{address}` for a rate-limit bucket.

**API Naming Conventions:**
Kebab-case route segments, camelCase parameters, upstream fields normalized at the AC #3 validation layer. API request/response types follow one naming convention: `{Verb}{Resource}Request` and `{Verb}{Resource}Response` (for example, `GetCorrelationResponse`), always defined in `lib/types.ts`, never redefined inline at the call site or the route handler.

**Code Naming Conventions:**
Components use the exact names already locked in Component Strategy, verbatim (`TrustBadge.tsx`, `CustodyFundFlowDiagram.tsx`, `StepTracker.tsx`, `SignatureCountdown.tsx`). Hooks, functions, and variables use camelCase throughout.

### Structure Patterns

Tests are co-located as `*.test.ts` next to the file they test. Components live under the `components/ui/` versus `components/features/` split from Step 4. Shared utilities, the validation layer, the correlation-layer client, and TanStack Query hooks all live under `lib/`. API routes follow App Router's `app/api/` convention, one route handler per concern.

The shared canonical types module lives at exactly `lib/types.ts` (a single file, not a folder, given how small this surface is), inside the `lib/` directory already established as the one shared home for cross-cutting code. No agent creates a second types location.

Pagination conventions are explicitly out of scope: the correlation-layer surface is a handful of single-resource endpoints, never a list/collection endpoint, so this is a deliberate non-issue, not an oversight.

Config files stay at the repo root; `.env.example` is committed, `.env.local` stays git-ignored. `docs/` stays reserved for product documentation only.

### Format Patterns

API failures use `{ error: { code, message } }`. Success responses return data directly, no `{ data: ... }` wrapper. JSON fields are camelCase, dates are ISO 8601, booleans are real `true`/`false`, and a single item is never array-wrapped.

### Communication Patterns

There is no pub/sub event bus, settlement detection is a TanStack Query polling model. The UX spec actually defines two distinct state layers, not one, and both become their own shared TypeScript union type, matching its exact string literals, never a paraphrase: `FlowStage` (`'quoted' | 'submitted' | 'settled' | 'depositing' | 'earning'`) for the persistent Guided Status rail, and `DepositTransactionStatus` (`'submitted' | 'confirming on-chain' | 'completed' | 'failed' | 'expired' | 'reverted'`) for the deposit-signing moment's own micro-states. Flattening these into a single union, or renaming "confirming on-chain" to a shorter form, would break the exact-verbatim rule this document sets for itself. State management stays TanStack Query only, no global client-state store. Query keys follow a consistent array-tuple convention.

### Process Patterns

Every user-facing error maps to exactly one Feedback Pattern already defined in the UX spec (Error/Critical, Warning, Info). No scattered boolean `isLoading` flags; TanStack Query's `status`/`fetchStatus` is the single source of loading state, mapped onto the Step Tracker's already-defined states.

### Enforcement Guidelines

**All AI Agents MUST:**
- Use the exact component names and status literals from the UX spec verbatim, never invent parallel naming.
- Route every error through the shared envelope and the UX spec's Feedback Patterns, never construct an ad-hoc error UI.

**Pattern Enforcement:**
A shared `lib/types.ts` module exports the canonical status unions and the error envelope type, imported everywhere rather than redefined locally. The "TypeScript compile error" guarantee only holds in practice if every API route handler explicitly annotates its return type as the shared response type from `lib/types.ts`, rather than leaving it inferred, since TypeScript's structural typing will not catch two independently-shaped objects that happen to match today. Pattern violations surface as PR review comments referencing this section.

### Pattern Examples

**Good Example:**
```ts
// lib/api/correlation.ts
export async function getCorrelation(address: string, signedNonce: string): Promise<GetCorrelationResponse> {
  const res = await fetch(`/api/correlation/${address}`, {
    headers: { 'x-nonce-signature': signedNonce },
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new CorrelationError(error.code, error.message);
  }
  return res.json();
}
```

**Anti-Pattern:**
```ts
// Ad-hoc shape, no shared envelope, silent catch: forbidden.
fetch(`/api/correlation/${address}`).then(r => r.json()).catch(() => null);
```

## Project Structure & Boundaries

### Complete Project Directory Structure

```
zephyroute/
├── README.md
├── package.json
├── next.config.ts
├── proxy.ts
├── tsconfig.json
├── .env.example
├── .env.local
├── .gitignore
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
│   ├── prds/
│   │   └── prd-stellar-intents-gateway-2026-08-25/
│   │       ├── prd.md
│   │       ├── addendum.md
│   │       └── .decision-log.md
│   ├── architecture.md
│   └── ux-design-specification.md
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── embed/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   └── api/
│   │       └── correlation/
│   │           └── [address]/
│   │               └── route.ts
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Disclosure.tsx
│   │   │   └── Tooltip.tsx
│   │   └── features/
│   │       ├── TrustBadge.tsx
│   │       ├── TrustBadge.test.tsx
│   │       ├── CustodyFundFlowDiagram.tsx
│   │       ├── StepTracker.tsx
│   │       ├── StepTracker.test.tsx
│   │       └── SignatureCountdown.tsx
│   ├── lib/
│   │   ├── types.ts
│   │   ├── validation.ts
│   │   ├── validation.test.ts
│   │   ├── redis.ts
│   │   ├── rate-limit.ts
│   │   ├── auth-nonce.ts
│   │   ├── one-click-client.ts
│   │   ├── defindex-client.ts
│   │   ├── defindex-client.test.ts
│   │   ├── horizon.ts
│   │   ├── wallet-kit.ts
│   │   └── hooks/
│   │       ├── useQuote.ts
│   │       ├── useSettlementStatus.ts
│   │       └── useCorrelation.ts
└── public/
    └── favicon.ico
```

No `prisma/` directory exists, since there is no relational database, Upstash Redis holds the one narrow correlation record (Rule #9). No separate root `tests/` directory exists either, since Step 5 already committed to co-located `*.test.ts` files, a second parallel test tree would directly contradict that pattern.

### Architectural Boundaries

**API Boundaries:**
Corrected 2026-09-21 (Issue #3) and 2026-09-22 (Issue #7): the internal API surface is `src/app/api/correlation/route.ts` (writes, Story 1.8/1.11) and the future `src/app/api/correlation/[address]/route.ts` (reads gated by the signed-nonce ownership check from `lib/auth-nonce.ts`, Story 1.12), plus `src/app/api/quote/route.ts` and `src/app/api/deposit/build/route.ts`. 1Click's JWT, DeFindex's API key, and the Upstash Redis REST token are all real secrets, verified directly against the vendors' own documentation, not the public-style tags the original version of this section assumed; `lib/one-click-client.ts`, `lib/defindex-client.ts`, and any code that touches `lib/redis.ts` (directly or via `lib/validation.ts`'s `writeCorrelationRecord`) are therefore only ever called from these Route Handlers, never imported into client-side code. Horizon carries no credential at all, the only one of the four integration targets actually safe to call directly client-side, exactly as `lib/horizon.ts` already does.

**Component Boundaries:**
`components/ui/` never imports from `components/features/`, only the reverse; a bespoke component composes primitives, a primitive never depends on product-specific logic. `components/features/` components read their data exclusively through the `lib/hooks/` TanStack Query hooks, never call `fetch` or a client library directly, so data-fetching stays in one layer.

**Service Boundaries:**
`lib/one-click-client.ts`, `lib/defindex-client.ts`, and `lib/horizon.ts` are the only files that talk to an external network dependency directly; every other file goes through them, never re-implements a raw fetch to those three services independently.

**Data Boundaries:**
`lib/redis.ts` is the only file that opens a Redis connection; `lib/validation.ts` sits between every external response and anything that persists or displays it, per AC #3. Nothing writes to Redis without passing through validation first.

Validation is structurally built in, not an optional caller step: the public functions in `one-click-client.ts` and `defindex-client.ts` call `validation.ts` internally before returning any transaction XDR or response data. Callers never receive unvalidated data to begin with.

AC #4 (review before signing) is enforced at the type level, not just by convention: `lib/types.ts` defines a branded `ValidatedTransactionXDR` type that only `validation.ts` can produce, and `wallet-kit.ts`'s sign function only accepts that type. Passing an unvalidated XDR to the signer becomes a TypeScript compile error, matching the same enforcement discipline already established in Step 5.

Refund-mechanism handling (the settlement-failure branch from User Journey Flows) lives inside `horizon.ts`, alongside settlement detection itself, since both watch the same polling loop; it is a documented responsibility of that file, not a separate module.

### Requirements to Structure Mapping

**Feature Mapping (FR categories, per Project Context Analysis):**
- **Cross-Chain Acquisition (FR-1 to FR-4):** `lib/one-click-client.ts`, `lib/hooks/useQuote.ts`, `src/app/page.tsx`. FR-3's trustline check runs from `lib/horizon.ts` and is called from `page.tsx` before the quote request fires, per the Integration Coupling Map's sequencing rule (trustline is a precondition, not a consequence); its result is what actually drives the UJ-1/UJ-2 fork the UX spec already designed as an explicit, visible moment.
- **Wallet & Signing Layer (FR-5 to FR-6):** `lib/wallet-kit.ts`.
- **Yield Deposit (FR-7 to FR-9):** `lib/defindex-client.ts` and its required test, `lib/horizon.ts` for settlement detection and refund handling, `components/features/SignatureCountdown.tsx`.
- **Traction Instrumentation (FR-10 to FR-11):** `src/app/api/correlation/[address]/route.ts`, `lib/redis.ts`, `lib/hooks/useCorrelation.ts`.
- **Distribution Surface (FR-12 to FR-13):** `src/app/embed/`, `proxy.ts` (project root, not `src/`, per Next.js 16's rename of the middleware convention, verified live during Story 1.1 implementation) for the CSP/frame-ancestors headers the Step 3 finding requires.

**Cross-Cutting Concerns:**
- **Non-custodial invariant (AC #1):** enforced by structure itself, no file in this tree ever holds or requests a private key; `lib/wallet-kit.ts` only ever hands off to the wallet extension for signing.
- **No silent failure (AC #5):** `lib/types.ts`'s error envelope plus the Feedback Patterns from the UX spec, referenced from every `components/features/` component that can fail.

### Integration Points

**Internal Communication:**
`components/features/` reads through `lib/hooks/`, which read through `lib/*-client.ts` and `lib/redis.ts`. No component talks to Redis, 1Click, or DeFindex directly.

**External Integrations:**
1Click (`lib/one-click-client.ts`), DeFindex (`lib/defindex-client.ts`), Horizon (`lib/horizon.ts`), Upstash Redis (`lib/redis.ts`), Stellar Wallets Kit and Freighter (`lib/wallet-kit.ts`).

**Data Flow:**
Quote request to 1Click, swap signed via `wallet-kit.ts`, settlement detected by `horizon.ts` polling through `useSettlementStatus.ts` (with the refund branch handled in the same file on failure), deposit XDR built, validated, and signed via `defindex-client.ts` and `wallet-kit.ts`, the correlation record written to Redis through the validated `correlation` API route, read back later (possibly from a different device, UJ-3) through the same route with signed-nonce proof of ownership.

### File Organization Patterns

**Configuration Files:** repo root only (`next.config.ts`, `tsconfig.json`, `.env.example`), per Step 5.

**Source Organization:** `src/app/` for routes, `src/components/` split by the ui/features boundary, `src/lib/` for everything else, per Step 5.

**Test Organization:** co-located `*.test.ts`/`*.test.tsx`, no separate test tree; AC #7 specifically requires tests on `lib/defindex-client.ts` and any XDR/quote-request builder.

**Asset Organization:** `public/` for static files; no image-heavy asset pipeline exists given the flat, dark, single-accent visual system, the Custody Fund-Flow Diagram renders as inline SVG/Canvas from `components/features/`, not a static image asset.

### Development Workflow Integration

**Development Server Structure:** `next dev` (Turbopack) at the repo root, no separate services to run locally; Upstash Redis is a remote managed instance from day one, not a local container, since AC #9's fallback-to-Horizon requirement means local development can proceed even without Redis configured.

**Build Process Structure:** `next build`, TypeScript strict-mode compilation as a build-blocking step (AC #6), no separate build step for `/embed`, it is one route inside the same build output.

**Deployment Structure:** git push to `master` (or a PR) triggers Vercel's build and preview deploy automatically; `.github/workflows/ci.yml` runs the hard gates from Step 4 (contrast/ARIA lint, TS strict, AC #7 tests) as a required check before merge, independent of and prior to Vercel's own deploy.

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:** All technology choices work together without conflict: Next.js 16 (App Router), TanStack Query v5, and Upstash Redis are each independently current and commonly paired, verified live rather than assumed at each step they were introduced. No contradictory decisions were found between Steps 3 through 6.

**Pattern Consistency:** Three real inconsistencies were found and corrected during this validation, not assumed clean:
1. Step 5's Communication Patterns had flattened the UX spec's two distinct state layers (the Guided Status rail's five macro stages, and the deposit-signing moment's own micro-states) into a single union type, and had silently renamed "confirming on-chain" to "confirming," directly violating this same document's own rule to use UX spec literals verbatim. Corrected to two separate union types, `FlowStage` and `DepositTransactionStatus`, each matching the UX spec's exact wording.
2. Step 6's Requirements to Structure Mapping never assigned a file responsibility to FR-3's trustline check, even though the Integration Coupling Map (Step 2) explicitly requires it to run before the quote request and the UX spec relies on its result to drive the UJ-1/UJ-2 fork. Corrected by assigning it to `lib/horizon.ts`, called from `page.tsx` before the quote fires.
3. Step 4's signed-nonce read-authorization mechanism for the correlation layer was asserted but never specified concretely, the one new security mechanism in this document that lacked its own protocol. Corrected with a concrete, stateless challenge-response design (wallet signs a fixed string with a timestamp, verified server-side within a 60-second window), avoiding a new nonce-issuing endpoint or Redis-backed nonce store.

**Structure Alignment:** The project structure supports every architectural decision from Steps 3 to 5: the ui/features component split, the lib/ boundary discipline, the shared `lib/types.ts` module, and the branded `ValidatedTransactionXDR` enforcement mechanism are all reflected as concrete files and boundary rules, not left abstract.

### Requirements Coverage Validation

**Functional Requirements Coverage:** All 5 FR categories (FR-1 to FR-13) map to specific files. FR-3 specifically was a genuine gap, now closed above. FR-6's embedded-wallet onboarding path is handled by `lib/wallet-kit.ts`; Open Question 1 (Privy/DFNS capability) resolved positively on 2026-09-20, after this validation was written, so the primary path is now confirmed, with the manual pre-step retained as a fallback, not an open unknown.

**Non-Functional Requirements Coverage:**
- Non-custodial invariant: enforced structurally (no file holds a key) and at the type level (`ValidatedTransactionXDR`).
- Upstream availability transparency: covered by the interim monitoring commitment (Step 4), still gated on PRD Open Question 10's full threat model, honestly flagged as deferred, not silently dropped.
- Signature-window UX: covered by `SignatureCountdown.tsx` and the graceful-rebuild pattern already locked in the UX spec.
- Independent auditability: covered by the explicit Redis-unavailable fallback to direct Horizon/DeFindex queries (Step 4).

### Implementation Readiness Validation

**Decision Completeness:** Every version-sensitive decision (Next.js 16.3.x, TanStack Query v5, Upstash Redis) was verified live, not assumed, at the step it was made. The one previously-unspecified security mechanism (the nonce protocol) now has a concrete, implementable design.

**Structure Completeness:** The directory tree is concrete and complete, with explicit rationale for what's deliberately absent (`prisma/`, a root `tests/` folder).

**Pattern Completeness:** All 5 conflict-point categories from Step 5 are addressed, and the enforcement mechanisms themselves (branded types, explicit return-type annotations, the nonce header format) were verified to actually hold, not just asserted.

### Gap Analysis Results

**Critical Gaps:** None remaining. The three gaps found (state-type flattening, FR-3's missing file assignment, the unspecified nonce protocol) were all critical, since each would have caused real agent-to-agent implementation conflicts, and all three are now resolved directly in their originating sections.

**Important Gaps:** None outstanding beyond what is already honestly tracked elsewhere: PRD Open Question 10's full threat model (now resolved, see `docs/threat-model.md`), PRD Open Question 1's onboarding-path fork (resolved 2026-09-20, DFNS confirmed as the embedded-wallet path), and PRD Open Question 7's embed-partner CSP/WalletConnect verification (still open, but no longer scheduled against THORWallet specifically since that partnership was deprioritized 2026-09-20). All deliberately deferred with stated rationale, not silently missing.

**Nice-to-Have Gaps:** None identified that would materially change implementation readiness.

### Validation Issues Addressed

All three issues found during this validation pass were corrected directly in their originating sections (Step 4 Authentication & Security, Step 5 Communication Patterns, Step 6 Requirements to Structure Mapping) rather than only noted here, so the document stays internally consistent for an implementing agent reading any single section on its own.

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High. Every version-sensitive decision was verified live, every custom component and user journey from the UX spec has a concrete file home, and every gap this validation pass actually found (three, across two elicitation rounds) was fixed in place, not just logged.

**Key Strengths:**
- The signing boundary (AC #4) is enforced at the TypeScript type level, not left to convention.
- The correlation-layer's read authorization now has a concrete, stateless protocol, not just an asserted mechanism.
- Every open question this document depends on is honestly cross-referenced to the PRD rather than silently assumed resolved.
- The correlation layer's failure path (Redis unavailable) is an explicit architectural commitment, not an implied consequence.

**Areas for Future Enhancement:**
- ~~The full threat model and monitoring plan (PRD Open Question 10) still needs its own dedicated pass before SCF tranche #2.~~ Done: see `docs/threat-model.md`, completed 2026-09-13.
- The chosen embed partner's CSP and WalletConnect origin allowlist need live verification once that partnership itself is confirmed. THORWallet was the original target here but was deprioritized 2026-09-20 (PRD Open Question 7), so this verification now waits on a future partner being identified, not on THORWallet specifically.

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented.
- Use implementation patterns consistently across all components, especially the two distinct status union types and the exact nonce header format now defined in this document.
- Respect project structure and boundaries, especially the validation-before-signing chain enforced by `ValidatedTransactionXDR`.
- Refer to this document for all architectural questions.

**First Implementation Priority:**
```bash
npx create-next-app@latest zephyroute --typescript --app --no-tailwind --src-dir --import-alias "@/*"
```
