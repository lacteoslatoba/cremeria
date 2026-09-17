import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth";
import { parseJsonBody, handleRoute, HttpError } from "@/lib/http";

type AddressBody = { lat?: unknown; lng?: unknown };

// Reverse-geocode con Nominatim (OpenStreetMap) -- mejor esfuerzo: nunca
// bloquea la confirmación. Si falla, tarda, o Nominatim está caído, se
// guarda igual con un texto genérico -- lo que de verdad importa para la
// entrega son addressLat/addressLng, no el texto.
async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
            {
                headers: {
                    // Nominatim exige un User-Agent identificable (su politica
                    // de uso lo pide explicitamente) -- sin esto puede rechazar
                    // la peticion.
                    "User-Agent": "CremeriaDelRancho/1.0 (pedidos@cremeriadelrancho.com)",
                },
                signal: AbortSignal.timeout(4000),
            }
        );
        if (!res.ok) throw new Error(`Nominatim ${res.status}`);
        const data = await res.json();
        if (typeof data?.display_name === "string" && data.display_name.trim()) {
            return data.display_name as string;
        }
        throw new Error("sin display_name");
    } catch {
        return "Ubicación seleccionada en el mapa";
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
    return handleRoute(async () => {
        const { orderId } = await params;
        const body = await parseJsonBody<AddressBody>(request);

        const lat = typeof body.lat === "number" ? body.lat : NaN;
        const lng = typeof body.lng === "number" ? body.lng : NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw new HttpError("Coordenadas inválidas", 400);
        }

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { id: true, userId: true, paymentStatus: true, status: true, addressConfirmedAt: true },
        });
        if (!order) throw new HttpError("Pedido no encontrado", 404);

        // Ordenes de invitado (userId null) no tienen sesion contra la cual
        // verificar -- el propio id de orden (cuid, no adivinable) es la
        // unica proteccion, igual que el resto del flujo de invitado en esta
        // app. Si la orden SI tiene dueño, solo ese dueño puede confirmar.
        if (order.userId) {
            const session = await readSession(request);
            if (session?.id !== order.userId) {
                throw new HttpError("No autorizado", 403);
            }
        }

        if (order.paymentStatus !== "APPROVED") {
            throw new HttpError("Este pedido todavía no está pagado", 400);
        }
        if (["COMPLETED", "CANCELLED"].includes(order.status)) {
            throw new HttpError("Este pedido ya finalizó", 400);
        }
        if (order.addressConfirmedAt) {
            throw new HttpError("Este pedido ya tiene una ubicación confirmada", 409);
        }

        const address = await reverseGeocode(lat, lng);

        const updated = await prisma.order.update({
            where: { id: orderId },
            data: { address, addressLat: lat, addressLng: lng, addressConfirmedAt: new Date() },
            select: { id: true, address: true, addressLat: true, addressLng: true, addressConfirmedAt: true },
        });

        return NextResponse.json(updated);
    }, "orders/address");
}
