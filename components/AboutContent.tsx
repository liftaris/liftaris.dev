"use client";

import { useState } from "react";
import Image from "next/image";
import { Bike, Languages, Grid3X3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SideColumn } from "@/components/SideColumn";
import { ImageTile } from "@/components/ImageTile";
import { useChatContext } from "@/components/ChatProvider";
import { useWebHaptics } from "web-haptics/react";
import { cn } from "@/lib/utils";

interface Location {
  key: string;
  src: string;
  alt: string;
  prompt: string;
}

function MapTile({
  src,
  alt,
  className,
  onClick,
}: {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border transition-all hover:border-primary/50 hover:shadow-lg",
        className
      )}
    >
      <Image src={src} alt={alt} fill className="object-cover" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
        <p className="text-xs font-medium text-white">{alt}</p>
      </div>
    </button>
  );
}

function ZoomMapTile({
  zoomedOut,
  zoomedIn,
  alt,
  className,
  onClick,
}: {
  zoomedOut: string;
  zoomedIn: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border transition-all hover:border-primary/50",
        className
      )}
    >
      <Image
        src={zoomedOut}
        alt={alt}
        fill
        className="object-cover transition-opacity duration-300 group-hover:opacity-0"
      />
      <Image
        src={zoomedIn}
        alt={alt}
        fill
        className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1">
        <p className="text-[10px] font-medium text-white">{alt}</p>
      </div>
    </button>
  );
}

function HobbyTile({
  icon,
  label,
  prompt,
}: {
  icon: React.ReactNode;
  label: string;
  prompt: string;
}) {
  const { sendMessage } = useChatContext();
  const haptic = useWebHaptics();

  return (
    <button
      onClick={() => {
        haptic.trigger("medium");
        sendMessage({ text: prompt });
      }}
      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-border px-3 transition-all hover:border-primary/50 hover:bg-primary/5"
    >
      {icon}
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}

interface AboutContentProps {
  mapUrls: {
    brasil: string;
    bayArea: string;
    seattle: string;
    mexico: string;
    india: string;
    france: string;
    mexicoZoomed: string;
    indiaZoomed: string;
    franceZoomed: string;
  };
}

const MAIN_LOCATIONS: { key: string; alt: string; prompt: string }[] = [
  { key: "brasil", alt: "Pirangi do Norte, Brasil", prompt: "Tell me about Kaio's time in Brazil" },
  { key: "bayArea", alt: "Bay Area, California", prompt: "Tell me about Kaio's time in the Bay Area" },
  { key: "seattle", alt: "Seattle, Washington", prompt: "Tell me about Kaio's time in Seattle" },
];

const MINOR_LOCATIONS: { key: string; zoomedKey: string; alt: string; prompt: string }[] = [
  { key: "mexico", zoomedKey: "mexicoZoomed", alt: "Mexico City", prompt: "Tell me about Kaio's time in Mexico City" },
  { key: "india", zoomedKey: "indiaZoomed", alt: "Auroville, India", prompt: "Tell me about Kaio's time in Auroville" },
  { key: "france", zoomedKey: "franceZoomed", alt: "Bordeaux, France", prompt: "Tell me about Kaio's time in Bordeaux" },
];

export function AboutContent({ mapUrls }: AboutContentProps) {
  const [heroIdx, setHeroIdx] = useState(0);
  const { sendMessage } = useChatContext();
  const haptic = useWebHaptics();

  const hero = MAIN_LOCATIONS[heroIdx];
  const thumbs = MAIN_LOCATIONS.filter((_, i) => i !== heroIdx);

  function selectLocation(loc: { key: string; prompt: string }) {
    const idx = MAIN_LOCATIONS.findIndex((l) => l.key === loc.key);
    if (idx !== -1) setHeroIdx(idx);
    haptic.trigger("medium");
    sendMessage({ text: loc.prompt });
  }

  return (
    <>
      <SideColumn side="left">
        {/* Bio */}
        <Card className="p-4">
          <p className="text-sm text-foreground">
            Software engineer at Moderna. Born in the Bay Area, raised in Natal,
            Brazil. I like building things that are fun to use.
          </p>
        </Card>

        {/* Hero map — shows selected main location */}
        <MapTile
          src={mapUrls[hero.key as keyof typeof mapUrls]}
          alt={hero.alt}
          className="min-h-0 flex-1"
          onClick={() => {
            haptic.trigger("medium");
            sendMessage({ text: hero.prompt });
          }}
        />

        {/* 2 thumbnail maps — the other main locations */}
        <div className="flex gap-3">
          {thumbs.map((loc) => (
            <MapTile
              key={loc.key}
              src={mapUrls[loc.key as keyof typeof mapUrls]}
              alt={loc.alt}
              className="aspect-square flex-1"
              onClick={() => selectLocation(loc)}
            />
          ))}
        </div>
      </SideColumn>

      <SideColumn side="right">
        {/* Hobby icons + minor maps in a row */}
        <div className="flex min-h-0 flex-1 gap-3">
          {/* 3 hobby icon tiles — vertical stack */}
          <div className="flex flex-col gap-3">
            <HobbyTile
              icon={<Grid3X3 className="size-5 text-primary" />}
              label="Pixel Art"
              prompt="Tell me about Kaio's pixel art"
            />
            <HobbyTile
              icon={<Bike className="size-5 text-primary" />}
              label="Cycling"
              prompt="Tell me about Kaio's long-distance bike rides"
            />
            <HobbyTile
              icon={<Languages className="size-5 text-primary" />}
              label="Languages"
              prompt="What languages does Kaio speak?"
            />
          </div>

          {/* Minor locations — slim vertical stack, small tiles with zoom on hover */}
          <div className="flex flex-col gap-2">
            {MINOR_LOCATIONS.map((loc) => (
              <ZoomMapTile
                key={loc.key}
                zoomedOut={mapUrls[loc.zoomedKey as keyof typeof mapUrls]}
                zoomedIn={mapUrls[loc.key as keyof typeof mapUrls]}
                alt={loc.alt}
                className="size-[80px]"
                onClick={() => {
                  haptic.trigger("medium");
                  sendMessage({ text: loc.prompt });
                }}
              />
            ))}
          </div>
        </div>
      </SideColumn>
    </>
  );
}
