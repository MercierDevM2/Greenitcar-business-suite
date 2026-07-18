"use client"; 

import { useRouter } from "next/navigation"; 
   
export default function ContactPage() {
  const router = useRouter();
 // 1. Déclaration propre des coordonnées de base
const whatsappNumber = "212680775822"; // Vérifiez bien qu'il n'y a pas de "0" en trop entre 212 et le 6
const phoneNumber = "+23672584161";    
const emailAddress = "greenitcar@gmail.com";
const physicalAddress = "PK11 Bangui, RCA";

// 2. Utilisation de l'URL universelle (Force l'ouverture du site web WhatsApp si l'application n'est pas installée)
const whatsappLink = `https://whatsapp.com/${whatsappNumber}?text=Bonjour%20GreenItCar,%20je%20souhaite%20avoir%20des%20informations%20sur%20vos%20services.`;

const gmailLink = `mailto:${emailAddress}?subject=Demande%20d'informations%20GreenItCar`;



  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 py-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      
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

      <div className="max-w-4xl w-full mx-auto">
        
        {/* En-tête de la page */}
        <div className="text-center mb-12">
          <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider text-sm">Contactez-nous</span>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mt-2 sm:text-5xl">
            Une question ? <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-green-500">Un projet ?</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-4 max-w-xl mx-auto text-base">
            Notre équipe est à votre écoute pour vous accompagner. Choisissez le canal de communication instantané qui vous convient le mieux.
          </p>
        </div>

        {/* Grille des canaux de contact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* 1. Carte WhatsApp */}
          <a 
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm hover:border-emerald-500 dark:hover:border-emerald-500 transition-all group hover:shadow-md hover:-translate-y-1"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-emerald-500 text-2xl font-bold flex items-center gap-3">
                <span className="text-3xl">💬</span> WhatsApp
              </div>
              <span className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 px-2 py-1 rounded-full font-semibold">Réponse rapide</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
              Discutez directement par écrit avec un conseiller pour une démonstration ou pour poser vos questions.
            </p>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
              Lancer la discussion <span>→</span>
            </span>
          </a>

          {/* 2. Carte Appel Téléphonique */}
          <a 
            href={`tel:${phoneNumber}`}
            className="block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm hover:border-blue-500 dark:hover:border-blue-500 transition-all group hover:shadow-md hover:-translate-y-1"
          >
            <div className="text-blue-500 text-2xl font-bold mb-4 flex items-center gap-3">
              <span className="text-3xl">📞</span> Ligne Directe
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
              Contactez-nous par téléphone du lundi au vendredi de 9h à 18h pour un échange de vive voix.
            </p>
            <span className="text-blue-500 font-bold text-sm group-hover:text-blue-600 transition-colors block">
              {phoneNumber}
            </span>
          </a>

          {/* 3. Carte Gmail */}
          <a 
            href={gmailLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm hover:border-red-500 dark:hover:border-red-500 transition-all group hover:shadow-md hover:-translate-y-1"
          >
            <div className="text-red-500 text-2xl font-bold mb-4 flex items-center gap-3">
              <span className="text-3xl">✉️</span> Via Gmail
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
              Envoyez-nous un courriel structuré. Un espace d'écriture s'ouvrira directement dans votre application Gmail.
            </p>
            <span className="text-red-500 font-bold text-sm group-hover:text-red-600 transition-colors truncate block">
              {emailAddress}
            </span>
          </a>

          {/* 4. Carte Adresse & Vision */}
          <div className="bg-slate-950 text-white border border-slate-800 p-8 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <div className="text-emerald-400 text-2xl font-bold mb-4 flex items-center gap-3">
                <span className="text-3xl">📍</span> Localisation
              </div>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                Nos équipes interviennent physiquement pour le conseil, le déploiement et la formation de vos collaborateurs.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800 text-sm font-semibold text-slate-400">
              Zone d'activité : <span className="text-white">{physicalAddress}</span>
            </div>
          </div>

        </div>
      <footer className="border-t border-slate-800 px-6 py-8 text-center text-sm text-slate-400 lg:px-8">
        <p>© 2026 GreenItCar. Tous droits réservés.</p>
      </footer>
      </div>
    </main>
  );
}
