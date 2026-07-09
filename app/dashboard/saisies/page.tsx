"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function SaisieFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentModule = searchParams.get("module") || "facture";

  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // États génériques pour stocker les champs des différents formulaires
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    async function getAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    getAuth();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Soumission et insertion dynamique dans la bonne table Supabase
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
          const total_ttc = total_ht * 1.2; // Exemple TVA 20%
          const estimation_achat = total_ht * 0.6; // Simulation coût d'achat pour bénéfice
          dataToInsert = {
            ...dataToInsert,
            client_nom: formData.client_nom,
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

        case "school":
            tableName = "gs_eleves";
            
            const scolarite_totale = Number(formData.scolarite_totale) || 0;
            const scolarite_payee = Number(formData.scolarite_payee) || 0;

            dataToInsert = {
                ...dataToInsert,
                nom: formData.nom_eleve?.toUpperCase(), // Propre pour les listes
                prenom: formData.prenom_eleve,
                classe: formData.classe,
                scolarite_totale: scolarite_totale,
                scolarite_payee: scolarite_payee,
            };
            break;


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
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* FORMULAIRE GREENFACTURE */}
        {currentModule === "facture" && (
          <>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Nom du client</label>
              <input required type="text" name="client_nom" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" placeholder="Client SARL" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Montant HT (FCFA)</label>
              <input required type="number" name="total_ht" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" placeholder="50000" />
            </div>
          </>
        )}

        {/* FORMULAIRE GREENSTOCK */}
        {currentModule === "stock" && (
          <>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Nom du produit / article</label>
              <input required type="text" name="nom_produit" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" placeholder="Ciment 50kg, Paracétamol..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Prix Achat</label>
                <input required type="number" name="prix_achat" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Prix Vente</label>
                <input required type="number" name="prix_vente" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Quantité initiale en stock</label>
              <input required type="number" name="stock_actuel" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" placeholder="100" />
            </div>
          </>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Nom de l'élève</label>
                <input required type="text" name="nom_eleve" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Prénom</label>
                <input required type="text" name="prenom_eleve" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Classe</label>
              <input required type="text" name="classe" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" placeholder="Terminales S1, CM2-A..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Frais Scolarité (Annuel)</label>
                <input required type="number" name="scolarite_totale" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" placeholder="450000" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Acompte Versé (Paiement)</label>
                <input required type="number" name="scolarite_payee" onChange={handleInputChange} className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm" placeholder="150000" />
              </div>
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
    </div>
  );
}

export default function SaisiePage() {
  return (
    <Suspense fallback={<div className="text-center p-8 text-sm">Chargement du formulaire...</div>}>
      <SaisieFormContent />
    </Suspense>
  );
}
