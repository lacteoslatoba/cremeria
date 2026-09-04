import { NextResponse } from "next/server";
import { cancelPendingOrderAndRestoreStock } from "@/lib/create-order";
import { readSession } from "@/lib/auth";
import { rateLimit, cleanupRateLimitBuckets } from "@/lib/rate-limit";

// Cancela un pedido PENDING adelantado por prefetchStripeIntent (ver
// cart/page.tsx) cuando el cliente cambia el carrito antes de llegar a
// pagar -- devuelve el stock que había apartado. El dueño se toma de la
// sesión verificada (cookie firmada), NUNCA de lo que mande el body --
// antes se confiaba en body.userId directo, así que cualquiera podía
// mandar el id de otra persona junto con un orderId adivinado y cancelar
// (liberando su stock apartado) el pedido pendiente de alguien más.
export async function POST(request: Request) {
    try {
        const session = await readSession(request);
        if (!session?.id) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        cleanupRateLimitBuckets();
        const throttled = rateLimit(`cancel-pending:${session.id}`, 30, 10 * 60 * 1000); // 30 / 10 min
        if (!throttled.allowed) {
            return NextResponse.json(
                { error: `Demasiados intentos. Intenta en ${throttled.retryAfterSeconds}s.` },
                { status: 429 }
            );
        }

        const body = await request.json();
        if (!body.orderId) {
            return NextResponse.json({ error: "Falta orderId" }, { status: 400 });
        }
        const cancelled = await cancelPendingOrderAndRestoreStock(body.orderId, session.id);
        return NextResponse.json({ cancelled });
    } catch (error: any) {
        console.error("[STRIPE_CANCEL_PENDING_ERROR]", error);
        return NextResponse.json({ error: error?.message || "No se pudo cancelar" }, { status: 500 });
    }
}
