import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN!,
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            token,           // card token from Mercado Pago SDK
            amount,          // total in MXN
            description,     // order description
            payerEmail,      // payer email
            payerName,       // payer name
            installments,    // number of installments (1 = sin meses)
            paymentMethodId, // e.g. "visa", "master"
            saveCard,        // whether to save card
        } = body;

        const payment = new Payment(client);

        const paymentData: any = {
            transaction_amount: Number(amount),
            token: token,
            description: description || "Pedido Cremería del Rancho",
            installments: installments || 1,
            payment_method_id: paymentMethodId,
            payer: {
                email: payerEmail,
                first_name: payerName?.split(" ")[0] || "",
                last_name: payerName?.split(" ").slice(1).join(" ") || "",
            },
        };

        const result = await payment.create({ body: paymentData });

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
                    error: "Pago rechazado",
                },
                { status: 402 }
            );
        }
    } catch (error: any) {
        console.error("[MP_PAYMENT_ERROR]", error?.message || error);
        return NextResponse.json(
            { error: error?.message || "Error al procesar el pago" },
            { status: 500 }
        );
    }
}
