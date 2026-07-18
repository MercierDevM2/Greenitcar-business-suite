"use client"; // 🚨 Sécurise l'exécution pour le navigateur client

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 🔒 Sécurité : On valide la présence des clés avant d'initialiser pour éviter un écran blanc
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "❌ Erreur de configuration Supabase : Les variables d'environnement NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY sont manquantes dans votre fichier .env.local"
  );
}

// Instance unique réutilisable partout dans le projet
export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
