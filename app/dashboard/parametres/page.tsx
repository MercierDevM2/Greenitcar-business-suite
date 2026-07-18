"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";
import { useRouter } from "next/navigation";
import { db as baseDb } from "../../lib/db";

const db = baseDb as any;

const AVAILABLE_MODULES = [
  { 
    id: "facture", 
    name: "GreenFacture", 
    description: "Émettre vos factures clients et suivre vos ventes.", 
    icon: "💵", 
    setupHref: "/dashboard/saisies?module=facture" 
  }, 
  { 
    id: "facture_stock", 
    name: "GreenStock (Catalogue)", 
    description: "Ajouter des articles, gérer les seuils et valoriser votre stock.", 
    icon: "💳", 
    setupHref: "/dashboard/parametres/stock" 
  },
  { id: "personnel", name: "GreenPersonnel", description: "...", icon: "👥", setupHref: "/dashboard/saisies?module=personnel" },
  { id: "asset", name: "GreenAsset", description: "...", icon: "🛡️", setupHref: "/dashboard/saisies?module=asset" },
  { id: "school", name: "GreenSchool (Inscription)", description: "Inscription des élèves", icon: "🏫", setupHref: "/dashboard/saisies?module=school" },
  { 
    id: "school_enseignant", 
    name: "GreenSchool (Enseignants)", 
    description: "Enregistrement et gestion du corps enseignant.", 
    icon: "👨‍🏫", 
    setupHref: "/dashboard/saisies?module=school_enseignant" 
  },
  { id: "clinic", name: "GreenClinic", description: "...", icon: "🩺", setupHref: "/dashboard/saisies?module=clinic" },
  { id: "pointage", name: "GreenPointage", description: "...", icon: "⏱️", setupHref: "/dashboard/saisies?module=pointage" },
  { id: "data", name: "GreenData", description: "...", icon: "📈", setupHref: "/dashboard/saisies?module=data" },
  { id: "archive", name: "GreenArchive", description: "...", icon: "📁", setupHref: "/dashboard/saisies?module=archive" },
];

export default function ParametresPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeServices, setActiveServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ==========================================
  // 📥 CHARGEMENT EN RÉSILIENCE RESEAU (TRY/CATCH)
  // ==========================================
  useEffect(() => {
    async function loadSettings() {
      let activeUid: string | null = null;
      let servicesCloud: string[] = [];

      // Étape A : Tentative de récupération Cloud de la session
      try {
        if (typeof window !== "undefined" && navigator.onLine) {
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          if (!authError && user) {
            activeUid = user.id;
          }
        }
      } catch (networkError) {
        console.warn("⚠️ Supabase injoignable (Mode hors-ligne). Basculement local.");
      }

      // Étape B : Repli Session locale Dexie (En cas d'échec réseau)
      if (!activeUid) {
        try {
          const utilisateursLocaux = await db["utilisateurs"].limit(1).toArray();
          if (utilisateursLocaux && utilisateursLocaux.length > 0) {
            activeUid = utilisateursLocaux[0].id;
          }
        } catch (dexieError) {
          console.error("Erreur lecture session Dexie :", dexieError);
        }
      }

      // Étape C : Chargement de la configuration des modules
      if (activeUid) {
        setUserId(activeUid);

        try {
          if (typeof window !== "undefined" && navigator.onLine) {
            // Lecture Cloud
            const { data, error: selectError } = await supabase
              .from("utilisateurs")
              .select("services_choisis")
              .eq("id", activeUid)
              .single();

            if (!selectError && data?.services_choisis) {
              servicesCloud = data.services_choisis;
              setActiveServices(servicesCloud);
              // Aligner Dexie en tâche de fond
              await db["utilisateurs"].put({ id: activeUid, services_choisis: servicesCloud });
            }
          } else {
            // Lecture Cache local Dexie
            const configLocale = await db["utilisateurs"].where("id").equals(activeUid).first();
            if (configLocale?.services_choisis) {
              setActiveServices(configLocale.services_choisis);
            }
          }
        } catch (crudError) {
          console.error("Erreur de récupération des modules actifs :", crudError);
        }
      } else {
        router.push("/inscription");
      }
      setLoading(false);
    }
    loadSettings();
  }, [router]);

  // ==========================================
  // 💾 SAUVEGARDE EN DEUX ÉTAPES (DEXIE -> CLOUD OPTIONNEL)
  // ==========================================
  const handleSaveChanges = async () => {
    if (!userId) return;
    setSaving(true);
    setMessage(null);

    try {
      // 1. Sauvegarde instantanée dans Dexie (Reste accessible même sans réseau)
      const profilExistant = await db["utilisateurs"].where("id").equals(userId).first() || {};
      await db["utilisateurs"].put({
        ...profilExistant,
        id: userId,
        services_choisis: activeServices,
        statut_synchro: "local"
      });

      // 2. Si l'utilisateur est en ligne, on pousse immédiatement sur Supabase
      if (typeof window !== "undefined" && navigator.onLine) {
        const { error: cloudError } = await supabase
          .from("utilisateurs")
          .update({ services_choisis: activeServices })
          .eq("id", userId);

        if (cloudError) throw cloudError;
        
        // Mettre à jour le statut en validé
        await db["utilisateurs"].where("id").equals(userId).modify({ statut_synchro: "synced" });
      }

      setMessage({ type: "success", text: "Configuration enregistrée localement et synchronisée !" });
    } catch (error: any) {
      console.error("Erreur de sauvegarde :", error);
      setMessage({ 
        type: "error", 
        text: navigator.onLine 
          ? "Erreur lors de la mise à jour sur le serveur." 
          : "Sauvegardé localement. Les modules s'activeront sur le Cloud au retour du réseau." 
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Paramètres de la Suite</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
          Activez vos solutions métier et accédez à leur espace de configuration.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          🧩 Vos Applications Métier
        </h2>
        <p className="text-slate-500 text-xs mt-1 mb-6">
          Consultez vos modules actifs. Cliquez sur Commencer les saisies pour insérer vos données scolaires ou commerciales.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AVAILABLE_MODULES.map((module) => {
            let isChecked = false;
            if (module.id === "school_enseignant") {
              isChecked = activeServices.includes("school");
            } else if (module.id === "facture_stock") {
              isChecked = activeServices.includes("facture") || activeServices.includes("stock");
            } else {
              isChecked = activeServices.includes(module.id);
            }

            return (
              <div
                key={module.id}
                className={`p-5 rounded-xl border flex flex-col justify-between transition-all space-y-4 ${
                  isChecked
                    ? "border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                }`}
              >
                <div className="flex items-start gap-3 select-none">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled
                    readOnly
                    className="mt-1 rounded text-emerald-600 h-4 w-4 border-slate-300 cursor-not-allowed opacity-70"
                  />
                  <div>
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                      <span>{module.icon}</span>
                      <span>{module.name}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                      {module.description}
                    </p>
                  </div>
                </div>

                {isChecked && (
                  <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex justify-between items-center">
                    <span className="text-[11px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-0.5 rounded">
                      Module actif
                    </span>
                    <button
                      onClick={() => router.push(module.setupHref)}
                      className="text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                    >
                      🚀 Commencer les saisies →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Barre de validation globale */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
        <div>
          {message && (
            <p className={`text-sm font-semibold ${message.type === "success" ? "text-emerald-600" : "text-rose-600"}`}>
              {message.text}
            </p>
          )}
        </div>
        <button
          onClick={handleSaveChanges}
          disabled={saving}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors flex items-center gap-2"
        >
          {saving ? "Enregistrement..." : "Enregistrer la sélection"}
        </button>
      </div>
    </div>
  );
}
