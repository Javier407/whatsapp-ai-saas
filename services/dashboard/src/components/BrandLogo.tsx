import { cn } from "@/lib/utils";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
};

const sizes = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" };

export function BrandLogo({ size = "md", showName = true, className }: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <img src="/logo.svg" alt="" className={cn("shrink-0 rounded-lg", sizes[size])} />
      {showName && (
        <span className="font-semibold text-sm truncate">WA AI SaaS</span>
      )}
    </div>
  );
}
