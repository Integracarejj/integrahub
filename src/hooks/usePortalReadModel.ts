import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "./useCurrentUser";
import { isExternalOnlyRole } from "../utils/accessRouting";
import { getPortalRequests, getPortalTransactions } from "../services/portalMockData";
import type { PortalRequest, PortalTransaction } from "../services/portalMockData";
import { getAuthHeaders } from "../utils/apiFetch";

export interface AuthoritativePortalPackage {
    id: string; sourcePackageId: string; name: string; fileName: string;
    status: string; requestCount: number; submittedAt: string;
    submittedBy: { id: string; name: string; email?: string | null };
    transactionId: string; transactionName: string;
}

export interface PortalReadModelResponse {
    transactions: Array<{
        id: string; name: string; status: string; owningExternalOrganizationId: string; createdAt: string;
        packages: Array<Omit<AuthoritativePortalPackage, "transactionId" | "transactionName"> & { requests: Array<{
            rowNumber: number; category: string; title: string; description: string;
            team: string; owner: string | null; priority: string; dueDate?: string | null; communityNames: string[];
        }> }>;
    }>;
}

export function projectPortalReadModel(response: PortalReadModelResponse) {
    const packages: AuthoritativePortalPackage[] = [];
    const requests: PortalRequest[] = [];
    const transactions: PortalTransaction[] = response.transactions.map(transaction => {
        for (const intakePackage of transaction.packages) {
            packages.push({ ...intakePackage, transactionId: transaction.id, transactionName: transaction.name });
            for (const request of intakePackage.requests) requests.push({
                id: `${intakePackage.id}-${request.rowNumber}`,
                requestId: `DD-${intakePackage.sourcePackageId}-${request.rowNumber}`,
                intakeId: intakePackage.id, transactionId: transaction.id, transactionName: transaction.name,
                title: request.title, category: request.category, status: "Submitted", priority: request.priority,
                neededBy: request.dueDate ? String(request.dueDate).slice(0, 10) : "",
                submittedAt: intakePackage.submittedAt, updatedAt: String(intakePackage.submittedAt).slice(0, 10),
                communityIds: [], communityNames: request.communityNames, owner: request.owner,
                team: request.team, brokerBuyer: transaction.owningExternalOrganizationId,
                orgId: transaction.owningExternalOrganizationId, orgName: transaction.owningExternalOrganizationId,
                userId: intakePackage.submittedBy.id, userName: intakePackage.submittedBy.name,
                _rawStatus: "Submitted", _publishedAt: null,
                _sourcePackageId: intakePackage.sourcePackageId,
                _sourcePackageName: intakePackage.name, _sourceFileName: intakePackage.fileName,
            });
        }
        const totalRequests = transaction.packages.reduce((sum, item) => sum + item.requestCount, 0);
        return {
            id: transaction.id, businessTransactionId: transaction.id, name: transaction.name,
            description: `Authoritative recap transaction ${transaction.id}`, status: transaction.status,
            sellerName: "", buyerName: "", brokerName: "", targetClose: "",
            totalRequests, providedCount: 0, inProgressCount: 0, clarificationNeededCount: 0,
            communities: [],
        };
    });
    return { transactions, packages, requests };
}

export function usePortalReadModel() {
    const { user } = useCurrentUser();
    const isRealExternal = isExternalOnlyRole(user?.userRecord?.role);
    const [response, setResponse] = useState<PortalReadModelResponse>({ transactions: [] });
    const [loading, setLoading] = useState(isRealExternal);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!isRealExternal) return;
        let cancelled = false;
        setLoading(true);
        fetch("/api/portal/recapitalization/read-model", { credentials: "include", headers: getAuthHeaders() })
            .then(async result => {
                if (!result.ok) throw new Error((await result.json().catch(() => null))?.error || "Portal data could not be loaded");
                return result.json();
            })
            .then(body => { if (!cancelled) { setResponse(body); setError(null); } })
            .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Portal data could not be loaded"); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [isRealExternal]);
    const authoritative = useMemo(() => projectPortalReadModel(response), [response]);
    return isRealExternal
        ? { ...authoritative, isRealExternal, loading, error }
        : { transactions: getPortalTransactions(), requests: getPortalRequests(), packages: [] as AuthoritativePortalPackage[], isRealExternal, loading: false, error: null };
}
