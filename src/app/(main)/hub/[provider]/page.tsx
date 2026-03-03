import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { HubContent } from "@/components/hub/HubContent";
import { WATCH_PROVIDERS } from "@/types/tmdb";

const PROVIDER_SLUGS: Record<string, { key: keyof typeof WATCH_PROVIDERS; label: string }> = {
  netflix: { key: "NETFLIX", label: "Netflix" },
  "apple-tv": { key: "APPLE_TV", label: "Apple TV+" },
  "canal-plus": { key: "CANAL_PLUS", label: "Canal+" },
  "disney-plus": { key: "DISNEY_PLUS", label: "Disney+" },
  "disney+": { key: "DISNEY_PLUS", label: "Disney+" },
  amazon: { key: "AMAZON", label: "Amazon Prime Video" },
  ocs: { key: "OCS", label: "OCS" },
  paramount: { key: "PARAMOUNT", label: "Paramount+" },
  max: { key: "MAX", label: "Max" },
};

interface Props {
  params: Promise<{ provider: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { provider } = await params;
  const config = PROVIDER_SLUGS[provider];
  if (!config) return { title: "Hub introuvable" };
  return {
    title: `${config.label} — Films & Séries`,
    description: `Découvrez les meilleurs films et séries disponibles sur ${config.label} en France.`,
  };
}

export default async function HubPage({ params }: Props) {
  const { provider } = await params;
  const config = PROVIDER_SLUGS[provider];
  if (!config) notFound();

  const providerInfo = WATCH_PROVIDERS[config.key];

  return <HubContent providerId={providerInfo.id} providerName={config.label} providerSlug={provider} />;
}
