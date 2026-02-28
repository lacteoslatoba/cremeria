import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
    try {
        const { identifier, password } = await request.json();

        if (!identifier || !password) {
            return NextResponse.json({ error: "El usuario y contraseña son requeridos" }, { status: 400 });
        }

        const cleanId = identifier.trim().toLowerCase();

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: cleanId },
                    { email: cleanId },
                    { phone: cleanId }
                ]
            }
        });

        if (!user) {
            return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
        }

        if (!user.password) {
            // Migration for old users without password. Let them login and set their password if they don't have one, or just error out.
            // But let's verify if password allows them to migrate.
            // Since we don't want to lock them out, maybe we set it dynamically on first login if it's empty?
            // Actually, we can just hash and save their password and let them in this first time.
            const hashedPassword = await bcrypt.hash(password, 10);
            const updatedUser = await prisma.user.update({
                where: { id: user.id },
                data: { password: hashedPassword }
            });
            return NextResponse.json(updatedUser, { status: 200 });
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
        }

        return NextResponse.json(user, { status: 200 });
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json({ error: "Ocurrió un error al iniciar sesión" }, { status: 500 });
    }
}
