import { Bike } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AddDriverButton } from "@/components/admin/add-driver-button";

function isRecentlyOnline(updatedAt: Date | null) {
    if (!updatedAt) return false;
    return Date.now() - new Date(updatedAt).getTime() < 5 * 60 * 1000; // 5 min
}

export default async function AdminDeliveriesPage() {
    const drivers = await prisma.user.findMany({
        where: { role: "DELIVERY" },
        include: {
            _count: { select: { deliveryOrders: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    return (
        <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Repartidores</h2>
                    <p className="text-sm md:text-base text-gray-500 mt-1 font-medium">Da de alta a tus repartidores y revisa quién está en línea.</p>
                </div>
                <AddDriverButton />
            </div>

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
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-slate-700">
                            {drivers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-10 text-gray-400 italic">
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
                                            {(d as any)._count.deliveryOrders}
                                        </td>
                                        <td className="px-4 md:px-6 py-4 text-center text-sm text-gray-500">
                                            {d.locationUpdatedAt
                                                ? new Date(d.locationUpdatedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
                                                : "—"}
                                        </td>
                                        <td className="px-4 md:px-6 py-4 text-center">
                                            <span className={`inline-block px-3 py-1.5 text-xs font-bold rounded-lg ${online ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                                {online ? "EN LÍNEA" : "DESCONECTADO"}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
