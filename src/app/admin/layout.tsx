import type { Metadata } from "next";
import { AdminLayout } from "@/components/layout/admin-layout";

// Manifiesto propio (distinto al de la app de clientes) -- así, al
// instalarlo desde el navegador en la PC, se instala como su propia app
// "Cremería Admin" con start_url /admin (abre directo al panel, no a la
// tienda) en vez de quedar mezclado con el manifiesto del cliente.
export const metadata: Metadata = {
    title: "Cremería Admin",
    manifest: "/admin-manifest.json",
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
