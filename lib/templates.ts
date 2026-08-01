import { readFileSync } from "fs";
import { join } from "path";

export interface TemplateCard {
  id: string;
  title: string;
  palette: string[];
  width: number;
  height: number;
  durationMs: number;
  layerCount: number;
  section: string;
  sectionLabel: string;
  previewUrl?: string;
}

export function listTemplateCards(): TemplateCard[] {
  return [];
}

export function templateCount(): number {
  return 0;
}

export function listSections(): { id: string; label: string; count: number }[] {
  return [];
}