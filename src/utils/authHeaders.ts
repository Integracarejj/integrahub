export function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    const devUserEmail = localStorage.getItem("devUserEmail");
    if (devUserEmail) {
        headers["x-dev-user-email"] = devUserEmail;
    }

    return headers;
}
