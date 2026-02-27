const OFFERS = [
    {
        id: 1,
        title: "50% Dto.",
        subtitle: "En Cortes Selectos",
        image: "https://images.unsplash.com/photo-1603048297172-c92544798d5e?auto=format&fit=crop&q=80&w=800",
        color: "from-red-600/80 to-black/80",
    },
    {
        id: 2,
        title: "Envíos Gratis",
        subtitle: "Pedidos +$500",
        image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800",
        color: "from-blue-600/80 to-black/80",
    },
];

export function SpecialOffers() {
    return (
        <div className="mt-8">
            <div className="px-4 mb-4 flex justify-between items-end">
                <h2 className="text-xl font-bold text-foreground">Ofertas Especiales</h2>
                <button className="text-sm font-semibold text-primary">Ver todas</button>
            </div>
            <div className="flex overflow-x-auto gap-4 px-4 pb-4 no-scrollbar snap-x snap-mandatory">
                {OFFERS.map((offer) => (
                    <div
                        key={offer.id}
                        className="relative flex-none w-72 h-40 rounded-3xl overflow-hidden snap-center shadow-[0_8px_30px_rgba(238,43,52,0.15)]"
                    >
                        <img
                            src={offer.image}
                            alt={offer.title}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className={`absolute inset-0 bg-gradient-to-r ${offer.color} mix-blend-multiply`} />
                        <div className="absolute inset-0 p-5 flex flex-col justify-center">
                            <h3 className="text-white text-3xl font-black italic tracking-tight drop-shadow-md">
                                {offer.title}
                            </h3>
                            <p className="text-white/90 font-medium mt-1">{offer.subtitle}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
