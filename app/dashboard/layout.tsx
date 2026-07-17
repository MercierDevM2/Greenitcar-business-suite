"use client";

import { useEffect, useState, ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { hydraterBaseLocale } from "../lib/syncService"; 
import { declencherSynchronisation } from "../hooks/useSync"; 
import { db as baseDb } from "../lib/db";

const db = baseDb as any; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [activeServices, setActiveServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSync, setLoadingSync] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof window !== "undefined" ? navigator.onLine : true);
  const [nomEntreprise, setNomEntreprise] = useState<string>("");
  const [servicesCharges, setServicesCharges] = useState<string[] | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  const [annees, setAnnees] = useState<any[]>([]);
  const [currentAnnee, setCurrentAnnee] = useState<string>("");

  // 1. GESTION DE L'ANNÉE SCOLAIRE (Hybride)
  useEffect(() => {
    async function chargerAnneeScolaire() {
      if (!navigator.onLine) {
        const dataLocale = await db.gs_annees_scolaires.toArray();
        if (dataLocale && dataLocale.length > 0) {
          setAnnees(dataLocale);
          setCurrentAnnee(dataLocale[0].id.toString());
        }
        setLoading(false);
        return;
      }

      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return;

        const { data, error: dbError } = await supabase
          .from("gs_annees_scolaires")
          .select("libelle, id")
          .eq("utilisateur_id", user.id)
          .order("id", { ascending: false });

        if (dbError) {
          console.error("Erreur Supabase Layout:", dbError.message);
          return;
        }

        if (data && data.length > 0) {
          setAnnees(data);
          setCurrentAnnee(data[0].id.toString());
        }
      } catch (e) {
        console.error("Erreur réseau annee scolaire:", e);
      } finally {
        setLoading(false);
      }
    }

    chargerAnneeScolaire();
  }, []);

  // 2. ÉCOUTEUR RÉSEAU INTERNET
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Laisse souffler le thread avant de lancer la synchro lourde
      setTimeout(() => {
        declencherSynchronisation();
      }, 1000);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 3. SÉCURITÉ FRAUDE ET LICENCE (Résilience réseau intégrée pour couper le chargement infini)
  useEffect(() => {
    const verifierFraudeEtLicence = async () => {
      // Évitement de l'appel auth Supabase si hors-ligne pour casser la boucle infinie Firefox
      // ✅ CODE CORRIGÉ
      let uId = null;
      if (navigator.onLine) {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!error && user) {
          uId = user.id;
        }
      }

      const dateSystemePC = new Date();
      const configLocale = await db['securite_licence'].get('statut_verrou');
      
      if (configLocale) {
        const ancienneDatePC = new Date(configLocale.derniere_date_vue);
        if (dateSystemePC < ancienneDatePC) {
          router.push("/bloque?raison=clock_fraud");
          return;
        }
      }

      await db.securite_licence.put({
        id: 'statut_verrou',
        derniere_date_vue: dateSystemePC.toISOString()
      });
      
      if (uId) {
        const dateDerniereSynchroCloud = localStorage.getItem(`derniere_synchro_serveur_${uId}`);
        if (dateDerniereSynchroCloud) {
          const joursDepuisSynchro = (dateSystemePC.getTime() - new Date(dateDerniereSynchroCloud).getTime()) / (1000 * 60 * 60 * 24);
          if (joursDepuisSynchro > 7) {
            router.push("/bloque?raison=sync_required");
            return;
          }
        }
      }
    };

    verifierFraudeEtLicence();
    const interval = setInterval(verifierFraudeEtLicence, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [router]);

  // 4. EFFET 1 : CHARGEMENT PROFIL ET SERVICES (Une seule fois au démarrage)
  useEffect(() => {
    async function fetchUserServicesAndHydrate() {
      if (!navigator.onLine) {
        const localUser = await db.utilisateurs.limit(1).toArray();
        if (localUser && localUser.length > 0) {
          setActiveServices(localUser[0].services_choisis || []);
          setServicesCharges(localUser[0].services_choisis || []);
          setNomEntreprise(localUser[0].nom_entreprise || "Entreprise Locale");
        }
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // Si on est sur l'écran de connexion ou d'inscription, ne pas rediriger en boucle
          if (pathname !== "/connexion" && pathname !== "/inscription") {
            router.push("/connexion");
          }
          return;
        }

        const dejaHydrate = localStorage.getItem(`greenitcar_hydrated_${user.id}`);
        if (!dejaHydrate) {
          setLoadingSync(true);
          await hydraterBaseLocale(user.id); 
          setLoadingSync(false);
        }

        const { data: userData } = await supabase
          .from("utilisateurs")
          .select("services_choisis, nom_entreprise")
          .eq("id", user.id)
          .single();
      
        if (userData) {
          if (userData.services_choisis) {
            setActiveServices(userData.services_choisis);
            setServicesCharges(userData.services_choisis);
          }
          setNomEntreprise(userData.nom_entreprise || "Entreprise");
          // Sauvegarde locale de secours pour le prochain démarrage hors-ligne
          await db.utilisateurs.put({
            id: user.id,
            services_choisis: userData.services_choisis || [],
            nom_entreprise: userData.nom_entreprise || "Entreprise"
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    fetchUserServicesAndHydrate();
  }, [router, pathname]);

  // 5. EFFET 2 : SÉCURITÉ DE ROUTAGE PAR URL (Zéro appel réseau, résout le crash de redirection)
  useEffect(() => {
    if (!servicesCharges) return; 

    const segments = pathname.split("/");
    const currentModule = segments[2]; 
    const routesAutoriseesSansModule = ["notifications", "profil", "parametres", undefined];

    if (!routesAutoriseesSansModule.includes(currentModule)) {
      const routeToModuleMap: { [key: string]: string } = {
        "factures": "facture",
        "stock": "stock",
        "personnel": "personnel",
        "inventaire": "asset",
        "school": "school",
        "clinic": "clinic",
        "pointage": "pointage",
        "rapports": "data",
        "archives": "archive"
      };

      const requiredModuleId = routeToModuleMap[currentModule];
      
      if (requiredModuleId && !servicesCharges.includes(requiredModuleId) && pathname !== "/dashboard") {
        console.log(`⛔ Accès refusé pour ${currentModule}. Redirection...`);
        router.push("/dashboard"); 
      }
    }
  }, [pathname, servicesCharges, router]);

  // Menu de navigation
  const menuConfig = [
    {
      category: "Pilotage & Décision",
      items: [
        { id: "always", name: "Vue d'ensemble", href: "/dashboard", icon: "📊" },
        { id: "data", name: "GreenData (Power BI)", href: "/dashboard/rapports", icon: "📈" }
      ]
    },
    {
      category: "Gestion Commerciale & Flux",
      items: [
        { id: "facture", name: "GreenFacture", href: "/dashboard/factures", icon: "💳" },
        { id: "stock", name: "GreenStock", href: "/dashboard/stock", icon: "📦" }
      ]
    },
    {
      category: "Ressources Humaines",
      items: [
        { id: "personnel", name: "GreenPersonnel", href: "/dashboard/personnel", icon: "👥" },
        { id: "pointage", name: "GreenPointage", href: "/dashboard/pointage", icon: "⏱️" }
      ]
    },
    {
      category: "Infrastructures & Matériels",
      items: [
        { id: "asset", name: "GreenAsset / Matériels", href: "/dashboard/inventaire", icon: "🛡️" },
        { id: "archive", name: "GreenArchive", href: "/dashboard/archives", icon: "📁" }
      ]
    },
    {
      category: "Applications Métiers",
      items: [
        { id: "school", name: "GreenSchool", href: "/dashboard/school", icon: "🏫" },
        { id: "clinic", name: "GreenClinic", href: "/dashboard/clinic", icon: "🩺" }
      ]
    },
    {
      category: "Configuration",
      items: [
        { id: "always", name: "Mon Profil", href: "/dashboard/profil", icon: "👤" },
        { id: "always", name: "Paramètres", href: "/dashboard/parametres", icon: "⚙️" }
      ]
    }
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/connexion");
  };

  // Écran de chargement de l'hydratation (Aspiration de données)
  if (loadingSync) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-6">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold">Préparation de votre espace hors-ligne...</h2>
        <p className="text-sm text-slate-400 mt-2 text-center max-w-sm">
          Nous configurons la base de données de votre PC pour vous permettre de travailler de manière sécurisée en cas de délestage.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-3">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400 font-medium">Chargement de votre Suite personnalisée...</p>
      </div>
    );
  }

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex text-slate-900 dark:text-slate-100">
        {/* Barre latérale adaptative */}
        <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between hidden md:flex">
          <div className="space-y-8 overflow-y-auto max-h-[85vh] pr-2">
            <div>
              <h2 className="text-xl font-black bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
                GreenItCar
              </h2>
              <span className="text-xs text-slate-400 font-medium">Business Suite</span>
            </div>

            <nav className="space-y-6">
              {menuConfig.map((section, sIdx) => {
              const itemsVisibles = section.items.filter(
                (item) => item.id === "always" || activeServices.includes(item.id)
              );

              if (itemsVisibles.length === 0) return null;

              // Détection calculée en direct dans la boucle
              const contientModuleSchool = section.items.some((item) => item.id === "school");

                return (
                <div key={sIdx} className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3">
                    {section.category}
                  </p>

                  {/* Liste des liens de navigation */}
                  <ul className="space-y-1 mt-1">
                    {itemsVisibles.map((item, idx) => {
                      const isActive = pathname === item.href;
                      return (
                        <li key={idx}>
                          <Link
                            href={item.href}
                            className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              isActive
                                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-l-4 border-emerald-500 rounded-l-none pl-2"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                            }`}
                          >
                            <span className="text-lg">{item.icon}</span>
                            <span>{item.name}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>

                  {contientModuleSchool && activeServices.includes("school") && (
                    <>
                      <div>
                        <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-1">
                          Année scolaire
                        </h3>
                      </div>
                      <div className="mx-3 px-2 py-1 bg-slate-100 dark:bg-slate-800/60 border border-slate-200/40 dark:border-slate-700/40 rounded-lg text-[10px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 w-fit mb-3">
                        <span>📅</span>
                        <span>
                          {annees.length > 0
                            ? (annees.find((a: any) => a.id.toString() === currentAnnee)?.libelle || annees[0].libelle)
                            : "Chargement..."}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                
              );

              })}
            </nav>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-3 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
            >
              <span>🚪</span>
              <span>Déconnexion</span>
            </button>
          </div>
        </aside>

        {/* Contenu de droite */}
        <div className="flex-1 flex flex-col min-w-0">
                    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8">
            <div className="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full text-slate-600 dark:text-slate-300">
              {/* 🎯 CORRECTIONS : Affiche le nom de l'entreprise ou un fallback si vide */}
              🏢 Espace {nomEntreprise ? nomEntreprise : "Mon Entreprise"} Activé
            </div>
            
            {/* Badge de connectivité anti-délestage */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()} // Utilise l'historique du navigateur
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border rounded-md shadow-sm hover:bg-gray-50 transition"
              >
                ⬅️ Retour
              </button>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
                isOnline 
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30" 
                  : "bg-amber-500/10 text-amber-500 border border-amber-500/30 animate-pulse"
              }`}>
                <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                {isOnline ? "En ligne" : "Mode local"}
              </div>

              {/* AVATAR DYNAMIQUE : Affiche l'initiale de l'entreprise */}
              <div 
                title={nomEntreprise} // Affiche le nom complet au survol de la souris
                className="w-8 h-8 rounded-full bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center text-white text-sm font-black shadow-sm uppercase tracking-wider cursor-help transition-transform hover:scale-105"
              >
                {nomEntreprise ? nomEntreprise.charAt(0).toUpperCase() : ""}
              </div>
            </div>
          </header>


        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
