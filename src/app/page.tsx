import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readSession, loadAuthUser } from "@/lib/auth";
import { SearchBar } from "@/components/home/search-bar";
import { CategoryPills } from "@/components/home/category-pills";
import { SpecialOffers } from "@/components/home/special-offers";
import { PopularItems } from "@/components/home/popular-items";
import { BottomNav } from "@/components/layout/bottom-nav";
import { HomeHeader } from "@/components/home/home-header";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ category?: string, query?: string }> }) {
  // AuthGuard (cliente) tambien redirige "/" sin sesion, pero ese chequeo
  // corre DESPUES de montar -- se alcanzaba a ver un parpadeo del catalogo
  // (o el spinner) antes de saltar a /login?portal=cliente. Este chequeo
  // server-side redirige de una, sin parpadeo ni round-trip de mas (mismo
  // patron que /admin).
  const authUser = await loadAuthUser(await readSession({ headers: await headers() } as unknown as Request));
  if (!authUser) {
    redirect("/login?portal=cliente");
  }

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

      <footer className="px-5 py-6 mt-6 text-center text-xs text-gray-500 border-t border-gray-200 flex flex-col gap-1">
        <span>© {new Date().getFullYear()} Cremería del Rancho. Todos los derechos reservados.</span>
        <span className="flex items-center justify-center gap-3">
          <Link href="/terminos" className="hover:underline text-gray-600">Términos</Link>
          <span>·</span>
          <Link href="/aviso-privacidad" className="hover:underline text-gray-600">Aviso de Privacidad</Link>
        </span>
      </footer>

      <BottomNav />
    </main>
  );
}
