import type { Metadata } from "next";

// Igual que /admin (ver admin/layout.tsx): app instalable aparte, con su
// propio scope "/driver" -- 3 apps independientes (Cliente/Repartidor/
// Admin), cada una solo dentro de su propia zona. Asi nunca hace falta
// salir del scope desde dentro de una app ya instalada.
export const metadata: Metadata = {
    title: "Cremería Repartidor",
    manifest: "/driver-manifest.json",
    // Sin esto, agregar /driver a la pantalla de inicio en iPhone mostraba
    // "Cremeria del Rancho" (el titulo generico heredado de layout.tsx raiz)
    // en vez de "Cremería Repartidor" -- Safari no usa <title> para el
    // nombre del acceso directo, usa este meta aparte.
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Cremería Repartidor",
    },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
