"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../utils/supabase";
import { db as baseDb } from "../../lib/db";
import { executionSynchronisationGlobale } from "../../lib/syncService"; 
import { Special_Elite } from "next/font/google";

const db = baseDb as any;



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

  const [articlesCatalogue, setArticlesCatalogue] = useState<any[]>([]);

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

        // 📦 CHARGEMENT SPÉCIFIQUE DU CATALOGUE POUR GREENFACTURE
if (currentModule === "facture") {
  const prodsLocaux = await db.gf_produits.where("utilisateur_id").equals(userId).toArray();
  const filtrés = prodsLocaux.filter((p: any) => 
    !p.statut_synchro || ["synced", "synchronise", "local"].includes(p.statut_synchro)
  );
  setArticlesCatalogue(filtrés);

  // 🎯 CALCUL DES ALERTES DE STOCK INITIALES
  const alertesInitiales = filtrés.filter((p: any) => {
    const stock = Number(p.stock_actuel) || 0;
    const seuil = Number(p.stock_alerte) || 0;
    return stock <= seuil;
  }).length;

  const facturesLocales = await db.gf_factures.where("utilisateur_id").equals(userId).toArray();

  // 🔥 SOLUTION TECHNIQUE : On injecte les données dans l'état fonctionnel du composant
  if (typeof setRawEleves === "function") {
    setRawEleves((prev: any) => ({
      ...prev,
      factures: facturesLocales || [],
      produits: filtrés,
      alertesStock: `${alertesInitiales} article(s)`
    }));
  }
}



        if (currentModule === "school_paiement") {
          const inscriptionsLocales = await db.gs_inscriptions.where("utilisateur_id").equals(userId).toArray();
          const elevesLocaux = await db.gs_eleves.where("utilisateur_id").equals(userId).toArray();
          const paiementsLocaux = await db.gs_paiements.where("utilisateur_id").equals(userId).toArray();

          const UIComputed = inscriptionsLocales.map((ins: any) => {
            const cl = classesLocales.find((c: any) => c.id === ins.classe_id);
            const el = elevesLocaux.find((e: any) => e.id === ins.eleve_id);
            const pm = paiementsLocaux.filter((p: any) => p.inscription_id === ins.id);

            return {
              ...ins,
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

      const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    setStatus(null);

    // 🎯 Solution : On force la reconnaissance du type HTMLFormElement
const target = e.target as HTMLFormElement;
const currentForm = new FormData(target);

    
   const getFormVal = (name: string, fallback: string = "") => {
    const value = currentForm.get(name);
    return value ? String(value).trim() : fallback;
  };


    let tableName = "";
    const idNumeriqueUnique = () => Number(`${Date.now()}${Math.floor(Math.random() * 100)}`);
    
    let localData: any = { 
      id: idNumeriqueUnique(), 
      utilisateur_id: userId, 
      statut_synchro: "local" 
    };

    try {
            switch (currentModule) {

               case "facture": {
          tableName = "gf_factures"; 
          
          const factureId = crypto.randomUUID();
          const totalHtCalculé = Number(getFormVal("total_ht")) || 0;
          const quantiteVendue = Number(getFormVal("quantite")) || 1;
          const prodId = getFormVal("produit_id");

          // Calcul de la marge brute automatique
          const produitConcerne = articlesCatalogue.find((p: any) => String(p.id) === String(prodId));
          const prixAchatUnitaire = produitConcerne ? Number(produitConcerne.prix_achat) : 0;
          const beneficeRealise = totalHtCalculé - (prixAchatUnitaire * quantiteVendue);

          // Payload de la facture
          const finalFactureData = {
            id: factureId,
            utilisateur_id: userId,
            client_nom: getFormVal("client_nom", "Client Comptant"),
            total_ttc: totalHtCalculé,
            total_ht: totalHtCalculé,
            benefice_realise: beneficeRealise,
            statut: getFormVal("statut", "payee"),
            cree_le: new Date().toISOString(),
            statut_synchro: "local"
          };

          // Payload de l'item de facture
          const localItemData = {
            id: crypto.randomUUID(),
            utilisateur_id: userId,
            facture_id: factureId,
            produit_id: prodId,
            quantite: quantiteVendue,
            prix_unitaire: Number(getFormVal("prix_unitaire")) || 0,
            statut_synchro: "local"
          };

          if (!db[tableName] || !db["gf_facture_items"]) {
            throw new Error(`La table ${tableName} ou gf_facture_items n'est pas configurée dans Dexie.`);
          }

          // 1. ÉCRITURE STRICTEMENT LOCALE (Comme stock et school)
          await Promise.all([
            db[tableName].put(finalFactureData),
            db["gf_facture_items"].put(localItemData)
          ]);

          // 2. MISE À JOUR DU STOCK & ALERTE (En local)
          if (produitConcerne) {
            const stockActuel = Number(produitConcerne.stock_actuel) || 0;
            const nouveauStock = stockActuel - quantiteVendue;
            const seuilAlerte = Number(produitConcerne.stock_alerte) || 0;

            // Décrémentation en base locale
            await db["gf_produits"].update(prodId, { stock_actuel: nouveauStock });

            // Notification UI instantanée pour le catalogue actuel
            setArticlesCatalogue((prev) =>
              (prev || []).map((art) =>
                String(art.id) === String(prodId) ? { ...art, stock_actuel: nouveauStock } : art
              )
            );

            // Alerte native
            if (nouveauStock <= seuilAlerte) {
              alert(`⚠️ ALERTE STOCK : "${produitConcerne.nom}" est bas (${nouveauStock} restants pour un seuil de ${seuilAlerte}).`);
            }
          }

          // 3. SYNCHRONISATION SUPABASE EN ARRIÈRE-PLAN (Sans bloquer ni crasher l'UI)
          if (navigator.onLine) {
            (async () => {
              try {
                const { statut_synchro, cree_le, ...factureCloudBase } = finalFactureData;
                const { statut_synchro: _, ...itemCloud } = localItemData;

                const factureCloud = { ...factureCloudBase, created_at: cree_le };

                const resFacture = await supabase.from("gf_factures").insert(factureCloud);
                const resItem = await supabase.from("gf_facture_items").insert(itemCloud);

                if (!resFacture.error && !resItem.error) {
                  await Promise.all([
                    db[tableName].update(factureId, { statut_synchro: "synchronise" }),
                    db["gf_facture_items"].update(localItemData.id, { statut_synchro: "synchronise" })
                  ]);
                  console.log("✅ Facture synchronisée en tâche de fond !");
                }
              } catch (e) {
                console.error("Échec de la synchro silencieuse", e);
              }
            })();
          }

          break;
        }


        case "stock": {
          tableName = "gf_produits";
          const quantiteInitiale = Number(getFormVal("stock_actuel")) || 0;
          
          const finalStockData = {
            id: crypto.randomUUID(), // 🔥 Remplacement du nombre par un UUID String
            utilisateur_id: userId,
            nom: getFormVal("nom_produit") || getFormVal("nom"),
            prix_achat: Number(getFormVal("prix_achat")) || 0,
            prix_vente: Number(getFormVal("prix_vente")) || 0,
            stock_initial: quantiteInitiale, 
            stock_actuel: quantiteInitiale,
            stock_alerte: Number(getFormVal("stock_alerte")) || 5,
            unite_mesure: getFormVal("unite_mesure", "Sac"),
            statut_synchro: "local"
          };

          if (!db[tableName]) {
            throw new Error(`La table ${tableName} n'est pas configurée dans Dexie.`);
          }

          await db[tableName].put(finalStockData);
          break;
        }

        case "school": {
          const eleveIdNum = idNumeriqueUnique();
          const inscriptionIdNum = idNumeriqueUnique();

          const nouvelEleve = {
            id: eleveIdNum,
            utilisateur_id: userId,
            nom: (getFormVal("nom_eleve") || getFormVal("nom"))?.toUpperCase(),
            prenom: getFormVal("prenom_eleve") || getFormVal("prenom"),
            sexe: getFormVal("sexe", "M"),
            date_naissance: getFormVal("date_naissance") || null,
            nom_parent: getFormVal("nom_parent"),
            telephone_parent: getFormVal("telephone_parent"),
            adresse: getFormVal("adresse"),
            statut_synchro: "local"
          };
          await db.gs_eleves.put(nouvelEleve);

          const nouvelleInscription = {
            id: inscriptionIdNum,
            utilisateur_id: userId,
            annee_id: Number(getFormVal("annee_id")),
            eleve_id: eleveIdNum,
            classe_id: Number(getFormVal("classe_id")),
            numero_matricule: getFormVal("numero_matricule") || null,
            scolarite_totale: Number(getFormVal("scolarite_totale")) || 0,
            reduction: Number(getFormVal("reduction")) || 0,
            statut_synchro: "local"
          };
          await db.gs_inscriptions.put(nouvelleInscription);

          const montantAcompte = Number(getFormVal("acompte")) || 0;
          if (montantAcompte > 0) {
            const nouveauPaiementAcompte = {
              id: idNumeriqueUnique(),
              utilisateur_id: userId,
              inscription_id: inscriptionIdNum,
              montant: montantAcompte,
              date_paiement: new Date().toISOString().split("T")[0],
              statut_synchro: "local"
            };
            await db.gs_paiements.put(nouveauPaiementAcompte);
          }
          break;
        }

         case "school_paiement": {
        const montantVerse = Number(getFormVal("montant")) || Number(getFormVal("montant_paiement")) || 0;
        const inscriptionIdChoisie = Number(getFormVal("inscription_id"));

        if (montantVerse <= 0 || !inscriptionIdChoisie) {
          throw new Error("Le montant du paiement ou l'élève sélectionné est invalide.");
        }

        const nouveauPaiementSeul = {
          id: idNumeriqueUnique(),
          utilisateur_id: userId,
          inscription_id: inscriptionIdChoisie,
          montant: montantVerse,
          date_paiement: getFormVal("date_paiement") || new Date().toISOString().split("T")[0],
          mode_paiement: getFormVal("mode_paiement", "Espèces"),
          statut_synchro: "local" // Stockage en cache d'abord
        };

        // Sauvegarde immédiate dans la table Dexie locale
        await db.gs_paiements.put(nouveauPaiementSeul);
        break;
      }

      case "school_enseignant": {
  const nomRaw = getFormVal("nom_enseignant") || getFormVal("nom");
  const prenomRaw = getFormVal("prenom_enseignant") || getFormVal("prenom");
  const telephoneRaw = getFormVal("telephone_enseignant");
  const adresseRaw = getFormVal("adresse_enseignant");

  if (!nomRaw || !prenomRaw || !telephoneRaw || !adresseRaw) {
    setStatus({ type: "error", text: "⚠️ Veuillez remplir tous les champs obligatoires (*)." });
    setSaving(false);
    return;
  }

  
  const specialiteFinale = formData.specialite
    ? String(formData.specialite).trim() 
    : null;

  const nouvelEnseignant = {
    id: idNumeriqueUnique(),
    utilisateur_id: userId,
    nom: nomRaw.toUpperCase(),
    prenom: prenomRaw,
    adresse: adresseRaw, 
    telephone: telephoneRaw, 
    email: getFormVal("email_enseignant") || null,
    specialite: specialiteFinale, 
    statut_synchro: "local"
  };

  // Enregistrement local Dexie
  await db.gs_enseignants.put(nouvelEnseignant);
  break;
}



      default:
        console.warn("Aucun module correspondant trouvé pour la soumission.");
        break;
    }

    setStatus({ type: "success", text: "Enregistrement local effectué avec succès !" });
    
    // Réinitialisation du formulaire
    target.reset();
    // 🧼 Nettoyage de l'état en contournant le blocage de type TypeScript
setFormData((prev: any) => ({ 
  ...prev, 
  specialite: "" 
}));


    // ==========================================
    // 🚀 FIX 2 : SYNCHRONISATION INSTANTANÉE VERS SUPABASE (SI ONLINE)
    // ==========================================
    if (typeof window !== "undefined" && navigator.onLine) {
      console.log("🌐 Internet actif : Envoi immédiat des paiements et inscriptions vers Supabase...");
      
      // Appel de votre orchestrateur unifié que nous avons stabilisé ensemble
      const currentAnneeId = getFormVal("annee_id") || "1";
      await executionSynchronisationGlobale(userId, currentAnneeId);
    }

  } catch (err: any) {
    console.error("Erreur de soumission :", err);
    setStatus({ type: "error", text: err.message || "Erreur lors de l'enregistrement." });
  } finally {
    setSaving(false);
  }
};


useEffect(() => {
  async function chargerArticlesPourFacture() {
    try {
      if (db && db["gf_produits"]) {
        const localProds = await db["gf_produits"].toArray();
        const filtrés = localProds.filter((p: any) => 
          !p.statut_synchro || 
          ["synced", "synchronise", "local"].includes(p.statut_synchro)
        );
        setArticlesCatalogue(filtrés);
      }
    } catch (err) {
      console.error("Erreur chargement articles:", err);
    }
  }
  
  if (currentModule === "facture") {
    chargerArticlesPourFacture();
  }
}, [currentModule]);


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
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

            {/* SÉLECTION DYNAMIQUE DE L'ARTICLE DEPUIS LE CATALOGUE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Sélectionner l'article acheté *
                </label>
                <select
                  name="produit_id"
                  required
                  value={formData.produit_id || ""}
                  onChange={(e) => {
                    const pId = e.target.value;
                    const produitSelectionne = articlesCatalogue.find((p: any) => String(p.id) === String(pId));
                    
                    const prixVente = produitSelectionne ? Number(produitSelectionne.prix_vente) : 0;
                    const designation = produitSelectionne ? produitSelectionne.nom : "";
                    const qte = Number(formData.quantite) || 1;

                    setFormData((prev: any) => ({
                      ...prev,
                      produit_id: pId,
                      designation_produit: designation,
                      prix_unitaire: prixVente,
                      total_ht: prixVente * qte
                    }));
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                >
                  <option value="">-- Choisir un produit du stock --</option>
                  {articlesCatalogue.map((produit: any) => (
                    <option key={produit.id} value={produit.id}>
                      {produit.nom} ({Number(produit.prix_vente || 0).toLocaleString()} FCFA)
                    </option>
                  ))}
                </select>
              </div>


              {/* CHAMP QUANTITÉ AVEC RECALCUL AUTOMATIQUE */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Quantité achetée *
                </label>
                <input
                  type="number"
                  name="quantite"
                  min="1"
                  required
                  value={formData.quantite || "1"}
                  onChange={(e) => {
                    const qte = Number(e.target.value) || 1;
                    const prixUnitaire = Number(formData.prix_unitaire) || 0;
                    
                    setFormData((prev: any) => ({
                      ...prev,
                      quantite: qte,
                      total_ht: prixUnitaire * qte
                    }));
                  }}
                  placeholder="ex: 5"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
            </div>

            {/* Détails du Montant Net (SANS TVA) */}
            <div className="border-t border-dashed border-slate-200 dark:border-slate-800 pt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Montant Total Net de la vente *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    name="total_ht"
                    required
                    readOnly
                    value={formData.total_ht || ""}
                    className="w-full pl-4 pr-16 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono cursor-not-allowed outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-slate-500">
                    FCFA
                  </span>
                </div>
              </div>

              {/* Récapitulatif épuré sans TVA */}
              {Number(formData.total_ht) > 0 && (
                <div className="p-4 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2 text-sm animate-fadeIn shadow-inner">
                  <div className="flex justify-between items-center font-bold text-slate-900 dark:text-white text-base">
                    <span>Net à payer au comptant :</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-lg">
                      {Number(formData.total_ht).toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Paramètres de règlement */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Mode de règlement & Statut
              </label>
              <select
                name="statut"
                value={formData.statut || "payee"}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              >
                <option value="payee" className="dark:bg-slate-900">Payée au comptant (Espèces / Mobile Money)</option>
                <option value="en_attente" className="dark:bg-slate-900">En attente de paiement (Facture proforma / Crédit)</option>
              </select>
            </div>

          </div>

          {/* Bouton d'Impression */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700/60 shadow-sm w-full sm:w-auto active:scale-98"
            >
              🖨️ Imprimer cette facture client
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
          {/* 📱 1 colonne sur mobile, 💻 2 colonnes automatiques sur ordinateur */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                Nom(s)
              </label>
              <input
                required
                type="text"
                name="nom_eleve"
                onChange={handleInputChange}
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                Prénom(s)
              </label>
              <input
                required
                type="text"
                name="prenom_eleve"
                onChange={handleInputChange}
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                Sexe
              </label>
              <select
                name="sexe"
                onChange={handleInputChange}
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              >
                <option value="" className="dark:bg-slate-900">Choisir</option>
                <option value="Masculin" className="dark:bg-slate-900">Masculin</option>
                <option value="Féminin" className="dark:bg-slate-900">Féminin</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                Date de naissance
              </label>
              <input
                type="date"
                name="date_naissance"
                onChange={handleInputChange}
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
              Nom du parent / Tuteur
            </label>
            <input
              type="text"
              name="nom_parent"
              onChange={handleInputChange}
              className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
              Téléphone du parent
            </label>
            <input
              type="text"
              name="telephone_parent"
              onChange={handleInputChange}
              placeholder="+236..."
              className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
              Adresse
            </label>
            <input
              type="text"
              name="adresse"
              onChange={handleInputChange}
              placeholder="Quartier (ex: Lakouanga, Boy-Rabe...)"
              className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          <hr className="my-5 border-slate-200 dark:border-slate-800" />

          {/* Inscription */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                Année scolaire
              </label>
              <select
                required
                name="annee_id"
                onChange={handleInputChange}
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              >
                <option value="" className="dark:bg-slate-900">Sélectionner</option>
                {anneesScolaires.map((annee) => (
                  <option key={annee.id} value={annee.id} className="dark:bg-slate-900">
                    {annee.libelle}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                Classe
              </label>
              <select
                required
                name="classe_id"
                onChange={handleInputChange}
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              >
                <option value="" className="dark:bg-slate-900">Sélectionner</option>
                {classes.map((classe) => (
                  <option key={classe.id} value={classe.id} className="dark:bg-slate-900">
                    {classe.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
              Numéro matricule
            </label>
            <input
              type="text"
              name="numero_matricule"
              onChange={handleInputChange}
              className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                 Scolarité Annuelle
              </label>
              <input
                required
                type="number"
                name="scolarite_totale"
                onChange={handleInputChange}
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

                       <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Réduction / Remise (FCFA)
              </label>
              <input
                type="number"
                name="reduction"
                onChange={handleInputChange}
                placeholder="Ex: 50000 (0 si aucune)"
                defaultValue={0}
                min={0} // Évite de saisir des réductions négatives
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
          </div>

          <hr className="my-5 border-slate-200 dark:border-slate-800" />

          {/* Paiement */}
          {/* 📱 1 colonne verticale sous le pouce, 💻 2 colonnes sur PC */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                Acompte versé
              </label>
              <input
                type="number"
                name="acompte"
                defaultValue={0}
                onChange={handleInputChange}
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                Mode de paiement
              </label>
              <select
                name="mode_paiement"
                onChange={handleInputChange}
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              >
                <option value="Espèces" className="dark:bg-slate-900">Espèces</option>
                <option value="Mobile Money" className="dark:bg-slate-900">Mobile Money (Orange, Moov...)</option>
                <option value="Virement" className="dark:bg-slate-900">Virement</option>
                <option value="Chèque" className="dark:bg-slate-900">Chèque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
              Référence du paiement
            </label>
            <input
              type="text"
              name="reference"
              placeholder="Ex: N° Chèque, ID Transaction..."
              onChange={handleInputChange}
              className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
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
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-white"
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
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Adresse *
                </label>
                <input type="text"
                  name="adresse_enseignant"
                  required
                  value={formData.adresse_enseignant || ""}
                  onChange={handleInputChange}
                  placeholder="Quartier"
                 className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-white"
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
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-white"
                />
              </div>
            </div>

                          {/* 🚨 LE SYSTÈME DE SPÉCIALITÉS CORRIGÉ AVEC INPUT CACHÉ */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Spécialités / Matières enseignées
              </label>

             {/* 🔒 CHAMP CACHÉ : Transmet la valeur finale à New FormData lors du Submit */}
            <input 
              type="hidden" 
              name="specialite" 
              value={formData.specialite || ""} 
            />

            {/* Barre de saisie et de recherche intelligente */}
            <div className="flex gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <select
                name="select_predefined_specialite"
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) return;
                  
                  const currentSpecs = formData.specialite
                    ? formData.specialite.split(", ").map((s: string) => s.trim()) 
                    : [];
                  
                  if (!currentSpecs.includes(value)) {
                    const updated = [...currentSpecs, value].join(", ");
                    setFormData({ ...formData, specialite: updated });
                  }
                  e.target.value = ""; // Réinitialise le select
                }}
                className="flex-1 text-sm bg-transparent border-none text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                  <option value="">Sélectionnez ou recherchez une spécialité...</option>
                  
                  <optgroup label="🏫 Enseignement Général Classique">
                    <option value="Généraliste (Maternelle)">Généraliste (Maternelle)</option>
                    <option value="Généraliste (Primaire)">Généraliste (Primaire)</option>
                    <option value="Mathématiques">Mathématiques</option>
                    <option value="Français / Lettres">Français / Lettres</option>
                    <option value="Histoire-Géographie">Histoire-Géographie</option>
                    <option value="Sciences (SVT / Physique)">Sciences (SVT / Physique)</option>
                    <option value="Anglais">Anglais</option>
                    <option value="Éducation Physique (EPS)">Éducation Physique (EPS)</option>
                  </optgroup>

                  <optgroup label="🎓 Enseignement Supérieur / Universitaire">
                    <option value="Informatique / Génie Logiciel">Informatique / Génie Logiciel</option>
                    <option value="Économie / Gestion d'Entreprise">Économie / Gestion d'Entreprise</option>
                    <option value="Droit Public / Privé">Droit Public / Privé</option>
                    <option value="Médecine / Sciences de la Santé">Médecine / Sciences de la Santé</option>
                    <option value="Physique Quantique / Mécanique">Physique Quantique / Mécanique</option>
                    <option value="Chimie Organique / Biochimie">Chimie Organique / Biochimie</option>
                    <option value="Marketing Digital / Com">Marketing Digital / Com</option>
                    <option value="Comptabilité & Audit">Comptabilité & Audit</option>
                    <option value="Ressources Humaines">Ressources Humaines</option>
                  </optgroup>
                </select>

               <input
                type="text"
                placeholder="Autre matière... (Entrée)"
                id="custom_specialite_input"
                name="custom_specialite_text" 
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault(); // Évite la soumission globale du formulaire
                    const input = e.currentTarget;
                    const val = input.value.trim();
                    if (!val) return;

                    const currentSpecs = formData.specialite 
                      ? formData.specialite.split(", ").map((s: string) => s.trim()) 
                      : [];

                    if (!currentSpecs.includes(val)) {
                      const updated = [...currentSpecs, val].join(", ");
                      setFormData({ ...formData, specialite: updated });
                    }
                    input.value = ""; // Vide le champ texte après l'ajout
                  }
                }}
                className="w-1/3 px-3 py-1 border-l border-slate-200 dark:border-slate-800 bg-transparent text-xs focus:outline-none text-slate-700 dark:text-slate-300"
              />
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 italic block">
              💡 Appuyez sur la touche <strong>Entrée</strong> pour valider l'ajout d'une autre matière.
            </span>

              
              {/* Zone d'affichage des badges dynamiques */}
              <div className="flex flex-wrap gap-2 pt-1">
                {(formData.specialite ? formData.specialite.split(", ").map((s: string) => s.trim()) : [])
                  .filter((s: string) => s.length > 0)
                  .map((spec: string, idx: number) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border border-emerald-200/40"
                    >
                      {spec}
                      <button
                        type="button"
                        onClick={() => {
                          const currentSpecs = formData.specialite
                            ? formData.specialite.split(", ").map((s: string) => s.trim())
                            : [];
                          const filtered = currentSpecs.filter((s: string) => s !== spec);
                          setFormData({ ...formData, specialite: filtered.join(", ") });
                        }}
                        className="hover:text-red-500 font-bold transition-colors text-[11px]"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
              </div>
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
                            const scolariteBrute = Number(ins.scolarite_totale) || 0;
                            const reductionAccordee = Number(ins.reduction) || 0;

                            // 🔒 Sécurité : Le net à payer ne peut pas être inférieur à 0
                            const netAPayer = Math.max(0, scolariteBrute - reductionAccordee);
                            
                            const totalDejaPaye = ins.gs_paiements?.reduce((sum: number, p: any) => sum + (Number(p.montant) || 0), 0) || 0;
                            
                            // 🔒 Sécurité : Le reste à payer ne peut pas être négatif (si l'élève a trop-perçu)
                            const resteAPayer = Math.max(0, netAPayer - totalDejaPaye);

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