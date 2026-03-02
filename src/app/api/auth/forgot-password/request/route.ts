import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const { identifier } = await req.json();

        // Find user by email, phone, or username
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { phone: identifier },
                    { username: identifier }
                ]
            }
        });

        if (!user) {
            // Standard security practice: Don't leak whether user exists, just return success
            return NextResponse.json({ success: true, message: "Si el usuario existe, se ha enviado un código." });
        }

        // Generate 6-digit code
        const resetToken = Math.floor(100000 + Math.random() * 900000).toString();

        // Token expires in 15 minutes
        const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken,
                resetTokenExpiry
            }
        });

        // Here we would typically send an email or SMS with an external provider (Twilio, Resend, etc.)
        // For demonstration/mock purposes we'll return it in the response so the UI can show a toast for testing
        // IN PRODUCTION: Do not return the code to the client!

        console.log(`[SIMULATED SMS/EMAIL] Password reset code for ${identifier}: ${resetToken}`);

        return NextResponse.json({
            success: true,
            message: "Código generado con éxito.",
            _dev_code: resetToken // Only for prototype preview!
        });

    } catch (error) {
        console.error("Forgot password request error", error);
        return NextResponse.json({ error: "Ocurrió un error al procesar tu solicitud." }, { status: 500 });
    }
}
