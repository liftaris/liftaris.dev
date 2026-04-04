import { AboutContent } from "@/components/AboutContent";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | KAIO",
};

const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY!;

function mapUrl(lat: number, lng: number, zoom: number) {
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=600x400&scale=2&maptype=satellite&key=${MAPS_KEY}`;
}

function mapUrlSquare(lat: number, lng: number, zoom: number) {
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=400x400&scale=2&maptype=satellite&key=${MAPS_KEY}`;
}

const mapUrls = {
  brasil: mapUrl(-5.9793, -35.1238, 14),
  bayArea: mapUrl(37.9735, -122.5311, 12),
  seattle: mapUrl(47.6062, -122.3353, 13),
  // Minor locations — city level
  mexico: mapUrlSquare(19.4326, -99.1332, 12),
  india: mapUrlSquare(12.0073, 79.8103, 13),
  france: mapUrlSquare(44.8378, -0.5792, 12),
  // Minor locations — country level (zoomed out, shown by default)
  mexicoZoomed: mapUrlSquare(23.6345, -102.5528, 4),
  indiaZoomed: mapUrlSquare(20.5937, 78.9629, 4),
  franceZoomed: mapUrlSquare(46.6034, 1.8883, 4),
};

export default function AboutPage() {
  return <AboutContent mapUrls={mapUrls} />;
}
