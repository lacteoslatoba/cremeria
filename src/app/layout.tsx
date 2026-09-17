import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthGuard } from "@/components/auth/auth-guard";
import { SideNav } from "@/components/layout/side-nav";
import { PwaUpdater } from "@/components/pwa-updater";
import { InstallPrompt } from "@/components/install-prompt";
import { StripePreloader } from "@/components/stripe-preloader";

// Antes se cargaba con <link> a Google Fonts directo -- next/font la baja en
// build time y la sirve desde el propio dominio: mismo look, pero sin el
// viaje extra a fonts.googleapis.com ni el salto de layout (CLS) mientras
// la tipografía real reemplaza a la de respaldo. La variable CSS que genera
// se referencia desde globals.css (--font-sans).
const plusJakartaSans = Plus_Jakarta_Sans({
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700"],
    variable: "--font-plus-jakarta-sans",
    display: "swap",
});

export const metadata: Metadata = {
    title: "Cremeria del Rancho",
    description: "Lo nuestro es calidad",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Cremeria del Rancho",
    },
    // Para que compartir el link (WhatsApp, Facebook, Instagram, etc.) muestre
    // una tarjeta con nombre, descripción y logo en vez de una URL pelada.
    openGraph: {
        title: "Cremería del Rancho",
        description: "Lo nuestro es calidad. Pide tus lácteos a domicilio.",
        url: "https://cremeriadelrancho.com",
        siteName: "Cremería del Rancho",
        // Un SVG casi nunca lo renderizan WhatsApp/Facebook/Instagram al armar
        // la vista previa -- se usa el ícono PNG cuadrado que ya existe (el
        // mismo del manifest de la PWA) en vez del logo vectorial.
        images: [
            {
                url: "https://cremeriadelrancho.com/icon.png",
                width: 512,
                height: 512,
            },
        ],
        locale: "es_MX",
        type: "website",
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
        <html lang="es" className={plusJakartaSans.variable}>
            <head>
                {/* Deja "tibia" la conexión con Stripe desde que se abre la
                    app -- para cuando el cliente llega al checkout, el DNS
                    y el handshake TLS ya están hechos (evita la espera). */}
                <link rel="preconnect" href="https://js.stripe.com" />
                <link rel="preconnect" href="https://api.stripe.com" />
                <link rel="preconnect" href="https://m.stripe.network" />
                <link rel="dns-prefetch" href="https://js.stripe.com" />
            </head>
            <body>
                <AuthGuard>
                    <PwaUpdater />
                    <StripePreloader />
                    {/* Desktop sidebar — only visible on md+ */}
                    <SideNav />

                    {/* Main content */}
                    <div className="app-wrapper">
                        {children}
                    </div>

                    <InstallPrompt />
                </AuthGuard>
            </body>
        </html>
    );
}
