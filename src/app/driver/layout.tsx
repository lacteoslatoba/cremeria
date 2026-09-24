import type { Metadata } from "next";

// Igual que /admin (ver admin/layout.tsx): app instalable aparte, con su
// propio scope "/driver" -- 3 apps independientes (Cliente/Repartidor/
// Admin), cada una solo dentro de su propia zona. Asi nunca hace falta
// salir del scope desde dentro de una app ya instalada.
export const metadata: Metadata = {
    title: "Cremería Repartidor",
    manifest: "/driver-manifest.json",
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
