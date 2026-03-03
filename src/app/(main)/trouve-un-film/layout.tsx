import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trouve un film (W3NO) — NEMO",
  description:
    "Trouve le film idéal : seul ou avec des amis, par genre, bien noté, et même dans ta bibliothèque Jellyfin.",
};

export default function TrouveUnFilmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
