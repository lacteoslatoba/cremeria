import { Search, SlidersHorizontal } from "lucide-react";

export function SearchBar() {
    return (
        <div className="px-4 mt-6">
            <div className="relative flex items-center w-full h-12 rounded-full overflow-hidden bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
                <div className="pl-4 text-gray-400">
                    <Search size={20} />
                </div>
                <input
                    type="text"
                    placeholder="¿Qué se te antoja hoy?"
                    className="flex-1 w-full h-full bg-transparent border-none outline-none text-foreground placeholder:text-gray-400 px-3 font-medium text-sm"
                />
                <button className="pr-4 text-primary hover:text-primary-hover transition-colors">
                    <SlidersHorizontal size={20} />
                </button>
            </div>
        </div>
    );
}
