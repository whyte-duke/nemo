import { useQuery } from "@tanstack/react-query";
import type { StreamingOption } from "@/app/api/streaming/[imdbId]/route";

export type { StreamingOption };

export function useStreamingAvailability(
  imdbId: string | null | undefined,
  country = "fr"
) {
  return useQuery<StreamingOption[]>({
    queryKey: ["streaming-availability", imdbId, country],
    queryFn: async () => {
      const res = await fetch(`/api/streaming/${imdbId}?country=${country}`);
      if (!res.ok) throw new Error("Failed to fetch streaming availability");
      return res.json() as Promise<StreamingOption[]>;
    },
    enabled: !!imdbId,
    staleTime: 1000 * 60 * 60,
    retry: false,
  });
}
