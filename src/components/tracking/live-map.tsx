"use client"

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

type LiveMapProps = {
    lat: number;
    lng: number;
};

// Thin wrapper around Leaflet (OpenStreetMap tiles — no API key needed).
// Loaded fully client-side: leaflet touches `window` at runtime, so it's
// imported lazily inside useEffect rather than at module scope.
export function LiveMap({ lat, lng }: LiveMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const L = (await import("leaflet")).default;
            if (cancelled || !containerRef.current || mapRef.current) return;

            const icon = L.divIcon({
                className: "",
                html: `<div style="width:34px;height:34px;border-radius:50%;background:#ee2b34;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(238,43,52,0.8);border:2px solid white;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
                </div>`,
                iconSize: [34, 34],
                iconAnchor: [17, 17],
            });

            const map = L.map(containerRef.current, {
                zoomControl: false,
                attributionControl: false,
            }).setView([lat, lng], 15);

            // Standard OpenStreetMap tiles (free, no API key). A CSS filter on the
            // tile pane approximates a dark map to match the app's dark theme.
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                subdomains: "abc",
                maxZoom: 19,
            }).addTo(map);

            const tilePane = map.getPane("tilePane");
            if (tilePane) tilePane.style.filter = "invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.9) saturate(0.6)";

            L.control.attribution({ prefix: false, position: "bottomright" })
                .addAttribution('© <a href="https://www.openstreetmap.org/copyright" style="color:inherit">OpenStreetMap</a>')
                .addTo(map);

            markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
            mapRef.current = map;
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

    // Keep marker + view in sync as new coordinates arrive from polling.
    useEffect(() => {
        if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
            mapRef.current?.panTo([lat, lng], { animate: true });
        }
    }, [lat, lng]);

    return <div ref={containerRef} className="absolute inset-0" />;
}
