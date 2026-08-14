import { type RoomType } from '@archai/shared';

/**
 * Print translation of the product palette (`apps/web/src/app/globals.css`) and
 * of the plan colours (`apps/web/src/components/floor-plan/plan-palette.ts`), so
 * an exported page and the workspace tab read as the same document.
 */
export const COLORS = {
  paper: '#f7f6f2',
  surface: '#ffffff',
  ink: '#191a1e',
  inkSoft: '#55575e',
  inkFaint: '#8a8d95',
  line: '#e4e2db',
  lineStrong: '#cfccc2',
  accent: '#c2571e',
  accentStrong: '#a64312',
  accentSoft: '#fbeee6',
  /** Plan-specific tones. */
  planSlab: '#ffffff',
  planGround: '#f7f6f2',
  planCorridor: '#f1f0ea',
  planStair: '#eae7e0',
} as const;

/** Soft per-type washes, matching the 2D tab. */
export const ROOM_TINTS: Record<RoomType, string> = {
  LIVING_ROOM: '#f8e7db',
  BEDROOM: '#e8eef8',
  KITCHEN: '#faf1dd',
  DINING_ROOM: '#eef3e1',
  OFFICE: '#ebe9f6',
  BATHROOM: '#e1eff2',
  LAUNDRY: '#e6f1ea',
  STORAGE: '#f0ece4',
  HALLWAY: '#f1f0ea',
  OTHER: '#f1f0ea',
};

/** Registered pdfkit font names. */
export const FONTS = { regular: 'body', bold: 'body-bold' } as const;

/** Type scale in points. */
export const TYPE = {
  wordmark: 22,
  title: 26,
  subtitle: 12.5,
  section: 15,
  subsection: 11,
  body: 10,
  small: 9,
  tiny: 7.8,
  amount: 20,
  planLabel: 7.4,
  planArea: 6.4,
  planDimension: 7,
} as const;

/** A4 in points, and the page frame everything is laid out inside. */
export const PAGE = {
  size: 'A4',
  width: 595.28,
  height: 841.89,
  margin: 48,
  /** Distance from the page bottom to the footer baseline. */
  footerOffset: 30,
  /** Content stops here so the footer never collides with a section. */
  bottomGutter: 56,
} as const;

export const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
export const CONTENT_BOTTOM = PAGE.height - PAGE.bottomGutter;
