/**
 * Cloudflare Pages Function — POST /api/billplz
 *
 * Cloudflare Dashboard → Workers & Pages → [your project] → Settings → Variables:
 *   BILLPLZ_SECRET_KEY = (your Billplz secret key)
 *   BILLPLZ_SANDBOX    = true | false   (optional; default false = production API)
 *
 * Local preview: npx wrangler pages dev . --compatibility-date=2024-01-01
 *   Create .dev.vars with BILLPLZ_SECRET_KEY=...
 */

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
            return jsonResponse({ error: `Field '${key}' diperlukan.` }, 400);
        }
    }

    const secret = env.BILLPLZ_SECRET_KEY;
    if (!secret || typeof secret !== 'string') {
        return jsonResponse({ error: 'Pelayan belum set BILLPLZ_SECRET_KEY dalam Cloudflare.' }, 500);
    }

    const sandbox = env.BILLPLZ_SANDBOX === 'true' || env.BILLPLZ_SANDBOX === '1';
    const billplzUrl = sandbox
        ? 'https://www.billplz-sandbox.com/api/v3/bills'
        : 'https://www.billplz.com/api/v3/bills';

    const params = new URLSearchParams({
        collection_id: body.collection_id,
        email: body.email,
        mobile: body.mobile,
        name: body.name,
        amount: String(body.amount),
        description: body.description,
        redirect_url: body.redirect_url,
        callback_url: body.redirect_url,
    });

    const authHeader = 'Basic ' + btoa(`${secret}:`);

    const upstream = await fetch(billplzUrl, {
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
            { error: 'Respons Billplz tidak sah', detail: text.slice(0, 300) },
            502
        );
    }

    return new Response(JSON.stringify(data), {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json', ...cors },
    });
}
