import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import { FunctionComponent, StrictMode, Suspense, useState } from "react";
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
    <div className="container mx-auto px-4 py-4 text-slate-700 text-sm">
      <h2 className="mb-4 font-medium text-2xl">Settings</h2>

      <form
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
        <label className="block mb-4">
          <span className="block font-medium">Gyazo API access token</span>
          <input
            type="password"
            className="mt-1 px-3 py-2 bg-white border border-slate-300 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:ring-violet-500 block w-full rounded-md sm:text-sm focus:ring-1"
            placeholder="XXXXXXXXXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXX"
            value={gyazoAccessToken}
            onChange={(event) => {
              setGyazoAccessToken(event.target.value);
            }}
          />
        </label>

        <div className="mb-4">
          <div className="font-medium">Watchlist</div>
          Directories to be watched and uploaded to Gyazo. <br />
          Only upload files that were placed later.
          <table className="border-collapse mb-2 table-auto w-full">
            <thead>
              <tr>
                <th className="border-b font-medium p-2 text-left">Path</th>
                <th className="border-b font-medium p-2">Open new tab</th>
                <th className="border-b font-medium p-2"></th>
              </tr>
            </thead>

            <tbody>
              {watchlist.map(({ path, opensNewTab }, index) => (
                <tr key={index}>
                  <td className="border-b border-slate-100 p-2">{path}</td>

                  <td className="border-b border-slate-100 p-2 text-center">
                    <input
                      type="checkbox"
                      checked={opensNewTab}
                      onChange={(event) => {
                        setWatchlist((prevWatchlist) => [
                          ...prevWatchlist.slice(0, index),
                          {
                            ...prevWatchlist[index],
                            opensNewTab: event.target.checked,
                          },
                          ...prevWatchlist.slice(index + 1),
                        ]);
                      }}
                    />
                  </td>

                  <td className="border-b border-slate-100 p-2 text-center">
                    <button
                      type="button"
                      className="px-2 py-2 rounded-full bg-white hover:bg-gray-100 focus:bg-gray-100 focus:outline-none focus:ring-0 active:bg-gray-200"
                      onClick={() => {
                        setWatchlist((prevWatchlist) => [
                          ...prevWatchlist.slice(0, index),
                          ...prevWatchlist.slice(index + 1),
                        ]);
                      }}
                    >
                      <TrashIcon className="w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="px-2 py-2 rounded-full bg-violet-500 text-white hover:bg-violet-600 focus:bg-violet-600 focus:outline-none focus:ring-0 active:bg-violet-700"
            onClick={async () => {
              const paths = await electronAPI.selectDirectory();
              setWatchlist((prevWatchlist) => [
                ...prevWatchlist,
                ...paths.map((path) => ({ path, opensNewTab: false })),
              ]);
            }}
          >
            <PlusIcon className="w-4" />
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-violet-500 hover:bg-violet-600 focus:outline-none focus:ring focus:ring-violet-300 active:bg-violet-700 px-5 py-2 rounded font-medium text-white"
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
        <div className="flex justify-center my-4">
          <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full"></div>
        </div>
      }
    >
      <App />
    </Suspense>
  </StrictMode>
);
