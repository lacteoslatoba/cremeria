import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import bcrypt from "bcryptjs";

const SAFE_FIELDS = {
    id: true,
    name: true,
    username: true,
    email: true,
    phone: true,
    role: true,
    createdAt: true,
} as const;

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(request, ["ADMIN"]);
    if (!auth.user) return auth.response;

    try {
        const { id } = await params;
        const body = await request.json();

        // Normalizado igual que en registro/login (trim + minúsculas) --
        // si no, "Juan@x.com" y "juan@x.com" se tratan como distintos y se
        // cuela un duplicado que el registro sí habría rechazado.
        const cleanEmail = body.email ? String(body.email).trim().toLowerCase() : null;

        // Check if another user already has this email
        if (cleanEmail) {
            const existingWithEmail = await prisma.user.findUnique({ where: { email: cleanEmail } });
            if (existingWithEmail && existingWithEmail.id !== id) {
                return NextResponse.json({ error: "Este correo ya está en uso" }, { status: 400 });
            }
        }

        // El usuario de login (repartidores/admin lo usan para entrar) --
        // igual que en el registro, mismo trim + minúsculas y chequeo de
        // unicidad antes de guardarlo.
        const cleanUsername = body.username !== undefined ? String(body.username).trim().toLowerCase() : undefined;
        if (cleanUsername) {
            const existingWithUsername = await prisma.user.findUnique({ where: { username: cleanUsername } });
            if (existingWithUsername && existingWithUsername.id !== id) {
                return NextResponse.json({ error: "Este usuario ya está en uso" }, { status: 400 });
            }
        }

        // Solo roles conocidos; jamás se acepta un rol arbitrario del body.
        const allowedRoles = ["CUSTOMER", "DELIVERY", "ADMIN"];
        const safeRole = body.role !== undefined && allowedRoles.includes(body.role) ? body.role : undefined;

        // Contraseña opcional -- solo se toca si mandan una nueva (p. ej. el
        // admin reseteando la de un repartidor que la olvidó). Vacía o
        // ausente = se deja la que ya tenía.
        const newPasswordHash = body.password ? await bcrypt.hash(body.password, 10) : undefined;

        const user = await prisma.user.update({
            where: { id },
            data: {
                name: body.name,
                email: cleanEmail,
                phone: body.phone ?? null,
                ...(cleanUsername ? { username: cleanUsername } : {}),
                ...(safeRole ? { role: safeRole } : {}),
                ...(newPasswordHash ? { password: newPasswordHash } : {}),
            },
            select: SAFE_FIELDS,
        });

        revalidatePath("/admin/customers");

        return NextResponse.json(user);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }
}

// PATCH solo ADMIN: activa o desactiva a un repartidor. Va aparte del PUT
// porque ese reescribe nombre/correo/telefono, y aqui solo se mueve el estado.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(request, ["ADMIN"]);
    if (!auth.user) return auth.response;

    try {
        const { id } = await params;
        const body = await request.json();
        if (typeof body.activo !== "boolean") {
            return NextResponse.json({ error: "Falta indicar si el repartidor queda activo o desactivado" }, { status: 400 });
        }

        // Solo repartidores: updateMany con el rol en el where evita que este
        // endpoint sirva para desactivar a un cliente o a otro admin.
        const { count } = await prisma.user.updateMany({
            where: { id, role: "DELIVERY" },
            // Al desactivarlo deja de contar como "en linea".
            data: { activo: body.activo, ...(body.activo ? {} : { isOnline: false }) },
        });
        if (count === 0) return NextResponse.json({ error: "Repartidor no encontrado" }, { status: 404 });

        revalidatePath("/admin");
        return NextResponse.json({ ok: true, id, activo: body.activo });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "No se pudo cambiar el estado del repartidor" }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(request, ["ADMIN"]);
    if (!auth.user) return auth.response;

    try {
        const { id } = await params;

        // Remove userId references in Orders before deleting the user so sales history is kept
        await prisma.order.updateMany({
            where: { userId: id },
            data: { userId: null }
        });

        const deletedUser = await prisma.user.delete({
            where: { id },
            select: { id: true },
        });

        revalidatePath("/admin/customers");

        return NextResponse.json({ ok: true, id: deletedUser.id });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to delete user." }, { status: 500 });
    }
}
