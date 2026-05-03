/**
 * Cloudflare Worker — proxy Billplz (kunci rahsia dalam Workers Secrets sahaja)
 *
 * Deploy: cd repo root → npx wrangler deploy
 * Secret:  npx wrangler secret put BILLPLZ_SECRET_KEY
 *
 * Pilihan env (wrangler.toml [vars]): BILLPLZ_SANDBOX = "true" | "false"
 */

export default {
    async fetch(request, env) {
        const cors = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: cors });
        }

        if (request.method !== 'POST') {
            return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors });
        }

        const secret = env.BILLPLZ_SECRET_KEY;
        if (!secret) {
            return Response.json(
                { error: 'Set secret BILLPLZ_SECRET_KEY in Worker (wrangler secret put)' },
                { status: 500, headers: cors }
            );
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: cors });
        }

        const required = ['collection_id', 'email', 'mobile', 'name', 'amount', 'description', 'redirect_url'];
        for (const key of required) {
            if (body[key] == null || body[key] === '') {
                return Response.json({ error: `Field '${key}' diperlukan.` }, { status: 400, headers: cors });
            }
        }

        const sandbox = env.BILLPLZ_SANDBOX === 'true' || env.BILLPLZ_SANDBOX === '1';
        const host = sandbox ? 'www.billplz-sandbox.com' : 'www.billplz.com';

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

        const authHeader = 'Basic ' + btoa(secret + ':');

        const billRes = await fetch(`https://${host}/api/v3/bills`, {
            method: 'POST',
            headers: {
                Authorization: authHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        const text = await billRes.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            return Response.json(
                { error: 'Respons Billplz tidak sah', detail: text.slice(0, 300) },
                { status: 502, headers: cors }
            );
        }

        return new Response(JSON.stringify(data), {
            status: billRes.status,
            headers: {
                ...cors,
                'Content-Type': 'application/json',
            },
        });
    },
};
