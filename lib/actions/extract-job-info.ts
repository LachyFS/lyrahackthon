"use server";

import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const JobExtractionSchema = z.object({
  name: z.string().describe("A short, descriptive name for this search (max 60 chars)"),
  skills: z.array(z.string()).describe("Technical skills, programming languages, frameworks, and tools required"),
  location: z.string().nullable().describe("Preferred location or region, null if remote/anywhere"),
  projectType: z.enum(["Web", "Mobile", "ML/AI", "DevOps", "Web3", "Embedded", "Games", "Security", "Backend", "Frontend", "Fullstack", "Data", "Other"]).nullable().describe("Primary project/role type"),
  salaryMin: z.number().nullable().describe("Minimum salary in USD (converted if needed), null if not specified"),
  salaryMax: z.number().nullable().describe("Maximum salary in USD (converted if needed), null if not specified"),
  salaryPeriod: z.enum(["yearly", "monthly", "hourly"]).nullable().describe("Salary period, default to yearly if unclear"),
  experienceLevel: z.enum(["junior", "mid", "senior", "lead", "principal"]).nullable().describe("Required experience level"),
  employmentType: z.enum(["full-time", "part-time", "contract", "freelance"]).nullable().describe("Type of employment"),
  remotePolicy: z.enum(["remote", "hybrid", "onsite"]).nullable().describe("Remote work policy"),
  companyName: z.string().nullable().describe("Company name if mentioned"),
});

export type JobExtraction = z.infer<typeof JobExtractionSchema>;

export async function extractJobInfo(description: string): Promise<JobExtraction> {
  const { object } = await generateObject({
    model: anthropic("claude-3-5-haiku-latest"),
    schema: JobExtractionSchema,
    prompt: `Extract structured information from this job posting or developer search description.

For salary:
- Convert all salaries to USD using approximate rates (EUR=1.1, GBP=1.27, AUD=0.65, CAD=0.74)
- If salary is given as monthly, convert to yearly for comparison
- Only include salary if explicitly mentioned with numbers

For skills:
- Extract specific technologies, not general terms
- Normalize names (e.g., "JS" -> "JavaScript", "TS" -> "TypeScript", "k8s" -> "Kubernetes")
- Include both required and preferred skills

For location:
- Extract specific city/region if mentioned
- Return null if "remote", "anywhere", or no location preference

Description:
${description}`,
  });

  return object;
}
