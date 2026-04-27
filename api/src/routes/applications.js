import { Router } from "express";
import { query } from "../db.js";
import { canCreateApplication, canEditApplication, forbidden } from "../auth/applicationPermissions.js";

const router = Router();

const VALID_CRITICALITY = ["Low", "Medium", "High", "Critical"];
const VALID_STATUS = ["Active", "Planned", "Retired"];
const VALID_TYPE = ["Standard", "Platform", "SaaS"];
const VALID_SSO = ["Yes", "No", "Unknown"];
const VALID_MFA = ["Yes", "No", "Unknown"];
const VALID_DATA_CLASSIFICATION = ["Public", "General", "Confidential", "Restricted", "Unknown"];
const VALID_USER_COUNT_BAND = ["1_10", "11_30", "31_60", "61_plus", "Unknown"];
const MAX_NOTES_LENGTH = 1000;

function normalizeName(name) {
    return name.trim().replace(/\s+/g, " ");
}

router.post("/", async (req, res) => {
    console.log("POST /api/applications called");

    if (!(await canCreateApplication(req.user))) {
        return forbidden(res);
    }

    try {
        const {
            name,
            capabilityId,
            status,
            type,
            businessOwner,
            businessCriticality,
            impactIfDown,
            websiteUrl,
            loginUrl,
            backupOwner,
            ssoSupported,
            ssoEnabled,
            mfaSupported,
            mfaEnabled,
            dataClassification,
            userCountBand,
            lastReviewedAt,
            notes,
        } = req.body;

        if (!name) {
            return res.status(400).json({ error: "name is required" });
        }
        if (!capabilityId) {
            return res.status(400).json({ error: "capabilityId is required" });
        }
        if (status && !VALID_STATUS.includes(status)) {
            return res.status(400).json({ error: "status must be Active, Planned, or Retired" });
        }
        if (type && !VALID_TYPE.includes(type)) {
            return res.status(400).json({ error: "type must be Standard, SaaS, or Custom" });
        }
        if (businessCriticality && !VALID_CRITICALITY.includes(businessCriticality)) {
            return res.status(400).json({ error: "businessCriticality must be Low, Medium, High, or Critical" });
        }
        if (ssoSupported && !VALID_SSO.includes(ssoSupported)) {
            return res.status(400).json({ error: "ssoSupported must be Yes, No, or Unknown" });
        }
        if (ssoEnabled && !VALID_SSO.includes(ssoEnabled)) {
            return res.status(400).json({ error: "ssoEnabled must be Yes, No, or Unknown" });
        }
        if (mfaSupported && !VALID_MFA.includes(mfaSupported)) {
            return res.status(400).json({ error: "mfaSupported must be Yes, No, or Unknown" });
        }
        if (mfaEnabled && !VALID_MFA.includes(mfaEnabled)) {
            return res.status(400).json({ error: "mfaEnabled must be Yes, No, or Unknown" });
        }
        if (dataClassification && !VALID_DATA_CLASSIFICATION.includes(dataClassification)) {
            return res.status(400).json({ error: "dataClassification must be Public, General, Confidential, Restricted, or Unknown" });
        }
        if (userCountBand && !VALID_USER_COUNT_BAND.includes(userCountBand)) {
            return res.status(400).json({ error: "userCountBand must be 1_10, 11_30, 31_60, 61_plus, or Unknown" });
        }
        if (notes && notes.length > MAX_NOTES_LENGTH) {
            return res.status(400).json({ error: `notes must be ${MAX_NOTES_LENGTH} characters or less` });
        }

        const normalizedName = normalizeName(name);

        const duplicateName = await query(
            "SELECT id FROM cmdb.Applications WHERE LOWER(name) = LOWER(@name)",
            { name: normalizedName }
        );
        if (duplicateName.length > 0) {
            return res.status(409).json({ error: "An application with this name already exists" });
        }

        const capabilityCheck = await query(
            "SELECT id FROM cmdb.Capabilities WHERE id = @capabilityId",
            { capabilityId }
        );
        if (capabilityCheck.length === 0) {
            return res.status(400).json({ error: "capabilityId does not exist" });
        }

        const generatedId = "app-" + normalizedName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

        const existingId = await query(
            "SELECT id FROM cmdb.Applications WHERE id = @id",
            { id: generatedId }
        );
        if (existingId.length > 0) {
            return res.status(409).json({ error: "An application with this id already exists" });
        }

        await query(
            `INSERT INTO cmdb.Applications (id, name, capabilityId, status, type, businessOwner, businessCriticality, impactIfDown, websiteUrl, loginUrl, backupOwner, ssoSupported, ssoEnabled, mfaSupported, mfaEnabled, dataClassification, userCountBand, lastReviewedAt, notes)
             VALUES (@id, @name, @capabilityId, @status, @type, @businessOwner, @businessCriticality, @impactIfDown, @websiteUrl, @loginUrl, @backupOwner, @ssoSupported, @ssoEnabled, @mfaSupported, @mfaEnabled, @dataClassification, @userCountBand, @lastReviewedAt, @notes)`,
            {
                id: generatedId,
                name: normalizedName,
                capabilityId,
                status: status || "",
                type: type || "",
                businessOwner: businessOwner || "",
                businessCriticality: businessCriticality || "",
                impactIfDown: impactIfDown || "",
                websiteUrl: websiteUrl || "",
                loginUrl: loginUrl || "",
                backupOwner: backupOwner || "",
                ssoSupported: ssoSupported || "",
                ssoEnabled: ssoEnabled || "",
                mfaSupported: mfaSupported || "",
                mfaEnabled: mfaEnabled || "",
                dataClassification: dataClassification || "",
                userCountBand: userCountBand || "",
                lastReviewedAt: lastReviewedAt || "",
                notes: notes || "",
            }
        );

        res.status(201).json({
            id: generatedId,
            name: normalizedName,
            capabilityId,
            status: status || "",
            type: type || "",
            businessOwner: businessOwner || "",
            businessCriticality: businessCriticality || "",
            impactIfDown: impactIfDown || "",
            websiteUrl: websiteUrl || "",
            loginUrl: loginUrl || "",
            backupOwner: backupOwner || "",
            ssoSupported: ssoSupported || "",
            ssoEnabled: ssoEnabled || "",
            mfaSupported: mfaSupported || "",
            mfaEnabled: mfaEnabled || "",
            dataClassification: dataClassification || "",
            userCountBand: userCountBand || "",
            lastReviewedAt: lastReviewedAt || "",
            notes: notes || "",
        });
    } catch (err) {
        console.error("POST /api/applications failed:", err);
        res.status(500).json({
            error: "Failed to create application",
            details: err?.message || "Unknown error",
        });
    }
});

