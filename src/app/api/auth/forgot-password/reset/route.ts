import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
    try {
        const { identifier, code, newPassword } = await req.json();

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
            return NextResponse.json({ error: "Código inválido o sesión expirada." }, { status: 400 });
        }

        if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
            return NextResponse.json({ error: "El código ha expirado." }, { status: 400 });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user, clear the token
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null
            }
        });

        return NextResponse.json({ success: true, message: "Contraseña actualizada exitosamente." });

    } catch (error) {
        console.error("Forgot password reset error", error);
        return NextResponse.json({ error: "Ocurrió un error al restablecer la contraseña." }, { status: 500 });
    }
}
