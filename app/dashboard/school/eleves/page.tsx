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

export default function ListeElevesPage() {
  const router = useRouter();
  const [eleves, setEleves] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // États de filtrage
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClasse, setSelectedClasse] = useState("toutes");

  useEffect(() => {
    async function fetchDonnees() {
      let activeUid: string | null = null;

      // 1. TENTATIVE AUTHENTIFICATION CLOUD (PROTECTION TRY/CATCH CONTRE LE CRASH HORSLIGNE)
      try {
        if (navigator.onLine) {
          const { data: { user }, error } = await supabase.auth.getUser();
          if (!error && user) {
            activeUid = user.id;
          }
        }
      } catch (authError) {
        console.log("Supabase Auth inaccessible (Mode hors-ligne pour la liste élèves).");
      }

      // 2. REPLI SUR SESSION PERMANENTE DEXIE SI HORS-LIGNE
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

      // SÉCURITÉ : Si aucun utilisateur n'est trouvé, retour à la connexion
      if (!activeUid) {
        return router.push("/login");
      }

      // --- 3. LOGIQUE HORS-LIGNE INTERNE (DEXIE BLINDÉE SANS LIENS ROUGES) ---
      try {
        // 3a. Charger les classes depuis Dexie via l'écriture dynamique par crochets
        const listeClassesLocales = await db["gs_classes"]
          .where("utilisateur_id")
          .equals(activeUid)
          .toArray();
        setClasses(listeClassesLocales || []);

        // 3b. Charger les tables locales pour reconstruire la jointure manuellement
        const inscriptionsLocales = await db["gs_inscriptions"].where("utilisateur_id").equals(activeUid).toArray();
        const elevesLocaux = await db["gs_eleves"].where("utilisateur_id").equals(activeUid).toArray();
        const paiementsLocaux = await db["gs_paiements"].where("utilisateur_id").equals(activeUid).toArray();

        // 3c. Recréation de l'objet combiné (Jointure manuelle)
        const dataCombinee = inscriptionsLocales.map((ins: any) => {
          const classe = listeClassesLocales.find((c: any) => c.id === ins.classe_id);
          const eleve = elevesLocaux.find((e: any) => e.id === ins.eleve_id);
          
          // 🌟 La variable s'appelle 'paiements' ici :
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
            // ✅ Corrigé ici : on utilise bien 'paiements' au lieu de 'pm'
            gs_paiements: (paiements || []).map((p: any) => ({ montant: p.montant }))
          };
        });

        setEleves(dataCombinee);
        setLoading(false);
      } catch (dexieQueryError) {
        console.error("Erreur d'interrogation des tables Dexie :", dexieQueryError);
        setLoading(false);
      }

      // --- 4. REFRESH EN ARRIÈRE-PLAN UNIQUEMENT SI EN LIGNE ---
      if (navigator.onLine) {
        try {
          const { data: serverInscriptions } = await supabase
            .from("gs_inscriptions")
            .select(`
              id, numero_matricule, scolarite_totale, reduction, classe_id, utilisateur_id, annee_id, eleve_id,
              gs_classes ( id, nom, niveau, utilisateur_id, annee_id ),
              gs_eleves ( id, nom, prenom, sexe, telephone_parent, nom_parent, utilisateur_id ),
              gs_paiements ( id, inscription_id, montant, utilisateur_id )
            `)
            .eq("utilisateur_id", activeUid);

          if (serverInscriptions) {
            const localInscriptions: any[] = [];
            const localEleves: any[] = [];
            const localPaiements: any[] = [];
            const localClasses: any[] = [];

            serverInscriptions.forEach((item: any) => {
              localInscriptions.push({
                id: item.id,
                utilisateur_id: item.utilisateur_id,
                annee_id: item.annee_id,
                eleve_id: item.eleve_id,
                classe_id: item.classe_id,
                numero_matricule: item.numero_matricule,
                scolarite_totale: item.scolarite_totale,
                reduction: item.reduction,
                statut_synchro: "synchronise"
              });

              if (item.gs_eleves) {
                localEleves.push({ ...item.gs_eleves, statut_synchro: "synchronise" });
              }
              if (item.gs_classes) {
                localClasses.push({ ...item.gs_classes, statut_synchro: "synchronise" });
              }
              if (item.gs_paiements && item.gs_paiements.length > 0) {
                item.gs_paiements.forEach((p: any) => {
                  localPaiements.push({ ...p, statut_synchro: "synchronise" });
                });
              }
            });

            // Sauvegarde ou écrasement propre dans Dexie
            if (localClasses.length > 0) await db["gs_classes"].bulkPut(localClasses);
            if (localEleves.length > 0) await db["gs_eleves"].bulkPut(localEleves);
            if (localInscriptions.length > 0) await db["gs_inscriptions"].bulkPut(localInscriptions);
            if (localPaiements.length > 0) await db["gs_paiements"].bulkPut(localPaiements);

            // Re-lecture propre après mise à jour cloud
            const rafraichiClasses = await db["gs_classes"].where("utilisateur_id").equals(activeUid).toArray();
            setClasses(rafraichiClasses);

            const UIComputed = localInscriptions.map((ins) => {
              const cl = localClasses.find((c: any) => c.id === ins.classe_id);
              const el = localEleves.find((e: any) => e.id === ins.eleve_id);
              const pm = localPaiements.filter((p: any) => p.inscription_id === ins.id);
              return {
                ...ins,
                gs_classes: cl ? { nom: cl.nom, niveau: cl.niveau } : null,
                gs_eleves: el ? { nom: el.nom, prenom: el.prenom, sexe: el.sexe, telephone_parent: el.telephone_parent, nom_parent: el.nom_parent } : null,
                gs_paiements: (pm || []).map((p: any) => ({ montant: p.montant }))
              };
            });
            setEleves(UIComputed);
          }
        } catch (serverError) {
          console.log("Le rafraîchissement Cloud a échoué (Mode hors-ligne strict ou micro-coupure).", serverError);
        }
      }
    }

    fetchDonnees();
  }, [router]);

  // Logique de filtrage en temps réel
  const elevesFiltres = eleves.filter((item) => {
    const eleveInfo = item.gs_eleves;
    const matchSearch =
      eleveInfo?.nom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eleveInfo?.prenom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.numero_matricule?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchClasse =
      selectedClasse === "toutes" || String(item.classe_id) === selectedClasse;

    return matchSearch && matchClasse;
  });

  if (loading) return <div className="p-8 text-center text-sm">Chargement de la base élèves...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Entête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Base de Données Élèves</h1>
          <p className="text-xs text-gray-500 mt-1">Liste globale des inscriptions et des contacts parents.</p>
        </div>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
        >
          ← Retour au Tableau de bord
        </button>
      </div>

      {/* Barre d'outils de filtres */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Rechercher par nom, prénom ou matricule..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border p-2.5 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="w-full sm:w-64">
          <select
            value={selectedClasse}
            onChange={(e) => setSelectedClasse(e.target.value)}
            className="w-full border p-2.5 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="toutes">Toutes les classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tableau des élèves épuré */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-100 text-slate-500 font-medium">
                <th className="p-4">Matricule</th>
                <th className="p-4">Nom & Prénom</th>
                <th className="p-4">Sexe</th>
                <th className="p-4">Classe</th>
                <th className="p-4 text-right">État financier</th>
                <th className="p-4">Téléphone Parent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {elevesFiltres.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400 italic">
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
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-mono text-xs text-gray-500">
                        {item.numero_matricule || "N/A"}
                      </td>
                      <td className="p-4 font-medium text-slate-900">
                        {item.gs_eleves?.nom} {item.gs_eleves?.prenom}
                      </td>
                      <td className="p-4 text-xs">{item.gs_eleves?.sexe || "—"}</td>
                      <td className="p-4">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
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

                      <td className="p-4 font-mono text-xs">{item.gs_eleves?.telephone_parent || "—"}</td>
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
