"use client";

import { cn } from "@/lib/utils";

interface FlowingLinesProps {
  className?: string;
}

export function FlowingLines({ className }: FlowingLinesProps) {
  return (
    <svg
      className={cn("absolute inset-0 h-full w-full", className)}
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {/* Flowing curved dotted lines - inspired by the topographic/wave pattern */}
      <g stroke="url(#lineGradient)" fill="none" strokeWidth="1">
        {/* Wave lines */}
        <path
          d="M0 60 Q 100 40, 200 60 T 400 60"
          strokeDasharray="4 8"
          opacity="0.4"
        />
        <path
          d="M0 90 Q 100 70, 200 90 T 400 90"
          strokeDasharray="4 8"
          opacity="0.5"
        />
        <path
          d="M0 120 Q 100 100, 200 120 T 400 120"
          strokeDasharray="4 8"
          opacity="0.6"
        />
        <path
          d="M0 150 Q 100 130, 200 150 T 400 150"
          strokeDasharray="4 8"
          opacity="0.7"
        />
        <path
          d="M0 180 Q 100 160, 200 180 T 400 180"
          strokeDasharray="4 8"
          opacity="0.6"
        />
        <path
          d="M0 210 Q 100 190, 200 210 T 400 210"
          strokeDasharray="4 8"
          opacity="0.5"
        />
        <path
          d="M0 240 Q 100 220, 200 240 T 400 240"
          strokeDasharray="4 8"
          opacity="0.4"
        />
      </g>
    </svg>
  );
}

export function TopographicPattern({ className }: FlowingLinesProps) {
  return (
    <svg
      className={cn("absolute inset-0 h-full w-full", className)}
      viewBox="0 0 500 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="topoGradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      
      {/* Concentric flowing shapes like the Cohere banner */}
      <g stroke="url(#topoGradient)" fill="none" strokeWidth="1" strokeDasharray="3 6">
        <ellipse cx="400" cy="300" rx="50" ry="30" opacity="0.8" />
        <ellipse cx="400" cy="300" rx="80" ry="50" opacity="0.7" />
        <ellipse cx="400" cy="300" rx="120" ry="75" opacity="0.6" />
        <ellipse cx="400" cy="300" rx="170" ry="105" opacity="0.5" />
        <ellipse cx="400" cy="300" rx="230" ry="140" opacity="0.4" />
        <ellipse cx="400" cy="300" rx="300" ry="180" opacity="0.3" />
        <ellipse cx="400" cy="300" rx="380" ry="225" opacity="0.2" />
        <ellipse cx="400" cy="300" rx="470" ry="275" opacity="0.1" />
      </g>
    </svg>
  );
}

export function RadialBurst({ className }: FlowingLinesProps) {
  const lines = 16;
  
  return (
    <svg
      className={cn("absolute", className)}
      viewBox="0 0 200 100"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <g stroke="var(--primary)" strokeWidth="1" opacity="0.3">
        {Array.from({ length: lines }).map((_, i) => {
          const angle = (i / lines) * Math.PI;
          const x2 = 100 + Math.cos(angle) * 150;
          const y2 = 100 - Math.sin(angle) * 100;
          return (
            <line
              key={i}
              x1="100"
              y1="100"
              x2={x2}
              y2={y2}
            />
          );
        })}
      </g>
    </svg>
  );
}
