import { describe, expect, it } from "vitest";
import { mergePublicationRequests, projectAuthoritativePublications, projectPortalReadModel, type PortalReadModelResponse } from "../hooks/usePortalReadModel";
import type { AuthoritativePublication } from "../services/portalPublicationPersistence";

const response: PortalReadModelResponse = { transactions: [
    { id: "REC-2026-00000003", name: "Project Keystone", status: "Active", owningExternalOrganizationId: "TEST-BROKER-ORG", createdAt: "2026-08-18", packages: [{
        id: "pkg-3", sourcePackageId: "sub-3", name: "Project Keystone", fileName: "Keystone.xlsx",
        status: "Awaiting Review", requestCount: 2, submittedAt: "2026-08-18", submittedBy: { id: "real-user", name: "Jeremy", email: "j@example.com" },
        requests: [
            { rowNumber: 1, category: "Legal", title: "Contracts", description: "All", team: "Legal", owner: null, priority: "High", dueDate: null, communityNames: [] },
            { rowNumber: 2, category: "Finance", title: "Rent roll", description: "Current", team: "Finance", owner: null, priority: "Medium", dueDate: null, communityNames: [] },
        ],
    }] },
    { id: "REC-2026-00000004", name: "Project Keystone", status: "Active", owningExternalOrganizationId: "TEST-BROKER-ORG", createdAt: "2026-08-18", packages: [] },
] };

describe("authoritative external portal read projection", () => {
    it("replaces the submitted row by its server-provided intake identity without merging similar titles", () => {
        const submitted = projectPortalReadModel(response).requests;
        const publication = { id: "edition", workItemId: "work", requestId: "DD-2026-00000178", status: "Published",
            sourceIntakeRequestKey: submitted[0].id, artifacts: [] } as unknown as AuthoritativePublication;
        const rows = mergePublicationRequests(submitted, [publication]);
        expect(rows.map(row => row.id)).toEqual(["work", submitted[1].id]);
    });
    it("preserves duplicate transaction names by REC identity and aggregates durable counts", () => {
        const model = projectPortalReadModel(response);
        expect(model.transactions.map(row => row.id)).toEqual(["REC-2026-00000003", "REC-2026-00000004"]);
        expect(model.transactions[0].totalRequests).toBe(2);
        expect(model.transactions[1].totalRequests).toBe(0);
        expect(model.packages).toHaveLength(1);
        expect(model.requests).toHaveLength(2);
    });

    it("never dedupes by title or display request number and tolerates SQL GUID casing", () => {
        const submitted = projectPortalReadModel(response).requests;
        const publication = { id: "edition", workItemId: "work", requestId: submitted[1].requestId,
            title: submitted[1].title, transactionId: "another-transaction", status: "Published",
            sourceIntakeRequestKey: submitted[0].id.toUpperCase(), artifacts: [] } as unknown as AuthoritativePublication;
        expect(mergePublicationRequests(submitted, [publication]).map(row => row.id)).toEqual(["work", submitted[1].id]);
        expect(mergePublicationRequests(submitted, [{ ...publication, sourceIntakeRequestKey: null }])).toHaveLength(3);
    });

    it("projects truthful submitted state and trusted real identity without demo leakage", () => {
        const [request] = projectPortalReadModel(response).requests;
        expect(request).toMatchObject({ transactionId: "REC-2026-00000003", status: "Submitted", _rawStatus: "Submitted", orgId: "TEST-BROKER-ORG", userName: "Jeremy" });
        expect(JSON.stringify(request)).not.toMatch(/Morgan Blake|Atlas Capital|Summit|Harbor/);
    });

    it("filters deterministically by transaction ID rather than duplicate display name", () => {
        const model = projectPortalReadModel(response);
        expect(model.requests.filter(row => row.transactionId === "REC-2026-00000003")).toHaveLength(2);
        expect(model.requests.filter(row => row.transactionId === "REC-2026-00000004")).toHaveLength(0);
    });

    it("projects only server-returned authoritative publications into partner review state", () => {
        const requests = projectAuthoritativePublications([{
            id: "publication-1", workItemId: "work-1", publicationNumber: 1, status: "Published",
            externalOrganizationId: "TEST-BROKER-ORG", publishedAt: "2026-09-09T12:00:00Z",
            partnerActionAt: null, partnerGuidance: null, version: "0x0000000000000001",
            requestId: "DD-2026-00000044", title: "Government correspondence", description: "Review",
            transactionId: "REC-2026-00000005", transactionName: "Project Keystone",
            workItemStatus: "Waiting Partner Review", artifacts: [{ id: "artifact-1", fileName: "Corp Gov Docs.pptx", contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }],
        }]);
        expect(requests).toEqual([expect.objectContaining({ id: "work-1", requestId: "DD-2026-00000044", status: "Waiting Partner Review", _publishedExternal: true, orgId: "TEST-BROKER-ORG" })]);
    });

    it("projects durable partner outcomes without erasing publication identity", () => {
        const base: Omit<AuthoritativePublication, "status" | "partnerGuidance"> = { id: "publication-1", workItemId: "work-1", publicationNumber: 1,
            externalOrganizationId: "TEST-BROKER-ORG", publishedAt: "2026-09-09T12:00:00Z",
            partnerActionAt: "2026-09-10T12:00:00Z", version: "0x0000000000000002",
            requestId: "DD-2026-00000044", title: "Report", description: "Review", transactionId: "REC-2026-00000005",
            transactionName: "Project Keystone", artifacts: [], workItemStatus: "Completed" };
        expect(projectAuthoritativePublications([{ ...base, status: "Approved", partnerGuidance: null }])[0]).toMatchObject({ status: "Completed", _partnerDecision: "Approved" });
        expect(projectAuthoritativePublications([{ ...base, status: "Rework Requested", partnerGuidance: "Revise" }])[0]).toMatchObject({ status: "Needs Rework", _partnerDecision: "Rework Required" });
    });
});
