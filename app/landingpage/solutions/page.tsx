"use client";

import Link from "next/link";

export default function SolutionsPage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">

        ${/* En-tête */}
        <div className="text-center mb-12">
          <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider text-sm">Applications Métiers</span>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mt-2 sm:text-5xl">
            Découvrez la <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-green-500">GreenItCar Business Suite</span>
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 mt-4 font-medium">
            Des outils de pointe pour structurer et automatiser votre gestion quotidienne.
          </p>
        </div>

                {/* 🌟 Introduction Enrichie : Présentation de l'écosystème */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm space-y-6 text-slate-700 dark:text-slate-300 leading-relaxed mb-12">
          <p>
            Face aux mutations technologiques, la <strong className="text-slate-900 dark:text-white">GreenItCar Business Suite</strong> s'impose comme une réponse robuste, accessible et innovante pour moderniser les structures opérationnelles. Notre plateforme regroupe des applications métiers pensées pour libérer les dirigeants des tâches administratives chronophages.
          </p>
          <p>
            Grâce à une centralisation intelligente, chaque module communique nativement avec un cœur de système performant, vous offrant une visibilité à 360° sur vos flux d'informations, vos transactions et vos indicateurs de croissance. Découvrez comment nos solutions sectorielles s'adaptent précisément à la nature de votre organisation.
          </p>
        </div>

        {/* Présentation des Modules */}
        <div className="space-y-12">


        {/* Présentation des Modules */}
        <div className="space-y-12">
          
          {/* Module 1 : GreenSchool */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full flex items-start justify-end p-4 text-3xl select-none">🏫</div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md">GreenSchool</span>
            
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-4">Gestion Éducative Intégrée</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              GreenSchool est une solution de gestion scolaire destinée aux écoles privées, centres de formation et établissements d'enseignement. Elle permet notamment de gérer efficacement :
            </p>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 text-sm text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2.5">
                <span className="text-emerald-500 text-lg">•</span>
                <span>Les élèves</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-emerald-500 text-lg">•</span>
                <span>Les inscriptions</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-emerald-500 text-lg">•</span>
                <span>Les enseignants</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-emerald-500 text-lg">•</span>
                <span>Les classes</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-emerald-500 text-lg">•</span>
                <span>Les paiements de scolarité</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-emerald-500 text-lg">•</span>
                <span>Les statistiques de l'établissement</span>
              </li>
            </ul>
          </div>

          {/* Module 2 : GreenFacture */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-bl-full flex items-start justify-end p-4 text-3xl select-none">💳</div>
            <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase bg-teal-50 dark:bg-teal-950/40 px-2.5 py-1 rounded-md">GreenFacture</span>
            
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-4">Gestion Commerciale Moderne</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              GreenFacture est une solution de gestion commerciale destinée aux commerces, boutiques, pharmacies, quincailleries, PME et autres activités commerciales. Elle permet de piloter avec précision :
            </p>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 text-sm text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2.5">
                <span className="text-teal-500 text-lg">•</span>
                <span>Les articles</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-teal-500 text-lg">•</span>
                <span>Les clients</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-teal-500 text-lg">•</span>
                <span>Les factures</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-teal-500 text-lg">•</span>
                <span>Les créances</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-teal-500 text-lg">•</span>
                <span>Les ventes</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-teal-500 text-lg">•</span>
                <span>Les stocks</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-teal-500 text-lg">•</span>
                <span>Les bénéfices réalisés</span>
              </li>
            </ul>
          </div>

        </div>

        {/* 1.3. Les avantages de GreenItCar Business Suite */}
        <div className="mt-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
          <h2 className="text-2xl font-black text-center text-slate-900 dark:text-white mb-2">Les avantages de la Suite</h2>
          <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-8">Une expérience de gestion moderne, simple et hautement sécurisée.</p>
          
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-700 dark:text-slate-300">
            <li className="flex gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900">
              <span className="text-emerald-500 font-bold">•</span>
              <p><strong className="text-slate-900 dark:text-white">Interface intuitive :</strong> Une plateforme ergonomique et facile à prendre en main.</p>
            </li>
            <li className="flex gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900">
              <span className="text-emerald-500 font-bold">•</span>
              <p><strong className="text-slate-900 dark:text-white">Centralisation complète :</strong> Regroupement de toutes vos données sur un seul espace.</p>
            </li>
            <li className="flex gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900">
              <span className="text-emerald-500 font-bold">•</span>
              <p><strong className="text-slate-900 dark:text-white">Tableaux de bord :</strong> Suivi de vos performances commerciales et administratives en temps réel.</p>
            </li>
            <li className="flex gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900">
              <span className="text-emerald-500 font-bold">•</span>
              <p><strong className="text-slate-900 dark:text-white">Sécurité opérationnelle :</strong> Réduction drastique des erreurs liées aux traitements manuels.</p>
            </li>
            <li className="flex gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900">
              <span className="text-emerald-500 font-bold">•</span>
              <p><strong className="text-slate-900 dark:text-white">Productivité accrue :</strong> Automatisation des processus métiers longs et répétitifs.</p>
            </li>
            <li className="flex gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900">
              <span className="text-emerald-500 font-bold">•</span>
              <p><strong className="text-slate-900 dark:text-white">Indicateurs clés :</strong> Amélioration de la prise de décision grâce à des rapports analytiques.</p>
            </li>
          </ul>
        </div>

        {/* 1.4. Fonctionnement avec ou sans connexion Internet */}
        <div className="mt-16 bg-gradient-to-br from-emerald-900 to-slate-900 text-white rounded-2xl p-8 shadow-lg space-y-6">
          <div className="text-3xl text-center">🌍</div>
          <h3 className="text-2xl font-black text-center">Fonctionnement avec ou sans connexion Internet</h3>
          
          <div className="text-sm space-y-4 text-slate-300 leading-relaxed max-w-3xl mx-auto">
            <p>
              GreenItCar Business Suite fonctionne aussi bien avec une connexion Internet que sans connexion. Lorsque votre ordinateur est connecté à Internet, les données sont automatiquement synchronisées avec les serveurs sécurisés de GreenItCar.
            </p>
            <p>
              En cas d'absence de connexion Internet, vous pouvez continuer à utiliser normalement les principales fonctionnalités de vos applications. Toutes les opérations réalisées sont enregistrées localement sur votre ordinateur.
            </p>
            <p>              Dès que la connexion Internet est rétablie, la plateforme synchronise automatiquement les nouvelles données avec votre espace sécurisé. Ce fonctionnement garantit une continuité de service, même dans les zones où la connexion Internet est limitée ou instable.
            </p>
          </div>

          <div className="mt-6 text-center">
            <Link href="/inscription" className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-6 py-3 rounded-full transition-all">
              Démarrer avec la Business Suite
            </Link>
          </div>
        </div>

        {/* Pied de page */}
        <footer className="border-t border-slate-200 dark:border-slate-800/80 mt-16 pt-8 text-center text-sm text-slate-400">
          <p>© 2026 GreenItCar. Tous droits réservés.</p>
        </footer>
      </div>
      </div>
    </main>
  );
}

