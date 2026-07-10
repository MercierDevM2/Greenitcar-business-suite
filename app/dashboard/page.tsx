"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

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
});


const loadSchoolData = async (userId: string, anneeId: string) => {
  // 1. Inscriptions de l'année
  const { data: inscriptions } = await supabase
    .from("gs_inscriptions")
    .select(`
      id,
      scolarite_totale,
      classe_id,
      gs_classes ( nom, niveau )
    `)
    .eq("utilisateur_id", userId)
    .eq("annee_id", anneeId);

  const inscriptionIds = inscriptions?.map(i => i.id) || [];

  // 2. Paiements (Uniquement liés aux inscriptions de cette année)
  let paiements: any[] = [];
  if (inscriptionIds.length > 0) {
    const { data: paiementsData } = await supabase
      .from("gs_paiements")
      .select("inscription_id, montant")
      .eq("utilisateur_id", userId)
      .in("inscription_id", inscriptionIds); 
    
    paiements = paiementsData || [];
  }

  // Enseignants
  const { count: enseignants } = await supabase
    .from("gs_enseignants")
    .select("*", { count: "exact", head: true })
    .eq("utilisateur_id", userId);

  // Classes
  const { count: classes } = await supabase
    .from("gs_classes")
    .select("*", { count: "exact", head: true })
    .eq("utilisateur_id", userId)
    .eq("annee_id", anneeId);

  const { data: listeClasses } = await supabase
  .from("gs_classes")
  .select("id, nom")
  .eq("utilisateur_id", userId)
  .eq("annee_id", anneeId)
  .order("niveau")
  .order("nom");
setClasses(listeClasses || []);

  setRawEleves({
  inscriptions: inscriptions || [],
  paiements: paiements || [],
  enseignants: enseignants || 0,
  classes: classes || 0,
});

};

