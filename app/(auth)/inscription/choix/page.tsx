"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../utils/supabase";


interface ClassePreconfiguration {
  nom: string;
  niveau: string;
}

function ChoixServicesContent() {

  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");

  const [servicesSelectionnes, setServicesSelectionnes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ÉTATS POUR LA PERSONNALISATION DES CLASSES (MODULE SCHOOL)
  const [typeEcole, setTypeEcole] = useState<"general" | "universitaire">("general");
  const [listeClasses, setListeClasses] = useState<ClassePreconfiguration[]>([]);
  const [nouvelleClasseNom, setNouvelleClasseNom] = useState("");
  const [nouvelleClasseNiveau, setNouvelleClasseNiveau] = useState("");

  // Listes de départ par défaut
  const classesGeneralesParDefaut = [
    { nom: "Maternelle - PS", niveau: "Maternelle" },
    { nom: "Maternelle - MS", niveau: "Maternelle" },
    { nom: "Maternelle - GS", niveau: "Maternelle" },
    { nom: "Classe de CP", niveau: "Primaire" },
    { nom: "Classe de CE1", niveau: "Primaire" },
    { nom: "Classe de CE2", niveau: "Primaire" },
    { nom: "Classe de CM1", niveau: "Primaire" },
    { nom: "Classe de CM2", niveau: "Primaire" },
    { nom: "Classe de 6ème", niveau: "Collège" },
    { nom: "Classe de 3ème", niveau: "Collège" },
    { nom: "Classe de Terminale", niveau: "Lycée" },
  ];

  const classesUniversitairesParDefaut = [
    { nom: "Licence 1 - Tronc Commun", niveau: "Licence" },
    { nom: "Licence 2", niveau: "Licence" },
    { nom: "Licence 3", niveau: "Licence" },
    { nom: "Master 1", niveau: "Master" },
    { nom: "Master 2", niveau: "Master" },
    { nom: "Doctorat Année 1", niveau: "Doctorat" },
    { nom: "Doctorat Année 2", niveau: "Doctorat" },
  ];

  useEffect(() => {
    if (!userId) {
      router.push("/inscription");
    }
  }, [userId, router]);

  // Initialise ou change la liste préconfigurée selon le type d'école choisi
  useEffect(() => {
    if (servicesSelectionnes.includes("school")) {
      setListeClasses(
        typeEcole === "general" ? classesGeneralesParDefaut : classesUniversitairesParDefaut
      );
    } else {
      setListeClasses([]);
    }
  }, [typeEcole, servicesSelectionnes]);

  const catalogueServices = [
    { id: "facture", title: "GreenFacture", desc: "Créer vos factures", icon: "💳" },
    { id: "school", title: "GreenSchool", desc: "Gestion scolaire", icon: "🏫" },
  ];

  const toggleService = (id: string) => {
    setServicesSelectionnes((prev) => (prev.includes(id) ? [] : [id]));
  };

  // ACTIONS UTILISATEUR : Supprimer une classe de la pré-liste
  const removeClasse = (indexToRemove: number) => {
    setListeClasses((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // ACTIONS UTILISATEUR : Ajouter une classe personnalisée à la pré-liste
  const addClasseCustom = () => {
    if (!nouvelleClasseNom.trim() || !nouvelleClasseNiveau.trim()) return;
    setListeClasses((prev) => [
      ...prev,
      { nom: nouvelleClasseNom.trim(), niveau: nouvelleClasseNiveau.trim() },
    ]);
    setNouvelleClasseNom("");
    setNouvelleClasseNiveau("");
  };

  const handleSaveServices = async () => {
    if (servicesSelectionnes.length !== 1) {
      setError("Veuillez sélectionner un seul service pour continuer.");
      return;
    }

    if (servicesSelectionnes[0] === "school" && listeClasses.length === 0) {
      setError("Veuillez configurer au moins une classe pour votre établissement.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1. Mise à jour du profil utilisateur
      const { error: updateError } = await supabase
        .from("utilisateurs")
        .update({ services_choisis: servicesSelectionnes })
        .eq("id", userId);

      if (updateError) throw updateError;

      // 2. Traitement spécifique à GreenSchool
      if (servicesSelectionnes[0] === "school") {
        const currentYear = new Date().getFullYear();
        const libelle = `${currentYear}-${currentYear + 1}`;
        const date_debut = `${currentYear}-09-01`;
        const date_fin = `${currentYear + 1}-07-31`;

        // Récupération ou création de l'année scolaire
        const { data: existingAnnee } = await supabase
          .from("gs_annees_scolaires")
          .select("id")
          .eq("utilisateur_id", userId)
          .eq("libelle", libelle)
          .maybeSingle();

        let anneeId = existingAnnee?.id;

        if (!anneeId) {
          const { data: newAnnee, error: anneeError } = await supabase
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
          anneeId = newAnnee.id;
        }

        // Vérification si des classes existent déjà pour éviter les doublons
        const { data: existingClasses } = await supabase
          .from("gs_classes")
          .select("id")
          .eq("annee_id", anneeId)
          .limit(1);

        // Insertion de la liste sur mesure validée par l'utilisateur
        if (!existingClasses || existingClasses.length === 0) {
          const { error: classesError } = await supabase
            .from("gs_classes")
            .insert(
              listeClasses.map((classe) => ({
                utilisateur_id: userId,
                annee_id: anneeId,
                nom: classe.nom,
                niveau: classe.niveau,
              }))
            );

          if (classesError) throw classesError;
        }
      }

      router.push("/inscription/succes");
    } catch (err: any) {
      console.error("Erreur détaillée :", err);
      setError(err.message || "Erreur lors de l'enregistrement.");
    } finally {
      setLoading(false);
    }
  };

   return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Choisissez votre module</h2>
      
      {error && <div className="p-3 bg-red-100 text-red-700 rounded-xl text-sm font-medium">{error}</div>}

      {/* SÉLECTION DU MODULE */}
      <div className="grid grid-cols-2 gap-4">
        {catalogueServices.map((service) => {
          const isSelected = servicesSelectionnes.includes(service.id);
          return (
            <div
              key={service.id}
              onClick={() => toggleService(service.id)}
              className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                isSelected ? "border-green-500 bg-green-50/50 ring-2 ring-green-500/20" : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <div className="text-3xl mb-2">{service.icon}</div>
              <h3 className="font-bold text-slate-800 text-lg">{service.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{service.desc}</p>
            </div>
          );
        })}
      </div>

      {/* BLOC CONFIGURATION DYNAMIQUE DES CLASSES (Affiché uniquement si School est choisi) */}
      {servicesSelectionnes.includes("school") && (
        <div className="p-5 border border-gray-200 rounded-xl bg-gray-50/70 space-y-4 shadow-sm animate-fadeIn">
          <div className="border-b border-gray-200 pb-2">
            <h3 className="font-bold text-lg text-gray-800">🏫 Configuration de vos classes</h3>
            <p className="text-xs text-gray-500">Adaptez la structure selon votre modèle d'école.</p>
          </div>

          {/* Sélecteur de type d'établissement */}
          <div className="flex gap-6 bg-white p-3 rounded-xl border border-gray-100">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="type_ecole"
                checked={typeEcole === "general"}
                onChange={() => setTypeEcole("general")}
                className="w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300"
              />
              École Classique (Maternelle - Lycée)
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="type_ecole"
                checked={typeEcole === "universitaire"}
                onChange={() => setTypeEcole("universitaire")}
                className="w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300"
              />
              Centre Universitaire / Supérieur
            </label>
          </div>

          {/* Formulaire d'ajout rapide */}
          <div className="flex gap-2 bg-white p-2 rounded-xl border border-gray-200 shadow-inner">
            <input
              type="text"
              placeholder="Nom (ex: Master 1 Info, CM1 B...)"
              value={nouvelleClasseNom}
              onChange={(e) => setNouvelleClasseNom(e.target.value)}
              className="flex-1 text-sm p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
            <input
              type="text"
              placeholder="Niveau (ex: Licence, Primaire...)"
              value={nouvelleClasseNiveau}
              onChange={(e) => setNouvelleClasseNiveau(e.target.value)}
              className="w-1/3 text-sm p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
            <button
              type="button"
              onClick={addClasseCustom}
              className="px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition active:scale-95"
            >
              Ajouter
            </button>
          </div>

          {/* Liste modifiable des classes prêtes pour l'enregistrement */}
          <div className="max-h-60 overflow-y-auto space-y-1.5 bg-white p-3 rounded-xl border border-gray-200 shadow-inner">
            {listeClasses.map((classe, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-sm hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">{classe.nom}</span>
                  <span className="px-2 py-0.5 text-xs bg-slate-200 text-slate-600 font-medium rounded-full">
                    {classe.niveau}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeClasse(index)}
                  className="text-gray-400 hover:text-red-500 font-bold px-2 transition-colors duration-150"
                  title="Supprimer cette classe"
                >
                  ✕
                </button>
              </div>
            ))}
            {listeClasses.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-6">
                Aucune classe configurée. Ajoutez-en une manuellement ci-dessus.
              </p>
            )}
          </div>
        </div>
      )}

      {/* BOUTON DE VALIDATION DU FORMULAIRE */}
      <button
        onClick={handleSaveServices}
        disabled={loading}
        className="w-full py-3.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500 shadow-md hover:shadow-lg disabled:shadow-none transition-all duration-200 flex items-center justify-center gap-2 text-base active:scale-[0.99]"
      >
        {loading ? (
          <>
            <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            Initialisation en cours...
          </>
        ) : (
          "Confirmer mon choix et initialiser"
        )}
      </button>
    </div>
  );
}

// 🚨 LE FIX DE ROUTAGE POUR NEXT.JS
export default function InscriptionChoixPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 antialiased">
      <Suspense fallback={
        <div className="text-center py-10 text-sm font-medium text-slate-500 flex flex-col items-center gap-2">
          <span className="animate-spin inline-block w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full" />
          Chargement de la configuration...
        </div>
      }>
        <ChoixServicesContent />
      </Suspense>
    </div>
  );
}
