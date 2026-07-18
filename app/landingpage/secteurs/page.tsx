"use client"; 

import { useRouter } from "next/navigation"; 
import Link from "next/link";

export default function SecteursPage() {
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
          <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider text-sm">Écosystème Métiers</span>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mt-2 sm:text-5xl">
            Secteurs <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-green-500">D'accompagnement</span>
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 mt-4 font-medium">
            Une suite logicielle adaptée aux défis spécifiques de votre domaine d'activité.
          </p>
        </div>

        {/* Grille des secteurs (Basée sur vos options de formulaire) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Secteur 1 : Éducation & Centres d'Enseignement */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm hover:border-emerald-500/40 dark:hover:border-emerald-500/30 transition-all group">
            <div className="text-3xl mb-4 bg-emerald-50 dark:bg-emerald-950/40 w-12 h-12 flex items-center justify-center rounded-xl group-hover:scale-105 transition-transform">🏫</div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Écoles & Centres de formation</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              Pour les écoles primaires, collèges, lycées et universités privées qui cherchent à automatiser la gestion des promotions, le suivi des scolarités et l'affectation des enseignants.
            </p>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-4 block">Module lié : GreenSchool</span>
          </div>

          {/* Secteur 2 : Commerce & Vente au détail */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm hover:border-teal-500/40 dark:hover:border-teal-500/30 transition-all group">
            <div className="text-3xl mb-4 bg-teal-50 dark:bg-teal-950/40 w-12 h-12 flex items-center justify-center rounded-xl group-hover:scale-105 transition-transform">🛒</div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Commerce / Vente au détail</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              Idéal pour les boutiques, quincailleries, grossistes et enseignes de distribution qui ont besoin d'un suivi strict du stock résiduel, des bénéfices nets et du portefeuille clients.
            </p>
            <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 mt-4 block">Module lié : GreenFacture</span>
          </div>

          {/* Secteur 3 : Santé & Médical */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm hover:border-emerald-500/40 dark:hover:border-emerald-500/30 transition-all group">
            <div className="text-3xl mb-4 bg-emerald-50 dark:bg-emerald-950/40 w-12 h-12 flex items-center justify-center rounded-xl group-hover:scale-105 transition-transform">💊</div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Santé & Médical</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              Pour les pharmacies, cliniques et cabinets médicaux qui doivent suivre la vente de produits sensibles, gérer les alertes de seuil de stock et éditer des factures claires pour les patients.
            </p>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-4 block">Module lié : GreenClinic</span>
          </div>

          {/* Secteur 4 : Humanitaire / ONG & PME */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm hover:border-teal-500/40 dark:hover:border-teal-500/30 transition-all group">
            <div className="text-3xl mb-4 bg-teal-50 dark:bg-teal-950/40 w-12 h-12 flex items-center justify-center rounded-xl group-hover:scale-105 transition-transform">🤝</div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Humanitaire / ONG / PME</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              Pour les organisations gérant des inventaires distribués, des flux de trésorerie entrants, et nécessitant un reporting transparent des dépenses même en environnement instable.
            </p>
            <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 mt-4 block">Modules liés : GreenPersonnel</span>
          </div>

        </div>

        {/* Section explicative de la transversalité */}
        <div className="mt-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Pourquoi segmenter par secteur ?</h2>
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-4 leading-relaxed">
            <p>
              Chaque métier possède ses propres indicateurs clés de performance. Un directeur d'école analyse les taux d'inscription par classe, tandis qu'un gérant de pharmacie surveille les marges nettes sur les lots d'articles.
            </p>
            <p>
              C'est pourquoi <strong className="text-emerald-600 dark:text-emerald-400">GreenItCar</strong> n'impose pas une solution rigide. Lors de la création de votre compte, la sélection de votre secteur d'activité ajuste automatiquement l'affichage de vos outils de diagnostic pour vous offrir une pertinence d'analyse immédiate dès votre première connexion.
            </p>
          </div>
        </div>

        {/* CTA final */}
        <div className="mt-16 bg-gradient-to-br from-emerald-900 to-slate-900 text-white rounded-2xl p-8 text-center shadow-lg">
          <h3 className="text-xl font-bold mb-3">Votre activité n'est pas répertoriée ?</h3>
          <p className="text-slate-300 text-sm max-w-2xl mx-auto leading-relaxed mb-6">
            Nos applications disposent d'un mode de configuration universel permettant d'ajuster les intitulés de facturation et les saisies d'inventaire à n'importe quel domaine d'activité.
          </p>
          <Link href="/inscription" className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-6 py-3 rounded-full transition-all">
            Déployer pour mon secteur
          </Link>
        </div>

        {/* Pied de page */}
        <footer className="border-t border-slate-200 dark:border-slate-800/80 mt-16 pt-8 text-center text-sm text-slate-400">
          <p>© 2026 GreenItCar. Tous droits réservés.</p>
        </footer>

      </div>
    </main>
  );
}
