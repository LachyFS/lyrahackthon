"use client";

import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Briefcase,
  GraduationCap,
  ExternalLink,
  Building2,
  Award,
  Users,
  CheckCircle,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

// LinkedIn icon
const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

interface LinkedInExperience {
  title: string;
  company: string;
  duration: string | null;
  isCurrent: boolean;
}

interface LinkedInEducation {
  school: string;
  degree: string | null;
  field: string | null;
}

interface LinkedInProfileData {
  name: string;
  headline: string | null;
  location: string | null;
  profileUrl: string;
  currentCompany: string | null;
  currentRole: string | null;
  about: string | null;
  openToWork: boolean;
  verified: boolean;
  connectionCount: number | null;
  topSkills: string | null;
  experience: LinkedInExperience[];
  education: LinkedInEducation[];
  skills: string[];
}

interface LinkedInSearchResultProps {
  profiles: LinkedInProfileData[];
  searchParams?: {
    searchQuery?: string;
    currentJobTitles?: string[];
    locations?: string[];
    currentCompanies?: string[];
  };
  total: number;
}

interface LinkedInProfileResultProps {
  profile: LinkedInProfileData & {
    firstName?: string | null;
    lastName?: string | null;
    profileImage?: string | null;
    followerCount?: number | null;
    hiring?: boolean;
    premium?: boolean;
    certifications?: Array<{
      name: string;
      issuingOrganization: string | null;
    }>;
    languages?: string[];
  };
}

