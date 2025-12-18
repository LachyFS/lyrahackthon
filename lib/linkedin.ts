import { ApifyClient } from "apify-client";
import { getCached, setCache } from "./redis";

// ============================================================================
// TYPES
// ============================================================================

export interface LinkedInProfile {
  profileUrl: string;
  publicIdentifier: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  location: string | null;
  about: string | null;
  currentCompany: string | null;
  currentRole: string | null;
  profileImage: string | null;
  connectionCount: number | null;
  followerCount: number | null;
  openToWork: boolean;
  hiring: boolean;
  premium: boolean;
  verified: boolean;
  experience: LinkedInExperience[];
  education: LinkedInEducation[];
  skills: string[];
  certifications: LinkedInCertification[];
  languages: string[];
  topSkills: string | null;
  registeredAt: string | null;
}

export interface LinkedInExperience {
  title: string;
  company: string;
  companyLinkedinUrl: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  duration: string | null;
  description: string | null;
  skills: string[];
  isCurrent: boolean;
}

export interface LinkedInEducation {
  school: string;
  schoolLinkedinUrl: string | null;
  degree: string | null;
  field: string | null;
  startYear: string | null;
  endYear: string | null;
  period: string | null;
  skills: string[];
}

export interface LinkedInCertification {
  name: string;
  issuingOrganization: string | null;
  issueDate: string | null;
  expirationDate: string | null;
  link: string | null;
}

// Search result from HarvestAPI actor
export interface LinkedInSearchResult {
  id: string;
  publicIdentifier: string;
  linkedinUrl: string;
  firstName: string;
  lastName: string;
  name: string;
  headline: string | null;
  location: {
    linkedinText: string | null;
    countryCode: string | null;
    parsed?: {
      country: string | null;
      state: string | null;
      city: string | null;
    };
  } | null;
  profilePicture: string | null;
  openToWork: boolean;
  hiring: boolean;
  premium: boolean;
  verified: boolean;
  connectionCount: number | null;
  followerCount: number | null;
  topSkills: string | null;
  currentPosition: Array<{
    companyName: string;
    companyLinkedinUrl: string | null;
    dateRange?: {
      start?: { month?: number; year?: number };
      end?: { month?: number; year?: number } | null;
    };
  }>;
  // Full profile fields (when profileScraperMode is "Full")
  about?: string;
  experience?: Array<{
    position: string;
    companyName: string;
    companyLinkedinUrl?: string;
    location?: string;
    duration?: string;
    description?: string;
    skills?: string[];
    startDate?: { month?: string; year?: number; text?: string };
    endDate?: { month?: string; year?: number; text?: string };
  }>;
  education?: Array<{
    schoolName: string;
    schoolLinkedinUrl?: string;
    degree?: string;
    fieldOfStudy?: string;
    period?: string;
    skills?: string[];
    startDate?: { month?: string; year?: number; text?: string };
    endDate?: { month?: string; year?: number; text?: string };
  }>;
  certifications?: Array<{
    title: string;
    issuedAt?: string;
    issuedBy?: string;
    link?: string;
  }>;
  skills?: Array<{ name: string }>;
}

