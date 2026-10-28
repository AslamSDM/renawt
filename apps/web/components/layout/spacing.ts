/**
 * The 4px spacing scale (DESIGN.md §3). Primitives accept these step names
 * only; the map below is the single place step → Tailwind class lives.
 *
 * step  px   tailwind
 *  0     0   0
 *  1     4   1
 *  2     8   2
 *  3    12   3
 *  4    16   4
 *  5    20   5
 *  6    24   6
 *  7    32   8
 *  8    40   10
 *  9    48   12
 * 10    64   16
 * 11    80   20
 * 12   128   32
 */
export type Space = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const GAP: Record<Space, string> = {
  0: "gap-0",
  1: "gap-1",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  5: "gap-5",
  6: "gap-6",
  7: "gap-8",
  8: "gap-10",
  9: "gap-12",
  10: "gap-16",
  11: "gap-20",
  12: "gap-32",
};

export const SPACE_PX: Record<Space, number> = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 48, 10: 64, 11: 80, 12: 128 };
