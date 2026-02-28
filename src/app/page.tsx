import { SearchBar } from "@/components/home/search-bar";
import { CategoryPills } from "@/components/home/category-pills";
import { SpecialOffers } from "@/components/home/special-offers";
import { PopularItems } from "@/components/home/popular-items";
import { BottomNav } from "@/components/layout/bottom-nav";

export default async function Home({ searchParams }: { searchParams: Promise<{ category?: string, query?: string }> }) {
  const params = await searchParams;
  const categoryFilter = params.category || undefined;
  const queryFilter = params.query || undefined;

  return (
    <main className="min-h-[100dvh] pb-safe">
      <header className="pt-10 px-4">
        <h1 className="text-2xl font-black text-foreground tracking-tight">
          Hola, <span className="text-primary drop-shadow-[0_0_8px_rgba(238,43,52,0.4)]">Miguel</span> 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">¿Llevamos tu despensa hoy?</p>
      </header>

      <SearchBar />

      {/* Category Pills will navigate to /?category=name */}
      <CategoryPills currentCategory={categoryFilter} />

      {(!categoryFilter && !queryFilter) && <SpecialOffers />}

      <PopularItems categoryFilter={categoryFilter} queryFilter={queryFilter} />

      <BottomNav />
    </main>
  );
}
