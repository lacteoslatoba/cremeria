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

        // Send SMS with Twilio if env vars are present and user has a phone
        let smsSent = false;
        if (user.phone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const twilio = require('twilio');
                const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

                // Format phone assuming Mexico (+52) if exactly 10 digits
                const cPhone = user.phone.replace(/[^\d]/g, '');
                let formattedPhone = cPhone;
                // If it's a 10 digit number in Mexico
                if (formattedPhone.length === 10) {
                    formattedPhone = `+52${formattedPhone}`;
                } else if (!formattedPhone.startsWith('+')) {
                    formattedPhone = `+${formattedPhone}`;
                }

                await client.messages.create({
                    body: `Tu código de recuperación para Cremeria del Rancho es: ${resetToken}. Expira en 15 min.`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: formattedPhone
                });

                smsSent = true;
                console.log(`[SMS] Enviado exitosamente a ${formattedPhone}`);
            } catch (twilioErr) {
                console.error("[SMS ERROR] Error de Twilio:", twilioErr);
            }
        } else {
            console.log(`[SIMULATED SMS/EMAIL] Password reset code for ${identifier}: ${resetToken}`);
        }

        return NextResponse.json({
            success: true,
            message: "Código generado con éxito.",
            _dev_code: smsSent ? undefined : resetToken // Only send back if SMS was not sent / Twilio not config
        });

    } catch (error) {
        console.error("Forgot password request error", error);
        return NextResponse.json({ error: "Ocurrió un error al procesar tu solicitud." }, { status: 500 });
    }
}
