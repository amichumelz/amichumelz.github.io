/**
 * Cloudflare Pages Function — POST /api/billplz
 *
 * Billplz PRODUCTION only (www.billplz.com).
 *
 * Cloudflare Pages → Settings → Variables and Secrets:
 *   BILLPLZ_SECRET_KEY = production secret from https://www.billplz.com (single line)
 *
 * Local preview: npx wrangler pages dev . --compatibility-date=2026-05-03
 *   Create .dev.vars with BILLPLZ_SECRET_KEY=...
 */

const BILLPLZ_BILLS_URL = 'https://www.billplz.com/api/v3/bills';

const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors },
    });
}

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors });
    }

    if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const required = ['collection_id', 'email', 'mobile', 'name', 'amount', 'description', 'redirect_url'];
    for (const key of required) {
        const val = body[key];
        if (val === undefined || val === null || val === '') {
            return jsonResponse({ error: `Field '${key}' is required.` }, 400);
        }
    }

    const secretRaw = env.BILLPLZ_SECRET_KEY;
    const secret = typeof secretRaw === 'string' ? secretRaw.trim() : '';
    if (!secret) {
        return jsonResponse({ error: 'Server misconfigured: set BILLPLZ_SECRET_KEY in Cloudflare.' }, 500);
    }

    const trim = (v) => (typeof v === 'string' ? v.trim() : String(v ?? '').trim());

    const params = new URLSearchParams({
        collection_id: trim(body.collection_id),
        email: trim(body.email),
        mobile: trim(body.mobile),
        name: trim(body.name),
        amount: String(body.amount).trim(),
        description: trim(body.description),
        redirect_url: trim(body.redirect_url),
        callback_url: trim(body.redirect_url),
    });

    const authHeader = 'Basic ' + btoa(`${secret}:`);

    const upstream = await fetch(BILLPLZ_BILLS_URL, {
        method: 'POST',
        headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
    });

    const text = await upstream.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        return jsonResponse(
            { error: 'Invalid response from Billplz', detail: text.slice(0, 300) },
            502
        );
    }

    return new Response(JSON.stringify(data), {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json', ...cors },
    });
}
