import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN!,
});

// Normaliza IDs como "debvisa" → "visa", "debmaster" → "master"
function normalizePaymentMethodId(id: string): string {
    if (!id) return id;
    const map: Record<string, string> = {
        debvisa: "visa",
        debmaster: "master",
        debcabal: "cabal",
        debnaranja: "naranja",
        debit_card: "visa",
    };
    return map[id.toLowerCase()] ?? id.toLowerCase();
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            // Flujo normal (token nuevo)
            token,
            // Flujo tarjeta guardada (customer + card)
            customerId,
            cardId,
            // Comunes
            amount,
            description,
            payerEmail,
            payerName,
            installments,
            paymentMethodId,
        } = body;

        const accessToken = process.env.MP_ACCESS_TOKEN!;
        let finalToken = token;
        let finalPaymentMethodId = normalizePaymentMethodId(paymentMethodId || "");

        // ── Si se paga con tarjeta guardada: crear nuevo token desde customer+card ──
        if (!finalToken && customerId && cardId) {
            console.log("[MP] Creando token desde tarjeta guardada:", { customerId, cardId });

            const tokenRes = await fetch("https://api.mercadopago.com/v1/card_tokens", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ customer_id: customerId, card_id: cardId }),
            });
            const tokenData = await tokenRes.json();
            console.log("[MP] Token desde tarjeta guardada:", JSON.stringify(tokenData));

            if (!tokenRes.ok || !tokenData.id) {
                return NextResponse.json(
                    { error: `No se pudo crear token: ${tokenData.message || "error desconocido"}` },
                    { status: 500 }
                );
            }
            finalToken = tokenData.id;

            // Detectar paymentMethodId real desde la tarjeta del customer
            if (!finalPaymentMethodId || finalPaymentMethodId === "undefined") {
                const cardRes = await fetch(
                    `https://api.mercadopago.com/v1/customers/${customerId}/cards/${cardId}`,
                    { headers: { "Authorization": `Bearer ${accessToken}` } }
                );
                const cardData = await cardRes.json();
                finalPaymentMethodId = normalizePaymentMethodId(cardData.payment_method?.id || "visa");
            }
        }

        console.log("[MP] Procesando pago:", { amount, finalPaymentMethodId, payerEmail, installments, finalToken: finalToken?.slice(0, 8) + "..." });

        const payment = new Payment(client);

        const paymentData: any = {
            transaction_amount: Number(amount),
            token: finalToken,
            description: description || "Pedido Cremería del Rancho",
            installments: Number(installments) || 1,
            payment_method_id: finalPaymentMethodId,
            payer: {
                email: payerEmail,
                first_name: payerName?.split(" ")[0] || "Cliente",
                last_name: payerName?.split(" ").slice(1).join(" ") || "Cremeria",
                ...(customerId ? { id: customerId } : {}),
            },
        };

        const result = await payment.create({ body: paymentData });

        console.log("[MP] Resultado:", JSON.stringify({
            id: result.id,
            status: result.status,
            status_detail: result.status_detail,
            payment_method_id: result.payment_method_id,
        }));

        if (result.status === "approved" || result.status === "in_process") {
            return NextResponse.json({
                success: true,
                status: result.status,
                paymentId: result.id,
                detail: result.status_detail,
            });
        } else {
            return NextResponse.json(
                {
                    success: false,
                    status: result.status,
                    detail: result.status_detail,
                    error: `Pago rechazado: ${result.status_detail}`,
                },
                { status: 402 }
            );
        }
    } catch (error: any) {
        console.error("[MP_PAYMENT_ERROR]", JSON.stringify(error?.cause || error?.message || error));
        return NextResponse.json(
            { error: error?.message || "Error al procesar el pago" },
            { status: 500 }
        );
    }
}
