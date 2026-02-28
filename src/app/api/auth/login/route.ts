import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        const { email, name } = await request.json();

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        let user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            // Because the admin is supposed to create users, we could block it:
            // return NextResponse.json({ error: "No tienes cuenta. Pide a un administrador que te dé de alta." }, { status: 401 });

            // However, typical mobile apps allow auto-registration if they type it in, as a fallback:
            user = await prisma.user.create({
                data: {
                    email,
                    name: name || email.split("@")[0],
                    role: "CUSTOMER"
                }
            });
        }

        return NextResponse.json(user, { status: 200 });
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json({ error: "An error occurred during login" }, { status: 500 });
    }
}
