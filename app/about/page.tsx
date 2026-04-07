import { SideColumn } from "@/components/SideColumn";
import { ImageTile } from "@/components/ImageTile";
import { Card } from "@/components/ui/card";
import { EmptyTile } from "@/components/EmptyTile";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | KAIO",
};

const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY!;
const SEATTLE_MAP = `https://maps.googleapis.com/maps/api/staticmap?center=47.6062,-122.3353&zoom=13&size=600x400&scale=2&maptype=satellite&key=${MAPS_KEY}`;

const INTERESTS = [
  "Web Development",
  "AI Engineering",
  "Interactive Media",
  "Graphics Programming",
  "Game Development Tools",
];

export default function AboutPage() {
  return (
    <>
      <SideColumn side="left">
        {/* Profile Picture */}
        <ImageTile
          src="/profile.png"
          alt="Kaio profile picture"
          className="aspect-square"
        />

        <div className="text-center">Living in Seattle, WA</div>

        {/* Seattle Map */}
        <ImageTile
          src={SEATTLE_MAP}
          alt="Seattle, Washington"
          className="aspect-video"
        />
      </SideColumn>

      <SideColumn side="right">
        {/* Interests */}
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">Interests</h3>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((interest) => (
              <Badge
                key={interest}
                variant="accent"
                className="text-xs rounded-full px-3"
              >
                {interest}
              </Badge>
            ))}
          </div>
        </Card>

        {/* Bio */}
        <Card className="p-6">
          <p className="text-sm text-foreground leading-relaxed">
            Working at Moderna on the Marketing Technology team building global
            web experiences and infrastructure.
            <br />
            <br /> Creator of bazaarghost.stream.
            <br />
            <br />
            Learning how to make something AI (Actually Interesting)
          </p>
        </Card>
      </SideColumn>
    </>
  );
}
