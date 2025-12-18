"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { User } from "@supabase/supabase-js";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { GitRadarLogoWave, GitRoastLogo } from "@/components/gitradar-logo";
import { Button } from "@/components/ui/button";
import { signInWithGitHub, signOut } from "@/lib/actions/auth";
import {
  Home,
  MessageSquare,
  Flame,
  User as UserIcon,
  LogOut,
  GithubIcon,
} from "lucide-react";

interface AppSidebarProps {
  user?: User | null;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const roastMode = searchParams.get("roast") === "true";

  const navigationItems = [
    {
      label: "Home",
      href: "/",
      icon: Home,
      isActive: pathname === "/",
    },
    {
      label: "AI Chat",
      href: "/ai-search",
      icon: MessageSquare,
      isActive: pathname === "/ai-search" && !roastMode,
    },
    {
      label: "Roast Mode",
      href: "/ai-search?roast=true",
      icon: Flame,
      isActive: pathname === "/ai-search" && roastMode,
      className: "text-red-400 hover:text-red-300",
    },
  ];

  return (
    <Sidebar className="border-r border-white/5">
      <SidebarHeader className="px-4 py-4">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-lg group w-fit">
          <div className="relative">
            {roastMode ? (
              <GitRoastLogo className="h-7 w-7 transition-transform group-hover:scale-110" />
            ) : (
              <GitRadarLogoWave className="h-7 w-7 transition-transform group-hover:scale-110" />
            )}
            <div
              className={`absolute inset-0 blur-lg opacity-0 group-hover:opacity-100 transition-opacity ${
                roastMode ? "bg-red-500/50" : "bg-emerald-400/50"
              }`}
            />
          </div>
          <span
            className={`bg-clip-text text-transparent ${
              roastMode
                ? "bg-gradient-to-r from-red-400 to-orange-400"
                : "bg-gradient-to-r from-white to-white/70"
            }`}
          >
            {roastMode ? "Git Roast" : "Git Radar"}
          </span>
        </Link>
      </SidebarHeader>

      <SidebarSeparator className="mx-4" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.isActive}
                    className={item.className}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {pathname.startsWith("/analyze/") && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Profile Analysis</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive>
                      <UserIcon className="h-4 w-4" />
                      <span className="truncate">
                        {pathname.replace("/analyze/", "").split("/")[0]}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarSeparator className="mx-4" />

      <SidebarFooter className="p-4">
        {user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-2">
              {user.user_metadata?.avatar_url && (
                <img
                  src={user.user_metadata.avatar_url}
                  alt={user.user_metadata?.user_name || "User"}
                  className="h-8 w-8 rounded-full border border-white/10"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user.user_metadata?.user_name || user.email}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
            </div>
            <form action={signOut}>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground hover:text-white"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
            </form>
          </div>
        ) : (
          <form action={signInWithGitHub}>
            <Button className="w-full bg-white text-black hover:bg-white/90 font-medium">
              <GithubIcon className="mr-2 h-4 w-4" />
              Sign in with GitHub
            </Button>
          </form>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
