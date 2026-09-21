---
inputDocuments:
  - docs/prds/prd-stellar-intents-gateway-2026-08-25/prd.md
  - docs/prds/prd-stellar-intents-gateway-2026-08-25/addendum.md
  - docs/epics.md
date: '2026-09-21'
purpose: 'Concrete plan for building the real traction the founder decided to pursue (PRD Open Question 14), scoping the smallest real, live thing worth shipping before or alongside an Integration Track submission.'
status: 'draft, awaiting founder go-ahead to begin implementation'
---

# Zephyroute Traction Roadmap

## Why this document exists

The founder decided (2026-09-20, PRD Open Question 14) to stay on the SCF Integration Track and make real traction an explicit goal, rather than lean solely on the "validated need" alternate path. `addendum.md` §A.3 researched what "existing traction" actually looked like for the three closest funded precedents (WOWMAX, For Yield, BIM Exchange): in every case, a real, live, even if modest product existed before applying, with Stellar added as the new integration. BIM Exchange, the closest comparable in scale, had **~$525K TVL, 20 vaults, and 160 total users** across 6 chains, not a massive operation, but a genuinely real and live one. Separately, the Ambassador Program's own tier system confirmed the same pattern: even Instawards (the smallest, fastest SCF funding mechanism) require "Builder" tier, which itself requires "deployed smart contracts, a working MVP, or contributions to an SCF-funded project."

The conclusion these findings point to, consistently, from every angle researched: **there is no path to genuine, demonstrable traction that does not involve something real being live.** Documentation alone, however thorough, cannot generate traction, by definition. This directly intersects with this project's standing rule not to begin implementation until the founder says so. That gate stays in force; this document does not cross it. What it does is remove the delay between "founder says go" and "building starts" by having the smallest correctly-scoped MVP already planned.

## The smallest real thing worth shipping

`epics.md` Epic 1 ("Returning User Signs In and Starts Earning Yield") is already scoped as exactly this: the full core loop (connect an existing Stellar wallet, request a live quote, swap, settle, sign a DeFindex deposit, confirm, resume from any device) for a user who already holds a Stellar wallet, deliberately excluding new-user embedded-wallet onboarding (Epic 2), the traction-metrics dashboard (Epic 3), and the partner-embed widget (Epic 4). Those three are genuinely secondary: none of them are required for a real user to execute a real, on-chain, attributable transaction through Zephyroute.

**12 stories, already fully specified with acceptance criteria:** project scaffolding, design tokens, accessibility/CI gates, wallet connection, live quote display, integrator-ID attribution, trustline validation, settlement execution and detection, unsigned deposit construction, signature-window handling, deposit confirmation, and cross-device resumability. Nothing here is speculative, every story traces to an FR already validated across three rounds of adversarial review this project has already been through.

**Why Epic 1 alone is the right traction-generating slice, not a compromise:**
- It produces real, independently-verifiable on-chain volume from the first successful transaction (AC #9, independent auditability), which is exactly the kind of evidence BIM Exchange's own "fully verifiable on-chain metrics" claim was built on.
- It is usable by the founder and any early real users who already hold a funded Stellar wallet, the lowest-friction real-user population to reach first, no embedded-wallet vendor integration (DFNS) required for v0.
- Every FR it implements (FR1-FR5, FR7-FR9, FR13) is already fully specified; there is no design work left to do before starting, only implementation.

## Timeline reality check

Today is 2026-09-21. SCF #46's Build Submission deadline is November 8, 2026, about 7 weeks out. The Interest Form itself has no fixed deadline (reviewed on a rolling basis) and can go in earlier or later than the full submission. Two realistic sequences, not mutually exclusive:

1. **Interest Form now, real traction building in parallel.** Nothing in the Handbook requires traction to exist at Interest Form time, only at full-application review. Submitting the Interest Form doesn't lock in a track or a deadline commitment beyond "you'll be invited to a specific round if eligible." This keeps the option open without waiting on Epic 1 to ship first.
2. **Epic 1 ships, then the full Build application is drafted with real evidence instead of projected evidence.** Given the "weeks-scale, aggressive" MVP timeline this project has targeted since its first PRD draft, Epic 1's 12 stories are a realistic multi-week build for a small team, comfortably inside the 7-week runway to the Build Submission deadline, though tight, not comfortable, if it starts late.

## What this document is not

This is not authorization to begin `dev-story` or any implementation work. It is scoping, the same category of work as everything else in `docs/`, done so that if and when the founder says to begin, the first thing built is the smallest thing that actually generates the real traction just decided on, not a guess made under time pressure at that moment.
