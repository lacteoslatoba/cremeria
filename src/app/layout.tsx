import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Cremeria | Food Delivery",
    description: "Premium food and grocery delivery mobile app.",
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
                <meta name="theme-color" content="#ee2b34" />
            </head>
            <body>
                <div className="app-wrapper">
                    {children}
                </div>
            </body>
        </html>
    );
}
