"use client"

import { useEffect } from "react";

/*
 * Carga el SDK de Conekta (tokenizer directo -- Conekta.Token.create) en
 * segundo plano desde que se abre la app, no hasta que el cliente llega al
 * checkout. Así, para cuando de verdad necesita pagar, el script ya está
 * listo. No hace nada visible ni bloquea la carga de la app. El checkout
 * sigue teniendo su propia lógica de reintentos por si esto no llegó a
 * tiempo o falló.
 */
export function ConektaPreloader() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        if ((window as any).Conekta) return;
        if (document.getElementById("conekta-tokenizer-sdk")) return;

        const s = document.createElement("script");
        s.id = "conekta-tokenizer-sdk";
        s.src = "https://cdn.conekta.io/js/latest/conekta.js";
        s.async = true;
        document.body.appendChild(s);
    }, []);

    return null;
}
