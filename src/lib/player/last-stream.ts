const key = (tmdbId: number, mediaType: string, suffix?: string) =>
  `nemo-last-stream:${tmdbId}-${mediaType}${suffix ? `-${suffix}` : ""}`;

export const saveLastStream = (
  tmdbId: number,
  mediaType: string,
  url: string,
  suffix?: string,
): void => {
  try {
    localStorage.setItem(key(tmdbId, mediaType, suffix), url);
  } catch {}
};

export const getLastStream = (
  tmdbId: number,
  mediaType: string,
  suffix?: string,
): string | null => {
  try {
    return localStorage.getItem(key(tmdbId, mediaType, suffix));
  } catch {
    return null;
  }
};
