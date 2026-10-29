import { WORLD_COUNTRIES, WORLD_VIEWBOX } from "../world.data";

/** Major cities the planner names most often (lat, lng). Used only by coercion when coordinates are missing. */
const CITIES: Record<string, [number, number]> = {
  "new york": [40.71, -74.01], london: [51.51, -0.13], paris: [48.86, 2.35], tokyo: [35.68, 139.69], beijing: [39.9, 116.4],
  shanghai: [31.23, 121.47], "hong kong": [22.32, 114.17], singapore: [1.35, 103.82], dubai: [25.2, 55.27], mumbai: [19.08, 72.88],
  delhi: [28.61, 77.21], "new delhi": [28.61, 77.21], seoul: [37.57, 126.98], sydney: [-33.87, 151.21], melbourne: [-37.81, 144.96],
  "los angeles": [34.05, -118.24], "san francisco": [37.77, -122.42], chicago: [41.88, -87.63], washington: [38.9, -77.04],
  toronto: [43.65, -79.38], "mexico city": [19.43, -99.13], "sao paulo": [-23.55, -46.63], "são paulo": [-23.55, -46.63],
  "rio de janeiro": [-22.91, -43.17], "buenos aires": [-34.6, -58.38], moscow: [55.76, 37.62], berlin: [52.52, 13.4],
  rome: [41.9, 12.5], madrid: [40.42, -3.7], istanbul: [41.01, 28.98], cairo: [30.04, 31.24], lagos: [6.52, 3.38],
  nairobi: [-1.29, 36.82], johannesburg: [-26.2, 28.05], "cape town": [-33.92, 18.42], bangkok: [13.76, 100.5], jakarta: [-6.21, 106.85],
  manila: [14.6, 120.98], "kuala lumpur": [3.14, 101.69], riyadh: [24.71, 46.68], tehran: [35.69, 51.39], karachi: [24.86, 67.0],
  amsterdam: [52.37, 4.9], zurich: [47.38, 8.54], stockholm: [59.33, 18.07], oslo: [59.91, 10.75], reykjavik: [64.15, -21.94],
  "silicon valley": [37.39, -122.08], "wall street": [40.71, -74.01], "north pole": [90, 0], "south pole": [-90, 0], antarctica: [-82, 0],
  "mount everest": [27.99, 86.93], everest: [27.99, 86.93], jeju: [33.51, 126.49], taipei: [25.03, 121.57], hanoi: [21.03, 105.85],
};

const COUNTRY_ALIAS: Record<string, string> = {
  usa: "United States of America", us: "United States of America", "united states": "United States of America", america: "United States of America",
  uk: "United Kingdom", britain: "United Kingdom", england: "United Kingdom", uae: "United Arab Emirates", korea: "South Korea",
  holland: "Netherlands", "the netherlands": "Netherlands", russia: "Russia", "czech republic": "Czechia",
};

/** Resolve a place name (city or country) to coordinates; null when unknown. */
export function placeCoords(name: string): { lat: number; lng: number } | null {
  const key = name.trim().toLowerCase().replace(/[.,]$/, "");
  const city = CITIES[key] ?? CITIES[key.split(",")[0].trim()];
  if (city) return { lat: city[0], lng: city[1] };
  const target = (COUNTRY_ALIAS[key] ?? key).toLowerCase();
  const c = WORLD_COUNTRIES.find((x) => x.name.toLowerCase() === target);
  if (!c) return null;
  const { w, h, north, south } = WORLD_VIEWBOX;
  return { lat: Math.round((north - (c.c[1] / h) * (north - south)) * 100) / 100, lng: Math.round(((c.c[0] / w) * 360 - 180) * 100) / 100 };
}
