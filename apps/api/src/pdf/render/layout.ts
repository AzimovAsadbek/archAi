import { CONTENT_BOTTOM, CONTENT_WIDTH, COLORS, FONTS, PAGE, TYPE } from './theme';
import { sanitize } from './format';

export type Doc = PDFKit.PDFDocument;

/** Horizontal band a table column occupies, in points from the page's left margin. */
export interface Column {
  /** Offset from the left margin. */
  x: number;
  width: number;
  align?: 'left' | 'right' | 'center';
}

/** Height a single row of body text needs, including its padding. */
export const ROW_HEIGHT = 16;
export const HEADER_HEIGHT = 18;

export function left(): number {
  return PAGE.margin;
}

export function right(): number {
  return PAGE.margin + CONTENT_WIDTH;
}

/** Vertical room left on the current page. */
export function remaining(doc: Doc): number {
  return CONTENT_BOTTOM - doc.y;
}

/**
 * Guarantees `needed` points of vertical room, starting a page when the current
 * one is full. Returns true when a page break happened, so a caller drawing a
 * table can repeat its header.
 */
export function ensureSpace(doc: Doc, needed: number): boolean {
  if (remaining(doc) >= needed) {
    return false;
  }
  doc.addPage();
  doc.x = PAGE.margin;
  doc.y = PAGE.margin;
  return true;
}

/** Section heading with the terracotta rule under it. */
export function sectionTitle(doc: Doc, title: string): void {
  ensureSpace(doc, 64);
  doc
    .font(FONTS.bold)
    .fontSize(TYPE.section)
    .fillColor(COLORS.ink)
    .text(sanitize(title), PAGE.margin, doc.y, { width: CONTENT_WIDTH });
  doc.y += 4;
  rule(doc, COLORS.accent, 1.4);
  doc.y += 12;
}

/** Smaller heading inside a section. */
export function subsectionTitle(doc: Doc, title: string): void {
  ensureSpace(doc, 40);
  doc
    .font(FONTS.bold)
    .fontSize(TYPE.subsection)
    .fillColor(COLORS.inkSoft)
    .text(sanitize(title.toUpperCase()), PAGE.margin, doc.y, {
      width: CONTENT_WIDTH,
      characterSpacing: 0.6,
    });
  doc.y += 6;
}

export function rule(doc: Doc, color: string = COLORS.line, width = 0.8): void {
  doc
    .moveTo(PAGE.margin, doc.y)
    .lineTo(right(), doc.y)
    .lineWidth(width)
    .strokeColor(color)
    .stroke();
  doc.y += width;
}

export function paragraph(
  doc: Doc,
  text: string,
  size: number = TYPE.body,
  color: string = COLORS.inkSoft,
): void {
  const body = sanitize(text);
  const height = doc.font(FONTS.regular).fontSize(size).heightOfString(body, {
    width: CONTENT_WIDTH,
  });
  ensureSpace(doc, height + 6);
  doc.fillColor(color).text(body, PAGE.margin, doc.y, { width: CONTENT_WIDTH });
  doc.y += 6;
}

/** Two-column `label — value` list; the value column is right-aligned. */
export function definitionRow(doc: Doc, label: string, value: string): void {
  ensureSpace(doc, ROW_HEIGHT);
  const y = doc.y;
  const labelWidth = CONTENT_WIDTH * 0.45;
  doc
    .font(FONTS.regular)
    .fontSize(TYPE.body)
    .fillColor(COLORS.inkSoft)
    .text(sanitize(label), PAGE.margin, y, { width: labelWidth, lineBreak: false });
  doc
    .font(FONTS.bold)
    .fillColor(COLORS.ink)
    .text(sanitize(value), PAGE.margin + labelWidth, y, {
      width: CONTENT_WIDTH - labelWidth,
      align: 'right',
      lineBreak: false,
    });
  doc.y = y + ROW_HEIGHT;
}

/**
 * Draws one table row of already-formatted cells. Returns true when the row
 * started a new page, so the caller can repeat the column header there.
 */
export function tableRow(
  doc: Doc,
  columns: Column[],
  cells: string[],
  options: { bold?: boolean; color?: string; size?: number; height?: number } = {},
): boolean {
  const size = options.size ?? TYPE.body;
  const height = options.height ?? ROW_HEIGHT;
  const broke = ensureSpace(doc, height);
  const y = doc.y;
  doc
    .font(options.bold === true ? FONTS.bold : FONTS.regular)
    .fontSize(size)
    .fillColor(options.color ?? COLORS.ink);
  columns.forEach((column, index) => {
    const cell = cells[index];
    if (cell === undefined) {
      return;
    }
    doc.text(sanitize(cell), PAGE.margin + column.x, y, {
      width: column.width,
      align: column.align ?? 'left',
      lineBreak: false,
      ellipsis: true,
    });
  });
  doc.y = y + height;
  return broke;
}

/** Column header band: small caps over a hairline. */
export function tableHeader(doc: Doc, columns: Column[], labels: string[]): void {
  ensureSpace(doc, HEADER_HEIGHT + ROW_HEIGHT);
  const y = doc.y;
  doc.font(FONTS.bold).fontSize(TYPE.tiny).fillColor(COLORS.inkFaint);
  columns.forEach((column, index) => {
    const label = labels[index];
    if (label === undefined) {
      return;
    }
    doc.text(sanitize(label.toUpperCase()), PAGE.margin + column.x, y, {
      width: column.width,
      align: column.align ?? 'left',
      lineBreak: false,
      characterSpacing: 0.5,
    });
  });
  doc.y = y + HEADER_HEIGHT - 5;
  rule(doc, COLORS.lineStrong, 0.8);
  doc.y += 4;
}

/** Soft panel used for callouts (disclaimer, headline amount). */
export function panel(
  doc: Doc,
  height: number,
  fill: string = COLORS.accentSoft,
  stroke: string | null = null,
): { x: number; y: number; width: number; height: number } {
  ensureSpace(doc, height + 8);
  const box = { x: PAGE.margin, y: doc.y, width: CONTENT_WIDTH, height };
  doc.roundedRect(box.x, box.y, box.width, box.height, 8).fillColor(fill).fill();
  if (stroke !== null) {
    doc
      .roundedRect(box.x, box.y, box.width, box.height, 8)
      .lineWidth(0.8)
      .strokeColor(stroke)
      .stroke();
  }
  return box;
}

/** Vertical breathing room between blocks. */
export function gap(doc: Doc, points: number): void {
  doc.y += points;
}
