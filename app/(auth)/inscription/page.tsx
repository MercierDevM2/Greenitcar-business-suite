"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function InscriptionPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    nom_entreprise: "",
    email: "",
    telephone: "",
    secteur_activite: "",
    nombre_employe: "",
    nom: "",
    prenom: "",
    terme: false,
    numero_registre_du_commerce: "",
  });

  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"form" | "otp" | "choix" | "success">("form");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [userId, setUserId] = useState<string>(""); 
  const [servicesSelectionnes, setServicesSelectionnes] = useState<string[]>([]);


  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked =
      type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.nom_entreprise.trim())
      newErrors.nom_entreprise = "Le nom de l'entreprise est requis";
    if (!formData.email.includes("@"))
      newErrors.email = "Email invalide";
    if (!formData.telephone) newErrors.telephone = "Le téléphone est requis";
    if (!formData.secteur_activite) newErrors.secteur_activite = "Le secteur est requis";
    if (!formData.nom.trim())
      newErrors.nom = "Le nom est requis";
    if (!formData.prenom.trim())
      newErrors.prenom = "Le prénom est requis";
    if (!formData.terme)
      newErrors.terme = "Vous devez accepter les conditions d'utilisation";
    if (!formData.numero_registre_du_commerce)
      newErrors.numero_registre_du_commerce =
        "Le numéro de registre du commerce est requis";

    return newErrors;
  };

  // --- ÉTAPE 1 : Soumission du formulaire et envoi du code OTP ---
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: formData.email,
        options: {
          shouldCreateUser: true,
          data: {
            nom: formData.nom,
            prenom: formData.prenom,
            nom_entreprise: formData.nom_entreprise,
            telephone: formData.telephone,
            secteur_activite: formData.secteur_activite,
            nombre_employe: formData.nombre_employe,
          },
        },
      });

      if (error) throw error;

      setStep("otp");
    } catch (err: any) {
      setErrors({
        global: err.message || "Une erreur est survenue lors de l'envoi du mail.",
      });
    } finally {
      setLoading(false);
    }
  };

  // --- ÉTAPE 2 : Vérification du code OTP ---
    const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    if (!otpCode.trim()) {
      setErrors({ otp: "Veuillez entrer le code de validation" });
      setLoading(false);
      return;
    }

    try {
      console.log("📧 Email:", formData.email);
      console.log("🔐 Code OTP:", otpCode);

      // 1. Double vérification automatique pour éviter le bug d'authentification Supabase
      let result = await supabase.auth.verifyOtp({
        email: formData.email,
        token: otpCode.trim(),
        type: "signup",
      });

      if (result.error) {
        result = await supabase.auth.verifyOtp({
          email: formData.email,
          token: otpCode.trim(),
          type: "email",
        });
      }

      if (result.error) throw result.error;

      // 2. Création du profil en base de données si l'authentification réussit
      if (result.data.user) {
        const { error: insertError } = await supabase
          .from("utilisateurs")
          .insert([
            {
              id: result.data.user.id,
              nom_entreprise: formData.nom_entreprise,
              email: formData.email,
              telephone: formData.telephone,
              secteur_activite: formData.secteur_activite,
              nombre_employe: formData.nombre_employe,
              nom: formData.nom,
              prenom: formData.prenom,
              services_choisis: [], // Initialisé à vide, complété à la page suivante
              numero_registre_du_commerce: formData.numero_registre_du_commerce,
            },
          ]);

        if (insertError) throw insertError;

        // 3. Redirection vers la nouvelle page de choix séparée
        router.push(`/inscription/choix?userId=${result.data.user.id}`);
      }
    } catch (err: any) {
      console.error("❌ Erreur OTP:", err);
      setErrors({ otp: "Code invalide ou expiré. Veuillez réessayer." });
    } finally {
      setLoading(false);
    }
  };


  // --- ÉTAPE 2b : Renvoyer le code OTP ---
  const handleResendOtp = async () => {
    setLoading(true);
    setErrors({});

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: formData.email,
        options: {
          shouldCreateUser: true,
          data: {
            nom: formData.nom,
            prenom: formData.prenom,
            nom_entreprise: formData.nom_entreprise,
            telephone: formData.telephone,
            secteur_activite: formData.secteur_activite,
            nombre_employe: formData.nombre_employe,
            numero_registre_du_commerce: formData.numero_registre_du_commerce,
          },
        },
      });

      if (error) throw error;

      setOtpCode("");
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setErrors({
        global: err.message || "Une erreur est survenue lors du renvoi du mail.",
      });
    } finally {
      setLoading(false);
    }
  };

  // --- RENDU ÉTAPE 3 : SUCCÈS ---
  if (step === "success") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl text-center">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center mb-4 text-white text-3xl font-bold">
                ✓
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Compte vérifié !
              </h2>
              <p className="text-slate-600 dark:text-slate-300">
                Votre entreprise est maintenant enregistrée sur GreenItCar Business Suite.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-block w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              Accéder au tableau de bord
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // --- RENDU ÉTAPE 2 : SAISIE DU CODE OTP ---
  if (step === "otp") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Vérification par email
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
              Nous avons envoyé un code de validation à{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {formData.email}
              </span>
              .
            </p>

            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-800 dark:text-slate-200 text-sm font-semibold mb-2">
                  Code de validation *
                </label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="00000000"
                  maxLength={8}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-center font-bold tracking-widest text-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
                {errors.otp && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                    {errors.otp}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Vérification...
                  </>
                ) : (
                  <>
                    Valider mon compte
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading || resendCooldown > 0}
                className="w-full bg-slate-600 hover:bg-slate-700 disabled:bg-slate-400 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-200"
              >
                {resendCooldown > 0
                  ? `Renvoyer dans ${resendCooldown}s`
                  : "Renvoyer le code"}
              </button>

              <p className="text-slate-600 dark:text-slate-400 text-sm text-center">
                <button
                  onClick={() => {
                    setStep("form");
                    setOtpCode("");
                    setErrors({});
                    setResendCooldown(0);
                  }}
                  className="text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 font-semibold"
                >
                  Retour au formulaire
                </button>
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // --- RENDU ÉTAPE 1 : FORMULAIRE INITIAL ---

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
            GreenItCar <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-green-600">Business Suite</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Rejoignez les entreprises modernes dans la gestion durable
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 shadow-2xl rounded-2xl">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            Créer votre compte entreprise
          </h2>

          {errors.global && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6">
              {errors.global}
            </div>
          )}

          <form onSubmit={handleRegisterSubmit} className="space-y-6">
            {/* Informations Entreprise */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-6 border border-slate-100 dark:border-slate-700/50">
              <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-4 flex items-center">
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mr-2 text-sm font-bold text-white">
                  1
                </span>
                Informations de l'entreprise
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-800 dark:text-slate-200 text-sm font-semibold mb-2">
                    Nom de l'entreprise *
                  </label>
                  <input
                    type="text"
                    name="nom_entreprise"
                    value={formData.nom_entreprise}
                    onChange={handleChange}
                    placeholder="Ex: GreenItCar"
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                  {errors.nom_entreprise && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                      {errors.nom_entreprise}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-800 dark:text-slate-200 text-sm font-semibold mb-2">
                    Secteur d'activité *
                  </label>
                  <select
                    name="secteur_activite"
                    value={formData.secteur_activite}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  >
                    <option value="">Sélectionnez un secteur</option>
                    <option value="sante_medical">Santé / Médical</option>
                    <option value="humanitaire_ong">Humanitaire / ONG</option>
                    <option value="commerce_vente">Commerce / Vente au détail</option>
                    <option value="informatique_tech">Informatique / Technologies</option>
                    <option value="administration_publique">Administration / Secteur public</option>
                    <option value="autre">Autre</option>

                  </select>
                  {errors.secteur_activite && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                      {errors.secteur_activite}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-800 dark:text-slate-200 text-sm font-semibold mb-2">
                    Email professionnel *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="contact@entreprise.com"
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                  {errors.email && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-800 dark:text-slate-200 text-sm font-semibold mb-2">
                    Téléphone *
                  </label>
                  <input
                    type="tel"
                    name="telephone"
                    value={formData.telephone}
                    onChange={handleChange}
                    placeholder="+236..."
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                  {errors.telephone && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.telephone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-800 dark:text-slate-200 text-sm font-semibold mb-2">
                    Nombre d'employés
                  </label>
                  <select
                    name="nombre_employe"
                    value={formData.nombre_employe}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  >
                    <option value="">Sélectionnez</option>
                    <option value="1-10">1-10</option>
                    <option value="11-50">11-50</option>
                    <option value="51-200">51-200</option>
                    <option value="200+">200+</option>
                  </select>
                </div>

                 <div>
                  <label htmlFor="numero_registre_du_commerce" className="block text-slate-800 dark:text-slate-200 text-sm font-semibold mb-2">
                    Numéro de Registre du Commerce *
                  </label>
                  <input
                    type="text"
                    id="numero_registre_du_commerce"
                    name="numero_registre_du_commerce"
                    value={formData.numero_registre_du_commerce}
                    onChange={handleChange}
                    placeholder="Entrez le numéro de registre du commerce" // Ajout des accents et d'un verbe d'action
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                  {errors.numero_registre_du_commerce && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                      {errors.numero_registre_du_commerce}
                    </p>
                  )}

                </div>
              </div>
            </div>

            {/* Informations Contact */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-6 border border-slate-100 dark:border-slate-700/50">
              <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-4 flex items-center">
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mr-2 text-sm font-bold text-white">
                  2
                </span>
                Vos informations personnelles
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-800 dark:text-slate-200 text-sm font-semibold mb-2">
                   Nom *
                  </label>
                  <input
                    type="text"
                    name="nom"
                    value={formData.nom}
                    onChange={handleChange}
                    placeholder="Votre nom"
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                  {errors.nom && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                      {errors.nom}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-800 dark:text-slate-200 text-sm font-semibold mb-2">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    name="prenom"
                    value={formData.prenom}
                    onChange={handleChange}
                    placeholder="Votre prénom"
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                  {errors.prenom && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                      {errors.prenom}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Conditions */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                name="terme"
                id="terms"
                checked={formData.terme}
                onChange={handleChange}
                className="w-5 h-5 rounded border border-slate-400 dark:border-slate-600 bg-slate-200 dark:bg-slate-800 text-emerald-500 focus:ring-2 focus:ring-emerald-500 cursor-pointer mt-1"
              />
              <label htmlFor="terms" className="text-slate-700 dark:text-slate-300 text-sm">
                J'accepte les{" "}
                <Link
                  href="#"
                  className="text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 font-semibold"
                >
                  conditions d'utilisation
                </Link>{" "}
                et la{" "}
                <Link
                  href="#"
                  className="text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 font-semibold"
                >
                  politique de confidentialité
                </Link>
                *
              </label>
            </div>
            {errors.terme && (
              <p className="text-red-600 dark:text-red-400 text-sm">
                {errors.terme}
              </p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Envoi du code...
                </>
              ) : (
                <>
                  S'inscrire
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </>
              )}
            </button>

            {/* Login Link */}
            <div className="text-center pt-4 border-t border-slate-300 dark:border-white dark:border-opacity-10">
              <p className="text-slate-600 dark:text-slate-400">
                Vous avez déjà un compte?{" "}
                <Link
                  href="/connexion"
                  className="text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 font-semibold transition-colors"
                >
                  Se connecter
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-slate-600 dark:text-slate-400 text-sm">
          <p>
            Besoin d'aide?{" "}
            <Link href="/contact" className="text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300">
              Contactez-nous
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
