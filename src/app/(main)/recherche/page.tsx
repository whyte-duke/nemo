import { Suspense } from "react";
import { SearchContent } from "@/components/search/SearchContent";

export const metadata = {
  title: "Recherche",
  description: "Recherchez des films, séries et acteurs sur Nemo.",
};

export default function RecherchePage() {
  return (
    <Suspense fallback={<div className="pt-24 text-center text-white/50">Chargement...</div>}>
      <SearchContent />
    </Suspense>
  );
}
