export type ScrapeJobPayload = {
  jobId: string;
  userId: string;
  category: string;
  city: string;
  state: string;
  depth: number;
  preset: string;
  rules: {
    minReviews: number;
    minRating: number;
    maxRating: number;
    excludeChains: boolean;
  };
};
