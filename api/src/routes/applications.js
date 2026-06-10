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
const VALID_ARCHITECTURE_TYPES = [
    "SaaS", "Database", "Platform", "Identity Provider", "Reporting",
    "File Repository", "Integration Layer", "Internal Application",
    "External Vendor", "Manual Process", "Unknown",
];
const MAX_NOTES_LENGTH = 1000;

function normalizeDate(d) {
    if (!d) return "";
    const ds = String(d);
    if (ds.startsWith("1900") || ds.startsWith("0001")) return "";
    const dt = new Date(ds);
    if (isNaN(dt.getTime())) return "";
    return dt.toISOString().split("T")[0];
}

function getUpdatedBy(user) {
    if (!user) return "unknown";
    return user.email || user.id || "unknown";
}

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
            systemCategory,
            architectureType,
            mobileSupportType,
            apiAvailability,
            reportingSource,
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
            primaryUseCases,
            departmentsSupported,
            accessRequestProcess,
            trainingDocumentationUrl,
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
        if (architectureType && !VALID_ARCHITECTURE_TYPES.includes(architectureType)) {
            return res.status(400).json({ error: `architectureType must be one of: ${VALID_ARCHITECTURE_TYPES.join(", ")}` });
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
            `INSERT INTO cmdb.Applications (id, name, capabilityId, status, type, systemCategory, architectureType, mobileSupportType, apiAvailability, reportingSource, businessOwner, businessCriticality, impactIfDown, websiteUrl, loginUrl, backupOwner, ssoSupported, ssoEnabled, mfaSupported, mfaEnabled, dataClassification, userCountBand, lastReviewedAt, notes, primaryUseCases, departmentsSupported, accessRequestProcess, trainingDocumentationUrl)
             VALUES (@id, @name, @capabilityId, @status, @type, @systemCategory, @architectureType, @mobileSupportType, @apiAvailability, @reportingSource, @businessOwner, @businessCriticality, @impactIfDown, @websiteUrl, @loginUrl, @backupOwner, @ssoSupported, @ssoEnabled, @mfaSupported, @mfaEnabled, @dataClassification, @userCountBand, @lastReviewedAt, @notes, @primaryUseCases, @departmentsSupported, @accessRequestProcess, @trainingDocumentationUrl)`,
            {
                id: generatedId,
                name: normalizedName,
                capabilityId,
                status: status || "",
                type: type || "",
                systemCategory: systemCategory || null,
                architectureType: architectureType || null,
                mobileSupportType: mobileSupportType || null,
                apiAvailability: apiAvailability || null,
                reportingSource: reportingSource || null,
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
                lastReviewedAt: normalizeDate(lastReviewedAt) || null,
                notes: notes || "",
                primaryUseCases: primaryUseCases || null,
                departmentsSupported: departmentsSupported || null,
                accessRequestProcess: accessRequestProcess || null,
                trainingDocumentationUrl: trainingDocumentationUrl || null,
            }
        );

        res.status(201).json({
            id: generatedId,
            name: normalizedName,
            capabilityId,
            status: status || "",
            type: type || "",
            systemCategory: systemCategory || null,
            architectureType: architectureType || null,
            mobileSupportType: mobileSupportType || null,
            apiAvailability: apiAvailability || null,
            reportingSource: reportingSource || null,
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
            lastReviewedAt: normalizeDate(lastReviewedAt),
            notes: notes || "",
            primaryUseCases: primaryUseCases || null,
            departmentsSupported: departmentsSupported || null,
            accessRequestProcess: accessRequestProcess || null,
            trainingDocumentationUrl: trainingDocumentationUrl || null,
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
            systemCategory,
            architectureType,
            mobileSupportType,
            apiAvailability,
            reportingSource,
            businessOwner,
            technicalOwner,
            vendor,
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
            primaryUseCases,
            departmentsSupported,
            accessRequestProcess,
            trainingDocumentationUrl,
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
        if (architectureType && !VALID_ARCHITECTURE_TYPES.includes(architectureType)) {
            return res.status(400).json({ error: `architectureType must be one of: ${VALID_ARCHITECTURE_TYPES.join(", ")}` });
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

        const updatedBy = getUpdatedBy(req.user);

        await query(
            `UPDATE cmdb.Applications
             SET name = @name, capabilityId = @capabilityId, status = @status, type = @type,
                 systemCategory = @systemCategory,
                 architectureType = @architectureType,
                 mobileSupportType = @mobileSupportType,
                 apiAvailability = @apiAvailability,
                 reportingSource = @reportingSource,
                 businessOwner = @businessOwner, technicalOwner = @technicalOwner, vendor = @vendor, businessCriticality = @businessCriticality, impactIfDown = @impactIfDown,
                 websiteUrl = @websiteUrl, loginUrl = @loginUrl, backupOwner = @backupOwner,
                 ssoSupported = @ssoSupported, ssoEnabled = @ssoEnabled,
                 mfaSupported = @mfaSupported, mfaEnabled = @mfaEnabled,
                 dataClassification = @dataClassification, userCountBand = @userCountBand,
                 lastReviewedAt = @lastReviewedAt, notes = @notes,
                 primaryUseCases = @primaryUseCases, departmentsSupported = @departmentsSupported,
                 accessRequestProcess = @accessRequestProcess, trainingDocumentationUrl = @trainingDocumentationUrl,
                 updatedBy = @updatedBy
             WHERE id = @id`,
            {
                id,
                name: normalizedName,
                capabilityId,
                technicalOwner: technicalOwner || null,
                vendor: vendor || "",
                status: status || "",
                type: type || "",
                systemCategory: systemCategory || null,
                architectureType: architectureType || null,
                mobileSupportType: mobileSupportType || null,
                apiAvailability: apiAvailability || null,
                reportingSource: reportingSource || null,
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
                primaryUseCases: primaryUseCases || null,
                departmentsSupported: departmentsSupported || null,
                accessRequestProcess: accessRequestProcess || null,
                trainingDocumentationUrl: trainingDocumentationUrl || null,
                updatedBy,
            }
        );

        res.status(200).json({
            id,
            name: normalizedName,
            capabilityId,
            status: status || "",
            type: type || "",
            systemCategory: systemCategory || null,
            architectureType: architectureType || null,
            mobileSupportType: mobileSupportType || null,
            apiAvailability: apiAvailability || null,
            reportingSource: reportingSource || null,
            businessOwner: businessOwner || "",
            technicalOwner: technicalOwner || null,
            vendor: vendor || "",
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
            lastReviewedAt: normalizeDate(lastReviewedAt),
            notes: notes || "",
            primaryUseCases: primaryUseCases || null,
            departmentsSupported: departmentsSupported || null,
            accessRequestProcess: accessRequestProcess || null,
            trainingDocumentationUrl: trainingDocumentationUrl || null,
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

router.patch("/:id", async (req, res) => {
    console.log(`PATCH /api/applications/${req.params.id} called`);
    const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, "");

    if (!(await canEditApplication(req.user, id))) {
        return forbidden(res);
    }

    try {
        const existing = await query(
            "SELECT * FROM cmdb.Applications WHERE id = @id",
            { id }
        );
        if (existing.length === 0) {
            return res.status(404).json({ error: "Application not found" });
        }

        const setClauses = [];
        const params = { id };
        const body = req.body;

        if (body.name !== undefined) {
            const v = body.name;
            if (!v || !v.trim()) {
                return res.status(400).json({ error: "name is required" });
            }
            const normalizedName = normalizeName(v);
            const dup = await query(
                "SELECT id FROM cmdb.Applications WHERE LOWER(name) = LOWER(@name) AND id != @id",
                { name: normalizedName, id }
            );
            if (dup.length > 0) {
                return res.status(409).json({ error: "An application with this name already exists" });
            }
            setClauses.push("name = @name");
            params.name = normalizedName;
        }

        if (body.capabilityId !== undefined) {
            const v = body.capabilityId;
            if (!v) {
                return res.status(400).json({ error: "capabilityId is required" });
            }
            const check = await query(
                "SELECT id FROM cmdb.Capabilities WHERE id = @capabilityId",
                { capabilityId: v }
            );
            if (check.length === 0) {
                return res.status(400).json({ error: "capabilityId does not exist" });
            }
            setClauses.push("capabilityId = @capabilityId");
            params.capabilityId = v;
        }

        if (body.status !== undefined) {
            if (!VALID_STATUS.includes(body.status)) {
                return res.status(400).json({ error: "status must be Active, Planned, or Retired" });
            }
            setClauses.push("status = @status");
            params.status = body.status;
        }

        if (body.type !== undefined) {
            if (!VALID_TYPE.includes(body.type)) {
                return res.status(400).json({ error: "type must be Standard, SaaS, or Custom" });
            }
            setClauses.push("type = @type");
            params.type = body.type;
        }

        if (body.systemCategory !== undefined) {
            setClauses.push("systemCategory = @systemCategory");
            params.systemCategory = body.systemCategory || null;
        }

        if (body.architectureType !== undefined) {
            if (body.architectureType && !VALID_ARCHITECTURE_TYPES.includes(body.architectureType)) {
                return res.status(400).json({ error: `architectureType must be one of: ${VALID_ARCHITECTURE_TYPES.join(", ")}` });
            }
            setClauses.push("architectureType = @architectureType");
            params.architectureType = body.architectureType || null;
        }

        if (body.description !== undefined) {
            setClauses.push("description = @description");
            params.description = body.description || "";
        }

        if (body.vendor !== undefined) {
            setClauses.push("vendor = @vendor");
            params.vendor = body.vendor || "";
        }

        if (body.purpose !== undefined) {
            setClauses.push("purpose = @purpose");
            params.purpose = body.purpose || "";
        }

        if (body.technicalOwner !== undefined) {
            setClauses.push("technicalOwner = @technicalOwner");
            params.technicalOwner = body.technicalOwner || null;
        }

        if (body.businessOwner !== undefined) {
            setClauses.push("businessOwner = @businessOwner");
            params.businessOwner = body.businessOwner || "";
        }

        if (body.businessCriticality !== undefined) {
            if (!VALID_CRITICALITY.includes(body.businessCriticality)) {
                return res.status(400).json({ error: "businessCriticality must be Low, Medium, High, or Critical" });
            }
            setClauses.push("businessCriticality = @businessCriticality");
            params.businessCriticality = body.businessCriticality;
        }

        if (body.impactIfDown !== undefined) {
            setClauses.push("impactIfDown = @impactIfDown");
            params.impactIfDown = body.impactIfDown || "";
        }

        if (body.websiteUrl !== undefined) {
            setClauses.push("websiteUrl = @websiteUrl");
            params.websiteUrl = body.websiteUrl || "";
        }

        if (body.loginUrl !== undefined) {
            setClauses.push("loginUrl = @loginUrl");
            params.loginUrl = body.loginUrl || "";
        }

        if (body.backupOwner !== undefined) {
            setClauses.push("backupOwner = @backupOwner");
            params.backupOwner = body.backupOwner || "";
        }

        if (body.ssoSupported !== undefined) {
            if (!VALID_SSO.includes(body.ssoSupported)) {
                return res.status(400).json({ error: "ssoSupported must be Yes, No, or Unknown" });
            }
            setClauses.push("ssoSupported = @ssoSupported");
            params.ssoSupported = body.ssoSupported;
        }

        if (body.ssoEnabled !== undefined) {
            if (!VALID_SSO.includes(body.ssoEnabled)) {
                return res.status(400).json({ error: "ssoEnabled must be Yes, No, or Unknown" });
            }
            setClauses.push("ssoEnabled = @ssoEnabled");
            params.ssoEnabled = body.ssoEnabled;
        }

        if (body.mfaSupported !== undefined) {
            if (!VALID_MFA.includes(body.mfaSupported)) {
                return res.status(400).json({ error: "mfaSupported must be Yes, No, or Unknown" });
            }
            setClauses.push("mfaSupported = @mfaSupported");
            params.mfaSupported = body.mfaSupported;
        }

        if (body.mfaEnabled !== undefined) {
            if (!VALID_MFA.includes(body.mfaEnabled)) {
                return res.status(400).json({ error: "mfaEnabled must be Yes, No, or Unknown" });
            }
            setClauses.push("mfaEnabled = @mfaEnabled");
            params.mfaEnabled = body.mfaEnabled;
        }

        if (body.dataClassification !== undefined) {
            if (!VALID_DATA_CLASSIFICATION.includes(body.dataClassification)) {
                return res.status(400).json({ error: "dataClassification must be Public, General, Confidential, Restricted, or Unknown" });
            }
            setClauses.push("dataClassification = @dataClassification");
            params.dataClassification = body.dataClassification;
        }

        if (body.userCountBand !== undefined) {
            if (!VALID_USER_COUNT_BAND.includes(body.userCountBand)) {
                return res.status(400).json({ error: "userCountBand must be 1_10, 11_30, 31_60, 61_plus, or Unknown" });
            }
            setClauses.push("userCountBand = @userCountBand");
            params.userCountBand = body.userCountBand;
        }

        if (body.lastReviewedAt !== undefined) {
            setClauses.push("lastReviewedAt = @lastReviewedAt");
            params.lastReviewedAt = normalizeDate(body.lastReviewedAt) || null;
        }

        if (body.notes !== undefined) {
            if (body.notes && body.notes.length > MAX_NOTES_LENGTH) {
                return res.status(400).json({ error: `notes must be ${MAX_NOTES_LENGTH} characters or less` });
            }
            setClauses.push("notes = @notes");
            params.notes = body.notes || "";
        }

        if (body.primaryUseCases !== undefined) {
            setClauses.push("primaryUseCases = @primaryUseCases");
            params.primaryUseCases = body.primaryUseCases || null;
        }

        if (body.departmentsSupported !== undefined) {
            setClauses.push("departmentsSupported = @departmentsSupported");
            params.departmentsSupported = body.departmentsSupported || null;
        }

        if (body.accessRequestProcess !== undefined) {
            setClauses.push("accessRequestProcess = @accessRequestProcess");
            params.accessRequestProcess = body.accessRequestProcess || null;
        }

        if (body.trainingDocumentationUrl !== undefined) {
            setClauses.push("trainingDocumentationUrl = @trainingDocumentationUrl");
            params.trainingDocumentationUrl = body.trainingDocumentationUrl || null;
        }

        if (body.mobileSupportType !== undefined) {
            setClauses.push("mobileSupportType = @mobileSupportType");
            params.mobileSupportType = body.mobileSupportType || null;
        }

        if (body.apiAvailability !== undefined) {
            setClauses.push("apiAvailability = @apiAvailability");
            params.apiAvailability = body.apiAvailability || null;
        }

        if (body.reportingSource !== undefined) {
            setClauses.push("reportingSource = @reportingSource");
            params.reportingSource = body.reportingSource || null;
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        setClauses.push("updatedBy = @updatedBy");
        params.updatedBy = getUpdatedBy(req.user);

        await query(
            `UPDATE cmdb.Applications SET ${setClauses.join(", ")} WHERE id = @id`,
            params
        );

        const updatedRows = await query(`
            SELECT
                a.id,
                a.name,
                a.capabilityId,
                c.name AS capabilityName,
                a.status,
                a.type,
                a.systemCategory,
                a.architectureType,
                a.mobileSupportType,
                a.apiAvailability,
                a.reportingSource,
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
                a.notes,
                a.primaryUseCases,
                a.departmentsSupported,
                a.accessRequestProcess,
                a.trainingDocumentationUrl
            FROM cmdb.Applications a
            INNER JOIN cmdb.Capabilities c
                ON a.capabilityId = c.id
            WHERE a.id = @id
        `, { id });

        const row = updatedRows[0];
        res.json({
            id: row.id,
            name: row.name,
            capabilityId: row.capabilityId,
            capabilityName: row.capabilityName,
            status: row.status,
            type: row.type,
            systemCategory: row.systemCategory,
            architectureType: row.architectureType,
            mobileSupportType: row.mobileSupportType,
            apiAvailability: row.apiAvailability,
            reportingSource: row.reportingSource,
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
            lastReviewedAt: normalizeDate(row.lastReviewedAt),
            notes: row.notes,
            primaryUseCases: row.primaryUseCases,
            departmentsSupported: row.departmentsSupported,
            accessRequestProcess: row.accessRequestProcess,
            trainingDocumentationUrl: row.trainingDocumentationUrl,
        });
    } catch (err) {
        console.error(`PATCH /api/applications/${req.params.id} failed:`, err);
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
                a.systemCategory,
                a.architectureType,
                a.mobileSupportType,
                a.apiAvailability,
                a.reportingSource,
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
                a.notes,
                a.primaryUseCases,
                a.departmentsSupported,
                a.accessRequestProcess,
                a.trainingDocumentationUrl
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
            systemCategory: row.systemCategory,
            architectureType: row.architectureType,
            mobileSupportType: row.mobileSupportType,
            apiAvailability: row.apiAvailability,
            reportingSource: row.reportingSource,
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
            lastReviewedAt: normalizeDate(row.lastReviewedAt),
            notes: row.notes,
            primaryUseCases: row.primaryUseCases,
            departmentsSupported: row.departmentsSupported,
            accessRequestProcess: row.accessRequestProcess,
            trainingDocumentationUrl: row.trainingDocumentationUrl,
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
                a.systemCategory,
                a.architectureType,
                a.mobileSupportType,
                a.apiAvailability,
                a.reportingSource,
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
                a.notes,
                a.primaryUseCases,
                a.departmentsSupported,
                a.accessRequestProcess,
                a.trainingDocumentationUrl
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
                i.status,
                i.businessPurpose,
                i.dataExchanged,
                i.frequency,
                i.method,
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
            status: row.status,
            businessPurpose: row.businessPurpose,
            dataExchanged: row.dataExchanged,
            frequency: row.frequency,
            method: row.method,
        }));

        const inboundRows = await query(`
            SELECT
                i.id,
                i.sourceApplicationId,
                i.targetApplicationId,
                i.integrationType,
                i.notes,
                i.status,
                i.businessPurpose,
                i.dataExchanged,
                i.frequency,
                i.method,
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
            status: row.status,
            businessPurpose: row.businessPurpose,
            dataExchanged: row.dataExchanged,
            frequency: row.frequency,
            method: row.method,
        }));

        const row = rows[0];
        const application = {
            id: row.id,
            name: row.name,
            capabilityId: row.capabilityId,
            capabilityName: row.capabilityName,
            status: row.status,
            type: row.type,
            systemCategory: row.systemCategory,
            architectureType: row.architectureType,
            mobileSupportType: row.mobileSupportType,
            apiAvailability: row.apiAvailability,
            reportingSource: row.reportingSource,
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
            lastReviewedAt: normalizeDate(row.lastReviewedAt),
            notes: row.notes,
            primaryUseCases: row.primaryUseCases,
            departmentsSupported: row.departmentsSupported,
            accessRequestProcess: row.accessRequestProcess,
            trainingDocumentationUrl: row.trainingDocumentationUrl,
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

router.get("/:id/roles", async (req, res) => {
    const { id } = req.params;

    try {
        const rows = await query(`
            SELECT
                sru.id AS usageId,
                sru.applicationId,
                sru.roleDefinitionId,
                rd.roleCode,
                rd.roleName,
                rd.roleGroup,
                sru.usageType,
                sru.usagePurpose,
                sru.isPrimary,
                sru.notes,
                sru.createdAt,
                sru.updatedAt
            FROM cmdb.SystemRoleUsage sru
            INNER JOIN cmdb.RoleDefinitions rd ON sru.roleDefinitionId = rd.id
            WHERE sru.applicationId = @applicationId
            ORDER BY
                sru.isPrimary DESC,
                sru.usageType ASC,
                rd.roleGroup ASC,
                rd.roleName ASC
        `, { applicationId: id });

        res.json(rows);
    } catch (err) {
        console.error(`GET /api/applications/${id}/roles failed:`, err);
        res.status(500).json({
            error: "Failed to fetch application roles",
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
