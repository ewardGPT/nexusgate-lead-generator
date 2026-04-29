import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";

export async function runGosomScraper(args: { query: string; depth: number; workDir: string; onLine: (line: string) => void }) {
  const isRailway = process.env.RAILWAY_PROJECT_ID !== undefined;
  const scrapeId = randomUUID().slice(0, 8);
  const actualWorkDir = isRailway ? `/tmp/scrape-${scrapeId}` : args.workDir;
  const outputDir = isRailway ? `/app/output` : args.workDir;
  
  console.log(`[GOSOM] isRailway=${isRailway}, workDir=${actualWorkDir}, query=${args.query}`);
  console.log(`[GOSOM] Checking binary location...`);
  console.log(`[GOSOM] /usr/local/bin exists: ${existsSync('/usr/local/bin')}`);
  console.log(`[GOSOM] ls /usr/local/bin:`, require('node:fs').readdirSync('/usr/local/bin'));
  console.log(`[GOSOM] PATH: ${process.env.PATH}`);
  console.log(`[GOSOM] which google-maps-scraper:`, require('node:child_process').execSync('which google-maps-scraper 2>&1').toString());
  
  mkdirSync(actualWorkDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });
  await access(actualWorkDir, constants.W_OK);
  
  // Write query file for gosom
  const queryFile = `${actualWorkDir}/queries.txt`;
  require("node:fs").writeFileSync(queryFile, args.query);
  
  const outputFile = `${outputDir}/results-${Date.now()}.csv`;
  const maxRuntimeMs = 15 * 60 * 1000;
  const depthArg = args.depth === 1 ? "1" : args.depth === 2 ? "2" : "3";
  
  console.log(`[GOSOM] Running: ${args.query}, depth=${depthArg}, output=${outputFile}`);

  // Build the shell command to avoid Node.18+ glibc spawn ENOENT bug
  const gosomBin = "/usr/local/bin/google-maps-scraper";
  const shellCmd = `${gosomBin} -input "${queryFile}" -results "${outputFile}" -depth ${depthArg} -json`;

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Scraper timed out after 15 minutes"));
    }, maxRuntimeMs);

    const proc = spawn("/bin/sh", ["-c", shellCmd], {
      cwd: actualWorkDir,
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: "/root/.cache/puppeteer",
      }
    });

    let stderr = "";
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
      args.onLine(data.toString());
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        console.log(`[GOSOM] Completed successfully`);
        resolve(outputFile);
      } else {
        console.error(`[GOSOM] Failed with code ${code}: ${stderr}`);
        reject(new Error(`Scraper failed with code ${code}: ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      console.error(`[GOSOM] Error: ${err.message}`);
      reject(new Error(`Scraper error: ${err.message}`));
    });
  });
}