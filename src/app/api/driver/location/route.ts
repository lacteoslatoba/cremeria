import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Called repeatedly by the DELIVERY app (navigator.geolocation.watchPosition)
// while the driver has an active route.
export async function POST(request: Request) {
    try {
        const { userId, lat, lng } = await request.json();

        if (!userId || typeof lat !== "number" || typeof lng !== "number") {
            return NextResponse.json({ error: "userId, lat y lng son requeridos" }, { status: 400 });
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: { currentLat: lat, currentLng: lng, locationUpdatedAt: new Date(), isOnline: true },
            select: { id: true },
        });

        return NextResponse.json({ ok: true, id: user.id });
    } catch (error) {
        return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
    }
}
