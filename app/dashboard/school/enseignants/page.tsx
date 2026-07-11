"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ListeEnseignantsPage() {
  const router = useRouter();
  const [enseignants, setEnseignants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchEnseignants() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");

      const { data: corpsProforal } = await supabase
        .from("gs_enseignants")
        .select("id, nom, prenom, telephone, email, specialite")
        .eq("utilisateur_id", user.id)
        .order("nom");

      setEnseignants(corpsProforal || []);
      setLoading(false);
    }

    fetchEnseignants();
  }, [router]);

  // Recherche dynamique
  const profsFiltres = enseignants.filter((prof) => 
    prof.nom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    prof.prenom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    prof.specialite?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center text-sm">Chargement du corps enseignant...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Entête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Registre du Corps Enseignant</h1>
          <p className="text-xs text-gray-500 mt-1">Gérez le personnel éducatif et leurs spécialités de cours.</p>
        </div>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
        >
          ← Retour au Tableau de bord
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <input
          type="text"
          placeholder="Rechercher un enseignant par nom, prénom ou matière enseignée..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border p-2.5 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Tableau des enseignants */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-100 text-slate-500 font-medium">
                <th className="p-4">Enseignant</th>
                <th className="p-4">Matière / Spécialité</th>
                <th className="p-4">Numéro de Téléphone</th>
                <th className="p-4">Adresse Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {profsFiltres.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-400 italic">
                    Aucun enseignant répertorié pour cette recherche.
                  </td>
                </tr>
              ) : (
                profsFiltres.map((prof) => (
                  <tr key={prof.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-medium text-slate-900">
                      {prof.nom} {prof.prenom}
                    </td>
                    <td className="p-4">
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-semibold">
                        {prof.specialite || "Généraliste / Non définie"}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs">{prof.telephone || "—"}</td>
                    <td className="p-4 text-gray-500 text-xs">{prof.email || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
