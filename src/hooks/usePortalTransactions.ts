import { useCallback, useEffect, useState } from "react";
import { useCurrentUser } from "./useCurrentUser";
import { isExternalOnlyRole } from "../utils/accessRouting";
import { getPortalTransactions, registerAuthoritativePortalTransaction } from "../services/portalMockData";
import type { ExternalTransaction, PortalTransaction } from "../services/portalMockData";
import { listAuthoritativeRecapTransactions } from "../services/portalPackagePersistence";
import type { AuthoritativePortalTransaction } from "../services/portalPackagePersistence";

function toPortalTransaction(transaction: ExternalTransaction): PortalTransaction {
    return {
        id: transaction.id,
        businessTransactionId: transaction.businessTransactionId,
        name: transaction.name,
        description: transaction.description,
        status: transaction.status,
        sellerName: "",
        buyerName: "",
        brokerName: "",
        targetClose: "",
        totalRequests: 0,
        providedCount: 0,
        inProgressCount: 0,
        clarificationNeededCount: 0,
        communities: [],
        recoverablePackage: transaction.recoverablePackage,
    };
}

export function usePortalTransactions() {
    const { user } = useCurrentUser();
    const isRealExternal = isExternalOnlyRole(user?.userRecord?.role);
    const [authoritative, setAuthoritative] = useState<PortalTransaction[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);

    const addAuthoritative = useCallback((transaction: AuthoritativePortalTransaction) => {
        const projected = registerAuthoritativePortalTransaction(transaction);
        if (!projected) return null;
        const portalTransaction = toPortalTransaction(projected);
        setAuthoritative(current => current.some(row => row.id === portalTransaction.id)
            ? current
            : [portalTransaction, ...current]);
        return projected;
    }, []);

    useEffect(() => {
        if (!isRealExternal) return;
        let cancelled = false;
        listAuthoritativeRecapTransactions()
            .then(transactions => {
                if (cancelled) return;
                const projected = transactions
                    .map(registerAuthoritativePortalTransaction)
                    .filter((row): row is ExternalTransaction => !!row)
                    .map(toPortalTransaction);
                setAuthoritative(projected);
                setLoadError(null);
            })
            .catch(error => {
                if (!cancelled) setLoadError(error instanceof Error ? error.message : "Transaction listing failed");
            });
        return () => { cancelled = true; };
    }, [isRealExternal]);

    return {
        transactions: isRealExternal ? authoritative : getPortalTransactions(),
        isRealExternal,
        loadError,
        addAuthoritative,
    };
}
