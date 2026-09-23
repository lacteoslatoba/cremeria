// Shared SMS helper — same Twilio pattern already used in forgot-password.
// Falls back to a console log ("simulated SMS") when Twilio env vars are
// missing, so the app keeps working locally / before Twilio is configured.

function formatMxPhone(raw: string): string {
    const cleaned = raw.replace(/[^\d]/g, "");
    if (cleaned.length === 10) return `+52${cleaned}`;
    if (raw.startsWith("+")) return raw;
    return `+${cleaned}`;
}

// WhatsApp NO usa el mismo formato que SMS en Mexico: los moviles conservan el
// "1" historico en su identidad de WhatsApp (+521 + 10 digitos), mientras que
// para SMS ese "1" ya se elimino (+52 + 10). Mandar al formato de SMS hace que
// Twilio conteste 63015 ("can only send messages to phone numbers that have
// joined the Sandbox"), que suena a opt-in faltante pero es el numero
// equivocado. Comprobado contra la API con el mismo telefono y el mismo
// instante: con el 1 llega "delivered", sin el 1 falla con 63015.
export function formatMxPhoneWhatsApp(raw: string): string {
    const cleaned = raw.replace(/[^\d]/g, "");
    const conUno = (diezDigitos: string) => `+521${diezDigitos}`;
    if (cleaned.length === 10) return conUno(cleaned);
    if (cleaned.length === 12 && cleaned.startsWith("52")) return conUno(cleaned.slice(2));
    if (cleaned.length === 13 && cleaned.startsWith("521")) return `+${cleaned}`;
    if (raw.startsWith("+")) return raw;
    return `+${cleaned}`;
}

export async function sendSms(phone: string, body: string): Promise<boolean> {
    if (!phone) return false;

    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const twilio = require("twilio");
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            await client.messages.create({
                body,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: formatMxPhone(phone),
            });
            return true;
        } catch (err) {
            console.error("[SMS ERROR]", err);
            return false;
        }
    }

    console.log(`[SIMULATED SMS] to ${phone}: ${body}`);
    return false;
}

// Proveedor de WhatsApp para los codigos de verificacion. Se elige con
// WHATSAPP_PROVIDER (meta|twilio); sin la variable se usa el que tenga
// credenciales, y Meta primero porque su numero de prueba NO caduca como el
// sandbox de Twilio (que obliga al cliente a unirse cada 3 dias y ademas topa
// en pocos mensajes al dia).
function proveedorWhatsApp(): "meta" | "twilio" | "simulado" {
    const forzado = (process.env.WHATSAPP_PROVIDER || "").toLowerCase();
    if (forzado === "meta" || forzado === "twilio") return forzado;
    if (process.env.META_WHATSAPP_TOKEN && process.env.META_PHONE_NUMBER_ID) return "meta";
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER) return "twilio";
    return "simulado";
}

// Para que quien llama a sendWhatsAppCode sepa si el envio es real o va a
// quedar en modo simulado (sin proveedor configurado) -- lo usa el registro
// publico para decidir si vale la pena exigir OTP_ESTRICTO.
export function whatsappProviderConfigured(): boolean {
    return proveedorWhatsApp() !== "simulado";
}

type ParametroTexto = { type: "text"; text: string };
type ComponentePlantilla =
    | { type: "body"; parameters: ParametroTexto[] }
    | { type: "button"; sub_type: "url"; index: string; parameters: ParametroTexto[] };

type ResultadoMeta = { ok: boolean; detalle: string };

/**
 * Plantilla de AUTENTICACION (categoria "authentication" de Meta), con el
 * boton "Copiar codigo".
 *
 * Por que plantilla y no texto libre: Meta SOLO acepta texto libre dentro de la
 * ventana de 24 h que abre el cliente al escribirnos, y un OTP siempre lo inicia
 * el negocio (el cliente apenas se esta registrando, todavia no nos escribio).
 * Fuera de esa ventana el unico mensaje permitido es una plantilla preaprobada
 * -- por eso el codigo de verificacion va con plantilla, y el texto libre queda
 * solo como respaldo.
 *
 * El boton "Copiar codigo" se CREA como type "otp" + otp_type "copy_code", pero
 * WhatsApp lo convierte a un boton URL cuando aprueba la plantilla (lo dice la
 * doc oficial). Consecuencia practica: el codigo tiene que ir DOS veces en el
 * payload, una en el cuerpo ({{1}}) y otra en el parametro del boton (index 0);
 * si falta la segunda, Meta rechaza el envio por parametros incompletos.
 *
 * Con META_WHATSAPP_TEMPLATE_BOTON=ninguno se omite el boton: para plantillas
 * creadas sin boton (zero-tap), mandar el parametro del boton tambien las hace
 * fallar.
 */
