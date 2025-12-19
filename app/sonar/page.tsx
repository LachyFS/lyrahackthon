"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/app-layout";
import { SonarBriefCard } from "@/components/sonar-brief-card";
import { SonarBriefDialog } from "@/components/sonar-brief-dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { getSonarBriefs, type SonarBriefWithStats } from "@/lib/actions/sonar";
import { ScoutBrief } from "@/src/db/schema";
import {
  Activity,
  Plus,
  Loader2,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function SonarPage() {
  const [user, setUser] = useState<User | null>(null);
  const [briefs, setBriefs] = useState<SonarBriefWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBrief, setEditingBrief] = useState<ScoutBrief | null>(null);
  const [searchingBriefId, setSearchingBriefId] = useState<string | null>(null);

  // Fetch user and briefs on mount
  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      if (data.user) {
        const fetchedBriefs = await getSonarBriefs();
        setBriefs(fetchedBriefs);
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const handleRefreshBriefs = async () => {
    const fetchedBriefs = await getSonarBriefs();
    setBriefs(fetchedBriefs);
  };

  const handleEdit = (brief: ScoutBrief) => {
    setEditingBrief(brief);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingBrief(null);
  };

  const handleRunSearch = async (briefId: string) => {
    setSearchingBriefId(briefId);
    try {
      const response = await fetch("/api/sonar/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId }),
      });

      if (response.ok) {
        // Refresh briefs to show updated results
        await handleRefreshBriefs();
      }
    } catch (error) {
      console.error("Failed to run search:", error);
    } finally {
      setSearchingBriefId(null);
    }
  };

  if (isLoading) {
    return (
      <AppLayout user={user}>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout user={user}>
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="text-center max-w-md">
            <Activity className="h-16 w-16 mx-auto mb-4 text-emerald-400/50" />
            <h1 className="text-2xl font-bold text-white mb-2">Sonar</h1>
            <p className="text-muted-foreground mb-6">
              Sign in to create searches and let AI find matching developers for you daily.
            </p>
            <Link href="/login">
              <Button className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500">
                Sign In to Get Started
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
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center justify-between mb-8"
            >
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <Activity className="h-8 w-8 text-emerald-400" />
                  Sonar
                </h1>
                <p className="text-muted-foreground mt-1">
                  Describe what you need and we&apos;ll find matching developers
                </p>
              </div>
              {<Button
                onClick={() => setDialogOpen(true)}
                className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Search
              </Button>}
            </motion.div>

            {briefs.length === 0 ? (
              /* Empty state */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="text-center py-16"
              >
                <h2 className="text-2xl font-semibold text-white mb-3">
                  Who are you looking for?
                </h2>
                <p className="text-muted-foreground max-w-lg mx-auto mb-8 text-base">
                  Just describe the developer you need - paste a job posting, list some skills,
                  or write it however you like. We&apos;ll find matching profiles on GitHub.
                </p>

                <Button
                  onClick={() => setDialogOpen(true)}
                  size="lg"
                  className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
                >
                  <Activity className="h-5 w-5 mr-2" />
                  Start Searching
                </Button>
              </motion.div>
            ) : (
              /* Briefs list */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="space-y-4"
              >
                {briefs.map((brief, index) => (
                  <motion.div
                    key={brief.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
                  >
                    <SonarBriefCard
                      brief={brief}
                      onEdit={handleEdit}
                      onRunSearch={handleRunSearch}
                      isSearching={searchingBriefId === brief.id}
                      onRefresh={handleRefreshBriefs}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </main>
      </div>

      <SonarBriefDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        brief={editingBrief}
        onSuccess={handleRefreshBriefs}
      />
    </AppLayout>
  );
}
