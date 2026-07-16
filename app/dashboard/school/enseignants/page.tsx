"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { db as baseDb } from "../../../lib/db";

const db = baseDb as any;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ListeEnseignantsPage() {
  const router = useRouter();
  const [enseignants, setEnseignants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchEnseignants() {
      let activeUid: string | null = null;

      // 1. TENTATIVE SÉCURISÉE SUR SUPABASE (SANS CRASH EN MODE HORS-LIGNE)
      try {
        if (navigator.onLine) {
          const { data: { user }, error } = await supabase.auth.getUser();
          if (!error && user) {
            activeUid = user.id;
          }
        }
      } catch (authError) {
        console.log("Supabase Auth inaccessible (Mode hors-ligne pour la liste enseignants).");
      }

      // 2. REPLI SUR LA SESSION LOCALE PERMANENTE DEXIE
      if (!activeUid) {
        try {
          const utilisateursLocaux = await db["utilisateurs"].limit(1).toArray();
          if (utilisateursLocaux && utilisateursLocaux.length > 0) {
            activeUid = utilisateursLocaux[0].id;
          }
        } catch (dexieAuthError) {
          console.error("Échec de récupération de la session locale Dexie", dexieAuthError);
        }
      }

      // SÉCURITÉ : Si aucun utilisateur n'est identifié, retour à la connexion
      if (!activeUid) {
        return router.push("/login");
      }

      // --- 3. LECTURE DE LA BASE LOCALE DEXIE (INSTANTANÉE ET SANS LIGNES ROUGES) ---
      try {
        const corpsProfessoralLocal = await db["gs_enseignants"]
          .where("utilisateur_id")
          .equals(activeUid)
          .toArray();

        // Tri local par nom pour respecter l'affichage attendu
        const triLocal = (corpsProfessoralLocal || []).sort((a: any, b: any) => 
          (a.nom || "").localeCompare(b.nom || "")
        );

        setEnseignants(triLocal);
        setLoading(false);
      } catch (dexieQueryError) {
        console.error("Erreur d'interrogation locale des enseignants :", dexieQueryError);
        setLoading(false);
      }

      // --- 4. REFRESH EN ARRIÈRE-PLAN UNIQUEMENT SI EN LIGNE ---
      if (navigator.onLine) {
        try {
          const { data: corpsProfessoralServeur } = await supabase
            .from("gs_enseignants")
            .select("id, nom, prenom, telephone, email, specialite, utilisateur_id")
            .eq("utilisateur_id", activeUid);

          if (corpsProfessoralServeur && corpsProfessoralServeur.length > 0) {
            // Formatage des données reçues avec le tag de synchronisation propre
            const donneesFormatees = corpsProfessoralServeur.map((prof: any) => ({
              ...prof,
              statut_synchro: "synchronise"
            }));

            // Écrase ou ajoute les nouveautés du Cloud dans Dexie sans créer de doublons
            await db["gs_enseignants"].bulkPut(donneesFormatees);

            // Nouvelle mise à jour de l'affichage avec les données fraîches du serveur
            const miseAJourTriee = donneesFormatees.sort((a: any, b: any) => 
              (a.nom || "").localeCompare(b.nom || "")
            );
            setEnseignants(miseAJourTriee);
          }
        } catch (serverError) {
          console.log("Le rafraîchissement Cloud des enseignants a échoué (mode déconnecté).", serverError);
        }
      }
    }

    fetchEnseignants();
  }, [router]);

  // Recherche dynamique (Inchangée, fonctionne parfaitement sur l'état local)
  const profsFiltres = enseignants.filter((prof) => 
    prof.nom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    prof.prenom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    prof.specialite?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center text-sm">Chargement du corps enseignant...</div>;

    return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 min-h-screen text-slate-800 dark:text-slate-100">
      {/* Entête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Registre du Corps Enseignant</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Gérez le personnel éducatif et leurs spécialités de cours.</p>
        </div>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg font-medium transition-colors w-full sm:w-auto text-center"
        >
          ← Retour au Tableau de bord
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <input
          type="text"
          placeholder="Rechercher un enseignant par nom, prénom ou matière enseignée..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
        />
      </div>

      {/* ========================================================================= */}
      {/* 📱 AFFICHAGE MODE CARTES RESPONSIVE (Uniquement sur Téléphone / Smartphone) */}
      {/* ========================================================================= */}
      <div className="block md:hidden space-y-3">
        {profsFiltres.length === 0 ? (
          <div className="p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-center text-slate-400 dark:text-slate-500 italic shadow-sm">
            Aucun enseignant répertorié pour cette recherche.
          </div>
        ) : (
          profsFiltres.map((prof) => (
            <div 
              key={prof.id} 
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-4 transition-transform active:scale-[0.99]"
            >
              {/* Ligne 1 : Identité & Badge de spécialité */}
              <div className="flex justify-between items-start gap-2">
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  {prof.nom} {prof.prenom}
                </h4>
                <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap">
                  {prof.specialite || "Généraliste"}
                </span>
              </div>

              {/* Ligne 2 : Actions de communication cliquables */}
              <div className="grid grid-cols-2 pt-3 border-t border-slate-100 dark:border-slate-800/60 text-xs gap-4">
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Téléphone</p>
                  {prof.telephone ? (
                    <a 
                      href={`tel:${prof.telephone}`} 
                      className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400 underline decoration-dotted"
                    >
                      📞 {prof.telephone}
                    </a>
                  ) : (
                    <span className="text-slate-400 italic">Aucun</span>
                  )}
                </div>
                
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Email</p>
                  {prof.email ? (
                    <a 
                      href={`mailto:${prof.email}`} 
                      className="font-mono text-xs text-blue-600 dark:text-blue-400 underline decoration-dotted block truncate max-w-full"
                    >
                      ✉️ {prof.email}
                    </a>
                  ) : (
                    <span className="text-slate-400 italic">Aucun</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ========================================================================= */}
      {/* 💻 AFFICHAGE TABLEAU CLASSIQUE (Masqué sur mobile, visible uniquement sur PC) */}
      {/* ========================================================================= */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                <th className="p-4">Enseignant</th>
                <th className="p-4">Matière / Spécialité</th>
                <th className="p-4">Numéro de Téléphone</th>
                <th className="p-4">Adresse Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {profsFiltres.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400 dark:text-slate-500 italic">
                    Aucun enseignant répertorié pour cette recherche.
                  </td>
                </tr>
              ) : (
                profsFiltres.map((prof) => (
                  <tr key={prof.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 font-medium text-slate-900 dark:text-white">
                      {prof.nom} {prof.prenom}
                    </td>
                    <td className="p-4">
                      <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded text-xs font-semibold">
                        {prof.specialite || "Généraliste / Non définie"}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-600 dark:text-slate-400">{prof.telephone || "—"}</td>
                    <td className="p-4 font-mono text-xs text-slate-500 dark:text-slate-400">{prof.email || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}