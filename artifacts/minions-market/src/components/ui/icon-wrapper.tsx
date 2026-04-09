import { ReactNode } from "react";

interface IconWrapperProps {
  children: ReactNode;
  className?: string;
  active?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

export function IconWrapper({ children, className = "", active = false, size = "lg" }: IconWrapperProps) {
  const sizeClasses = {
    xs: "w-3 h-3",
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
    xl: "w-10 h-10",
  };

  return (
    <div
      className={`relative flex items-center justify-center ${sizeClasses[size]} rounded-lg transition-all duration-200 ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-primary/10 hover:text-primary hover:backdrop-blur-sm"
      } ${className}`}
    >
      {children}
    </div>
  );
}