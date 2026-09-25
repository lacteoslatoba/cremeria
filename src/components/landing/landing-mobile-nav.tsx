"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "@/app/landing.module.css";

export function LandingMobileNav() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                className={styles.menuToggle}
                aria-label="Abrir menú"
                onClick={() => setOpen((o) => !o)}
            >
                {open ? "✕" : "☰"}
            </button>

            <nav className={`${styles.mobile} ${open ? styles.open : ""}`}>
                <a href="#inicio" onClick={() => setOpen(false)}>Inicio</a>
                <a href="#productos" onClick={() => setOpen(false)}>Productos</a>
                <a href="#comidas" onClick={() => setOpen(false)}>Comidas diarias</a>
                <a href="#contacto" onClick={() => setOpen(false)}>Contacto</a>
                <Link href="/tienda" className={`${styles.btn} ${styles.btnTerra}`} onClick={() => setOpen(false)}>
                    Descarga la app
                </Link>
            </nav>
        </>
    );
}
