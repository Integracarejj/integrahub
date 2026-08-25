const REQUIRED_CREDENTIAL_KEYS = [
    "SHAREPOINT_TENANT_ID",
    "SHAREPOINT_CLIENT_ID",
    "SHAREPOINT_CLIENT_SECRET",
];

const DEFAULT_SITES = Object.freeze([
    Object.freeze({
        key: "working",
        hostname: "integracare.sharepoint.com",
        sitePath: "/sites/tIntegraSourceWorking",
        libraryName: "Recapitalization Working",
    }),
    Object.freeze({
        key: "knowledge",
        hostname: "integracare.sharepoint.com",
        sitePath: "/sites/tIntegraSourceKnowledge",
        libraryName: "Documents",
    }),
    Object.freeze({
        key: "external",
        hostname: "integracare.sharepoint.com",
        sitePath: "/sites/ICC_External",
        libraryName: "Documents",
    }),
]);

const DEFAULT_ARTIFACT_DESTINATIONS = Object.freeze([
    Object.freeze({ key: "Projects", hostname: "integracare.sharepoint.com", sitePath: "/sites/tIntegraSourceWorking", libraryName: "Projects Working" }),
    Object.freeze({ key: "Legal", hostname: "integracare.sharepoint.com", sitePath: "/sites/tIntegraSourceWorking", libraryName: "Legal Working" }),
    Object.freeze({ key: "Operations", hostname: "integracare.sharepoint.com", sitePath: "/sites/tIntegraSourceWorking", libraryName: "Operations Working" }),
]);

export class SharePointConfigError extends Error {
    constructor(missingKeys) {
        super(`SharePoint integration is not configured. Missing: ${missingKeys.join(", ")}`);
        this.name = "SharePointConfigError";
        this.missingKeys = [...missingKeys];
    }
}

export function loadSharePointConfig(env = process.env) {
    const missingKeys = REQUIRED_CREDENTIAL_KEYS.filter((key) => !env[key]?.trim());
    if (missingKeys.length > 0) throw new SharePointConfigError(missingKeys);

    return {
        credentials: {
            tenantId: env.SHAREPOINT_TENANT_ID.trim(),
            clientId: env.SHAREPOINT_CLIENT_ID.trim(),
            clientSecret: env.SHAREPOINT_CLIENT_SECRET,
        },
        sites: DEFAULT_SITES.map((site) => ({
            ...site,
            hostname: env[`SHAREPOINT_${site.key.toUpperCase()}_HOSTNAME`]?.trim() || site.hostname,
            sitePath: env[`SHAREPOINT_${site.key.toUpperCase()}_SITE_PATH`]?.trim() || site.sitePath,
            libraryName: env[`SHAREPOINT_${site.key.toUpperCase()}_LIBRARY`]?.trim() || site.libraryName,
        })),
        artifactDestinations: DEFAULT_ARTIFACT_DESTINATIONS.map((target) => ({
            ...target,
            hostname: env[`SHAREPOINT_ARTIFACT_${target.key.toUpperCase()}_HOSTNAME`]?.trim() || target.hostname,
            sitePath: env[`SHAREPOINT_ARTIFACT_${target.key.toUpperCase()}_SITE_PATH`]?.trim() || target.sitePath,
            libraryName: env[`SHAREPOINT_ARTIFACT_${target.key.toUpperCase()}_LIBRARY`]?.trim() || target.libraryName,
        })),
    };
}


export function getArtifactDestinationTarget(config, libraryKey) {
    const target = config.artifactDestinations?.find((candidate) => candidate.key === libraryKey);
    if (!target) throw new SharePointConfigError([`artifact-destination:${libraryKey}`]);
    return target;
}

export function getSharePointSiteTarget(config, siteKey) {
    const target = config.sites.find((site) => site.key === siteKey);
    if (!target) throw new SharePointConfigError([`site:${siteKey}`]);
    return target;
}
