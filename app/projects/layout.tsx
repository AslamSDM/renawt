import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects",
  description: "Manage your AI-generated video projects. View, edit, and export your product demos and marketing videos.",
  robots: { index: false },
};

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
