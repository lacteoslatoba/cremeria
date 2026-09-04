import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { parseJsonBody, handleRoute } from "@/lib/http";
import { parseProduct } from "@/lib/validators";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const product = await prisma.product.findUnique({
            where: { id }
        });

        if (!product) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        return NextResponse.json(product);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(request, ["ADMIN"]);
    if (!auth.user) return auth.response;

    return handleRoute(async () => {
        const { id } = await params;
        // Mismo validador que POST -- el formulario de admin manda el objeto
        // completo tanto para crear como para editar (ver product-form-modal.tsx),
        // así que no hace falta una versión "parcial" distinta.
        const body = await parseJsonBody<Record<string, unknown>>(request);
        const data = parseProduct(body);

        const product = await prisma.product.update({ where: { id }, data });

        revalidatePath("/");
        revalidatePath("/admin");

        return NextResponse.json(product);
    }, "PRODUCTS_PUT");
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(request, ["ADMIN"]);
    if (!auth.user) return auth.response;

    try {
        const { id } = await params;

        // Also delete related order items if necessary or keep them according to the schema
        // The Prisma schema currently has relation Mode Cascade not explicit for orderItems to Product
        // We will just try to delete the product, but usually it's better to update status to "INACTIVE" instead of hard DELETE.

        const deletedProduct = await prisma.product.delete({
            where: { id }
        });

        revalidatePath("/");
        revalidatePath("/admin");

        return NextResponse.json(deletedProduct);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to delete product (might be linked to active orders)" }, { status: 500 });
    }
}
