"use client"

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export function SearchBar() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const initialQuery = searchParams.get("query") || "";
    const [text, setText] = useState(initialQuery);
    const [debouncedValue, setDebouncedValue] = useState(initialQuery);

    // Manual debounce implementation
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(text);
        }, 300);

        return () => {
            clearTimeout(handler);
        };
    }, [text]);

    // Sync input with actual debounced value sending to URL
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (debouncedValue) {
            params.set("query", debouncedValue);
        } else {
            params.delete("query");
        }

        // Prevent unnecessary push if nothing actually changed
        const newUrl = `/?${params.toString()}`;
        if (newUrl !== `/?${searchParams.toString()}`) {
            router.replace(newUrl, { scroll: false });
        }
    }, [debouncedValue, router, searchParams]);

    // Handle clear
    const handleClear = () => {
        setText("");
    };

    return (
        <div className="px-4 mt-6">
            <div className="relative flex items-center w-full h-12 rounded-full overflow-hidden bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
                <div className="pl-4 text-gray-400">
                    <Search size={20} />
                </div>
                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="¿Qué se te antoja hoy?"
                    className="flex-1 w-full h-full bg-transparent border-none outline-none text-foreground placeholder:text-gray-400 px-3 font-medium text-sm"
                />
                {text && (
                    <button onClick={handleClear} className="pr-3 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                )}
                <button className="pr-4 text-primary hover:text-primary-hover transition-colors border-l border-white/20 pl-3">
                    <SlidersHorizontal size={20} />
                </button>
            </div>
        </div>
    );
}
