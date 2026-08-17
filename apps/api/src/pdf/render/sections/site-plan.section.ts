import { layoutSite, type Rect, type SiteElementKind, type SiteLayout } from '@archai/floor-plan-engine';
import { COLORS, CONTENT_WIDTH, FONTS, PAGE, TYPE } from '../theme';
import { formatNumber, sanitize } from '../format';
import { type Doc, gap, sectionTitle } from '../layout';
import { fill, type PdfStrings } from '../../pdf-strings';
import { type PdfReport } from '../report';

/**
 * The site plan page: the property, not just the building.
 *
 * Geometry comes from `layoutSite` — the same call the 2D viewer and the 3D
 * preview make — so the exported document cannot disagree with what the user
 * was looking at on screen about where the garage is.
 *
 * Drawn in the report's own language: the house is solid ink, everything around
 * it is a pale wash with a hairline, and the plot boundary is the surveyor's
 * dash-dot. A north/street mark gives the drawing an orientation.
 */

const DRAWING_HEIGHT = 400;
/** Blank border inside the drawing box for the street mark and dimensions. */
const PADDING = 34;

interface Transform {
  scale: number;
  originX: number;
  originY: number;
}

const toX = (t: Transform, m: number): number => t.originX + m * t.scale;
const toY = (t: Transform, m: number): number => t.originY + m * t.scale;
const toLen = (t: Transform, m: number): number => m * t.scale;

/** Pale washes, matching the on-screen site plan without becoming a rendering. */
const FILLS: Record<SiteElementKind, string> = {
  GARAGE: COLORS.planSlab,
  DRIVEWAY: '#e6e4dd',
  PATH: '#efeee8',
  TERRACE: '#f2e3d8',
  POOL: '#dcebf1',
  BALCONY: '#f0efe9',
};

/** Draw order: paving first, so a terrace edge sits over the ground beneath it. */
const ORDER: SiteElementKind[] = ['DRIVEWAY', 'PATH', 'POOL', 'TERRACE', 'BALCONY', 'GARAGE'];

/** Reuses the feature names the summary page already prints. */
function elementLabel(kind: SiteElementKind, strings: PdfStrings): string {
  switch (kind) {
    case 'GARAGE':
      return strings.features.garage;
    case 'TERRACE':
      return strings.features.terrace;
    case 'POOL':
      return strings.features.pool;
    case 'BALCONY':
      return strings.features.balcony;
    case 'DRIVEWAY':
      return strings.siteDriveway;
    case 'PATH':
      return strings.sitePath;
  }
}

function drawRect(doc: Doc, t: Transform, r: Rect, fillColor: string, strokeColor: string, weight: number): void {
  doc
    .rect(toX(t, r.x), toY(t, r.y), toLen(t, r.width), toLen(t, r.height))
    .fillColor(fillColor)
    .fillOpacity(1)
    .fill();
  doc
    .rect(toX(t, r.x), toY(t, r.y), toLen(t, r.width), toLen(t, r.height))
    .lineWidth(weight)
    .strokeColor(strokeColor)
    .stroke();
}

/** Centres a label inside a rect, but only when it will actually fit. */
function centredLabel(doc: Doc, t: Transform, r: Rect, text: string, size: number, color: string): void {
  const width = toLen(t, r.width);
  const height = toLen(t, r.height);
  if (width < 34 || height < 12) return;
  doc
    .font(FONTS.bold)
    .fontSize(size)
    .fillColor(color)
    .text(sanitize(text), toX(t, r.x), toY(t, r.y) + height / 2 - size * 0.7, {
      width,
      align: 'center',
      lineBreak: false,
    });
}

function drawSite(doc: Doc, site: SiteLayout, boxTop: number, strings: PdfStrings): void {
  const { plot, house } = site;
  const boxWidth = CONTENT_WIDTH;
  const usableW = boxWidth - PADDING * 2;
  const usableH = DRAWING_HEIGHT - PADDING * 2;
  const scale = Math.min(usableW / plot.width, usableH / plot.height);

  const t: Transform = {
    scale,
    originX: PAGE.margin + (boxWidth - plot.width * scale) / 2,
    originY: boxTop + (DRAWING_HEIGHT - plot.height * scale) / 2,
  };

  // Plot boundary — the surveyor's dash-dot.
  doc
    .rect(toX(t, 0), toY(t, 0), toLen(t, plot.width), toLen(t, plot.height))
    .fillColor(COLORS.planGround)
    .fill();
  doc
    .rect(toX(t, 0), toY(t, 0), toLen(t, plot.width), toLen(t, plot.height))
    .lineWidth(0.9)
    .strokeColor(COLORS.lineStrong)
    .dash(6, { space: 3 })
    .stroke();
  doc.undash();

  for (const kind of ORDER) {
    for (const element of site.elements.filter((e) => e.kind === kind)) {
      drawRect(
        doc,
        t,
        element.rect,
        FILLS[kind],
        kind === 'GARAGE' ? COLORS.ink : COLORS.lineStrong,
        kind === 'GARAGE' ? 1.1 : 0.5,
      );
      centredLabel(doc, t, element.rect, elementLabel(kind, strings), TYPE.tiny, COLORS.inkSoft);
    }
  }

  // The building — the heaviest mark on the sheet.
  drawRect(doc, t, house, COLORS.ink, COLORS.ink, 1);
  centredLabel(doc, t, house, strings.siteHouse, TYPE.small, COLORS.planSlab);

  // Street edge, so the plot has a front.
  const streetY = toY(t, 0) - 14;
  doc
    .moveTo(toX(t, 0) - 10, streetY)
    .lineTo(toX(t, plot.width) + 10, streetY)
    .lineWidth(1)
    .strokeColor(COLORS.inkFaint)
    .stroke();
  doc
    .font(FONTS.bold)
    .fontSize(TYPE.tiny)
    .fillColor(COLORS.inkFaint)
    .text(sanitize(strings.siteStreet), PAGE.margin, streetY - 12, {
      width: boxWidth,
      align: 'center',
      lineBreak: false,
    });

  // Overall dimensions.
  doc
    .font(FONTS.regular)
    .fontSize(TYPE.tiny)
    .fillColor(COLORS.inkSoft)
    .text(
      sanitize(fill(strings.siteDimension, { value: formatNumber(plot.width, 1) })),
      PAGE.margin,
      toY(t, plot.height) + 8,
      { width: boxWidth, align: 'center', lineBreak: false },
    );
}

export function renderSitePlan(doc: Doc, report: PdfReport, strings: PdfStrings): void {
  // The site needs a house footprint to arrange itself around. Without a plan
  // there is nothing to place, and an invented plot would be worse than none.
  if (report.plan === null) return;

  const site = layoutSite({
    land: report.land,
    house: {
      widthM: report.house.widthM,
      lengthM: report.house.lengthM,
      floorCount: report.house.floorCount,
    },
    features: report.features,
  });

  doc.addPage();
  sectionTitle(doc, strings.siteTitle);
  gap(doc, 4);

  const boxTop = doc.y;
  drawSite(doc, site, boxTop, strings);
  doc.y = boxTop + DRAWING_HEIGHT + 18;

  doc
    .font(FONTS.regular)
    .fontSize(TYPE.small)
    .fillColor(COLORS.inkFaint)
    .text(sanitize(site.plotDerived ? strings.siteDerivedNote : strings.siteNote), PAGE.margin, doc.y, {
      width: CONTENT_WIDTH,
    });
}
