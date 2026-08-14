import { COLORS, CONTENT_WIDTH, FONTS, PAGE, TYPE } from '../theme';
import { formatDate, sanitize, shortId } from '../format';
import { type Doc, gap, right, rule } from '../layout';
import { type PdfStrings } from '../../pdf-strings';
import { type PdfReport } from '../report';

/** Terracotta pill carrying the project status. */
function statusPill(doc: Doc, label: string, x: number, y: number): number {
  const text = sanitize(label);
  const width = doc.font(FONTS.bold).fontSize(TYPE.small).widthOfString(text) + 20;
  const height = 18;
  doc.roundedRect(x, y, width, height, 9).fillColor(COLORS.accentSoft).fill();
  doc
    .fillColor(COLORS.accentStrong)
    .text(text, x, y + 5, { width, align: 'center', lineBreak: false });
  return width;
}

/**
 * Page-one header: the wordmark, what the document is, and who and what it is
 * about. Everything here is derived from the project, so two exports of an
 * unchanged project are identical down to the byte.
 */
export function renderCover(doc: Doc, report: PdfReport, strings: PdfStrings): void {
  const { project, ownerName } = report;

  doc.font(FONTS.bold).fontSize(TYPE.wordmark).fillColor(COLORS.ink);
  const wordmarkY = doc.y;
  doc.text('arch', PAGE.margin, wordmarkY, { continued: true });
  doc.fillColor(COLORS.accent).text('Ai', { continued: false });

  doc
    .font(FONTS.regular)
    .fontSize(TYPE.small)
    .fillColor(COLORS.inkFaint)
    .text(sanitize(strings.reportTitle), PAGE.margin, wordmarkY + 9, {
      width: CONTENT_WIDTH,
      align: 'right',
      lineBreak: false,
    });

  doc.y = wordmarkY + 30;
  rule(doc, COLORS.ink, 1.2);
  gap(doc, 22);

  doc
    .font(FONTS.bold)
    .fontSize(TYPE.title)
    .fillColor(COLORS.ink)
    .text(sanitize(project.name), PAGE.margin, doc.y, { width: CONTENT_WIDTH });
  gap(doc, 4);

  doc
    .font(FONTS.regular)
    .fontSize(TYPE.subtitle)
    .fillColor(COLORS.inkSoft)
    .text(sanitize(strings.reportSubtitle), PAGE.margin, doc.y, { width: CONTENT_WIDTH });
  gap(doc, 14);

  const pillY = doc.y;
  const pillWidth = statusPill(doc, strings.status[project.status], PAGE.margin, pillY);
  doc
    .font(FONTS.regular)
    .fontSize(TYPE.small)
    .fillColor(COLORS.inkFaint)
    .text(
      `${sanitize(strings.projectId)}: ${shortId(project.id)}`,
      PAGE.margin + pillWidth + 12,
      pillY + 5,
      { width: CONTENT_WIDTH - pillWidth - 12, lineBreak: false },
    );
  doc.y = pillY + 18;
  gap(doc, 18);

  const columnWidth = (CONTENT_WIDTH - 24) / 2;
  const metaY = doc.y;
  metaCell(doc, strings.owner, ownerName, PAGE.margin, metaY, columnWidth);
  metaCell(
    doc,
    strings.documentDate,
    formatDate(project.updatedAt),
    right() - columnWidth,
    metaY,
    columnWidth,
  );
  doc.y = metaY + 34;

  doc
    .font(FONTS.regular)
    .fontSize(TYPE.tiny)
    .fillColor(COLORS.inkFaint)
    .text(sanitize(strings.documentDateNote), PAGE.margin, doc.y, { width: CONTENT_WIDTH });
  gap(doc, 6);

  if (project.description !== null && project.description.trim().length > 0) {
    gap(doc, 6);
    doc
      .font(FONTS.regular)
      .fontSize(TYPE.body)
      .fillColor(COLORS.inkSoft)
      .text(sanitize(project.description.trim()), PAGE.margin, doc.y, { width: CONTENT_WIDTH });
  }
  gap(doc, 18);
}

function metaCell(
  doc: Doc,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
): void {
  doc
    .font(FONTS.regular)
    .fontSize(TYPE.tiny)
    .fillColor(COLORS.inkFaint)
    .text(sanitize(label.toUpperCase()), x, y, {
      width,
      lineBreak: false,
      characterSpacing: 0.5,
    });
  doc
    .font(FONTS.bold)
    .fontSize(TYPE.body)
    .fillColor(COLORS.ink)
    .text(sanitize(value), x, y + 12, { width, lineBreak: false, ellipsis: true });
}
