const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

export class GraphAuthenticationError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = "GraphAuthenticationError";
    }
}

// Graph operations depend only on getAccessToken(); a certificate-backed provider
// can replace this class without changing the Graph client.
export class ClientSecretGraphAuthProvider {
    constructor({ tenantId, clientId, clientSecret }, fetchImpl = globalThis.fetch) {
        this.credentials = { tenantId, clientId, clientSecret };
        this.fetch = fetchImpl;
    }

    async getAccessToken() {
        const { tenantId, clientId, clientSecret } = this.credentials;
        let response;
        try {
            response = await this.fetch(
                `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                        client_id: clientId,
                        client_secret: clientSecret,
                        grant_type: "client_credentials",
                        scope: GRAPH_SCOPE,
                    }),
                },
            );
        } catch (error) {
            throw new GraphAuthenticationError("Microsoft Graph token request failed due to a network error", { cause: error });
        }

        if (!response.ok) {
            throw new GraphAuthenticationError(`Microsoft Graph token request failed (HTTP ${response.status})`);
        }

        let payload;
        try {
            payload = await response.json();
        } catch (error) {
            throw new GraphAuthenticationError("Microsoft Graph token response was malformed", { cause: error });
        }
        if (!payload?.access_token || typeof payload.access_token !== "string") {
            throw new GraphAuthenticationError("Microsoft Graph token response did not contain an access token");
        }
        return payload.access_token;
    }
}
