import { Milk, Beef, Carrot, Croissant } from "lucide-react";

const CATEGORIES = [
    { id: 1, name: "Lácteos", icon: Milk, color: "text-blue-400", bg: "bg-blue-400/10", shadow: "shadow-blue-500/20" },
    { id: 2, name: "Carnes", icon: Beef, color: "text-red-400", bg: "bg-red-400/10", shadow: "shadow-red-500/20" },
    { id: 3, name: "Verduras", icon: Carrot, color: "text-green-400", bg: "bg-green-400/10", shadow: "shadow-green-500/20" },
    { id: 4, name: "Panadería", icon: Croissant, color: "text-amber-400", bg: "bg-amber-400/10", shadow: "shadow-amber-500/20" },
];

export function CategoryPills() {
    return (
        <div className="px-4 mt-8 pb-2">
            <div className="flex justify-between items-center gap-2 overflow-x-auto no-scrollbar">
                {CATEGORIES.map((category) => (
                    <button
                        key={category.id}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl min-w-[76px] transition-transform active:scale-95 border border-white/5 backdrop-blur-sm ${category.bg} shadow-lg ${category.shadow}`}
                    >
                        <category.icon className={`mb-2 w-7 h-7 ${category.color} drop-shadow-[0_0_8px_currentColor]`} />
                        <span className="text-xs font-semibold text-foreground">{category.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
