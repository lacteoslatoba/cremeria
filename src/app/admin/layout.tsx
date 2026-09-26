import type { Metadata } from "next";
import { AdminLayout } from "@/components/layout/admin-layout";

// /admin vuelve a tener su propio manifest.json (scope "/admin", app
// instalable aparte) -- instruccion directa de Mike (23/09): quiere una
// instalacion separada para el Admin, no compartir la misma app que abre en
// el login de Cliente. El unico costo (documentado antes) es que si entras
// aqui desde el menu Cliente/Repartidor de la app principal YA instalada,
// Chrome abre una ventana nueva en vez de navegar en la misma -- aceptable
// ahora porque la intencion es tener 2 apps separadas, no una sola.
export const metadata: Metadata = {
    title: "Cremería Admin",
    manifest: "/admin-manifest.json",
    // Mismo caso que /driver: sin esto, el acceso directo en iPhone se
    // llamaba "Cremeria del Rancho" en vez de "Cremería Admin".
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Cremería Admin",
    },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        // We override globals.css styling issues by wrapping admin globally
        <div className="admin-container !bg-[#f8f9fa] !text-slate-800">
            <AdminLayout>
                {children}
            </AdminLayout>
        </div>
    );
}
