export class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
    const response = await fetch(url, {
        ...options,
        credentials: "include",
    });

    if (response.status === 401 || response.status === 403) {
        throw new ApiError(response.status, "Access denied");
    }

    return response;
}

export function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    if (import.meta.env.DEV) {
        const devUserEmail = localStorage.getItem("devUserEmail");
        if (devUserEmail) {
            headers["x-dev-user-email"] = devUserEmail;
        }
    }

    return headers;
}