router.put("/:id", async (req, res) => {
    console.log(`PUT /api/applications/${req.params.id} called`);
    const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, "");

    if (!(await canEditApplication(req.user, id))) {
        return forbidden(res);
    }

    try {
        const {
            name,
            capabilityId,
            status,
            type,
            businessOwner,
            technicalOwner,
            businessCriticality,
            impactIfDown,
            websiteUrl,
            loginUrl,
            backupOwner,
            ssoSupported,
            ssoEnabled,
            mfaSupported,
            mfaEnabled,
            dataClassification,
            userCountBand,
            lastReviewedAt,
            notes,
        } = req.body;

        if (!name) {
            return res.status(400).json({ error: "name is required" });
        }
        if (!capabilityId) {
            return res.status(400).json({ error: "capabilityId is required" });
        }
        if (status && !VALID_STATUS.includes(status)) {
            return res.status(400).json({ error: "status must be Active, Planned, or Retired" });
        }
        if (type && !VALID_TYPE.includes(type)) {
            return res.status(400).json({ error: "type must be Standard, SaaS, or Custom" });
        }
        if (businessCriticality && !VALID_CRITICALITY.includes(businessCriticality)) {
            return res.status(400).json({ error: "businessCriticality must be Low, Medium, High, or Critical" });
        }
        if (ssoSupported && !VALID_SSO.includes(ssoSupported)) {
            return res.status(400).json({ error: "ssoSupported must be Yes, No, or Unknown" });
        }
        if (ssoEnabled && !VALID_SSO.includes(ssoEnabled)) {
            return res.status(400).json({ error: "ssoEnabled must be Yes, No, or Unknown" });
        }
        if (mfaSupported && !VALID_MFA.includes(mfaSupported)) {
            return res.status(400).json({ error: "mfaSupported must be Yes, No, or Unknown" });
        }
        if (mfaEnabled && !VALID_MFA.includes(mfaEnabled)) {
            return res.status(400).json({ error: "mfaEnabled must be Yes, No, or Unknown" });
        }
        if (dataClassification && !VALID_DATA_CLASSIFICATION.includes(dataClassification)) {
            return res.status(400).json({ error: "dataClassification must be Public, General, Confidential, Restricted, or Unknown" });
        }
        if (userCountBand && !VALID_USER_COUNT_BAND.includes(userCountBand)) {
            return res.status(400).json({ error: "userCountBand must be 1_10, 11_30, 31_60, 61_plus, or Unknown" });
        }
        if (notes && notes.length > MAX_NOTES_LENGTH) {
            return res.status(400).json({ error: `notes must be ${MAX_NOTES_LENGTH} characters or less` });
        }

        const existing = await query(
            "SELECT id FROM cmdb.Applications WHERE id = @id",
            { id }
        );
        if (existing.length === 0) {
            return res.status(404).json({ error: "Application not found" });
        }

        const normalizedName = normalizeName(name);

        const duplicateName = await query(
            "SELECT id FROM cmdb.Applications WHERE LOWER(name) = LOWER(@name) AND id != @id",
            { name: normalizedName, id }
        );
        if (duplicateName.length > 0) {
            return res.status(409).json({ error: "An application with this name already exists" });
        }

        const capabilityCheck = await query(
            "SELECT id FROM cmdb.Capabilities WHERE id = @capabilityId",
            { capabilityId }
        );
        if (capabilityCheck.length === 0) {
            return res.status(400).json({ error: "capabilityId does not exist" });
        }

        await query(
            `UPDATE cmdb.Applications
             SET name = @name, capabilityId = @capabilityId, status = @status, type = @type,
                 businessOwner = @businessOwner, technicalOwner = @technicalOwner, businessCriticality = @businessCriticality, impactIfDown = @impactIfDown,
                 websiteUrl = @websiteUrl, loginUrl = @loginUrl, backupOwner = @backupOwner,
                 ssoSupported = @ssoSupported, ssoEnabled = @ssoEnabled,
                 mfaSupported = @mfaSupported, mfaEnabled = @mfaEnabled,
                 dataClassification = @dataClassification, userCountBand = @userCountBand,
                 lastReviewedAt = @lastReviewedAt, notes = @notes
             WHERE id = @id`,
            {
                id,
                name: normalizedName,
                capabilityId,
                technicalOwner: technicalOwner || null,
                status: status || "",
                type: type || "",
                businessOwner: businessOwner || "",
                businessCriticality: businessCriticality || "",
                impactIfDown: impactIfDown || "",
                websiteUrl: websiteUrl || "",
                loginUrl: loginUrl || "",
                backupOwner: backupOwner || "",
                ssoSupported: ssoSupported || "",
                ssoEnabled: ssoEnabled || "",
                mfaSupported: mfaSupported || "",
                mfaEnabled: mfaEnabled || "",
                dataClassification: dataClassification || "",
                userCountBand: userCountBand || "",
                lastReviewedAt: lastReviewedAt || "",
                notes: notes || "",
            }
        );

        res.status(200).json({
            id,
            name: normalizedName,
            capabilityId,
            status: status || "",
            type: type || "",
            businessOwner: businessOwner || "",
            businessCriticality: businessCriticality || "",
            impactIfDown: impactIfDown || "",
            websiteUrl: websiteUrl || "",
            loginUrl: loginUrl || "",
            backupOwner: backupOwner || "",
            ssoSupported: ssoSupported || "",
            ssoEnabled: ssoEnabled || "",
            mfaSupported: mfaSupported || "",
            mfaEnabled: mfaEnabled || "",
            dataClassification: dataClassification || "",
            userCountBand: userCountBand || "",
            lastReviewedAt: lastReviewedAt || "",
            notes: notes || "",
        });
    } catch (err) {
        console.error(`PUT /api/applications/${req.params.id} failed:`, err);
        console.error("Request body:", JSON.stringify(req.body, null, 2));
        console.error("Error message:", err.message);
        console.error("Error stack:", err.stack);
        if (err.number) console.error("Error number:", err.number);
        if (err.code) console.error("Error code:", err.code);
        if (err.originalError) console.error("Original error:", err.originalError);
        res.status(500).json({
            error: "Failed to update application",
            detail: err?.message || "Unknown error",
        });
    }
});

