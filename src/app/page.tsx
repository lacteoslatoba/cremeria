import { SearchBar } from "@/components/home/search-bar";
import { CategoryPills } from "@/components/home/category-pills";
import { SpecialOffers } from "@/components/home/special-offers";
import { PopularItems } from "@/components/home/popular-items";
import { BottomNav } from "@/components/layout/bottom-nav";
import { HomeHeader } from "@/components/home/home-header";

export default async function Home({ searchParams }: { searchParams: Promise<{ category?: string, query?: string }> }) {
  const params = await searchParams;
  const categoryFilter = params.category || undefined;
  const queryFilter = params.query || undefined;

  return (
    <main className="min-h-[100dvh] pb-safe">
      <HomeHeader />

      <SearchBar />

      {/* Category Pills will navigate to /?category=name */}
      <CategoryPills currentCategory={categoryFilter} />

      {(!categoryFilter && !queryFilter) && <SpecialOffers />}

      <PopularItems categoryFilter={categoryFilter} queryFilter={queryFilter} />

      <BottomNav />
    </main>
  );
}
