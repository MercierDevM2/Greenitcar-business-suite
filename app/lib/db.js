import Dexie from 'dexie';

export const db = new Dexie('GreenItCarDB');

// --- VERSION 1 (Historique) ---
db.version(1).stores({
  utilisateurs: 'id, email, services_choisis, nom_entreprise',
  gf_factures: 'id, utilisateur_id, client_nom, total_ttc, statut_synchro, cree_le',
  gf_produits: 'id, utilisateur_id, nom, stock_actuel, statut_synchro',
  gs_annees_scolaires: 'id, utilisateur_id, libelle, active, statut_synchro',
  gs_classes: 'id, utilisateur_id, annee_id, nom, statut_synchro',
  gs_eleves: 'id, utilisateur_id, nom, prenom, statut_synchro',
  gs_inscriptions: 'id, utilisateur_id, eleve_id, classe_id, annee_id, statut_synchro',
  gs_paiements: 'id, utilisateur_id, inscription_id, montant, statut_synchro',
  gs_enseignants: 'id, utilisateur_id, nom, statut_synchro',
  gp_employes: 'id, utilisateur_id, statut_synchro',
  ga_patrimoine: 'id, utilisateur_id, statut_maintenance, statut_synchro',
  gc_patients_consultations: 'id, utilisateur_id, type_evenement, statut_synchro',
  gpt_pointages: 'id, utilisateur_id, est_en_retard, date_jour, statut_synchro',
  gd_missions_archives: 'id, utilisateur_id, statut_synchro',
  securite_licence: 'id, derniere_date_vue, heures_travaillees'
});

// --- 🎯 VERSION 2 : AJOUT DE LA TABLE MANQUANTE POUR LES ARTICLES DES FACTURES ---
db.version(2).stores({
  // On déclare uniquement la table ajoutée ou modifiée, Dexie conserve le reste
  gf_facture_items: 'id, utilisateur_id, facture_id, produit_id, statut_synchro'
});
