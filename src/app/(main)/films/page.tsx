import type { Metadata } from "next";
import { FilmsContent } from "@/components/films/FilmsContent";

export const metadata: Metadata = {
  title: "Films",
  description:
    "Découvrez les meilleurs films : tendances, classements, et les tops par plateforme — Netflix, Disney+, Apple TV+, Amazon, Canal+, Max et plus.",
  openGraph: {
    title: "Films | Nemo",
    description: "Explorez le meilleur du cinéma mondial, toutes plateformes confondues.",
  },
};

export default function FilmsPage() {
  return <FilmsContent />;
}