function componentesPlantilla(code: string): ComponentePlantilla[] {
    const componentes: ComponentePlantilla[] = [
        { type: "body", parameters: [{ type: "text", text: code }] },
    ];
    if ((process.env.META_WHATSAPP_TEMPLATE_BOTON || "copiar").toLowerCase() !== "ninguno") {
        componentes.push({
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: code }],
        });
    }
    return componentes;
}

type PlanEnvioMeta = { etiqueta: string; cuerpo: Record<string, unknown> };

/**
 * Arma -- sin mandarlos -- los payloads que se intentarian con Graph para un
 * codigo: primero la plantilla de autenticacion (si esta configurada), despues
 * el texto libre de respaldo. Esta separado del envio para que
 * `npm run whatsapp:prueba -- --seco` pueda imprimir exactamente lo que saldria
 * (incluido el codigo repetido del boton) sin gastar un mensaje.
 * Graph quiere el numero SIN el "+".
 */
export function planesCodigoMeta(phone: string, code: string, body: string): PlanEnvioMeta[] {
    const base = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formatMxPhone(phone).replace(/^\+/, ""),
    };
    const planes: PlanEnvioMeta[] = [];
    const plantilla = process.env.META_WHATSAPP_TEMPLATE;

    // La plantilla va PRIMERO: el OTP lo inicia el negocio, asi que la ventana de
    // 24 h casi nunca esta abierta y el texto libre fallaria siempre.
    if (plantilla) {
        planes.push({
            etiqueta: "plantilla de autenticacion",
            cuerpo: {
                ...base,
                type: "template",
                template: {
                    name: plantilla,
                    language: { code: process.env.META_WHATSAPP_TEMPLATE_LANG || "es_MX" },
                    components: componentesPlantilla(code),
                },
            },
        });
    }

    planes.push({ etiqueta: "texto libre", cuerpo: { ...base, type: "text", text: { body } } });

    return planes;
}

/**
 * Meta WhatsApp Cloud API (Graph) para el codigo de verificacion (los caminos y
 * su orden estan explicados en planesCodigoMeta).
 *
 * OJO: a diferencia de Twilio, el Graph API de Meta para moviles mexicanos
 * quiere el formato de SMS (+52 + 10 digitos), NO el "1" extra de
 * formatMxPhoneWhatsApp -- ese "1" es una particularidad de Twilio.
 * Confirmado contra la API real: con el "1" responde 131030 "Recipient
 * phone number not in allowed list" (aunque el numero SI estaba en la
 * lista); sin el "1" el mensaje se entrega.
 */
async function enviarCodigoPorMeta(phone: string, body: string, code: string): Promise<ResultadoMeta> {
    const token = process.env.META_WHATSAPP_TOKEN;
    const phoneId = process.env.META_PHONE_NUMBER_ID;
    if (!token || !phoneId) {
        return { ok: false, detalle: "Meta sin configurar: faltan META_WHATSAPP_TOKEN o META_PHONE_NUMBER_ID" };
    }

    const url = `https://graph.facebook.com/v23.0/${phoneId}/messages`;
    const cabeceras = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const fallos: string[] = [];

    for (const plan of planesCodigoMeta(phone, code, body)) {
        try {
            const res = await fetch(url, { method: "POST", headers: cabeceras, body: JSON.stringify(plan.cuerpo) });
            if (res.ok) return { ok: true, detalle: `${plan.etiqueta}: aceptado por Meta` };
            // El detalle que devuelve Meta es lo unico que explica un rechazo
            // (p. ej. "outside the 24 hour window" o "template not found").
            const detalle = `[WHATSAPP META] ${plan.etiqueta} rechazado: ${(await res.text()).slice(0, 300)}`;
            console.warn(detalle);
            fallos.push(detalle);
        } catch (err) {
            console.error(`[WHATSAPP META] ${plan.etiqueta} fallo de red:`, err);
            fallos.push(`${plan.etiqueta}: fallo de red`);
        }
    }

    return { ok: false, detalle: fallos.join(" | ") };
}

