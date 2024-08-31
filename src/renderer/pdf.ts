import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "../node_modules/pdfjs-dist/build/pdf.worker.mjs";

const pdf = await pdfjsLib.getDocument(await electronAPI.getPDF()).promise;
for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 3 });
  const canvasElement = document.createElement("canvas");
  const canvasContext = canvasElement.getContext("2d");
  if (!canvasContext) {
    throw new Error("Couldn't get canvasContext. ");
  }
  canvasElement.width = Math.floor(viewport.width);
  canvasElement.height = Math.floor(viewport.height);
  canvasElement.style.width = `${Math.floor(viewport.width)}px`;
  canvasElement.style.height = `${Math.floor(viewport.height)}px`;
  await page.render({
    canvasContext,
    viewport,
  }).promise;

  const blob = await new Promise<Blob | null>((resolve) =>
    canvasElement.toBlob(resolve)
  );
  if (!blob) {
    throw new Error("Couldn't get blob. ");
  }
  await electronAPI.setPageImage(await blob.arrayBuffer());
}

await electronAPI.finishRenderPDF();
