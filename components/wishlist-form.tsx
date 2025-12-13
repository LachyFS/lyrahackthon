"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { createWishlist, type CreateWishlistInput, type WishlistType, type WorkStyle, type CompanySize, type Availability } from "@/lib/actions/wishlist";
import { Plus, X, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const WISHLIST_TYPES: { value: WishlistType; label: string; emoji: string }[] = [
  { value: "job", label: "Full-time Job", emoji: "💼" },
  { value: "freelance", label: "Freelance Work", emoji: "🎯" },
  { value: "collaboration", label: "Side Project Collab", emoji: "🤝" },
  { value: "cofounding", label: "Co-founder", emoji: "🚀" },
  { value: "mentorship", label: "Mentorship", emoji: "🎓" },
];

const WORK_STYLES: { value: WorkStyle; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

const COMPANY_SIZES: { value: CompanySize; label: string }[] = [
  { value: "startup", label: "Startup (1-50)" },
  { value: "mid", label: "Mid-size (50-500)" },
  { value: "enterprise", label: "Enterprise (500+)" },
  { value: "any", label: "Any size" },
];

const AVAILABILITY_OPTIONS: { value: Availability; label: string }[] = [
  { value: "immediately", label: "Immediately" },
  { value: "2weeks", label: "2 weeks notice" },
  { value: "1month", label: "1 month" },
  { value: "3months", label: "3 months" },
  { value: "passive", label: "Just browsing" },
];

const ROLE_TYPES = [
  "Frontend",
  "Backend",
  "Full Stack",
  "DevOps",
  "Mobile",
  "ML/AI",
  "Data",
  "Security",
  "Design",
  "Product",
];

const POPULAR_TECH = [
  "TypeScript",
  "JavaScript",
  "React",
  "Next.js",
  "Node.js",
  "Python",
  "Go",
  "Rust",
  "AWS",
  "Docker",
  "Kubernetes",
  "PostgreSQL",
];

export function WishlistForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [techStack, setTechStack] = useState<string[]>([]);
  const [techInput, setTechInput] = useState("");

  const addTech = (tech: string) => {
    if (tech && !techStack.includes(tech)) {
      setTechStack([...techStack, tech]);
    }
    setTechInput("");
  };

  const removeTech = (tech: string) => {
    setTechStack(techStack.filter((t) => t !== tech));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);

    const input: CreateWishlistInput = {
      type: formData.get("type") as WishlistType,
      title: formData.get("title") as string,
      description: formData.get("description") as string || undefined,
      roleType: formData.get("roleType") as string || undefined,
      workStyle: formData.get("workStyle") as WorkStyle || undefined,
      location: formData.get("location") as string || undefined,
      salaryMin: formData.get("salaryMin") ? parseInt(formData.get("salaryMin") as string) : undefined,
      salaryMax: formData.get("salaryMax") ? parseInt(formData.get("salaryMax") as string) : undefined,
      salaryCurrency: formData.get("salaryCurrency") as string || "USD",
      techStack,
      companySize: formData.get("companySize") as CompanySize || undefined,
      availability: formData.get("availability") as Availability || undefined,
      hoursPerWeek: formData.get("hoursPerWeek") ? parseInt(formData.get("hoursPerWeek") as string) : undefined,
    };

    const result = await createWishlist(input);

    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Wishlist item created!");
      setOpen(false);
      setTechStack([]);
      router.refresh();
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Sparkles className="mr-2 h-4 w-4" />
          Add to Wishlist
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>What are you looking for?</DialogTitle>
          <DialogDescription>
            Tell companies and other developers what you&apos;re seeking.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type *</Label>
            <Select name="type" required>
              <SelectTrigger>
                <SelectValue placeholder="What are you looking for?" />
              </SelectTrigger>
              <SelectContent>
                {WISHLIST_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.emoji} {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              name="title"
              placeholder="e.g., Senior Frontend Engineer at a climate-tech startup"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Describe what you're looking for in more detail..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="roleType">Role Type</Label>
              <Select name="roleType">
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_TYPES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workStyle">Work Style</Label>
              <Select name="workStyle">
                <SelectTrigger>
                  <SelectValue placeholder="Select style" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_STYLES.map((style) => (
                    <SelectItem key={style.value} value={style.value}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location (if not fully remote)</Label>
            <Input
              id="location"
              name="location"
              placeholder="e.g., San Francisco, NYC, London"
            />
          </div>

          <div className="space-y-2">
            <Label>Salary Range (Annual)</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                name="salaryMin"
                type="number"
                placeholder="Min"
                min={0}
              />
              <Input
                name="salaryMax"
                type="number"
                placeholder="Max"
                min={0}
              />
              <Select name="salaryCurrency" defaultValue="USD">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="AUD">AUD</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tech Stack</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {techStack.map((tech) => (
                <Badge key={tech} variant="secondary" className="gap-1">
                  {tech}
                  <button type="button" onClick={() => removeTech(tech)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={techInput}
                onChange={(e) => setTechInput(e.target.value)}
                placeholder="Add technology..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTech(techInput);
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => addTech(techInput)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {POPULAR_TECH.filter(t => !techStack.includes(t)).slice(0, 6).map((tech) => (
                <Badge
                  key={tech}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => addTech(tech)}
                >
                  + {tech}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companySize">Company Size</Label>
              <Select name="companySize">
                <SelectTrigger>
                  <SelectValue placeholder="Any size" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_SIZES.map((size) => (
                    <SelectItem key={size.value} value={size.value}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="availability">Availability</Label>
              <Select name="availability">
                <SelectTrigger>
                  <SelectValue placeholder="When can you start?" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABILITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Wishlist Item"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
