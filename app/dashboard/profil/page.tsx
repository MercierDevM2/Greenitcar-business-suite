"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../utils/supabase";
import { db } from "../../lib/db";


interface UserCompanyProfile {
  id: string;
  nom_entreprise: string;
  email: string;
  telephone: string;
  nom: string;
  prenom: string;
  numero_registre_du_commerce: string;
  services_choisis: string[];
  secteur_activite?: string;
  nombre_employe?: string;
}

export default function ProfilPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | null; text: string }>({ type: null, text: "" });
  const [tasks, setTasks] = useState<any[]>([]);

  const [profile, setProfile] = useState<UserCompanyProfile>({
    id: "",
    nom_entreprise: "",
    email: "",
    telephone: "",
    nom: "",
    prenom: "",
    numero_registre_du_commerce: "",
    services_choisis: [],
    secteur_activite: "",
    nombre_employe: "",
  });


  interface DailyTask {
  date: string;
  count: number;
  label: string;
}

  // 🌟 NOUVEAU : Sauvegarde de l'email d'origine pour détecter un changement
  const [initialEmail, setInitialEmail] = useState("");

  useEffect(() => {
  async function chargerProfilUtilisateur() {
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError || !session) {
        router.push("/login");
        return;
      }

      // 🛠️ FIX USERID : On extrait et stabilise la variable unique
      const currentUserId = session.user.id;
      const userAuthEmail = session.user.email || "";

      // Requête ciblée sur votre table "utilisateurs"
      const { data, error: dbError } = await supabase
        .from("utilisateurs") 
        .select("*")
        .eq("id", currentUserId)
        .single();

      if (dbError) {
        console.error("Erreur de récupération table [utilisateurs]:", dbError.message);
        setProfile((prev) => ({
          ...prev,
          id: currentUserId,
          email: userAuthEmail,
          nom: session.user.user_metadata?.nom || "",
          prenom: session.user.user_metadata?.prenom || "",
        }));
        setInitialEmail(userAuthEmail);
      } else if (data) {
        const loadedEmail = data.email || userAuthEmail;
        setProfile({
          id: data.id,
          nom_entreprise: data.nom_entreprise || "",
          email: loadedEmail,
          telephone: data.telephone || "",
          nom: data.nom || "",
          prenom: data.prenom || "",
          numero_registre_du_commerce: data.numero_registre_du_commerce || "",
          services_choisis: Array.isArray(data.services_choisis) 
            ? data.services_choisis 
            : data.services_choisis ? String(data.services_choisis).split(", ") : [],
        });
        setInitialEmail(loadedEmail);
      }

      // 📊 ALGORITHME UNIFIÉ : Appel de la compilation avec la variable stabilisée
      const joursSemaine = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
      const structureTaches: { [key: string]: { count: number; actions: Set<string> } } = {};
      
      for (let i = 4; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const nomJour = joursSemaine[d.getDay()];
        structureTaches[nomJour] = { count: 0, actions: new Set() };
      }

      // 🛠️ FIX DB : Appel sécurisé des tables Dexie locales de l'utilisateur
           const [
        inscriptions, eleves, paiements, enseignants, classes,
        factures, produits
      ] = await Promise.all([
        (db as any)["gs_inscriptions"]?.where("utilisateur_id").equals(currentUserId).toArray() || Promise.resolve([]),
        (db as any)["gs_eleves"]?.where("utilisateur_id").equals(currentUserId).toArray() || Promise.resolve([]),
        (db as any)["gs_paiements"]?.where("utilisateur_id").equals(currentUserId).toArray() || Promise.resolve([]),
        (db as any)["gs_enseignants"]?.where("utilisateur_id").equals(currentUserId).toArray() || Promise.resolve([]),
        (db as any)["gs_classes"]?.where("utilisateur_id").equals(currentUserId).toArray() || Promise.resolve([]),
        (db as any)["gf_factures"]?.where("utilisateur_id").equals(currentUserId).toArray() || Promise.resolve([]),
        (db as any)["gf_produits"]?.where("utilisateur_id").equals(currentUserId).toArray() || Promise.resolve([]),
      ]);


      const traiterCollection = (collection: any[], labelAction: string) => {
        collection.forEach((item) => {
          const dateItem = item.created_at || item.date_creation || item.date_facture;
          const d = dateItem ? new Date(dateItem) : new Date();
          const nomJour = joursSemaine[d.getDay()];

          if (structureTaches[nomJour]) {
            structureTaches[nomJour].count += 1;
            structureTaches[nomJour].actions.add(labelAction);
          }
        });
      };

      if (inscriptions.length) traiterCollection(inscriptions, "Inscriptions scolaires");
      if (eleves.length)        traiterCollection(eleves, "Fiches Élèves");
      if (paiements.length)     traiterCollection(paiements, "Paiements reçus");
      if (enseignants.length)   traiterCollection(enseignants, "Personnel Enseignant");
      if (classes.length)       traiterCollection(classes, "Configurations Classes");
      if (factures.length)      traiterCollection(factures, "Émissions Factures");
      if (produits.length)      traiterCollection(produits, "Mises à jour Stocks");

      const donneesCompilees = Object.keys(structureTaches).map((jour) => {
        const actionsUniques = Array.from(structureTaches[jour].actions);
        let descriptif = "Aucune activité enregistrée";
        
        if (actionsUniques.length > 0) {
          descriptif = actionsUniques.slice(0, 2).join(" & ");
          if (actionsUniques.length > 2) descriptif += " ...";
        }

        return {
          date: jour,
          count: structureTaches[jour].count,
          label: descriptif
        };
      });

      // 🛠️ FIX TASKS : Enregistrement de l'état sans alerte TypeScript
      setTasks(donneesCompilees);

    } catch (err) {
      console.error("Erreur système lors du chargement :", err);
    } finally {
      setLoading(false);
    }
  }

  chargerProfilUtilisateur();
}, [router]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setStatus({ type: null, text: "" });

    try {
      const emailAChange = profile.email.trim() !== initialEmail;

      // 1. Mise à jour de la table PostgreSQL "utilisateurs"
      const { error: dbError } = await supabase
        .from("utilisateurs")
        .update({
          nom_entreprise: profile.nom_entreprise,
          telephone: profile.telephone,
          nom: profile.nom,
          prenom: profile.prenom,
          numero_registre_du_commerce: profile.numero_registre_du_commerce,
          email: profile.email, // Sauvegarde immédiate du nouvel e-mail
        })
        .eq("id", profile.id);

      if (dbError) throw dbError;

      // 2. Si l'e-mail a changé, on déclenche l'envoi de l'OTP par Supabase et on redirige
      if (emailAChange) {
        const { error: authUpdateError } = await supabase.auth.updateUser({
          email: profile.email.trim(),
        });

        if (authUpdateError) throw authUpdateError;

        // Redirection immédiate vers la page de connexion en passant le nouvel e-mail et le mode
        router.push(`/connexion?email=${encodeURIComponent(profile.email.trim())}&mode=email_change`);
        return;
      }
      
      setInitialEmail(profile.email);
      setStatus({ type: "success", text: "🎉 Modifications enregistrées avec succès !" });
    } catch (err: any) {
      setStatus({ type: "error", text: err.message || "Erreur lors de la mise à jour." });
    } finally {
      setUpdating(false);
    }
  };


  const handleLogout = async () => {
    const confirmer = confirm("Voulez-vous vous déconnecter de votre espace ?");
    if (!confirmer) return;
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 text-sm text-slate-500">
        Chargement de vos données d'organisation...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12 text-slate-800 dark:text-slate-200">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* En-tête de page */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Mon Profil Entreprise</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Consultez et éditez les configurations de votre structure.</p>
          </div>
          
          {/* Liste dynamique des modules activés */}
          <div className="flex flex-wrap gap-2">
            {profile.services_choisis.map((service) => (
              <span 
                key={service} 
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200/60"
              >
                {service === "school" ? "🏫 GreenSchool" : service === "facture" ? "💳 GreenFacture" : service}
              </span>
            ))}
            {profile.services_choisis.length === 0 && (
              <span className="text-xs text-slate-400 italic bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-full">
                Aucun module activé
              </span>
            )}
          </div>
        </div>

        {/* Bannière de notification d'état */}
        {status.text && (
          <div className={`p-4 rounded-xl text-sm font-medium border ${
            status.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900" 
              : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900"
          }`}>
            {status.text}
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-6">
          
         {/* Section 1 : Informations Structure */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              🏢 Structure de l'organisation
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Nom de l'entreprise</label>
                <input
                  type="text"
                  value={profile.nom_entreprise}
                  onChange={(e) => setProfile({ ...profile, nom_entreprise: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1">N° Registre du Commerce (RC)</label>
                <input
                  type="text"
                  value={profile.numero_registre_du_commerce}
                  onChange={(e) => setProfile({ ...profile, numero_registre_du_commerce: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Secteur d'activité *</label>
                <select
                  name="secteur_activite"
                  value={profile.secteur_activite}
                  onChange={(e) => setProfile({ ...profile, secteur_activite: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 dark:text-slate-100 dark:bg-slate-900"
                >
                  <option value="">Sélectionnez un secteur</option>
                  <option value="sante_medical">Santé / Médical</option>
                  <option value="humanitaire_ong">Humanitaire / ONG</option>
                  <option value="commerce_vente">Commerce / Vente au détail</option>
                  <option value="informatique_tech">Informatique / Technologies</option>
                  <option value="administration_publique">Administration / Secteur public</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Nombre d'employés</label>
                <select
                  name="nombre_employe"
                  value={profile.nombre_employe}
                  onChange={(e) => setProfile({ ...profile, nombre_employe: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 dark:text-slate-100 dark:bg-slate-900"
                >
                  <option value="">Sélectionnez</option>
                  <option value="1-10">1-10</option>
                  <option value="11-50">11-50</option>
                  <option value="51-200">51-200</option>
                  <option value="200+">200+</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2 : Gérant de compte */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              👤 Administrateur principal
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Prénom</label>
                <input
                  type="text"
                                    value={profile.nom}
                  onChange={(e) => setProfile({ ...profile, nom: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Téléphone de contact</label>
                <input
                  type="tel"
                  value={profile.telephone}
                  onChange={(e) => setProfile({ ...profile, telephone: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Email du compte</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 dark:text-slate-100"
                />
                <p className="text-[10px] text-amber-500 mt-1 italic">
                  ⚠️ En modifiant cet e-mail, un code de validation OTP sera envoyé à la nouvelle adresse pour confirmer le changement.
                </p>
              </div>
            </div>
          </div>

        <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
              >
                Retour
              </button>

              <button
                type="submit"
                disabled={updating}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700 dark:hover:bg-emerald-800 rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {updating ? "Enregistrement..." : "Sauvegarder les modifications"}
              </button>
            </div>
          {/* 📊 SECTION ENRICHIE : Activité Globale Multi-Modules (School & Facture) */}
          <div 
            id="taches"
          className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  📈 Volume d'activité des modules
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">Flux d'actions consolidé (Scolaire, Facturation & Stocks).</p>
              </div>
              <span className="self-start sm:self-auto text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400">
                Suivi réel sur 5 jours
              </span>
            </div>

                        {/* Rendu visuel du diagramme autonome */}
            <div className="pt-4">
              <div className="h-40 flex items-end gap-3 sm:gap-6 border-b border-slate-100 dark:border-slate-800/60 pb-2 px-2">
                {tasks.map((task: any, index: number) => {
                  
                  // Trouve dynamiquement le maximum de la semaine pour calculer l'échelle de hauteur
                  const maxActionsSemaine = Math.max(...tasks.map((t: any) => t.count), 1);
                  const heightPercent = (task.count / maxActionsSemaine) * 100;
                  
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end relative">
                      
                      {/* 🌟 TOOLTIP ENRICHI : Affiche le nombre ET la liste des tâches au survol */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 dark:bg-slate-700 text-white text-[10px] p-2 rounded-xl absolute mb-16 shadow-lg z-10 pointer-events-none w-48 text-center border border-slate-700/50 dark:border-slate-600/50">
                        <p className="font-bold text-emerald-400">{task.count} opération(s)</p>
                        <p className="text-slate-300 text-[9px] mt-0.5 whitespace-normal leading-tight font-medium">
                          {task.label}
                        </p>
                      </div>
                      
                      {/* Barre de progression */}
                      <div 
                        style={{ height: `${Math.max(heightPercent, task.count > 0 ? 8 : 2)}%` }} 
                        className="w-full bg-gradient-to-t from-emerald-500 to-teal-400 dark:from-emerald-600 dark:to-teal-500 rounded-t-lg transition-all duration-500 hover:brightness-110 shadow-sm cursor-pointer"
                      ></div>
                      
                      {/* Label du jour */}
                      <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        {task.date}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>


            {/* Journal d'audit descriptif sous le graphique */}
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Journal des tâches</h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {tasks.map((task, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${task.count > 0 ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-800"}`}></span>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">{task.date}</p>
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-normal hidden sm:inline">
                        — {task.label}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 px-2 py-0.5 rounded-lg text-slate-600 dark:text-slate-400">
                      {task.count} enregistrement(s)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>


          {/* Actions de pied de page */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 rounded-xl border border-red-200/50 dark:border-red-950/50 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            >
              Déconnexion
            </button>
          </div>
        </form>

      </div>
    </main>
  );
}
