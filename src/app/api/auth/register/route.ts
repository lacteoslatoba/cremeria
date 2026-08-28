import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signSession, setSessionCookie } from "@/lib/auth";

// Serializa un usuario para responder, garantizando que NUNCA se expone el hash.
function toSafeUser(user: any) {
    const { password, resetToken, resetTokenExpiry, mpCustomerId, ...safe } = user;
    return safe;
}

export async function POST(request: Request) {
    try {
        const { name, username, phone, email, password, address } = await request.json();

        if (!username || !password) {
            return NextResponse.json({ error: "El usuario y contraseña son requeridos" }, { status: 400 });
        }

        // Registro público: SIEMPRE asigna rol CUSTOMER. El alta de repartidores/admin
        // la realiza un administrador autenticado desde /admin, nunca desde aquí,
        // para evitar que cualquiera cree cuentas elevadas.
        const safeRole = "CUSTOMER";

        const cleanUser = username.trim().toLowerCase();
        const cleanEmail = email ? email.trim().toLowerCase() : null;

        // Check if user exists
        const orConditions: any[] = [
            { username: cleanUser }
        ];

        if (cleanEmail) orConditions.push({ email: cleanEmail });
        if (phone) orConditions.push({ phone: phone });

        const existingUser = await prisma.user.findFirst({
            where: { OR: orConditions }
        });

        if (existingUser) {
            return NextResponse.json({ error: "El usuario, correo o teléfono ya están en uso" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                name,
                username: cleanUser,
                phone: phone || null,
                email: cleanEmail || null,
                address: address || null,
                password: hashedPassword,
                role: safeRole
            }
        });

        // Firmar sesión y emitir cookie HttpOnly, igual que en login — sin esto
        // el usuario "parece" logueado en la UI pero pierde la sesión en el
        // siguiente refresh/navegación completa (no hay cookie que restaurar).
        const token = await signSession({ id: newUser.id, role: newUser.role });
        const response = NextResponse.json(toSafeUser(newUser), { status: 201 });
        setSessionCookie(response, token);

        return response;
    } catch (error) {
        console.error("Register error:", error);
        return NextResponse.json({ error: "Ocurrió un error al registrar. Intenta de nuevo." }, { status: 500 });
    }
}
