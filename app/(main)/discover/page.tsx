import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { discoverProfiles } from "@/lib/actions/social";
import { getProfileByAuthId } from "@/lib/github";
import { isFollowing } from "@/lib/actions/social";
import { ProfileCard } from "@/components/profile-card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const POPULAR_LANGUAGES = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Rust",
  "Go",
  "Java",
  "C++",
  "Ruby",
];

interface DiscoverPageProps {
  searchParams: Promise<{ q?: string; lang?: string }>;
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const currentProfile = await getProfileByAuthId(user.id);

  const profiles = await discoverProfiles({
    search: params.q,
    language: params.lang,
    limit: 50,
  });

  const filteredProfiles = profiles.filter(
    (p) => p.id !== currentProfile?.id
  );

  const followingStatus = await Promise.all(
    filteredProfiles.map((p) => isFollowing(p.id))
  );

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold">Discover Engineers</h1>

      <div className="mb-6 space-y-4">
        <form>
          <Input
            name="q"
            placeholder="Search by name, username, or bio..."
            defaultValue={params.q}
            className="max-w-md"
          />
        </form>

        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">Filter by language:</span>
          {POPULAR_LANGUAGES.map((lang) => (
            <a key={lang} href={`/discover?lang=${lang}`}>
              <Badge
                variant={params.lang === lang ? "default" : "outline"}
                className="cursor-pointer"
              >
                {lang}
              </Badge>
            </a>
          ))}
          {params.lang && (
            <a href="/discover">
              <Badge variant="destructive" className="cursor-pointer">
                Clear filter
              </Badge>
            </a>
          )}
        </div>
      </div>

      {filteredProfiles.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          <p>No engineers found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredProfiles.map((profile, index) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              initialFollowing={followingStatus[index]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
