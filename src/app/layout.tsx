import type { Metadata } from "next";
import "./globals.css";
import { AuthGuard } from "@/components/auth/auth-guard";
import { SideNav } from "@/components/layout/side-nav";

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
            </head>
            <body>
                <AuthGuard>
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
