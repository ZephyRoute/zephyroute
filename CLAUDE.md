# CLAUDE.md — Zephyroute

Project-level instructions for Claude Code when working in this repository. This file governs engineering standards once implementation begins; product/architecture decisions live in `docs/` (`docs/prds/prd-stellar-intents-gateway-2026-08-25/prd.md`, `addendum.md`, `docs/architecture.md`, `docs/ux-design-specification.md`).

## Style Rules (non-negotiable)

- **No em dash (—) anywhere in generated content** — code, comments, commit messages, documentation, UI copy, chat replies written to files. Use a period, comma, colon, semicolon, or parentheses instead, depending on what the sentence needs.
- Commit messages follow the user's global rules (Conventional Commits, one line, English, no Claude/Anthropic attribution) — see `~/.claude/CLAUDE.md`; not repeated here to avoid drift between the two files.

## Acceptance Criteria — Security

1. **Non-custodial invariant.** No component may ever hold, request, cache, or log a private key, seed phrase, or mnemonic, at any layer, under any circumstance. This is the project's defining architectural property (PRD §10), not a preference.
2. **No secrets in the repo.** API keys (1Click, DeFindex), integrator credentials, and any other secret live in environment variables only; `.env` files are git-ignored, never committed, never hardcoded.
3. **Validate every external response before use.** Amounts, addresses, and status fields returned by 1Click, DeFindex, or Horizon must be checked against what was requested (`minAmountOut`, destination address, expected asset) before being displayed or acted on; never trust an API response blindly.
4. **Review before signing.** Any transaction presented for a user's signature (swap confirmation, DeFindex `deposit()` XDR) must have its destination, amount, and parameters verified by the code that built it before the signature prompt is shown; never construct a signable XDR from unvalidated input.
5. **No silent failure.** A failed request, an expired Soroban authorization window, or a degraded upstream (1Click, DeFindex) must always surface visibly to the user. Catching an error and swallowing it without surfacing it is forbidden; this directly enforces the "Upstream availability transparency" and "Signature-window UX" NFRs already defined in the PRD (§10).

## Acceptance Criteria — Quality

6. **TypeScript strict mode**, project-wide. `any` requires an inline comment justifying why no narrower type is possible.
7. **Tests required for transaction-building code.** Any function that constructs or submits a swap quote request or a DeFindex deposit XDR needs an accompanying test before merge; these are the two places a bug directly risks user funds or a stuck flow.
8. **No new Soroban contract without justification.** Before introducing any proprietary Soroban contract, the PR description must document which existing Stellar Integration List building block was evaluated and found insufficient. This is Rule #3 of the project's 10 master rules, already audited clean in `addendum.md` §I. Zephyroute's v1 architecture (Architecture A′) intentionally has zero proprietary contracts.
9. **Independent auditability.** Every completed (or partially completed) user flow must remain reconstructable from public on-chain/API data alone (Horizon, 1Click integrator records, DeFindex vault state). Any local database or cache is a convenience layer, never the source of truth, with the single narrow exception already documented in `docs/architecture.md`'s Integration Coupling Map (the address-correlation layer joining 1Click settlement to DeFindex deposits for attribution).

## Notes

- This file will grow as implementation decisions are made in later steps of the `create-architecture` workflow (patterns, structure) and once `dev-story`/`elliot-dev` begin producing code.
- No code had been written as of this file's creation (2026-08-26), the project was still in the documentation/architecture phase then. Implementation began 2026-09-21, once the full documentation set (PRD, UX spec, architecture, epics, threat model, and an SCF Interest Form draft) was complete and the founder explicitly authorized starting Epic 1.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
