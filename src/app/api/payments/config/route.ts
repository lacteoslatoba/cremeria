import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        publicKey: process.env.MP_PUBLIC_KEY || ""
    });
}
