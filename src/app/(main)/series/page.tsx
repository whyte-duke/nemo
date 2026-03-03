import type { Metadata } from "next";
import { SeriesContent } from "@/components/series/SeriesContent";

export const metadata: Metadata = {
  title: "Séries",
  description:
    "Explorez les meilleures séries TV : tendances, classements, et les tops par plateforme — Netflix, Disney+, HBO Max, Apple TV+, Canal+, OCS et plus.",
  openGraph: {
    title: "Séries | Nemo",
    description: "Retrouvez les meilleures séries du monde entier, organisées par plateforme.",
  },
};

export default function SeriesPage() {
  return <SeriesContent />;
}
