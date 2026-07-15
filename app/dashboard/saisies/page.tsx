"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { db as baseDb } from "../../lib/db";

const db = baseDb as any;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

  // Authentification et fallback cache local
useEffect(() => {
  async function getAuth() {
    let activeUid: string | null = null;

    // 1. TENTATIVE SÉCURISÉE SUR SUPABASE
    try {
      if (navigator.onLine) {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!error && user) {
          activeUid = user.id;
          
          // Sauvegarde ou mise à jour de l'utilisateur en local pour le mode hors-ligne
          const { data: userData } = await supabase
            .from("utilisateurs")
            .select("nom_entreprise")
            .eq("id", user.id)
            .single();

          if (userData?.nom_entreprise) {
            setNomEntreprise(userData.nom_entreprise);
            await db.utilisateurs.put({
              id: user.id,
              nom_entreprise: userData.nom_entreprise
            });
          }
        }
      }
    } catch (netError) {
      console.log("Supabase Auth inaccessible (Mode hors-ligne), bascule sur Dexie...");
    }

    // 2. REPLI SUR DEXIE SI SUPABASE A ÉCHOUÉ OU SI ON EST HORS-LIGNE
    if (!activeUid) {
      try {
        const utilisateursLocaux = await db.utilisateurs.limit(1).toArray();
        if (utilisateursLocaux && utilisateursLocaux.length > 0) {
          activeUid = utilisateursLocaux[0].id;
          setNomEntreprise(utilisateursLocaux[0].nom_entreprise || "Mon Entreprise Locale");
          console.log("Utilisateur local récupéré depuis Dexie :", activeUid);
        }
      } catch (dexieError) {
        console.error("Impossible de lire la table utilisateurs dans Dexie", dexieError);
      }
    }

    // 3. ENREGISTREMENT DE L'ID UTILISATEUR RETROUVÉ
    if (activeUid) {
      setUserId(activeUid);
    }
  }

  getAuth();
}, []);

  // Chargement hybride (Dexie en priorité pour le mode hors-ligne)
  useEffect(() => {
    async function chargerDonnees() {
      try {
        // 1. Lire Dexie en premier (Garantit le fonctionnement déconnecté)
        const anneesLocales = await db.gs_annees_scolaires.toArray();
        setAnneesScolaires(anneesLocales);
        
        const classesLocales = await db.gs_classes.toArray();
        setClasses(classesLocales);

        if (currentModule === "school_paiement") {
          const inscriptionsLocales = await db.gs_inscriptions.where("utilisateur_id").equals(userId).toArray();
          const elevesLocaux = await db.gs_eleves.where("utilisateur_id").equals(userId).toArray();
          const paiementsLocaux = await db.gs_paiements.where("utilisateur_id").equals(userId).toArray();

          const UIComputed = inscriptionsLocales.map((ins: any) => {
          // Ajout du type (: any) sur chaque paramètre pour calmer le compilateur
          const cl = classesLocales.find((c: any) => c.id === ins.classe_id);
          const el = elevesLocaux.find((e: any) => e.id === ins.eleve_id);
          const pm = paiementsLocaux.filter((p: any) => p.inscription_id === ins.id);

          return {
            ...ins,
            // Utilisation d'une sécurité optionnelle (?.) au cas où la classe ou l'élève n'existe pas localement
            gs_classes: cl ? { nom: cl.nom } : null,
            gs_eleves: el ? { nom: el.nom, prenom: el.prenom } : null,
            gs_paiements: (pm || []).map((p: any) => ({ montant: p.montant }))
          };
        });

          setRawEleves((prev) => ({ ...prev, inscriptions: UIComputed }));
        }

        // 2. Si connecté : rafraîchir discrètement les options depuis le Cloud
        if (navigator.onLine) {
          const { data: annees } = await supabase.from("gs_annees_scolaires").select("*");
          if (annees) {
            await db.gs_annees_scolaires.bulkPut(annees.map((a: any) => ({ ...a, statut_synchro: "synchronise" })));
            setAnneesScolaires(annees);
          }
          const { data: cls } = await supabase.from("gs_classes").select("*");
          if (cls) {
            await db.gs_classes.bulkPut(cls.map((c: any) => ({ ...c, statut_synchro: "synchronise" })));
            setClasses(cls);
          }
        }
      } catch (err) {
        console.error("Erreur de chargement des options", err);
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
    let localData: any = { id: crypto.randomUUID(), utilisateur_id: userId, statut_synchro: "local" };

    try {
      switch (currentModule) {
        case "facture":
          tableName = "gf_factures";
          const total_ht = Number(formData.total_ht) || 0;
          localData = {
            ...localData,
            client_nom: formData.client_nom || "Client Comptant",
            total_ttc: total_ht,
            benefice_realise: total_ht - (total_ht * 0.75),
            statut: formData.statut || "payee",
            cree_le: new Date().toISOString()
          };
          await db[tableName].put(localData);
          break;

        case "stock":
          tableName = "gf_produits";
          localData = {
            ...localData,
            nom: formData.nom_produit,
            prix_achat: Number(formData.prix_achat) || 0,
            prix_vente: Number(formData.prix_vente) || 0,
            stock_actuel: Number(formData.stock_actuel) || 0,
            stock_alerte: Number(formData.stock_alerte) || 5,
          };
          await db[tableName].put(localData);
          break;

        case "school": {
          // --- ÉCRITURE COMBINÉE COMPATIBLE HORS-LIGNE ---
          const eleveId = crypto.randomUUID();
          const inscriptionId = crypto.randomUUID();

          const nouvelEleve = {
            id: eleveId,
            utilisateur_id: userId,
            nom: formData.nom_eleve?.toUpperCase(),
            prenom: formData.prenom_eleve,
            sexe: formData.sexe,
            date_naissance: formData.date_naissance || null,
            nom_parent: formData.nom_parent,
            telephone_parent: formData.telephone_parent,
            adresse: formData.adresse,
            statut_synchro: "local"
          };
          await db.gs_eleves.put(nouvelEleve);

          const nouvelleInscription = {
            id: inscriptionId,
            utilisateur_id: userId,
            annee_id: Number(formData.annee_id),
            eleve_id: eleveId,
            classe_id: Number(formData.classe_id),
            numero_matricule: formData.numero_matricule || null,
            scolarite_totale: Number(formData.scolarite_totale) || 0,
            reduction: Number(formData.reduction) || 0,
            statut_synchro: "local"
          };
          await db.gs_inscriptions.put(nouvelleInscription);

          const acompte = Number(formData.acompte) || 0;
          if (acompte > 0) {
            const nouveauPaiement = {
              id: crypto.randomUUID(),
              utilisateur_id: userId,
              inscription_id: inscriptionId,
              montant: acompte,
              mode_paiement: formData.mode_paiement || "Espèces",
              reference: formData.reference || null,
              statut_synchro: "local"
            };
            await db.gs_paiements.put(nouveauPaiement);
          }

          setStatus({ type: "success", text: "Élève inscrit localement ! Vos KPIs se synchroniseront au retour du réseau." });
          setFormData({});
          setTimeout(() => router.push("/dashboard"), 1500);
          return;
        }

        case "school_enseignant":
          tableName = "gs_enseignants";
          localData = {
            ...localData,
            nom: formData.nom_enseignant?.toUpperCase(),
            prenom: formData.prenom_enseignant,
            telephone: formData.telephone_enseignant,
            email: formData.email_enseignant,
            specialite: formData.specialite_enseignant,
          };
          await db[tableName].put(localData);
          break;

        case "school_paiement": {
          tableName = "gs_paiements";
          const montantPaiement = Number(formData.montant_paiement) || 0;
          if (montantPaiement <= 0) throw new Error("Le montant doit être supérieur à 0.");

          localData = {
            ...localData,
            inscription_id: formData.inscription_id,
            montant: montantPaiement,
            mode_paiement: formData.mode_paiement || "Espèces",
            reference: formData.reference || null,
          };
          await db[tableName].put(localData);
          break;
        }
      }

      setStatus({ type: "success", text: "Enregistrement local réussi ! En attente de synchronisation automatique." });
      setFormData({});
      // Tentative de poussée immédiate si le réseau fonctionne
      if (navigator.onLine) {
        const { declencherSynchronisation } = await import("../../hooks/useSync");
        declencherSynchronisation();
      }
    } catch (err: any) {
      setStatus({ type: "error", text: err.message || "Une erreur est survenue lors de l'enregistrement." });
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
          <button type="button" onClick={() => router.push("/dashboard")} className="w-1/3 py-3 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
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