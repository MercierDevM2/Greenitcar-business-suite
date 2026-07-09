"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const AVAILABLE_MODULES = [
  { id: "facture", name: "GreenFacture", description: "...", icon: "💳", setupHref: "/dashboard/saisies?module=facture" },
  { id: "stock", name: "GreenStock", description: "...", icon: "📦", setupHref: "/dashboard/saisies?module=stock" },
  { id: "personnel", name: "GreenPersonnel", description: "...", icon: "👥", setupHref: "/dashboard/saisies?module=personnel" },
  { id: "asset", name: "GreenAsset", description: "...", icon: "🛡️", setupHref: "/dashboard/saisies?module=asset" },
  { id: "school", name: "GreenSchool", description: "...", icon: "🏫", setupHref: "/dashboard/saisies?module=school" },
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

  useEffect(() => {
    async function loadSettings() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data } = await supabase
          .from("utilisateurs")
          .select("services_choisis")
          .eq("id", user.id)
          .single();

        if (data?.services_choisis) {
          setActiveServices(data.services_choisis);
        }
      }
      setLoading(false);
    }
    loadSettings();
  }, []);

  const handleToggleService = (serviceId: string) => {
    setActiveServices((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSaveChanges = async () => {
    if (!userId) return;
    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from("utilisateurs")
      .update({ services_choisis: activeServices })
      .eq("id", userId);

    setSaving(false);
    if (error) {
      setMessage({ type: "error", text: "Erreur lors de la mise à jour des paramètres." });
    } else {
      setMessage({ type: "success", text: "Configuration enregistrée avec succès !" });
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
          Cochez un module pour l'ajouter à votre espace, puis cliquez sur le bouton de configuration pour insérer vos premières données.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AVAILABLE_MODULES.map((module) => {
            const isChecked = activeServices.includes(module.id);
            return (
              <div
                key={module.id}
                className={`p-5 rounded-xl border flex flex-col justify-between transition-all space-y-4 ${
                  isChecked
                    ? "border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleService(module.id)}
                    className="mt-1 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 border-slate-300"
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
                </label>

                {/* BOUTON D'ACTION DE CRÉATION ET D'INSERTION : Visible uniquement si coché */}
                {isChecked && (
                  <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex justify-between items-center animate-fadeIn">
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
