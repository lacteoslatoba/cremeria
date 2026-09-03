import type { Metadata } from "next";
import "./globals.css";
import { AuthGuard } from "@/components/auth/auth-guard";
import { SideNav } from "@/components/layout/side-nav";
import { PwaUpdater } from "@/components/pwa-updater";
import { StripePreloader } from "@/components/stripe-preloader";
// Conekta y Mercado Pago quedan en pausa (ver CARD_PROVIDER en
// checkout/page.tsx) -- el backend de MP ya está listo (lib, endpoints,
// CSP) pero la pantalla de checkout todavía no lo usa, así que no tiene
// caso precargar su SDK en cada visita. Imports comentados, no borrados,
// para retomarlos fácil.
// import { MercadoPagoPreloader } from "@/components/mercadopago-preloader";
// import { ConektaPreloader } from "@/components/conekta-preloader";

export const metadata: Metadata = {
    title: "Cremeria del Rancho",
    description: "Lo nuestro es calidad",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Cremeria del Rancho",
    },
};

export const viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: "#ee2b34",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="es">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
                {/* Deja "tibia" la conexión con Stripe desde que se abre la
                    app -- para cuando el cliente llega al checkout, el DNS
                    y el handshake TLS ya están hechos (evita la espera). */}
                <link rel="preconnect" href="https://js.stripe.com" />
                <link rel="preconnect" href="https://api.stripe.com" />
                <link rel="preconnect" href="https://m.stripe.network" />
                <link rel="dns-prefetch" href="https://js.stripe.com" />
                <link rel="dns-prefetch" href="https://sdk.mercadopago.com" />
            </head>
            <body>
                <AuthGuard>
                    <PwaUpdater />
                    <StripePreloader />
                    {/* <MercadoPagoPreloader /> -- backend listo, checkout aún no lo usa */}
                    {/* <ConektaPreloader /> -- en pausa junto con Conekta */}
                    {/* Desktop sidebar — only visible on md+ */}
                    <SideNav />

                    {/* Main content */}
                    <div className="app-wrapper">
                        {children}
                    </div>
                </AuthGuard>
            </body>
        </html>
    );
}
