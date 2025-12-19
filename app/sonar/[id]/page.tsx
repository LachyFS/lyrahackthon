"use client";

import { useState, useEffect, use } from "react";
import { AppLayout } from "@/components/app-layout";
import { SonarResultCard } from "@/components/sonar-result-card";
import { SonarBriefDialog } from "@/components/sonar-brief-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import {
  getSonarBrief,
  getSonarResults,
  type SonarBriefWithStats,
} from "@/lib/actions/sonar";
import { ScoutResult, ScoutBrief } from "@/src/db/schema";
import {
  Activity,
  ArrowLeft,
  Loader2,
  Edit,
  Clock,
  Users,
  MapPin,
  Code2,
  Sparkles,
  Filter,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default function SonarBriefDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [user, setUser] = useState<User | null>(null);
  const [brief, setBrief] = useState<SonarBriefWithStats | null>(null);
  const [results, setResults] = useState<ScoutResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isSearching, setIsSearching] = useState(false);

  // Fetch user, brief, and results on mount
  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      if (data.user) {
        const fetchedBrief = await getSonarBrief(resolvedParams.id);
        setBrief(fetchedBrief);

        if (fetchedBrief) {
          const fetchedResults = await getSonarResults(resolvedParams.id);
          setResults(fetchedResults);
        }
      }
      setIsLoading(false);
    };
    init();
  }, [resolvedParams.id]);

  const handleRefresh = async () => {
    const fetchedBrief = await getSonarBrief(resolvedParams.id);
    setBrief(fetchedBrief);

    if (fetchedBrief) {
      const fetchedResults = await getSonarResults(resolvedParams.id);
      setResults(fetchedResults);
    }
  };

  const handleRunSearch = async () => {
    setIsSearching(true);
    try {
      const response = await fetch("/api/sonar/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId: resolvedParams.id }),
      });

      if (response.ok) {
        await handleRefresh();
      }
    } catch (error) {
      console.error("Failed to run search:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleStatusChange = () => {
    handleRefresh();
  };

  const filteredResults = results.filter((result) => {
    if (statusFilter === "all") return true;
    return result.status === statusFilter;
  });

  if (isLoading) {
    return (
      <AppLayout user={user}>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
      </AppLayout>
    );
  }

  if (!user || !brief) {
    return (
      <AppLayout user={user}>
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="text-center max-w-md">
            <Activity className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-2xl font-bold text-white mb-2">Search Not Found</h1>
            <p className="text-muted-foreground mb-6">
              This search doesn&apos;t exist or you don&apos;t have access to it.
            </p>
            <Link href="/sonar">
              <Button variant="outline" className="border-white/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sonar
              </Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user}>
      <div className="relative flex-1 flex flex-col overflow-hidden min-h-0 bg-background">
        {/* Background effects */}
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute inset-0 noise-overlay pointer-events-none" />
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full blur-3xl bg-emerald-600/20 animate-pulse-glow" />
        <div className="absolute top-[20%] right-[-5%] w-[500px] h-[500px] rounded-full blur-3xl bg-cyan-500/15 animate-pulse-glow" style={{ animationDelay: "200ms" }} />

        <main className="relative z-10 flex-1 overflow-auto">
          <div className="container mx-auto px-4 md:px-6 py-8 max-w-5xl">
            {/* Back link */}
            <Link
              href="/sonar"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-white transition-colors mb-6"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sonar
            </Link>

            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-8"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${brief.isActive ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
                    <Activity className={`h-8 w-8 ${brief.isActive ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white">{brief.name}</h1>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {brief.lastSearchAt
                          ? `Last searched ${formatDistanceToNow(new Date(brief.lastSearchAt), { addSuffix: true })}`
                          : "Never searched"}
                      </div>
                      <Badge variant="outline" className={`text-xs ${brief.isActive ? 'border-emerald-500/30 text-emerald-300' : 'border-white/10 text-muted-foreground'}`}>
                        {brief.isActive ? "Active" : "Paused"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogOpen(true)}
                    className="border-white/10 hover:border-white/20"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleRunSearch}
                    disabled={isSearching}
                    className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Activity className="h-4 w-4 mr-1" />
                        Run Search
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {brief.description && (
                <p className="text-muted-foreground mb-4 max-w-3xl">
                  {brief.description}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {brief.requiredSkills && brief.requiredSkills.length > 0 && (
                  brief.requiredSkills.map((skill) => (
                    <Badge key={skill} variant="outline" className="text-xs border-cyan-500/30 text-cyan-300">
                      <Code2 className="h-3 w-3 mr-1" />
                      {skill}
                    </Badge>
                  ))
                )}
                {brief.preferredLocation && (
                  <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-300">
                    <MapPin className="h-3 w-3 mr-1" />
                    {brief.preferredLocation}
                  </Badge>
                )}
                {brief.projectType && (
                  <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-300">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {brief.projectType}
                  </Badge>
                )}
              </div>
            </motion.div>

            {/* Results section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-emerald-400" />
                    Discovered Profiles
                  </h2>
                  <Badge variant="outline" className="border-white/10">
                    {brief.totalResults} total
                  </Badge>
                  {brief.newResults > 0 && (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                      {brief.newResults} new
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px] bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10">
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="viewed">Viewed</SelectItem>
                      <SelectItem value="saved">Saved</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="dismissed">Dismissed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredResults.length === 0 ? (
                <div className="text-center py-16 bg-white/[0.02] border border-white/10 rounded-xl">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium text-white mb-2">
                    {results.length === 0 ? "No profiles discovered yet" : "No matching profiles"}
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    {results.length === 0
                      ? "Run a search to discover developers matching your criteria."
                      : "Try changing the status filter to see other profiles."}
                  </p>
                  {results.length === 0 && (
                    <Button
                      onClick={handleRunSearch}
                      disabled={isSearching}
                      className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
                    >
                      {isSearching ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Activity className="h-4 w-4 mr-2" />
                          Run First Search
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredResults.map((result, index) => (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.05 * index }}
                    >
                      <SonarResultCard
                        result={result}
                        onStatusChange={handleStatusChange}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </main>
      </div>

      <SonarBriefDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        brief={brief as ScoutBrief}
        onSuccess={handleRefresh}
      />
    </AppLayout>
  );
}
