import type { Metadata } from "next";
import "./globals.css";
import { AuthGuard } from "@/components/auth/auth-guard";

export const metadata: Metadata = {
    title: "Cremeria | Food Delivery",
    description: "Premium food and grocery delivery mobile app.",
};

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: '#ee2b34',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            </head>
            <body>
                <div className="app-wrapper">
                    <AuthGuard>
                        {children}
                    </AuthGuard>
                </div>
            </body>
        </html>
    );
}
