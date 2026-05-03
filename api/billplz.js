// Vercel Serverless Function — BillPlz Proxy
// Letak dalam folder /api/ dalam repo GitHub

const https = require('https');
const querystring = require('querystring');

const SECRET_KEY = 'a811b5f5-a685-4eea-a4ba-db0f7c9777d5';
const SANDBOX    = false; // true = sandbox, false = production

const BILLPLZ_HOST = SANDBOX
    ? 'www.billplz-sandbox.com'
    : 'www.billplz.com';

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { collection_id, email, mobile, name, amount, description, redirect_url } = req.body || {};

    for (const [key, val] of Object.entries({ collection_id, email, mobile, name, amount, description, redirect_url })) {
        if (!val) return res.status(400).json({ error: `Field '${key}' diperlukan.` });
    }

    const postData = querystring.stringify({
        collection_id,
        email,
        mobile,
        name,
        amount:       String(amount),
        description,
        redirect_url,
        callback_url: redirect_url,
    });

    const authHeader = 'Basic ' + Buffer.from(SECRET_KEY + ':').toString('base64');

    return new Promise((resolve) => {
        const options = {
            hostname: BILLPLZ_HOST,
            path:     '/api/v3/bills',
            method:   'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type':  'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        const request = https.request(options, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    res.status(response.statusCode).json(parsed);
                } catch {
                    res.status(500).json({ error: 'Respons BillPlz tidak sah: ' + data });
                }
                resolve();
            });
        });

        request.on('error', (err) => {
            res.status(500).json({ error: 'Gagal sambung ke BillPlz: ' + err.message });
            resolve();
        });

        request.write(postData);
        request.end();
    });
};