export interface LinkedInSearchOptions {
  /** General search query (fuzzy search) */
  searchQuery?: string;
  /** List of current job titles (exact search) */
  currentJobTitles?: string[];
  /** List of past job titles (exact search) */
  pastJobTitles?: string[];
  /** List of locations where they currently live */
  locations?: string[];
  /** List of LinkedIn Company URLs where they currently work */
  currentCompanies?: string[];
  /** List of LinkedIn Company URLs where they previously worked */
  pastCompanies?: string[];
  /** List of LinkedIn School URLs */
  schools?: string[];
  /** List of LinkedIn industry IDs */
  industryIds?: number[];
  /** Profile scraper mode: "Short" for basic data, "Full" for complete profile */
  profileScraperMode?: "Short" | "Full";
  /** Number of search pages to scrape (max 100, each page = up to 25 results) */
  takePages?: number;
  /** Maximum number of profiles to return */
  maxItems?: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const APIFY_API_KEY = process.env.APIFY_API_KEY;

// Actor IDs (from user-provided code)
const LINKEDIN_SEARCH_ACTOR_ID = "M2FMdjRVeF1HPGFcc";
const LINKEDIN_PROFILE_ACTOR_ID = "2SyF0bVxmgGr8IVCZ";

// Cache TTL: 1 hour for LinkedIn profiles, 30 mins for search results
const LINKEDIN_PROFILE_CACHE_TTL = 60 * 60;
const LINKEDIN_SEARCH_CACHE_TTL = 30 * 60;

// ============================================================================
// APIFY CLIENT
// ============================================================================

function getApifyClient(): ApifyClient {
  if (!APIFY_API_KEY) {
    throw new Error("APIFY_API_KEY environment variable is not set");
  }
  return new ApifyClient({ token: APIFY_API_KEY });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract LinkedIn username from a URL or return as-is if already a username
 */
export function extractLinkedInUsername(input: string): string {
  // If it's a URL, extract the username
  const urlMatch = input.match(
    /(?:linkedin\.com\/in\/|linkedin\.com\/pub\/)([^/?#]+)/i
  );
  if (urlMatch) {
    return urlMatch[1];
  }

  // If it looks like a URL but doesn't match, try to clean it up
  if (input.includes("linkedin.com")) {
    const parts = input.split("/");
    const inIndex = parts.findIndex((p) => p === "in" || p === "pub");
    if (inIndex !== -1 && parts[inIndex + 1]) {
      return parts[inIndex + 1].split("?")[0];
    }
  }

  // Assume it's already a username, clean it up
  return input.replace(/[^a-zA-Z0-9-]/g, "");
}

/**
 * Build LinkedIn profile URL from username
 */
export function buildLinkedInUrl(username: string): string {
  const cleanUsername = extractLinkedInUsername(username);
  return `https://www.linkedin.com/in/${cleanUsername}/`;
}

/**
 * Normalize HarvestAPI search result into our standard format
 */
function normalizeSearchResult(data: LinkedInSearchResult): LinkedInProfile {
  const name =
    data.name ||
    [data.firstName, data.lastName].filter(Boolean).join(" ") ||
    "Unknown";

  // Extract experience from full profile data
  const experience: LinkedInExperience[] = (data.experience || []).map(
    (exp) => ({
      title: exp.position || "",
      company: exp.companyName || "",
      companyLinkedinUrl: exp.companyLinkedinUrl || null,
      location: exp.location || null,
      startDate: exp.startDate?.text || null,
      endDate: exp.endDate?.text || null,
      duration: exp.duration || null,
      description: exp.description || null,
      skills: exp.skills || [],
      isCurrent: exp.endDate?.text === "Present" || !exp.endDate,
    })
  );

  // Extract education
  const education: LinkedInEducation[] = (data.education || []).map((edu) => ({
    school: edu.schoolName || "",
    schoolLinkedinUrl: edu.schoolLinkedinUrl || null,
    degree: edu.degree || null,
    field: edu.fieldOfStudy || null,
    startYear: edu.startDate?.text || null,
    endYear: edu.endDate?.text || null,
    period: edu.period || null,
    skills: edu.skills || [],
  }));

  // Extract certifications
  const certifications: LinkedInCertification[] = (
    data.certifications || []
  ).map((cert) => ({
    name: cert.title || "",
    issuingOrganization: cert.issuedBy || null,
    issueDate: cert.issuedAt || null,
    expirationDate: null,
    link: cert.link || null,
  }));

  // Extract skills
  const skills: string[] = (data.skills || [])
    .map((s) => s.name)
    .filter(Boolean);

  // Find current company/role
  const currentPos = data.currentPosition?.[0];
  const currentExp = experience.find((e) => e.isCurrent);

  return {
    profileUrl: data.linkedinUrl || `https://www.linkedin.com/in/${data.publicIdentifier}/`,
    publicIdentifier: data.publicIdentifier,
    name,
    firstName: data.firstName || null,
    lastName: data.lastName || null,
    headline: data.headline || null,
    location: data.location?.linkedinText || null,
    about: data.about || null,
    currentCompany: currentPos?.companyName || currentExp?.company || null,
    currentRole: currentExp?.title || null,
    profileImage: data.profilePicture || null,
    connectionCount: data.connectionCount || null,
    followerCount: data.followerCount || null,
    openToWork: data.openToWork || false,
    hiring: data.hiring || false,
    premium: data.premium || false,
    verified: data.verified || false,
    experience,
    education,
    skills,
    certifications,
    languages: [],
    topSkills: data.topSkills || null,
    registeredAt: null,
  };
}

// ============================================================================
// SEARCH FUNCTION (HarvestAPI Actor)
// ============================================================================

/**
 * Search for LinkedIn profiles using the HarvestAPI actor
 * Supports filtering by job titles, locations, companies, schools, etc.
 */
export async function searchLinkedInProfiles(
  options: LinkedInSearchOptions
): Promise<LinkedInProfile[]> {
  const client = getApifyClient();

  const {
    searchQuery,
    currentJobTitles,
    pastJobTitles,
    locations,
    currentCompanies,
    pastCompanies,
    schools,
    industryIds,
    profileScraperMode = "Full",
    takePages = 1,
    maxItems = 25,
  } = options;

  // Build cache key from search params
  const cacheKeyParts = [
    searchQuery,
    currentJobTitles?.join(","),
    locations?.join(","),
    currentCompanies?.join(","),
    profileScraperMode,
    takePages,
    maxItems,
  ].filter(Boolean);
  const cacheKey = `linkedin:search:${Buffer.from(cacheKeyParts.join("|")).toString("base64").slice(0, 50)}`;

  // Check cache
  const cached = await getCached<LinkedInProfile[]>(cacheKey);
  if (cached) {
    console.log(`[LinkedIn Search] Cache hit`);
    return cached;
  }

  console.log(`[LinkedIn Search] Searching with:`, {
    searchQuery,
    currentJobTitles,
    locations,
    profileScraperMode,
  });

  // Build input for the actor
  const input: Record<string, unknown> = {
    profileScraperMode,
    takePages: Math.min(takePages, 10), // Limit to 10 pages for cost control
    maxItems: Math.min(maxItems, 100), // Limit results
    startPage: 1,
  };

  if (searchQuery) input.searchQuery = searchQuery;
  if (currentJobTitles?.length) input.currentJobTitles = currentJobTitles;
  if (pastJobTitles?.length) input.pastJobTitles = pastJobTitles;
  if (locations?.length) input.locations = locations;
  if (currentCompanies?.length) input.currentCompanies = currentCompanies;
  if (pastCompanies?.length) input.pastCompanies = pastCompanies;
  if (schools?.length) input.schools = schools;
  if (industryIds?.length) input.industryIds = industryIds;

  // Run the actor using ApifyClient SDK
  const run = await client.actor(LINKEDIN_SEARCH_ACTOR_ID).call(input);

  // Fetch results from the dataset
  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  if (!items || items.length === 0) {
    return [];
  }

  const profiles = (items as LinkedInSearchResult[]).map(normalizeSearchResult);

  // Cache the results
  await setCache(cacheKey, profiles, LINKEDIN_SEARCH_CACHE_TTL);

  return profiles;
}

// ============================================================================
// PROFILE SCRAPING (for individual profiles by URL)
// ============================================================================

/**
 * Scrape a single LinkedIn profile by URL or username
 * Uses the HarvestAPI profile scraper actor
 */
export async function scrapeLinkedInProfile(
  profileUrlOrUsername: string,
  options: {
    skipCache?: boolean;
  } = {}
): Promise<LinkedInProfile> {
  const client = getApifyClient();

  const { skipCache = false } = options;
  const profileUrl = buildLinkedInUrl(profileUrlOrUsername);
  const username = extractLinkedInUsername(profileUrlOrUsername);
  const cacheKey = `linkedin:profile:${username}`;

  // Check cache first
  if (!skipCache) {
    const cached = await getCached<LinkedInProfile>(cacheKey);
    if (cached) {
      console.log(`[LinkedIn] Cache hit for ${profileUrl}`);
      return cached;
    }
  }

  console.log(`[LinkedIn] Scraping profile: ${profileUrl}`);

  // Run the actor using ApifyClient SDK
  const run = await client.actor(LINKEDIN_PROFILE_ACTOR_ID).call({
    profileUrls: [profileUrl],
  });

  // Fetch results from the dataset
  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  if (!items || items.length === 0) {
    throw new Error(`No data returned for LinkedIn profile: ${profileUrl}`);
  }

  const profile = normalizeSearchResult(items[0] as LinkedInSearchResult);

  // Cache the result
  await setCache(cacheKey, profile, LINKEDIN_PROFILE_CACHE_TTL);

  return profile;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick search for LinkedIn profiles by a simple query string
 * Parses the query to extract job titles, locations, etc.
 */
export async function quickLinkedInSearch(
  query: string,
  options: {
    maxResults?: number;
    fullProfile?: boolean;
  } = {}
): Promise<LinkedInProfile[]> {
  const { maxResults = 10, fullProfile = true } = options;

  return searchLinkedInProfiles({
    searchQuery: query,
    profileScraperMode: fullProfile ? "Full" : "Short",
    maxItems: maxResults,
    takePages: Math.ceil(maxResults / 25),
  });
}
