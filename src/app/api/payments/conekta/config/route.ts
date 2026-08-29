import { NextResponse } from "next/server";

export async function GET() {
    const publicKey = process.env.CONEKTA_PUBLIC_KEY;
    if (!publicKey) {
        return NextResponse.json({ error: "Conekta no está configurado" }, { status: 503 });
    }
    return NextResponse.json({ publicKey });
}
