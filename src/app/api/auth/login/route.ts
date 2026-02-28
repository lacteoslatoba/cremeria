import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        const { identifier, name } = await request.json();

        if (!identifier) {
            return NextResponse.json({ error: "El correo o teléfono es requerido" }, { status: 400 });
        }

        // Clean identifier (lowercase if it's email, trim spaces)
        const cleanId = identifier.trim().toLowerCase();
        const isEmail = cleanId.includes("@");

        let user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: cleanId },
                    { phone: cleanId }
                ]
            }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: isEmail ? cleanId : null,
                    phone: !isEmail ? cleanId : null,
                    name: name || (isEmail ? cleanId.split("@")[0] : "Cliente"),
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
