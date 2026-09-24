import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

// Sirve tools/simu.html (el simulador de celular) desde el propio servidor de
// desarrollo, en vez de abrirlo como archivo local (file://). Abierto como
// archivo, el iframe que carga la app queda en un "sitio" distinto (file://)
// al de localhost:3000 -- el navegador bloquea ahi la cookie de sesion por
// ser contexto de terceros, y el login se queda parpadeando (rebota entre
// / y /login sin quedarse nunca adentro). Sirviendolo aqui, el iframe es
// mismo origen que la app -- la cookie se guarda normal, como en cualquier
// pestana. Solo existe en dev: nunca se despliega a produccion.
export async function GET(): Promise<NextResponse> {
    if (process.env.NODE_ENV === "production") {
        return new NextResponse("Not found", { status: 404 });
    }

    const html = await readFile(path.join(process.cwd(), "tools", "simu.html"), "utf-8");
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
