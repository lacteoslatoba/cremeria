"use client"

import { useState } from "react";

const FALLBACK = "/product-placeholder.svg";

/*
 * Algunas fotos de producto vienen de hosts externos (Unsplash, ibb.co)
 * que de vez en cuando dan de baja o cambian una imagen (ya pasó antes
 * con los tiles del mapa). Si el link muere, un <img> normal se queda
 * roto para siempre. Este componente cae a un ícono local (siempre
 * disponible, no depende de internet de terceros) en cuanto la imagen
 * falla o no hay src.
 */
export function SafeImage({
    src,
    alt,
    className,
}: {
    src?: string | null;
    alt: string;
    className?: string;
}) {
    const [failed, setFailed] = useState(false);
    return (
        <img
            src={!failed && src ? src : FALLBACK}
            alt={alt}
            className={className}
            onError={() => setFailed(true)}
        />
    );
}
