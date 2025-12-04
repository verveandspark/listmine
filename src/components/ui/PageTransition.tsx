import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className = "" }: PageTransitionProps) {
  return (
    <div 
      className={`animate-in fade-in duration-200 ${className}`}
    >
      {children}
    </div>
  );
}
