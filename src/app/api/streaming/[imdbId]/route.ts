import { NextResponse } from "next/server";

export interface StreamingServiceImage {
  lightThemeImage: string;
  darkThemeImage: string;
  whiteImage: string;
}

export interface StreamingService {
  id: string;
  name: string;
  homePage: string;
  themeColorCode: string;
  imageSet: StreamingServiceImage;
}

export interface StreamingAddon {
  id: string;
  name: string;
  homePage: string;
  themeColorCode: string;
  imageSet: StreamingServiceImage;
}

export interface StreamingPrice {
  amount: string;
  currency: string;
  formatted: string;
}

export interface StreamingOption {
  service: StreamingService;
  type: "subscription" | "free" | "rent" | "buy" | "addon";
  addon?: StreamingAddon;
  link: string;
  videoLink?: string;
  quality: "sd" | "hd" | "qhd" | "uhd";
  audios: { language: string; region?: string }[];
  subtitles: { locale: { language: string; region?: string }; closedCaptions: boolean }[];
  price?: StreamingPrice;
  expiresSoon: boolean;
  expiresOn?: number;
  availableSince: number;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ imdbId: string }> }
) {
  const { imdbId } = await params;

  if (!process.env.RAPIDAPI_KEY) {
    return NextResponse.json(
      { error: "RAPIDAPI_KEY not configured" },
      { status: 500 }
    );
  }

  // Support country via query param (default: fr)
  const url = new URL(_req.url);
  const country = url.searchParams.get("country") ?? "fr";

  try {
    const res = await fetch(
      `https://streaming-availability.p.rapidapi.com/shows/${encodeURIComponent(imdbId)}?country=${country}&series_granularity=show`,
      {
        headers: {
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
          "X-RapidAPI-Host": "streaming-availability.p.rapidapi.com",
        },
        next: { revalidate: 3600 },
      }
    );

    if (res.status === 404) {
      return NextResponse.json([], { status: 200 });
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const options: StreamingOption[] = data.streamingOptions?.[country] ?? [];

    // Dédoublonner par service + type
    const seen = new Set<string>();
    const deduped = options.filter((opt) => {
      const key = `${opt.service.id}-${opt.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json(deduped);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch streaming availability" },
      { status: 500 }
    );
  }
}
