"use client";

interface ModalJuridiqueProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: React.ReactNode;
}

export default function ModalJuridique({ isOpen, onClose, title, content }: ModalJuridiqueProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        
        {/* En-tête */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl font-semibold leading-none p-1"
          >
            &times;
          </button>
        </div>

        {/* Contenu textuel scrollable */}
        <div className="p-6 overflow-y-auto text-sm text-slate-600 dark:text-slate-300 space-y-4 leading-relaxed">
          {content}
        </div>

        {/* Pied de page */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 px-5 rounded-xl transition-all"
          >
            Fermer et continuer
          </button>
        </div>
        
      </div>
    </div>
  );
}
