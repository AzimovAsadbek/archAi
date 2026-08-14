import { type EstimateLine } from '@archai/shared';
import { COLORS, CONTENT_WIDTH, FONTS, PAGE, TYPE } from '../theme';
import { formatAmount, formatNumber, sanitize } from '../format';
import {
  type Column,
  type Doc,
  gap,
  panel,
  rule,
  sectionTitle,
  subsectionTitle,
  tableHeader,
  tableRow,
} from '../layout';
import { fill, type PdfStrings } from '../../pdf-strings';
import { type PdfReport } from '../report';

const COLUMNS: Column[] = [
  { x: 0, width: CONTENT_WIDTH * 0.6 },
  { x: CONTENT_WIDTH * 0.6, width: CONTENT_WIDTH * 0.4, align: 'right' },
];

/** The informational labor row is printed muted — it is not part of the total. */
function isInformational(line: EstimateLine): boolean {
  return line.key === 'labor-info';
}

/**
 * Headline total, the breakdown that adds up to it, and the disclaimer that has
 * to travel with every price this product prints (docs/estimate.md).
 */
export function renderEstimate(doc: Doc, report: PdfReport, strings: PdfStrings): void {
  const { estimate } = report;
  const level = strings.finishLevel[estimate.finishLevel];

  sectionTitle(doc, strings.estimateTitle);

  const box = panel(doc, 74);
  doc
    .font(FONTS.regular)
    .fontSize(TYPE.small)
    .fillColor(COLORS.accentStrong)
    .text(sanitize(strings.estimateTotal), box.x + 18, box.y + 14, {
      width: box.width - 36,
      lineBreak: false,
    });
  doc
    .font(FONTS.bold)
    .fontSize(TYPE.amount)
    .fillColor(COLORS.ink)
    .text(`${formatAmount(estimate.total)} ${sanitize(strings.currency)}`, box.x + 18, box.y + 28, {
      width: box.width - 36,
      lineBreak: false,
    });
  doc
    .font(FONTS.regular)
    .fontSize(TYPE.small)
    .fillColor(COLORS.inkSoft)
    .text(
      `${sanitize(strings.estimateRange)}: ${formatAmount(estimate.rangeMin)} — ${formatAmount(
        estimate.rangeMax,
      )} ${sanitize(strings.currency)}`,
      box.x + 18,
      box.y + 54,
      { width: box.width - 36, lineBreak: false },
    );
  doc.y = box.y + box.height;
  gap(doc, 14);

  tableRow(
    doc,
    COLUMNS,
    [
      `${sanitize(strings.estimateCostPerM2)}: ${formatAmount(estimate.costPerM2)} ${sanitize(
        strings.currency,
      )}/${strings.unitM2}`,
      `${sanitize(strings.estimateGrossArea)}: ${formatNumber(estimate.grossFloorAreaM2, 2)} ${
        strings.unitM2
      }`,
    ],
    { color: COLORS.inkSoft, size: TYPE.small },
  );
  gap(doc, 10);

  subsectionTitle(doc, strings.estimateBreakdown);
  tableHeader(doc, COLUMNS, [strings.estimateColumnItem, strings.estimateColumnAmount]);

  for (const line of estimate.lines) {
    const label = fill(strings.estimateLine[line.key], { level });
    tableRow(doc, COLUMNS, [label, formatAmount(line.amount)], {
      color: isInformational(line) ? COLORS.inkFaint : COLORS.ink,
    });

    if (line.key === 'features') {
      for (const feature of estimate.featureLines) {
        tableRow(
          doc,
          COLUMNS,
          [`   ${strings.features[feature.key]}`, formatAmount(feature.amount)],
          { color: COLORS.inkSoft, size: TYPE.small, height: 14 },
        );
      }
    }
  }

  gap(doc, 2);
  rule(doc, COLORS.lineStrong, 0.8);
  gap(doc, 4);
  tableRow(
    doc,
    COLUMNS,
    [strings.estimateTotalRow, `${formatAmount(estimate.total)} ${sanitize(strings.currency)}`],
    { bold: true, size: TYPE.subsection, height: 20 },
  );

  gap(doc, 4);
  doc
    .font(FONTS.regular)
    .fontSize(TYPE.tiny)
    .fillColor(COLORS.inkFaint)
    .text(sanitize(strings.estimateLaborNote), PAGE.margin, doc.y, { width: CONTENT_WIDTH });
  gap(doc, 4);
  doc.text(
    sanitize(fill(strings.estimateFootnote, { version: estimate.rulesVersion, level })),
    PAGE.margin,
    doc.y,
    { width: CONTENT_WIDTH },
  );
  gap(doc, 14);

  renderDisclaimer(doc, strings);
}

/** Preliminary-estimate warning, in a panel so it cannot be skimmed past. */
function renderDisclaimer(doc: Doc, strings: PdfStrings): void {
  const body = sanitize(strings.estimateDisclaimerBody);
  const bodyHeight = doc
    .font(FONTS.regular)
    .fontSize(TYPE.small)
    .heightOfString(body, { width: CONTENT_WIDTH - 36 });
  const box = panel(doc, bodyHeight + 44, COLORS.accentSoft, COLORS.accent);

  doc
    .font(FONTS.bold)
    .fontSize(TYPE.body)
    .fillColor(COLORS.accentStrong)
    .text(sanitize(strings.estimateDisclaimerTitle), box.x + 18, box.y + 14, {
      width: box.width - 36,
    });
  doc
    .font(FONTS.regular)
    .fontSize(TYPE.small)
    .fillColor(COLORS.ink)
    .text(body, box.x + 18, box.y + 30, { width: box.width - 36 });
  doc.y = box.y + box.height;
  gap(doc, 8);
}
