import { streamText } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/redis";
import { checkBotId } from "botid/server";

const requestSchema = z.object({
  analysis: z.object({
    accountAge: z.number(),
    totalStars: z.number(),
    totalForks: z.number(),
    languages: z.array(z.object({
      name: z.string(),
      count: z.number(),
      percentage: z.number(),
    })),
    topRepos: z.array(z.object({
      name: z.string(),
      description: z.string().nullable(),
      stargazers_count: z.number(),
      language: z.string().nullable(),
    })),
    activityLevel: z.enum(["very_active", "active", "moderate", "low", "inactive"]),
    lastActivityDays: z.number(),
    topTopics: z.array(z.string()),
    contributionPattern: z.string(),
    estimatedExperience: z.string(),
    strengths: z.array(z.string()),
    concerns: z.array(z.string()),
    overallScore: z.number(),
    recommendation: z.enum(["strong", "good", "moderate", "weak"]),
  }),
  profile: z.object({
    login: z.string(),
    name: z.string().nullable(),
    bio: z.string().nullable(),
    location: z.string().nullable(),
    company: z.string().nullable(),
    followers: z.number(),
    following: z.number(),
    public_repos: z.number(),
  }),
});

export async function POST(req: Request) {
  // Vercel BotID Protection - reject requests from bots
  const verification = await checkBotId();
  if (verification.isBot) {
    return new Response(
      JSON.stringify({ error: "Automated requests are not allowed." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // Require authentication for AI generation
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Authentication required. Please sign in to use AI features." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Rate limiting: 30 requests per minute per user
  const rateLimit = await checkRateLimit(`ai:summary:${user.id}`, 30, 60);
  if (!rateLimit.success) {
    const resetDate = new Date(rateLimit.reset);
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000),
        limit: rateLimit.limit,
        reset: resetDate.toISOString(),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": rateLimit.limit.toString(),
          "X-RateLimit-Remaining": rateLimit.remaining.toString(),
          "X-RateLimit-Reset": resetDate.toISOString(),
          "Retry-After": Math.ceil((rateLimit.reset - Date.now()) / 1000).toString(),
        }
      }
    );
  }

  const body = await req.json();

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { analysis, profile } = parsed.data;

  const prompt = `You are an expert technical recruiter creating actionable insights for hiring managers evaluating a GitHub profile.

## Candidate Data

**Profile:**
- Username: @${profile.login}
- Name: ${profile.name || "Not provided"}
- Bio: ${profile.bio || "Not provided"}
- Location: ${profile.location || "Not provided"}
- Company: ${profile.company || "Not provided"}
- Followers: ${profile.followers} | Public repos: ${profile.public_repos}

**Assessment Metrics:**
- Account age: ${analysis.accountAge} years
- Estimated experience: ${analysis.estimatedExperience}
- Activity level: ${analysis.activityLevel} (${analysis.lastActivityDays} days since last activity)
- Overall score: ${analysis.overallScore}/100
- Recommendation: **${analysis.recommendation.toUpperCase()}**

**Technical Stack:**
${analysis.languages.slice(0, 6).map(l => `- ${l.name}: ${l.percentage}%`).join("\n")}

**Domain Expertise (Topics):**
${analysis.topTopics.slice(0, 8).join(", ") || "None identified"}

**Key Strengths:**
${analysis.strengths.map(s => `- ${s}`).join("\n")}

**Areas of Concern:**
${analysis.concerns.length > 0 ? analysis.concerns.map(c => `- ${c}`).join("\n") : "- None identified"}

**Notable Projects:**
${analysis.topRepos.slice(0, 4).map(r => `- **${r.name}** (${r.language || "Mixed"}, ${r.stargazers_count} stars): ${r.description || "No description"}`).join("\n")}

**Contribution Pattern:** ${analysis.contributionPattern}

## Your Task

Write a **recruiter-focused summary** in markdown format that helps hiring managers make quick decisions. Structure it as:

1. **Quick Take** (1 sentence): The bottom-line assessment - would you recommend moving forward?

2. **Strengths for Hiring** (2-3 bullets): What makes this candidate valuable? Be specific about technical skills and evidence.

3. **Interview Focus Areas** (2-3 bullets): What should interviewers dig into? Include both opportunities and any yellow flags.

4. **Best Fit For**: One line describing ideal role types (e.g., "Senior backend roles, startup environments, open-source focused teams")

Keep it concise, actionable, and evidence-based. Use **bold** for emphasis on key points. Don't be generic - reference specific technologies, projects, or patterns you see in the data.`;

  const result = streamText({
    model: "xai/grok-4.1-fast-reasoning",
    prompt,
    maxTokens: 600,
  });

  return result.toTextStreamResponse();
}
