"use client";

import { useEffect, useState } from "react";
import { Brain, Loader2 } from "lucide-react";
import type { AnalysisResult, GitHubProfile } from "@/lib/actions/github-analyze";

interface AISummaryProps {
  analysis: AnalysisResult["analysis"];
  profile: GitHubProfile;
}

function generateSummary(analysis: AnalysisResult["analysis"], profile: GitHubProfile): string {
  const parts: string[] = [];

  // Opening based on recommendation
  if (analysis.recommendation === "strong") {
    parts.push(`${profile.name || profile.login} appears to be a strong technical candidate.`);
  } else if (analysis.recommendation === "good") {
    parts.push(`${profile.name || profile.login} shows solid technical foundations.`);
  } else if (analysis.recommendation === "moderate") {
    parts.push(`${profile.name || profile.login} has some technical experience worth considering.`);
  } else {
    parts.push(`${profile.name || profile.login}'s profile requires careful evaluation.`);
  }

  // Experience
  parts.push(`Based on their ${analysis.accountAge} years on GitHub and ${profile.public_repos} repositories, they appear to be at a ${analysis.estimatedExperience.toLowerCase()} level.`);

  // Activity
  if (analysis.activityLevel === "very_active" || analysis.activityLevel === "active") {
    parts.push(`They are ${analysis.activityLevel === "very_active" ? "very actively" : "actively"} coding, with recent contributions showing consistent engagement.`);
  } else if (analysis.activityLevel === "moderate") {
    parts.push("Their coding activity is moderate, suggesting they may balance GitHub with other work or private repositories.");
  } else {
    parts.push("Their recent GitHub activity is limited, which could indicate private work, a career change, or reduced coding activity.");
  }

  // Languages & Skills
  if (analysis.languages.length > 0) {
    const topLangs = analysis.languages.slice(0, 3).map(l => l.name);
    parts.push(`Their primary technologies are ${topLangs.join(", ")}, indicating ${
      topLangs.some(l => ["JavaScript", "TypeScript", "React"].includes(l)) ? "front-end or full-stack" :
      topLangs.some(l => ["Python", "Java", "Go", "Rust"].includes(l)) ? "back-end" :
      topLangs.some(l => ["Swift", "Kotlin", "Dart"].includes(l)) ? "mobile" :
      "diverse technical"
    } expertise.`);
  }

  // Community impact
  if (analysis.totalStars >= 100) {
    parts.push(`With ${analysis.totalStars.toLocaleString()} stars across their projects, they've created tools that other developers find valuable.`);
  } else if (analysis.totalStars >= 10) {
    parts.push("They have some community recognition through starred projects.");
  }

  // Collaboration style
  if (analysis.contributionPattern.includes("Collaborative")) {
    parts.push("Their contribution style emphasizes collaboration through pull requests, suggesting good teamwork skills.");
  } else if (analysis.contributionPattern.includes("Community")) {
    parts.push("They actively participate in community discussions, which indicates strong communication skills.");
  }

  // Key strengths
  if (analysis.strengths.length > 0) {
    const keyStrength = analysis.strengths[0].toLowerCase();
    parts.push(`A notable strength is their ${keyStrength}.`);
  }

  // Concerns (if any major ones)
  if (analysis.concerns.length > 0 && analysis.recommendation !== "strong") {
    const concern = analysis.concerns[0];
    if (concern.includes("activity")) {
      parts.push("However, you may want to discuss their recent work history, as their public activity has been limited.");
    } else if (concern.includes("fork")) {
      parts.push("Note that much of their work consists of forked repositories, so you may want to explore their original contributions during interviews.");
    }
  }

  // Closing recommendation
  if (analysis.recommendation === "strong") {
    parts.push("Overall, this profile demonstrates strong technical capability and consistent growth.");
  } else if (analysis.recommendation === "good") {
    parts.push("This candidate would likely be worth interviewing to explore their experience in more depth.");
  } else if (analysis.recommendation === "moderate") {
    parts.push("Consider an initial screening call to better understand their background and current work.");
  } else {
    parts.push("A thorough technical screening is recommended to assess their current skill level.");
  }

  return parts.join(" ");
}

export function AISummary({ analysis, profile }: AISummaryProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  const fullText = generateSummary(analysis, profile);

  useEffect(() => {
    let index = 0;
    const intervalId = setInterval(() => {
      if (index < fullText.length) {
        setDisplayedText(fullText.slice(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(intervalId);
      }
    }, 10); // Speed of typing

    return () => clearInterval(intervalId);
  }, [fullText]);

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-cyan-950/30 to-emerald-950/30 p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Brain className="h-5 w-5 text-cyan-400" />
        AI Summary for Hiring Managers
        {isTyping && <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />}
      </h2>
      <p className="text-muted-foreground leading-relaxed">
        {displayedText}
        {isTyping && <span className="animate-pulse">|</span>}
      </p>
    </div>
  );
}
