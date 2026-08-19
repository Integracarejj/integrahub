import { describe, expect, it } from "vitest";
import { projectPortalReadModel, type PortalReadModelResponse } from "../hooks/usePortalReadModel";

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
    it("preserves duplicate transaction names by REC identity and aggregates durable counts", () => {
        const model = projectPortalReadModel(response);
        expect(model.transactions.map(row => row.id)).toEqual(["REC-2026-00000003", "REC-2026-00000004"]);
        expect(model.transactions[0].totalRequests).toBe(2);
        expect(model.transactions[1].totalRequests).toBe(0);
        expect(model.packages).toHaveLength(1);
        expect(model.requests).toHaveLength(2);
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
});
