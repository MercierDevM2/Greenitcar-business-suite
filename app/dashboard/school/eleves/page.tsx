"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { db as baseDb } from "../../../lib/db";
// 💡 Import de l'orchestrateur de synchronisation unifié pour éviter les doublons de requêtes
import { executionSynchronisationGlobale } from "../../../lib/syncService";

const db = baseDb as any;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ListeElevesPage() {
  const router = useRouter();
  const [eleves, setEleves] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // États de filtrage
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClasse, setSelectedClasse] = useState("toutes");
  const [userId, setUserId] = useState<string>("");

  // ==========================================
  // 📥 FONCTION DE LECTURE DU CACHE DEXIE UNIQUE
  // ==========================================
  const chargerDonneesDepuisCache = async (activeUid: string) => {
    try {
      // 1. Charger les classes depuis Dexie
      const listeClassesLocales = await db["gs_classes"]
        .where("utilisateur_id")
        .equals(activeUid)
        .toArray();
      setClasses(listeClassesLocales || []);

      // 2. Charger les tables locales pour reconstruire la jointure manuellement (inclut "pending" et "synced")
      const inscriptionsLocales = await db["gs_inscriptions"].where("utilisateur_id").equals(activeUid).toArray();
      const elevesLocaux = await db["gs_eleves"].where("utilisateur_id").equals(activeUid).toArray();
      const paiementsLocaux = await db["gs_paiements"].where("utilisateur_id").equals(activeUid).toArray();

      // 3. Reconstitution de l'objet combiné
      const dataCombinee = inscriptionsLocales.map((ins: any) => {
        const classe = listeClassesLocales.find((c: any) => c.id === ins.classe_id);
        const eleve = elevesLocaux.find((e: any) => e.id === ins.eleve_id);
        const paiements = paiementsLocaux.filter((p: any) => p.inscription_id === ins.id);

        return {
          id: ins.id,
          numero_matricule: ins.numero_matricule,
          scolarite_totale: ins.scolarite_totale,
          reduction: ins.reduction,
          classe_id: ins.classe_id,
          gs_classes: classe ? { nom: classe.nom, niveau: classe.niveau } : null,
          gs_eleves: eleve ? { 
            nom: eleve.nom, 
            prenom: eleve.prenom, 
            sexe: eleve.sexe, 
            telephone_parent: eleve.telephone_parent, 
            nom_parent: eleve.nom_parent 
          } : null,
          gs_paiements: (paiements || []).map((p: any) => ({ montant: p.montant }))
        };
      });

      setEleves(dataCombinee);
    } catch (error) {
      console.error("Erreur lors de la lecture de Dexie :", error);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // ⚡ INITIALISATION ET ÉCOUTEUR RÉSEAU UNIFIÉ
  // ==========================================
  useEffect(() => {
    async function initialiserPage() {
      let activeUid: string | null = null;

      // 1. Authentification Cloud
      try {
        if (navigator.onLine) {
          const { data: { user }, error } = await supabase.auth.getUser();
          if (!error && user) activeUid = user.id;
        }
      } catch (authError) {
        console.log("Supabase Auth inaccessible.");
      }

      // 2. Repli local session Dexie
      if (!activeUid) {
        try {
          const utilisateursLocaux = await db["utilisateurs"].limit(1).toArray();
          if (utilisateursLocaux && utilisateursLocaux.length > 0) activeUid = utilisateursLocaux[0].id;
        } catch (dexieAuthError) {
          console.error("Échec session locale", dexieAuthError);
        }
      }

      if (!activeUid) {
        return router.push("/login");
      }

      setUserId(activeUid);

      // Chargement instantané du cache (affiche les données locales + en attente sans latence)
      await chargerDonneesDepuisCache(activeUid);

      // Si Internet est là dès le départ, on aligne proprement le cache
      if (navigator.onLine) {
        console.log("🌐 Initialisation en ligne : alignement du cache...");
        // Remplace l'ancien fetch destructeur par le service centralisé
        await executionSynchronisationGlobale(activeUid, "tous");
        await chargerDonneesDepuisCache(activeUid);
      }
    }

    initialiserPage();
  }, [router]);

  // Écouteur automatique de reconnexion internet (pendant que l'utilisateur est sur la page)
  useEffect(() => {
    if (!userId) return;

    const handleOnlineSync = async () => {
      console.log("🌐 Internet détecté sur la liste : synchronisation propre...");
      // @ts-ignore
      await executionSynchronisationGlobale(userId, "tous");
      await chargerDonneesDepuisCache(userId);
    };

    window.addEventListener("online", handleOnlineSync);
    return () => window.removeEventListener("online", handleOnlineSync);
  }, [userId]);

  // Logique de filtrage en temps réel
  const elevesFiltres = eleves.filter((item) => {
    const eleveInfo = item.gs_eleves;
    const matchSearch =
      eleveInfo?.nom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eleveInfo?.prenom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.numero_matricule?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchClasse =
      selectedClasse === "toutes" || String(item.classe_id) === String(selectedClasse);

    return matchSearch && matchClasse;
  });

  if (loading) return <div className="p-8 text-center text-sm">Chargement de la base élèves...</div>;

    return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 min-h-screen text-slate-800 dark:text-slate-100">
      {/* Entête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Base de Données Élèves</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Liste globale des inscriptions et des contacts parents.</p>
        </div>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg font-medium transition-colors w-full sm:w-auto text-center"
        >
          ← Retour au Tableau de bord
        </button>
      </div>

      {/* Barre d'outils de filtres */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Rechercher par nom, prénom ou matricule..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>
        <div className="w-full sm:w-64">
          <select
            value={selectedClasse}
            onChange={(e) => setSelectedClasse(e.target.value)}
            className="w-full border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
          >
            <option value="toutes" className="dark:bg-slate-900">Toutes les classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id} className="dark:bg-slate-900">{c.nom}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 📱 AFFICHAGE MODE CARTES RESPONSIVE (Uniquement sur Téléphone / Tablettes) */}
      {/* ========================================================================= */}
      <div className="block md:hidden space-y-3">
        {elevesFiltres.length === 0 ? (
          <div className="p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-center text-slate-400 dark:text-slate-500 italic shadow-sm">
            Aucun élève trouvé pour ces critères.
          </div>
        ) : (
          elevesFiltres.map((item) => {
            const netAttendu = (Number(item.scolarite_totale) || 0) - (Number(item.reduction) || 0);
            const totalVerse = item.gs_paiements?.reduce((sum: number, p: any) => sum + (Number(p.montant) || 0), 0) || 0;
            const resteAPayer = netAttendu - totalVerse;

            return (
              <div 
                key={item.id} 
                className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-4 transition-transform active:scale-[0.99]"
              >
                {/* Ligne 1 : Nom, Prénom & Badge Classe */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h4 className="font-bold text-base text-slate-900 dark:text-white">
                      {item.gs_eleves?.nom} {item.gs_eleves?.prenom}
                    </h4>
                    <span className="inline-block font-mono text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded mt-1">
                      Matricule : {item.numero_matricule || "N/A"}
                    </span>
                  </div>
                  <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap">
                    {item.gs_classes?.nom || "Non assignée"}
                  </span>
                </div>

                {/* Ligne 2 : Détails techniques secondaires (Sexe) */}
                <div className="text-xs text-slate-500 dark:text-slate-400 flex gap-4 font-medium">
                  <p>Genre : <span className="text-slate-800 dark:text-slate-200 font-semibold">{item.gs_eleves?.sexe || "—"}</span></p>
                </div>

                {/* Ligne 3 : Pied de carte financier & Contact parents */}
                <div className="flex justify-between items-end pt-3 border-t border-slate-100 dark:border-slate-800/60 text-xs gap-2">
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Contact Parent</p>
                    {item.gs_eleves?.telephone_parent ? (
                      <a 
                        href={`tel:${item.gs_eleves.telephone_parent}`} 
                        className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400 underline decoration-dotted active:text-indigo-500"
                      >
                        📞 {item.gs_eleves.telephone_parent}
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Aucun numéro</span>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">État Financier</p>
                    {resteAPayer <= 0 ? (
                      <span className="inline-block text-xs bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-lg font-bold">
                        Soldé
                      </span>
                    ) : (
                      <span className="inline-block text-xs bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 px-2.5 py-1 rounded-lg font-bold whitespace-nowrap">
                        {resteAPayer.toLocaleString("fr-FR")} F
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
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
                <th className="p-4">Matricule</th>
                <th className="p-4">Nom & Prénom</th>
                <th className="p-4">Sexe</th>
                <th className="p-4">Classe</th>
                <th className="p-4 text-right">État financier</th>
                <th className="p-4">Téléphone Parent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {elevesFiltres.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 dark:text-slate-500 italic">
                    Aucun élève trouvé pour ces critères.
                  </td>
                </tr>
              ) : (
                elevesFiltres.map((item) => {
                                    // --- Calcul de la formule stricte ---
                  const netAttendu = (Number(item.scolarite_totale) || 0) - (Number(item.reduction) || 0);
                  const totalVerse = item.gs_paiements?.reduce((sum: number, p: any) => sum + (Number(p.montant) || 0), 0) || 0;
                  const resteAPayer = netAttendu - totalVerse;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {item.numero_matricule || "N/A"}
                      </td>
                      <td className="p-4 font-medium text-slate-900 dark:text-white">
                        {item.gs_eleves?.nom} {item.gs_eleves?.prenom}
                      </td>
                      <td className="p-4 text-xs">{item.gs_eleves?.sexe || "—"}</td>
                      <td className="p-4">
                        <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 px-2 py-1 rounded text-xs font-semibold">
                          {item.gs_classes?.nom || "Non assignée"}
                        </span>
                      </td>
                      
                      {/* COLONNE ÉTAT FINANCIER SOLDEE / RESTE */}
                      <td className="p-4 text-right font-semibold">
                        {resteAPayer <= 0 ? (
                          <span className="text-xs bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-lg font-bold">
                            Soldé
                          </span>
                        ) : (
                          <span className="text-xs bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 px-2.5 py-1 rounded-lg font-bold">
                            Reste : {resteAPayer.toLocaleString("fr-FR")} FCFA
                          </span>
                        )}
                      </td>

                      <td className="p-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {item.gs_eleves?.telephone_parent || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
