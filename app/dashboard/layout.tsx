"use client";

import { useEffect, useState, ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { hydraterBaseLocale } from "../lib/syncService"; // Import du service d'aspiration de données
import { declencherSynchronisation } from "../hooks/useSync"; // Import du déclencheur de synchro montante
import { db as baseDb } from "../lib/db";
const db = baseDb as any; // Désactive le contrôle strict de type sur cet objet

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [activeServices, setActiveServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSync, setLoadingSync] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof window !== "undefined" ? navigator.onLine : true);
  
  const router = useRouter();
  const pathname = usePathname();

  // Écouteur d'état du réseau internet
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      declencherSynchronisation(); // Pousse les modifications locales vers Supabase dès qu'internet revient
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
  const verifierFraudeEtLicence = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user) return;

    const dateSystemePC = new Date();
    
    // 1. Lire les dernières infos de sécurité stockées dans le disque dur du PC
    const configLocale = await db['securite_licence'].get('statut_verrou');
    
    if (configLocale) {
      const ancienneDatePC = new Date(configLocale.derniere_date_vue);
      
      // TRICHE 1 : L'utilisateur a reculé l'heure de son Windows pour étendre sa licence en espèces
      if (dateSystemePC < ancienneDatePC) {
        router.push("/bloque?raison=clock_fraud");
        return;
      }
    }

    // 2. Mettre à jour la date locale sur le PC (chaque minute par exemple)
    await db.securite_licence.put({
      id: 'statut_verrou',
      derniere_date_vue: dateSystemePC.toISOString()
    });
    
          // --- TRICHE 2 : Le PC est resté hors-ligne trop longtemps pour ne pas recevoir l'ordre de blocage du cloud ---
      // @ts-ignore
      const uId = user?.id;
      
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

  // Exécuter la vérification au démarrage et toutes les 5 minutes
  verifierFraudeEtLicence();
  const interval = setInterval(verifierFraudeEtLicence, 5 * 60 * 1000);
  return () => clearInterval(interval);
}, []);


  useEffect(() => {
    async function fetchUserServicesAndHydrate() {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Sécurité 1 : Si l'utilisateur n'est pas connecté, retour à la connexion
      if (!user) {
        router.push("/connexion");
        return;
      }

      // --- HYDRATATION EN AMONT POUR LE MODE HORS-LIGNE ---
      const dejaHydrate = localStorage.getItem(`greenitcar_hydrated_${user.id}`);
      if (!dejaHydrate && navigator.onLine) {
        setLoadingSync(true);
        await hydraterBaseLocale(user.id); // Copie toutes les tables Supabase sur IndexedDB
        setLoadingSync(false);
      }

      const { data } = await supabase
        .from("utilisateurs")
        .select("services_choisis")
        .eq("id", user.id)
        .single();
      
      if (data?.services_choisis) {
        setActiveServices(data.services_choisis);
        
        // Sécurité 2 : Bloquer l'accès manuel par URL si le service n'est pas choisi
        const currentModule = pathname.split("/")[2]; 
        
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
          
          if (requiredModuleId && !data.services_choisis.includes(requiredModuleId)) {
            router.push("/dashboard"); 
          }
        }
      }
      setLoading(false);
    }
    fetchUserServicesAndHydrate();
  }, [pathname, router]);

  // Organisation des catégories métiers
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
      category: "Solutions Métiers Spécialisées",
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

              return (
                <div key={sIdx} className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3">
                    {section.category}
                  </p>
                  <ul className="space-y-1">
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
            Espace Entreprise Activé
          </div>
          
          {/* Badge de connectivité anti-délestage */}
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
              isOnline 
                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30" 
                : "bg-amber-500/10 text-amber-500 border border-amber-500/30 animate-pulse"
            }`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`}></span>
              {isOnline ? "En ligne" : "Mode local"}
            </div>

            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              GIT
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
