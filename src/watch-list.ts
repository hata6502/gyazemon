type WatchV1 = string;
export interface WatchV2 {
  path: string;
  opensNewTab?: never;
  writesClipboard?: boolean;
}
export type Watch = WatchV1 | WatchV2;

export const toWatchlistV2 = (watchlist: (WatchV1 | WatchV2)[]): WatchV2[] =>
  watchlist.map((item) => (typeof item === "string" ? { path: item } : item));
