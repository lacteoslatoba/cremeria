import { NextResponse } from "next/server";
import { readSession, loadAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    try {
        const session = await readSession(request);
        const auth = await loadAuthUser(session);
        if (!auth) {
            return NextResponse.json({ user: null }, { status: 200 });
        }

        const user = await prisma.user.findUnique({
            where: { id: auth.id },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                username: true,
                address: true,
            },
        });

        return NextResponse.json({ user });
    } catch (error) {
        console.error("Me error:", error);
        return NextResponse.json({ user: null }, { status: 200 });
    }
}
