// ─────────────────────────────────────────────────────────────────────────────
// Mercado Pago (lado servidor).
//
// Se habla con la API pública de Mercado Pago por HTTP directo (sin el paquete
// npm "mercadopago") para no meter una dependencia más: los endpoints que usa
// esta app son estables (crear pago y consultar estado) y el resto del código
// ya prefiere fetch + Node para sus pasarelas.
//
// La clave de acceso (access_token) NUNCA se expone al cliente; solo viaja del
// servidor a api.mercadopago.com. El navegador nunca toca estas funciones.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";

const MP_API = "https://api.mercadopago.com";

function getAccessToken(): string {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error("Mercado Pago no está configurado (falta MP_ACCESS_TOKEN)");
    return token;
}

type MPStatus = "approved" | "in_process" | "rejected" | "cancelled" | "pending" | "refunded";

// Traduce el estado real de Mercado Pago al paymentStatus que guarda nuestra
// Order (mismos valores que usan Stripe/Conekta para no duplicar lógica).
function mapMPStatus(status: MPStatus): "APPROVED" | "REJECTED" | "PENDING" {
    if (status === "approved") return "APPROVED";
    if (status === "rejected" || status === "cancelled" || status === "refunded") return "REJECTED";
    return "PENDING"; // in_process, pending, etc.
}

// ── Tipos mínimos con lo que usa esta app de una respuesta de pago de MP ──
export type MPPayment = {
    id: string | number;
    status: MPStatus;
    status_detail?: string;
    transaction_amount?: number;
};

// Crea un cargo de tarjeta contra la API de Mercado Pago usando el token que
// generó el Card Form en el navegador (el número/CVC nunca llega aquí).
export async function createMercadoPagoPayment(params: {
    token: string;
    transactionAmount: number;
    description: string;
    installments?: number;
    paymentMethodId?: string;
    payerEmail?: string;
    payerFirstName?: string;
    payerLastName?: string;
    // Fingerprint del dispositivo (MP_DEVICE_SESSION_ID) recolectado por el
    // script de seguridad de MP. Sin señal de dispositivo, el antifraude de MP
    // tiene poca data y suele rechazar pagos legítimos como alto riesgo.
    deviceSessionId?: string;
    // IP real del cliente (Vercel la manda en x-forwarded-for).
    ipAddress?: string;
}): Promise<MPPayment> {
    const body: Record<string, unknown> = {
        transaction_amount: params.transactionAmount,
        token: params.token,
        description: params.description || "Pedido Cremería del Rancho",
        installments: Number(params.installments) || 1,
        payer: {
            email: params.payerEmail || "cliente@cremeriadelrancho.com",
            ...(params.payerFirstName ? { first_name: params.payerFirstName } : {}),
            ...(params.payerLastName ? { last_name: params.payerLastName } : {}),
        },
        ...(params.paymentMethodId ? { payment_method_id: params.paymentMethodId } : {}),
        ...(params.ipAddress ? { additional_info: { ip_address: params.ipAddress, items: [] as unknown[] } } : {}),
    };

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAccessToken()}`,
    };
    // La sesión de dispositivo se manda en la cabecera que usa el antifraude de
    // Mercado Pago para no rechazar pagos legítimos como alto riesgo.
    if (params.deviceSessionId) headers["X-Meli-Session-Id"] = params.deviceSessionId;

    const res = await fetch(`${MP_API}/v1/payments`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });

    const data = (await res.json()) as MPPayment & { message?: string; error?: string };

    if (!res.ok) {
        console.error("[MP_CREATE_PAYMENT_ERROR]", JSON.stringify(data));
        const cause: any = (data as any)?.cause?.[0];
        const detail =
            cause?.description ||
            (data as any)?.status_detail ||
            data?.message ||
            data?.error ||
            "Error al procesar el pago";
        throw new Error(String(detail));
    }

    return data as MPPayment;
}

// Reverifica el estado real de un pago de MP directamente contra su API (nunca
// confía en lo que dice un webhook o el navegador por sí solos) y actualiza la
// Order. Idempotente -- se puede llamar con seguridad varias veces y no
// duplica efectos: si la orden ya llegó a APPROVED o REJECTED, ya no toca nada.
export async function reconcileMercadoPagoOrder(orderId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || !order.mpPaymentId) return null;
    if (order.paymentStatus !== "PENDING") return order; // ya resuelto

    const res = await fetch(`${MP_API}/v1/payments/${order.mpPaymentId}`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    if (!res.ok) {
        console.error("[MP_RECONCILE_ERROR]", res.status, await res.text());
        return order;
    }
    const payment = (await res.json()) as MPPayment;

    const newStatus = mapMPStatus(payment.status);
    if (payment.status === "in_process" || payment.status === "pending") {
        return order; // sigue pendiente; lo culminará el webhook
    }

    return prisma.$transaction(async (tx) => {
        const updated = await tx.order.update({
            where: { id: orderId },
            data: { paymentStatus: newStatus },
        });

        // Si el pago se rechazó/canceló después de haber apartado stock al
        // crear la orden PENDING, hay que devolver ese stock.
        if (newStatus === "REJECTED") {
            const items = await tx.orderItem.findMany({ where: { orderId } });
            for (const item of items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: item.quantity } },
                });
            }
        }

        return updated;
    });
}
