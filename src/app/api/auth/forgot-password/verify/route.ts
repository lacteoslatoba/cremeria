import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const { identifier, code } = await req.json();

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { phone: identifier },
                    { username: identifier }
                ],
                resetToken: code
            }
        });

        if (!user) {
            return NextResponse.json({ error: "Código inválido o usuario no encontrado." }, { status: 400 });
        }

        if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
            return NextResponse.json({ error: "El código ha expirado. Solicita uno nuevo." }, { status: 400 });
        }

        // Code is valid
        return NextResponse.json({ success: true, message: "Código verificado." });

    } catch (error) {
        console.error("Forgot password verify error", error);
        return NextResponse.json({ error: "Ocurrió un error al verificar el código." }, { status: 500 });
    }
}
