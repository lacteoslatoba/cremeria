import { SearchBar } from "@/components/home/search-bar";
import { CategoryPills } from "@/components/home/category-pills";
import { SpecialOffers } from "@/components/home/special-offers";
import { PopularItems } from "@/components/home/popular-items";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function Home() {
  return (
    <main className="min-h-screen pb-safe">
      <header className="pt-10 px-4">
        <h1 className="text-2xl font-black text-foreground tracking-tight">
          Hola, <span className="text-primary drop-shadow-[0_0_8px_rgba(238,43,52,0.4)]">Luis</span> 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">¿Llevamos tu despensa hoy?</p>
      </header>

      <SearchBar />
      <CategoryPills />
      <SpecialOffers />
      <PopularItems />

      <BottomNav />
    </main>
  );
}
