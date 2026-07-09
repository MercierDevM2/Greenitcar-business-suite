"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

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
  const [activeServices, setActiveServices] = useState<string[]>([]);
  const [kpis, setKpis] = useState<KpiCard[]>([]);
  const [rawEleves, setRawEleves] = useState<any[]>([]); 
  const [currentSchoolFilter, setCurrentSchoolFilter] = useState("tous");
  const [loading, setLoading] = useState(true);

  // 1. Chargement initial des données Supabase
  useEffect(() => {
    async function buildSmartDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setLoading(false);

      const { data: userData } = await supabase
        .from("utilisateurs")
        .select("services_choisis")
        .eq("id", user.id)
        .single();
      
      const services: string[] = userData?.services_choisis || [];
      setActiveServices(services);

      let dynamicKpis: KpiCard[] = [];

      // -- GREENFACTURE & STOCK --
      if (services.includes("facture") || services.includes("stock")) {
        const { data: factData } = await supabase.from("gf_factures").select("benefice_realise").eq("utilisateur_id", user.id);
        const { count: lowStock } = await supabase.from("gf_produits").select("*", { count: "exact", head: true }).eq("utilisateur_id", user.id).lt("stock_actuel", "stock_alerte");
        
        const totalBenef = factData?.reduce((sum, f) => sum + (Number(f.benefice_realise) || 0), 0) || 0;

        if (services.includes("facture")) {
          dynamicKpis.push({ title: "Bénéfice Réalisé", value: `${totalBenef.toLocaleString('fr-FR')} FCFA`, moduleName: "GreenFacture", color: "text-emerald-600" });
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

      // -- GREENSCHOOL (Récupération brute) --
      if (services.includes("school")) {
        const { data: eleves } = await supabase
          .from("gs_eleves")
          .select("scolarite_totale, scolarite_payee, classe")
          .eq("utilisateur_id", user.id);
        
        setRawEleves(eleves || []);
      }

      setKpis(dynamicKpis);
      setLoading(false);
    }

    buildSmartDashboard();
  }, []);

    // 2. Filtrage intelligent, flexible et enrichi au clic
  useEffect(() => {
    if (loading) return;

    setKpis((prevKpis) => {
      // Nettoyer les anciens KPIs école pour éviter les doublons
      const sansSchool = prevKpis.filter(kpi => kpi.moduleName !== "GreenSchool");
      if (!activeServices.includes("school")) return sansSchool;

      // Filtrer la liste locale en mémoire selon la classe sélectionnée
      const filteredEleves = rawEleves.filter(e => {
        if (currentSchoolFilter === "tous") return true;
        if (!e.classe) return false;

        const subClasses = currentSchoolFilter.split("/").map(str => str.trim().toUpperCase());
        const studentClass = e.classe.trim().toUpperCase();

        return subClasses.includes(studentClass) || studentClass.includes(currentSchoolFilter.toUpperCase());
      });

      // ---- CALCULS COMPTABLES TRADITIONNELS ----
      const totalInscrits = filteredEleves.length;
      const totalAttendu = filteredEleves.reduce((sum, e) => sum + (Number(e.scolarite_totale) || 0), 0);
      const totalEncaisse = filteredEleves.reduce((sum, e) => sum + (Number(e.scolarite_payee) || 0), 0);
      const resteARecouvrer = totalAttendu - totalEncaisse;
      const tauxRecouvrement = totalAttendu > 0 ? ((totalEncaisse / totalAttendu) * 100).toFixed(1) : 0;

      // ---- NOUVEAUX CALCULS STRATÉGIQUES (VALEUR AJOUTÉE SaaS) ----
      
      // A. Calcul du panier moyen (Scolarité moyenne par élève)
      const panierMoyen = totalInscrits > 0 ? Math.round(totalAttendu / totalInscrits) : 0;

      // B. Filtrage des élèves totalement à jour (scolarite_payee >= scolarite_totale)
      const elevesAjour = filteredEleves.filter(e => Number(e.scolarite_payee) >= Number(e.scolarite_totale)).length;

      // C. Filtrage des élèves débiteurs (scolarite_payee < scolarite_totale)
      const elevesDebiteurs = filteredEleves.filter(e => Number(e.scolarite_payee) < Number(e.scolarite_totale)).length;


      // ---- SÉLECTION DES KPIS À AFFICHER ----
      const schoolKpis = [
        { title: "Élèves Inscrits", value: totalInscrits, moduleName: "GreenSchool", color: "text-purple-600" },
        { title: "Scolarités Encaissées", value: `${totalEncaisse.toLocaleString('fr-FR')} FCFA`, moduleName: "GreenSchool", color: "text-emerald-600" },
        { title: "Reste à Recouvrer", value: `${resteARecouvrer.toLocaleString('fr-FR')} FCFA`, moduleName: "GreenSchool", color: "text-rose-600" },
        { title: "Taux de Recouvrement", value: `${tauxRecouvrement} %`, moduleName: "GreenSchool", color: "text-indigo-600" },
        
        // Ajout des nouvelles cartes stratégiques dans la grille
        { title: "Scolarité Moyenne", value: `${panierMoyen.toLocaleString('fr-FR')} FCFA`, moduleName: "GreenSchool", color: "text-slate-600" },
        { title: "Élèves en Règle", value: `${elevesAjour} inscrits`, moduleName: "GreenSchool", color: "text-teal-600" },
        { title: "Élèves Débiteurs", value: `${elevesDebiteurs} en retard`, moduleName: "GreenSchool", color: "text-amber-600" }
      ];

      return [...sansSchool, ...schoolKpis];
    });

  }, [currentSchoolFilter, rawEleves, activeServices, loading]);


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

        {activeServices.includes("school") && (
          <div className="flex flex-wrap bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs font-semibold self-start lg:self-center gap-1">
            {[
              { id: "tous", label: "🏫 Global" },
              { id: "CI / CP", label: "👶 Maternelle/CP" },
              { id: "CE1 / CE2", label: "👦 Élémentaire" },
              { id: "CM1 / CM2", label: "🎒 CM1/CM2" },
              { id: "6ème / 5ème / 4ème / 3ème", label: "📐 Collège" },
              { id: "Seconde / Première / Terminale", label: "🎓 Lycée" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentSchoolFilter(tab.id)}
                className={`px-3 py-2 rounded-lg transition-all ${
                  currentSchoolFilter === tab.id
                    ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grille unifiée de tous les KPIs */}
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
