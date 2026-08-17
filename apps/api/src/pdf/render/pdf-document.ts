import PDFDocument from 'pdfkit';
import { fontPaths } from '../pdf-assets';
import { fill, stringsFor } from '../pdf-strings';
import { formatDate, sanitize } from './format';
import { type Doc } from './layout';
import { type PdfReport } from './report';
import { renderCover } from './sections/cover.section';
import { renderEstimate } from './sections/estimate.section';
import { renderFloorPlans } from './sections/floor-plans.section';
import { renderSitePlan } from './sections/site-plan.section';
import { renderSummary } from './sections/summary.section';
import { COLORS, CONTENT_WIDTH, FONTS, PAGE, TYPE } from './theme';

/**
 * Metadata is derived entirely from the project, never from the clock: pdfkit
 * seeds the file id from `info` (including `CreationDate`), so pinning both
 * dates to `updatedAt` is what makes two exports of an unchanged project
 * byte-identical (docs/pdf-export.md §Tests).
 */
function documentInfo(report: PdfReport): PDFKit.DocumentInfo {
  const strings = stringsFor(report.locale);
  return {
    Title: `${sanitize(report.project.name)} — ${sanitize(strings.reportTitle)}`,
    Author: 'archAi',
    Subject: sanitize(strings.reportSubtitle),
    Creator: 'archAi',
    Producer: 'archAi',
    CreationDate: report.project.updatedAt,
    ModDate: report.project.updatedAt,
  };
}

/** archAi · document date · disclaimer, with the page number on the right. */
function renderFooters(doc: Doc, report: PdfReport): void {
  const strings = stringsFor(report.locale);
  const { start, count } = doc.bufferedPageRange();
  const label = sanitize(
    `archAi · ${formatDate(report.project.updatedAt)} · ${strings.footerDisclaimer}`,
  );

  for (let index = 0; index < count; index++) {
    const page = doc.switchToPage(start + index);
    // The footer sits below the text margin on purpose; without this pdfkit
    // treats it as an overflow and appends a blank page per line written.
    const bottomMargin = page.margins.bottom;
    page.margins.bottom = 0;
    const y = PAGE.height - PAGE.footerOffset;

    doc
      .moveTo(PAGE.margin, y - 8)
      .lineTo(PAGE.margin + CONTENT_WIDTH, y - 8)
      .lineWidth(0.5)
      .strokeColor(COLORS.line)
      .stroke();

    doc
      .font(FONTS.regular)
      .fontSize(TYPE.tiny)
      .fillColor(COLORS.inkFaint)
      .text(label, PAGE.margin, y, { width: CONTENT_WIDTH * 0.75, lineBreak: false });

    doc.text(
      fill(strings.page, { page: index + 1, total: count }),
      PAGE.margin + CONTENT_WIDTH * 0.75,
      y,
      { width: CONTENT_WIDTH * 0.25, align: 'right', lineBreak: false },
    );

    page.margins.bottom = bottomMargin;
  }
}

/**
 * Lays the report out and resolves with the finished file. Pure with respect to
 * its input: the same `PdfReport` always produces the same bytes.
 */
export function renderProjectPdf(report: PdfReport): Promise<Buffer> {
  const fonts = fontPaths();
  const doc: Doc = new PDFDocument({
    size: PAGE.size,
    margins: {
      top: PAGE.margin,
      bottom: PAGE.margin,
      left: PAGE.margin,
      right: PAGE.margin,
    },
    bufferPages: true,
    autoFirstPage: true,
    info: documentInfo(report),
  });

  doc.registerFont(FONTS.regular, fonts.regular);
  doc.registerFont(FONTS.bold, fonts.bold);
  doc.font(FONTS.regular);

  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const strings = stringsFor(report.locale);
  renderCover(doc, report, strings);
  renderSummary(doc, report, strings);
  // The property first, then the building on it — the order a reader walks a site.
  renderSitePlan(doc, report, strings);
  renderFloorPlans(doc, report, strings);
  doc.addPage();
  renderEstimate(doc, report, strings);

  renderFooters(doc, report);
  doc.end();

  return finished;
}
