import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maintenance — Nemo",
};

export default function MaintenancePage() {
  return (
    <div className="min-h-dvh bg-[#0b0d12] flex flex-col items-center justify-center px-6 text-center">
      {/* Glow background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-nemo-accent/5 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-md space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-nemo-accent font-black text-2xl tracking-widest">NEMO</span>
        </div>

        {/* Icon */}
        <div className="flex justify-center">
          <div className="size-20 rounded-full bg-nemo-accent/10 ring-1 ring-nemo-accent/20 flex items-center justify-center">
            <svg
              className="size-10 text-nemo-accent"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085"
              />
            </svg>
          </div>
        </div>

        {/* Text */}
        <div className="space-y-3">
          <h1 className="text-white font-black text-2xl sm:text-3xl leading-tight">
            Maintenance en cours
          </h1>
          <p className="text-white/50 text-sm sm:text-base leading-relaxed">
            On fait une petite mise à jour pour que tout tourne encore mieux.
            Le streaming et le site reviennent très vite.
          </p>
        </div>

        {/* Status card */}
        <div className="glass-tile rounded-2xl p-5 space-y-3 text-left">
          <div className="flex items-center gap-3">
            <div className="size-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-300 text-sm font-semibold">Mise à jour en cours</span>
          </div>
          <p className="text-white/40 text-xs leading-relaxed">
            Pas de panique, vos listes, vos goûts et votre historique sont en sécurité.
            Tout sera de retour d&apos;ici quelques minutes.
          </p>
        </div>

        {/* Footer */}
        <p className="text-white/20 text-xs pt-4">
          Merci de votre patience
        </p>
      </div>
    </div>
  );
}
