import { createReadStream } from "node:fs";
import { parse } from "@fast-csv/parse";
import type { Job } from "bullmq";
import type { ScrapeJobPayload } from "../types";
import { runGosomScraper } from "../scraper/runner";
import { supabase } from "../lib/supabase";
import { shouldKeepLead } from "../lib/filter";
import { leadExistsForUser } from "../lib/dedup";
import { normalizeEmail } from "../lib/enrich";
import Redis from "ioredis";
import { getRedisConnection } from "../lib/connection";

const redis = new Redis(getRedisConnection());

function getField(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    if (row[key]) return row[key];
  }
  return "";
}

function normalizePhone(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

function isLikelyChain(name?: string) {
  const n = (name ?? "").toLowerCase();
  const chainSignals = ["mcdonald", "starbucks", "subway", "burger king", "7-eleven", "dunkin", "domino"];
  return chainSignals.some((signal) => n.includes(signal));
}

function clamp(min: number, max: number, value: number) {
  return Math.max(min, Math.min(max, value));
}

function scoreLead(row: Record<string, string>) {
  const ratingRaw = getField(row, ["rating", "Rating", "STAR RATING"]);
  const reviewsRaw = getField(row, ["reviews", "review_count", "REVIEWS"]);
  const phoneRaw = getField(row, ["phone", "Phone", "PHONE"]);
  const emailRaw = getField(row, ["email", "Email", "EMAIL"]);
  const websiteRaw = getField(row, ["site", "website", "Website", "WEBSITE"]);
  const yearsRaw = getField(row, ["years", "YEARS", "YEARS_IN_BUSINESS", "yearFounded"]);
  const mobileCheck = getField(row, ["mobile", "MOBILE", "IS_MOBILE"]);
  const yelpRating = getField(row, ["yelpRating", "YELP_RATING"]);
  const yelpReviews = getField(row, ["yelpReviews", "YELP_REVIEWS"]);

  const rating = ratingRaw ? Number(String(ratingRaw).replace(",", ".").replace(/[^\d.]/g, "")) : 0;
  const reviews = reviewsRaw ? Number(String(reviewsRaw).replace(/[^\d]/g, "")) : 0;
  const hasPhone = Boolean(normalizePhone(phoneRaw));
  const hasEmail = Boolean(normalizeEmail(emailRaw));
  const noWebsite = !websiteRaw;
  const isMobile = mobileCheck === "true" || mobileCheck === "1";
  const years = yearsRaw ? Number(String(yearsRaw).replace(/[^\d]/g, "")) : 0;
  const hasYelp = Boolean(yelpRating || yelpReviews);
  const yelpReviewCount = yelpReviews ? Number(String(yelpReviews).replace(/[^\d]/g, "")) : 0;
  
  // NEW SCORING FORMULA (0-100 scale)
  // Cold-calling priority signals: no website + phone = immediate outreach
  
  // Urgency signals (what makes them want to buy now)
  const noWebsiteBonus = noWebsite ? 30 : 0;  // Hot: needs your service
  const ratingBonus = rating >= 4.0 ? 15 : (rating >= 3.5 ? 10 : 0);
  const recentBusiness = years > 0 && years <= 3 ? 15 : (years > 0 && years <= 5 ? 10 : 0);  // Newer = hungrier
  
  // Engagement signals
  const reviewScore = clamp(0, 15, reviews / 10);
  const yelpBonus = hasYelp ? clamp(0, 10, yelpReviewCount / 20) : 0;
  
  // Contactability
  const hasDirectPhone = hasPhone ? 20 : 0;
  const mobileBonus = isMobile ? 15 : 0;  // Mobile = decision maker
  
  // Fit signals
  const emailBonus = hasEmail ? 5 : 0;
  
  const total = clamp(0, 100, Math.round(
    noWebsiteBonus + ratingBonus + recentBusiness + reviewScore + 
    yelpBonus + hasDirectPhone + mobileBonus + emailBonus
  ));
  
  // Contactability score for routing (0-100)
  const contactability = clamp(0, 100, (hasPhone ? 50 : 0) + (isMobile ? 30 : 0) + (hasEmail ? 20 : 0));
  
  return { total, contactability };
}

export async function processScrapeJob(job: Job<ScrapeJobPayload>) {
  const payload = {
    ...job.data,
    preset: job.data.preset ?? "balanced_local",
    rules: job.data.rules ?? {
      minReviews: 15,
      minRating: 3.6,
      maxRating: 4.9,
      excludeChains: true
    }
  };
  let totalFound = 0;
  let leadsSaved = 0;
  let filteredOut = 0;
  let duplicatesRemoved = 0;

  await supabase
    .from("scrape_jobs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", payload.jobId)
    .eq("user_id", payload.userId);

  const progressChannel = `job-progress:${payload.jobId}`;

  try {
    const query = `${payload.category} in ${payload.city}, ${payload.state}`;
    const resultPath = await runGosomScraper({
      query,
      depth: payload.depth,
      workDir: `/app/scrapes/${payload.jobId}`,
      onLine: async (line) => {
        if (line.toLowerCase().includes("found")) totalFound += 1;
        await redis.publish(progressChannel, JSON.stringify({ type: "progress", found: totalFound, saved: leadsSaved }));
      }
    });

    await new Promise<void>((resolve, reject) => {
      createReadStream(resultPath)
        .pipe(parse({ headers: true }))
        .on("error", reject)
        .on("data", async (row: Record<string, string>) => {
          totalFound += 1;
          
          // Gosom column names: title, category, address, phone, website, rating, review_count, link, emails
          const website = getField(row, ["website", "site", "Website", "WEBSITE"]);
          const title = getField(row, ["title", "Name", "NAME"]);
          const city = getField(row, ["city", "City", "CITY"]) || payload.city;
          const state = getField(row, ["state", "State", "STATE"]) || payload.state;
          const address = getField(row, ["address", "Address", "ADDRESS"]);
          const phone = getField(row, ["phone", "Phone", "PHONE"]);
          const mapsUrl = getField(row, ["link", "url", "URL"]);
          const ratingRaw = getField(row, ["rating", "review_rating", "STAR RATING", "rating_value"]);
          const reviewsRaw = getField(row, ["review_count", "reviews", "REVIEWS"]);
          const emailRaw = getField(row, ["emails", "email", "Email", "EMAIL"]);
          const category = getField(row, ["category", "Category", "TYPE"]);

          if (payload.rules.excludeChains && isLikelyChain(title)) {
            filteredOut += 1;
            return;
          }
          
          const rating = ratingRaw ? Number(String(ratingRaw).replace(",", ".").replace(/[^\d.]/g, "")) : 0;
          const reviews = reviewsRaw ? Number(String(reviewsRaw).replace(/[^\d]/g, "")) : 0;
          
          // Filter: require minimum rating OR reviews OR phone (for cold calling)
          const hasPhone = Boolean(normalizePhone(phone));
          const hasValidRating = rating >= payload.rules.minRating;
          const hasEnoughReviews = reviews >= payload.rules.minReviews;
          
          // Save if: has name AND (rating OR reviews OR phone)
          if (!title?.trim()) {
            console.log(`[FILTER] no name`);
            filteredOut += 1;
            return;
          }
          
          if (!hasValidRating && !hasEnoughReviews && !hasPhone) {
            console.log(`[FILTER] rating=${rating}, reviews=${reviews}, phone=${hasPhone}`);
            filteredOut += 1;
            return;
          }

          const exists = await leadExistsForUser({
            userId: payload.userId,
            phone,
            businessName: title,
            city
          });
          if (exists) {
            duplicatesRemoved += 1;
            return;
          }

          const score = scoreLead(row);

          const { error } = await supabase.from("leads").insert({
            user_id: payload.userId,
            job_id: payload.jobId,
            business_name: title.trim(),
            category: category || payload.category,
            phone: normalizePhone(phone),
            address: address || null,
            city: city.trim(),
            state: state.trim(),
            rating: rating || null,
            review_count: reviews || null,
            google_maps_url: mapsUrl || null,
            email: normalizeEmail(emailRaw),
            latitude: row.latitude ? Number(row.latitude) : null,
            longitude: row.longitude ? Number(row.longitude) : null,
            has_website: false,
            lead_score: score.total,
            contactability_score: score.contactability
          });
          if (!error) leadsSaved += 1;

          await redis.publish(progressChannel, JSON.stringify({ type: "progress", found: totalFound, saved: leadsSaved }));
        })
        .on("end", () => resolve());
    });

    await supabase
      .from("scrape_jobs")
      .update({
        status: "done",
        total_found: totalFound,
        leads_saved: leadsSaved,
        filtered_out: filteredOut,
        duplicates_removed: duplicatesRemoved,
        finished_at: new Date().toISOString()
      })
      .eq("id", payload.jobId)
      .eq("user_id", payload.userId);

    await redis.publish(progressChannel, JSON.stringify({ type: "done", found: totalFound, saved: leadsSaved }));
  } catch (error) {
    await supabase
      .from("scrape_jobs")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown failure",
        finished_at: new Date().toISOString()
      })
      .eq("id", payload.jobId)
      .eq("user_id", payload.userId);
    await redis.publish(
      progressChannel,
      JSON.stringify({
        type: "failed",
        found: totalFound,
        saved: leadsSaved,
        message: error instanceof Error ? error.message : "Unknown failure"
      })
    );
    throw error;
  }
}
