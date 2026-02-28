import { Search, User } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AddCustomerButton } from "@/components/admin/add-customer-button";

export default async function AdminCustomersPage() {
    const users = await prisma.user.findMany({
        include: {
            _count: {
                select: { orders: true }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    return (
        <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Directorio de Clientes</h2>
                    <p className="text-sm md:text-base text-gray-500 mt-1 font-medium">Da de alta a tus clientes para que puedan ingresar y comprar.</p>
                </div>

                <AddCustomerButton />
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-6">
                <div className="relative flex-1 w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o correo electrónico..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                    />
                </div>
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 uppercase text-xs font-bold text-gray-500 tracking-wider">
                                <th className="px-4 md:px-6 py-4">Usuario</th>
                                <th className="px-4 md:px-6 py-4">Correo (Login)</th>
                                <th className="px-4 md:px-6 py-4">Celular</th>
                                <th className="px-4 md:px-6 py-4 text-center">Pedidos</th>
                                <th className="px-4 md:px-6 py-4 text-center">Registro</th>
                                <th className="px-4 md:px-6 py-4 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-slate-700">
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 text-gray-400 italic">No hay clientes registrados aún.</td>
                                </tr>
                            ) : users.map((u: any) => (
                                <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-4 md:px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                {u.name ? u.name.charAt(0).toUpperCase() : <User size={18} />}
                                            </div>
                                            <div className="font-bold text-gray-900">{u.name || "Sin nombre"}</div>
                                        </div>
                                    </td>

                                    <td className="px-4 md:px-6 py-4 font-medium text-gray-700">
                                        {u.email}
                                    </td>

                                    <td className="px-4 md:px-6 py-4 font-medium text-gray-700">
                                        {u.phone || <span className="text-gray-400 italic">No registrado</span>}
                                    </td>

                                    <td className="px-4 md:px-6 py-4 text-center font-bold text-gray-900">
                                        {u._count.orders} <span className="text-xs font-normal text-gray-500 ml-1">compras</span>
                                    </td>

                                    <td className="px-4 md:px-6 py-4 text-center text-sm text-gray-500">
                                        {u.createdAt.toLocaleDateString()}
                                    </td>

                                    <td className="px-4 md:px-6 py-4 text-center">
                                        <span className="inline-block px-3 py-1.5 text-xs font-bold rounded-lg bg-green-100 text-green-700">
                                            ACTIVO
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-gray-50/30 flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">Mostrando {users.length} usuarios</span>
                </div>
            </div>
        </div>
    );
}
