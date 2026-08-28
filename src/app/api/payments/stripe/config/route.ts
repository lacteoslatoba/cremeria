import { NextResponse } from "next/server";

// Expone la clave PUBLICABLE (no la secreta) para que el checkout cargue
// Stripe.js del lado del cliente — mismo patrón que /api/payments/config para MP.
export async function GET() {
    const publicKey = process.env.STRIPE_PUBLISHABLE_KEY || "";
    if (!publicKey) {
        return NextResponse.json({ error: "Stripe no está configurado" }, { status: 503 });
    }
    return NextResponse.json({ publicKey });
}
