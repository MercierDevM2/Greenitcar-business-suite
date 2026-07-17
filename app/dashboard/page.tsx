"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { db as baseDb } from "../lib/db";
// @ts-ignore
import { executionSynchronisationGlobale } from "../lib/syncService";



const db = baseDb as any;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface KpiCard {
  title: string;
  value: string | number;
  moduleName: string;
  color: string;
}

// =========================================================================
// 🔄 LOGIQUE DE SYNCHRONISATION GLOBALE (DEXIE PENDING -> SUPABASE -> DEXIE CACHE)
// =========================================================================
const executionSynchronisationGlobale = async (userId: string, anneeId: string): Promise<void> => {
  try {
    console.log("Début de la synchronisation pour l'utilisateur :", userId);

    // --- EXEMPLE DE SYNCHRO MODULE ÉCOLE : INSCRIPTIONS ---
    // 1. Récupérer les inserts locaux en attente
    const inscriptionsPending = await db["gs_inscriptions"]
      .filter((item: any) => item.utilisateur_id === userId && item.statut_synchro === "pending")
      .toArray();

    if (inscriptionsPending.length > 0) {
      // 2. Envoyer vers Supabase (en retirant le champ local 'statut_synchro' avant envoi)
      const dataToSend = inscriptionsPending.map(({ statut_synchro, ...reste }: any) => reste);
      const { error } = await supabase.from("gs_inscriptions").upsert(dataToSend);

      if (!error) {
        // 3. Passer le statut en "synced" localement une fois validé par Supabase
        await db["gs_inscriptions"]
          .where("id")
          .anyOf(inscriptionsPending.map((i: any) => i.id))
          .modify({ statut_synchro: "synced" });
      } else {
        console.error("Erreur Supabase Inscriptions :", error);
      }
    }

    // --- EXEMPLE DE SYNCHRO MODULE COMMERCE : FACTURES ---
    const facturesPending = await db["gf_factures"]
      .filter((item: any) => item.utilisateur_id === userId && item.statut_synchro === "pending")
      .toArray();

    if (facturesPending.length > 0) {
      const dataToSend = facturesPending.map(({ statut_synchro, ...reste }: any) => reste);
      const { error } = await supabase.from("gf_factures").upsert(dataToSend);

      if (!error) {
        await db["gf_factures"]
          .where("id")
          .anyOf(facturesPending.map((f: any) => f.id))
          .modify({ statut_synchro: "synced" });
      } else {
        console.error("Erreur Supabase Factures :", error);
      }
    }

    // Répétez ce schéma pour vos autres tables si nécessaire (gs_paiements, gf_produits...)

    console.log("✅ Synchronisation globale terminée avec succès !");
  } catch (error) {
    console.error("Erreur critique lors de la synchronisation :", error);
    throw error;
  }
};

