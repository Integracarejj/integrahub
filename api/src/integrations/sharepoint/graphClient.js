const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

export class GraphRequestError extends Error {
    constructor(operation, status, graphCode) {
        const detail = graphCode ? ` (${graphCode})` : "";
        super(`${operation} failed${status ? ` with HTTP ${status}` : ""}${detail}`);
        this.name = "GraphRequestError";
        this.operation = operation;
        this.status = status || null;
        this.graphCode = graphCode || null;
    }
}

export class SharePointGraphClient {
    constructor(authProvider, fetchImpl = globalThis.fetch) {
        this.authProvider = authProvider;
        this.fetch = fetchImpl;
    }

    async request(pathOrUrl, operation) {
        const token = await this.authProvider.getAccessToken();
        const url = pathOrUrl.startsWith("https://") ? pathOrUrl : `${GRAPH_BASE_URL}${pathOrUrl}`;
        if (!url.startsWith(`${GRAPH_BASE_URL}/`)) {
            throw new GraphRequestError(operation, null, "invalid_next_link");
        }
        let response;
        try {
            response = await this.fetch(url, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
            });
        } catch (error) {
            throw new GraphRequestError(operation, null, "network_error", { cause: error });
        }

        if (!response.ok) {
            let graphCode = null;
            try {
                const body = await response.json();
                graphCode = body?.error?.code || null;
            } catch {
                // Response bodies are deliberately omitted so credentials and remote content cannot leak.
            }
            throw new GraphRequestError(operation, response.status, graphCode);
        }

        try {
            return await response.json();
        } catch {
            throw new GraphRequestError(operation, response.status, "malformed_response");
        }
    }

    async resolveSite(hostname, sitePath) {
        const normalizedPath = sitePath.startsWith("/") ? sitePath : `/${sitePath}`;
        const data = await this.request(
            `/sites/${encodeURIComponent(hostname)}:${normalizedPath.split("/").map(encodeURIComponent).join("/")}`,
            "SharePoint site resolution",
        );
        if (!data?.id) throw new GraphRequestError("SharePoint site resolution", 200, "malformed_response");
        return { id: data.id, name: data.name || null, displayName: data.displayName || null, webUrl: data.webUrl || null };
    }

    async listDrives(siteId) {
        const drives = [];
        let nextPage = `/sites/${encodeURIComponent(siteId)}/drives`;
        while (nextPage) {
            const data = await this.request(nextPage, "SharePoint library listing");
            if (!Array.isArray(data?.value)) throw new GraphRequestError("SharePoint library listing", 200, "malformed_response");
            drives.push(...data.value);
            nextPage = data["@odata.nextLink"] || null;
        }
        return drives.map((drive) => ({
            id: drive.id,
            name: drive.name,
            driveType: drive.driveType || null,
            webUrl: drive.webUrl || null,
        }));
    }

    async findDriveByName(siteId, libraryName) {
        const drives = await this.listDrives(siteId);
        const drive = drives.find((candidate) => candidate.name?.localeCompare(libraryName, undefined, { sensitivity: "accent" }) === 0);
        if (!drive) throw new GraphRequestError(`SharePoint library '${libraryName}' resolution`, 404, "library_not_found");
        return drive;
    }

    async listRootChildren(driveId) {
        const data = await this.request(
            `/drives/${encodeURIComponent(driveId)}/root/children?$select=id,name,webUrl,folder,file,size,lastModifiedDateTime`,
            "SharePoint library root listing",
        );
        if (!Array.isArray(data?.value)) throw new GraphRequestError("SharePoint library root listing", 200, "malformed_response");
        return data.value.map((item) => ({
            id: item.id,
            name: item.name,
            webUrl: item.webUrl || null,
            type: item.folder ? "folder" : item.file ? "file" : "other",
            size: typeof item.size === "number" ? item.size : null,
            lastModifiedDateTime: item.lastModifiedDateTime || null,
        }));
    }
}
