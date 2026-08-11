import fs from "node:fs";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { test, expect, gotoApp } from "./helpers/auth";
import { getFixturePaths, KEYSTONE_FILE, LIBERTY_FILE } from "./helpers/fixtures";

/**
 * Diagnostic: does the external Overview "Upload Another Package" flow route
 * Package B into a NEW (auto-created) transaction, separate from Package A?
 *
 * Setup is "clean": use the harness's real test-data reset (Settings → Wipe
 * Recapitalization Test Data). After the wipe the broker persona (Morgan Blake
 * / Atlas Capital Partners) has ZERO authorized transactions, so the Overview
 * starts in "All Transactions" mode. Each uploaded package auto-creates its
 * own transaction named after the file base name ("keystone", "liberty").
 *
 * Expected observed behavior (Jeremy's manual evidence from the real app):
 * Package B is routed to a DIFFERENT transaction than Package A — i.e. the
 * second package does NOT join the first package's transaction.
 *
 * No internal workflow steps — this runs in seconds.
 */

const PERSONA_USER_EMAIL = "broker@mail.com";

interface SubmissionRecord {
    id: string;
    fileName: string;
    packageName: string;
    status: string;
    transactionId?: string;
    transactionName: string;
    orgId?: string;
    orgName?: string;
    userId?: string;
    userName?: string;
    submittedAt: string;
    requestCount: number;
}

interface PortalSnapshot {
    persona: string | null;
    lastCreatedTransactionId: string | null;
    transactions: { id: string; name: string; orgId?: string; status?: string }[];
    transactionAccess: { transactionId: string; orgId?: string; userId?: string }[];
    submissions: SubmissionRecord[];
    authorizedTxnIds: string[];
    personaUserId: string | null;
    personaOrgId: string | null;
}

test("diagnostic: Overview Upload Another Package routes Package B to a NEW transaction", async ({ page }, testInfo: TestInfo) => {
    test.setTimeout(120_000);

    const fixtures = getFixturePaths();
    const evidence: Record<string, unknown> = {};

    try {
        /* ── 1. Start clean — real harness reset (Settings → Wipe) ── */
        await gotoApp(page, "/recapitalization/settings");
        await page.getByRole("button", { name: "Wipe Recapitalization Test Data" }).click();
        await page.locator(".rc-modal").getByRole("button", { name: "Wipe Recapitalization Test Data" }).click();
        await expect(page.getByText(/Recapitalization test data wiped/)).toBeVisible({ timeout: 15_000 });

        /* ── 2. Open the REAL external Overview ── */
        await gotoApp(page, "/portal");
        await expect(page.locator(".portal-user-name")).toContainText("Morgan Blake");
        await expect(page.locator(".portal-user-role")).toContainText("Atlas Capital Partners");
        await expect(page.getByRole("heading", { name: "Upload your due diligence request list to begin" })).toBeVisible();

        evidence.baseline = await capturePortalSnapshot(page);
        console.log("BASELINE", JSON.stringify(evidence.baseline));

        /* ── 3. Package A: keystone.xlsx ── */
        await uploadViaOverview(page, fixtures.keystone);
        evidence.afterPackageA = await capturePortalSnapshot(page);
        console.log("AFTER_A", JSON.stringify(evidence.afterPackageA));

        /* ── 4. Click the real "Upload Another Package" ── */
        await page.getByRole("button", { name: "Upload Another Package" }).click();
        await expect(page.getByRole("button", { name: "Browse Files" }).first()).toBeVisible({ timeout: 15_000 });

        /* ── 5. Package B: liberty.xlsx ── */
        await uploadViaOverview(page, fixtures.liberty);
        evidence.afterPackageB = await capturePortalSnapshot(page);
        console.log("AFTER_B", JSON.stringify(evidence.afterPackageB));

        /* ── 6. Compare + assert the observed routing ── */
        const subA = findSubmission(evidence.afterPackageA as PortalSnapshot, KEYSTONE_FILE);
        const subB = findSubmission(evidence.afterPackageB as PortalSnapshot, LIBERTY_FILE);

        expect(subA, "keystone submission missing").toBeDefined();
        expect(subB, "liberty submission missing").toBeDefined();
        expect(subA.transactionId, "Package A must record a transactionId").toBeTruthy();
        expect(subB.transactionId, "Package B must record a transactionId").toBeTruthy();

        const verdict = {
            packageA: packageIdentity(subA),
            packageB: packageIdentity(subB),
            sameTransaction: subA.transactionId === subB.transactionId,
            packageBInDifferentTransaction: subA.transactionId !== subB.transactionId,
            expected: "Package B is routed to a NEW auto-created transaction, separate from Package A",
        };
        evidence.verdict = verdict;
        console.log("VERDICT", JSON.stringify(verdict));

        expect(subA.transactionId).not.toBe(subB.transactionId);
    } finally {
        exportEvidence(testInfo, evidence);
    }
});

/* ── Helpers ── */

async function uploadViaOverview(page: Page, fixturePath: string): Promise<void> {
    await page.locator('input[type="file"]').first().setInputFiles(fixturePath);
    await expect(page.getByRole("heading", { name: "Package Successfully Analyzed" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Submit Package" }).click();
    await expect(page.getByText("Package Submitted Successfully")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Upload Another Package" })).toBeVisible();
}

async function capturePortalSnapshot(page: Page): Promise<PortalSnapshot> {
    return page.evaluate((personaEmail: string) => {
        const get = (key: string): unknown => {
            try {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : null;
            } catch {
                return null;
            }
        };
        const users = (get("integrasource.recap.portalUsers") || []) as { id: string; email: string; organizationId?: string }[];
        const personaUser = users.find(u => u.email === personaEmail) || null;
        const access = (get("integrasource.recap.portalTransactionAccess") || []) as { transactionId: string; orgId?: string; userId?: string }[];
        const authorizedTxnIds = personaUser
            ? [...new Set(access.filter(a => a.userId === personaUser.id).map(a => a.transactionId))]
            : [];
        return {
            persona: localStorage.getItem("integrasource.recap.portalPersona"),
            lastCreatedTransactionId: localStorage.getItem("integrasource.recap.lastCreatedTransactionId"),
            transactions: (get("integrasource.recap.portalTransactions") || []) as PortalSnapshot["transactions"],
            transactionAccess: access,
            submissions: (get("integrasource.recap.demo.portalSubmissions") || []) as SubmissionRecord[],
            authorizedTxnIds,
            personaUserId: personaUser?.id || null,
            personaOrgId: personaUser?.organizationId || null,
        };
    }, PERSONA_USER_EMAIL);
}

function findSubmission(snapshot: PortalSnapshot, fileName: string): SubmissionRecord | undefined {
    return (snapshot.submissions || []).find(s => s.fileName === fileName);
}

function packageIdentity(sub: SubmissionRecord): Record<string, string | undefined> {
    return {
        submissionId: sub.id,
        transactionId: sub.transactionId,
        transactionName: sub.transactionName,
        orgId: sub.orgId,
        orgName: sub.orgName,
        packageName: sub.packageName,
        sourceFileName: sub.fileName,
    };
}

function exportEvidence(testInfo: TestInfo, evidence: Record<string, unknown>): void {
    try {
        const out = testInfo.outputPath(`overview-routing-evidence-${testInfo.testId}.json`);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, JSON.stringify(evidence, null, 2), "utf8");
        console.log("EVIDENCE-EXPORT", out);
    } catch (err) {
        console.warn("exportEvidence failed:", err);
    }
}
