"use client";

interface LoaderProps {
  message?: string;
}

export default function LoaderOuvert({ message = "Initialisation de votre espace..." }: LoaderProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md transition-all duration-300">
      <div className="relative flex items-center justify-center">
        {/* Effet d'éclat lumineux magique en arrière-plan */}
        <div className="absolute w-24 h-24 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-full blur-xl opacity-30 animate-pulse" />
        
        {/* Le Rond Magique Tournant et Changeant de Couleur */}
        <div className="w-16 h-16 rounded-full border-4 border-transparent bg-origin-border bg-clip-content animate-magic-spinner" />
      </div>
      
      {/* Message textuel discret */}
      <p className="mt-6 text-sm font-medium text-slate-200 tracking-wide animate-pulse">
        {message}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Veuillez patienter, configuration du cache local en cours...
      </p>
    </div>
  );
}
