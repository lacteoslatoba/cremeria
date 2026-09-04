import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { parseJsonBody, handleRoute } from "@/lib/http";
import { parseProduct } from "@/lib/validators";

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

    return handleRoute(async () => {
        // Antes se tomaba body.price/body.stock a ciegas -- un typo (texto en
        // vez de número, negativo, etc.) se guardaba tal cual en la base de
        // datos. parseProduct valida tipos y rangos reales antes de tocar
        // Prisma, y tira un 400 claro en vez de un 500 genérico o datos
        // corruptos silenciosos.
        const body = await parseJsonBody<Record<string, unknown>>(request);
        const data = parseProduct(body);
        const product = await prisma.product.create({ data });

        revalidatePath("/");
        revalidatePath("/admin");

        return NextResponse.json(product, { status: 201 });
    }, "PRODUCTS_POST");
}
