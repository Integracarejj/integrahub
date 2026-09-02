# Artifact Lifecycle Support Runbook

This runbook covers safe Phase 1 diagnosis. It does not authorize database writes or SharePoint modification.

## Pending Move

A Pending placement means a Move started but its destination has not yet become authoritative. The existing Active placement remains the source of truth until completion.

- A request for the same destination and Work Area resumes the existing operation, even if the browser supplies a new request key.
- The Pending placement's original operation key remains the lifecycle correlation identity.
- A request for a different destination or Work Area returns an expected conflict, normally HTTP 409.
- Do not manually create, update, or delete placement rows.
- Do not manually delete, move, or rename either SharePoint file.

Use the following read-only query in an approved database client and bind `@artifactId` as a query parameter:

```sql
SELECT id, originalFileName, ingestionState, lifecycleState,
       storageDestination, libraryKey, createdAt, updatedAt
FROM cmdb.Artifacts
WHERE id = @artifactId;

SELECT id, artifactId, placementType, placementStatus, siteKey,
       legacyLibraryKey, siteId, driveId, itemId,
       storedContentSize, storedContentSha256, storedObservedAt,
       operationKey, activatedAt, retiredAt, createdAt, updatedAt
FROM cmdb.ArtifactPlacements
WHERE artifactId = @artifactId
ORDER BY createdAt, id;

SELECT eventType, correlationId, detailsJson, createdAt
FROM cmdb.ArtifactEvents
WHERE artifactId = @artifactId
ORDER BY createdAt, id;
```

Treat Graph item identifiers and content hashes as restricted diagnostic data. Do not paste them into general chat, tickets, or screenshots unless the approved support process requires them.

## Receipt-less upload durable state

SharePoint can accept an upload immediately before SQL receipt persistence fails. On retry, Document Hub may find the deterministic filename but intentionally refuse to bind that unverified item to the Artifact. Phase 1 fails closed because filename equality alone is not sufficient authority.

This state requires governed support or reconciliation. Do not repeatedly upload replacements, bind an arbitrary SharePoint item, or edit database identity fields manually. Gather evidence and escalate.

## Common HTTP responses

- **409 Conflict:** an expected validation, integrity, idempotency, or lifecycle conflict. Read the sanitized response and inspect placement state before retrying with changed inputs.
- **502 Bad Gateway:** Microsoft Graph authentication or SharePoint operation failed. Confirm dependency health and use safe telemetry fields.
- **503 Service Unavailable:** configuration, placement reconciliation, dependency, or durable partial-operation state may require retry or support attention. The exact response message determines the applicable case.
- **500 Internal Server Error:** unexpected application defect. Preserve the timestamp and correlation evidence and escalate; do not attempt data repair from the UI symptom alone.

These categories summarize the Artifact route behavior; they do not imply that every response with the same status has the same cause.

## Physical retention

- Move may leave a historical physical copy visible in the former SharePoint library.
- A Retracted placement is historical and is ignored by normal Document Hub reads.
- Remove from Document Hub retains the physical SharePoint file while excluding the Artifact from normal Find and download behavior.
- Do not delete retained files merely because they are no longer authoritative in Document Hub.

## Support escalation evidence

Gather only what is necessary:

- Artifact ID and original filename;
- timestamp and user-visible message;
- request endpoint and HTTP status;
- safe Application Insights exception name, message, operation correlation, and lifecycle stage;
- read-only Artifact, placement, and event state;
- whether the expected SharePoint item exists, checked through an approved read-only process.

Never include credentials, access tokens, connection strings, file contents, or unrelated user data. Record all proposed corrective actions for review before any database or SharePoint write.
