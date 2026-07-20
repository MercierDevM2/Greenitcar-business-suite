import { db as baseDb } from "../lib/db";
import { supabase } from "../utils/supabase";
const db = baseDb as any;

export async function declencherSynchronisation() {
  // 1. Première vérification de la carte réseau standard
  if (!navigator.onLine) {
    console.log("❌ Hors ligne (Carte réseau inactive). Annulation de la synchro.");
    return;
  }

  // 2. LE BLINDAGE RÉEL : On vérifie si on accède VRAIMENT aux serveurs distants de Supabase
  try {
    const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!urlSupabase) return;
    
    const verifReseau = await fetch(`${urlSupabase}/rest/v1/`, { method: "HEAD", mode: "no-cors" });
    if (!verifReseau) throw new Error("Pas de réponse Internet de Supabase");
  } catch (pingError) {
    console.log("🔌 Vrai Internet absent (Impossible de joindre Supabase). Mode hors-ligne strict conservé.");
    return; 
  }

  console.log("🌐 Vrai Internet détecté et Supabase accessible ! Lancement de la synchronisation...");

  // 3. Nettoyage propre du payload (Retire uniquement le statut de synchro local)
  const preparerPayload = (item: any) => {
    if (!item) return {};
    const { statut_synchro, ...reste } = item;
    return reste; // On conserve l'ID généré en local pour l'envoyer au Cloud
  };

  // ==========================================
  // --- MODULE 1 : GREENSTOCK & GREENFACTURE ---
  // ==========================================

  // --- 1. SYNCHRONISATION DES PRODUITS (GreenStock) ---
  try {
    const produitsAEnvoyer = await db.gf_produits.where('statut_synchro').equals('local').toArray();
    for (const prod of produitsAEnvoyer) {
      await db.gf_produits.update(prod.id, { statut_synchro: 'en_cours' });
      
      const payload = {
        id: prod.id,
        utilisateur_id: prod.utilisateur_id,
        nom: prod.nom,
        prix_achat: Number(prod.prix_achat) || 0,
        prix_vente: Number(prod.prix_vente) || 0,
        stock_initial: Number(prod.stock_initial) || Number(prod.stock_actuel) || 0,
        stock_actuel: Number(prod.stock_actuel) || 0,
        stock_alerte: Number(prod.stock_alerte) || 0,
        unite_mesure: prod.unite_mesure || "Sac"
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

  // --- 2. SYNCHRONISATION DES FACTURES (GreenFacture) ---
  try {
    const facturesAEnvoyer = await db.gf_factures.where('statut_synchro').equals('local').toArray();
    for (const facture of facturesAEnvoyer) {
      await db.gf_factures.update(facture.id, { statut_synchro: 'en_cours' });
      
      const payload = {
        id: facture.id,
        utilisateur_id: facture.utilisateur_id,
        client_nom: facture.client_nom,
        total_ttc: Number(facture.total_ttc) || 0,
        total_ht: Number(facture.total_ht) || 0,
        benefice_realise: Number(facture.benefice_realise) || 0,
        statut: facture.statut || "payee",
        created_at: facture.cree_le || facture.created_at || new Date().toISOString()
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

  // --- 2b. AJOUTÉ : SYNCHRONISATION DES ITEMS DE FACTURES ---
  try {
    if (db["gf_facture_items"]) {
      const itemsAEnvoyer = await db.gf_facture_items.where('statut_synchro').equals('local').toArray();
      
      for (const item of itemsAEnvoyer) {
        await db.gf_facture_items.update(item.id, { statut_synchro: 'en_cours' });
        
        const payload = {
          id: item.id,
          utilisateur_id: item.utilisateur_id,
          facture_id: item.facture_id,
          produit_id: item.produit_id,
          quantite: Number(item.quantite) || 0,
          prix_unitaire: Number(item.prix_unitaire) || 0
        };

        const { error } = await supabase.from("gf_facture_items").upsert(preparerPayload(payload));
        
        if (error) {
          console.error("Échec d'envoi item facture:", error.message);
          await db.gf_facture_items.update(item.id, { statut_synchro: 'local' });
          continue;
        }
        await db.gf_facture_items.update(item.id, { statut_synchro: 'synced' });
      }
    }
  } catch (err) { console.error("Erreur synchro items factures:", err); }


  // ==========================================
  // --- MODULE 2 : GREENSCHOOL ----------------
  // ==========================================

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
