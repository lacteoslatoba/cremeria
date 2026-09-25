import type { Metadata } from "next";
import { Fraunces, Karla } from "next/font/google";
import Link from "next/link";
import { LandingMobileNav } from "@/components/landing/landing-mobile-nav";
import styles from "./landing.module.css";

// Landing publica de cremeriadelrancho.com (25/09, instruccion directa de
// Mike: "www.cremeriadelrancho.com va ser una pag web y de hay vas a poder
// bajar la app de cliente" + referencia visual propia que mando despues).
// La tienda real vive en /tienda -- esta pagina no pide sesion (ver
// auth-guard.tsx) para que cargue igual para un visitante sin cuenta, un
// buscador o una preview de WhatsApp/redes.
//
// Fotos pendientes: Mike mando 4 imagenes (hero/quesos/cremas/comidas) por
// chat pero no llegaron como archivo a este equipo -- mientras tanto usan
// el placeholder "Sin foto" que ya existe para productos sin imagen.
export const metadata: Metadata = {
    title: "Cremeria del Rancho — Quesos, cremas y comidas diarias",
    description: "Cremeria del Rancho: quesos frescos y artesanales, cremas y comidas diarias hechas en casa. Descarga nuestra app y pide desde tu celular.",
    openGraph: {
        title: "Cremeria del Rancho",
        description: "Quesos, cremas y comidas diarias frescas, directas del rancho a tu mesa. Descarga la app.",
        type: "website",
    },
};

const WHATSAPP_NEGOCIO = "https://wa.me/526131414210";

const fraunces = Fraunces({
    subsets: ["latin"],
    weight: ["400", "600", "700", "900"],
    variable: "--font-fraunces",
    display: "swap",
});
const karla = Karla({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-karla",
    display: "swap",
});

