// 📂 Créez ce fichier : app/inscription/succes/page.tsx
"use client";
import Link from "next/link";

export default function InscriptionSuccesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl text-center">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center mb-4 text-white text-3xl font-bold">✓</div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Compte configuré !</h2>
            <p className="text-slate-600 dark:text-slate-300">Votre entreprise est maintenant enregistrée sur GreenItCar Business Suite avec vos applications.</p>
          </div>
          <Link href="/dashboard" className="inline-block w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105">
            Accéder au tableau de bord
          </Link>
        </div>
      </div>
    </main>
  );
}
