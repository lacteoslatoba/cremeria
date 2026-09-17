import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { parseJsonBody, handleRoute, HttpError } from "@/lib/http";

// Fila única del negocio: id fijo "default" para que solo exista un registro
// (datos de la tienda: nombre, teléfono, dirección y ubicación precisa). Se
// lee/escribe con upsert sobre esa clave.
const BUSINESS_ID = "default";

type BusinessBody = {
    name?: unknown;
    phone?: unknown;
    address?: unknown;
    addressLat?: unknown;
    addressLng?: unknown;
};

// GET es público: la tienda necesita mostrar el nombre/teléfono/dirección del
// negocio sin exigir sesión.
export async function GET() {
    return handleRoute(async () => {
        const business = await prisma.business.upsert({
            where: { id: BUSINESS_ID },
            update: {},
            create: { id: BUSINESS_ID },
        });
        return business;
    }, "business/get");
}

// PUT solo ADMIN: guarda los datos del perfil del negocio.
export async function PUT(request: Request) {
    return handleRoute(async () => {
        const auth = await requireAuth(request, ["ADMIN"]);
        if (!auth.user) return auth.response;

        const body = await parseJsonBody<BusinessBody>(request);

        // Campos de texto: se recortan y quedan null si vienen vacíos (el
        // teléfono/dirección pueden estar sin llenar todavía).
        const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
        const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
        const address = typeof body.address === "string" && body.address.trim() ? body.address.trim() : null;

        // Coordenadas: null si no vienen o no son números finitos válidos.
        const lat = typeof body.addressLat === "number" && Number.isFinite(body.addressLat) ? body.addressLat : null;
        const lng = typeof body.addressLng === "number" && Number.isFinite(body.addressLng) ? body.addressLng : null;
        if (lat !== null && (lat < -90 || lat > 90)) throw new HttpError("Latitud inválida", 400);
        if (lng !== null && (lng < -180 || lng > 180)) throw new HttpError("Longitud inválida", 400);

        const business = await prisma.business.upsert({
            where: { id: BUSINESS_ID },
            update: {
                name: name ?? "Cremería del Rancho",
                phone,
                address,
                addressLat: lat,
                addressLng: lng,
            },
            create: {
                id: BUSINESS_ID,
                name: name ?? "Cremería del Rancho",
                phone,
                address,
                addressLat: lat,
                addressLng: lng,
            },
        });

        return business;
    }, "business/put");
}
