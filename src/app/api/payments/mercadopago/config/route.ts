import { NextResponse } from "next/server";

// Expone la clave PUBLICA de Mercado Pago (no la de acceso) para que el
// Checkout / Card Form del navegador cargue el SDK. El cliente nunca ve el
// access_token.
export async function GET() {
    const publicKey = process.env.MP_PUBLIC_KEY || "";
    if (!publicKey) {
        return NextResponse.json({ error: "Mercado Pago no está configurado" }, { status: 503 });
    }
    return NextResponse.json({ publicKey });
}
