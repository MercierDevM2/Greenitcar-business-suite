"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../utils/supabase";
import { db as baseDb } from "../../../lib/db";

const db = baseDb as any;

interface ProduitStock {
  id: string;
  nom: string;
  prix_achat: number;
  prix_vente: number;
  stock_initial: number;
  stock_actuel: number;
  stock_alerte: number;
  statut_synchro: string;
}

interface ItemFacture {
  id: string;
  facture_id: string;
  produit_id: string;
  quantite: number;
  statut_synchro: string;
}

interface Facture {
  id: string;
  total_ht: number;
  benefice_realise: number;
  statut_synchro: string;
}

export default function ListeArticlesStockPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<ProduitStock[]>([]);
  const [quantitesSorties, setQuantitesSorties] = useState<Map<string, number>>(new Map());
  const [recherche, setRecherche] = useState("");

    // États pour les compteurs financiers et alertes extraits de votre logique
  const [stats, setStats] = useState({
    alertesStock: 0,
    valeurStock: 0,
  });

  useEffect(() => {
    async function chargerDonneesStocks() {
      try {
        setLoading(true);

        let uid: string | null = null;
        if (navigator.onLine) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) uid = user.id;
        }

        if (!uid) {
          const utilisateursLocaux = await db.utilisateurs.limit(1).toArray();
          if (utilisateursLocaux && utilisateursLocaux.length > 0) {
            uid = utilisateursLocaux[0].id;
          }
        }

        if (!uid) {
          console.warn("Aucun utilisateur trouvé.");
          setLoading(false);
          return;
        }

        // Chargement simultané des tables requises pour vos calculs croisés
        const [produitsLocaux, itemsFacturesLocaux, facturesLocales] = await Promise.all([
          db["gf_produits"].where("utilisateur_id").equals(uid).toArray(),
          db["gf_facture_items"] ? db["gf_facture_items"].where("utilisateur_id").equals(uid).toArray() : Promise.resolve([]),
          db["gf_factures"] ? db["gf_factures"].where("utilisateur_id").equals(uid).toArray() : Promise.resolve([]),
        ]);

        // Filtrage incluant le statut "local" pour comptabiliser les nouvelles factures
        const produitsCache = (produitsLocaux as ProduitStock[]).filter(
          (p) => p.statut_synchro === "synced" || p.statut_synchro === "synchronise" || p.statut_synchro === "local"
        );

        const itemsCache = (itemsFacturesLocaux as ItemFacture[]).filter(
          (i) => i.statut_synchro === "synced" || i.statut_synchro === "synchronise" || i.statut_synchro === "local"
        );

        const facturesCache = (facturesLocales as Facture[]).filter(
          (f) => f.statut_synchro === "synced" || f.statut_synchro === "synchronise" || f.statut_synchro === "local"
        );

        // 1. Indexation des factures en convertissant FORCÉMENT la clé en String
        const facturesMap = new Map<string, Facture>();
        facturesCache.forEach((f) => {
          if (f && f.id) {
            facturesMap.set(String(f.id).trim(), f);
          }
        });

        // 2. Map des quantités sorties avec double sécurisation des types
        const quantitesSortiesMap = new Map<string, number>();
        
        itemsCache.forEach((item) => {
          const idFactureRecherche = String(item.facture_id).trim();
          const factureAssociee = facturesMap.get(idFactureRecherche);

          if (factureAssociee) {
            const produitIdStr = String(item.produit_id).trim();
            const qteActuelle = quantitesSortiesMap.get(produitIdStr) || 0;
            const qteAjout = Number(item.quantite) || 0;
            
            quantitesSortiesMap.set(produitIdStr, qteActuelle + qteAjout);
          }
        });

        // 📊 CALCULS STOCKS AVEC DÉCOMPTE AUTOMATIQUE FIGÉ ET SÉCURISÉ
        let alertesCount = 0;
        let totalValeurStock = 0;

        produitsCache.forEach((p) => {
          const idProduitStr = String(p.id).trim();
          const qteSortie = quantitesSortiesMap.get(idProduitStr) || 0;

          const valeurInitialeBrute = p.stock_initial !== undefined ? p.stock_initial : p.stock_actuel;
          const stockInitial = Number(valeurInitialeBrute) || 0;
          const stockDynamique = Math.max(0, stockInitial - qteSortie);

          let seuilAlerte = Number(p.stock_alerte);
          if (isNaN(seuilAlerte) || p.stock_alerte === undefined) {
            const alerteAlternative = (p as any).alerte;
            seuilAlerte = alerteAlternative !== undefined ? Number(alerteAlternative) : 5;
            if (isNaN(seuilAlerte)) seuilAlerte = 5; 
          }

          if (stockDynamique <= seuilAlerte) {
            alertesCount++;
          }
          totalValeurStock += (Number(p.prix_achat) || 0) * stockDynamique;
        });

        setQuantitesSorties(quantitesSortiesMap);
        setArticles(produitsCache);
        setStats({
          alertesStock: alertesCount,
          valeurStock: totalValeurStock,
        });

      } catch (err) {
        console.error("Erreur lors de la lecture du cache facture/stock :", err);
      } finally {
        setLoading(false);
      }
    }

    chargerDonneesStocks();
  }, []);

  const articlesFiltres = articles.filter((art) =>
    art.nom.toLowerCase().includes(recherche.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <p className="text-sm font-semibold text-slate-500 animate-pulse">Chargement de l'inventaire...</p>
      </div>
    );
  }

    return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm my-4 sm:my-10 transition-colors duration-200">
      
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 dark:border-slate-800 pb-5 mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Inventaire des Articles</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Suivi des quantités initiales, décomptes de facturation et valeurs de stock.
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard")}
          className="w-full sm:w-auto px-4 py-2 text-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
        >
          Retour au Dashboard
        </button>
      </div>

      {/* Widgets synthétiques basés sur vos calculs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Valeur Totale du Stock</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white mt-1 font-mono">
            {stats.valeurStock.toLocaleString()} FCFA
          </p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Articles en Alerte Seuil</p>
          <p className={`text-lg font-bold mt-1 ${stats.alertesStock > 0 ? "text-rose-500 dark:text-rose-400" : "text-emerald-500 dark:text-emerald-400"}`}>
            {stats.alertesStock} {stats.alertesStock > 1 ? "articles" : "article"}
          </p>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="mb-6">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            🔍
          </span>
          <input
            type="text"
            placeholder="Rechercher un article par son nom..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* Rendu des articles */}
      {articlesFiltres.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {articles.length === 0 
              ? "Aucun article disponible dans l'inventaire." 
              : "Aucun article ne correspond à votre recherche."}
          </p>
        </div>
      ) : (
        <>
          {/* 📱 Affichage Mobile : Mode Liste de Cartes (Masqué sur écrans SM et plus) */}
          <div className="block sm:hidden space-y-3">
            {articlesFiltres.map((art) => {
              const qteSortie = quantitesSorties.get(String(art.id)) || 0;
              const stockInitial = Number(art.stock_initial) || Number(art.stock_actuel) || 0;
              const stockDynamique = Math.max(0, stockInitial - qteSortie);
              const estEnAlerte = stockDynamique <= (Number(art.stock_alerte) || 0);

              return (
                <div key={art.id} className="p-4 bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/80 rounded-xl space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm break-all pr-2">{art.nom}</h3>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-sm whitespace-nowrap ${
                      estEnAlerte ? "text-rose-500 bg-rose-50 dark:bg-rose-950/30" : "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    }`}>
                      {estEnAlerte ? "Alerte" : "Disponible"}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800/50">
                    <div>
                      <p className="text-slate-400 text-[11px]">Prix Achat</p>
                      <p className="font-mono text-slate-700 dark:text-slate-300 font-medium">{Number(art.prix_achat).toLocaleString()} F</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 text-[11px]">Prix Vente</p>
                      <p className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{Number(art.prix_vente).toLocaleString()} F</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <p className="text-slate-400 text-[11px]">Qté Initiale</p>
                      <p className="font-mono text-slate-500 dark:text-slate-400">{stockInitial}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 text-[11px]">Qté Restante</p>
                      <p className={`font-mono font-bold ${estEnAlerte ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {stockDynamique}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 💻 Affichage Tablette / Ordinateur : Mode Tableau classique (Masqué sur écrans inférieurs à SM) */}
          <div className="hidden sm:block overflow-x-auto invisible-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <th className="py-3 px-4">Désignation</th>
                  <th className="py-3 px-4 text-right">Prix Achat</th>
                  <th className="py-3 px-4 text-right">Prix Vente</th>
                  <th className="py-3 px-4 text-center">Qté Initiale</th>
                  <th className="py-3 px-4 text-center">Qté Restante</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm text-slate-700 dark:text-slate-300">
                {articlesFiltres.map((art) => {
                const qteSortie = quantitesSorties.get(String(art.id)) || 0;
                const stockInitial = Number(art.stock_initial) || Number(art.stock_actuel) || 0;
                const stockDynamique = Math.max(0, stockInitial - qteSortie);
                const seuilAlerte = Number(art.stock_alerte) || 0;

                // 1. Définition précise des 3 états possibles
                const estEnRupture = stockDynamique <= 0;
                const estEnAlerte = !estEnRupture && stockDynamique <= seuilAlerte;

                // 2. Gestion dynamique de la couleur du chiffre de la quantité restante
                let couleurBadgeQuantite = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400";
                if (estEnRupture) {
                  couleurBadgeQuantite = "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400";
                } else if (estEnAlerte) {
                  couleurBadgeQuantite = "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400";
                }

                return (
                  <tr key={art.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {art.nom}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-600 dark:text-slate-400">
                      {Number(art.prix_achat).toLocaleString()} FCFA
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      {Number(art.prix_vente).toLocaleString()} FCFA
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-400 dark:text-slate-500">
                      {stockInitial}
                    </td>
                    
                    {/* Colonne : Qté Restante */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold font-mono ${couleurBadgeQuantite}`}>
                        {stockDynamique}
                      </span>
                    </td>

                    {/* Colonne : Statut à 3 états (Rupture / Alerte / Disponible) */}
                    <td className="py-3.5 px-4 text-center">
                      {estEnRupture ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded">
                          Rupture
                        </span>
                      ) : estEnAlerte ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded">
                          Alerte
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded">
                          Disponible
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </>
      )}
</div>
  );
}

