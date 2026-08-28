import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Términos y Condiciones | Cremería del Rancho",
    description: "Términos y Condiciones de uso de la Cremería del Rancho.",
};

export default function TerminosPage() {
    return (
        <main className="mx-auto w-full max-w-2xl px-5 py-10 text-sm leading-relaxed">
            <Link href="/" className="text-primary font-medium text-sm hover:underline">
                ← Volver a la tienda
            </Link>
            <h1 className="mt-6 text-2xl font-black">Términos y Condiciones</h1>
            <p className="mt-1 text-gray-500">Última actualización: agosto de 2026</p>

            <section className="mt-8 flex flex-col gap-6">
                <div>
                    <h2 className="text-lg font-bold">1. Información general</h2>
                    <p className="mt-2 text-gray-700">
                        Estos Términos y Condiciones regulan el uso del sitio web y la
                        aplicación móvil de <strong>Cremería del Rancho</strong> («la
                        Tienda»). Al realizar un pedido, el cliente acepta estos términos
                        en su totalidad.
                    </p>
                </div>

                <div>
                    <h2 className="text-lg font-bold">2. Productos y precios</h2>
                    <p className="mt-2 text-gray-700">
                        Los precios están expresados en pesos mexicanos (MXN) e incluyen
                        impuestos. Nos reservamos el derecho de modificar precios,
                        productos e inventario en cualquier momento sin previo aviso. La
                        disponibilidad de cada producto se confirma al momento de crear el
                        pedido.
                    </p>
                </div>

                <div>
                    <h2 className="text-lg font-bold">3. Realización y pago del pedido</h2>
                    <p className="mt-2 text-gray-700">
                        Los pagos se procesan de manera segura a través de{" "}
                        <strong>Stripe</strong>. El cliente es responsable de la veracidad
                        de los datos proporcionados. Un pedido se considera confirmado una
                        vez que el pago es aprobado; si el pago es rechazado, no generará
                        ningún cargo y la orden se cancelará y el inventario se restaurará.
                    </p>
                </div>

                <div>
                    <h2 className="text-lg font-bold">4. Envíos y entregas</h2>
                    <p className="mt-2 text-gray-700">
                        La entrega se realiza en la dirección y franja horaria acordadas. El
                        tiempo de entrega es estimado y puede variar por razones ajenas a
                        la Tienda. El cliente debe recibir personalmente, o autorizar a un
                        tercero, la entrega del pedido.
                    </p>
                </div>

                <div>
                    <h2 className="text-lg font-bold">5. Cancelaciones y devoluciones</h2>
                    <p className="mt-2 text-gray-700">
                        Puede solicitarse la cancelación de un pedido mientras este no haya
                        salido para entrega. Los productos perecederos no son sujetos a
                        devolución a menos que lleguen en mal estado; en ese caso,
                        contáctanos dentro de las 24 horas posteriores a la entrega.
                    </p>
                </div>

                <div>
                    <h2 className="text-lg font-bold">6. Uso del sitio</h2>
                    <p className="mt-2 text-gray-700">
                        El cliente se compromete a utilizar el sitio únicamente con fines
                        legítimos y a no realizar actividades fraudulentas, falsificaciones
                        o abusos que comprometan la seguridad de la plataforma o de otros
                        usuarios.
                    </p>
                </div>

                <div>
                    <h2 className="text-lg font-bold">7. Limitación de responsabilidad</h2>
                    <p className="mt-2 text-gray-700">
                        En la medida máxima permitida por la ley, la Tienda no será
                        responsable por daños indirectos, pérdidas de datos o interrupción
                        del servicio originados por el uso de la plataforma.
                    </p>
                </div>

                <div>
                    <h2 className="text-lg font-bold">8. Datos personales</h2>
                    <p className="mt-2 text-gray-700">
                        El tratamiento de tus datos personales se realiza conforme a nuestro{" "}
                        <Link href="/aviso-privacidad" className="text-primary hover:underline">
                            Aviso de Privacidad
                        </Link>
                        .
                    </p>
                </div>

                <div>
                    <h2 className="text-lg font-bold">9. Contacto</h2>
                    <p className="mt-2 text-gray-700">
                        Para cualquier aclaración sobre estos términos, contáctanos en{" "}
                        <a href="mailto:soporte@cremeriadelrancho.mx" className="text-primary hover:underline">
                            soporte@cremeriadelrancho.mx
                        </a>
                        .
                    </p>
                </div>
            </section>
        </main>
    );
}