/** Resultado del envio, con el detalle del proveedor para poder diagnosticarlo. */
export type ResultadoEnvioWhatsApp = {
    proveedor: "meta" | "twilio" | "simulado";
    entregado: boolean;
    detalle: string;
};

/** Texto del mensaje (sirve para el camino de texto libre y como referencia). */
export function textoCodigoWhatsApp(code: string): string {
    return `Cremeria del Rancho: tu codigo de verificacion es ${code}. Expira en 10 minutos.`;
}

/**
 * Manda un codigo de verificacion por WhatsApp y dice POR QUE fallo si fallo.
 * El detalle existe para `npm run whatsapp:prueba`: cuando Meta rechaza un
 * envio, el texto de su respuesta es lo unico que distingue si el problema es la
 * plantilla (no aprobada), el formato del numero o que el destinatario no esta
 * en la lista de permitidos de una cuenta de prueba.
 */
export async function enviarCodigoWhatsApp(phone: string, code: string): Promise<ResultadoEnvioWhatsApp> {
    const body = textoCodigoWhatsApp(code);
    if (!phone) return { proveedor: "simulado", entregado: false, detalle: "sin telefono" };

    const proveedor = proveedorWhatsApp();

    if (proveedor === "meta") {
        const meta = await enviarCodigoPorMeta(phone, body, code);
        return { proveedor: "meta", entregado: meta.ok, detalle: meta.detalle };
    }

    if (proveedor === "twilio") {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const twilio = require("twilio");
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            await client.messages.create({
                body,
                from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
                to: `whatsapp:${formatMxPhoneWhatsApp(phone)}`,
            });
            return { proveedor: "twilio", entregado: true, detalle: "aceptado por Twilio" };
        } catch (err) {
            console.error("[WHATSAPP ERROR]", err);
            return { proveedor: "twilio", entregado: false, detalle: err instanceof Error ? err.message : "error de Twilio" };
        }
    }

    console.log(`[SIMULATED WHATSAPP] to ${phone}: ${body}`);
    return { proveedor: "simulado", entregado: false, detalle: "sin proveedor configurado (modo simulado)" };
}

export async function sendWhatsAppCode(phone: string, code: string): Promise<boolean> {
    const resultado = await enviarCodigoWhatsApp(phone, code);
    return resultado.entregado;
}

const STATUS_MESSAGES: Record<string, string> = {
    PREPARING: "estamos preparando tu pedido",
    OUT_FOR_DELIVERY: "tu pedido va en camino",
    COMPLETED: "tu pedido fue entregado, ¡gracias por tu compra!",
    CANCELLED: "tu pedido fue cancelado",
};

export async function notifyOrderStatus(order: { id: string; status: string }, phone: string | null | undefined) {
    if (!phone) return;
    const text = STATUS_MESSAGES[order.status];
    if (!text) return; // no message configured for this status (e.g. PENDING)

    const folio = order.id.slice(-6).toUpperCase();
    await sendSms(phone, `Cremeria del Rancho: Pedido #${folio}, ${text}.`);
}

// Notifica al cliente el CÓDIGO de verificación de entrega cuando levanta su
// compra (pago aprobado). Deberá mostrarlo al repartidor para que confirme
// que la entrega se realiza a la persona correcta.
export async function notifyDeliveryCode(order: { id: string; deliveryCode?: string | null }, phone: string | null | undefined) {
    if (!phone || !order.deliveryCode) return;
    const folio = order.id.slice(-6).toUpperCase();
    await sendSms(
        phone,
        `Cremeria del Rancho: Pedido #${folio}. Tu codigo de entrega es: ${order.deliveryCode}. Compartelo con tu repartidor al recibir tu pedido.`
    );
}
