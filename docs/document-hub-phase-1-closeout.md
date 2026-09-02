# Document Hub Phase 1 Closeout

## Status

**FORMALLY ACCEPTED / COMPLETE**

Date: September 2, 2026

## Purpose

Document Hub is the shared IntegraIQ document and Artifact platform. It provides trusted document intake, business metadata, discovery, lifecycle control, and authoritative SharePoint-backed storage for direct use and reuse by business modules.

## Phase 1 capabilities

- Provide Documents to Working or Knowledge, with Project, Legal, and Operational Work Areas for Working documents.
- Capture and edit optional document title, type, business topic, origin, and description metadata.
- Find documents through immediate browsing, search, filters, sorting, pagination, and a details drawer.
- Download from the authoritative Active placement with stored physical identity validation.
- Move through verified copy or recovery, destination activation, source retraction, retry protection, and lifecycle auditing.
- Remove from Document Hub through logical removal, optional reason capture, Find and download exclusion, and auditing.
- Enforce internal access and separate read roles from lifecycle and metadata write roles on the server.
- Integrate with configured SharePoint sites and libraries through Microsoft Graph while keeping Graph identities out of browser responses.

## Production acceptance evidence

Production acceptance exercised the complete Provide, Find, Download, Edit, Move, recovery, and Remove workflows.

The representative Office recovery case began in Knowledge. An attempted Move to Operational work created a transformed Office destination but failed safely before authority changed. The Pending operation and Active source were retained. A request for a different Legal destination was rejected, while a later request for the same Operational destination resumed the original operation without depending on browser key retention. Operations became Active, Knowledge became Retracted, and `ArtifactMoved` retained the original lifecycle correlation.

The representative removal case began in Working / Projects. Remove from Document Hub accepted an optional acceptance-test reason, removed the document from normal Find and download availability, retained the underlying SharePoint file, changed the Artifact lifecycle to Removed, and recorded `ArtifactRemoved`.

No credentials, physical identities, content hashes, or production record identifiers are part of this closeout record.

## Accepted lifecycle contract

### Artifact source identity

The Artifact records the immutable identity of the originally submitted bytes, including original filename, size, and content hash. Metadata and lifecycle operations do not rewrite that identity.

### ArtifactPlacement stored identity

Each placement records the physical identity observed at its SharePoint location. This permits a verified Office representation to differ physically from the submitted source while preserving both identities truthfully.

### Move

Move is a verified copy-or-recovery operation followed by an authoritative placement transition. At most one Active and one Pending placement may exist for an Artifact. The source remains authoritative until the destination is observed and verified. A matching Pending destination resumes; a different destination conflicts safely.

### Historical source placement

After Move, the former placement is Retracted and its physical SharePoint file is retained under the Phase 1 non-destructive policy. Normal Document Hub reads use only the authoritative Active placement.

### Remove from Document Hub

Remove is logical removal from normal IntegraIQ availability. The Artifact no longer appears in normal Find results and cannot be downloaded through Document Hub. The physical SharePoint file is retained for audit and recovery.

## Deferred by design

These are planned product decisions or later capabilities, not Phase 1 gaps:

- governed physical archive or retirement of historical copies;
- an optional generic Working destination;
- governed external Document Hub publishing;
- institutional intelligence and “What We Know.”

## Non-blocking closeout findings

- Metadata vocabulary loading can fail silently, leaving empty optional controls without a warning or retry.
- A receipt-less upload is deliberately not adopted automatically and requires governed support reconciliation.
- Removing or moving the last result on a later page may leave the user beyond the new final page.
- SharePoint destination configuration has production-oriented defaults instead of environment-specific fail-closed validation.
- Lifecycle support and reconciliation guidance was limited; the companion runbook establishes the Phase 1 baseline.