router.get("/", async (_req, res) => {
    console.log("GET /api/applications called");
    try {
        const rows = await query(`
            SELECT
                a.id,
                a.name,
                a.capabilityId,
                c.name AS capabilityName,
                a.status,
                a.type,
                a.description,
                a.technicalOwner,
                a.vendor,
                a.purpose,
                a.businessCriticality,
                a.impactIfDown,
                a.businessOwner,
                a.websiteUrl,
                a.loginUrl,
                a.backupOwner,
                a.ssoSupported,
                a.ssoEnabled,
                a.mfaSupported,
                a.mfaEnabled,
                a.dataClassification,
                a.userCountBand,
                a.lastReviewedAt,
                a.notes
            FROM cmdb.Applications a
            INNER JOIN cmdb.Capabilities c
                ON a.capabilityId = c.id
            ORDER BY a.name
        `);

        const applications = rows.map(row => ({
            id: row.id,
            name: row.name,
            capabilityId: row.capabilityId,
            capabilityName: row.capabilityName,
            status: row.status,
            type: row.type,
            description: row.description,
            technicalOwner: row.technicalOwner,
            vendor: row.vendor,
            purpose: row.purpose,
            businessContext: {
                businessCriticality: row.businessCriticality,
                impactIfDown: row.impactIfDown,
            },
            ownership: {
                businessOwner: row.businessOwner,
            },
            security: {
                websiteUrl: row.websiteUrl,
                loginUrl: row.loginUrl,
                backupOwner: row.backupOwner,
                ssoSupported: row.ssoSupported,
                ssoEnabled: row.ssoEnabled,
                mfaSupported: row.mfaSupported,
                mfaEnabled: row.mfaEnabled,
                dataClassification: row.dataClassification,
            },
            userCountBand: row.userCountBand,
            lastReviewedAt: row.lastReviewedAt,
            notes: row.notes,
        }));

        res.json(applications);
    } catch (err) {
        console.error("GET /api/applications failed:", err);
        res.status(500).json({
            error: "Failed to fetch applications",
            details: err?.message || "Unknown error",
        });
    }
});

