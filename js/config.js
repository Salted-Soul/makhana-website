// ======================================
// ENVIRONMENT DETECTION
// ======================================
const ENV = {

    isLocalhost:

        window.location.hostname === "localhost" ||

        window.location.hostname === "127.0.0.1",


    isSecure:
        window.location.protocol === "https:",


    hostname:
        window.location.hostname,


    protocol:
        window.location.protocol
};


// ======================================
// API BASE URL
// ======================================

const API_BASE =
window.location.hostname === "localhost"
    ? "http://localhost:5000/api"
    : "https://saltedsoul-api.onrender.com/api";


// ======================================
// REQUEST CONFIG
// ======================================
const API_TIMEOUT = 15000;

const MAX_RETRIES = 1;


// ======================================
// DEFAULT FETCH OPTIONS
// ======================================
const DEFAULT_OPTIONS = {

    credentials: "include",

    headers: {

        "Content-Type":
            "application/json",

        
    }
};


// ======================================
// DEBUG LOGGER
// ======================================
const debugLog = (
    ...args
) => {

    if (ENV.isLocalhost) {

        console.log(...args);
    }
};


// ======================================
// SAFE JSON PARSER
// ======================================
const safeJsonParse = async (
    response
) => {

    try {

        return await response.json();

    } catch {

        return {

            success: false,

            message:
                "Invalid server response"
        };
    }
};


// ======================================
// DELAY HELPER
// ======================================
const delay = (ms) =>

    new Promise(resolve =>
        setTimeout(resolve, ms)
    );


// ======================================
// SAFE FETCH WRAPPER
// ======================================
const apiRequest = async (

    endpoint,

    options = {},

    retryCount = 0

) => {

    const requestId =

        `${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)}`;


    const controller =
        new AbortController();


    const timeout =
        setTimeout(

            () => controller.abort(),

            API_TIMEOUT
        );


    const requestConfig = {

        ...DEFAULT_OPTIONS,

        ...options,

        headers: {

            ...DEFAULT_OPTIONS.headers,

            ...(options.headers || {})
        },

        signal:
            controller.signal
    };


    try {

        debugLog(
            "🌐 API REQUEST:",
            endpoint
        );


        const response = await fetch(

            `${API_BASE}${endpoint}`,

            requestConfig
        );


        clearTimeout(timeout);


        const data =
            await safeJsonParse(
                response
            );


        // ======================================
        // AUTH FAIL
        // ======================================
        if (
            response.status === 401
        ) {

            console.warn(
                "🔒 Unauthorized request"
            );
        }


        // ======================================
        // RESPONSE ERROR
        // ======================================
        if (!response.ok) {

            const error = {

                success: false,

                status:
                    response.status,

                message:

                    data.message ||

                    "Request failed",

                requestId
            };


            throw error;
        }


        return {

            success: true,

            ...data
        };

    } catch (error) {

        console.error(
            "❌ API ERROR:",
            {

                endpoint,

                error,

                requestId
            }
        );


        // ======================================
        // TIMEOUT
        // ======================================
        if (
            error.name ===
            "AbortError"
        ) {

            return {

                success: false,

                message:
                    "Request timeout",

                timeout: true
            };
        }


        // ======================================
        // AUTO RETRY
        // ======================================
        if (

            retryCount < MAX_RETRIES &&

            (
                error.message ===
                    "Failed to fetch" ||

                error.status >= 500
            )

        ) {

            debugLog(
                "🔄 Retrying request..."
            );

            await delay(1000);

            return apiRequest(

                endpoint,

                options,

                retryCount + 1
            );
        }


        return {

            success: false,

            message:

                error.message ||

                "Network error",

            status:
                error.status || 500
        };

    } finally {

        clearTimeout(timeout);
    }
};


// ======================================
// API METHODS
// ======================================
const API = {

    get: (endpoint) =>

        apiRequest(endpoint),


    post: (
        endpoint,
        body = {}
    ) =>

        apiRequest(

            endpoint,

            {

                method: "POST",

                body:
                    JSON.stringify(body)
            }
        ),


    put: (
        endpoint,
        body = {}
    ) =>

        apiRequest(

            endpoint,

            {

                method: "PUT",

                body:
                    JSON.stringify(body)
            }
        ),


    patch: (
        endpoint,
        body = {}
    ) =>

        apiRequest(

            endpoint,

            {

                method: "PATCH",

                body:
                    JSON.stringify(body)
            }
        ),


    delete: (endpoint) =>

        apiRequest(

            endpoint,

            {
                method: "DELETE"
            }
        )
};


// ======================================
// HEALTH CHECK
// ======================================
API.health = () =>

    API.get("/health");


// ======================================
// AUTH HELPERS
// ======================================
API.auth = {

    login: (data) =>

        API.post(
            "/auth/login",
            data
        ),

    signup: (data) =>

        API.post(
            "/auth/signup",
            data
        ),

    logout: () =>

        API.post(
            "/auth/logout"
        ),

    check: () =>

        API.get(
            "/auth/check"
        )
};


// ======================================
// DEBUG LOG
// ======================================
console.log(
    "🌐 API BASE:",
    API_BASE
);


// ======================================
// GLOBAL EXPORTS
// ======================================
window.API_BASE = API_BASE;

window.API = API;

window.apiRequest = apiRequest;

window.ENV = ENV;