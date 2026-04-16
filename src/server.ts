import express from "express";
import dotenv from "dotenv";
import { startIndexer } from "./indexer";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

let indexerStarted = false;
let indexerStatus: "idle" | "starting" | "running" | "error" = "idle";
let lastIndexerError: string | null = null;

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "thesis-arena-indexer",
    indexerStatus
  });
});

app.get("/health", (_req, res) => {
  res.status(indexerStatus === "error" ? 500 : 200).json({
    ok: indexerStatus !== "error",
    service: "thesis-arena-indexer",
    indexerStatus,
    lastIndexerError
  });
});

app.listen(PORT, async () => {
  console.log(`HTTP server listening on port ${PORT}`);

  if (!indexerStarted) {
    indexerStarted = true;
    indexerStatus = "starting";

    try {
      await startIndexer();
      indexerStatus = "running";
      console.log("Indexer started successfully");
    } catch (error) {
      indexerStatus = "error";
      lastIndexerError =
        error instanceof Error ? error.message : "Unknown indexer startup error";

      console.error("Indexer failed to start:", error);
      process.exit(1);
    }
  }
});