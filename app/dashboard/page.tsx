"use client";

import { useEffect, useState } from "react";
import { supabase } from "../utils/supabase";
import { useRouter } from "next/navigation";
import { db as baseDb } from "../lib/db";
// @ts-ignore
import { executionSynchronisationGlobale } from "../lib/syncService";
import LoaderOuvert from "../components/LoaderOuvert";

const db = baseDb as any;

interface KpiCard {
  title: string;
  value: string | number;
  moduleName: string;
  color: string;
}

// =========================================================================
// 🔄 LOGIQUE DE SYNCHRONISATION GLOBALE (DEXIE PENDING -> SUPABASE -> DEXIE CACHE)
// =========================================================================

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
  const [isInitialSync, setIsInitialSync] = useState<boolean>(true);

  const [rawFacturation, setRawFacturation] = useState({
    factures: [] as any[],
    produits: [] as any[],
    alertesStock: 0,
    valeurStock: 0,
    chiffreAffaires: 0,
    margeTotale: 0,
  });
  

  useEffect(() => {
  const initDashboard = async (): Promise<void> => {
    try {
      // 1. 🚨 RÉCUPÉRATION DE LA VRAIE SESSION SUPABASE
      const { data: { session }, error: authError } = await supabase.auth.getSession();//supabase.auth.getSession() vérifie la présence d'un jeton d'authentification sécurisé et chiffré stocké dans le navigateur.
      
      if (authError || !session?.user) {
        console.warn("⚠️ Aucune session active détectée, redirection...");
        router.push("/inscription");
        return;
      }

      // Extraction du véritable UUID de l'utilisateur
      const uid = session.user.id; 

      // 2. Récupération de l'année scolaire active associée à cet utilisateur sur Supabase
      const { data: anneeData } = await supabase
        .from("gs_annees_scolaires")
        .select("id")
        .eq("utilisateur_id", uid)
        .eq("active", true)
        .maybeSingle();

      if (!anneeData) {
        console.warn("⚠️ Aucune année scolaire active trouvée sur le serveur pour cet utilisateur.");
        setIsInitialSync(false);
        return;
      }

      const anneeId = String(anneeData.id);

      // Mise à jour sécurisée des variables d'état pour le reste du composant
      setUserId(uid);
      setCurrentAnnee(anneeId);

      // 3. 🚀 SYNCHRONISATION CRITIQUE : Lance le téléchargement des classes de ce VRAI utilisateur
      if (typeof window !== "undefined" && navigator.onLine) {
        await executionSynchronisationGlobale(uid, anneeId);
      }

      // 4. LECTURE DU CACHE : Remplissage immédiat de votre sélecteur de classes
      await loadSchoolData(uid, anneeId);
      await loadFactureData(uid);

    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("❌ Erreur d'initialisation du Dashboard :", err.message);
      }
    } finally {
      // Désactivation de l'écran de chargement
      setIsInitialSync(false);
    }
  };

  initDashboard();
}, [router]); // Ne dépend plus de userId pour éviter la boucle infinie de rendus




  const loadSchoolData = async (uid: string, anneeId: string) => {
  const parsedAnneeId = Number(anneeId);
  if (!uid || !anneeId || isNaN(parsedAnneeId)) {
    console.warn("⚠️ loadSchoolData annulé : uid ou anneeId invalide.", { uid, anneeId });
    return;
  }

  try {
    // 1. Récupération globale depuis Dexie
    const [
      inscriptionsLocales,
      elevesLocaux,
      paiementsLocaux,
      enseignantsLocaux,
      classesLocales,
    ] = await Promise.all([
      db["gs_inscriptions"].where("annee_id").equals(parsedAnneeId).toArray(),
      db["gs_eleves"].where("utilisateur_id").equals(uid).toArray(),
      db["gs_paiements"].where("utilisateur_id").equals(uid).toArray(),
      db["gs_enseignants"].where("utilisateur_id").equals(uid).toArray(),
      db["gs_classes"].where("utilisateur_id").equals(uid).toArray(),
    ]);

    // 2. 🔒 VERROUILLAGE DU CACHE : Seules les classes synchronisées avec le Cloud sont conservées
    const classesCache = classesLocales.filter(
      (c: any) => 
        c.annee_id === parsedAnneeId && 
        (c.statut_synchro === "synced" || c.statut_synchro === "synchronise")
    );
    
    // Verrouillage des enseignants synchronisés
    const enseignantsCache = enseignantsLocaux.filter(
      (e: any) => e.statut_synchro === "synced" || e.statut_synchro === "synchronise"
    );

    const classesMap = new Map(classesCache.map((c: any) => [c.id, c]));
    
    // Verrouillage des élèves synchronisés
    const elevesCacheMap = new Map(
      elevesLocaux
        .filter((e: any) => e.statut_synchro === "synced" || e.statut_synchro === "synchronise")
        .map((e: any) => [e.id, e])
    );

    // 3. Reconstitution des jointures (Inscriptions verrouillées sur le cache Cloud)
    const inscriptionsCache = inscriptionsLocales.map((ins: any) => {
      const cl = classesMap.get(ins.classe_id) as any;
      const el = elevesCacheMap.get(ins.eleve_id) as any;
      return {
        ...ins,
        gs_classes: cl ? { nom: cl.nom, niveau: cl.niveau } : null,
        gs_eleves: el ? { nom: el.nom, prenom: el.prenom } : null,
      };
    }).filter(
      (i: any) => 
        i.utilisateur_id === uid && 
        i.gs_eleves !== null && 
        (i.statut_synchro === "synced" || i.statut_synchro === "synchronise")
    );

    const idsCache = new Set<any>((inscriptionsCache || []).map((i: any) => i.id));
    
    // Verrouillage des paiements synchronisés associés
    const paiementsCache = paiementsLocaux.filter(
      (p: any) => 
        idsCache.has(p.inscription_id) && 
        (p.statut_synchro === "synced" || p.statut_synchro === "synchronise")
    );

    // Mettre à jour le sélecteur HTML du Dashboard uniquement avec les classes officielles
    setClasses(classesCache);

    // Injection dans l'état des KPIs (Figé sur la dernière connexion réussie)
    setRawEleves({
      inscriptions: inscriptionsCache, 
      paiements: paiementsCache,       
      enseignants: enseignantsCache.length, 
      classes: classesCache.length,     
    });

    console.log(`🔒 Cache School verrouillé : ${classesCache.length} classe(s) officielle(s) chargée(s).`);

  } catch (e) {
    console.error("Erreur lors de la lecture du cache School sur le Dashboard :", e);
  }
};




