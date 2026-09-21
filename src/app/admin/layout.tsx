import type { Metadata } from "next";
import { AdminLayout } from "@/components/layout/admin-layout";

// Antes /admin tenía su propio manifest.json (scope "/admin", su propia app
// "Cremería Admin" instalable aparte) -- eso hacía que Chrome abriera una
// ventana nueva al entrar aquí desde el menú Cliente/Repartidor/Admin de la
// app ya instalada, en vez de quedarse en la misma ventana como los otros
// 2 portales. Ahora /admin usa el mismo manifest.json del resto del sitio
// (heredado del layout raíz) para que los 3 portales vivan en una sola app.
export const metadata: Metadata = {
    title: "Cremería Admin",
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
