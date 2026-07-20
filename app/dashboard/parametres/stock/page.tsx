"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../utils/supabase";
import { db as baseDb } from "../../../lib/db";
const db = baseDb as any;

export default function AjoutArticleStockPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [formData, setFormData] = useState({
    nom_produit: "",
    prix_achat: "",
    prix_vente: "", 
    stock_actuel: "", // Utilisé comme valeur de départ
    stock_alerte: "5",
    unite_mesure: "Sac" 
  });

  // 🛠️ AUTHENTIFICATION HYBRIDE (Source de vérité: Supabase / Repli: Dexie)
  useEffect(() => {
    async function getAuth() {
      // 1. Si hors-ligne : On récupère immédiatement l'utilisateur local depuis Dexie
      if (!navigator.onLine) {
        try {
          const utilisateursLocaux = await db.utilisateurs.limit(1).toArray();
          if (utilisateursLocaux && utilisateursLocaux.length > 0) {
            setUserId(utilisateursLocaux[0].id);
            console.log("Mode Hors-ligne : Utilisateur local Dexie détecté.");
          }
        } catch (dexieError) {
          console.error("Impossible de lire Dexie hors-ligne :", dexieError);
        }
        return;
      }

      // 2. Si en ligne : On interroge Supabase
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!error && user) {
          setUserId(user.id);
          
          // On s'assure que cet utilisateur est bien mémorisé en local pour une prochaine panne réseau
          const usersLocaux = await db.utilisateurs.where("id").equals(user.id).toArray();
          if (usersLocaux.length === 0) {
            await db.utilisateurs.put({ id: user.id });
          }
        }
      } catch (netError) {
        console.log("Échec de connexion réseau Supabase, bascule sur Dexie...");
        const utilisateursLocaux = await db.utilisateurs.limit(1).toArray();
        if (utilisateursLocaux && utilisateursLocaux.length > 0) {
          setUserId(utilisateursLocaux[0].id);
        }
      }
    }
    getAuth();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAjouterArticle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userId) {
      setStatus({ type: "error", text: "Session utilisateur introuvable. Veuillez vous reconnecter." });
      return;
    }
    setSaving(true);
    setStatus(null);

    const quantiteSaisie = Number(formData.stock_actuel) || 0;
    const nouvelId = crypto.randomUUID(); 

    try {
      // 1️⃣ ÉCRITURE EXPÉDITIVE DANS LA BASE LOCALE DEXIE
      await db["gf_produits"].add({
        id: nouvelId,
        utilisateur_id: userId,
        nom: formData.nom_produit,
        prix_achat: Number(formData.prix_achat) || 0,
        prix_vente: Number(formData.prix_vente) || 0,
        stock_initial: quantiteSaisie, 
        stock_actuel: quantiteSaisie,  
        stock_alerte: Number(formData.stock_alerte) || 0,
        unite_mesure: formData.unite_mesure,
        statut_synchro: "local", 
      });

      // 2️⃣ TENTATIVE D'ENVOI À SUPABASE UNIQUEMENT SI LE RÉSEAU EST DISPONIBLE
      if (navigator.onLine) {
        try {
          const { error } = await supabase.from("gf_produits").insert([
            {
              id: nouvelId,
              utilisateur_id: userId,
              nom: formData.nom_produit,
              prix_achat: Number(formData.prix_achat) || 0,
              prix_vente: Number(formData.prix_vente) || 0,
              stock_initial: quantiteSaisie,
              stock_actuel: quantiteSaisie,
              stock_alerte: Number(formData.stock_alerte) || 0,
              unite_mesure: formData.unite_mesure,
            }
          ]);

          if (!error) {
            // Marquage local comme correctement synchronisé avec la base cloud
            await db["gf_produits"].update(nouvelId, { statut_synchro: "synced" });
          }
        } catch (supaErr) {
          console.warn("Échec d'envoi Supabase (sauvegardé en local pour la prochaine synchro automatique) :", supaErr);
        }
      }

      // Notification de succès fluide (identique qu'on soit connecté ou non)
      setStatus({ 
        type: "success", 
        text: navigator.onLine 
          ? "Nouvel article enregistré et synchronisé avec succès !" 
          : "Article enregistré localement (En attente de connexion pour synchronisation) !" 
      });
      
      setFormData({ nom_produit: "", prix_achat: "", prix_vente: "", stock_actuel: "", stock_alerte: "5", unite_mesure: "Sac" });
      setTimeout(() => router.push("/dashboard"), 1500);

    } catch (err: any) {
      console.error(err);
      setStatus({ type: "error", text: err.message || "Erreur d'enregistrement." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 mt-10">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Enregistrez vos articles en stock</h1>
        <p className="text-xs text-gray-500 mt-1">Ajoutez un nouvel article ou une marchandise de gros disponible à la vente.</p>
      </div>

      {status && (
        <div className={`p-3 rounded-lg mb-4 text-sm font-medium ${status.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {status.text}
        </div>
      )}

      <form onSubmit={handleAjouterArticle} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Désignation du produit</label>
          <input type="text" name="nom_produit" value={formData.nom_produit} onChange={handleChange} required className="w-full border p-2.5 rounded-lg text-sm" placeholder="Ex: Sac de Sucre 50Kg, Farine Blonde, Appareil de pesage" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unité de conditionnement</label>
            <select name="unite_mesure" value={formData.unite_mesure} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm bg-white">
              <option value="Sac">Sac</option>
              <option value="Kg">Kilogramme (Kg)</option>
              <option value="Carton">Carton</option>
              <option value="Unite">Unité / Pièce</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantité initiale en stock</label>
            <input type="number" step="any" name="stock_actuel" value={formData.stock_actuel} onChange={handleChange} required className="w-full border p-2.5 rounded-lg text-sm" placeholder="Ex: 100" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prix d'Achat Fournisseur (u)</label>
            <input type="number" name="prix_achat" value={formData.prix_achat} onChange={handleChange} required className="w-full border p-2.5 rounded-lg text-sm" placeholder="Prix d'achat unitaire" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prix de Vente Standard (u)</label>
            <input type="number" name="prix_vente" value={formData.prix_vente} onChange={handleChange} required className="w-full border p-2.5 rounded-lg text-sm" placeholder="Prix de vente unitaire" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Seuil d'alerte (Stock minimum)</label>
          <input type="number" name="stock_alerte" value={formData.stock_alerte} onChange={handleChange} required className="w-full border p-2.5 rounded-lg text-sm" placeholder="Alerte si stock inférieur ou égal à..." />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button 
            type="submit" 
            disabled={saving} 
            className="w-full bg-emerald-600 text-white p-3 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors order-1 sm:order-2"
          >
            {saving ? "Enregistrement de l'article..." : "Ajouter l'article au Stock"}
          </button>
          
          <button 
            type="button" 
            disabled={saving}
            onClick={() => router.push("/dashboard")} 
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 p-3 rounded-lg text-sm font-semibold transition-colors order-2 sm:order-1 disabled:opacity-50"
          >
            ❌ Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
