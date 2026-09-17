import { requireAuth } from "@/lib/auth";
import { parseJsonBody, handleRoute, HttpError } from "@/lib/http";
import { reverseGeocode } from "@/lib/geocode";

type Body = { lat?: unknown; lng?: unknown };

// Solo ADMIN: al confirmar un pin en el mapa del perfil, el frontend llama
// esto para llenar el cuadro de "Dirección" con el texto real del lugar en
// vez de dejarlo vacío o con lo que haya escrito antes.
export async function POST(request: Request) {
    return handleRoute(async () => {
        const auth = await requireAuth(request, ["ADMIN"]);
        if (!auth.user) return auth.response;

        const body = await parseJsonBody<Body>(request);
        const lat = typeof body.lat === "number" ? body.lat : NaN;
        const lng = typeof body.lng === "number" ? body.lng : NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw new HttpError("Coordenadas inválidas", 400);
        }

        const address = await reverseGeocode(lat, lng);
        return { address };
    }, "business/reverse-geocode");
}
