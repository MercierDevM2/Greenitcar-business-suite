"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const stats = [
  { value: "500+", label: "Entreprises accompagnées" },
  { value: "20 000+", label: "Factures créées" },
  { value: "15", label: "Solutions métiers" },
  { value: "99 %", label: "Clients satisfaits" },
];

const solutions = [
  { title: "GreenFacture", description: "Créer vos factures." },
  { title: "GreenStock", description: "Gérer votre stock." },
  { title: "GreenPersonnel", description: "Gérer votre personnel." },
  { title: "GreenAsset", description: "Inventorier vos équipements." },
  { title: "GreenData", description: "Tableaux de bord Power BI." },
  { title: "GreenSchool", description: "Gestion scolaire." },
];

const benefits = [
  {
    title: "Simple",
    description: "Fonctionne même avec hors connexion internet.",
  },
  {
    title: "Rapide",
    description: "Installation en quelques minutes.",
  },
  {
    title: "Accompagnement",
    description: "Formation et assistance incluses.",
  },
];

const steps = ["Créer un compte", "Configurer votre entreprise", "Commencer à travailler"];

const testimonials = [
  {
    quote:
      "GreenItCar Business Suite nous a permis de digitaliser rapidement nos opérations sans complexité.",
    author: "Awa Diop",
    role: "Directrice, ONG Afrique Éducation",
  },
  {
    quote:
      "L’interface est claire, rapide et parfaitement adaptée à notre rythme de travail.",
    author: "Moussa Kéita",
    role: "Responsable logistique, Boutique Moderne",
  },
  {
    quote:
      "Nous avons gagné un temps précieux sur la gestion administrative quotidienne.",
    author: "Salimata N’Diaye",
    role: "Chef de projet, École de formation",
  },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <Link href="/" className="flex items-center">
          <Image
            src="/Logo.png"
            alt="GreenItCar"
            width={140}
            height={42}
            className="h-10 w-auto"
            priority
          />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            aria-label="Ouvrir le menu"
            onClick={() => setMenuOpen((value) => !value)}
            className="rounded-full border border-slate-700 p-2 text-slate-200 transition hover:border-slate-500 hover:text-white md:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2">
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          </button>

          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <Link href="/landingpage/solutions" className="transition hover:text-green-400">
              Solutions
            </Link>
            <Link href="/landingpage/secteurs" className="transition hover:text-green-400">
              Secteurs
            </Link>
            <Link href="/landingpage/tarifs" className="transition hover:text-green-400">
              Tarifs
            </Link>
            <Link href="/landingpage/apropos" className="transition hover:text-green-400">
              À propos
            </Link>
            <Link href="/landingpage/contact" className="transition hover:text-green-400">
              Contact
            </Link>
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <Link href="/connexion" className="transition hover:text-orange-400">
              Connexion
            </Link>
            <Link
              href="/inscription"
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
            >
              Commencer gratuitement
            </Link>
          </div>

          <Link
            href="/inscription"
            className="rounded-full bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 sm:hidden"
          >
            Commencer
          </Link>
        </div>
      </header>

      <section className="mx-auto flex max-w-7xl items-center justify-center px-6 py-3 text-center lg:px-8">
        <h1 className="bg-gradient-to-r from-emerald-400 via-lime-300 to-emerald-500 bg-clip-text text-3xl font-black tracking-[0.2em] text-transparent sm:text-4xl lg:text-5xl">
          GreenItCar Business Suite
        </h1>
      </section>

      {menuOpen ? (
        <nav className="mx-auto mt-2 flex max-w-7xl flex-col gap-2 px-6 pb-4 text-sm text-slate-200 md:hidden">
          <Link href="/solutions" className="rounded-xl bg-slate-900/90 px-3 py-2 transition hover:bg-slate-800 hover:text-white" onClick={() => setMenuOpen(false)}>
            Solutions
          </Link>
          <Link href="/secteurs" className="rounded-xl bg-slate-900/90 px-3 py-2 transition hover:bg-slate-800 hover:text-white" onClick={() => setMenuOpen(false)}>
            Secteurs
          </Link>
          <Link href="/tarifs" className="rounded-xl bg-slate-900/90 px-3 py-2 transition hover:bg-slate-800 hover:text-white" onClick={() => setMenuOpen(false)}>
            Tarifs
          </Link>
          <Link href="/apropos" className="rounded-xl bg-slate-900/90 px-3 py-2 transition hover:bg-slate-800 hover:text-white" onClick={() => setMenuOpen(false)}>
            À propos
          </Link>
          <Link href="/contact" className="rounded-xl bg-slate-900/90 px-3 py-2 transition hover:bg-slate-800 hover:text-white" onClick={() => setMenuOpen(false)}>
            Contact
          </Link>
          <Link href="/connexion" className="rounded-xl bg-slate-900/90 px-3 py-2 transition hover:bg-slate-800 hover:text-white" onClick={() => setMenuOpen(false)}>
            Connexion
          </Link>
        </nav>
      ) : null}

      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              Le partenaire de la transformation numérique des entreprises Centrafricaines.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-300">
              Des applications simples et puissantes pour gérer votre boutique, votre ONG, votre école ou votre entreprise.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/landingpage/solutions"
                className="rounded-full bg-white px-6 py-3 text-center font-semibold text-slate-900 transition hover:bg-slate-200"
              >
                Découvrir nos solutions
              </Link>
              <Link
                href="/inscription"
                className="rounded-full border border-slate-700 px-6 py-3 text-center font-semibold text-white transition hover:border-slate-500 hover:bg-slate-900"
              >
                Demander une démonstration
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-2xl shadow-slate-950/40">
            <div className="rounded-[1.5rem] border border-slate-800 bg-gradient-to-br from-slate-800 to-slate-950 p-4">
              <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">Tableau de bord</p>
                  <p className="text-xs text-slate-400">GreenItCar • Entreprise</p>
                </div>
                <div className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400">
                  En ligne
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                  <p className="text-sm text-slate-400">Chiffre d’affaires</p>
                  <p className="mt-2 text-2xl font-semibold text-white">1.2 M</p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                  <p className="text-sm text-slate-400">Factures</p>
                  <p className="mt-2 text-2xl font-semibold text-white">342</p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 sm:col-span-2">
                  <p className="text-sm text-slate-400">Activité récente</p>
                  <div className="mt-4 space-y-2">
                    <div className="h-2 rounded-full bg-slate-800">
                      <div className="h-2 w-3/4 rounded-full bg-emerald-500" />
                    </div>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div className="h-2 w-2/3 rounded-full bg-cyan-500" />
                    </div>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div className="h-2 w-4/5 rounded-full bg-violet-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="grid gap-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 text-center">
                <p className="text-3xl font-semibold text-white">{item.value}</p>
                <p className="mt-2 text-sm text-slate-400">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="solutions" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Nos solutions</p>
            <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Des outils pensés pour chaque besoin métier.</h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {solutions.map((solution) => (
              <div key={solution.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h3 className="text-xl font-semibold text-white">{solution.title}</h3>
                <p className="mt-3 text-slate-400">{solution.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Pourquoi GreenItCar Business Suite ?</p>
              <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Une solution simple, rapide et accompagnée.</h2>
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
                  <h3 className="text-xl font-semibold text-white">{benefit.title}</h3>
                  <p className="mt-3 text-slate-400">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Comment ça marche ?</p>
            <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Un parcours simple en 3 étapes.</h2>
          </div>
          <div className="mt-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {steps.map((step, index) => (
              <div key={step} className="flex flex-1 flex-col items-center rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-lg font-semibold text-emerald-400">
                  {index + 1}
                </div>
                <p className="mt-4 text-lg font-semibold text-white">{step}</p>
                {index < steps.length - 1 ? <span className="mt-4 text-slate-500">↓</span> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Témoignages</p>
              <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Ce que disent nos clients.</h2>
            </div>
            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <div key={testimonial.author} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
                  <p className="text-slate-300">“{testimonial.quote}”</p>
                  <div className="mt-6">
                    <p className="font-semibold text-white">{testimonial.author}</p>
                    <p className="text-sm text-slate-400">{testimonial.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-10 text-center">
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">Prêt à moderniser votre organisation ?</h2>
            <Link
              href="/inscription"
              className="mt-8 inline-flex rounded-full bg-emerald-500 px-6 py-3 font-semibold text-white transition hover:bg-emerald-400"
            >
              Créer un compte
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 px-6 py-8 text-center text-sm text-slate-400 lg:px-8">
        <p>© 2026 GreenItCar. Tous droits réservés.</p>
      </footer>
    </div>
  );
}
