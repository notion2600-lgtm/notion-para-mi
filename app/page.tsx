import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpenText,
  Layers3,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { getServerSupabase } from "@/lib/supabase/server";

import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "Tu mundo para crear",
  description:
    "Un espacio inspirado y privado para escribir, organizar proyectos y crear junto a tu equipo.",
};

const petals = Array.from({ length: 9 }, (_, index) => index);

export default async function HomePage() {
  const supabase = await getServerSupabase();
  const { data } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };
  const primaryHref = data.user ? "/workspace" : "/signup";
  const primaryLabel = data.user ? "Entrar a mi espacio" : "Comenzar mi historia";

  return (
    <main className={styles.viewport} id="main-content">
      <div className={styles.background} aria-hidden="true">
        <video
          aria-label="Panorama alpino ilustrado: una viajera contempla una montaña nevada sobre un mar de nubes"
          autoPlay
          loop
          muted
          playsInline
          poster="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/693205bf-8048-456a-879e-4e0a1b85a098.webp"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_123836_11a3c5e0-713f-4bef-a8e9-7dd93bdea3b0.mp4"
            type="video/mp4"
          />
        </video>
      </div>
      <div className={styles.skyWash} aria-hidden="true" />
      <div className={styles.inkWash} aria-hidden="true" />

      <div className={styles.petals} aria-hidden="true">
        {petals.map((petal) => (
          <span className={styles.petal} key={petal} />
        ))}
      </div>

      <div className={styles.frame}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/" aria-label="Mi espacio, inicio">
            <span className={styles.brandMark}>
              <Layers3 aria-hidden="true" />
            </span>
            <span>Mi espacio</span>
          </Link>

          <div className={styles.headerAside}>
            <span className={styles.chapter}>創造の世界 · Un mundo para crear</span>
            <Link className={styles.loginLink} href={data.user ? "/workspace" : "/login"}>
              {data.user ? "Abrir workspace" : "Iniciar sesión"}
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </header>

        <section className={styles.hero}>
          <div className={styles.eyebrow}>
            <Sparkles aria-hidden="true" />
            Tu mundo, tus ideas
          </div>
          <h1>
            Imagina.
            <br />
            <em>Crea.</em> Organiza.
          </h1>
          <p className={styles.lede}>
            Cada gran historia comienza con una página en blanco. Escribe, organiza tus
            proyectos y construye un lugar donde todas tus ideas puedan crecer.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryCta} href={primaryHref}>
              <span>{primaryLabel}</span>
              <ArrowUpRight aria-hidden="true" />
            </Link>
            <p>
              <ShieldCheck aria-hidden="true" />
              Privado por defecto. Comparte cuando quieras.
            </p>
          </div>
        </section>
      </div>

      <footer className={styles.glassFooter}>
        <div className={styles.footerInner}>
          <div className={styles.footerIntro}>
            <span className={styles.moonMark}>✦</span>
            <div>
              <p className={styles.footerTitle}>Tu próxima aventura empieza aquí.</p>
              <p className={styles.footerCopy}>
                Un rincón sereno para convertir pensamientos dispersos en algo real.
              </p>
            </div>
          </div>

          <div className={styles.features}>
            <article>
              <BookOpenText aria-hidden="true" />
              <div>
                <span>01 · Escribe</span>
                <h2>Páginas que se sienten tuyas</h2>
                <p>Documentos flexibles, bloques y bases de datos en un mismo lienzo.</p>
              </div>
            </article>
            <article>
              <Sparkles aria-hidden="true" />
              <div>
                <span>02 · Organiza</span>
                <h2>De la idea al proyecto</h2>
                <p>Vistas, tablas y plantillas para que cada historia encuentre su lugar.</p>
              </div>
            </article>
            <article>
              <UsersRound aria-hidden="true" />
              <div>
                <span>03 · Comparte</span>
                <h2>Crea junto a tu equipo</h2>
                <p>Invita por correo y trabaja en tiempo real, sin perder tu espacio privado.</p>
              </div>
            </article>
          </div>
        </div>
      </footer>
    </main>
  );
}