const loadFactureData = async (userId: string) => {
  // 1. Récupérer toutes les factures du commerçant
  const { data: factures } = await supabase
    .from("gf_factures")
    .select("id, total_ht, total_ttc, benefice_realise, statut")
    .eq("utilisateur_id", userId);

  // 2. Récupérer le catalogue complet de produits pour valoriser le stock
  const { data: produits } = await supabase
    .from("gf_produits")
    .select("id, prix_achat, stock_actuel, stock_alerte")
    .eq("utilisateur_id", userId);

  // 3. Compter les articles en alerte de stock
  const alertesCount = produits?.filter(p => Number(p.stock_actuel) <= Number(p.stock_alerte)).length || 0;

  setRawFacturation({
    factures: factures || [],
    produits: produits || [],
    alertesStock: alertesCount,
  });
};


  // 1. Chargement initial des données Supabase
  useEffect(() => {
    async function buildSmartDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setLoading(false);
      setUserId(user.id);

      const { data: userData } = await supabase
        .from("utilisateurs")
        .select("services_choisis")
        .eq("id", user.id)
        .single();
      
      const services: string[] = userData?.services_choisis || [];
      setActiveServices(services);

      let dynamicKpis: KpiCard[] = [];

      // -- GREENFACTURE --
      if (services.includes("facture") || services.includes("stock")) {
        const { data: factData } = await supabase.from("gf_factures").select("benefice_realise").eq("utilisateur_id", user.id);
        const { count: lowStock } = await supabase.from("gf_produits").select("*", { count: "exact", head: true }).eq("utilisateur_id", user.id).lt("stock_actuel", "stock_alerte");
        
        const totalBenef = factData?.reduce((sum, f) => sum + (Number(f.benefice_realise) || 0), 0) || 0;

        if (services.includes("facture") || services.includes("stock")) {
          await loadFactureData(user.id);
        }
        if (services.includes("stock")) {
          dynamicKpis.push({ title: "Articles en alerte stock", value: lowStock || 0, moduleName: "GreenStock", color: "text-amber-600" });
        }
      }

      // -- GREENPERSONNEL --
      if (services.includes("personnel")) {
        const { count: staff } = await supabase.from("gp_employes").select("*", { count: "exact", head: true }).eq("utilisateur_id", user.id);
        dynamicKpis.push({ title: "Effectif Total", value: staff || 0, moduleName: "GreenPersonnel", color: "text-blue-600" });
      }

      // -- GREENASSET --
      if (services.includes("asset")) {
        const { count: assets } = await supabase.from("ga_patrimoine").select("*", { count: "exact", head: true }).eq("utilisateur_id", user.id);
        const { count: broken } = await supabase.from("ga_patrimoine").select("*", { count: "exact", head: true }).eq("utilisateur_id", user.id).eq("statut_maintenance", "En panne");
        
        dynamicKpis.push({ title: "Équipements Inventoriés", value: assets || 0, moduleName: "GreenAsset", color: "text-slate-700" });
        dynamicKpis.push({ title: "Matériels en Panne", value: broken || 0, moduleName: "GreenAsset", color: "text-rose-600" });
      }

      // -- GREENCLINIC --
      if (services.includes("clinic")) {
        const { count: consults } = await supabase.from("gc_patients_consultations").select("*", { count: "exact", head: true }).eq("utilisateur_id", user.id).eq("type_evenement", "consultation_terminee");
        dynamicKpis.push({ title: "Consultations Effectuées", value: consults || 0, moduleName: "GreenClinic", color: "text-cyan-600" });
      }

      // -- GREENPOINTAGE --
      if (services.includes("pointage")) {
        const { count: lates } = await supabase.from("gpt_pointages").select("*", { count: "exact", head: true }).eq("utilisateur_id", user.id).eq("est_en_retard", true).eq("date_jour", new Date().toISOString().split('T')[0]);
        dynamicKpis.push({ title: "Retards Aujourd'hui", value: lates || 0, moduleName: "GreenPointage", color: "text-orange-600" });
      }

      // -- GREENDATA & ARCHIVE --
      if (services.includes("data") || services.includes("archive")) {
        const { count: totalDocs } = await supabase.from("gd_missions_archives").select("*", { count: "exact", head: true }).eq("utilisateur_id", user.id);
        dynamicKpis.push({ title: "Éléments Traités / Sécurisés", value: totalDocs || 0, moduleName: "Business Data", color: "text-violet-600" });
      }

     // -- GREENSCHOOL--
    if (services.includes("school")) {

      const { data: listeAnnees } = await supabase
        .from("gs_annees_scolaires")
        .select("id, libelle, active")
        .eq("utilisateur_id", user.id)
        .order("date_debut", { ascending: false });

      if (listeAnnees?.length) {
        setAnnees(listeAnnees);

        const active =
          listeAnnees.find((a) => a.active) || listeAnnees[0];

        setCurrentAnnee(active.id);

        await loadSchoolData(user.id, active.id);
      }
    }
      
      setKpis(dynamicKpis);
      setLoading(false);
    }

    buildSmartDashboard();
  }, []);
  
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

    // Filtre par classe (si utilisé)
   const filteredInscriptions = inscriptions.filter((i: any) => {
  if (currentClasse === "toutes") return true;

   return Number(i.classe_id) === Number(currentClasse);
});

    const totalInscrits = filteredInscriptions.length;

    const totalAttendu = filteredInscriptions.reduce(
      (sum: number, i: any) => sum + Number(i.scolarite_totale || 0),
      0
    );

    // Total payé par inscription
    const paiementsParInscription: Record<number, number> = {};

    paiements.forEach((p: any) => {
      paiementsParInscription[p.inscription_id] =
        (paiementsParInscription[p.inscription_id] || 0) +
        Number(p.montant || 0);
    });

    let totalEncaisse = 0;
    let elevesAjour = 0;
    let elevesDebiteurs = 0;

    filteredInscriptions.forEach((i: any) => {
      const paye = paiementsParInscription[i.id] || 0;

      totalEncaisse += paye;

      if (paye >= Number(i.scolarite_totale)) {
        elevesAjour++;
      } else {
        elevesDebiteurs++;
      }
    });

    const resteARecouvrer = totalAttendu - totalEncaisse;

    const tauxRecouvrement =
      totalAttendu > 0
        ? ((totalEncaisse / totalAttendu) * 100).toFixed(1)
        : "0";

    const panierMoyen =
      totalInscrits > 0
        ? Math.round(totalAttendu / totalInscrits)
        : 0;

    const schoolKpis = [
      {
        title: "Élèves inscrits",
        value: totalInscrits,
        moduleName: "GreenSchool",
        color: "text-purple-600",
      },
      {
        title: "Enseignants",
        value: rawEleves.enseignants,
        moduleName: "GreenSchool",
        color: "text-blue-600",
      },
      {
        title: "Classes",
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
        title: "Scolarité moyenne",
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
}, [currentClasse, rawEleves, activeServices, loading]);

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
    if (aActiveFacture) {
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
    if (aActiveStock) {
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
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Vos Indicateurs Clés</h1>
        <p className="text-slate-500 text-sm mt-1">Vue d'ensemble en temps réel de vos modules actifs.</p>
      </div>
      
      {/* BOUTON D'ACTION RAPIDE POUR LA FACTURATION */}
      {activeServices.includes("facture") && (
        <button
          onClick={() => router.push("/dashboard/saisies?module=facture")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors self-start sm:self-center"
        >
          ➕ Nouvelle Facture
        </button>
      )}

      {/* Regroupement des filtres si le module school est actif */}
      {activeServices.includes("school") && (
        <div className="flex flex-wrap items-center gap-4">
          {/* Filtre Année */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              📅 Année
            </label>
            <select
              value={currentAnnee}
              onChange={(e) => setCurrentAnnee(e.target.value)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
            >
              {annees.map((annee: any) => (
                <option key={annee.id} value={annee.id}>
                  {annee.libelle}
                </option>
              ))}
            </select>
          </div>

          {/* Filtre Classe réintégré au bon endroit */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              🏫 Classe
            </label>
            <select
              value={currentClasse}
              onChange={(e) => setCurrentClasse(e.target.value)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
            >
              <option value="toutes">Toutes les classes</option>
              {classes.map((classe: any) => (
                <option key={classe.id} value={classe.id}>
                  {classe.nom}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
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
