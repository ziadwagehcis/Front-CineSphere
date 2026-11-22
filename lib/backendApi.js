const DEFAULT_BACKEND_URL = "https://back-cinesphere.vercel.app";

function resolveBackendBaseUrl() {
    const configuredUrl = process.env.BACKEND_API_URL || DEFAULT_BACKEND_URL;
    let parsedUrl;

    try {
        parsedUrl = new URL(configuredUrl);
    } catch {
        throw new Error("BACKEND_API_URL must be an absolute HTTP or HTTPS URL.");
    }

    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
        throw new Error("BACKEND_API_URL must use HTTP or HTTPS.");
    }

    const baseUrl = parsedUrl.toString().replace(/\/+$/, "");
    return baseUrl.replace(/\/api$/i, "");
}

const backendBaseUrl = resolveBackendBaseUrl();

class BackendApiError extends Error {
    constructor(message, status = 502, options = {}) {
        super(message, options);
        this.name = "BackendApiError";
        this.status = status;
    }
}

async function requestApi(path, options = {}) {
    let response;

    try {
        response = await fetch(`${backendBaseUrl}/api${path}`, {
            ...options,
            headers: {
                Accept: "application/json",
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...options.headers
            }
        });
    } catch (error) {
        throw new BackendApiError("Could not reach the CineSphere API.", 502, { cause: error });
    }

    let payload = null;
    if ((response.headers.get("content-type") || "").includes("application/json")) {
        try {
            payload = await response.json();
        } catch (error) {
            throw new BackendApiError("The CineSphere API returned invalid JSON.", 502, { cause: error });
        }
    }

    if (!response.ok || !payload || payload.success !== true) {
        const status = response.ok ? 502 : response.status;
        throw new BackendApiError(
            payload && payload.error ? payload.error : "The CineSphere API request failed.",
            status
        );
    }

    return payload;
}

module.exports = {
    BackendApiError,
    backendBaseUrl,
    requestApi
};
