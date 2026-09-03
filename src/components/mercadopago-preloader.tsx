"use client";

import { useEffect } from "react";

/*
 * Carga el SDK de Mercado Pago (v2) en segundo plano desde que se abre la app,
 * no hasta que el cliente llega al checkout. Así, para cuando de verdad va a
 * pagar con Mercado Pago, el script ya está listo. No hace nada visible ni
 * bloquea la carga de la app.
 *
 * Además arranca el script de seguridad de MP (device fingerprint) que alimenta
 * su antifraude: sin esa señal es fácil que MP rechace pagos legítimos como
 * alto riesgo.
 */
export function MercadoPagoPreloader() {
    useEffect(() => {
        if (typeof window === "undefined") return;

        // SDK v2 (Card Form / Bricks)
        if (!(window as any).MercadoPago && !document.getElementById("mp-sdk")) {
            const s = document.createElement("script");
            s.id = "mp-sdk";
            s.src = "https://sdk.mercadopago.com/js/v2";
            s.async = true;
            document.body.appendChild(s);
        }

        // Huella de dispositivo (fingerprint) del antifraude de MP.
        // OJO: el dominio real es www.mercadopago.com, NO js.mercadopago.com
        // (ese subdominio ni siquiera resuelve).
        if (!document.getElementById("mp-security-js")) {
            const sec = document.createElement("script");
            sec.id = "mp-security-js";
            sec.src = "https://www.mercadopago.com/v2/security.js";
            sec.async = true;
            document.body.appendChild(sec);
        }
    }, []);

    return null;
}
