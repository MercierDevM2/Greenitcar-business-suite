import { db } from "./db";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Télécharge toutes les données de l'utilisateur depuis Supabase 
 * et les enregistre localement sur le PC.
 */
export async function hydraterBaseLocale(userId: string) {
  console.log("Début de l'hydratation initiale de la base locale...");

  // Liste de toutes vos tables Supabase à cloner sur le PC
  // Clé : Nom de la table locale Dexie | Valeur : Nom de la table Supabase
  const tablesAMigrer = [
    { locale: "utilisateurs", serveur: "utilisateurs" },
    { locale: "gf_factures", serveur: "gf_factures" },
    { locale: "gf_produits", serveur: "gf_produits" },
    { locale: "gs_annees_scolaires", serveur: "gs_annees_scolaires" },
    { locale: "gs_classes", serveur: "gs_classes" },
    { locale: "gs_eleves", serveur: "gs_eleves" },
    { locale: "gs_inscriptions", serveur: "gs_inscriptions" },
    { locale: "gs_paiements", serveur: "gs_paiements" },
    { locale: "gs_enseignants", serveur: "gs_enseignants" },
    { locale: "gp_employes", serveur: "gp_employes" },
    { locale: "ga_patrimoine", serveur: "ga_patrimoine" },
    { locale: "gpt_pointages", serveur: "gpt_pointages" }
  ];

  for (const table of tablesAMigrer) {
    try {
      // 1. Récupération des données filtrées par l'ID de l'utilisateur connecté
      const { data, error } = await supabase
        .from(table.serveur)
        .select("*")
        .eq(table.serveur === "utilisateurs" ? "id" : "utilisateur_id", userId);

      if (error) throw error;

      if (data && data.length > 0) {
        // 2. Formatage pour la base locale (on s'assure que le statut est marqué comme synchronisé)
        const donneesFormatees = data.map((item: any) => ({
          ...item,
          // Si la table est 'utilisateurs', elle n'a pas besoin de flag de synchro, sinon oui
          ...(table.locale !== "utilisateurs" && { statut_synchro: "synonise" })
        }));

        // 3. Nettoyage de l'ancienne table locale pour éviter les doublons et injection des données fraîches
        // @ts-ignore
        await db[table.locale].clear();
        // @ts-ignore
        await db[table.locale].bulkPut(donneesFormatees);
        
        console.log(`Table locale [${table.locale}] synchronisée : ${data.length} lignes importées.`);
      }
    } catch (err) {
      console.error(`Erreur lors de l'hydratation de la table ${table.locale} :`, err);
    }
  }

  // Enregistrement d'un marqueur dans le LocalStorage pour ne pas refaire cette grosse opération à chaque rafraîchissement
  localStorage.setItem(`greenitcar_hydrated_${userId}`, "true");
  console.log("Hydratation initiale terminée avec succès !");
}
