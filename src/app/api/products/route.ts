import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const admin = searchParams.get("admin") === "true";

        // Para modo admin forzamos autenticación de ADMIN (evita filtrar inactivos/stock al público
        // y evita que cualquiera use ?admin=true, aunque GET de productos es público de todos modos).
        if (admin) {
            const auth = await requireAuth(request, ["ADMIN"]);
            if (!auth.user) return auth.response;
        }

        const products = await prisma.product.findMany({
            where: admin
                ? undefined  // Admin ve todos
                : { status: "ACTIVE", stock: { gt: 0 } }, // Tienda: solo disponibles con stock
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(products);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireAuth(request, ["ADMIN"]);
    if (!auth.user) return auth.response;

    try {
        const body = await request.json();
        const product = await prisma.product.create({
            data: {
                name: body.name,
                category: body.category,
                description: body.description,
                price: body.price,
                stock: body.stock,
                image: body.image,
                status: body.status || "ACTIVE",
            },
        });

        revalidatePath("/");
        revalidatePath("/admin");

        return NextResponse.json(product, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
    }
}
