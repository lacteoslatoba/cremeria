import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET(request: Request) {
    const auth = await requireAuth(request, ["ADMIN"]);
    if (!auth.user) return auth.response;

    try {
        const { searchParams } = new URL(request.url);
        const role = searchParams.get("role") || undefined;

        const users = await prisma.user.findMany({
            where: role ? { role } : undefined,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                username: true,
                role: true,
                createdAt: true,
                _count: { select: { orders: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(users);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireAuth(request, ["ADMIN"]);
    if (!auth.user) return auth.response;

    try {
        const body = await request.json();

        // Solo se pueden crear CUSTOMER, DELIVERY o ADMIN desde aquí (admin autenticado);
        // jamás se acepta escalar privilegios vía el rol del body sin validar.
        const allowedRoles = ["CUSTOMER", "DELIVERY", "ADMIN"];
        const safeRole = allowedRoles.includes(body.role) ? body.role : "CUSTOMER";

        // Para cuentas con acceso (DELIVERY/ADMIN) exigimos username + password para poder
        // iniciar sesión; garantizamos unicidad de username/email.
        if (body.username || body.password) {
            if (!body.username || !body.password) {
                return NextResponse.json({ error: "Usuario y contraseña son requeridos" }, { status: 400 });
            }
            const existing = await prisma.user.findFirst({
                where: {
                    OR: [
                        { username: String(body.username).trim().toLowerCase() },
                        ...(body.email ? [{ email: String(body.email).trim().toLowerCase() }] : []),
                    ],
                },
            });
            if (existing) {
                return NextResponse.json({ error: "El usuario o correo ya está en uso" }, { status: 400 });
            }
        } else if (body.email) {
            const existing = await prisma.user.findUnique({ where: { email: body.email } });
            if (existing) {
                return NextResponse.json({ error: "El correo ya está en uso" }, { status: 400 });
            }
        }

        const data: {
            name: string | null;
            email: string | null;
            phone: string | null;
            role: string;
            username?: string;
            password?: string;
        } = {
            name: body.name || null,
            email: body.email ? String(body.email).trim().toLowerCase() : null,
            phone: body.phone || null,
            role: safeRole,
        };

        if (body.username) data.username = String(body.username).trim().toLowerCase();
        if (body.password) data.password = await bcrypt.hash(body.password, 10);

        const user = await prisma.user.create({
            data,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                username: true,
                role: true,
            },
        });

        return NextResponse.json(user, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }
}
