"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker, Polyline } from "leaflet";

type LiveMapProps = {
    lat: number;
    lng: number;
    destLat: number;
    destLng: number;
};

// Thin wrapper around Leaflet (OpenStreetMap tiles — no API key needed).
// Loaded fully client-side: leaflet touches `window` at runtime, so it's
// imported lazily inside useEffect rather than at module scope.
//
// Muestra el repartidor Y el destino (estilo DiDi Food: se ve qué tan lejos
// está) con una línea recta entre ambos -- sin ruteo real por calles, solo
// distancia en línea recta, que es lo que de verdad importa para "cuánto
// falta". El mapa se ve en sus colores normales (sin el filtro oscuro que
// tenía antes): esta pantalla ahora es de tema claro mientras el repartidor
// va en camino.
export function LiveMap({ lat, lng, destLat, destLng }: LiveMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const driverMarkerRef = useRef<Marker | null>(null);
    const lineRef = useRef<Polyline | null>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const L = (await import("leaflet")).default;
            if (cancelled || !containerRef.current || mapRef.current) return;

            const driverIcon = L.divIcon({
                className: "",
                html: `<div style="width:34px;height:34px;border-radius:50%;background:#ee2b34;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.35);border:2px solid white;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
                </div>`,
                iconSize: [34, 34],
                iconAnchor: [17, 17],
            });
            const destIcon = L.divIcon({
                className: "",
                html: `<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#1f2937;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.35);border:2px solid white;">
                    <div style="transform:rotate(45deg);width:10px;height:10px;border-radius:50%;background:white;"></div>
                </div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 32],
            });

            const map = L.map(containerRef.current, {
                zoomControl: false,
                attributionControl: false,
            });
            map.fitBounds([[lat, lng], [destLat, destLng]], { padding: [48, 48], maxZoom: 16 });

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                subdomains: "abc",
                maxZoom: 19,
            }).addTo(map);

            L.control.attribution({ prefix: false, position: "bottomright" })
                .addAttribution('© <a href="https://www.openstreetmap.org/copyright" style="color:inherit">OpenStreetMap</a>')
                .addTo(map);

            L.marker([destLat, destLng], { icon: destIcon }).addTo(map);
            lineRef.current = L.polyline([[lat, lng], [destLat, destLng]], {
                color: "#ee2b34",
                weight: 3,
                dashArray: "8 8",
            }).addTo(map);
            driverMarkerRef.current = L.marker([lat, lng], { icon: driverIcon }).addTo(map);
            mapRef.current = map;
        })();

        return () => {
            cancelled = true;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
        // Destino y encuadre inicial solo importan al montar -- solo la
        // posición del repartidor se actualiza en vivo (ver abajo).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep marker + line in sync as new coordinates arrive from polling.
    useEffect(() => {
        if (driverMarkerRef.current) {
            driverMarkerRef.current.setLatLng([lat, lng]);
        }
        if (lineRef.current) {
            lineRef.current.setLatLngs([[lat, lng], [destLat, destLng]]);
        }
    }, [lat, lng, destLat, destLng]);

    return <div ref={containerRef} className="absolute inset-0" />;
}
