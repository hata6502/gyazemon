import { createWriteStream } from "node:fs";
import { Writable } from "node:stream";

const response = await fetch(
  "https://tessdata.projectnaptha.com/4.0.0_fast/jpn.traineddata.gz"
);
if (!response.ok || !response.body) {
  throw new Error(
    `Failed to download jpn.traineddata.gz: ${response.status} ${response.statusText}`
  );
}
await response.body
  .pipeThrough(new DecompressionStream("gzip"))
  .pipeTo(Writable.toWeb(createWriteStream("jpn.traineddata")));
