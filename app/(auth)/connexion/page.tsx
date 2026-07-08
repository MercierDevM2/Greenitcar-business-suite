"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ConnexionPage() {
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // --- ÉTAPE 1 : Demande du code OTP pour la connexion ---
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    if (!email.includes("@")) {
      setErrors({ email: "Veuillez entrer une adresse email valide" });
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: false, // Empêche la création d'un compte si l'email n'existe pas
        },
      });

      if (error) throw error;

      setStep("otp");
    } catch (err: any) {
      // Si l'utilisateur n'existe pas ou s'il y a un problème réseau
      setErrors({
        global: err.message || "Une erreur est survenue lors de l'envoi du code de connexion.",
      });
    } finally {
      setLoading(false);
    }
  };

  // --- ÉTAPE 2 : Validation du code OTP par Supabase ---
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    if (!otpCode.trim() || otpCode.length < 8) {
      setErrors({ otp: "Le code doit contenir 8 chiffres" });
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email,
        token: otpCode,
        type: "magiclink", // Pour une connexion d'un compte existant via OTP, on utilise 'magiclink'
      });

      if (error) throw error;

      // Connexion réussie : Redirection vers le dashboard d'entreprise
      window.location.href = "/dashboard";
    } catch (err: any) {
      setErrors({ otp: "Code incorrect ou expiré. Veuillez réessayer." });
    } finally {
      setLoading(false);
    }
  };

  // --- ÉTAPE 2b : Renvoi du code de connexion ---
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setErrors({});

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: { shouldCreateUser: false },
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
      setErrors({ otp: "Impossible de renvoyer le code pour le moment." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* En-tête */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            GreenItCar <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-green-600">Business</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Accédez à votre espace de gestion durable de flotte
          </p>
        </div>

        {/* Carte Principale */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 shadow-2xl rounded-2xl">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
            {step === "email" ? "Se connecter" : "Vérification en cours"}
          </h2>

          {errors.global && (
            <div className="p-4 mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 rounded-lg">
              {errors.global}
            </div>
          )}

          {/* ÉCRAN 1 : DEMANDE DE L'EMAIL */}
          {step === "email" ? (
            <form onSubmit={handleEmailSubmit} className="space-y-5">
              <div>
                <label className="block text-slate-700 dark:text-slate-200 text-sm font-semibold mb-2">
                  Email professionnel
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@entreprise.com"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  required
                />
                {errors.email && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.email}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                {loading ? "Envoi du code..." : "Recevoir mon code de connexion"}
              </button>
            </form>
          ) : (
            /* ÉCRAN 2 : SAISIE DU CODE DE CONNEXION */
            <form onSubmit={handleOtpSubmit} className="space-y-5">
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                Saisissez le code à 8 chiffres envoyé à <br />
                <span className="font-semibold text-slate-900 dark:text-white">{email}</span>
              </p>

              <div>
                <label className="block text-slate-700 dark:text-slate-200 text-sm font-semibold mb-2">
                  Code secret
                </label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="00000000"
                  maxLength={8}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-center font-bold tracking-widest text-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                {errors.otp && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.otp}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                {loading ? "Vérification..." : "Valider et se connecter"}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading || resendCooldown > 0}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50"
                >
                  {resendCooldown > 0
                    ? `Renvoyer un code (${resendCooldown}s)`
                    : "Renvoyer un nouveau code"}
                </button>
              </div>
            </form>
          )}

          {/* Lien de bascule vers l'inscription */}
          <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Nouveau sur la suite Business ?{" "}
              <Link href="/inscription" className="text-emerald-600 hover:text-emerald-700 font-semibold">
                Créer un compte
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
