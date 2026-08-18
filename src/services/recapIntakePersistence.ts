import { getAuthHeaders } from "../utils/apiFetch";
import type { RecapIntakeItem, RecapRequest } from "./recapMockData";
import { addPortalCreatedIntakeItem, addPortalCreatedRequests, getPortalCreatedIntakeItems, getPortalCreatedRequests } from "./recapDataService";

interface AuthoritativePackage {
    id: string; sourcePackageId: string; packageName: string; fileName: string;
    requestCount: number; status: RecapIntakeItem["status"];
    submittedBy: string; submittedByName: string; submittedByEmail?: string;
    externalOrganizationId: string; submittedAt: string;
    transactionId: string; transactionName: string;
    requests: Array<{ rowNumber: number; category: string; title: string; description: string; team: string; owner: string | null; priority: RecapRequest["priority"]; dueDate?: string; communityNames: string[] }>;
}

export async function loadAuthoritativeIntake(): Promise<number> {
    const response = await fetch("/api/recapitalization/intake", { credentials: "include", headers: getAuthHeaders() });
    if (!response.ok) throw new Error("Intake listing failed");
    const packages: AuthoritativePackage[] = (await response.json()).packages || [];
    const existingPackages = new Set(getPortalCreatedIntakeItems().map(item => item.id));
    const existingRequests = new Set(getPortalCreatedRequests().map(request => request.id));
    for (const pkg of packages) {
        const intakeId = `intake-${pkg.id}`;
        if (!existingPackages.has(intakeId)) addPortalCreatedIntakeItem({
            id: intakeId, intakeId, packageId: intakeId, packageName: pkg.packageName,
            fileName: pkg.fileName, type: "Broker Upload", status: pkg.status,
            title: pkg.packageName, description: `Package uploaded via external portal containing ${pkg.requestCount} DD request items.`,
            transactionId: pkg.transactionId, transactionName: pkg.transactionName,
            submittedBy: pkg.submittedByName || pkg.submittedByEmail || pkg.submittedBy,
            submittedAt: pkg.submittedAt, assignedTo: null, communityNames: [], priority: "High",
            orgId: pkg.externalOrganizationId, orgName: pkg.externalOrganizationId,
            userId: pkg.submittedBy, userName: pkg.submittedByName || pkg.submittedByEmail,
            rowsFound: pkg.requestCount,
        });
        const additions: RecapRequest[] = pkg.requests.filter(row => !existingRequests.has(`intake-request-${pkg.id}-${row.rowNumber}`)).map(row => ({
            id: `intake-request-${pkg.id}-${row.rowNumber}`,
            requestId: `DD-${pkg.sourcePackageId}-${row.rowNumber}`,
            intakeId, transactionId: pkg.transactionId, transactionName: pkg.transactionName,
            brokerBuyer: pkg.externalOrganizationId, communityIds: [], communityNames: row.communityNames,
            category: row.category, title: row.title, description: row.description,
            owner: row.owner, team: row.team, status: "Open", priority: row.priority,
            dueDate: row.dueDate ? String(row.dueDate).slice(0, 10) : "",
            lastUpdated: String(pkg.submittedAt).slice(0, 10), externalVisible: true,
            submittedBy: pkg.submittedByName || pkg.submittedByEmail || pkg.submittedBy,
            source: "External", createdDate: String(pkg.submittedAt).slice(0, 10), assignedTo: row.owner,
            orgId: pkg.externalOrganizationId, orgName: pkg.externalOrganizationId,
            userId: pkg.submittedBy, userName: pkg.submittedByName || pkg.submittedByEmail,
            _sourcePackageId: intakeId, _sourcePackageName: pkg.packageName,
            _sourceFileName: pkg.fileName.replace(/\.[^.]+$/, ""), _publishedAt: null,
        }));
        if (additions.length) addPortalCreatedRequests(additions);
    }
    return packages.length;
}
