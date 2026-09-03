import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { reconcileMercadoPagoOrder } from "@/lib/mercadopago";
import { prisma } from "@/lib/prisma";

// Mercado Pago manda notificaciones firmadas:
//   header x-signature  -> "ts=<timestamp>,v1=<signature>"
//   header x-request-id -> id de la petición
// La cadena a firmar es: "id:<paymentId>;request-id:<x-request-id>;ts:<ts>;"
function verifyMPSignature(
    signature: string | null,
    requestId: string | null,
    dataId: string
): boolean {
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret || !signature || !requestId) return false;

    const parts: Record<string, string> = {};
    signature.split(",").forEach((part) => {
        const eq = part.indexOf("=");
        if (eq === -1) return;
        parts[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
    });

    const ts = parts["ts"];
    const v1 = parts["v1"];
    if (!ts || !v1) return false;

    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const expected = createHmac("sha256", secret).update(manifest).digest();
    const received = Buffer.from(v1, "hex");

    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
}

// El webhook culmina el cobro de pagos que quedaron "in_process" (el Card Form
// normalmente responde approved/rejected al momento, pero si MP se queda en
// proceso, es esta notificación la que lo termina). Nunca se confía en el
// webhook por sí solo: reconcileMercadoPagoOrder vuelve a preguntar el estado
// real a la API de MP antes de tocar la orden.
export async function POST(request: Request) {
    try {
        const rawBody = await request.text();
        const body = JSON.parse(rawBody);
        const { type, data } = body;
        if (type !== "payment" || !data?.id) {
            return NextResponse.json({ received: true });
        }

        const mpPaymentId = String(data.id);

        const signature = request.headers.get("x-signature");
        const requestId = request.headers.get("x-request-id");
        const isValid = verifyMPSignature(signature, requestId, mpPaymentId);

        if (!isValid) {
            console.warn("[MP_WEBHOOK] Firma inválida. Notificación ignorada:", mpPaymentId);
            // Respondemos 200 igual para que MP no reintente: ya quedó logueado.
            return NextResponse.json({ received: true, warning: "invalid_signature" });
        }

        const order = await prisma.order.findFirst({ where: { mpPaymentId } });
        if (!order) {
            return NextResponse.json({ received: true });
        }

        await reconcileMercadoPagoOrder(order.id);
        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error("[MP_WEBHOOK_ERROR]", error?.message || error);
        return NextResponse.json({ received: true });
    }
}

export async function GET() {
    return NextResponse.json({ ok: true });
}
