import { db } from "./db";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TABLES_MIGRATION = [
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

export async function exporterDonneesLocales(userId: string) {
  console.log("📤 Début de l'exportation des données locales...");

  for (const table of TABLES_MIGRATION) {
    try {
      // @ts-ignore
      const toutesLesDonneesLocales = await db[table.locale].toArray();
      
      // On accepte indifféremment "local" ou "pending" ou vide pour ne rien bloquer
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

          // Correction universelle du champ reference_paiement
          if ("reference_paiement" in baseRow) {
            baseRow.reference = baseRow.reference_paiement;
            delete baseRow.reference_paiement;
          }

          // Si l'ID local est un UUID (string avec tiret) et que Supabase attend un BigInt
          if (typeof id === "string" && id.includes("-")) {
            // On laisse Supabase attribuer l'ID BigInt automatiquement (Option recommandée)
          } else {
            baseRow.id = id;
          }

          return baseRow;
        });

        const { error } = await supabase.from(table.serveur).upsert(donneesPropres);

        if (error) {
          console.error(`❌ Erreur d'envoi Supabase [${table.serveur}] :`, error.message);
          throw error;
        }

        // On marque le local en "synced"
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
  console.log("📥 Rafraîchissement du cache depuis le Cloud...");
  for (const table of TABLES_MIGRATION) {
    try {
      const { data, error } = await supabase.from(table.serveur).select("*").eq("utilisateur_id", userId);
      if (error) throw error;

      const donneesFormatees = (data || []).map((item: any) => ({
        ...item,
        statut_synchro: "synced"
      }));

      // @ts-ignore
      await db[table.locale].where("utilisateur_id").equals(userId).delete();
      if (donneesFormatees.length > 0) {
        // @ts-ignore
        await db[table.locale].bulkPut(donneesFormatees);
      }
    } catch (err) {
      console.error(`Erreur hydratation ${table.locale} :`, err);
    }
  }
}

export async function executionSynchronisationGlobale(userId: string, anneeId: string) {
  try {
    await exporterDonneesLocales(userId);
    await hydraterBaseLocale(userId);
    console.log("🔄 Synchronisation globale bidirectionnelle terminée.");
  } catch (error) {
    console.error("Échec synchro globale :", error);
  }
}

export const synchroniserFacturesVersCloud = async (userId: string): Promise<void> => {
  try {
    console.log("Début de la synchronisation des factures pour :", userId);
    const dexieDb = db as any;

    // 1. Récupérer toutes les factures locales en attente
    const facturesAEnvoyer = await dexieDb["gf_factures"]
      .where("utilisateur_id")
      .equals(userId)
      .filter((item: any) => item.statut_synchro === "local")
      .toArray();

    if (facturesAEnvoyer.length === 0) {
      console.log("📥 Aucune facture locale à synchroniser.");
      return;
    }

    // 2. Préparer les données épurées (on retire le champ local 'statut_synchro')
    const payloads = facturesAEnvoyer.map((facture: any) => {
      return {
        id: facture.id, // Garde l'ID numérique généré localement pour éviter les doublons
        utilisateur_id: facture.utilisateur_id,
        client_nom: facture.client_nom,
        total_ttc: facture.total_ttc,
        total_ht: facture.total_ht || facture.total_ttc, // Fallback si total_ht est absent
        benefice_realise: facture.benefice_realise || 0,
        statut: facture.statut || "payee",
        created_at: facture.cree_le || new Date().toISOString()
      };
    });

    // 3. Envoyer en masse (Bulk Upsert) vers Supabase
    const { error } = await supabase
      .from("gf_factures")
      .upsert(payloads, { onConflict: "id" }); // Écrase ou insère selon l'identifiant unique

    if (!error) {
      // 4. Si Supabase valide la réception, on passe toutes ces factures en "synced" localement
      const idsSynchronises = facturesAEnvoyer.map((f: any) => f.id);
      
      await dexieDb["gf_factures"]
        .where("id")
        .anyOf(idsSynchronises)
        .modify({ statut_synchro: "synced" });

      console.log(`✅ ${idsSynchronises.length} facture(s) synchronisée(s) avec succès sur le Cloud !`);
    } else {
      console.error("❌ Erreur Supabase lors de l'upsert des factures :", error.message);
    }

  } catch (error) {
    console.error("Erreur critique lors de la synchronisation des factures :", error);
  }
};

