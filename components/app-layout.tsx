"use client";

import { ReactNode, Suspense } from "react";
import { User } from "@supabase/supabase-js";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Loader2 } from "lucide-react";

interface AppLayoutProps {
  children: ReactNode;
  user?: User | null;
}

function AppLayoutContent({ children, user }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset className="flex flex-col h-screen max-h-screen overflow-hidden">
        {/* Mobile header with sidebar trigger */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-white/5 bg-background/80 backdrop-blur-xl px-4 md:hidden">
          <SidebarTrigger />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

export function AppLayout({ children, user }: AppLayoutProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
      }
    >
      <AppLayoutContent user={user}>{children}</AppLayoutContent>
    </Suspense>
  );
}
