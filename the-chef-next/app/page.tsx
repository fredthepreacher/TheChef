import type { Metadata } from "next";
import SplitStage from "@/components/SplitStage";

export const metadata: Metadata = {
  title: "The Chef | Luxury Catering & Music — One Name, Two Crafts",
  description:
    "Drag to explore two worlds: The Chef Catering — private chef, luxury event catering, weddings and celebrations — and The Chef Music — original sound, live shows, and bold artistry.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <SplitStage />;
}
