import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bienvenue sur Nemo",
  description: "Configurez votre expérience personnalisée",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#080a0f] flex items-center justify-center p-4">
      {children}
    </div>
  );
}
