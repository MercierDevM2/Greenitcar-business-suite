"use client";

import { useEffect, useState, ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [activeServices, setActiveServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function fetchUserServices() {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Sécurité 1 : Si l'utilisateur n'est pas connecté, retour à la connexion
      if (!user) {
        router.push("/connexion");
        return;
      }

      const { data } = await supabase
        .from("utilisateurs")
        .select("services_choisis")
        .eq("id", user.id)
        .single();
      
      if (data?.services_choisis) {
        setActiveServices(data.services_choisis);
        
        // Sécurité 2 : Bloquer l'accès manuel par URL si le service n'est pas choisi
        const currentModule = pathname.split("/")[2]; // récupère 'school', 'stock', etc.
        
        const routesAutoriseesSansModule = ["notifications", "profil", "parametres", undefined];

        if (!routesAutoriseesSansModule.includes(currentModule)) {
          // Mapping strict entre le sous-dossier URL et l'ID du service choisi
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
            router.push("/dashboard"); // Redirection immédiate si non autorisé
          }
        }
      }
      setLoading(false);
    }
    fetchUserServices();
  }, [pathname, router]);

  // Organisation de vos 9 choix sous forme de catégories métiers claires
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
              // Filtrer les items visibles selon les droits de l'utilisateur
              const itemsVisibles = section.items.filter(
                (item) => item.id === "always" || activeServices.includes(item.id)
              );

              // Masquer complètement une catégorie si elle n'a aucun module actif pour ce client
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

        {/* Bouton déconnexion fixé en bas */}
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
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            GIT
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