router.get("/:id", async (req, res) => {
    console.log(`GET /api/applications/${req.params.id} called`);
    try {
        const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, "");
        const rows = await query(`
            SELECT
                a.id,
                a.name,
                a.capabilityId,
                c.name AS capabilityName,
                a.status,
                a.type,
                a.description,
                a.technicalOwner,
                a.vendor,
                a.purpose,
                a.businessCriticality,
                a.impactIfDown,
                a.businessOwner,
                a.websiteUrl,
                a.loginUrl,
                a.backupOwner,
                a.ssoSupported,
                a.ssoEnabled,
                a.mfaSupported,
                a.mfaEnabled,
                a.dataClassification,
                a.userCountBand,
                a.lastReviewedAt,
                a.notes
            FROM cmdb.Applications a
            INNER JOIN cmdb.Capabilities c
                ON a.capabilityId = c.id
            WHERE a.id = @id
        `, { id });

        if (rows.length === 0) {
            return res.status(404).json({ error: "Application not found" });
        }

        const integrationRows = await query(`
            SELECT
                i.id,
                i.sourceApplicationId,
                i.targetApplicationId,
                i.integrationType,
                i.notes,
                ta.name AS targetApplicationName
            FROM cmdb.ApplicationIntegrations i
            INNER JOIN cmdb.Applications ta ON i.targetApplicationId = ta.id
            WHERE i.sourceApplicationId = @id
            ORDER BY ta.name
        `, { id });

        const integrations = integrationRows.map(row => ({
            id: row.id,
            targetApplicationId: row.targetApplicationId,
            targetApplicationName: row.targetApplicationName,
            integrationType: row.integrationType,
            notes: row.notes,
        }));

        const inboundRows = await query(`
            SELECT
                i.id,
                i.sourceApplicationId,
                i.targetApplicationId,
                i.integrationType,
                i.notes,
                sa.name AS sourceApplicationName
            FROM cmdb.ApplicationIntegrations i
            INNER JOIN cmdb.Applications sa ON i.sourceApplicationId = sa.id
            WHERE i.targetApplicationId = @id
            ORDER BY sa.name
        `, { id });

        const inboundIntegrations = inboundRows.map(row => ({
            id: row.id,
            sourceApplicationId: row.sourceApplicationId,
            sourceApplicationName: row.sourceApplicationName,
            integrationType: row.integrationType,
            notes: row.notes,
        }));

        const row = rows[0];
        const application = {
            id: row.id,
            name: row.name,
            capabilityId: row.capabilityId,
            capabilityName: row.capabilityName,
            status: row.status,
            type: row.type,
            description: row.description,
            technicalOwner: row.technicalOwner,
            vendor: row.vendor,
            purpose: row.purpose,
            businessContext: {
                businessCriticality: row.businessCriticality,
                impactIfDown: row.impactIfDown,
            },
            ownership: {
                businessOwner: row.businessOwner,
            },
            security: {
                websiteUrl: row.websiteUrl,
                loginUrl: row.loginUrl,
                backupOwner: row.backupOwner,
                ssoSupported: row.ssoSupported,
                ssoEnabled: row.ssoEnabled,
                mfaSupported: row.mfaSupported,
                mfaEnabled: row.mfaEnabled,
                dataClassification: row.dataClassification,
            },
            userCountBand: row.userCountBand,
            lastReviewedAt: row.lastReviewedAt,
            notes: row.notes,
            integrations,
            inboundIntegrations,
        };

        res.json(application);
    } catch (err) {
        console.error(`GET /api/applications/${req.params.id} failed:`, err);
        res.status(500).json({
            error: "Failed to fetch application",
            details: err?.message || "Unknown error",
        });
    }
});

router.delete("/:id", async (req, res) => {
    console.log(`DELETE /api/applications/${req.params.id} called`);
    const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, "");

    if (!(await canEditApplication(req.user, id))) {
        return forbidden(res);
    }

    try {
        const existing = await query(
            "SELECT id FROM cmdb.Applications WHERE id = @id",
            { id }
        );
        if (existing.length === 0) {
            return res.status(404).json({ error: "Application not found" });
        }

        await query("DELETE FROM cmdb.Applications WHERE id = @id", { id });

        res.status(200).json({ success: true });
    } catch (err) {
        console.error(`DELETE /api/applications/${req.params.id} failed:`, err);
        res.status(500).json({
            error: "Failed to delete application",
            details: err?.message || "Unknown error",
        });
    }
});

export default router;
