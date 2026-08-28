import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Called repeatedly by the DELIVERY app (navigator.geolocation.watchPosition)
// while the driver has an active route.
export async function POST(request: Request) {
    const auth = await requireAuth(request, ["DELIVERY"]);
    if (!auth.user) return auth.response;

    try {
        const { userId, lat, lng } = await request.json();

        if (!userId || typeof lat !== "number" || typeof lng !== "number") {
            return NextResponse.json({ error: "userId, lat y lng son requeridos" }, { status: 400 });
        }
        // Un repartidor solo puede publicar su PROPIA ubicación.
        if (userId !== auth.user.id) {
            return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
        }

        const user = await prisma.user.update({
            where: { id: auth.user.id },
            data: { currentLat: lat, currentLng: lng, locationUpdatedAt: new Date(), isOnline: true },
            select: { id: true },
        });

        return NextResponse.json({ ok: true, id: user.id });
    } catch (error) {
        return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
    }
}
