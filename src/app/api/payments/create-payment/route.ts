import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN!,
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { token, amount, description, payerEmail, payerName, installments, paymentMethodId } = body;

        console.log("[MP] Procesando pago:", { amount, paymentMethodId, payerEmail, installments });

        const payment = new Payment(client);

        const paymentData: any = {
            transaction_amount: Number(amount),
            token,
            description: description || "Pedido Cremería del Rancho",
            installments: Number(installments) || 1,
            payment_method_id: paymentMethodId,
            payer: {
                email: payerEmail,
                first_name: payerName?.split(" ")[0] || "Cliente",
                last_name: payerName?.split(" ").slice(1).join(" ") || "Cremeria",
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
