import { Milk, Beef, Carrot, Croissant } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const CATEGORIES = [
    { id: 1, name: "Lácteos", icon: Milk, color: "text-blue-400", bg: "bg-blue-400/10", shadow: "shadow-blue-500/20" },
    { id: 2, name: "Carnes", icon: Beef, color: "text-red-400", bg: "bg-red-400/10", shadow: "shadow-red-500/20" },
    { id: 3, name: "Verduras", icon: Carrot, color: "text-green-400", bg: "bg-green-400/10", shadow: "shadow-green-500/20" },
    { id: 4, name: "Panadería", icon: Croissant, color: "text-amber-400", bg: "bg-amber-400/10", shadow: "shadow-amber-500/20" },
];

export function CategoryPills({ currentCategory }: { currentCategory?: string }) {
    return (
        <div className="px-4 mt-8 pb-2">
            <div className="flex justify-between items-center gap-2 overflow-x-auto no-scrollbar">
                {CATEGORIES.map((category) => {
                    const isActive = currentCategory === category.name;
                    return (
                        <Link
                            key={category.id}
                            href={isActive ? "/" : `/?category=${category.name}`}
                            className="flex flex-col items-center gap-2 min-w-[70px] transition-transform active:scale-95 group"
                        >
                            <div className={cn(
                                "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm relative",
                                category.bg,
                                isActive
                                    ? "border-2 border-primary scale-105 shadow-md shadow-primary/20 bg-white"
                                    : "border border-white/10 group-hover:scale-105"
                            )}>
                                <category.icon className={cn(
                                    "w-7 h-7 transition-all",
                                    isActive ? "text-primary drop-shadow-[0_0_8px_rgba(238,43,52,0.4)]" : category.color
                                )} />
                            </div>
                            <span className={cn(
                                "text-xs font-bold transition-colors",
                                isActive ? "text-primary" : "text-foreground"
                            )}>
                                {category.name}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </div>
    );
}
