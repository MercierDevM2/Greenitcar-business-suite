"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 1. Le composant fonctionnel contenant votre logique
function SaisieFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentModule = searchParams.get("module") || "facture";
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEleveName, setSelectedEleveName] = useState("");


  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [nomEntreprise, setNomEntreprise] = useState<string>("Mon Entreprise");
  const [formData, setFormData] = useState<any>({});
  const [anneesScolaires, setAnneesScolaires] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [rawEleves, setRawEleves] = useState({
    inscriptions: [] as any[],
    paiements: [] as any[],
    enseignants: 0,
    classes: 0,
  });

  // Unification des hooks useEffect d'authentification pour éviter les doubles appels
  useEffect(() => {
    async function getAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);

        // Récupération du nom de l'entreprise depuis la table "utilisateurs"
        const { data: userData } = await supabase
          .from("utilisateurs")
          .select("nom_entreprise")
          .eq("id", user.id)
          .single();

        if (userData?.nom_entreprise) {
          setNomEntreprise(userData.nom_entreprise);
        }
      }
    }
    getAuth();
  }, []);

useEffect(() => {
  async function chargerDonnees() {
    try {
      // 1. Chargement des options de configuration générale
      const { data: annees } = await supabase.from("gs_annees_scolaires").select("*");
      if (annees) setAnneesScolaires(annees);
      
      const { data: cls } = await supabase.from("gs_classes").select("*");
      if (cls) setClasses(cls);

      // 2. SÉCURISÉ & FUSIONNÉ : Chargement unique avec toutes les colonnes requises
      if (currentModule === "school_paiement") {
        const { data: inscriptionsData, error: insError } = await supabase
          .from("gs_inscriptions")
          .select(`
            id,
            scolarite_totale,  
            reduction,         
            numero_matricule,
            gs_classes ( nom ),
            gs_eleves ( nom, prenom ),
            gs_paiements ( montant ) 
          `)
          .eq("utilisateur_id", userId);

        if (insError) throw insError;

        // On hydrate une seule fois l'état avec les bonnes données financières
        setRawEleves((prev) => ({
          ...prev,
          inscriptions: inscriptionsData || [],
        }));
      }

    } catch (err) {
      console.error("Erreur de chargement des options et élèves", err);
    }
  }

  if (userId) chargerDonnees();
}, [userId, currentModule]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    setStatus(null);

    let tableName = "";
    let dataToInsert: any = { utilisateur_id: userId };

    try {
      switch (currentModule) {
        case "facture":
          tableName = "gf_factures";
          const total_ht = Number(formData.total_ht) || 0;
          const total_ttc = total_ht; 
          const estimation_achat = total_ht * 0.75; 
          
          dataToInsert = {
            ...dataToInsert,
            client_nom: formData.client_nom || "Client Comptant",
            total_ht,
            total_ttc,
            benefice_realise: total_ttc - estimation_achat,
            statut: formData.statut || "payee", 
          };
          break;

        case "stock":
          tableName = "gf_produits";
          dataToInsert = {
            ...dataToInsert,
            nom: formData.nom_produit,
            prix_achat: Number(formData.prix_achat) || 0,
            prix_vente: Number(formData.prix_vente) || 0,
            stock_actuel: Number(formData.stock_actuel) || 0,
            stock_alerte: Number(formData.stock_alerte) || 5,
          };
          break;

        case "personnel":
          tableName = "gp_employes";
          dataToInsert = {
            ...dataToInsert,
            nom: formData.nom,
            prenom: formData.prenom,
            statut_contrat: formData.statut_contrat || "CDI",
          };
          break;

        case "asset":
          tableName = "ga_patrimoine";
          dataToInsert = {
            ...dataToInsert,
            num_inventaire: `INV-${Date.now().toString().slice(-6)}`,
            nom_equipement: formData.nom_equipement,
            categorie: formData.categorie || "Ordinateur",
            affectation: formData.affectation,
            statut_maintenance: "Operationnel",
          };
          break;

        case "school": {
          const { data: eleve, error: eleveError } = await supabase
              .from("gs_eleves")
              .insert({
                  utilisateur_id: userId,
                  nom: formData.nom_eleve?.toUpperCase(),
                  prenom: formData.prenom_eleve,
                  sexe: formData.sexe,
                  date_naissance: formData.date_naissance || null,
                  nom_parent: formData.nom_parent,
                  telephone_parent: formData.telephone_parent,
                  adresse: formData.adresse,
              })
              .select()
              .single();

          if (eleveError) throw eleveError;

          const { data: inscription, error: inscriptionError } = await supabase
              .from("gs_inscriptions")
              .insert({
                  utilisateur_id: userId,
                  annee_id: Number(formData.annee_id),
                  eleve_id: eleve.id,
                  classe_id: Number(formData.classe_id),
                  numero_matricule: formData.numero_matricule || null,
                  scolarite_totale: Number(formData.scolarite_totale) || 0,
                  reduction: Number(formData.reduction) || 0,
              })
              .select()
              .single();

          if (inscriptionError) throw inscriptionError;

          const acompte = Number(formData.acompte) || 0;

          if (acompte > 0) {
              const { error: paiementError } = await supabase
                  .from("gs_paiements")
                  .insert({
                      utilisateur_id: userId,
                      inscription_id: inscription.id,
                      montant: acompte,
                      mode_paiement: formData.mode_paiement || "Espèces",
                      reference: formData.reference || null,
                  });

              if (paiementError) throw paiementError;
          }

          setStatus({ type: "success", text: "Élève inscrit avec succès ! Vos KPIs sont à jour." });
          setFormData({});
          setTimeout(() => router.push("/dashboard"), 1500);
          return;
        }

        case "school_enseignant": {
          tableName = "gs_enseignants";
          dataToInsert = {
            ...dataToInsert,
            nom: formData.nom_enseignant?.toUpperCase(),
            prenom: formData.prenom_enseignant,
            telephone: formData.telephone_enseignant,
            email: formData.email_enseignant,
            specialite: formData.specialite_enseignant,
          };
          break;
        }

        case "school_paiement": {
    const montantPaiement = Number(formData.montant_paiement) || 0;

    if (montantPaiement <= 0) {
      throw new Error("Le montant du paiement doit être supérieur à 0.");
    }

    const { error: paiementScolariteError } = await supabase
    .from("gs_paiements")
    .insert({
      utilisateur_id: userId,
      inscription_id: formData.inscription_id, // L'ID de l'inscription sélectionnée
      montant: montantPaiement,
      mode_paiement: formData.mode_paiement || "Espèces",
      reference: formData.reference || null,
      type_paiement: "scolarite", // Permet de le différencier de l'acompte d'inscription
      observation: formData.observation || "Paiement tranche scolarité",
      date_paiement: new Date().toISOString(),
    });

  if (paiementScolariteError) throw paiementScolariteError;

  setStatus({ type: "success", text: "Paiement de scolarité enregistré ! Vos KPIs sont mis à jour." });
  setFormData({});
  setTimeout(() => router.push("/dashboard"), 1500);
  return;
}


        case "clinic":
          tableName = "gc_patients_consultations";
          dataToInsert = {
            ...dataToInsert,
            patient_nom: formData.patient_nom,
            type_evenement: "consultation_terminee",
            montant_encaisse: Number(formData.montant_encaisse) || 0,
          };
          break;

        case "pointage":
          tableName = "gpt_pointages";
          dataToInsert = {
            ...dataToInsert,
            employe_nom_complet: formData.employe,
            est_en_retard: formData.retard === "oui",
            heures_sup: Number(formData.heures_sup) || 0,
          };
          break;

        case "data":
        case "archive":
          tableName = "gd_missions_archives";
          dataToInsert = {
            ...dataToInsert,
            type_service: currentModule === "data" ? "data_project" : "document_archive",
            valeur_ou_taille: formData.valeur || "1",
          };
          break;
      }

      const { error } = await supabase.from(tableName).insert([dataToInsert]);
      if (error) throw error;

      setStatus({ type: "success", text: "Donnée enregistrée avec succès ! Vos KPIs sont à jour." });
      setFormData({});
      setTimeout(() => router.push("/dashboard"), 1500);

    } catch (err: any) {
      setStatus({ type: "error", text: err.message || "Erreur lors de la sauvegarde." });
    } finally {
      setSaving(false);
    }
  };
