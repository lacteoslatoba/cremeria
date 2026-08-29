import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signSession, setSessionCookie, requireAuth } from "@/lib/auth";

// Serializa un usuario para responder, garantizando que NUNCA se expone el hash.
function toSafeUser(user: any) {
    const { password, resetToken, resetTokenExpiry, mpCustomerId, ...safe } = user;
    return safe;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, phone, password, role } = body;
        // El registro público ya no pide usuario/correo/dirección por
        // separado -- el teléfono es el identificador de inicio de sesión
        // (login ya hace match contra username/email/phone, así que basta
        // con guardar el teléfono ahí también como "username" interno).
        // Se aceptan username/email/address si vienen (p. ej. un admin
        // creando una cuenta con más detalle desde otro flujo) pero ya no
        // son obligatorios para el registro público del cliente.
        const username = body.username || phone;
        const email = body.email;
        const address = body.address;

        if (!phone || !password) {
            return NextResponse.json({ error: "El teléfono y contraseña son requeridos" }, { status: 400 });
        }

        // Registro público (sin sesión): SIEMPRE CUSTOMER. Solo un ADMIN ya
        // autenticado puede pedir un rol elevado (p. ej. el admin dando de
        // alta un repartidor desde /admin/deliveries) — así se cierra el
        // hueco de que cualquiera se cree una cuenta ADMIN/DELIVERY, sin
        // romper la función legítima de admin de crear repartidores.
        let safeRole = "CUSTOMER";
        let createdByAdmin = false;
        if (role === "DELIVERY" || role === "ADMIN") {
            const auth = await requireAuth(request, ["ADMIN"]);
            if (!auth.user) return auth.response;
            safeRole = role;
            createdByAdmin = true;
        }

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

        const response = NextResponse.json(toSafeUser(newUser), { status: 201 });

        // Solo firmamos sesión para el propio registro público (el usuario
        // se está logueando a sí mismo). Si fue un ADMIN quien creó esta
        // cuenta (p. ej. un repartidor), NO tocamos la cookie — de lo
        // contrario le robaríamos la sesión al admin que hizo la llamada.
        if (!createdByAdmin) {
            const token = await signSession({ id: newUser.id, role: newUser.role });
            setSessionCookie(response, token);
        }

        return response;
    } catch (error) {
        console.error("Register error:", error);
        return NextResponse.json({ error: "Ocurrió un error al registrar. Intenta de nuevo." }, { status: 500 });
    }
}
