# IntegraIQ Backlog

This is the canonical lightweight repository backlog for product ideas and requests. Update existing records instead of creating duplicate IDs. Planning dates are targets, not contractual deadlines.

## Classification and status

Classes: **BUG**, **MVP BLOCKER**, **HIGH PRIORITY**, **BACKLOG**, **PARKING LOT**.

Statuses: **Captured**, **Planned**, **In Progress**, **Done**, **Deferred**, **Rejected**.

## Backlog

| ID | Title | Area | Class | Priority | Status | Target Phase | Problem / Value | Notes |
|---|---|---|---|---|---|---|---|---|
| IQ-001 | What We Know / institutional intelligence | IntegraIQ Intelligence / Cross-module | HIGH PRIORITY | P1 | Captured | Post-Recap MVP / Phase 2 design | Institutional knowledge is repeatedly rediscovered instead of reused. | Knowledge must be governed context, not merely a Note on one Artifact. Scope may include ownership group, document type, business topic, process, community, or transaction. Preserve provenance, confidence, and last-confirmed date; anecdote must not silently become universal fact. Example: vehicle registration work may surface related title practices, responsible contacts, and prior experience across Document Hub, Recap, Acquisitions, and future modules. Potential label: **What We Know**. |
| IQ-002 | Governed physical retirement / archive | Document Hub / Artifact Lifecycle | HIGH PRIORITY | P2 | Deferred | Post-Phase 1 lifecycle enhancement | Move currently retains a historical copy in the prior SharePoint library. | Target verified destination → authority transition → explicit retryable archive/retirement, preserving audit, recovery, retention, and legal holds. Permanent deletion is not the preferred design. |
| IQ-003 | Receipt-less upload reconciliation | Document Hub / Operations | HIGH PRIORITY | P1 | Captured | Post-Phase 1 operations | SharePoint may accept an upload while SQL receipt persistence fails; Phase 1 safely fails closed but requires support. | Design a governed reconciliation/admin workflow. Never bind arbitrary items based only on filename. |
| IQ-004 | Metadata vocabulary failure UX | Document Hub | BACKLOG | P2 | Captured | Post-Phase 1 | Metadata option load failure is silent. | Add a visible warning and retry while preserving optional metadata behavior. |
| IQ-005 | Pagination clamp after result reduction | Document Hub | BACKLOG | P2 | Captured | Post-Phase 1 | Move or removal of the final item on a later page can leave the user beyond the last valid page. | Clamp or navigate after authoritative refresh. |
| IQ-006 | Deployment-time SharePoint destination validation | Platform / Operations | HIGH PRIORITY | P1 | Captured | Platform hardening | Destination overrides have production-oriented defaults, increasing environment-drift risk. | Add environment-specific startup or deployment validation that fails closed. |
| IQ-007 | Optional generic Working destination | Document Hub | BACKLOG | P3 | Deferred | Future design | Working currently requires Project, Legal, or Operational because each routes to a distinct library. | Requires a generic Working library plus deliberate schema, routing, configuration, and UX changes. |
| IQ-008 | External Document Hub availability | Document Hub / External | BACKLOG | P3 | Deferred | Future governed capability | External availability requires policy, authorization, publishing, and lifecycle design. | Do not implement as a simple destination toggle. |
| IQ-009 | Acquisitions module | Business Module | BACKLOG | P2 | Captured | October/November planning | Acquisitions needs a workflow foundation without duplicating platform services. | Reuse IntegraIQ identity, Artifact, metadata, and lifecycle capabilities where appropriate. |
| IQ-010 | Recap MVP completion | Recapitalization | MVP BLOCKER | P0 | In Progress | September 2026 | Complete the frozen, durable workflow from external intake through authoritative approval. | Seven Big Rocks: workflow/authorization freeze; internal workflow persistence; publication/published-document contract; partner decision/rework; remove prototype workflow state; security/API hardening; production acceptance. Contract: `docs/recap-mvp-contract.md`. |
| IQ-011 | Document Hub Phase 1 | Document Hub | HIGH PRIORITY | P1 | Done | Maintain only | Accepted shared Artifact capability; protect stable production behavior. | Closed September 2, 2026. Do not reopen during Recap MVP absent a concrete integration dependency or production defect. |

## How New Ideas Become Work

New ideas are welcome and should be captured, but **capture is not a commitment to build**.

Every request is first classified as BUG, MVP BLOCKER, HIGH PRIORITY, BACKLOG, or PARKING LOT. Only bugs that threaten accepted functionality and blockers for the current MVP should normally interrupt the active workstream. High-priority ideas remain visible but wait for the current finish line unless the owner explicitly reprioritizes them. Any change to active priority must be deliberate and recorded in this file or the governing delivery record.

## Current priority roadmap

Active priority: **P0 — Recap MVP Completion**.

| Target | Priority | Workstream |
|---|---|---|
| September 2, 2026 | Done / maintain only | Document Hub Phase 1 closeout |
| September 4–8, 2026 | P0 | Recap Big Rock 1: workflow and authorization freeze |
| September 8–25, 2026 | P0 | Recap Big Rocks 2–6: authoritative MVP completion and hardening |
| September 28–October 2, 2026 | P0 | Recap production acceptance |
| October 5–16, 2026 | P1 | Recap pilot and stabilization |
| October 2026 | P1 | What We Know design and initial proof of concept after Recap MVP is stable |
| October/November 2026 | P2 | Acquisitions planning and foundation using shared platform capabilities |
| Later | P2+ | Governed physical retirement/archive, optional generic Working, external Document Hub capability, and other backlog enhancements |

Strategic success target for early October:

> Document Hub v1.0 is complete and Recapitalization MVP is complete as an end-to-end business workflow.

## Active Recap scope freeze

Until Recap MVP production acceptance, work may interrupt the active sequence only when it is a reproducible bug affecting accepted/current functionality or is required to complete, secure, persist, audit, or recover the frozen Recap workflow. Capture all other ideas here without treating capture as a commitment to build. Document Hub Phase 1 is done and maintain-only. What We Know remains high priority after stable Recap MVP; Acquisitions remains future/P2.