return (
    <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm">
      <div className="mb-6">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md">
          Saisie Module : Green{currentModule.charAt(0).toUpperCase() + currentModule.slice(1)}
        </span>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-3">Ajouter un enregistrement</h1>
        <h2 className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mt-1">
          {nomEntreprise} — {currentModule.charAt(0).toUpperCase() + currentModule.slice(1)}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        
         {/* ==================== CONFIGURATION COMPTABILITÉ : GREENFACTURE ==================== */}
      {currentModule === "facture" && (
        <div className="space-y-6">
          {/* Conteneur Facture Style "Papier" */}
          <div id="section-facture-imprimable" className="p-6 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 shadow-inner space-y-6">
            
            {/* En-tête Facture */}
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">FACTURE DE VENTE</h2>
                <p className="text-xs text-slate-400 mt-1">Date: {new Date().toLocaleDateString('fr-FR')}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-400">
                  N° FACT-{(Date.now().toString().slice(-6))}
                </span>
              </div>
            </div>

            {/* Informations Client */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Nom du client / Entreprise *
              </label>
              <input
                type="text"
                name="client_nom"
                required
                value={formData.client_nom || ""}
                onChange={handleInputChange}
                placeholder="ex: Client Comptant, Société X"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

             {/* AJOUT : Désignation de l'article acheté */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Désignation de l'article acheté *
              </label>
              <input
                type="text"
                name="designation_produit"
                required
                value={formData.designation_produit || ""}
                onChange={handleInputChange}
                placeholder="ex: iPhone 14 Pro, Souris Logitech USB, PC HP EliteBook"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Détails du Montant */}
            <div className="border-t border-dashed border-slate-200 dark:border-slate-800 pt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Montant Total de la vente (HT) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    name="total_ht"
                    required
                    value={formData.total_ht || ""}
                    onChange={handleInputChange}
                    placeholder="ex: 250000"
                    className="w-full pl-4 pr-16 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    FCFA
                  </span>
                </div>
              </div>

              {/* Bloc de Ventilation Financière Automatique */}
              {Number(formData.total_ht) > 0 && (
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-xl space-y-2 text-sm animate-fadeIn">
                  <div className="flex justify-between text-slate-500">
                    <span>Montant HT :</span>
                    <span className="font-mono">{(Number(formData.total_ht)).toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>TVA Estimée (20%) :</span>
                    <span className="font-mono">{(Number(formData.total_ht) * 0.2).toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-slate-100 dark:border-slate-800 pt-2 text-slate-900 dark:text-white text-base">
                    <span>Total à Payer (TTC) :</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                      {(Number(formData.total_ht) * 1.2).toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Paramètres de validation de la transaction */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Mode de règlement & Statut
              </label>
              <select
                name="statut"
                value={formData.statut || "payee"}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="payee">Payée au comptant (Espèces / Mobile Money)</option>
                <option value="en_attente">En attente de paiement (Facture proforma / Crédit)</option>
              </select>
            </div>

          </div>

          {/* Bouton d'Impression Direct de l'Aperçu Écran */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => window.print()}
              className="text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 border border-slate-200 dark:border-slate-700/60 shadow-sm"
            >
              🖨️ Imprimer cet aperçu client
            </button>
          </div>
        </div>
      )}

               {/* FORMULAIRE GREENPERSONNEL */}
        {currentModule === "personnel" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Nom</label>
                <input required type="text" name="nom" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Prénom</label>
                <input required type="text" name="prenom" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Type de Contrat</label>
              <select name="statut_contrat" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm">
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="Stage">Stage / Mission ONG</option>
              </select>
            </div>
          </>
        )}

        {/* FORMULAIRE GREENASSET */}
        {currentModule === "asset" && (
          <>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Désignation du matériel patrimoine</label>
              <input required type="text" name="nom_equipement" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" placeholder="Groupe électrogène 15kVA, Ordinateur HP..." />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Catégorie</label>
              <select name="categorie" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm">
                <option value="Ordinateur">Matériel Informatique</option>
                <option value="Vehicule">Véhicule / Moto</option>
                <option value="Groupe Electrogene">Générateur / Énergie</option>
                <option value="Mobilier">Mobilier Bureau</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Affectation / Service responsable</label>
              <input type="text" name="affectation" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" placeholder="Logistique, Direction, Antenne Nord" />
            </div>
          </>
        )}

      {/* FORMULAIRE GREENSCHOOL */}
      {currentModule === "school" && (
        <>
          {/* Informations élève */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">
                Nom(s)
              </label>
              <input
                required
                type="text"
                name="nom_eleve"
                onChange={handleInputChange}
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">
                Prénom(s)
              </label>
              <input
                required
                type="text"
                name="prenom_eleve"
                onChange={handleInputChange}
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">
                Sexe
              </label>
              <select
                name="sexe"
                onChange={handleInputChange}
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800"
              >
                <option value="">Choisir</option>
                <option value="Masculin">Masculin</option>
                <option value="Féminin">Féminin</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">
                Date de naissance
              </label>
              <input
                type="date"
                name="date_naissance"
                onChange={handleInputChange}
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">
              Nom du parent / Tuteur
            </label>
            <input
              type="text"
              name="nom_parent"
              onChange={handleInputChange}
              className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">
              Téléphone du parent
            </label>
            <input
              type="text"
              name="telephone_parent"
              onChange={handleInputChange}
              placeholder="+236..."
              className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">
              Adresse
            </label>
            <input
              type="text"
              name="adresse"
              onChange={handleInputChange}
              placeholder="Quartier"
              className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800"
            />
          </div>

          <hr className="my-5" />

          {/* Inscription */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">
                Année scolaire
              </label>
              <select
                required
                name="annee_id"
                onChange={handleInputChange}
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800"
              >
                <option value="">Sélectionner</option>

                {anneesScolaires.map((annee) => (
                  <option key={annee.id} value={annee.id}>
                    {annee.libelle}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">
                Classe
              </label>
              <select
                required
                name="classe_id"
                onChange={handleInputChange}
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800"
              >
                <option value="">Sélectionner</option>

                {classes.map((classe) => (
                  <option key={classe.id} value={classe.id}>
                    {classe.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">
              Numéro matricule
            </label>
            <input
              type="text"
              name="numero_matricule"
              onChange={handleInputChange}
              className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">
                 Scolarité Annuelle
              </label>
              <input
                required
                type="number"
                name="scolarite_totale"
                onChange={handleInputChange}
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Réduction / Remise (FCFA)
              </label>
              <input
                type="number"
                name="reduction"
                onChange={handleInputChange}
                placeholder="Ex: 50000 (0 si aucune)"
                defaultValue={0}
                min={0} // Évite de saisir des réductions négatives
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>
          </div>

          <hr className="my-5" />

          {/* Paiement */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">
                Acompte versé
              </label>
              <input
                type="number"
                name="acompte"
                defaultValue={0}
                onChange={handleInputChange}
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">
                Mode de paiement
              </label>
              <select
                name="mode_paiement"
                onChange={handleInputChange}
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800"
              >
                <option value="Espèces">Espèces</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="Virement">Virement</option>
                <option value="Chèque">Chèque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">
              Référence du paiement
            </label>
            <input
              type="text"
              name="reference"
              placeholder="Ex: Chèque N°12345, Transfert Wave, Espèces..."
              onChange={handleInputChange}
              className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800"
            />
          </div>
        </>
      )}

      {/* FORMULAIRE GREEN_SCHOOL : ENSEIGNANTS */}
        {currentModule === "school_enseignant" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Nom de l'enseignant *
                </label>
                <input
                  type="text"
                  name="nom_enseignant"
                  required
                  value={formData.nom_enseignant || ""}
                  onChange={handleInputChange}
                  placeholder="ex: NOM"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Prénom de l'enseignant *
                </label>
                <input
                  type="text"
                  name="prenom_enseignant"
                  required
                  value={formData.prenom_enseignant || ""}
                  onChange={handleInputChange}
                  placeholder="ex: Prénom"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Numéro de Téléphone *
              </label>
              <input
                type="tel"
                name="telephone_enseignant"
                required
                value={formData.telephone_enseignant || ""}
                onChange={handleInputChange}
                placeholder="ex: +236..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Adresse Email
              </label>
              <input
                type="email"
                name="email_enseignant"
                value={formData.email_enseignant || ""}
                onChange={handleInputChange}
                placeholder="ex: enseignant@ecole.com"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Spécialité / Matière enseignée
              </label>
              <select
                name="specialite_enseignant"
                value={formData.specialite_enseignant || ""}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Sélectionnez une spécialité</option>
                <option value="Maternelle (Maternelle)">Généraliste (Maternelle)</option>
                <option value="Généraliste (Primaire)">Généraliste (Primaire)</option>
                <option value="Mathématiques">Mathématiques</option>
                <option value="Français / Lettres">Français / Lettres</option>
                <option value="Histoire-Géographie">Histoire-Géographie</option>
                <option value="Sciences (SVT/Physique)">Sciences (SVT / Physique)</option>
                <option value="Anglais">Anglais</option>
                <option value="Éducation Physique (EPS)">Éducation Physique (EPS)</option>
              </select>
            </div>
          </div>
        )}
       {/* 2. Encaisser une tranche de scolarité */}
          {currentModule === "school_paiement" && (
            <>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                Encaisser une tranche de scolarité
              </h3>
              
              {/* 1. Sélection de l'élève avec filtre de recherche de texte */}
              <div className="relative mb-4">
                <label className="block text-sm font-semibold mb-2">Sélectionner l'élève *</label>
                
                {/* Champ texte cliquable qui sert de filtre */}
                <input
                  type="text"
                  placeholder="Nom, prénom, matricule..."
                  value={searchQuery}
                  onChange={(e) => {
                    const valeur = e.target.value;
                    setSearchQuery(valeur);
                    // CORRECTION : On n'ouvre la liste QUE s'il y a plus de 1 caractère tapé
                    if (valeur.trim().length >= 2) {
                      setIsOpen(true);
                    } else {
                      setIsOpen(false);
                    }
                  }}
                  // CORRECTION UX : Au focus, on n'ouvre plus la liste automatiquement si c'est vide
                  onFocus={() => {
                    if (searchQuery.trim().length >= 2) {
                      setIsOpen(true);
                    }
                  }}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />

                {/* Liste déroulante flottante (ne s'affiche que si isOpen est vrai ET qu'on a saisi assez de lettres) */}
                {isOpen && searchQuery.trim().length >= 2 && (
                  <>
                    <ul className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl divide-y divide-slate-100 dark:divide-slate-800">
                      {rawEleves.inscriptions &&
                      rawEleves.inscriptions.filter((ins: any) => {
                        const nom = ins.gs_eleves?.nom || "";
                        const prenom = ins.gs_eleves?.prenom || "";
                        const matricule = ins.numero_matricule || "";
                        const nomComplet = `${nom} ${prenom} ${matricule}`.toLowerCase().trim();
                        return nomComplet.includes(searchQuery.toLowerCase().trim());
                      }).length > 0 ? (
                        rawEleves.inscriptions
                          .filter((ins: any) => {
                            const nom = ins.gs_eleves?.nom || "";
                            const prenom = ins.gs_eleves?.prenom || "";
                            const matricule = ins.numero_matricule || "";
                            const nomComplet = `${nom} ${prenom} ${matricule}`.toLowerCase().trim();
                            return nomComplet.includes(searchQuery.toLowerCase().trim());
                          })
                          .map((ins: any) => {
                            const netAPayer = (Number(ins.scolarite_totale) || 0) - (Number(ins.reduction) || 0);
                            const totalDejaPaye = ins.gs_paiements?.reduce((sum: number, p: any) => sum + (Number(p.montant) || 0), 0) || 0;
                            const resteAPayer = netAPayer - totalDejaPaye;

                            return (
                              <li
                                key={ins.id}
                                onClick={() => {
                                  setFormData({ 
                                    ...formData, 
                                    inscription_id: ins.id,
                                    reste_a_payer_max: resteAPayer 
                                  });
                                  setSearchQuery(`${ins.gs_eleves?.nom || ""} ${ins.gs_eleves?.prenom || ""} (${ins.gs_classes?.nom || "Sans classe"})`);
                                  setIsOpen(false);
                                }}
                                className="px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer flex justify-between items-center transition-colors"
                              >
                                <div>
                                  <span className="font-semibold">{ins.gs_eleves?.nom || "NOM"}</span> {ins.gs_eleves?.prenom || "Prénom"}
                                  <span className="block text-xs text-slate-400">Classe : {ins.gs_classes?.nom || "Non spécifiée"}</span>
                                </div>
                                
                                <div className="text-right">
                                  {resteAPayer <= 0 ? (
                                    <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-1 rounded-lg font-bold">
                                      Scolarité Soldée
                                    </span>
                                  ) : (
                                    <span className="text-xs bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 px-2.5 py-1 rounded-lg font-bold">
                                      Reste : {resteAPayer.toLocaleString("fr-FR")} FCFA
                                    </span>
                                  )}
                                </div>
                              </li>
                            );
                          })
                      ) : (
                        <li className="px-4 py-3 text-sm text-slate-500 text-center italic">
                          Aucun élève trouvé pour cette recherche
                        </li>
                      )}
                    </ul>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                  </>
                )}
              </div>

    {/* 2. Montant versé */}
    <div className="mb-4">
      <label className="block text-sm font-semibold mb-2">Montant du versement (FCFA) *</label>
      <input
        type="number"
        name="montant_paiement"
        required
        placeholder="Ex: 50000"
        onChange={handleInputChange}
        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
      />
    </div>

    {/* 3. Mode de paiement */}
    <div className="mb-4">
      <label className="block text-sm font-semibold mb-2">Mode de paiement</label>
      <select
        name="mode_paiement"
        onChange={handleInputChange}
        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
      >
        <option value="Espèces">Espèces</option>
        <option value="Chèque">Chèque</option>
        <option value="Mobile Money">Mobile Money (Wave, Orange, MTN...)</option>
        <option value="Virement">Virement Bancaire</option>
      </select>
    </div>

    {/* 4. Référence / Justificatif */}
    <div className="mb-4">
      <label className="block text-sm font-semibold mb-2">Référence du paiement (Optionnel)</label>
      <input
        type="text"
        name="reference"
        placeholder="Ex: N° Chèque, ID Transaction"
        onChange={handleInputChange}
        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
      />
    </div>

    {/* 5. Date du paiement */}
    <div className="mb-4">
      <label className="block text-sm font-semibold mb-2">Date du paiement *</label>
      <input
        type="date"
        name="date_paiement"
        required
        value={formData.date_paiement || new Date().toISOString().split('T')[0]}
        onChange={handleInputChange}
        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
      />
    </div>
  </>
)}

        {/* FORMULAIRE GREENCLINIC */}
        {currentModule === "clinic" && (
          <>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Nom complet du Patient</label>
              <input required type="text" name="patient_nom" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" placeholder="Mamadou Diallo" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Frais de Consultation Encaissés</label>
              <input required type="number" name="montant_encaisse" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" placeholder="10000" />
            </div>
          </>
        )}

        {/* FORMULAIRE GREENPOINTAGE */}
        {currentModule === "pointage" && (
          <>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Employé concerné</label>
              <input required type="text" name="employe" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" placeholder="Saisir le nom de l'agent" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">En Retard ?</label>
                <select name="retard" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm">
                  <option value="non">Non (À l'heure)</option>
                  <option value="oui">Oui (En retard)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Heures Sup.</label>
                <input type="number" name="heures_sup" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" placeholder="0" />
              </div>
            </div>
          </>
        )}

        {/* FORMULAIRE GREENDATA & ARCHIVE */}
        {(currentModule === "data" || currentModule === "archive") && (
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">
              {currentModule === "data" ? "Budget du projet d'analyse (FCFA)" : "Nombre de documents archivés"}
            </label>
            <input required type="text" name="valeur" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" placeholder="Ex: 500000 ou 45" />
          </div>
        )}

        {/* Feedback Statut */}
        {status && (
          <p className={`text-sm font-semibold p-3 rounded-xl ${status.type === "success" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
            {status.text}
          </p>
        )}

        {/* Boutons d'actions */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.push("/dashboard/parametres")} className="w-1/3 py-3 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="w-2/3 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-sm transition-all">
            {saving ? "Enregistrement..." : "Confirmer l'insertion"}
          </button>
        </div>
      </form>
      {status && (
        <p className={`mt-4 p-2 rounded text-center ${status.type === "success" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}
// 2. L'exportation par défaut enveloppée dans un Suspense Boundary requis par Next 16
export default function SaisieFormPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center">Chargement du module...</div>}>
      <SaisieFormContent />
    </Suspense>
  );
}