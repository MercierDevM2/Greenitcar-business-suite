"use client"; 

import Link from "next/link";
import { useRouter } from "next/navigation"; 
export default function AproposPage() {
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
          <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider text-sm">Notre Histoire</span>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mt-2 sm:text-5xl">
            À propos de <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-green-500">GreenItCar</span>
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 mt-4 font-medium">
            Construisons ensemble l'entreprise africaine de demain.
          </p>
        </div>

        {/* Manifeste / Vision */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm space-y-6 text-slate-700 dark:text-slate-300 leading-relaxed">
          <p>
            Chez <strong className="text-slate-900 dark:text-white">GreenItCar</strong>, nous sommes convaincus que la transformation numérique ne doit pas être réservée aux grandes entreprises. Chaque commerce, chaque école, chaque ONG, chaque PME mérite de disposer d'outils modernes pour gérer ses activités avec simplicité, efficacité et confiance.
          </p>
          <p>
            C'est cette conviction qui nous a conduits à créer <strong className="text-emerald-600 dark:text-emerald-400">GreenItCar Business Suite</strong>, une plateforme de gestion conçue pour répondre aux réalités des organisations africaines.
          </p>
          <p>
            Notre mission est d'accompagner les entreprises dans leur transformation numérique, depuis la conception de solutions logicielles jusqu'à l'analyse des données et la montée en compétences de leurs équipes. Nous développons des outils simples, fiables et accessibles qui permettent d'automatiser les tâches quotidiennes, d'améliorer le suivi des activités et de faciliter la prise de décision.
          </p>
          <p>
            Nous ne nous considérons pas uniquement comme des développeurs de logiciels. Nous sommes un partenaire de modernisation. Nous prenons le temps de comprendre les besoins de chaque organisation afin de proposer des solutions adaptées à son activité, à son budget et à son environnement.
          </p>
          <p>
            Aujourd'hui, GreenItCar accompagne les établissements scolaires grâce à <strong className="text-slate-900 dark:text-white">GreenSchool</strong>, les commerces et les PME avec <strong className="text-slate-900 dark:text-white">GreenFacture</strong>, et poursuit le développement de nouveaux modules destinés à répondre aux besoins des ressources humaines, de la gestion documentaire, de l'inventaire, de l'analyse des données et d'autres secteurs clés.
          </p>
        </div>

        {/* Grille des Valeurs */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-8">Nos 4 valeurs fondamentales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
              <div className="text-3xl mb-3">💡</div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Innovation utile</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Nous développons des solutions qui répondent à des problèmes concrets et apportent une réelle valeur aux organisations.</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
              <div className="text-3xl mb-3">✨</div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Simplicité</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Nos applications sont conçues pour être intuitives et faciles à prendre en main, même par des utilisateurs ayant peu d'expérience en informatique.</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
              <div className="text-3xl mb-3">🤝</div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Proximité</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Nous accompagnons nos clients à chaque étape : conseil, installation, formation, assistance et évolution de leurs solutions.</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
              <div className="text-3xl mb-3">🏅</div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Excellence</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Nous nous engageons à fournir des solutions fiables, sécurisées et évolutives, conformes aux meilleures pratiques du développement logiciel.</p>
            </div>

          </div>
        </div>

        {/* Focus Mode Hybride / Conclusion */}
        <div className="mt-16 bg-gradient-to-br from-emerald-900 to-slate-900 text-white rounded-2xl p-8 text-center shadow-lg">
          <div className="text-3xl mb-3">🌍</div>
          <h3 className="text-xl font-bold mb-3">Adapté aux réalités du terrain</h3>
          <p className="text-slate-300 text-sm max-w-2xl mx-auto leading-relaxed mb-6">
            Parce que les défis numériques en Afrique sont spécifiques, nos solutions sont également pensées pour fonctionner dans des environnements où la connexion Internet est limitée. Grâce à un mode de fonctionnement hybride, GreenItCar Business Suite permet de poursuivre les activités même hors connexion, avec une synchronisation automatique dès que le réseau est disponible.
          </p>
          <p className="text-emerald-400 font-bold text-lg">
            GreenItCar n'est pas seulement un éditeur de logiciels. <br className="hidden sm:inline"/>
            <span className="text-white">Nous sommes votre partenaire de la transformation numérique.</span>
          </p>
          <div className="mt-6">
            <Link href="/inscription" className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-6 py-3 rounded-full transition-all">
              Rejoindre l'aventure
            </Link>
          </div>
        </div>
      <footer className="border-t border-slate-800 px-6 py-8 text-center text-sm text-slate-400 lg:px-8">
        <p>© 2026 GreenItCar. Tous droits réservés.</p>
      </footer>
      </div>
    </main>
  );
}
