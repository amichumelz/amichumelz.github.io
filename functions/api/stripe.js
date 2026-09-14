/**
 * Cloudflare Pages Function — /api/stripe
 *
 * Handles Stripe Checkout Session creation (POST) and verification (GET).
 *
 * Cloudflare Pages → Settings → Variables and Secrets:
 *   STRIPE_SECRET_KEY = sk_live_... (single line)
 *
 * Local preview: npx wrangler pages dev . --compatibility-date=2026-05-03
 *   Create .dev.vars with STRIPE_SECRET_KEY=...
 */

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

    const secretRaw = env.STRIPE_SECRET_KEY;
    const secret = typeof secretRaw === 'string' ? secretRaw.trim() : '';
    if (!secret) {
        return jsonResponse(
            { error: 'Server misconfigured: set STRIPE_SECRET_KEY in Cloudflare Pages Variables & Secrets.' },
            500
        );
    }

    // ─── GET /api/stripe?session_id=cs_... (Verify Session) ─────────────────
    if (request.method === 'GET') {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get('session_id');
        if (!sessionId) {
            return jsonResponse({ error: 'Missing session_id query parameter' }, 400);
        }

        try {
            const upstream = await fetch(`${STRIPE_API_BASE}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${secret}`,
                },
            });

            const text = await upstream.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                return jsonResponse({ error: 'Invalid response from Stripe', detail: text.slice(0, 300) }, 502);
            }

            if (!upstream.ok || data.error) {
                return jsonResponse({ error: data.error?.message || 'Failed to retrieve Stripe session' }, upstream.status);
            }

            return jsonResponse({
                paid: data.payment_status === 'paid',
                status: data.status,
                payment_status: data.payment_status,
                id: data.id,
                amount_total: data.amount_total,
                currency: data.currency,
                customer_email: data.customer_details?.email || data.customer_email || '',
                metadata: data.metadata || {},
            });
        } catch (err) {
            return jsonResponse({ error: err.message || 'Internal error retrieving session' }, 500);
        }
    }

    // ─── POST /api/stripe (Create Checkout Session) ──────────────────────────
    if (request.method === 'POST') {
        let body;
        try {
            body = await request.json();
        } catch {
            return jsonResponse({ error: 'Invalid JSON body' }, 400);
        }

        const { email, name, mobile, redirect_url, cart, amount, description, hotelPickup } = body;
        if (!email || !redirect_url) {
            return jsonResponse({ error: "Fields 'email' and 'redirect_url' are required." }, 400);
        }

        const params = new URLSearchParams();
        params.append('mode', 'payment');
        params.append('payment_method_types[0]', 'card');
        params.append('customer_email', String(email).trim());

        if (name) params.append('metadata[customer_name]', String(name).trim());
        if (mobile) params.append('metadata[customer_phone]', String(mobile).trim());
        if (hotelPickup) params.append('metadata[hotel_pickup]', String(hotelPickup).slice(0, 500));
        if (description) params.append('metadata[booking_desc]', String(description).slice(0, 500));

        const cleanRedirect = String(redirect_url).split('?')[0].split('#')[0];
        params.append('success_url', `${cleanRedirect}?stripe_return=1&session_id={CHECKOUT_SESSION_ID}`);
        params.append('cancel_url', `${cleanRedirect}?stripe_cancel=1`);

        if (Array.isArray(cart) && cart.length > 0) {
            cart.forEach((item, index) => {
                params.append(`line_items[${index}][price_data][currency]`, 'myr');
                params.append(`line_items[${index}][price_data][unit_amount]`, String(item.cents || 0));
                const itemTitle = (item.title || 'Tour item') + (item.variant ? ` (${item.variant})` : '');
                params.append(`line_items[${index}][price_data][product_data][name]`, itemTitle.slice(0, 250));

                const descBits = [];
                if (item.date) descBits.push(`Date: ${item.date}`);
                if (item.time) descBits.push(`Time: ${item.time}`);
                if (item.isDeposit) descBits.push('Deposit only');
                if (descBits.length > 0) {
                    params.append(`line_items[${index}][price_data][product_data][description]`, descBits.join(' · ').slice(0, 400));
                }
                params.append(`line_items[${index}][quantity]`, '1');
            });
        } else if (amount) {
            params.append('line_items[0][price_data][currency]', 'myr');
            params.append('line_items[0][price_data][unit_amount]', String(amount));
            params.append('line_items[0][price_data][product_data][name]', String(description || 'Alif Langkawi booking').slice(0, 250));
            params.append('line_items[0][quantity]', '1');
        } else {
            return jsonResponse({ error: 'Cart items or amount required.' }, 400);
        }

        try {
            const upstream = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${secret}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString(),
            });

            const text = await upstream.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                return jsonResponse({ error: 'Invalid response from Stripe', detail: text.slice(0, 300) }, 502);
            }

            if (!upstream.ok || data.error) {
                const errMsg = data.error?.message || `Stripe error (${upstream.status})`;
                return jsonResponse({ error: errMsg }, upstream.status);
            }

            return jsonResponse({
                id: data.id,
                url: data.url,
            });
        } catch (err) {
            return jsonResponse({ error: err.message || 'Internal error connecting to Stripe' }, 500);
        }
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
}
