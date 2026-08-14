export async function checkSharePointConnectivity(graphClient, sites) {
    const results = [];
    for (const target of sites) {
        const result = {
            key: target.key,
            siteResolved: false,
            libraryResolved: false,
            rootReadable: false,
            rootItemCount: null,
            error: null,
        };
        try {
            const site = await graphClient.resolveSite(target.hostname, target.sitePath);
            result.siteResolved = true;
            const drive = await graphClient.findDriveByName(site.id, target.libraryName);
            result.libraryResolved = true;
            const children = await graphClient.listRootChildren(drive.id);
            result.rootReadable = true;
            result.rootItemCount = children.length;
        } catch (error) {
            result.error = error instanceof Error ? error.message : "SharePoint connectivity check failed";
        }
        results.push(result);
    }
    return { ok: results.every((result) => result.rootReadable), sites: results };
}
