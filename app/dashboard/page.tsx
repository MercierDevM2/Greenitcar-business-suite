"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { db as baseDb } from "../lib/db";

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

  // ==========================================
  // 🏫 SÉCURISATION HYBRIDE : LOAD SCHOOL DATA
  // ==========================================
  const loadSchoolData = async (uid: string, anneeId: string) => {
    try {
      let inscriptions: any[] = [];
      let paiements: any[] = [];
      let listeEnseignants: any[] = [];
      let listeClasses: any[] = [];
      let classesCount = 0;

      if (navigator.onLine) {
        const { data: insData } = await supabase
          .from("gs_inscriptions")
          .select("id, scolarite_totale, classe_id, numero_matricule, gs_classes ( nom, niveau ), gs_eleves ( nom, prenom, telephone_parent, nom_parent )")
          .eq("utilisateur_id", uid)
          .eq("annee_id", anneeId);
        inscriptions = insData || [];

        const inscriptionIds = inscriptions.map(i => i.id);
        if (inscriptionIds.length > 0) {
          const { data: paiementsData } = await supabase
            .from("gs_paiements")
            .select("inscription_id, montant")
            .eq("utilisateur_id", uid)
            .in("inscription_id", inscriptionIds);
          paiements = paiementsData || [];
        }

        const { data: profData } = await supabase.from("gs_enseignants").select("id, nom, prenom, telephone, specialite").eq("utilisateur_id", uid);
        listeEnseignants = profData || [];

        const { count } = await supabase.from("gs_classes").select("*", { count: "exact", head: true }).eq("utilisateur_id", uid).eq("annee_id", anneeId);
        classesCount = count || 0;

        const { data: clsData } = await supabase.from("gs_classes").select("id, nom").eq("utilisateur_id", uid).eq("annee_id", anneeId).order("nom");
        listeClasses = clsData || [];
      } else {
        listeClasses = await db["gs_classes"].where("annee_id").equals(Number(anneeId)).toArray();
        classesCount = listeClasses.length;

        const inscriptionsLocales = await db["gs_inscriptions"].where("annee_id").equals(Number(anneeId)).toArray();
        const elevesLocaux = await db["gs_eleves"].where("utilisateur_id").equals(uid).toArray();
        const paiementsLocaux = await db["gs_paiements"].where("utilisateur_id").equals(uid).toArray();
        listeEnseignants = await db["gs_enseignants"].where("utilisateur_id").equals(uid).toArray();

        inscriptions = inscriptionsLocales.map((ins: any) => {
          const cl = listeClasses.find((c: any) => c.id === ins.classe_id);
          const el = elevesLocaux.find((e: any) => e.id === ins.eleve_id);
          return {
            ...ins,
            gs_classes: cl ? { nom: cl.nom, niveau: cl.niveau } : null,
            gs_eleves: el ? { nom: el.nom, prenom: el.prenom, telephone_parent: el.telephone_parent, nom_parent: el.nom_parent } : null
          };
        });

        const insIds = inscriptions.map(i => i.id);
        paiements = paiementsLocaux.filter((p: any) => insIds.includes(p.inscription_id));
      }

      setClasses(listeClasses || []);
      setRawEleves({
        inscriptions: inscriptions,
        paiements: paiements,
        enseignants: listeEnseignants.length,
        classes: classesCount,
      });
    } catch (e) {
      console.error("Erreur de chargement des données scolaires", e);
    }
  };

  // ==========================================
  // 💳 SÉCURISATION HYBRIDE : LOAD FACTURE DATA
  // ==========================================
  const loadFactureData = async (uid: string) => {
    try {
      let factures: any[] = [];
      let produits: any[] = [];

      if (navigator.onLine) {
        const { data: facData } = await supabase.from("gf_factures").select("id, total_ht, total_ttc, benefice_realise, statut").eq("utilisateur_id", uid);
        factures = facData || [];

        const { data: prodData } = await supabase.from("gf_produits").select("id, prix_achat, stock_actuel, stock_alerte").eq("utilisateur_id", uid);
        produits = prodData || [];
      } else {
        factures = await db["gf_factures"].where("utilisateur_id").equals(uid).toArray();
        produits = await db["gf_produits"].where("utilisateur_id").equals(uid).toArray();
      }

      const alertesCount = produits.filter(p => Number(p.stock_actuel) <= Number(p.stock_alerte)).length || 0;
      const totalValeurStock = produits.reduce((sum, p) => sum + (Number(p.prix_achat) || 0) * (Number(p.stock_actuel) || 0), 0) || 0;
      const totalCA = factures.reduce((sum, f) => sum + (Number(f.total_ht) || 0), 0) || 0;
      const totalMarge = factures.reduce((sum, f) => sum + (Number(f.benefice_realise) || 0), 0) || 0;

      setRawFacturation({
        factures: factures,
        produits: produits,
        alertesStock: alertesCount,
        valeurStock: totalValeurStock,
        chiffreAffaires: totalCA,
        margeTotale: totalMarge,
      });

      return { alertesCount, totalValeurStock, totalCA, totalMarge };
    } catch (e) {
      console.error(e);
      return { alertesCount: 0, totalValeurStock: 0, totalCA: 0, totalMarge: 0 };
    }
  };

  // ==========================================
  // 📊 CALCUL ET AGREGATION DES COMPTEURS (SORTIE DE L'EFFET)
  // ==========================================
  const calculerKpisLocaux = useCallback(async (uid: string, activeServices: string[]) => {
    let localKpis: KpiCard[] = [];

    // -- GREENFACTURE & GREENSTOCK --
    if (activeServices.includes("facture") || activeServices.includes("stock")) {
      // Déclenche le chargement et récupère les calculs frais
      const dataCommerce = await loadFactureData(uid);

      if (activeServices.includes("facture")) {
        localKpis.push({ 
          title: "Chiffre d'Affaires HT", 
          value: `${dataCommerce.totalCA.toLocaleString()} FCFA`, 
          moduleName: "GreenFacture", 
          color: "text-emerald-600" 
        });
        localKpis.push({ 
          title: "Marge brute réalisée", 
          value: `${dataCommerce.totalMarge.toLocaleString()} FCFA`, 
          moduleName: "GreenFacture", 
          color: "text-sky-600" 
        });
      }

      if (activeServices.includes("stock")) {
        localKpis.push({ 
          title: "Valeur du Stock (Achat)", 
          value: `${dataCommerce.totalValeurStock.toLocaleString()} FCFA`, 
          moduleName: "GreenStock", 
          color: "text-indigo-600" 
        });
        localKpis.push({ 
          title: "Articles en alerte stock", 
          value: dataCommerce.alertesCount, 
          moduleName: "GreenStock", 
          color: "text-rose-600" 
        });
      }
    }

    // --- MODULE RESSOURCES HUMAINES (GREENPERSONNEL) ---
    if (activeServices.includes("personnel")) {
      let staffCount = 0;
      if (navigator.onLine) {
        const { count } = await supabase.from("gp_employes").select("*", { count: "exact", head: true }).eq("utilisateur_id", uid);
        staffCount = count || 0;
      } else {
        staffCount = await (db as any)["gp_employes"].where("utilisateur_id").equals(uid).count();
      }
      localKpis.push({ title: "Effectif Total", value: staffCount, moduleName: "GreenPersonnel", color: "text-blue-600" });
    }

    // -- GREENASSET --
    if (activeServices.includes("asset")) {
      let assetsCount = 0;
      let brokenCount = 0;

      if (navigator.onLine) {
        const { count: assets } = await supabase.from("ga_patrimoine").select("*", { count: "exact", head: true }).eq("utilisateur_id", uid);
        const { count: broken } = await supabase.from("ga_patrimoine").select("*", { count: "exact", head: true }).eq("utilisateur_id", uid).eq("statut_maintenance", "En panne");
        assetsCount = assets || 0;
        brokenCount = broken || 0;
      } else {
        assetsCount = await (db as any)["ga_patrimoine"].where("utilisateur_id").equals(uid).count();
        brokenCount = await (db as any)["ga_patrimoine"].where("utilisateur_id").equals(uid).filter((item: any) => item.statut_maintenance === "En panne").count();
      }
      
      localKpis.push({ title: "Équipements Inventoriés", value: assetsCount, moduleName: "GreenAsset", color: "text-slate-700" });
      localKpis.push({ title: "Matériels en Panne", value: brokenCount, moduleName: "GreenAsset", color: "text-rose-600" });
    }

    // -- GREENCLINIC --
    if (activeServices.includes("clinic")) {
      let consultsCount = 0;
      if (navigator.onLine) {
        const { count: consults } = await supabase.from("gc_patients_consultations").select("*", { count: "exact", head: true }).eq("utilisateur_id", uid).eq("type_evenement", "consultation_terminee");
        consultsCount = consults || 0;
      } else {
        consultsCount = await (db as any)["gc_patients_consultations"].where("utilisateur_id").equals(uid).filter((item: any) => item.type_evenement === "consultation_terminee").count();
      }
      localKpis.push({ title: "Consultations Effectuées", value: consultsCount, moduleName: "GreenClinic", color: "text-cyan-600" });
    }

    // -- GREENPOINTAGE --
    if (activeServices.includes("pointage")) {
      let latesCount = 0;
      const dateDuJour = new Date().toISOString().split('T')[0];

      if (navigator.onLine) {
        const { count: lates } = await supabase.from("gpt_pointages").select("*", { count: "exact", head: true }).eq("utilisateur_id", uid).eq("est_en_retard", true).eq("date_jour", dateDuJour);
        latesCount = lates || 0;
      } else {
        latesCount = await (db as any)["gpt_pointages"].where("utilisateur_id").equals(uid).filter((item: any) => item.est_en_retard === true && item.date_jour === dateDuJour).count();
      }
      localKpis.push({ title: "Retards Aujourd'hui", value: latesCount, moduleName: "GreenPointage", color: "text-orange-600" });
    }

    // -- GREENDATA & ARCHIVE --
    if (activeServices.includes("data") || activeServices.includes("archive")) {
      let totalDocsCount = 0;
      if (navigator.onLine) {
        const { count: totalDocs } = await supabase.from("gd_missions_archives").select("*", { count: "exact", head: true }).eq("utilisateur_id", uid);
        totalDocsCount = totalDocs || 0;
      } else {
        totalDocsCount = await (db as any)["gd_missions_archives"].where("utilisateur_id").equals(uid).count();
      }
      localKpis.push({ title: "Éléments Traités / Sécurisés", value: totalDocsCount, moduleName: "Business Data", color: "text-violet-600" });
    }

       // -- GREENSCHOOL --
    if (activeServices.includes("school")) {
      let listeAnnees: any[] = [];

      if (navigator.onLine) {
        const { data } = await supabase
          .from("gs_annees_scolaires")
          .select("id, libelle, active")
          .eq("utilisateur_id", uid)
          .order("id", { ascending: false });
        listeAnnees = data || [];
      } else {
        listeAnnees = await (db as any)["gs_annees_scolaires"].where("utilisateur_id").equals(uid).toArray();
      }

      if (listeAnnees && listeAnnees.length > 0) {
        setAnnees(listeAnnees);
        const active = listeAnnees.find((a: any) => a.active) || listeAnnees[0];
        setCurrentAnnee(active.id.toString());
        
        // 🌟 Correction : Conversion en string pour correspondre au typage de loadSchoolData
        await loadSchoolData(uid, active.id.toString());
      }
    }
    
    // 🌟 Écriture définitive dans votre état React principal pour afficher les cartes
    setKpis(localKpis);
  }, [loadSchoolData]); // 🌟 Fermeture propre du useCallback de calculerKpisLocaux


  
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

    // Le panier moyen se base sur les élèves de la classe sélectionnée
    const totalInscritsClasse = inscriptionsParClasse.length;
    const panierMoyen =
      totalInscritsClasse > 0
        ? Math.round(totalAttendu / totalInscritsClasse)
        : 0;

    const schoolKpis = [
      {
        title: "Nombre élèves",
        value: totalInscritsAffiches,
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
  if (loading) return;

  setKpis((prevKpis) => {
    // On nettoie les anciens KPIs liés à la vente pour éviter les doublons
    const sansVente = prevKpis.filter(
      (kpi) => kpi.moduleName !== "GreenFacture" && kpi.moduleName !== "GreenStock"
    );

    const aActiveFacture = activeServices.includes("facture");
    const aActiveStock = activeServices.includes("stock");

    if (!aActiveFacture && !aActiveStock) return sansVente;

    const factures = rawFacturation.factures || [];
    const produits = rawFacturation.produits || [];

    // --- CALCULS FINANCIERS ---
    const chiffreAffaires = factures.reduce((sum, f) => sum + (Number(f.total_ttc) || 0), 0);
    const beneficeTotal = factures.reduce((sum, f) => sum + (Number(f.benefice_realise) || 0), 0);
    const facturesImpayees = factures.filter(f => f.statut === "en_attente").length;

    // --- CALCULS DU STOCK (Valorisation) ---
    // Prix d'achat total du stock disponible en magasin (Capital immobilisé)
    const valeurStockAchat = produits.reduce((sum, p) => sum + (Number(p.prix_achat) * Number(p.stock_actuel)), 0);

    const venteKpis = [];

        // KPIs dédiés à la Facturation / Caisse
    // Affiché si l'un ou l'autre est activé
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
    // Affiché aussi dès que l'un des deux services est actif
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
          value: rawFacturation.alertesStock,
          moduleName: "GreenStock",
          color: "text-amber-600",
        }
      );
    }

    return [...sansVente, ...venteKpis];
  });
}, [rawFacturation, activeServices, loading]);


  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
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
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors"
          >
            ➕ Nouvelle Facture
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

    {/* Grille unifiée de tous les KPIs (Reste identique à votre code) */}
    {kpis.length > 0 ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <div key={index} className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{kpi.title}</p>
              <p className={`text-3xl font-bold mt-2 ${kpi.color}`}>{kpi.value}</p>
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
