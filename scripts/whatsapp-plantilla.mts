/**
 * Crea la plantilla de AUTENTICACION con boton "Copiar codigo" en la WhatsApp
 * Business Account de Meta — Cremería del Rancho.
 *
 * Existe porque el codigo de verificacion NO se puede mandar como texto libre:
 * Meta solo acepta texto libre dentro de la ventana de 24 h que abre el cliente
 * al escribirnos, y un OTP siempre lo inicia el negocio. Fuera de esa ventana el
 * unico mensaje permitido es una plantilla preaprobada de categoria
 * "authentication", y crearla a mano en el panel de Meta es un formulario de
 * varios pasos con nombres de componentes que no adivina nadie. Aqui va el
 * payload exacto que pide la doc oficial (BODY + FOOTER con expiracion +
 * BUTTONS type otp / otp_type copy_code).
 *
 * Es idempotente: si la plantilla ya existe con ese nombre e idioma, solo
 * imprime su estado (APPROVED / PENDING / REJECTED) y no crea nada.
 *
 * Uso:
 *   npm.cmd run whatsapp:plantilla                         # usa META_WABA_ID del .env.local
 *   npm.cmd run whatsapp:plantilla -- --waba 1234567890    # sin tocar el .env.local
 *   npm.cmd run whatsapp:plantilla -- --seco               # imprime el payload y NO llama a Meta
 *   npm.cmd run whatsapp:plantilla -- --nombre codigo_verificacion_cremeria --idioma es_MX --expira 10
 *
 * Variables: META_WHATSAPP_TOKEN (obligatoria), META_WABA_ID (id de la WhatsApp
 * Business Account, NO el del numero), META_WHATSAPP_TEMPLATE (nombre),
 * META_WHATSAPP_TEMPLATE_LANG (idioma).
 */
const API = "https://graph.facebook.com/v23.0";

const argv = process.argv.slice(2);

function arg(nombre: string): string | undefined {
    const i = argv.indexOf(`--${nombre}`);
    const valor = i >= 0 ? argv[i + 1] : undefined;
    return valor && !valor.startsWith("--") ? valor : undefined;
}

const SECO = argv.includes("--seco");
const waba = arg("waba") || process.env.META_WABA_ID;
const token = process.env.META_WHATSAPP_TOKEN;
const nombre = arg("nombre") || process.env.META_WHATSAPP_TEMPLATE || "codigo_verificacion_cremeria";
const idioma = arg("idioma") || process.env.META_WHATSAPP_TEMPLATE_LANG || "es_MX";
const expira = Number(arg("expira") || 10);
const textoBoton = arg("boton");
// El TTL es opcional a proposito: Meta ya trae 10 minutos por defecto para las
// plantillas de autenticacion, que es justo lo que dura el codigo de la app. Se
// manda solo si se pide con --ttl <segundos>.
const ttl = arg("ttl");

const payload = {
    name: nombre,
    language: idioma,
    category: "authentication",
    ...(ttl ? { message_send_ttl_seconds: Number(ttl) } : {}),
    components: [
        { type: "body", add_security_recommendation: true },
        { type: "footer", code_expiration_minutes: expira },
        {
            type: "buttons",
            buttons: [{ type: "otp", otp_type: "copy_code", ...(textoBoton ? { text: textoBoton } : {}) }],
        },
    ],
};

type PlantillaMeta = { name?: string; status?: string; language?: string; rejected_reason?: string };
type RespuestaPlantillas = {
    data?: PlantillaMeta[];
    error?: { message?: string; error_user_msg?: string; code?: number };
};
type RespuestaCreacion = {
    id?: string;
    status?: string;
    error?: { message?: string; error_user_msg?: string; code?: number };
};

function volcarError(error: RespuestaPlantillas["error"], respaldo: string): void {
    console.error(`Meta rechazo la peticion: ${error?.message || respaldo}`);
    if (error?.error_user_msg) console.error(`  detalle: ${error.error_user_msg}`);
    if (error?.code) console.error(`  codigo: ${error.code}`);
}

async function main(): Promise<number> {
    console.log("=== Plantilla de autenticacion (WhatsApp Cloud API) ===");
    console.log(`Nombre:  ${nombre}`);
    console.log(`Idioma:  ${idioma}`);
    console.log("Boton:   Copiar codigo (otp_type copy_code)");
    console.log(`Expira:  ${expira} minutos`);
    console.log(`WABA:    ${waba || "(falta META_WABA_ID)"}`);

    if (SECO) {
        console.log("\n--seco: solo se imprime lo que se mandaria, sin llamar a Meta.\n");
        console.log(`POST ${API}/${waba || "<WABA_ID>"}/message_templates`);
        console.log(JSON.stringify(payload, null, 2));
        return 0;
    }

    if (!token) {
        console.error("\nFalta META_WHATSAPP_TOKEN (en .env.local o en el entorno).");
        return 1;
    }
    if (!waba) {
        console.error("\nFalta META_WABA_ID: es el id de la WhatsApp Business Account (Meta -> WhatsApp -> Configuracion de la cuenta), no el del numero de telefono.");
        console.error("Puedes pasarlo sin tocar el .env.local:  npm.cmd run whatsapp:plantilla -- --waba 1234567890");
        return 1;
    }

    const cabeceras = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    // Primero se busca si ya existe: crear una plantilla duplicada no rompe nada
    // pero ensucia la WABA y confunde cual se manda.
    const listado = await fetch(
        `${API}/${waba}/message_templates?fields=name,status,language,rejected_reason&limit=200`,
        { headers: cabeceras }
    );
    const existentes = (await listado.json()) as RespuestaPlantillas;
    if (!listado.ok) {
        volcarError(existentes.error, `HTTP ${listado.status}`);
        return 1;
    }

    const yaExiste = existentes.data?.find((t) => t.name === nombre && t.language === idioma);
    if (yaExiste) {
        console.log(`\nYa existe: ${yaExiste.name} (${yaExiste.language}) -> ${yaExiste.status}`);
        if (yaExiste.rejected_reason) console.log(`Motivo del rechazo: ${yaExiste.rejected_reason}`);
        if (yaExiste.status !== "APPROVED") {
            console.log("Si esta PENDING, Meta la aprueba en minutos (las de autenticacion suelen ser inmediatas).");
        }
        console.log(`\nDeja en el entorno:  META_WHATSAPP_TEMPLATE=${nombre}  y  META_WHATSAPP_TEMPLATE_LANG=${idioma}`);
        return yaExiste.status === "REJECTED" ? 1 : 0;
    }

    console.log("\nNo existe todavia: se crea...");
    const creacion = await fetch(`${API}/${waba}/message_templates`, {
        method: "POST",
        headers: cabeceras,
        body: JSON.stringify(payload),
    });
    const creada = (await creacion.json()) as RespuestaCreacion;
    if (!creacion.ok) {
        volcarError(creada.error, `HTTP ${creacion.status}`);
        return 1;
    }

    console.log(`Creada: id ${creada.id} -> ${creada.status}`);
    console.log(`\nSiguiente paso: pon META_WHATSAPP_TEMPLATE=${nombre} y META_WHATSAPP_TEMPLATE_LANG=${idioma} en .env.local y en produccion.`);
    console.log("Luego prueba el envio real:  npm.cmd run whatsapp:prueba -- 6131414210");
    return 0;
}

main()
    .then((codigo) => process.exit(codigo))
    .catch((err) => {
        console.error("Fallo la creacion de la plantilla:", err instanceof Error ? err.message : err);
        process.exit(1);
    });
