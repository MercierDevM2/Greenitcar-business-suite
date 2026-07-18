"use client"; 

import { useRouter } from "next/navigation"; 

import Link from "next/link";

export default function TarifsPage() {
   const router = useRouter();
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 py-16 px-4 sm:px-6 lg:px-8">
      
        {/* 🔙 Bouton de retour stylisé */}
        <div className="mb-8 text-left">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 hover:shadow-sm transition-all group"
          >
            {/* Flèche avec micro-animation au survol */}
            <svg 
              xmlns="http://w3.org" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={2.5} 
              stroke="currentColor" 
              className="w-3.5 h-3.5 transform group-hover:-translate-x-0.5 transition-transform"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Retour
          </button>
        </div>
      <div className="max-w-4xl mx-auto">
        
        {/* En-tête */}
        <div className="text-center mb-12">
          <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider text-sm">Tarification Transparente</span>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mt-2 sm:text-5xl">
            Des Plans Adaptés à <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-green-500">Votre Activité</span>
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 mt-4 font-medium">
            Une facturation simple, sans frais cachés, pensée pour la Centrafrique.
          </p>
        </div>

        {/* Grille des Prix (Vos 2 modules d'origine) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mt-12">
          
          {/* Plan 1 : GreenSchool */}
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm relative flex flex-col justify-between h-full group hover:border-emerald-500/50 dark:hover:border-emerald-500/30 transition-all">
            <div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-md">🏫 Écoles & Centres</span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-4">GreenSchool</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Gestion scolaire complète et statistiques d'établissement.</p>
              
              {/* Zone Prix */}
              <div className="my-6">
                <span className="text-4xl font-black text-slate-900 dark:text-white">30 000</span>
                <span className="text-lg font-bold text-slate-500 dark:text-slate-400 ml-1">FCFA / mois</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Soit environ 45 € / mois</p>
              </div>

              {/* Fonctionnalités incluses */}
              <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800/60 pt-4">
                <li className="flex items-center gap-2.5">
                  <span className="text-emerald-500 font-bold">✓</span> Gestions des élèves et tuteurs
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-emerald-500 font-bold">✓</span> Suivi des inscriptions et classes
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-emerald-500 font-bold">✓</span> Personnel enseignant et spécialités
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-emerald-500 font-bold">✓</span> Suivi strict des paiements de scolarité
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-emerald-500 font-bold">✓</span> Mode hybride (Fonctionne sans Internet)
                </li>
              </ul>
            </div>

            <div className="mt-8">
              <Link href="/inscription?module=school" className="block text-center w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold py-3 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm">
                Choisir GreenSchool
              </Link>
            </div>
          </div>

          {/* Plan 2 : GreenFacture */}
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm relative flex flex-col justify-between h-full group hover:border-teal-500/50 dark:hover:border-teal-500/30 transition-all">
            <div>
              <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase bg-teal-50 dark:bg-teal-950/40 px-3 py-1 rounded-md">💳 Commerces & PME</span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-4">GreenFacture</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Facturation, suivi de caisse et décompte de stock automatique.</p>
              
              {/* Zone Prix */}
              <div className="my-6">
                <span className="text-4xl font-black text-slate-900 dark:text-white">20 000</span>
                <span className="text-lg font-bold text-slate-500 dark:text-slate-400 ml-1">FCFA / mois</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Soit environ 30 € / mois</p>
              </div>

              {/* Fonctionnalités incluses */}
              <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800/60 pt-4">
                <li className="flex items-center gap-2.5">
                  <span className="text-teal-500 font-bold">✓</span> Facturation HT / TTC et ventes
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-teal-500 font-bold">✓</span> Suivi des articles et base clients
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-teal-500 font-bold">✓</span> Gestion des stocks et seuils d'alerte
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-teal-500 font-bold">✓</span> Calcul des créances et bénéfices nets
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-teal-500 font-bold">✓</span> Mode hybride (Fonctionne sans Internet)
                </li>
              </ul>
            </div>

            <div className="mt-8">
              <Link href="/inscription?module=facture" className="block text-center w-full bg-emerald-600 text-white text-xs font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm">
                Choisir GreenFacture
              </Link>
            </div>
          </div>

        </div>

        {/* Section Spécifique Réalités Terrain (RCA) */}
        <div className="mt-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">🚀 Déploiement et flexibilité locale</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">🔌 Continuité Hors-Ligne</h4>
              <p className="mt-1">Vos applications restent pleinement utilisables même en cas de coupure de réseau. Les abonnements ne sont jamais bloqués par des coupures de serveurs distants.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">💵 Paiement Flexible</h4>
              <p className="mt-1">Nous adaptons nos modes de recouvrement aux réalités des entreprises centrafricaines (Mobile Money, espèces ou virements locaux) pour faciliter vos opérations.</p>
            </div>
          </div>
        </div>

        {/* Pied de page */}
        <footer className="border-t border-slate-200 dark:border-slate-800/80 mt-16 pt-8 text-center text-sm text-slate-400">
          <p>© 2026 GreenItCar. Tous droits réservés.</p>
        </footer>

      </div>
    </main>
  );
}
