import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Aviso de Privacidad | Cremería del Rancho",
    description: "Aviso de Privacidad de la Cremería del Rancho.",
};

export default function AvisoPrivacidadPage() {
    return (
        <main className="mx-auto w-full max-w-2xl px-5 py-10 text-sm leading-relaxed">
            <Link href="/" className="text-primary font-medium text-sm hover:underline">
                ← Volver a la tienda
            </Link>
            <h1 className="mt-6 text-2xl font-black">Aviso de Privacidad</h1>
            <p className="mt-1 text-gray-500">Última actualización: agosto de 2026</p>

            <section className="mt-8 flex flex-col gap-6">
                <div>
                    <h2 className="text-lg font-bold">1. Responsable</h2>
                    <p className="mt-2 text-gray-700">
                        <strong>Cremería del Rancho</strong> («la Tienda»), con domicilio en
                        México, es el responsable del tratamiento de los datos personales
                        que nos proporcionas. Para cualquier asunto relacionado con tus
                        datos, escríbenos a{" "}
                        <a href="mailto:privacidad@cremeriadelrancho.mx" className="text-primary hover:underline">
                            privacidad@cremeriadelrancho.mx
                        </a>
                        .
                    </p>
                </div>

                <div>
                    <h2 className="text-lg font-bold">2. Datos que recopilamos</h2>
                    <p className="mt-2 text-gray-700">
                        De manera directa: nombre, correo electrónico, teléfono, dirección
                        de entrega y datos de acceso (usuario/contraseña cifrada). Datos de
                        navegación: dirección IP, tipo de dispositivo y uso del sitio.
                    </p>
                </div>

                <div>
                    <h2 className="text-lg font-bold">3. Datos financieros</h2>
                    <p className="mt-2 text-gray-700">
                        La Tienda <strong>no almacena</strong> los datos de tu tarjeta. El
                        cobro se procesa a través de{" "}
                        <strong>Stripe</strong>, un procesador de pagos certificado (PCI
                        DSS), bajo sus propias políticas y medidas de seguridad.
                    </p>
                </div>

                <div>
                    <h2 className="text-lg font-bold">4. Finalidad del tratamiento</h2>
                    <p className="mt-2 text-gray-700">
                        Tus datos se utilizan para: procesar y entregar tus pedidos,
                        gestionar tu cuenta, notificarte el estado de tus compras, brindar
                        atención al cliente y mejorar nuestros servicios. No vendemos tus
                        datos a terceros.
                    </p>
                </div>

                <div>
                    <h2 className="text-lg font-bold">5. Transferencias</h2>
                    <p className="mt-2 text-gray-700">
                        Tus datos pueden compartirse únicamente con proveedores
                        indispensables para el servicio, como Stripe (pagos), Twilio
                        (notificaciones SMS) y el proveedor de alojamiento/infraestructura
                        (Vercel), bajo acuerdos de confidencialidad.
                    </p>
                </div>

                <div>
                    <h2 className="text-lg font-bold">6. Derechos ARCO y revocación</h2>
                    <p className="mt-2 text-gray-700">
                        Tienes derecho a acceder, rectificar, cancelar u oponerte al
                        tratamiento de tus datos (derechos ARCO), así como a revocar tu
                        consentimiento. Para ejercerlos, envía tu solicitud a{" "}
                        <a href="mailto:privacidad@cremeriadelrancho.mx" className="text-primary hover:underline">
                            privacidad@cremeriadelrancho.mx
                        </a>
                        .
                    </p>
                </div>

                <div>
                    <h2 className="text-lg font-bold">7. Seguridad</h2>
                    <p className="mt-2 text-gray-700">
                        Implementamos medidas administrativas, técnicas y físicas para
                        proteger tus datos contra pérdida, uso indebido o acceso no
                        autorizado. El acceso a tu cuenta está protegido con contraseñas
                        cifradas y sesiones con expiración.
                    </p>
                </div>

                <div>
                    <h2 className="text-lg font-bold">8. Cambios al aviso</h2>
                    <p className="mt-2 text-gray-700">
                        Podemos actualizar este Aviso de Privacidad. Cualquier cambio se
                        publicará en esta página con la fecha de última actualización.
                    </p>
                </div>

                <div>
                    <h2 className="text-lg font-bold">9. Ley aplicable</h2>
                    <p className="mt-2 text-gray-700">
                        Este aviso se rige por la Ley Federal de Protección de Datos
                        Personales en Posesión de los Particulares (México) y demás
                        normativa aplicable.
                    </p>
                </div>
            </section>
        </main>
    );
}
