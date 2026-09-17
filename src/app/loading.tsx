import { Loader2 } from "lucide-react";

// Next.js muestra esto automáticamente mientras un Server Component de
// cualquier ruta (que no tenga su propio loading.tsx) está cargando datos --
// evita que la navegación se sienta "congelada" entre pantallas. Mismo
// spinner y color que ya se usaba a mano en varias páginas (mis-pedidos,
// direccion/[orderId], etc.), ahora centralizado para el resto.
export default function Loading() {
    return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-background">
            <Loader2 className="animate-spin text-primary" size={32} />
        </div>
    );
}
