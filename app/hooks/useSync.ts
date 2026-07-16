import { db as baseDb } from "../lib/db";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const db = baseDb as any;

export async function declencherSynchronisation() {
  // 1. Première vérification de la carte réseau standard
  if (!navigator.onLine) {
    console.log("❌ Hors ligne (Carte réseau inactive). Annulation de la synchro.");
    return;
  }

  // 2. 💡 LE BLINDAGE REEL : On vérifie si on accède VRAIMENT aux serveurs distants de Supabase
  try {
    const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!urlSupabase) return;
    
    // On effectue un HEAD request ultra-léger sur l'endpoint REST de Supabase pour valider le réseau
    const verifReseau = await fetch(`${urlSupabase}/rest/v1/`, { method: "HEAD", mode: "no-cors" });
    if (!verifReseau) throw new Error("Pas de réponse Internet de Supabase");
  } catch (pingError) {
    console.log("🔌 Vrai Internet absent (Impossible de joindre Supabase). Mode hors-ligne strict conservé.");
    return; // ⛔ COUPURE DIRECTE : Le script s'arrête ici et ne touchera JAMAIS aux statuts Dexie en local !
  }

  console.log("🌐 Vrai Internet détecté et Supabase accessible ! Lancement de la synchronisation...");

  // 3. 🛠️ AJOUT COMPILATION : Déclaration de la fonction interne de nettoyage des identifiants (UUID vs BigInt)
  const preparerPayload = (item: any) => {
    if (item && typeof item.id === "string" && item.id.includes("-")) {
      const { id, statut_synchro, ...reste } = item;
      return reste; // Envoie sans l'id texte temporaire pour laisser Supabase attribuer un BigInt auto-incrémenté
    }
    const { statut_synchro, ...reste } = item;
    return { id: item.id, ...reste };
  };

  // --- 1. SYNCHRONISATION DES FACTURES (GreenFacture) ---
  try {
    const facturesAEnvoyer = await db.gf_factures.where('statut_synchro').equals('local').toArray();
    for (const facture of facturesAEnvoyer) {
      await db.gf_factures.update(facture.id, { statut_synchro: 'en_cours' });
      
      const payload = {
        id: facture.id,
        utilisateur_id: facture.utilisateur_id,
        client_nom: facture.client_nom,
        total_ttc: facture.total_ttc,
        benefice_realise: facture.benefice_realise,
        statut: facture.statut,
        created_at: facture.cree_le
      };

      const { error } = await supabase.from("gf_factures").upsert(preparerPayload(payload));
      
      if (error) {
        console.error("Échec d'envoi facture:", error.message);
        await db.gf_factures.update(facture.id, { statut_synchro: 'local' });
        continue;
      }
      await db.gf_factures.update(facture.id, { statut_synchro: 'synced' });
    }
  } catch (err) { console.error("Erreur synchro factures:", err); }

  // --- 2. SYNCHRONISATION DES PRODUITS (GreenStock) ---
  try {
    const produitsAEnvoyer = await db.gf_produits.where('statut_synchro').equals('local').toArray();
    for (const prod of produitsAEnvoyer) {
      await db.gf_produits.update(prod.id, { statut_synchro: 'en_cours' });
      
      const payload = {
        id: prod.id,
        utilisateur_id: prod.utilisateur_id,
        nom: prod.nom,
        prix_achat: prod.prix_achat,
        prix_vente: prod.prix_vente,
        stock_actuel: prod.stock_actuel,
        stock_alerte: prod.stock_alerte
      };

      const { error } = await supabase.from("gf_produits").upsert(preparerPayload(payload));
      
      if (error) { 
        console.error("Échec d'envoi produit:", error.message);
        await db.gf_produits.update(prod.id, { statut_synchro: 'local' }); 
        continue; 
      }
      await db.gf_produits.update(prod.id, { statut_synchro: 'synced' });
    }
  } catch (err) { console.error("Erreur synchro stock:", err); }

  // --- 3. SYNCHRONISATION DES ÉLÈVES (GreenSchool) ---
  try {
    const elevesAEnvoyer = await db.gs_eleves.where('statut_synchro').equals('local').toArray();
    for (const eleve of elevesAEnvoyer) {
      await db.gs_eleves.update(eleve.id, { statut_synchro: 'en_cours' });
      
      const payload = {
        id: eleve.id,
        utilisateur_id: eleve.utilisateur_id,
        nom: eleve.nom,
        prenom: eleve.prenom,
        sexe: eleve.sexe,
        date_naissance: eleve.date_naissance,
        nom_parent: eleve.nom_parent,
        telephone_parent: eleve.telephone_parent,
        adresse: eleve.adresse
      };

      const { error } = await supabase.from("gs_eleves").upsert(preparerPayload(payload));
      
      if (error) { 
        console.error("Échec d'envoi élève:", error.message);
        await db.gs_eleves.update(eleve.id, { statut_synchro: 'local' }); 
        continue; 
      }
      await db.gs_eleves.update(eleve.id, { statut_synchro: 'synced' });
    }
  } catch (err) { console.error("Erreur synchro élèves:", err); }

  // --- 4. SYNCHRONISATION DES INSCRIPTIONS (GreenSchool) ---
  try {
    const inscriptionsAEnvoyer = await db.gs_inscriptions.where('statut_synchro').equals('local').toArray();
    for (const ins of inscriptionsAEnvoyer) {
      await db.gs_inscriptions.update(ins.id, { statut_synchro: 'en_cours' });
      
      const payload = {
        id: ins.id,
        utilisateur_id: ins.utilisateur_id,
        annee_id: ins.annee_id,
        eleve_id: ins.eleve_id,
        classe_id: ins.classe_id,
        numero_matricule: ins.numero_matricule,
        scolarite_totale: ins.scolarite_totale,
        reduction: ins.reduction
      };

      const { error } = await supabase.from("gs_inscriptions").upsert(preparerPayload(payload));
      
      if (error) { 
        console.error("Échec d'envoi inscription:", error.message);
        await db.gs_inscriptions.update(ins.id, { statut_synchro: 'local' }); 
        continue; 
      }
      await db.gs_inscriptions.update(ins.id, { statut_synchro: 'synced' });
    }
  } catch (err) { console.error("Erreur synchro inscriptions:", err); }

  // --- 5. SYNCHRONISATION DES PAIEMENTS (GreenSchool) ---
  try {
    const paiementsAEnvoyer = await db.gs_paiements.where('statut_synchro').equals('local').toArray();
    for (const paiement of paiementsAEnvoyer) {
      await db.gs_paiements.update(paiement.id, { statut_synchro: 'en_cours' });
      
      const payload = {
        id: paiement.id,
        utilisateur_id: paiement.utilisateur_id,
        inscription_id: paiement.inscription_id,
        montant: paiement.montant,
        mode_paiement: paiement.mode_paiement,
        reference: paiement.reference
      };

      const { error } = await supabase.from("gs_paiements").upsert(preparerPayload(payload));
      
      if (error) { 
        console.error("Échec d'envoi paiement:", error.message);
        await db.gs_paiements.update(paiement.id, { statut_synchro: 'local' }); 
        continue; 
      }
      await db.gs_paiements.update(paiement.id, { statut_synchro: 'synced' });
    }
  } catch (err) { console.error("Erreur synchro paiements:", err); }

  // --- 6. SYNCHRONISATION DES ENSEIGNANTS (GreenSchool) ---
  try {
    const enseignantsAEnvoyer = await db.gs_enseignants.where('statut_synchro').equals('local').toArray();
    for (const ens of enseignantsAEnvoyer) {
      await db.gs_enseignants.update(ens.id, { statut_synchro: 'en_cours' });
      
      const payload = {
        id: ens.id,
        utilisateur_id: ens.utilisateur_id,
        nom: ens.nom,
        prenom: ens.prenom,
        telephone: ens.telephone,
        email: ens.email,
        specialite: ens.specialite
      };

      const { error } = await supabase.from("gs_enseignants").upsert(preparerPayload(payload));
      
      if (error) { 
        console.error("Échec d'envoi enseignant:", error.message);
        await db.gs_enseignants.update(ens.id, { statut_synchro: 'local' }); 
        continue; 
      }
      await db.gs_enseignants.update(ens.id, { statut_synchro: 'synced' });
    }
  } catch (err) { console.error("Erreur synchro enseignants:", err); }

  console.log("✅ Cycle de synchronisation terminé.");
}
