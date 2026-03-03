import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHmac } from "crypto";

// ── Mercado Pago Webhook Signature Verification ──
// MP sends: x-signature header with format: ts=<timestamp>,v1=<signature>
// and: x-request-id header
// Signed string: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
function verifyMPSignature(
    rawBody: string,
    signature: string | null,
    requestId: string | null,
    dataId: string
): boolean {
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret || !signature || !requestId) return false;

    // Parse ts and v1 from signature header
    const parts: Record<string, string> = {};
    signature.split(",").forEach(part => {
        const [k, v] = part.split("=");
        parts[k.trim()] = v?.trim();
    });

    const ts = parts["ts"];
    const v1 = parts["v1"];
    if (!ts || !v1) return false;

    // Build the manifest string
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;

    // Compute HMAC-SHA256
    const expected = createHmac("sha256", secret).update(manifest).digest("hex");

    return expected === v1;
}

export async function POST(request: Request) {
    try {
        const rawBody = await request.text();
        const body = JSON.parse(rawBody);
        console.log("[MP Webhook] Recibido:", JSON.stringify(body));

        const { type, data } = body;

        if (type !== "payment" || !data?.id) {
            return NextResponse.json({ received: true });
        }

        const mpPaymentId = String(data.id);

        // ── Verify signature ──
        const signature = request.headers.get("x-signature");
        const requestId = request.headers.get("x-request-id");
        const isValid = verifyMPSignature(rawBody, signature, requestId, mpPaymentId);

        if (!isValid) {
            console.warn("[MP Webhook] ⚠️  Firma inválida — ignorando notificación");
            // Return 200 anyway so MP doesn't keep retrying (we already logged it)
            return NextResponse.json({ received: true, warning: "invalid_signature" });
        }

        console.log("[MP Webhook] ✅ Firma válida. Verificando pago con MP API...");

        // ── Verify payment status directly from MP ──
        const mpRes = await fetch(
            `https://api.mercadopago.com/v1/payments/${mpPaymentId}`,
            { headers: { "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}` } }
        );
        const payment = await mpRes.json();
        console.log("[MP Webhook] Payment verificado:", {
            id: payment.id,
            status: payment.status,
            status_detail: payment.status_detail,
        });

        const mpStatus = payment.status; // approved | rejected | in_process | cancelled

        let paymentStatus: string;
        if (mpStatus === "approved") {
            paymentStatus = "APPROVED";
        } else if (mpStatus === "rejected" || mpStatus === "cancelled") {
            paymentStatus = "REJECTED";
        } else {
            paymentStatus = "PENDING";
        }

        // ── Find and update the order ──
        const order = await prisma.order.findFirst({
            where: { mpPaymentId },
        });

        if (!order) {
            console.warn("[MP Webhook] No se encontró orden con mpPaymentId:", mpPaymentId);
            return NextResponse.json({ received: true });
        }

        const updateData: any = { paymentStatus };

        if (paymentStatus === "REJECTED") {
            // Cancel order and restore stock
            updateData.status = "CANCELLED";
            const orderItems = await prisma.orderItem.findMany({
                where: { orderId: order.id },
            });
            for (const item of orderItems) {
                await prisma.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: item.quantity } },
                });
            }
            console.log(`[MP Webhook] ❌ Pago rechazado. Orden ${order.id} cancelada, stock restaurado.`);
        } else if (paymentStatus === "APPROVED") {
            console.log(`[MP Webhook] ✅ Pago aprobado. Orden ${order.id} confirmada.`);
        }

        await prisma.order.update({
            where: { id: order.id },
            data: updateData,
        });

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error("[MP Webhook] Error:", error?.message);
        return NextResponse.json({ received: true });
    }
}

export async function GET() {
    return NextResponse.json({ ok: true });
}
