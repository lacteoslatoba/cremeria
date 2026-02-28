import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        // Check if another user already has this email
        if (body.email) {
            const existingWithEmail = await prisma.user.findUnique({ where: { email: body.email } });
            if (existingWithEmail && existingWithEmail.id !== id) {
                return NextResponse.json({ error: "Este correo ya está en uso" }, { status: 400 });
            }
        }

        const user = await prisma.user.update({
            where: { id },
            data: {
                name: body.name,
                email: body.email || null,
                phone: body.phone || null,
                role: body.role,
            }
        });

        revalidatePath("/admin/customers");

        return NextResponse.json(user);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // Remove userId references in Orders before deleting the user so sales history is kept
        await prisma.order.updateMany({
            where: { userId: id },
            data: { userId: null }
        });

        const deletedUser = await prisma.user.delete({
            where: { id }
        });

        revalidatePath("/admin/customers");

        return NextResponse.json(deletedUser);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to delete user." }, { status: 500 });
    }
}
