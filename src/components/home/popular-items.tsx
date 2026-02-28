import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";

export async function PopularItems({ categoryFilter }: { categoryFilter?: string }) {
    const products = await prisma.product.findMany({
        where: {
            status: "ACTIVE",
            ...(categoryFilter ? { category: categoryFilter } : {})
        },
        take: 20,
    });

    return (
        <div className="mt-6 pb-24 px-4 relative z-10">
            <h2 className="text-xl font-bold text-foreground mb-4">
                {categoryFilter ? `Productos en ${categoryFilter}` : "Populares"}
            </h2>
            <div className="flex flex-col gap-4">
                {products.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">No hay productos disponibles por ahora.</p>
                ) : (
                    products.map((item: any) => (
                        <div
                            key={item.id}
                            className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-sm"
                        >
                            <img
                                src={item.image || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=300"}
                                alt={item.name}
                                className="w-20 h-20 rounded-xl object-cover shadow-inner bg-gray-800"
                            />
                            <div className="flex-1 flex flex-col justify-center">
                                <h3 className="font-semibold text-[15px] leading-tight text-foreground line-clamp-2">
                                    {item.name}
                                </h3>
                                <p className="text-primary font-bold mt-1 text-sm drop-shadow-[0_0_2px_rgba(238,43,52,0.5)]">
                                    ${item.price.toFixed(2)}
                                </p>
                            </div>
                            <button className="flex items-center justify-center min-w-[36px] min-h-[36px] rounded-full bg-primary hover:bg-primary-hover shadow-[0_0_12px_rgba(238,43,52,0.6)] transition-transform active:scale-95 text-white mr-1 outline-none">
                                <Plus size={20} strokeWidth={3} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
