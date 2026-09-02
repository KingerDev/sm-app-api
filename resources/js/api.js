// Jednoduchý API klient — session cookies + CSRF (Sanctum SPA)

const readCookie = (name) => {
    const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
};

let csrfReady = false;

async function ensureCsrf() {
    if (!csrfReady || !readCookie('XSRF-TOKEN')) {
        await fetch('/sanctum/csrf-cookie', { credentials: 'same-origin' });
        csrfReady = true;
    }
}

export class ApiError extends Error {
    constructor(status, payload) {
        super(payload?.message || `HTTP ${status}`);
        this.status = status;
        this.payload = payload;
        this.errors = payload?.errors || {};
    }
}

async function request(method, url, body) {
    if (method !== 'GET') await ensureCsrf();

    const isForm = body instanceof FormData;
    // Z webu ide fotka na server v origináli — na rozdiel od natívnej appky ju
    // pred odoslaním nič nezmenšuje, tak nech ju server ani neprekódováva.
    if (isForm && !body.has('full')) body.append('full', '1');
    const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            ...(method !== 'GET' ? { 'X-XSRF-TOKEN': readCookie('XSRF-TOKEN') } : {}),
            ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });

    if (res.status === 204) return null;

    const payload = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, payload);
    return payload;
}

export const api = {
    get: (url) => request('GET', `/api/v1${url}`),
    post: (url, body) => request('POST', `/api/v1${url}`, body),
    patch: (url, body) => request('PATCH', `/api/v1${url}`, body),
    delete: (url) => request('DELETE', `/api/v1${url}`),
};
