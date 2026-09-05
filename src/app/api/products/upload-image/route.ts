import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAuth } from "@/lib/auth";
import { rateLimit, cleanupRateLimitBuckets, clientIp } from "@/lib/rate-limit";

// Antes había que escribir a mano la URL de una imagen ya subida a algún
// lado -- si el producto no tenía una URL válida (o el admin quería
// cambiar solo el stock), el campo <input type="url"> del formulario
// bloqueaba el guardado completo. Ahora el admin sube la foto directo
// desde su celular/computadora: se guarda en Vercel Blob (el mismo
// hosting de la app) y se regresa la URL pública para guardarla en
// Product.image -- ya no hace falta saber ni escribir ninguna URL.
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: Request) {
    const auth = await requireAuth(request, ["ADMIN"]);
    if (!auth.user) return auth.response;

    cleanupRateLimitBuckets();
    const throttled = rateLimit(`upload-image:${clientIp(request)}`, 30, 10 * 60 * 1000); // 30 / 10 min
    if (!throttled.allowed) {
        return NextResponse.json(
            { error: `Demasiados intentos. Intenta en ${throttled.retryAfterSeconds}s.` },
            { status: 429 }
        );
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "Falta el archivo de imagen" }, { status: 400 });
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: "Formato no soportado (usa JPG, PNG, WEBP o GIF)" }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
            return NextResponse.json({ error: "La imagen pesa demasiado (máximo 5MB)" }, { status: 400 });
        }

        // addRandomSuffix evita que dos productos con nombre parecido
        // (o una misma foto subida dos veces) se pisen entre sí.
        const ext = file.type.split("/")[1] || "jpg";
        const blob = await put(`products/${crypto.randomUUID()}.${ext}`, file, {
            access: "public",
            addRandomSuffix: false,
            contentType: file.type,
        });

        return NextResponse.json({ url: blob.url });
    } catch (error) {
        console.error("[UPLOAD_IMAGE_ERROR]", error);
        return NextResponse.json({ error: "No se pudo subir la imagen" }, { status: 500 });
    }
}
