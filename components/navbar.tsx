import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfileByAuthId } from "@/lib/github";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/actions/auth";
import { CreatePostForm } from "./create-post-form";
import { Code2, Compass, Home, User, LogOut } from "lucide-react";

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user ? await getProfileByAuthId(user.id) : null;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center gap-2 font-bold">
          <Code2 className="h-5 w-5" />
          DevShowcase
        </Link>

        <nav className="flex flex-1 items-center gap-4">
          {user && (
            <>
              <Link
                href="/feed"
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Home className="h-4 w-4" />
                Feed
              </Link>
              <Link
                href="/discover"
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Compass className="h-4 w-4" />
                Discover
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user && profile ? (
            <>
              <CreatePostForm />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile.avatarUrl ?? undefined} />
                      <AvatarFallback>
                        {profile.name?.[0] ?? profile.githubUsername[0]}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{profile.name ?? profile.githubUsername}</p>
                      <p className="text-sm text-muted-foreground">
                        @{profile.githubUsername}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/profile/${profile.githubUsername}`}>
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <form action={signOut}>
                    <DropdownMenuItem asChild>
                      <button type="submit" className="w-full cursor-pointer">
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign out
                      </button>
                    </DropdownMenuItem>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button asChild>
              <Link href="/login">Sign in with GitHub</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
