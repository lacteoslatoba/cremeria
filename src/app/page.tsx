import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

// Landing publica de cremeriadelrancho.com (25/09, instruccion directa de
// Mike: "www.cremeriadelrancho.com va ser una pag web y de hay vas a poder
// bajar la app de cliente"). La tienda real vive en /tienda -- esta pagina
// no pide sesion (ver auth-guard.tsx) para que cargue igual para un
// visitante sin cuenta, un buscador o una preview de WhatsApp/redes.
export const metadata: Metadata = {
    title: "Cremería del Rancho",
    description: "Lo nuestro es calidad. Pide tus lácteos a domicilio.",
};

export default function LandingPage() {
    return (
        <main className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-12 text-center gap-6 bg-white">
            <Image
                src="/icon.png"
                alt="Cremería del Rancho"
                width={96}
                height={96}
                className="rounded-2xl shadow-lg"
                priority
            />

            <div>
                <h1 className="text-3xl font-black text-gray-900">Cremería del Rancho</h1>
                <p className="mt-2 text-gray-500">Lo nuestro es calidad. Pide tus lácteos a domicilio.</p>
            </div>

            <Link
                href="/tienda"
                className="mt-2 px-8 py-3.5 rounded-2xl bg-primary text-white font-bold text-lg shadow-lg shadow-primary/30 active:scale-[0.98] transition-transform"
            >
                Entrar a la tienda
            </Link>

            <p className="text-xs text-gray-400 max-w-xs">
                Abre este link desde tu celular y usa &quot;Agregar a pantalla de inicio&quot; para instalar la app.
            </p>

            <footer className="mt-10 flex flex-col items-center gap-2 text-xs text-gray-400">
                <div className="flex items-center gap-4">
                    <Link href="/terminos" className="hover:underline">Términos</Link>
                    <span>·</span>
                    <Link href="/aviso-privacidad" className="hover:underline">Aviso de Privacidad</Link>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="/driver" className="hover:underline">Repartidores</Link>
                    <span>·</span>
                    <Link href="/login?portal=admin" className="hover:underline">Control Panel</Link>
                </div>
                <span className="mt-2">© {new Date().getFullYear()} Cremería del Rancho. Todos los derechos reservados.</span>
            </footer>
        </main>
    );
}
