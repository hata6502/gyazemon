import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import { FunctionComponent, StrictMode, Suspense, useState } from "react";
import { createRoot } from "react-dom/client";
import { Watch, WatchV2, toWatchlistV2 } from "../watch-list";
import { Button, Input, Table, Text, Heading } from ".";

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
    <div className="container mx-auto px-4 py-4">
      <Heading level={2} className="mb-4">Settings</Heading>

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
        <div className="mb-4">
          <Text variant="label">Gyazo API access token</Text>
          <Input
            type="password"
            className="mt-1"
            placeholder="XXXXXXXXXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXX"
            value={gyazoAccessToken}
            onChange={(event) => {
              setGyazoAccessToken(event.target.value);
            }}
          />
        </div>

        <div className="mb-4">
          <Text variant="label">Watchlist</Text>
          <Text variant="body">
            Directories to be watched and uploaded to Gyazo.
            Only upload files that were placed later.
          </Text>
          
          <Table className="mb-2">
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Path</Table.HeaderCell>
                <Table.HeaderCell></Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {watchlist.map(({ path }, index) => (
                <Table.Row key={index}>
                  <Table.Cell>{path}</Table.Cell>
                  <Table.Cell className="text-center">
                    <Button
                      variant="icon"
                      onClick={() => {
                        setWatchlist((prevWatchlist) => [
                          ...prevWatchlist.slice(0, index),
                          ...prevWatchlist.slice(index + 1),
                        ]);
                      }}
                    >
                      <TrashIcon className="w-4" />
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          
          <Button
            variant="icon"
            onClick={async () => {
              const paths = await electronAPI.selectDirectory();
              setWatchlist((prevWatchlist) => [
                ...prevWatchlist,
                ...paths.map((path: string) => ({ path })),
              ]);
            }}
          >
            <PlusIcon className="w-4" />
          </Button>
        </div>

        <div className="flex justify-end">
          <Button type="submit" variant="primary">
            Save &amp; restart
          </Button>
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
