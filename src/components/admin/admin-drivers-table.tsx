"use client";

import { Bike } from "lucide-react";
import { DriverActions } from "@/components/admin/driver-actions";
import { DriverEstadoToggle } from "@/components/admin/driver-estado-toggle";

function isRecentlyOnline(updatedAt: string | null) {
    if (!updatedAt) return false;
    return Date.now() - new Date(updatedAt).getTime() < 5 * 60 * 1000; // 5 min
}

export type DriverRow = {
    id: string;
    name: string | null;
    username: string | null;
    phone: string | null;
    locationUpdatedAt: string | null;
    deliveryCount: number;
    activo: boolean;
};

export function AdminDriversTable({ drivers }: { drivers: DriverRow[] }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100 uppercase text-xs font-bold text-gray-500 tracking-wider">
                            <th className="px-4 md:px-6 py-4">Nombre / Usuario</th>
                            <th className="px-4 md:px-6 py-4">Celular</th>
                            <th className="px-4 md:px-6 py-4 text-center">Entregas totales</th>
                            <th className="px-4 md:px-6 py-4 text-center">Última ubicación</th>
                            <th className="px-4 md:px-6 py-4 text-center">Estado</th>
                            <th className="px-4 md:px-6 py-4 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-slate-700">
                        {drivers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-10 text-gray-400 italic">
                                    No has dado de alta a ningún repartidor todavía.
                                </td>
                            </tr>
                        ) : drivers.map((d) => {
                            const online = isRecentlyOnline(d.locationUpdatedAt);
                            return (
                                <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-4 md:px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                <Bike size={18} />
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="font-bold text-gray-900">{d.name || "Sin nombre"}</div>
                                                {d.username && <div className="text-xs font-medium text-gray-400 mt-0.5">@{d.username}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 md:px-6 py-4 font-medium text-gray-700">
                                        {d.phone || <span className="text-gray-400 italic">No registrado</span>}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 text-center font-bold text-gray-900">
                                        {d.deliveryCount}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 text-center text-sm text-gray-500">
                                        {d.locationUpdatedAt
                                            ? new Date(d.locationUpdatedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
                                            : "—"}
                                        {/* "En linea" ya no es el Estado (ese lo decide el admin):
                                            queda aqui como dato, junto a la ultima ubicacion. */}
                                        {online && <div className="text-[11px] font-bold text-green-600 mt-0.5">en línea</div>}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 text-center">
                                        <DriverEstadoToggle driverId={d.id} nombre={d.name} activo={d.activo} />
                                    </td>
                                    <td className="px-4 md:px-6 py-4">
                                        <DriverActions driver={{ id: d.id, name: d.name, username: d.username, phone: d.phone }} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
