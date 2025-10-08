import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import {
  ChangeEventHandler,
  FunctionComponent,
  StrictMode,
  Suspense,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { Watch, WatchV2, toWatchlistV2 } from "../watch-list";

let initialGyazoAccessToken: string | undefined;
let initialWatchlist: WatchV2[] | undefined;
const App: FunctionComponent = () => {
  if (initialGyazoAccessToken === undefined) {
    throw (async () => {
      const gyazoAccessToken =
        (await electronAPI.getFromConfigStore("gyazoAccessToken")) ?? "";
      if (typeof gyazoAccessToken !== "string") {
        throw new Error("gyazoAccessTokenValue is not string. ");
      }
      initialGyazoAccessToken = gyazoAccessToken;
    })();
  }

  if (!initialWatchlist) {
    throw (async () => {
      initialWatchlist = toWatchlistV2(
        ((await electronAPI.getFromConfigStore("watchlist")) ?? []) as Watch[]
      );
    })();
  }

  const [gyazoAccessToken, setGyazoAccessToken] = useState(
    initialGyazoAccessToken
  );
  const [watchlist, setWatchlist] = useState(initialWatchlist);

  return (
    <div className="min-h-screen bg-zinc-50 p-6 text-zinc-950 dark:bg-zinc-950 dark:text-white">
      <form
        className="mx-auto max-w-3xl space-y-10"
        onSubmit={async (event) => {
          event.preventDefault();
          await electronAPI.setToConfigStore(
            "gyazoAccessToken",
            gyazoAccessToken
          );
          await electronAPI.setToConfigStore("watchlist", watchlist);
          await electronAPI.restart();
        }}
      >
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Gyazo API access token
          </span>
          <input
            type="password"
            placeholder="XXXXXXXXXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXX"
            value={gyazoAccessToken}
            onChange={(event) => {
              setGyazoAccessToken(event.target.value);
            }}
            className="block w-full rounded-lg border border-zinc-950/10 bg-transparent px-4 py-2 text-base/6 text-zinc-950 placeholder:text-zinc-500 focus:border-zinc-950/20 focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:border-white/15 dark:text-white dark:placeholder:text-zinc-400 dark:focus:border-white/20 dark:focus:ring-blue-400"
          />
        </label>

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Watchlist
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              This is the directory used for uploading to Gyazo. <br />
              Any files placed in this directory after saving the settings will
              be uploaded automatically.
            </p>

            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              You can also choose to copy the uploaded Gyazo URL to the
              clipboard.
            </p>
          </div>

          <table className="min-w-full table-fixed border-collapse text-left text-sm/6 text-zinc-950 dark:text-white">
            <thead className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <tr className="border-b border-zinc-200 dark:border-white/10">
                <th className="px-0 py-2">Path</th>
                <th className="px-4 py-2 text-center">Clipboard</th>
                <th className="w-12 px-0 py-2 text-right"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
              {watchlist.map((watch, index) => {
                const handleClipboardCheckboxChange: ChangeEventHandler<
                  HTMLInputElement
                > = (event) => {
                  setWatchlist((prev) => {
                    const watchlist = [...prev];
                    watchlist[index] = {
                      ...watchlist[index],
                      writesClipboard: event.target.checked,
                    };
                    return watchlist;
                  });
                };

                const handleRemoveButtonClick = () => {
                  setWatchlist((prev) => [
                    ...prev.slice(0, index),
                    ...prev.slice(index + 1),
                  ]);
                };

                return (
                  <tr
                    key={index}
                    className="transition hover:bg-zinc-100/60 dark:hover:bg-white/5"
                  >
                    <td className="max-w-[18rem] truncate py-3 pr-4 text-sm text-zinc-700 dark:text-zinc-200 sm:max-w-none">
                      {watch.path}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={watch.writesClipboard ?? false}
                        onChange={handleClipboardCheckboxChange}
                        className="size-4 shrink-0 rounded border border-zinc-950/15 text-blue-600 accent-blue-600 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-white/20 dark:bg-white/5 dark:accent-blue-400"
                      />
                    </td>

                    <td className="py-3 text-right">
                      <button
                        type="button"
                        className="inline-flex size-9 items-center justify-center rounded-md text-zinc-500 transition hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-zinc-400 dark:hover:text-white"
                        onClick={handleRemoveButtonClick}
                      >
                        <TrashIcon className="size-4" />
                        <span className="sr-only">Remove</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-950/10 bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-white/10 dark:bg-blue-500 dark:hover:bg-blue-400"
            onClick={async () => {
              const paths = await electronAPI.selectDirectory();
              setWatchlist((prevWatchlist) => [
                ...prevWatchlist,
                ...paths.map((path) => ({ path })),
              ]);
            }}
          >
            <PlusIcon className="size-4" />
            <span>Add directory</span>
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-950/10 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-transparent"
          >
            Save &amp; restart
          </button>
        </div>
      </form>
    </div>
  );
};

const container = document.createElement("div");
document.body.append(container);
createRoot(container).render(
  <StrictMode>
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
          <div className="size-8 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500 dark:border-zinc-700 dark:border-t-blue-400"></div>
        </div>
      }
    >
      <App />
    </Suspense>
  </StrictMode>
);