export default function LandingPage() {
    return (
        <div className={`${styles.landing} ${fraunces.variable} ${karla.variable}`}>
            <header className={styles.siteHeader}>
                <div className={`${styles.container} ${styles.headerInner}`}>
                    <a href="#inicio" className={styles.brand}>
                        <span className={styles.brandBadge}>
                            <img src="/icon.png" alt="Cremería del Rancho" width={40} height={40} />
                        </span>
                        <span>
                            <span className={styles.brandName}>Cremería del Rancho</span>
                            <span className={styles.brandTag}>Del rancho a tu mesa</span>
                        </span>
                    </a>
                    <nav className={styles.desktop}>
                        <a href="#inicio">Inicio</a>
                        <a href="#productos">Productos</a>
                        <a href="#comidas">Comidas diarias</a>
                        <a href="#contacto">Contacto</a>
                    </nav>
                    <div className={styles.headerCta}>
                        <Link href="/tienda" className={`${styles.btn} ${styles.btnTerra}`}>Descarga la app</Link>
                        <LandingMobileNav />
                    </div>
                </div>
            </header>

            <main>
                <section className={styles.hero} id="inicio">
                    <div className={`${styles.container} ${styles.heroGrid}`}>
                        <div>
                            <span className={styles.badge}>🐄 Fresco todos los días</span>
                            <h1 className={styles.heroTitle}>El sabor auténtico del rancho, en tu mesa</h1>
                            <p className={styles.heroSub}>Quesos artesanales, cremas frescas y comidas diarias hechas con recetas de la casa. Todo lo rico, todo lo fresco, como se hace en el rancho.</p>
                            <div className={styles.heroActions}>
                                <Link href="/tienda" className={`${styles.btn} ${styles.btnTerra} ${styles.btnLg}`}>📲 Descarga la app</Link>
                                <a href="#productos" className={`${styles.btn} ${styles.btnOutlineGreen} ${styles.btnLg}`}>Ver productos</a>
                            </div>
                            <div className={styles.heroPoints}>
                                <span>✓ Hecho fresco cada mañana</span>
                                <span>✓ Recetas tradicionales</span>
                                <span>✓ Atención por WhatsApp</span>
                            </div>
                        </div>
                        <div className={styles.heroImageWrap}>
                            <img className={styles.heroImage} src="/product-placeholder.svg" alt="Quesos, cremas y comidas de Cremería del Rancho" width={1024} height={1024} />
                            <div className={styles.heroCard}>
                                <strong>Comidas del día</strong>
                                <span>Pregunta el menú por WhatsApp</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className={styles.sectionAlt} id="productos">
                    <div className={styles.container}>
                        <h2 className={styles.sectionTitle}>Nuestros productos</h2>
                        <p className={styles.sectionSub}>Elaborados con leche fresca y el toque de siempre. Pide por pieza, por kilo o por encargo.</p>
                        <div className={styles.productsGrid}>
                            <article className={styles.productCard}>
                                <img src="/product-placeholder.svg" alt="Tablero de quesos artesanales" width={1024} height={768} />
                                <div className={styles.productCardBody}>
                                    <h3>Quesos</h3>
                                    <ul className={styles.productTags}>
                                        <li>Queso fresco</li><li>Queso Oaxaca</li><li>Queso panela</li><li>Queso manchego</li><li>Queso cotija</li>
                                    </ul>
                                </div>
                            </article>
                            <article className={styles.productCard}>
                                <img src="/product-placeholder.svg" alt="Crema fresca, jocoque, mantequilla y leche" width={1024} height={768} />
                                <div className={styles.productCardBody}>
                                    <h3>Cremas y lácteos</h3>
                                    <ul className={styles.productTags}>
                                        <li>Crema fresca</li><li>Jocoque</li><li>Mantequilla</li><li>Leche natural</li><li>Requesón</li>
                                    </ul>
                                </div>
                            </article>
                        </div>
                    </div>
                </section>

                <section id="comidas">
                    <div className={`${styles.container} ${styles.comidasGrid}`}>
                        <div>
                            <span className={styles.badge}>🍲 Cada día algo distinto</span>
                            <h2>Comidas diarias</h2>
                            <p className={styles.lead}>Como en casa: guisados, quesadillas, tamales, salsas y más, preparados cada mañana. El menú cambia todos los días, así que siempre hay algo nuevo que probar.</p>
                            <ul className={styles.comidasList}>
                                <li><span className={styles.check}>✓</span><span>Menú diferente cada día de la semana</span></li>
                                <li><span className={styles.check}>✓</span><span>Porciones listas para llevar o para pedir a domicilio</span></li>
                                <li><span className={styles.check}>✓</span><span>Hechas con nuestros propios quesos y cremas</span></li>
                                <li><span className={styles.check}>✓</span><span>Aparta tu comida por WhatsApp o desde la app</span></li>
                            </ul>
                            <a href={WHATSAPP_NEGOCIO} className={`${styles.btn} ${styles.btnGreen}`}>Pregunta el menú de hoy</a>
                        </div>
                        <div className={styles.comidasImage}>
                            <img src="/product-placeholder.svg" alt="Comidas diarias caseras: tamales, quesadillas y salsas" width={1024} height={1024} />
                        </div>
                    </div>
                </section>

                <section className={styles.appBand}>
                    <div className={styles.container} style={{ maxWidth: "56rem" }}>
                        <h2>Lleva Cremería del Rancho en tu celular</h2>
                        <p>Con nuestra app puedes ver los productos, conocer el menú del día y hacer tus pedidos con un solo toque. ¡Descárgala gratis!</p>
                        <div className={styles.appBandActions}>
                            <Link href="/tienda" className={`${styles.btn} ${styles.btnTerra} ${styles.btnLg}`}>📲 Descargar la app</Link>
                            <a href={WHATSAPP_NEGOCIO} className={`${styles.btn} ${styles.btnOutlineLight} ${styles.btnLg}`}>Escríbenos por WhatsApp</a>
                        </div>
                    </div>
                </section>

                <section id="contacto">
                    <div className={styles.container}>
                        <h2 className={styles.sectionTitle}>Visítanos o escríbenos</h2>
                        <p className={styles.sectionSub}>Estamos listos para atenderte. También hacemos pedidos para eventos y encargos especiales.</p>
                        <div className={styles.contactCards}>
                            <a href={WHATSAPP_NEGOCIO} className={styles.contactCard}>
                                <span className={`${styles.contactIcon} ${styles.green}`}>💬</span>
                                <h3>WhatsApp</h3>
                                <p>613 141 4210</p>
                            </a>
                        </div>
                    </div>
                </section>
            </main>

            <footer className={styles.siteFooter}>
                <div className={`${styles.container} ${styles.footerInner}`}>
                    <strong>Cremería del Rancho</strong>
                    <nav className={styles.footerNav}>
                        <a href="#inicio">Inicio</a>
                        <a href="#productos">Productos</a>
                        <a href="#comidas">Comidas diarias</a>
                        <a href="#contacto">Contacto</a>
                        <Link href="/terminos">Términos</Link>
                        <Link href="/aviso-privacidad">Aviso de Privacidad</Link>
                        <Link href="/driver">Repartidores</Link>
                        <Link href="/login?portal=admin">Control Panel</Link>
                    </nav>
                    <p className={styles.footerCopy}>© {new Date().getFullYear()} Cremería del Rancho · Del rancho a tu mesa</p>
                </div>
            </footer>
        </div>
    );
}