const loadFactureData = async (uid: string) => {
  try {
    // 1. Récupération globale depuis Dexie
    const [facturesLocales, produitsLocaux, itemsFacturesLocaux] = await Promise.all([
      db["gf_factures"].where("utilisateur_id").equals(uid).toArray(),
      db["gf_produits"].where("utilisateur_id").equals(uid).toArray(),
      db["gf_facture_items"] ? db["gf_facture_items"].where("utilisateur_id").equals(uid).toArray() : Promise.resolve([]),
    ]);

    // 🚨 RÈGLE STRICTE HORS-LIGNE : On supprime le statut "local" / "pending" pour geler le Dashboard
    const facturesCache = facturesLocales.filter(
      (f: any) => f.statut_synchro === "synced" || f.statut_synchro === "synchronise"
    );

    const produitsCache = produitsLocaux.filter(
      (p: any) => p.statut_synchro === "synced" || p.statut_synchro === "synchronise"
    );

    const itemsCache = itemsFacturesLocaux.filter(
      (i: any) => i.statut_synchro === "synced" || i.statut_synchro === "synchronise"
    );

    // 🔄 MAP DES QUANTITÉS SORTIES PAR PRODUIT (Uniquement sur données synchronisées)
    const quantitesSortiesMap = new Map<string, number>();
    itemsCache.forEach((item: any) => {
      const factureAssociee = facturesCache.find((f: any) => f.id === item.facture_id);

      if (factureAssociee) {
        const qteActuelle = quantitesSortiesMap.get(item.produit_id) || 0;
        quantitesSortiesMap.set(item.produit_id, qteActuelle + (Number(item.quantite) || 0));
      }
    });

    // 📊 CALCULS STOCKS AVEC DÉCOMPTE AUTOMATIQUE FIGÉ
    let alertesCount = 0;
    let totalValeurStock = 0;

    produitsCache.forEach((p: any) => {
      const qteSortie = quantitesSortiesMap.get(p.id) || 0;
      const stockDynamique = Math.max(0, (Number(p.stock_initial) || Number(p.stock_actuel) || 0) - qteSortie);

      if (stockDynamique <= (Number(p.stock_alerte) || 0)) {
        alertesCount++; // on incrémente le compteur d'alertes si le stock dynamique est inférieur ou égal au seuil d'alerte
      }
      totalValeurStock += (Number(p.prix_achat) || 0) * stockDynamique; // somme des prix d'achat * stock dynamique
    });

    // 💰 CALCULS FINANCIERS 
    const totalCA = facturesCache.reduce(
      (sum: number, f: any) => sum + (Number(f.total_ht) || 0),
      0
    );

    const totalMarge = facturesCache.reduce(
      (sum: number, f: any) => sum + (Number(f.benefice_realise) || 0),
      0
    );

    // Injection dans l'état comptable verrouillé du commerce
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
      
      // 🚨 DÉDUCTION DE LA RÉDUCTION : Calcul de la scolarité nette due par l'élève
      const scolariteBrute = Number(i.scolarite_totale || 0);
      const reductionAccordee = Number(i.reduction || 0);
      
      // La scolarité nette attendue ne peut pas être négative (sécurité Math.max)
      const totalDuEleveNet = Math.max(0, scolariteBrute - reductionAccordee);

      totalEncaisse += paye;
      totalAttendu += totalDuEleveNet; // Cumul basé sur la scolarité nette réelle

      // Un élève est à jour s'il a payé au moins sa scolarité nette
      const estAjour = paye >= totalDuEleveNet;

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

    // Reste à recouvrer calculé sur la base attendue nette
    const resteARecouvrer = Math.max(0, totalAttendu - totalEncaisse);

    const tauxRecouvrement =
      totalAttendu > 0
        ? ((totalEncaisse / totalAttendu) * 100).toFixed(1)
        : "0";

    // Calcul du panier moyen (scolarité moyenne par élève après réduction)
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
        title: "Scolarité Moyenne Nett",
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
