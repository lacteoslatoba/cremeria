import Link from "next/link";

// Página 404 global (not-found.tsx).
export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center gap-4">
            <h1 className="text-6xl font-black text-primary">404</h1>
            <p className="text-lg font-semibold">Página no encontrada</p>
            <p className="text-sm text-gray-500">La dirección que buscas no existe o fue movida.</p>
            <Link
                href="/"
                className="px-5 py-2.5 rounded-2xl bg-primary text-white font-bold transition-transform active:scale-[0.98]"
            >
                Volver al inicio
            </Link>
        </div>
    );
}
