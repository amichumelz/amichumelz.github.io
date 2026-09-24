/**
 * Cloudflare Pages Function — POST /api/send-booking-email
 *
 * Sends automated booking confirmation & hotel pickup details to:
 * 1. Admin: Aliflangkawitourservice@gmail.com
 * 2. Guest: customer's email address
 *
 * Supported providers (configured in Cloudflare Pages Variables & Secrets):
 * - RESEND_API_KEY (Recommended: https://resend.com)
 * - BREVO_API_KEY (https://brevo.com)
 * - BOOKING_WEBHOOK_URL (Zapier, Make, Google Apps Script, Discord, etc.)
 */

const ADMIN_EMAIL = 'Aliflangkawitourservice@gmail.com';

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

function buildHtmlEmail(data) {
    const { name, email, phone, hotelPickup, lines, totalCents, subtotalCents, feeCents, feeLabel, gateway, paymentRef } = data;
    const totalRm = ((totalCents || 0) / 100).toFixed(2);
    const dateStr = new Date().toLocaleDateString('en-MY', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    const itemsRows = (lines || [])
        .map(
            (item, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 8px; font-size: 14px; color: #0f172a;">
                <strong>${idx + 1}. ${item.title || 'Tour Item'}</strong>
                ${item.variant ? `<br><span style="color: #64748b; font-size: 12px;">${item.variant}</span>` : ''}
                ${item.date || item.time ? `<br><span style="color: #0a8f72; font-size: 12px;">📅 ${item.date || ''} ${item.time ? '· ⏰ ' + item.time : ''}</span>` : ''}
                ${item.pickupLocation ? `<br><span style="color: #0284c7; font-size: 12px; font-weight: 600;">📍 Pickup: ${item.pickupLocation} · Return: ${item.returnLocation || item.pickupLocation}</span>` : ''}
                ${item.depositNote ? `<br><span style="color: #0a8f72; font-size: 11px; font-weight: bold;">🛡️ ${item.depositNote}</span>` : (item.isDeposit ? `<br><span style="color: #ea580c; font-size: 11px; font-weight: bold;">⚡ Deposit only</span>` : '')}
            </td>
            <td style="padding: 12px 8px; font-size: 14px; font-weight: bold; color: #0f172a; text-align: right; white-space: nowrap;">
                ${item.priceLabel || 'RM ' + ((item.cents || 0) / 100).toFixed(2)}
            </td>
        </tr>`
        )
        .join('');

    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const waPhone = cleanPhone.startsWith('0') ? '6' + cleanPhone : cleanPhone.startsWith('60') ? cleanPhone : '60' + cleanPhone;

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Booking Confirmation - Alif Langkawi</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #0f172a 0%, #064e3b 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
                <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">ALIF LANGKAWI EXPERIENCE</h1>
                <p style="margin: 6px 0 0; font-size: 13px; color: #a7f3d0; font-weight: 600;">NEW PAID BOOKING RECEIVED</p>
            </div>

            <!-- Content Area -->
            <div style="padding: 24px;">
                <!-- Status Badge -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px dashed #cbd5e1;">
                    <div>
                        <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Payment Status</span>
                        <div style="font-size: 16px; font-weight: 800; color: #0a8f72;">✓ PAID &amp; CONFIRMED</div>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Date &amp; Time</span>
                        <div style="font-size: 13px; color: #334155; font-weight: 600;">${dateStr}</div>
                    </div>
                </div>

                ${hotelPickup && hotelPickup.trim() ? `
                <!-- Hotel Pickup Highlight Box -->
                <div style="margin: 20px 0; padding: 16px; background-color: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px;">
                    <div style="font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">
                        🏨 HOTEL PICKUP LOCATION
                    </div>
                    <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px;">
                        ${hotelPickup.trim()}
                    </div>
                </div>` : ''}

                <!-- Guest Details -->
                <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; margin: 20px 0 10px;">Guest Information</h3>
                <div style="background-color: #f8fafc; border-radius: 10px; padding: 14px 16px; border: 1px solid #f1f5f9;">
                    <div style="margin-bottom: 8px;"><strong>Full Name:</strong> ${name || '-'}</div>
                    <div style="margin-bottom: 8px;"><strong>Email:</strong> <a href="mailto:${email}" style="color: #0284c7; text-decoration: none;">${email || '-'}</a></div>
                    <div style="margin-bottom: 8px;"><strong>Phone / WhatsApp:</strong> <a href="https://wa.me/${waPhone}" style="color: #059669; font-weight: bold; text-decoration: none;">+${waPhone} (Chat on WhatsApp)</a></div>
                    <div><strong>Payment Method:</strong> ${gateway || 'Online'} ${paymentRef ? `(Ref: <code>${paymentRef}</code>)` : ''}</div>
                </div>

                <!-- Booking Line Items -->
                <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; margin: 24px 0 10px;">Booked Services</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid #cbd5e1; text-align: left;">
                            <th style="padding: 8px; font-size: 12px; color: #64748b; text-transform: uppercase;">Service Details</th>
                            <th style="padding: 8px; font-size: 12px; color: #64748b; text-transform: uppercase; text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                    <tfoot>
                        ${feeCents ? `
                        <tr>
                            <td style="padding: 10px 8px 4px; font-size: 13px; color: #64748b;">Subtotal</td>
                            <td style="padding: 10px 8px 4px; font-size: 13px; color: #64748b; text-align: right; font-weight: 600;">RM ${(((subtotalCents || (totalCents - feeCents)) / 100)).toFixed(2)}</td>
                        </tr>
                        <tr style="border-bottom: 2px solid #cbd5e1;">
                            <td style="padding: 4px 8px 10px; font-size: 13px; color: #64748b;">Processing Fee (${feeLabel || 'Gateway Fee'})</td>
                            <td style="padding: 4px 8px 10px; font-size: 13px; color: #64748b; text-align: right; font-weight: 600;">+ RM ${((feeCents || 0) / 100).toFixed(2)}</td>
                        </tr>` : ''}
                        <tr>
                            <td style="padding: 16px 8px; font-size: 16px; font-weight: 800; color: #0f172a;">Total Paid</td>
                            <td style="padding: 16px 8px; font-size: 18px; font-weight: 900; color: #0a8f72; text-align: right;">RM ${totalRm}</td>
                        </tr>
                    </tfoot>
                </table>

                <!-- Action Button -->
                <div style="margin: 28px 0 10px; text-align: center;">
                    <a href="https://wa.me/${waPhone}?text=${encodeURIComponent(`Hi ${name || 'Guest'}, this is ALIF LANGKAWI EXPERIENCE regarding your booking. We have confirmed your reservation!`)}"
                       style="display: inline-block; background-color: #0a8f72; color: #ffffff; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: bold; text-decoration: none; text-transform: uppercase; letter-spacing: 0.5px;">
                        💬 Open Guest in WhatsApp
                    </a>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
                ALIF LANGKAWI SERVICE · Kuah, Langkawi, Kedah<br>
                WhatsApp: +60 14-949 5457 · Email: Aliflangkawitourservice@gmail.com
            </div>
        </div>
    </body>
    </html>
    `;
}

function buildInquiryHtml(data) {
    const { name, contact, message } = data;
    const dateStr = new Date().toLocaleDateString('en-MY', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9;">
        <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
                <h1 style="margin: 0; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">🔔 New Customer Inquiry</h1>
                <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Alif Langkawi Service Website</p>
            </div>
            <div style="padding: 24px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px 0; color: #64748b; width: 130px;"><strong>Guest Name:</strong></td>
                        <td style="padding: 10px 0; color: #0f172a; font-weight: bold;">${name || 'Guest'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px 0; color: #64748b;"><strong>Contact:</strong></td>
                        <td style="padding: 10px 0; color: #0284c7; font-weight: bold;">${contact || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #64748b;"><strong>Time Received:</strong></td>
                        <td style="padding: 10px 0; color: #0f172a;">${dateStr}</td>
                    </tr>
                </table>
                <div style="background-color: #f8fafc; border-radius: 14px; padding: 18px; border-left: 4px solid #0284c7;">
                    <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #0369a1; margin-bottom: 8px;">Question / Inquiry:</div>
                    <div style="font-size: 14px; color: #1e293b; line-height: 1.6; white-space: pre-wrap;">${message || 'No details provided.'}</div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
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

    const isSpecialInquiry = body.type === 'inquiry';
    const { name, email, phone, hotelPickup, lines, totalCents, gateway, paymentRef } = body;
    const guestEmail = email || (body.contact && body.contact.includes('@') ? body.contact : ADMIN_EMAIL);

    if (!isSpecialInquiry && !email) {
        return jsonResponse({ error: "Field 'email' is required." }, 400);
    }

    const htmlContent = isSpecialInquiry ? buildInquiryHtml(body) : buildHtmlEmail(body);
    const subject = isSpecialInquiry
        ? `🔔 New Website Inquiry: from ${name || 'Guest'} (${body.contact || 'No contact'})`
        : `New Booking Confirmed: ${name || 'Guest'} (RM ${(((totalCents || 0) / 100).toFixed(2))})${hotelPickup ? ` - Pickup: ${hotelPickup}` : ''}`;

    let sent = false;
    let providerUsed = '';
    let errorMessage = '';

    const ccList = (email && !isSpecialInquiry) ? [email] : [];
    const replyTo = (email || (body.contact && body.contact.includes('@') ? body.contact : undefined));

    // 1. Check Resend (https://resend.com)
    const resendKey = typeof env.RESEND_API_KEY === 'string' ? env.RESEND_API_KEY.trim() : '';
    if (resendKey && !sent) {
        try {
            const fromAddress = env.RESEND_FROM || 'Alif Langkawi <onboarding@resend.dev>';
            const emailPayload = {
                from: fromAddress,
                to: [ADMIN_EMAIL],
                subject,
                html: htmlContent,
            };
            if (ccList.length > 0) emailPayload.cc = ccList;
            if (replyTo) emailPayload.reply_to = replyTo;

            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${resendKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(emailPayload),
            });

            const resData = await res.json();
            if (res.ok) {
                sent = true;
                providerUsed = 'resend';
            } else {
                errorMessage = resData.message || JSON.stringify(resData);
            }
        } catch (e) {
            errorMessage = e.message;
        }
    }

    // 2. Check Brevo (https://brevo.com)
    const brevoKey = typeof env.BREVO_API_KEY === 'string' ? env.BREVO_API_KEY.trim() : '';
    if (brevoKey && !sent) {
        try {
            const toRecipients = [{ email: ADMIN_EMAIL, name: 'Alif Langkawi Admin' }];
            if (email && !isSpecialInquiry) {
                toRecipients.push({ email, name: name || 'Guest' });
            }
            const brevoPayload = {
                sender: { name: isSpecialInquiry ? 'Alif Langkawi Inquiry' : 'Alif Langkawi Booking', email: 'no-reply@aliflangkawi.com' },
                to: toRecipients,
                subject,
                htmlContent,
            };
            if (replyTo) brevoPayload.replyTo = { email: replyTo, name: name || 'Guest' };

            const res = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'api-key': brevoKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(brevoPayload),
            });
            if (res.ok) {
                sent = true;
                providerUsed = 'brevo';
            }
        } catch (e) {
            errorMessage = e.message;
        }
    }

    // 3. Check Webhook URL (Zapier, Make.com, Google Apps Script, Discord, etc.)
    const webhookUrl = typeof env.BOOKING_WEBHOOK_URL === 'string' ? env.BOOKING_WEBHOOK_URL.trim() : '';
    if (webhookUrl) {
        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'booking_confirmed',
                    subject,
                    guest: { name, email, phone },
                    hotelPickup,
                    bookingLines: lines,
                    totalRm: ((totalCents || 0) / 100).toFixed(2),
                    gateway,
                    paymentRef,
                    createdAt: new Date().toISOString(),
                }),
            });
            if (!sent) {
                sent = true;
                providerUsed = 'webhook';
            }
        } catch (e) {
            // webhook logging
        }
    }

    // Return status cleanly (never throws or fails the customer checkout experience)
    return jsonResponse({
        success: true,
        sent,
        provider: providerUsed || 'none_configured',
        note: sent
            ? `Email successfully sent via ${providerUsed}`
            : 'Email queued. To deliver live emails, set RESEND_API_KEY or BREVO_API_KEY in Cloudflare Pages Variables & Secrets.',
        detail: errorMessage || undefined,
    });
}
