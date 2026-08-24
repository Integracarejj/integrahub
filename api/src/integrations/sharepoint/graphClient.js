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

    normalizeDriveItem(item, operation) {
        if (!item?.id || !item?.name) throw new GraphRequestError(operation, 200, "malformed_response");
        return {
            id: item.id,
            name: item.name,
            webUrl: item.webUrl || null,
            type: item.folder ? "folder" : item.file ? "file" : "other",
            parentId: item.parentReference?.id || null,
            size: typeof item.size === "number" ? item.size : null,
        };
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


    async getDriveRoot(driveId) {
        const data = await this.request(
            `/drives/${encodeURIComponent(driveId)}/root?$select=id,name,webUrl,folder,parentReference`,
            "SharePoint drive root resolution",
        );
        return this.normalizeDriveItem(data, "SharePoint drive root resolution");
    }

    async getItem(driveId, itemId) {
        const data = await this.request(
            `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}?$select=id,name,webUrl,folder,file,parentReference`,
            "SharePoint item resolution",
        );
        return this.normalizeDriveItem(data, "SharePoint item resolution");
    }

    async listChildren(driveId, parentItemId) {
        const items = [];
        let nextPage = `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentItemId)}/children?$select=id,name,webUrl,folder,file,parentReference,size`;
        while (nextPage) {
            const data = await this.request(nextPage, "SharePoint child folder lookup");
            if (!Array.isArray(data?.value)) throw new GraphRequestError("SharePoint child folder lookup", 200, "malformed_response");
            items.push(...data.value.map((item) => this.normalizeDriveItem(item, "SharePoint child folder lookup")));
            nextPage = data["@odata.nextLink"] || null;
        }
        return items;
    }

    async findChildByExactName(driveId, parentItemId, name) {
        const children = await this.listChildren(driveId, parentItemId);
        return children.find((item) => item.name.localeCompare(name, undefined, { sensitivity: "accent" }) === 0) || null;
    }

    async createChildFolder(driveId, parentItemId, name) {
        const token = await this.authProvider.getAccessToken();
        const url = `${GRAPH_BASE_URL}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentItemId)}/children`;
        let response;
        try {
            response = await this.fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
            });
        } catch {
            throw new GraphRequestError("SharePoint child folder creation", null, "network_error");
        }
        if (!response.ok) {
            let graphCode = null;
            try {
                const body = await response.json();
                graphCode = body?.error?.code || null;
            } catch {
                // Raw Graph response details are deliberately omitted.
            }
            throw new GraphRequestError("SharePoint child folder creation", response.status, graphCode);
        }
        let data;
        try {
            data = await response.json();
        } catch {
            throw new GraphRequestError("SharePoint child folder creation", response.status, "malformed_response");
        }
        const item = this.normalizeDriveItem(data, "SharePoint child folder creation");
        if (item.type !== "folder") throw new GraphRequestError("SharePoint child folder creation", 200, "malformed_response");
        return item;
    }

    async uploadNewFile(driveId, parentItemId, fileName, content) {
        const token = await this.authProvider.getAccessToken();
        const url = `${GRAPH_BASE_URL}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentItemId)}:/${encodeURIComponent(fileName)}:/content`;
        let response;
        try {
            response = await this.fetch(url, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Content-Type": "application/octet-stream",
                    // An impossible eTag makes path-based PUT create-only: an
                    // item appearing after the preflight check fails with 412.
                    "If-Match": "0",
                },
                body: content,
            });
        } catch {
            throw new GraphRequestError("SharePoint incoming file upload", null, "network_error");
        }
        if (!response.ok) {
            let graphCode = null;
            try { graphCode = (await response.json())?.error?.code || null; } catch { /* Omit remote content. */ }
            throw new GraphRequestError("SharePoint incoming file upload", response.status, graphCode);
        }
        let data;
        try { data = await response.json(); } catch {
            throw new GraphRequestError("SharePoint incoming file upload", response.status, "malformed_response");
        }
        const item = this.normalizeDriveItem(data, "SharePoint incoming file upload");
        if (item.type !== "file") throw new GraphRequestError("SharePoint incoming file upload", 200, "malformed_response");
        return item;
    }

    async downloadFile(driveId, itemId, { maxBytes, expectedSize } = {}) {
        const token = await this.authProvider.getAccessToken();
        const url = `${GRAPH_BASE_URL}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`;
        let response;
        try {
            response = await this.fetch(url, { headers: { Authorization: `Bearer ${token}` }, redirect: "follow" });
        } catch {
            throw new GraphRequestError("SharePoint file download", null, "network_error");
        }
        if (!response.ok) throw new GraphRequestError("SharePoint file download", response.status, null);
        const limit = Number(maxBytes);
        const expected = Number(expectedSize);
        if (!Number.isSafeInteger(limit) || limit <= 0 || !Number.isSafeInteger(expected) || expected <= 0 || expected > limit) {
            throw new GraphRequestError("SharePoint file download", null, "invalid_size_boundary");
        }
        const declaredLength = Number(response.headers.get("content-length"));
        if (Number.isFinite(declaredLength) && declaredLength > limit) {
            await response.body?.cancel();
            throw new GraphRequestError("SharePoint file download", response.status, "response_too_large");
        }
        if (!response.body) throw new GraphRequestError("SharePoint file download", response.status, "malformed_response");
        const reader = response.body.getReader();
        const chunks = [];
        let total = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > limit) {
                await reader.cancel();
                throw new GraphRequestError("SharePoint file download", response.status, "response_too_large");
            }
            chunks.push(Buffer.from(value));
        }
        if (total !== expected) throw new GraphRequestError("SharePoint file download", response.status, "content_length_mismatch");
        return {
            content: Buffer.concat(chunks, total),
            contentType: response.headers.get("content-type") || "application/octet-stream",
        };
    }
}
