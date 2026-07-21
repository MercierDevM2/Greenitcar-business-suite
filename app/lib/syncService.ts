import { db } from "./db";
import { supabase } from "../utils/supabase";

const TABLES_MIGRATION = [
 // 🟢 1. On envoie les produits d'abord (indépendants)
  { locale: "gf_produits", serveur: "gf_produits" },
  
  // 🟢 2. On envoie l'en-tête de la facture ensuite
  { locale: "gf_factures", serveur: "gf_factures" },
  
  // 🟢 3. On envoie les lignes de détails en dernier (qui dépendent des produits et des factures)
  { locale: "gf_facture_items", serveur: "gf_facture_items" },
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


export async function exporterDonneesLocales(userId: string) {
  console.log("📤 Début de l'exportation des données locales...");

  for (const table of TABLES_MIGRATION) {
    try {
      // @ts-ignore
      const toutesLesDonneesLocales = await db[table.locale].toArray();
      
      const enAttente = toutesLesDonneesLocales.filter((item: any) => {
        const estPending = item.statut_synchro === "pending" || item.statut_synchro === "local" || !item.statut_synchro;
        const estMonId = item.utilisateur_id === userId || !item.utilisateur_id;
        return estPending && estMonId;
      });

      if (enAttente.length > 0) {
        console.log(`Table [${table.locale}] : ${enAttente.length} lignes à envoyer.`);

        const donneesPropres = enAttente.map(({ statut_synchro, id, ...reste }: any) => {
          const baseRow: any = {
            ...reste,
            utilisateur_id: userId
          };

          if ("reference_paiement" in baseRow) {
            baseRow.reference = baseRow.reference_paiement;
            delete baseRow.reference_paiement;
          }

          // Gestion sécurisée des IDs
          if (id && !(typeof id === "string" && id.includes("-"))) {
            baseRow.id = id;
          }

          return baseRow;
        });

        // À l'intérieur de la boucle for (const table of TABLES_MIGRATION)
          const { error } = await supabase.from(table.serveur).upsert(donneesPropres);

          if (error) {
            console.error(`❌ Erreur d'envoi Supabase [${table.serveur}] :`, error.message);
            continue; // 🚀 REMPLACEZ "throw error" PAR "continue" pour ne pas bloquer les autres tables !
          }


        // @ts-ignore
        await db[table.locale]
          .where("id")
          .anyOf(enAttente.map((i: any) => i.id))
          .modify({ statut_synchro: "synced", utilisateur_id: userId });

        console.log(`✅ Table [${table.locale}] synchronisée.`);
      }
    } catch (err) {
      console.error(`Erreur export table ${table.locale} :`, err);
    }
  }
}

export async function hydraterBaseLocale(userId: string) {
  console.log(`📥 Rafraîchissement du cache depuis le Cloud pour : ${userId}`);
  
  for (const table of TABLES_MIGRATION) {
    try {
      // 1. Récupération des données fraîches depuis Supabase
      const { data, error } = await supabase
        .from(table.serveur)
        .select("*")
        .eq("utilisateur_id", userId);
        
      if (error) throw error;

      console.log(`📡 Supabase a renvoyé ${data?.length || 0} lignes pour la table [${table.serveur}]`);

      const donneesFormatees = (data || []).map((item: any) => ({
        ...item,
        statut_synchro: "synced"
      }));

      // 🚨 FIX DE TYPE : Accès dynamique sécurisé avec db.table() approuvé par Dexie & TypeScript
      const tableDexie = db.table(table.locale);
      
      // On vide proprement les anciennes correspondances locales de cet utilisateur
      await tableDexie.where("utilisateur_id").equals(userId).delete();

      // 2. On injecte les nouvelles lignes sur mesure
      if (donneesFormatees.length > 0) {
        await tableDexie.bulkPut(donneesFormatees);
        console.log(`💾 Cache Dexie mis à jour pour la table [${table.locale}]`);
      }
    } catch (err) {
      console.error(`Erreur hydratation ${table.locale} :`, err);
    }
  }
}



// 🔄 L'ORCHESTRATION DOIT TOUJOURS DESCENDRE LES INFOS EN PREMIER 
export async function executionSynchronisationGlobale(userId: string, anneeId: string) {
  try {
    console.log("🔄 Lancement de la synchronisation globale...");

    // 🚨 FIX ABSOLU : On ENVOIE d'abord les créations locales (statut "local"/"pending")
    // Cela permet à votre nouvel enseignant de monter en sécurité sur Supabase
    await exporterDonneesLocales(userId);

    // 📥 On TÉLÉCHARGE ensuite les données consolidées depuis le Cloud
    // Votre enseignant étant désormais sur Supabase, il redescendra ici avec le statut "synced"
    await hydraterBaseLocale(userId);

    console.log("🔄 Synchronisation globale bidirectionnelle terminée.");
  } catch (error) {
    console.error("Échec de la synchro globale :", error);
  }
}

export const synchroniserFacturesVersCloud = async (userId: string): Promise<void> => {
  try {
    console.log("Début de la synchronisation des factures pour :", userId);
    const dexieDb = db as any;

    const facturesAEnvoyer = await dexieDb["gf_factures"]
      .where("utilisateur_id")
      .equals(userId)
      .filter((item: any) => item.statut_synchro === "local")
      .toArray();

    if (facturesAEnvoyer.length === 0) {
      console.log("📥 Aucune facture locale à synchroniser.");
      return;
    }

    const payloads = facturesAEnvoyer.map((facture: any) => {
      return {
        id: facture.id, 
        utilisateur_id: facture.utilisateur_id,
        client_nom: facture.client_nom,
        total_ttc: facture.total_ttc,
        total_ht: facture.total_ht || facture.total_ttc, 
        benefice_realise: facture.benefice_realise || 0,
        statut: facture.statut || "payee",
        created_at: facture.cree_le || new Date().toISOString()
      };
    });

    const { error } = await supabase
      .from("gf_factures")
      .upsert(payloads, { onConflict: "id" }); 

    if (!error) {
      const idsSynchronises = facturesAEnvoyer.map((f: any) => f.id);
      
      await dexieDb["gf_factures"]
        .where("id")
        .anyOf(idsSynchronises)
        .modify({ statut_synchro: "synced" });

      console.log(`✅ ${idsSynchronises.length} facture(s) synchronisée(s) !`);
    } else {
      console.error("❌ Erreur Supabase lors de l'upsert des factures :", error.message);
    }

  } catch (error) {
    console.error("Erreur critique lors de la synchronisation des factures :", error);
  }
};
