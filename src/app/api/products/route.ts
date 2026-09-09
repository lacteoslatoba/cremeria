import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { parseJsonBody, handleRoute } from "@/lib/http";
import { parseProduct } from "@/lib/validators";
import { getCachedActiveProducts, getCachedAllProducts } from "@/lib/cache";

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

        // Usamos el cache en modo tienda para reducir queries a la BD bajo alta
        // concurrencia. El admin siempre recibe datos frescos (cache de 10s).
        const products = admin
            ? await getCachedAllProducts()
            : await getCachedActiveProducts();

        // Cache-Control: Vercel Edge y CDN pueden servir respuestas cacheadas
        // mientras se revalidan en segundo plano (stale-while-revalidate).
        // El admin nunca cachea porque necesita datos frescos.
        const cacheHeader = admin
            ? "no-store"
            : "public, s-maxage=60, stale-while-revalidate=300";

        return NextResponse.json(products, {
            headers: { "Cache-Control": cacheHeader },
        });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireAuth(request, ["ADMIN"]);
    if (!auth.user) return auth.response;

    return handleRoute(async () => {
        const body = await parseJsonBody<Record<string, unknown>>(request);
        const data = parseProduct(body);
        const product = await prisma.product.create({ data });

        // Invalida el cache de productos para que el siguiente GET traiga
        // el catálogo actualizado sin esperar el revalidate automático.
        revalidateTag("products", { expire: 60 });
        revalidatePath("/");
        revalidatePath("/admin");

        return NextResponse.json(product, { status: 201 });
    }, "PRODUCTS_POST");
}
