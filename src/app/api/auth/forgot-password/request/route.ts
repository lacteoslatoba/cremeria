import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, cleanupRateLimitBuckets, clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
    try {
        cleanupRateLimitBuckets();
        const { identifier } = await req.json();

        if (!identifier || typeof identifier !== "string") {
            return NextResponse.json({ error: "Identificador requerido" }, { status: 400 });
        }

        // Límite por IP y por identificador -- sin esto cualquiera podía
        // pedir códigos sin parar y "bombardear" de SMS el teléfono de otra
        // persona (cada SMS de Twilio cuesta dinero real, además de acosar
        // a quien lo recibe).
        const ip = clientIp(req);
        const cleanId = identifier.trim().toLowerCase();
        const throttledIp = rateLimit(`forgot-pw-req-ip:${ip}`, 8, 15 * 60 * 1000);
        const throttledId = rateLimit(`forgot-pw-req-id:${cleanId}`, 3, 15 * 60 * 1000);
        if (!throttledIp.allowed || !throttledId.allowed) {
            const retry = Math.max(throttledIp.retryAfterSeconds || 0, throttledId.retryAfterSeconds || 0);
            return NextResponse.json({ error: `Demasiados intentos. Intenta en ${retry}s.` }, { status: 429 });
        }

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
            // Solo en desarrollo: nunca se regresa el código real en la
            // respuesta en producción, ni siquiera si el envío del SMS
            // falla -- de lo contrario cualquiera podría restablecer la
            // contraseña de cualquier cuenta sin tener el teléfono, con
            // solo forzar que Twilio falle (o esperar a que falle solo).
            _dev_code: process.env.NODE_ENV === "production" ? undefined : (smsSent ? undefined : resetToken)
        });

    } catch (error) {
        console.error("Forgot password request error", error);
        return NextResponse.json({ error: "Ocurrió un error al procesar tu solicitud." }, { status: 500 });
    }
}
