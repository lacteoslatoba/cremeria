import { NextResponse } from "next/server";

// Expone la clave PUBLICABLE (no la secreta) para que el checkout cargue
// Stripe.js del lado del cliente.
export async function GET() {
    const publicKey = process.env.STRIPE_PUBLISHABLE_KEY || "";
    if (!publicKey) {
        return NextResponse.json({ error: "Stripe no está configurado" }, { status: 503 });
    }
    return NextResponse.json({ publicKey });
}
