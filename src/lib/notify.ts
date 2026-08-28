// Shared SMS helper — same Twilio pattern already used in forgot-password.
// Falls back to a console log ("simulated SMS") when Twilio env vars are
// missing, so the app keeps working locally / before Twilio is configured.

function formatMxPhone(raw: string): string {
    const cleaned = raw.replace(/[^\d]/g, "");
    if (cleaned.length === 10) return `+52${cleaned}`;
    if (raw.startsWith("+")) return raw;
    return `+${cleaned}`;
}

export async function sendSms(phone: string, body: string): Promise<boolean> {
    if (!phone) return false;

    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const twilio = require("twilio");
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            await client.messages.create({
                body,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: formatMxPhone(phone),
            });
            return true;
        } catch (err) {
            console.error("[SMS ERROR]", err);
            return false;
        }
    }

    console.log(`[SIMULATED SMS] to ${phone}: ${body}`);
    return false;
}

const STATUS_MESSAGES: Record<string, string> = {
    PREPARING: "estamos preparando tu pedido",
    OUT_FOR_DELIVERY: "tu pedido va en camino",
    COMPLETED: "tu pedido fue entregado, ¡gracias por tu compra!",
    CANCELLED: "tu pedido fue cancelado",
};

export async function notifyOrderStatus(order: { id: string; status: string }, phone: string | null | undefined) {
    if (!phone) return;
    const text = STATUS_MESSAGES[order.status];
    if (!text) return; // no message configured for this status (e.g. PENDING)

    const folio = order.id.slice(-6).toUpperCase();
    await sendSms(phone, `Cremeria del Rancho: Pedido #${folio}, ${text}.`);
}
