/**
 * Yelp Scraper - for years in business, additional ratings
 */
import puppeteer, { Browser, Page } from "puppeteer-core";
import { createObjectCsvWriter } from "csv-writer";
import * as fs from "fs";
import chalk from "chalk";

interface YelpResult {
  name: string;
  phone: string;
  address: string;
  rating: string;
  reviews: string;
  yearsInBusiness: string;
  isMobile: string;
  yelpUrl: string;
}

/**
 * Get Chrome executable path for different environments
 */
function getChromeExecutablePath(): string {
  const isRailway = process.env.RAILWAY_PROJECT_ID !== undefined;
  
  if (isRailway) {
    return process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser";
  }
  
  const paths = [
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    process.env.PUPPETEER_EXECUTABLE_PATH,
  ].filter(Boolean) as string[];
  
  for (const p of paths) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }
  return "";
}

export async function scrapeYelp(
  query: string,
  outputDir: string
): Promise<string> {
  const searchQuery = query.trim();
  if (!searchQuery) {
    throw new Error("Search query must not be empty");
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.accessSync(outputDir, fs.constants.W_OK);

  const executablePath = getChromeExecutablePath();
  const isRailway = process.env.RAILWAY_PROJECT_ID !== undefined;
  const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
    headless: true,
    executablePath,
    ...(isRailway && {
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    }),
  };
  
  const browser: Browser = await puppeteer.launch(launchOptions);
  
  try {
    const page: Page = await browser.newPage();
    await page.setViewport({ width: 990, height: 708 });
    await page.setDefaultTimeout(30000);

    // Navigate to Yelp with search query
    const encodedQuery = encodeURIComponent(searchQuery);
    const url = `https://www.yelp.com/search?find_desc=${encodedQuery}&find_loc=`;
    await page.goto(url, { waitUntil: "networkidle2" });

    const results: YelpResult[] = [];
    const now = new Date().toISOString();

    // Scroll a few times to get results
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(r => setTimeout(r, 2000));
    }

    // Extract business list
    const pageResults = await page.evaluate(() => {
      const items: YelpResult[] = [];
      const elements = document.querySelectorAll("a[href*='/biz/']");
      
      for (let i = 0; i < Math.min(elements.length, 50); i++) {
        const el = elements[i];
        const parent = el.closest("li") || el.parentElement?.closest("li");
        if (!parent) continue;
        
        const text = parent.textContent || "";
        const name = el.textContent?.trim() || "";
        
        if (!name || name.length < 3) continue;
        
        // Extract rating
        const ratingEl = parent.querySelector("[class*='stars']") || parent.querySelector("[class*='rating']");
        const ratingMatch = text.match(/(\d+\.?\d*)\s*(?:stars|★)/);
        const rating = ratingMatch ? ratingMatch[1] : "";
        
        // Extract reviews count
        const reviewMatch = text.match(/(\d+)\s*reviews?/i);
        const reviews = reviewMatch ? reviewMatch[1] : "";
        
        // Extract phone
        const phoneEl = parent.querySelector("a[href^='tel:']");
        const phone = phoneEl ? phoneEl.textContent?.trim() || "" : "";
        
        // Address
        const addrEl = parent.querySelector("[class*='address']") || parent.querySelector("span[class*='street']");
        const address = addrEl?.textContent?.trim() || "";
        
        // Check if mobile (cell phone pattern)
        const isMobile = /^(\+?1?[-.\s]*\(?\d{3}\)?[-.\s]*\d{3}[-.\s]*\d{4})$/.test(phone) && 
                     !phone.includes("800") && !phone.includes("888");
        
        // Years in business - not directly available on Yelp search
        // Could check individual business pages
        
        const yelpUrl = `https://www.yelp.com${el.getAttribute("href")}`;
        
        items.push({
          name,
          phone,
          address,
          rating,
          reviews,
          yearsInBusiness: "",  // Would need separate page visit
          isMobile: isMobile ? "true" : "false",
          yelpUrl,
        });
      }
      return items;
    });

    results.push(...pageResults);
    console.log(chalk.green(`Found ${results.length} Yelp results`));

    // Write CSV
    const csvPath = `${outputDir}/yelp-${Date.now()}.csv`;
    const csvWriter = createObjectCsvWriter({
      path: csvPath,
      header: [
        { id: "name", title: "NAME" },
        { id: "phone", title: "PHONE" },
        { id: "address", title: "ADDRESS" },
        { id: "rating", title: "YELP_RATING" },
        { id: "reviews", title: "YELP_REVIEWS" },
        { id: "yearsInBusiness", title: "YEARS_IN_BUSINESS" },
        { id: "isMobile", title: "IS_MOBILE" },
        { id: "yelpUrl", title: "YELP_URL" },
      ],
    });

    await csvWriter.writeRecords(results);
    console.log(chalk.green(`Wrote ${results.length} Yelp records to ${csvPath}`));
    
    return csvPath;
  } finally {
    await browser.close();
  }
}

export default scrapeYelp;