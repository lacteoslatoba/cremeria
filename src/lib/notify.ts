// Shared SMS helper — same Twilio pattern already used in forgot-password.
// Falls back to a console log ("simulated SMS") when Twilio env vars are
// missing, so the app keeps working locally / before Twilio is configured.

function formatMxPhone(raw: string): string {
    const cleaned = raw.replace(/[^\d]/g, "");
    if (cleaned.length === 10) return `+52${cleaned}`;
    if (raw.startsWith("+")) return raw;
    return `+${cleaned}`;
}

// WhatsApp NO usa el mismo formato que SMS en Mexico: los moviles conservan el
// "1" historico en su identidad de WhatsApp (+521 + 10 digitos), mientras que
// para SMS ese "1" ya se elimino (+52 + 10). Mandar al formato de SMS hace que
// Twilio conteste 63015 ("can only send messages to phone numbers that have
// joined the Sandbox"), que suena a opt-in faltante pero es el numero
// equivocado. Comprobado contra la API con el mismo telefono y el mismo
// instante: con el 1 llega "delivered", sin el 1 falla con 63015.
export function formatMxPhoneWhatsApp(raw: string): string {
    const cleaned = raw.replace(/[^\d]/g, "");
    const conUno = (diezDigitos: string) => `+521${diezDigitos}`;
    if (cleaned.length === 10) return conUno(cleaned);
    if (cleaned.length === 12 && cleaned.startsWith("52")) return conUno(cleaned.slice(2));
    if (cleaned.length === 13 && cleaned.startsWith("521")) return `+${cleaned}`;
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

// Mismo patrón que sendSms pero por WhatsApp -- usa las credenciales de
// Twilio ya configuradas más un remitente de WhatsApp aparte
// (TWILIO_WHATSAPP_NUMBER, sin el prefijo "whatsapp:", p. ej. el número
// del sandbox de Twilio mientras se aprueba el número de WhatsApp
// Business para producción).
export async function sendWhatsAppCode(phone: string, code: string): Promise<boolean> {
    if (!phone) return false;
    const body = `Cremeria del Rancho: tu codigo de verificacion es ${code}. Expira en 10 minutos.`;

    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const twilio = require("twilio");
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            await client.messages.create({
                body,
                from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
                to: `whatsapp:${formatMxPhoneWhatsApp(phone)}`,
            });
            return true;
        } catch (err) {
            console.error("[WHATSAPP ERROR]", err);
            return false;
        }
    }

    console.log(`[SIMULATED WHATSAPP] to ${phone}: ${body}`);
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

// Notifica al cliente el CÓDIGO de verificación de entrega cuando levanta su
// compra (pago aprobado). Deberá mostrarlo al repartidor para que confirme
// que la entrega se realiza a la persona correcta.
export async function notifyDeliveryCode(order: { id: string; deliveryCode?: string | null }, phone: string | null | undefined) {
    if (!phone || !order.deliveryCode) return;
    const folio = order.id.slice(-6).toUpperCase();
    await sendSms(
        phone,
        `Cremeria del Rancho: Pedido #${folio}. Tu codigo de entrega es: ${order.deliveryCode}. Compartelo con tu repartidor al recibir tu pedido.`
    );
}
