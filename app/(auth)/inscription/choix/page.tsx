"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ChoixServicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId"); // Récupère l'ID depuis l'URL

  const [servicesSelectionnes, setServicesSelectionnes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Sécurité : Si aucun ID n'est présent, on redirige vers l'inscription
  useEffect(() => {
    if (!userId) {
      router.push("/inscription");
    }
  }, [userId, router]);

  const catalogueServices = [
    { id: "facture", title: "GreenFacture", desc: "Créer vos factures", icon: "💳" },
    { id: "stock", title: "GreenStock", desc: "Gérer votre stock", icon: "📦" },
    { id: "personnel", title: "GreenPersonnel", desc: "Gérer votre personnel", icon: "👥" },
    { id: "asset", title: "GreenAsset", desc: "Inventorier vos équipements", icon: "🚗" },
    { id: "data", title: "GreenData", desc: "Tableaux de bord Power BI", icon: "📊" },
    { id: "school", title: "GreenSchool", desc: "Gestion scolaire", icon: "🏫" },
  ];

  const toggleService = (id: string) => {
    setServicesSelectionnes((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSaveServices = async () => {
    if (servicesSelectionnes.length === 0) {
      setError("Veuillez sélectionner au moins un service pour continuer.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("utilisateurs")
        .update({ services_choisis: servicesSelectionnes })
        .eq("id", userId);

      if (updateError) throw updateError;

      if (servicesSelectionnes.includes("school")) {

    const currentYear = new Date().getFullYear();

    const libelle = `${currentYear}-${currentYear + 1}`;
    const date_debut = `${currentYear}-09-01`;
    const date_fin = `${currentYear + 1}-07-31`;

    // Création de l'année scolaire
    const { data: annee, error: anneeError } = await supabase
        .from("gs_annees_scolaires")
        .insert({
            utilisateur_id: userId,
            libelle,
            date_debut,
            date_fin,
            active: true,
        })
        .select()
        .single();

        if (anneeError) throw anneeError;

      const classes = [
      // Maternelle
      { nom: "Petite Section", niveau: "Maternelle" },
      { nom: "Moyenne Section", niveau: "Maternelle" },
      { nom: "Grande Section", niveau: "Maternelle" },

      // Primaire
      { nom: "CP1", niveau: "Primaire" },
      { nom: "CP2", niveau: "Primaire" },
      { nom: "CE1", niveau: "Primaire" },
      { nom: "CE2", niveau: "Primaire" },
      { nom: "CM1", niveau: "Primaire" },
      { nom: "CM2", niveau: "Primaire" },

      // Collège
      { nom: "6ème", niveau: "Collège" },
      { nom: "5ème", niveau: "Collège" },
      { nom: "4ème", niveau: "Collège" },
      { nom: "3ème", niveau: "Collège" },

      // Lycée
      { nom: "2nde", niveau: "Lycée" },
      { nom: "1ère", niveau: "Lycée" },
      { nom: "Terminale", niveau: "Lycée" },
    ];
        const { error: classesError } = await supabase
      .from("gs_classes")
      .insert(
        classes.map((classe) => ({
          utilisateur_id: userId,
          annee_id: annee.id,
          nom: classe.nom,
          niveau: classe.niveau,
        }))
      );

    if (classesError) throw classesError;
    }

      // Succès : On redirige vers l'écran de succès de l'inscription
      router.push("/inscription/succes");
    } catch (err: any) {
      setError("Erreur lors de l'enregistrement de vos applications.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">
            Personnalisez votre Suite
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">
            Sélectionnez les outils nécessaires pour votre entreprise. Votre tableau de bord s'adaptera automatiquement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalogueServices.map((service) => {
            const isChecked = servicesSelectionnes.includes(service.id);
            return (
              <div
                key={service.id}
                onClick={() => toggleService(service.id)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer select-none ${
                  isChecked
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 shadow-md"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <div className="text-3xl mb-3">{service.icon}</div>
                <h3 className="font-bold text-slate-900 dark:text-white">{service.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{service.desc}</p>
              </div>
            );
          })}
        </div>

        {error && <p className="text-red-600 text-sm text-center mt-4">{error}</p>}

        <div className="text-center mt-8">
          <button
            onClick={handleSaveServices}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-8 rounded-full transition-all disabled:opacity-50 shadow-lg"
          >
            {loading ? "Configuration de l'espace..." : "Activer mon espace personnalisé"}
          </button>
        </div>
      </div>
    </main>
  );
}
