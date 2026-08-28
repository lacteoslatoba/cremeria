"use client"

import { useEffect } from "react";

/*
 * Carga el SDK de Stripe en segundo plano desde que se abre la app (no
 * hasta que el cliente llega al checkout). Así, para cuando de verdad
 * necesita pagar, el script ya está listo -- en vez de esperar los
 * varios segundos que tarda en conectar/descargar en ese momento.
 * No hace nada visible ni bloquea la carga de la app: es solo un
 * adelanto. El checkout sigue teniendo su propia lógica de reintentos
 * por si esto no llegó a tiempo o falló.
 */
export function StripePreloader() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        if ((window as any).Stripe) return;
        if (document.getElementById("stripe-sdk-v3")) return;

        const s = document.createElement("script");
        s.id = "stripe-sdk-v3";
        s.src = "https://js.stripe.com/v3/";
        s.async = true;
        document.body.appendChild(s);
    }, []);

    return null;
}
