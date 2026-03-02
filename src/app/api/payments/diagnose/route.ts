import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";

// Diagnostic endpoint — only works in development
export async function GET() {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not available in production" }, { status: 403 });
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    const publicKey = process.env.MP_PUBLIC_KEY;

    if (!accessToken || !publicKey) {
        return NextResponse.json({
            status: "ERROR",
            message: "Faltan variables de entorno MP_ACCESS_TOKEN o MP_PUBLIC_KEY",
            hasAccessToken: !!accessToken,
            hasPublicKey: !!publicKey,
        });
    }

    try {
        const client = new MercadoPagoConfig({ accessToken });
        const payment = new Payment(client);

        // Try a minimal test payment with a clearly-test-mode token
        // This will fail with a real error code that tells us the account state
        const result = await payment.create({
            body: {
                transaction_amount: 1,
                token: "TEST_TOKEN_DIAGNOSTICS",
                description: "Diagnóstico de cuenta",
                installments: 1,
                payment_method_id: "visa",
                payer: { email: "test@test.com" },
            }
        });

        return NextResponse.json({
            status: "API_REACHABLE",
            result_status: result.status,
            result_detail: result.status_detail,
            payment_id: result.id,
        });
    } catch (err: any) {
        return NextResponse.json({
            status: "API_ERROR",
            message: err?.message,
            cause: err?.cause,
            accessTokenPrefix: accessToken?.substring(0, 20) + "...",
            isProductionToken: accessToken?.startsWith("APP_USR"),
        });
    }
}
