# Recap MVP Contract

## Purpose and scope freeze

Recap MVP is one secure, durable due-diligence workflow from external intake through authoritative external approval. Until production acceptance, work may interrupt the active delivery sequence only when it is a reproducible bug affecting accepted/current functionality or is required to complete, secure, persist, audit, or recover this frozen workflow. Other ideas belong in the canonical backlog; capture is not a commitment to build.

## Frozen end-to-end workflow

External transaction and package intake -> internal intake -> admission -> assignment -> owner acceptance -> DD work -> DD Operations review -> return and resubmit when needed -> Ready to Publish -> Publish External -> partner review -> rework and republish when needed -> partner approval.

Every authoritative state and material decision must survive refresh, logout/login, another browser, and service restart. Browser storage is never authoritative.

## State model

### Currently implemented

The authoritative `RecapWorkItems.status` values are `Queued`, `Assigned`, `In Progress`, `Needs DD Review`, and `Ready to Publish`.

### Target required for MVP

Add only these top-level states where the workflow must stop, route, or authorize differently:

- `Clarification Needed` — owner has requested guidance; return routing is retained.
- `Blocked` — work cannot continue until an identified blocker is resolved.
- `Waiting Partner Review` — an authoritative publication is active externally.
- `Needs Rework` — the partner rejected the active publication with a required comment.
- `Approved` — terminal partner-approved outcome.
- `Not Applicable` — terminal approved exception outcome.
- `Duplicate` — terminal approved exception outcome linked to the surviving request where applicable.

`Published External` is a publication/event concept, not a second work-item status. Rework submission is an event and review transition, not a permanent status. Closed is the business meaning of terminal `Approved`, `Not Applicable`, or `Duplicate`; a redundant `Closed` work-item state is not required.

## Transition matrix

| From | Action | To | Authority |
|---|---|---|---|
| Intake request | Admit | Queued | DDTeam, PlatformAdmin |
| Queued | Assign | Assigned | DDTeam, PlatformAdmin |
| Assigned | Reassign | Assigned | DDTeam, PlatformAdmin |
| Assigned | Accept | In Progress | Assigned owner |
| Assigned / In Progress | Not Mine | Queued | Assigned owner; DDTeam or PlatformAdmin override |
| In Progress | Need Clarification | Clarification Needed | Assigned owner |
| Clarification Needed | Provide/route guidance | In Progress | DDTeam or PlatformAdmin |
| In Progress | Block | Blocked | Assigned owner |
| Blocked | Resolve | In Progress | DDTeam or PlatformAdmin |
| In Progress | Recommend exception | Needs DD Review | Assigned owner; decision and reason retained |
| In Progress | Submit DD review | Needs DD Review | Assigned owner |
| Needs DD Review | Return | In Progress | DDTeam, PlatformAdmin |
| Needs DD Review | Approve review | Ready to Publish | DDTeam, PlatformAdmin |
| Needs DD Review | Approve exception | Not Applicable / Duplicate | DDTeam, PlatformAdmin; no separate external confirmation in MVP |
| Ready to Publish | Publish selected result | Waiting Partner Review | DDTeam, PlatformAdmin |
| Waiting Partner Review | Request Rework | Needs Rework | Authorized user in owning external organization |
| Needs Rework | Begin/accept rework | In Progress | Assigned owner |
| Waiting Partner Review | Approve | Approved | Authorized user in owning external organization |

Invalid transitions must fail atomically at the server. Reassignment retains the current workflow state unless the frozen transition explicitly resets it.

## Persona and authorization matrix

| Capability | Viewer | Editor | Assigned owner | DDTeam | PlatformAdmin | External user |
|---|---:|---:|---:|---:|---:|---:|
| Read appropriate internal Recap data | Yes | Yes | Yes | Yes | Yes | No |
| Admit intake | No | No | No | Yes | Yes | No |
| Assign/reassign | No | No | No | Yes | Yes | No |
| Accept and perform owner work | No | Only when owner | Yes | Only when owner | Only when owner | No |
| Request Not Mine/clarification/blocker | No | Only when owner | Yes | Override where defined | Override where defined | No |
| DD review/return/Ready to Publish | No | No | No | Yes | Yes | No |
| Publish externally | No | No | No | Yes | Yes | No |
| View/decide externally | No | No | No | Portal access only | Portal access only | Owning organization only |

Server authorization is authoritative. UI visibility and capabilities must reflect the same policy and never substitute for it.

## Exception paths

Need Clarification, Blocked, Not Applicable, Duplicate, and Not Mine remain in MVP. Each needs only its reason or comment where applicable, actor, timestamp, resulting state, routing identity, and audit event. Big Rock 2 owns their persistence; no generalized workflow engine is authorized.

## Document and artifact decision

Recap MVP continues using `cmdb.RecapWorkArtifacts` and `cmdb.RecapWorkItemSharePointFolders` in SharePoint Working storage. It will not consolidate into shared Document Hub during MVP. Document Hub remains the accepted long-term IntegraIQ Artifact platform; consolidation is post-MVP.

Publication must later add durable artifact selection, publication history and provenance, organization-scoped visibility, and server-authorized external downloads.

## Audit and recovery requirements

Every material transition records the work item, prior and resulting state, action, actor, UTC timestamp, reason/comment when required, and related publication/decision identity. Retries must be idempotent or fail without partial state. Failures must remain diagnosable and recoverable without inventing success.

## Explicitly deferred

Deferred until after Recap MVP acceptance: shared Document Hub consolidation, What We Know, Acquisitions, generalized AI, generalized workflow engines, broad UI redesign, speculative dashboards, physical artifact retirement/archive, and optional generic Working storage.

## Definition of done

MVP is done when the frozen workflow, including one return cycle and one rework cycle, succeeds with real internal and external personas; all important authorization boundaries are independently server-enforced; published documents are organization-scoped; material actions are auditable; state recovers across sessions and restarts; failure/retry paths are proven; focused and full regressions pass; and production acceptance is recorded.
