export async function checkSharePointConnectivity(graphClient, sites) {
    const results = [];
    for (const target of sites) {
        const result = {
            key: target.key,
            ok: false,
            site: null,
            drives: [],
            siteResolved: false,
            drivesListed: false,
            libraryResolved: false,
            rootReadable: false,
            rootItemCount: null,
            error: null,
        };
        try {
            const site = await graphClient.resolveSite(target.hostname, target.sitePath);
            result.site = site;
            result.siteResolved = true;
            result.drives = await graphClient.listDrives(site.id);
            result.drivesListed = true;
            if (target.libraryName) {
                const drive = result.drives.find((candidate) => candidate.name?.localeCompare(target.libraryName, undefined, { sensitivity: "accent" }) === 0);
                if (!drive) throw new Error(`Configured SharePoint library '${target.libraryName}' was not found`);
                result.libraryResolved = true;
                const children = await graphClient.listRootChildren(drive.id);
                result.rootReadable = true;
                result.rootItemCount = children.length;
            }
            result.ok = target.libraryName ? result.rootReadable : result.drivesListed;
        } catch (error) {
            result.error = error instanceof Error ? error.message : "SharePoint connectivity check failed";
        }
        results.push(result);
    }
    return { ok: results.every((result) => result.ok), sites: results };
}
