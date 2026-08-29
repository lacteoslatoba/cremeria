"use client"

import { useEffect } from "react";

/*
 * Carga el SDK de Conekta en segundo plano desde que se abre la app (no
 * hasta que el cliente llega al checkout). Así, para cuando de verdad
 * necesita pagar, el script ya está listo -- misma optimización que se
 * hizo antes para Stripe. No hace nada visible ni bloquea la carga de la
 * app. El checkout sigue teniendo su propia lógica de reintentos por si
 * esto no llegó a tiempo o falló.
 */
export function ConektaPreloader() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        if ((window as any).ConektaCheckoutComponents) return;
        if (document.getElementById("conekta-checkout-sdk")) return;

        const s = document.createElement("script");
        s.id = "conekta-checkout-sdk";
        s.src = "https://pay.conekta.com/v1.0/js/conekta-checkout.min.js";
        s.crossOrigin = "anonymous";
        s.async = true;
        document.body.appendChild(s);
    }, []);

    return null;
}
