import Dexie from 'dexie';

export const db = new Dexie('GreenItCarDB');

// Définition de la structure de la base locale (V1)
// Note : Dexie n'a besoin que de l'indexation de la clé primaire et des champs de recherche
db.version(1).stores({
  // Table Profil / Session utilisateur
  utilisateurs: 'id, email, services_choisis, nom_entreprise',

  // --- MODULE COMMERCE (GreenFacture & GreenStock) ---
  gf_factures: 'id, utilisateur_id, client_nom, total_ttc, statut_synchro, cree_le',
  gf_produits: 'id, utilisateur_id, nom, stock_actuel, statut_synchro',

  // --- MODULE ÉCOLE (GreenSchool) ---
  gs_annees_scolaires: 'id, utilisateur_id, libelle, active, statut_synchro',
  gs_classes: 'id, utilisateur_id, annee_id, nom, statut_synchro',
  gs_eleves: 'id, utilisateur_id, nom, prenom, statut_synchro',
  gs_inscriptions: 'id, utilisateur_id, eleve_id, classe_id, annee_id, statut_synchro',
  gs_paiements: 'id, utilisateur_id, inscription_id, montant, statut_synchro',
  gs_enseignants: 'id, utilisateur_id, nom, statut_synchro',

  // --- 🚨 AJOUTS REQUIS POUR LES AUTRES MODULES DU DASHBOARD ---
  gp_employes: 'id, utilisateur_id, statut_synchro',
  ga_patrimoine: 'id, utilisateur_id, statut_maintenance, statut_synchro',
  gc_patients_consultations: 'id, utilisateur_id, type_evenement, statut_synchro',
  gpt_pointages: 'id, utilisateur_id, est_en_retard, date_jour, statut_synchro',
  gd_missions_archives: 'id, utilisateur_id, statut_synchro',

  // Security & Licence
  securite_licence: 'id, derniere_date_vue, heures_travaillees'
});
