import { Worker } from "bullmq";
import type { ScrapeJobPayload } from "./types";
import { processScrapeJob } from "./jobs/scrape.job";
import { getRedisConnection } from "./lib/connection";

const worker = new Worker<ScrapeJobPayload>(
  "scrape-jobs",
  async (job) => processScrapeJob(job),
  {
    connection: getRedisConnection(),
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? "2")
  }
);

worker.on("completed", (job) => {
  console.log(`completed ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`failed ${job?.id}`, err);
});

async function shutdown(signal: string) {
  console.log(`received ${signal}, closing worker`);
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
