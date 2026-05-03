// Vercel Serverless Function — BillPlz Proxy
// File ni kena letak dalam folder /api/ dalam repo GitHub you

const SECRET_KEY = 'a811b5f5-a685-4eea-a4ba-db0f7c9777d5';
const SANDBOX    = false; // true = sandbox, false = production

const BILLPLZ_URL = SANDBOX
    ? 'https://www.billplz-sandbox.com/api/v3/bills'
    : 'https://www.billplz.com/api/v3/bills';

export default async function handler(req, res) {
    // Allow CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { collection_id, email, mobile, name, amount, description, redirect_url } = req.body;

    const required = { collection_id, email, mobile, name, amount, description, redirect_url };
    for (const [key, val] of Object.entries(required)) {
        if (!val) return res.status(400).json({ error: `Field '${key}' diperlukan.` });
    }

    const params = new URLSearchParams({
        collection_id,
        email,
        mobile,
        name,
        amount: String(amount),
        description,
        redirect_url,
        callback_url: redirect_url,
    });

    try {
        const authHeader = 'Basic ' + Buffer.from(SECRET_KEY + ':').toString('base64');

        const response = await fetch(BILLPLZ_URL, {
            method:  'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type':  'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        const data = await response.json();
        return res.status(response.status).json(data);

    } catch (err) {
        return res.status(500).json({ error: 'Gagal sambung ke BillPlz: ' + err.message });
    }
}