export default function DashboardPage() {
  const router = useRouter();
  const [activeServices, setActiveServices] = useState<string[]>([]);
  const [kpis, setKpis] = useState<KpiCard[]>([]);
  const [rawEleves, setRawEleves] = useState({
    inscriptions: [] as any[],
    paiements: [] as any[],
    enseignants: 0,
    classes: 0,
  });
  const [annees, setAnnees] = useState<any[]>([]);
  const [currentAnnee, setCurrentAnnee] = useState("");
  const [currentSchoolFilter, setCurrentSchoolFilter] = useState("tous");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");

  const [classes, setClasses] = useState<any[]>([]);
  const [currentClasse, setCurrentClasse] = useState("toutes");

  const [rawFacturation, setRawFacturation] = useState({
    factures: [] as any[],
    produits: [] as any[],
    alertesStock: 0,
    valeurStock: 0,
    chiffreAffaires: 0,
    margeTotale: 0,
  });

  const loadSchoolData = async (uid: string, anneeId: string) => {
  try {
    // 1. Récupération globale depuis Dexie
    const [
      inscriptionsLocales,
      elevesLocaux,
      paiementsLocaux,
      enseignantsLocaux,
      classesLocales,
    ] = await Promise.all([
      db["gs_inscriptions"].where("annee_id").equals(Number(anneeId)).toArray(),
      db["gs_eleves"].where("utilisateur_id").equals(uid).toArray(),
      db["gs_paiements"].where("utilisateur_id").equals(uid).toArray(),
      db["gs_enseignants"].where("utilisateur_id").equals(uid).toArray(),
      db["gs_classes"].where("annee_id").equals(Number(anneeId)).toArray(),
    ]);

    // 2. 🚨 SÉCURISATION DU CACHE DU DASHBOARD : ON FILTRE TOUT SUR LE STATUT SYNCHRONISÉ
    // Le Dashboard ignore complètement les nouveaux inserts locaux ("local" ou "pending")
    const classesCache = classesLocales.filter(
      (c: any) => c.utilisateur_id === uid && (c.statut_synchro === "synced" || c.statut_synchro === "synchronise")
    );
    
    const enseignantsCache = enseignantsLocaux.filter(
      (e: any) => (e.statut_synchro === "synced" || e.statut_synchro === "synchronise")
    );

    const classesMap = new Map(classesCache.map((c: any) => [c.id, c]));
    const elevesCacheMap = new Map(
      elevesLocaux
        .filter((e: any) => e.statut_synchro === "synced" || e.statut_synchro === "synchronise")
        .map((e: any) => [e.id, e])
    );

    // Filtrage des inscriptions synchronisées
    const inscriptionsCache = inscriptionsLocales.map((ins: any) => {
      const cl = classesMap.get(ins.classe_id) as any;
      const el = elevesCacheMap.get(ins.eleve_id) as any;
      return {
        ...ins,
        gs_classes: cl ? { nom: cl.nom, niveau: cl.niveau } : null,
        gs_eleves: el ? { nom: el.nom, prenom: el.prenom } : null,
      };
    }).filter(
      (i: any) => i.utilisateur_id === uid && i.gs_eleves !== null && (i.statut_synchro === "synced" || i.statut_synchro === "synchronise")
    );

    const idsCache = new Set<any>((inscriptionsCache || []).map((i: any) => i.id));
    
    // Filtrage des paiements synchronisés
    const paiementsCache = paiementsLocaux.filter(
      (p: any) => idsCache.has(p.inscription_id) && (p.statut_synchro === "synced" || p.statut_synchro === "synchronise")
    );

    // Mettre à jour l'état des classes pour les filtres du Dashboard (uniquement le cache)
    setClasses(classesCache);

    // Injection dans l'état du Dashboard
    setRawEleves({
      inscriptions: inscriptionsCache, // 🔒 Figé sur le cache
      paiements: paiementsCache,       // 🔒 Figé sur le cache
      enseignants: enseignantsCache.length, // 🔒 Figé sur le cache
      classes: classesCache.length,     // 🔒 Figé sur le cache
    });

  } catch (e) {
    console.error("Erreur de verrouillage du cache Dashboard :", e);
  }
};


const loadFactureData = async (uid: string) => {
  try {
    // 💡 LECTURE DU CACHE SYNCHRONISÉ UNIQUEMENT
    const [facturesLocales, produitsLocaux, itemsFacturesLocaux] = await Promise.all([
      db["gf_factures"].where("utilisateur_id").equals(uid).toArray(),
      db["gf_produits"].where("utilisateur_id").equals(uid).toArray(),
      db["gf_facture_items"] ? db["gf_facture_items"].where("utilisateur_id").equals(uid).toArray() : Promise.resolve([]),
    ]);

    // 🔄 MODIFICATION : On accepte aussi le statut "local" pour que l'affichage réagisse tout de suite
const facturesCache = facturesLocales.filter(
  (f: any) => 
    f.statut_synchro === "synced" || 
    f.statut_synchro === "synchronise" || 
    f.statut_synchro === "local" // 
);


    const produitsCache = produitsLocaux.filter(
      (p: any) => p.statut_synchro === "synced" || p.statut_synchro === "synchronise"
    );

    const itemsCache = itemsFacturesLocaux.filter(
      (i: any) => i.statut_synchro === "synced" || i.statut_synchro === "synchronise"
    );

    // 🔄 MAP DES QUANTITÉS SORTIES PAR PRODUIT
    const quantitesSortiesMap = new Map<string, number>();
    itemsCache.forEach((item: any) => {
      // On ne décompte que les items liés à des factures validées/synchronisées
      const factureAssociee = facturesCache.find((f: any) => f.id === item.facture_id);

      if (factureAssociee) {
        const qteActuelle = quantitesSortiesMap.get(item.produit_id) || 0;
        quantitesSortiesMap.set(item.produit_id, qteActuelle + (Number(item.quantite) || 0));
      }
    });

    // 📊 CALCULS STOCKS AVEC DÉCOMPTE AUTOMATIQUE
    let alertesCount = 0;
    let totalValeurStock = 0;

    produitsCache.forEach((p: any) => {
      const qteSortie = quantitesSortiesMap.get(p.id) || 0;
      // Le stock dynamique prend en compte le stock initial moins les sorties
      const stockDynamique = Math.max(0, (Number(p.stock_initial) || Number(p.stock_actuel) || 0) - qteSortie);

      if (stockDynamique <= (Number(p.stock_alerte) || 0)) {
        alertesCount++;
      }
      totalValeurStock += (Number(p.prix_achat) || 0) * stockDynamique;
    });

    // 💰 CALCULS FINANCIERS SANS TVA (HT uniquement)
    const totalCA = facturesCache.reduce(
      (sum: number, f: any) => sum + (Number(f.total_ht) || 0),
      0
    );

    const totalMarge = facturesCache.reduce(
      (sum: number, f: any) => sum + (Number(f.benefice_realise) || 0),
      0
    );

    setRawFacturation({
      factures: facturesCache,
      produits: produitsCache,
      alertesStock: alertesCount,
      valeurStock: totalValeurStock,
      chiffreAffaires: totalCA,
      margeTotale: totalMarge,
    });

    return { alertesCount, totalValeurStock, totalCA, totalMarge };
  } catch (e) {
    console.error("Erreur lors de la lecture du cache facture/stock :", e);
    return { alertesCount: 0, totalValeurStock: 0, totalCA: 0, totalMarge: 0 };
  }
};




useEffect(() => {
  if (!userId || !currentAnnee) return;

  // Charge instantanément les données locales au démarrage de la page
  loadSchoolData(userId, currentAnnee);
  loadFactureData(userId);

  const handleOnlineSync = async () => {
    console.log("🌐 Internet détecté : synchronisation montante et descendante lancée...");
    
    // Pousse le local vers Supabase, rafraîchit Dexie depuis Supabase
    await executionSynchronisationGlobale(userId, currentAnnee);

    // Réaffiche les données rafraîchies à l'écran
    await loadSchoolData(userId, currentAnnee);
    await loadFactureData(userId);
  };

  window.addEventListener("online", handleOnlineSync);
  return () => window.removeEventListener("online", handleOnlineSync);
}, [userId, currentAnnee]);

  // ==========================================
  // ⚡ ORCHESTRATION DU DASHBOARD (FAST FALLBACK)
  // ==========================================
  useEffect(() => {
    async function buildSmartDashboard() {
      let activeUid: string | null = null;
      let services: string[] = [];

      try {
        const utilisateursLocaux = await db["utilisateurs"].limit(1).toArray();
        if (utilisateursLocaux && utilisateursLocaux.length > 0) {
          activeUid = utilisateursLocaux[0].id;
          services = utilisateursLocaux[0].services_choisis || [];
          
          setUserId(activeUid!);
          setActiveServices(services);
          await calculerKpisLocaux(activeUid!, services);
        }
      } catch (err) {
        console.log("Erreur lecture initiale Dexie Dashboard", err);
      }

      if (navigator.onLine) {
        try {
          const { data: { user }, error } = await supabase.auth.getUser();
          if (!error && user) {
            activeUid = user.id;
            const { data: userData } = await supabase
              .from("utilisateurs")
              .select("services_choisis")
              .eq("id", user.id)
              .single();
            
            if (userData?.services_choisis) {
              services = userData.services_choisis;
              setActiveServices(services);
              await calculerKpisLocaux(activeUid, services);
            }
          }
        } catch (netError) {
          console.log("Mode déconnecté en arrière-plan.");
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }

    buildSmartDashboard();
  }, []); // ✅ Le premier useEffect se ferme proprement ICI.

  // ==========================================
  // 📊 CALCUL ET AGREGATION DES COMPTEURS (DEXIE/CLOUD)
  // ==========================================
  async function calculerKpisLocaux(uid: string, activeServices: string[]) {
    const localKpis: KpiCard[] = [];
    const tasks: Promise<any>[] = [];

    // =========================
    // GREENFACTURE / GREENSTOCK
    // =========================
    if (activeServices.includes("facture") || activeServices.includes("stock")) {
      tasks.push(
        (async () => {
          const dataCommerce = await loadFactureData(uid);

          if (activeServices.includes("facture")) {
            localKpis.push(
              {
                title: "Chiffre d'Affaires HT",
                value: `${dataCommerce.totalCA.toLocaleString("fr-FR")} FCFA`,
                moduleName: "GreenFacture",
                color: "text-emerald-600",
              },
              {
                title: "Marge brute réalisée",
                value: `${dataCommerce.totalMarge.toLocaleString("fr-FR")} FCFA`,
                moduleName: "GreenFacture",
                color: "text-sky-600",
              }
            );
          }

          if (activeServices.includes("stock")) {
            localKpis.push(
              {
                title: "Valeur du Stock (Achat)",
                value: `${dataCommerce.totalValeurStock.toLocaleString("fr-FR")} FCFA`,
                moduleName: "GreenStock",
                color: "text-indigo-600",
              },
              {
                title: "Articles en alerte stock",
                value: dataCommerce.alertesCount,
                moduleName: "GreenStock",
                color: "text-rose-600",
              }
            );
          }
        })()
      );
    }

    // =========================
    // GREENPOINTAGE
    // =========================
    if (activeServices.includes("pointage")) {
      tasks.push(
        (async () => {
          const dateDuJour = new Date().toISOString().split("T")[0];
          let latesCount = 0;

          if (navigator.onLine) {
            const { count } = await supabase
              .from("gpt_pointages")
              .select("*", { count: "exact", head: true })
              .eq("utilisateur_id", uid)
              .eq("est_en_retard", true)
              .eq("date_jour", dateDuJour);

            latesCount = count || 0;
          } else {
            latesCount = await db["gpt_pointages"]
              .where("utilisateur_id")
              .equals(uid)
              .filter((item: any) => item.est_en_retard === true && item.date_jour === dateDuJour)
              .count();
          }

          localKpis.push({
            title: "Retards Aujourd'hui",
            value: latesCount,
            moduleName: "GreenPointage",
            color: "text-orange-600",
          });
        })()
      );
    }

    // =========================
    // DATA / ARCHIVE
    // =========================
    if (activeServices.includes("data") || activeServices.includes("archive")) {
      tasks.push(
        (async () => {
          let totalDocsCount = 0;

          if (navigator.onLine) {
            const { count } = await supabase
              .from("gd_missions_archives")
              .select("*", { count: "exact", head: true })
              .eq("utilisateur_id", uid);

            totalDocsCount = count || 0;
          } else {
            totalDocsCount = await db["gd_missions_archives"]
              .where("utilisateur_id")
              .equals(uid)
              .count();
          }

          localKpis.push({
            title: "Éléments Traités / Sécurisés",
            value: totalDocsCount,
            moduleName: "Business Data",
            color: "text-violet-600",
          });
        })()
      );
    }

    // =========================
    // GREENSCHOOL
    // =========================
    if (activeServices.includes("school")) {
      tasks.push(
        (async () => {
          let listeAnnees: any[] = [];

          if (navigator.onLine) {
            const { data } = await supabase
              .from("gs_annees_scolaires")
              .select("id, libelle, active")
              .eq("utilisateur_id", uid)
              .order("id", { ascending: false });

            listeAnnees = data || [];
          } else {
            listeAnnees = await db["gs_annees_scolaires"]
              .where("utilisateur_id")
              .equals(uid)
              .toArray();
          }

          if (listeAnnees.length > 0) {
            setAnnees(listeAnnees);
            const active = listeAnnees.find((a: any) => a.active) || listeAnnees[0];
            setCurrentAnnee(active.id.toString());
            await loadSchoolData(uid, active.id);
          }
        })()
      );
    }

    // ⚡ ATTEND TOUS LES MODULES EN PARALLÈLE
    await Promise.all(tasks);

    // ⚡ UN SEUL RENDER REACT
    setKpis(localKpis);
  } // ✅ La fonction calculerKpisLocaux se ferme proprement ICI.

  
  useEffect(() => {
  async function refreshSchool() {
    if (!userId || !currentAnnee) return;

    await loadSchoolData(userId, currentAnnee);
  }

  refreshSchool();
}, [currentAnnee, userId]);

// 2. Calcul des KPIs GreenSchool
useEffect(() => {
  if (loading) return;

  setKpis((prevKpis) => {
    const sansSchool = prevKpis.filter(
      (kpi) => kpi.moduleName !== "GreenSchool"
    );

    if (!activeServices.includes("school")) return sansSchool;

    const inscriptions = rawEleves.inscriptions || [];
    const paiements = rawEleves.paiements || [];

    // --- ÉTAPE 1 : Pré-calculer TOUS les paiements par inscription (Indépendant des filtres) ---
    const paiementsParInscription: Record<number, number> = {};
    paiements.forEach((p: any) => {
      paiementsParInscription[p.inscription_id] =
        (paiementsParInscription[p.inscription_id] || 0) +
        Number(p.montant || 0);
    });

    // --- ÉTAPE 2 : Filtrer d'abord STRICTEMENT par classe ---
    const inscriptionsParClasse = inscriptions.filter((i: any) => {
      if (currentClasse === "toutes") return true;
      return Number(i.classe_id) === Number(currentClasse);
    });

    let totalEncaisse = 0;
    let totalAttendu = 0;
    let elevesAjour = 0;
    let elevesDebiteurs = 0;
    let inscriptionsFinales = [];

    // --- ÉTAPE 3 : Analyser la situation financière de chaque élève de cette classe ---
    inscriptionsParClasse.forEach((i: any) => {
      const paye = paiementsParInscription[i.id] || 0;
      const totalDuEleve = Number(i.scolarite_totale || 0);

      totalEncaisse += paye;
      totalAttendu += totalDuEleve;

      const estAjour = paye >= totalDuEleve;

      if (estAjour) {
        elevesAjour++;
      } else {
        elevesDebiteurs++;
      }

      // --- ÉTAPE 4 : Appliquer le filtre de statut (currentSchoolFilter = 'tous' / 'solde' / 'dette') ---
      if (currentSchoolFilter === "tous") {
        inscriptionsFinales.push(i);
      } else if (currentSchoolFilter === "solde" && estAjour) {
        inscriptionsFinales.push(i);
      } else if (currentSchoolFilter === "dette" && !estAjour) {
        inscriptionsFinales.push(i);
      }
    });

    // Le nombre total d'élèves affichés dépend du filtre final
    const totalInscritsAffiches = inscriptionsFinales.length;

    const resteARecouvrer = totalAttendu - totalEncaisse;

    const tauxRecouvrement =
      totalAttendu > 0
        ? ((totalEncaisse / totalAttendu) * 100).toFixed(1)
        : "0";

   // Vos variables qui fonctionnent déjà
    const totalInscritsClasse = inscriptionsParClasse.length;
    const panierMoyen =
      totalInscritsClasse > 0
        ? Math.round(totalAttendu / totalInscritsClasse)
        : 0;

    const schoolKpis = [
          {
            title: "Nombre élèves",
            value: inscriptionsParClasse.length, 
            moduleName: "GreenSchool",
            color: "text-purple-600",
          },
          {
            title: "Nombre enseignants",
            value: rawEleves.enseignants, 
            moduleName: "GreenSchool",
            color: "text-blue-600",
        },
        {
          title: "Nombre Classes",
        // 🔒 Figé sur la valeur du cache synchronisé
        value: rawEleves.classes,
        moduleName: "GreenSchool",
        color: "text-cyan-600",
      },
      {
        title: "Scolarités encaissées",
        value: `${totalEncaisse.toLocaleString("fr-FR")} FCFA`,
        moduleName: "GreenSchool",
        color: "text-emerald-600",
      },
      {
        title: "Reste à recouvrer",
        value: `${resteARecouvrer.toLocaleString("fr-FR")} FCFA`,
        moduleName: "GreenSchool",
        color: "text-rose-600",
      },
      {
        title: "Taux de recouvrement",
        value: `${tauxRecouvrement}%`,
        moduleName: "GreenSchool",
        color: "text-indigo-600",
      },
      {
        title: "Scolarité Totale",
        value: `${panierMoyen.toLocaleString("fr-FR")} FCFA`,
        moduleName: "GreenSchool",
        color: "text-slate-600",
      },
      {
        title: "Élèves à jour",
        value: elevesAjour,
        moduleName: "GreenSchool",
        color: "text-teal-600",
      },
      {
        title: "Élèves débiteurs",
        value: elevesDebiteurs,
        moduleName: "GreenSchool",
        color: "text-amber-600",
      },
    ];

    return [...sansSchool, ...schoolKpis];
  });
// Ajout de currentSchoolFilter dans les dépendances pour recalculer si le bouton change
}, [currentClasse, currentSchoolFilter, rawEleves, activeServices, loading]);


useEffect(() => {
  if (loading || !userId) return;

  // 🎯 FONCTION INTERNE ASYNCHRONE POUR ÉVITER TOUT CONFLIT DE TYPE REACT
  async function actualiserKpis() {
    try {
      // 1. On récupère directement les produits depuis Dexie (Zéro problème de type !)
      const produitsLocaux = await db.gf_produits.where("utilisateur_id").equals(userId).toArray();
      const produits = produitsLocaux || [];

      setKpis((prevKpis: any[]) => {
        const tableauPrecedent = prevKpis || [];
        const sansVente = tableauPrecedent.filter(
          (kpi: any) => kpi?.moduleName !== "GreenFacture" && kpi?.moduleName !== "GreenStock"
        );

        const aActiveFacture = activeServices.includes("facture");
        const aActiveStock = activeServices.includes("stock");

        if (!aActiveFacture && !aActiveStock) return sansVente;

        const factures = (rawFacturation && rawFacturation.factures) || [];

        // --- CALCULS FINANCIERS ---
        const chiffreAffaires = factures.reduce((sum: number, f: any) => sum + (Number(f?.total_ttc) || 0), 0);
        const beneficeTotal = factures.reduce((sum: number, f: any) => sum + (Number(f?.benefice_realise) || 0), 0);
        const facturesImpayees = factures.filter((f: any) => f?.statut === "en_attente").length;

        // --- CALCULS DU STOCK (Valorisation depuis Dexie) ---
        const valeurStockAchat = produits.reduce((sum: number, p: any) => {
          const prixAchat = Number(p?.prix_achat) || 0;
          const stockActuel = Number(p?.stock_actuel) || 0;
          return sum + (prixAchat * stockActuel);
        }, 0);

        // --- CALCUL DES ALERTES STOCK (Depuis Dexie) ---
        const nbProduitsEnAlerte = produits.filter((p: any) => {
          const stock = Number(p?.stock_actuel) || 0;
          const seuil = Number(p?.stock_alerte) || 0;
          return stock <= seuil;
        }).length;

        const venteKpis: any[] = [];

        // KPIs dédiés à la Facturation / Caisse
        if (aActiveFacture || aActiveStock) {
          venteKpis.push(
            {
              title: "Chiffre d'Affaires (TTC)",
              value: `${chiffreAffaires.toLocaleString("fr-FR")} FCFA`,
              moduleName: "GreenFacture",
              color: "text-indigo-600",
            },
            {
              title: "Bénéfice Réalisé",
              value: `${beneficeTotal.toLocaleString("fr-FR")} FCFA`,
              moduleName: "GreenFacture",
              color: "text-emerald-600",
            },
            {
              title: "Factures en Attente",
              value: `${facturesImpayees} facture(s)`,
              moduleName: "GreenFacture",
              color: "text-rose-600",
            }
          );
        }

        // KPIs dédiés aux Articles / Marchandises
        if (aActiveFacture || aActiveStock) {
          venteKpis.push(
            {
              title: "Valeur du Stock (Achat)",
              value: `${valeurStockAchat.toLocaleString("fr-FR")} FCFA`,
              moduleName: "GreenStock",
              color: "text-slate-700",
            },
            {
              title: "Articles en alerte stock",
              value: `${nbProduitsEnAlerte} article(s)`,
              moduleName: "GreenStock",
              color: "text-amber-600",
            }
          );
        }

        return [...sansVente, ...venteKpis];
      });
    } catch (err) {
      console.error("Erreur lors du calcul des KPIs depuis Dexie", err);
    }
  }

    actualiserKpis();

// 🎯 On écoute uniquement rawFacturation pour déclencher la relecture de Dexie
}, [rawFacturation, activeServices, loading, userId]);



 if (loading) {
    return (
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
      </div>
    );
  }

  return (
  <div className="space-y-6">
    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Vos Indicateurs Clés</h1>
        <p className="text-slate-500 text-sm mt-1">Vue d'ensemble en temps réel de vos modules actifs.</p>
      </div>
      
      <div className="flex flex-wrap items-center gap-4">
        {/* BOUTON D'ACTION RAPIDE POUR LA FACTURATION */}
        {activeServices.includes("facture") && (
          <button
            onClick={() => router.push("/dashboard/saisies?module=facture")}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors w-full sm:w-auto"
          >
            ➕ Nouvelle Facture
          </button>
        )}

        {/* 📦 AJOUT : BOUTON D'ACTION RAPIDE POUR LE STOCK */}
        {(activeServices.includes("facture") || activeServices.includes("stock")) && (
          <button
            onClick={() => router.push("/dashboard/parametres/stock")}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm rounded-xl shadow-sm transition-colors border border-slate-200 dark:border-slate-700 w-full sm:w-auto"
          >
            📦 Ajouter un article
          </button>
        )}

        {/* REGROUPEMENT DES FILTRES ET ACTIONS RAPIDES DU MODULE SCHOOL */}
        {activeServices.includes("school") && (
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Filtre Classe */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                🏫 Classe
              </label>
              <select
                value={currentClasse}
                onChange={(e) => setCurrentClasse(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
              >
                <option value="toutes">Toutes les classes</option>
                {classes.map((classe: any) => (
                  <option key={classe.id} value={classe.id}>
                    {classe.nom}
                  </option>
                ))}
              </select>
            </div>

            {/* --- NOUVEAUX BOUTONS D'ACTION POUR LA SCOLARITÉ --- */}
            <button
              onClick={() => router.push("/dashboard/saisies?module=school")}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors"
            >
              ➕ Inscrire Élève
            </button>

            <button
              onClick={() => router.push("/dashboard/saisies?module=school_paiement")}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors"
            >
              💰 Encaisser Scolarité
            </button>

            {/* Liens de navigation existants */}
            <button 
              onClick={() => router.push("/dashboard/school/eleves")}
              className="bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-xl font-semibold text-sm shadow-sm transition-colors"
            >
              👨‍🎓 Liste Élèves
            </button>

            <button 
              onClick={() => router.push("/dashboard/school/enseignants")}
              className="bg-blue-800 hover:bg-blue-900 text-white border border-blue-700 px-3 py-1.5 rounded-xl font-semibold text-sm shadow-sm transition-colors"
            >
              👩‍🏫 Enseignants
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Grille unifiée de tous les KPIs */}
    {kpis.length > 0 ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <div 
            key={index} 
            className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col justify-between transition-transform active:scale-98"
          >
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{kpi.title}</p>
              {/* 📱 CORRECTION : text-xl sur téléphone, text-2xl sur tablette (sm), text-3xl sur PC (lg) pour éviter les débordements */}
              <p className={`text-xl sm:text-2xl lg:text-3xl font-bold mt-2 break-words ${kpi.color}`}>
                {kpi.value}
              </p>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center">
              🏷️ Module : <span className="font-semibold ml-1 text-slate-700 dark:text-slate-300">{kpi.moduleName}</span>
            </p>
          </div>
        ))}
      </div>
    ) : (
      <div className="p-6 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center text-slate-500">
        Aucun module n'est activé. Allez dans vos paramètres pour lancer vos outils métier.
      </div>
    )}
  </div>
);
}
