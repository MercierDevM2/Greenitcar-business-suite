export default function DashboardPage() {
  // Données fictives pour modéliser vos différents modules
  const stats = [
    { title: "Véhicules actifs", value: "0", change: "Inventaire", color: "text-blue-600" },
    { title: "CO2 Économisé", value: "0 kg", change: "Rapport", color: "text-emerald-600" },
    { title: "Factures en attente", value: "0", change: "Facturation", color: "text-amber-600" },
    { title: "Personnel inscrit", value: "1", change: "Équipe", color: "text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Titre et Message de Bienvenue */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Tableau de bord
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
          Bienvenue dans votre espace GreenItCar Business Suite. Voici l'état de votre activité aujourd'hui.
        </p>
      </div>

      {/* Grille de statistiques rapides (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm"
          >
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {stat.title}
            </p>
            <p className={`text-3xl font-bold mt-2 ${stat.color}`}>
              {stat.value}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 flex items-center">
              📁 Module : <span className="font-medium ml-1 text-slate-700 dark:text-slate-300">{stat.change}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Zone centrale d'onboarding (Pour guider l'utilisateur) */}
      <div className="p-8 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-2xl border border-emerald-500/20 dark:border-emerald-500/10">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
          🚀 Configurez votre Suite Business
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-2 max-w-xl">
          Votre compte est créé avec succès. Pour commencer à mesurer l'empreinte carbone et optimiser vos déplacements, complétez les trois étapes initiales.
        </p>
        
        <div className="mt-6 space-y-3 max-w-md">
          <div className="flex items-center space-x-3 text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
            <input type="checkbox" checked readOnly className="rounded text-emerald-600" />
            <span className="text-slate-400 line-through">Créer le profil entreprise</span>
          </div>
          <div className="flex items-center space-x-3 text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
            <input type="checkbox" disabled className="rounded" />
            <span className="font-medium">Ajouter un premier véhicule (Inventaire / Stock)</span>
          </div>
          <div className="flex items-center space-x-3 text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
            <input type="checkbox" disabled className="rounded" />
            <span className="font-medium">Inviter un collaborateur (Personnel)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
