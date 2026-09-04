import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

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

        // Solo roles conocidos; jamás se acepta un rol arbitrario del body.
        const allowedRoles = ["CUSTOMER", "DELIVERY", "ADMIN"];
        const safeRole = body.role !== undefined && allowedRoles.includes(body.role) ? body.role : undefined;

        const user = await prisma.user.update({
            where: { id },
            data: {
                name: body.name,
                email: cleanEmail,
                phone: body.phone ?? null,
                ...(safeRole ? { role: safeRole } : {}),
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