// Expandable profile card for search results
function LinkedInProfileCard({ profile }: { profile: LinkedInProfileData }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden hover:bg-white/[0.07] transition-colors">
      {/* Header - clickable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center gap-3 text-left"
      >
        {/* LinkedIn logo as avatar placeholder */}
        <div className="w-10 h-10 rounded-full bg-[#0077B5]/20 flex items-center justify-center flex-shrink-0">
          <LinkedInIcon className="h-5 w-5 text-[#0077B5]" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-white">{profile.name}</span>
            {profile.verified && (
              <CheckCircle className="h-3.5 w-3.5 text-[#0077B5]" />
            )}
            {profile.openToWork && (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] py-0 h-4">
                Open to work
              </Badge>
            )}
          </div>
          {profile.headline && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{profile.headline}</p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {profile.location && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {profile.location}
              </span>
            )}
            {profile.currentCompany && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <Building2 className="h-3 w-3" />
                {profile.currentCompany}
              </span>
            )}
            {profile.connectionCount && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <Users className="h-3 w-3" />
                {profile.connectionCount.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Expand indicator */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={profile.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#0077B5] transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Expanded content */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-white/10 p-4 space-y-4">
          {/* About */}
          {profile.about && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">About</div>
              <p className="text-sm text-white/80 line-clamp-3">{profile.about}</p>
            </div>
          )}

          {/* Skills */}
          {profile.skills.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-2">Skills</div>
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.slice(0, 8).map((skill) => (
                  <Badge key={skill} variant="outline" className="text-[10px] py-0 px-1.5 h-5">
                    {skill}
                  </Badge>
                ))}
                {profile.skills.length > 8 && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-5 text-muted-foreground">
                    +{profile.skills.length - 8} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Experience */}
          {profile.experience.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                <Briefcase className="h-3 w-3" />
                <span>Experience</span>
              </div>
              <div className="space-y-2">
                {profile.experience.slice(0, 3).map((exp, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#0077B5] mt-1.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm text-white">{exp.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {exp.company}
                        {exp.duration && ` · ${exp.duration}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {profile.education.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                <GraduationCap className="h-3 w-3" />
                <span>Education</span>
              </div>
              <div className="space-y-2">
                {profile.education.slice(0, 2).map((edu, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm text-white">{edu.school}</div>
                      {(edu.degree || edu.field) && (
                        <div className="text-xs text-muted-foreground">
                          {[edu.degree, edu.field].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* View full profile link */}
          <a
            href={profile.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs text-[#0077B5] hover:text-[#0099E0] py-2"
          >
            View full profile on LinkedIn →
          </a>
        </div>
      </div>
    </div>
  );
}

// Search results component
export function LinkedInSearchResult({ profiles, searchParams, total }: LinkedInSearchResultProps) {
  const searchDescription = [
    searchParams?.searchQuery,
    searchParams?.currentJobTitles?.join(", "),
    searchParams?.locations?.join(", "),
  ].filter(Boolean).join(" • ");

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LinkedInIcon className="h-4 w-4 text-[#0077B5]" />
        <span>Found {total} LinkedIn profile{total !== 1 ? "s" : ""}</span>
        {searchDescription && (
          <span className="text-xs">for &quot;{searchDescription}&quot;</span>
        )}
      </div>

      {/* Profile cards */}
      <div className="space-y-2">
        {profiles.map((profile, i) => (
          <LinkedInProfileCard key={profile.profileUrl || i} profile={profile} />
        ))}
      </div>
    </div>
  );
}

// Single profile result component (for linkedinProfile tool)
export function LinkedInProfileResult({ profile }: LinkedInProfileResultProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-start gap-4">
          {/* Profile image or placeholder */}
          <div className="w-16 h-16 rounded-full bg-[#0077B5]/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {profile.profileImage ? (
              <img src={profile.profileImage} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <LinkedInIcon className="h-8 w-8 text-[#0077B5]" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-white text-lg">{profile.name}</h3>
              {profile.verified && (
                <CheckCircle className="h-4 w-4 text-[#0077B5]" />
              )}
              {profile.premium && (
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                  Premium
                </Badge>
              )}
              <a
                href={profile.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            {profile.headline && (
              <p className="text-sm text-muted-foreground mt-1">{profile.headline}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {profile.location && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {profile.location}
                </span>
              )}
              {profile.currentCompany && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {profile.currentCompany}
                </span>
              )}
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            {profile.openToWork && (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                Open to work
              </Badge>
            )}
            {profile.hiring && (
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                Hiring
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 p-4 border-b border-white/10">
        <div className="text-center">
          <div className="text-lg font-semibold text-white">
            {profile.connectionCount?.toLocaleString() || "-"}
          </div>
          <div className="text-xs text-muted-foreground">Connections</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-white">
            {profile.followerCount?.toLocaleString() || "-"}
          </div>
          <div className="text-xs text-muted-foreground">Followers</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-white">
            {profile.experience?.length || 0}
          </div>
          <div className="text-xs text-muted-foreground">Positions</div>
        </div>
      </div>

      {/* About */}
      {profile.about && (
        <div className="p-4 border-b border-white/10">
          <div className="text-xs text-muted-foreground mb-2">About</div>
          <p className="text-sm text-white/80">{profile.about}</p>
        </div>
      )}

      {/* Skills */}
      {profile.skills && profile.skills.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <div className="text-xs text-muted-foreground mb-2">Skills</div>
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.slice(0, 15).map((skill) => (
              <Badge key={skill} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
            {profile.skills.length > 15 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{profile.skills.length - 15} more
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Experience */}
      {profile.experience && profile.experience.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Briefcase className="h-4 w-4" />
            <span>Experience</span>
          </div>
          <div className="space-y-3">
            {profile.experience.slice(0, 5).map((exp, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  exp.isCurrent ? "bg-emerald-400" : "bg-white/30"
                }`} />
                <div>
                  <div className="text-sm font-medium text-white">{exp.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {exp.company}
                    {exp.duration && ` · ${exp.duration}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {profile.education && profile.education.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <GraduationCap className="h-4 w-4" />
            <span>Education</span>
          </div>
          <div className="space-y-3">
            {profile.education.slice(0, 3).map((edu, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-white">{edu.school}</div>
                  {(edu.degree || edu.field) && (
                    <div className="text-xs text-muted-foreground">
                      {[edu.degree, edu.field].filter(Boolean).join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Certifications */}
      {profile.certifications && profile.certifications.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Award className="h-4 w-4" />
            <span>Certifications</span>
          </div>
          <div className="space-y-2">
            {profile.certifications.slice(0, 4).map((cert, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                <div>
                  <div className="text-sm text-white">{cert.name}</div>
                  {cert.issuingOrganization && (
                    <div className="text-xs text-muted-foreground">{cert.issuingOrganization}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View on LinkedIn */}
      <div className="p-4">
        <a
          href={profile.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-[#0077B5]/20 hover:bg-[#0077B5]/30 text-[#0077B5] text-sm font-medium transition-colors"
        >
          <LinkedInIcon className="h-4 w-4" />
          View full profile on LinkedIn
        </a>
      </div>
    </div>
  );
}
