"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker } from "leaflet";
import { Loader2, MapPin } from "lucide-react";

type LocationPickerProps = {
    onConfirm: (lat: number, lng: number) => void;
    confirming?: boolean;
};

// Centro por defecto cuando el navegador niega o no tiene el permiso de
// GPS: NO se asume ninguna ciudad concreta (adivinar mal pondría el pin a
// cientos de km de donde toca) -- se abre con una vista alejada de México
// completo y un aviso pidiendo mover el mapa hasta la ubicación real.
const FALLBACK_CENTER: [number, number] = [23.6345, -102.5528];
const FALLBACK_ZOOM = 5;
const GPS_ZOOM = 16;

// Pin arrastrable para que el cliente confirme su ubicación de entrega
// después de pagar (estilo DiDi Food). A diferencia de LiveMap (que solo
// muestra una posición que llega por polling, sin interacción), acá el
// marker es `draggable: true` y el mapa también se puede arrastrar/hacer
// zoom con normalidad -- el cliente ajusta el pin a mano hasta su punto
// exacto antes de confirmar.
export function LocationPicker({ onConfirm, confirming }: LocationPickerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const markerRef = useRef<Marker | null>(null);
    const [position, setPosition] = useState<[number, number] | null>(null);
    const [usedFallback, setUsedFallback] = useState(false);
    const [locating, setLocating] = useState(true);

    useEffect(() => {
        let cancelled = false;

        function placeMarker(L: typeof import("leaflet"), map: LeafletMap, lat: number, lng: number) {
            const icon = L.divIcon({
                className: "",
                html: `<div style="width:40px;height:40px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#ee2b34;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.35);border:2px solid white;">
                    <div style="transform:rotate(45deg);width:12px;height:12px;border-radius:50%;background:white;"></div>
                </div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 40],
            });
            const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
            marker.on("dragend", () => {
                const { lat: newLat, lng: newLng } = marker.getLatLng();
                setPosition([newLat, newLng]);
            });
            markerRef.current = marker;
        }

        (async () => {
            const L = (await import("leaflet")).default;
            if (cancelled || !containerRef.current || mapRef.current) return;

            const map = L.map(containerRef.current, { zoomControl: false }).setView(FALLBACK_CENTER, FALLBACK_ZOOM);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                subdomains: "abc",
                maxZoom: 19,
            }).addTo(map);
            L.control.attribution({ prefix: false, position: "bottomright" })
                .addAttribution('© <a href="https://www.openstreetmap.org/copyright" style="color:inherit">OpenStreetMap</a>')
                .addTo(map);
            L.control.zoom({ position: "bottomright" }).addTo(map);
            mapRef.current = map;

            // El pin también se puede reposicionar tocando el mapa, no solo
            // arrastrándolo -- más fácil de acertar en pantallas chicas.
            map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
                setPosition([e.latlng.lat, e.latlng.lng]);
            });

            if (!("geolocation" in navigator)) {
                setUsedFallback(true);
                setLocating(false);
                setPosition(FALLBACK_CENTER);
                placeMarker(L, map, FALLBACK_CENTER[0], FALLBACK_CENTER[1]);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    if (cancelled || !mapRef.current) return;
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    mapRef.current.setView([lat, lng], GPS_ZOOM);
                    placeMarker(L, mapRef.current, lat, lng);
                    setPosition([lat, lng]);
                    setLocating(false);
                },
                () => {
                    if (cancelled || !mapRef.current) return;
                    setUsedFallback(true);
                    setLocating(false);
                    setPosition(FALLBACK_CENTER);
                    placeMarker(L, mapRef.current, FALLBACK_CENTER[0], FALLBACK_CENTER[1]);
                },
                { enableHighAccuracy: true, timeout: 8000 }
            );
        })();

        return () => {
            cancelled = true;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Si el pin se movió (click en el mapa), reposiciona el marker existente
    // en vez de crear uno nuevo.
    useEffect(() => {
        if (position && markerRef.current) {
            markerRef.current.setLatLng(position);
        }
    }, [position]);

    return (
        <div className="relative w-full h-full">
            <div ref={containerRef} className="absolute inset-0" />

            {locating && (
                <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70 backdrop-blur-sm pointer-events-none">
                    <div className="flex flex-col items-center gap-2 text-gray-600">
                        <Loader2 className="animate-spin" size={28} />
                        <span className="text-sm font-semibold">Buscando tu ubicación…</span>
                    </div>
                </div>
            )}

            {usedFallback && !locating && (
                <div className="absolute top-4 left-4 right-4 z-[500] bg-white rounded-2xl shadow-lg border border-gray-100 px-4 py-3 flex items-center gap-2 text-sm text-gray-700">
                    <MapPin size={18} className="text-primary shrink-0" />
                    <span>No pudimos ubicarte automáticamente. Mueve el mapa y toca o arrastra el pin hasta tu domicilio.</span>
                </div>
            )}

            <div className="absolute bottom-6 left-4 right-4 z-[500]">
                <button
                    onClick={() => position && onConfirm(position[0], position[1])}
                    disabled={!position || confirming}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold text-base py-4 rounded-2xl shadow-xl shadow-primary/30 disabled:opacity-60 active:scale-[0.98] transition-all"
                >
                    {confirming ? <Loader2 className="animate-spin" size={20} /> : <MapPin size={20} />}
                    {confirming ? "Confirmando…" : "Confirmar ubicación aquí"}
                </button>
            </div>
        </div>
    );
}
