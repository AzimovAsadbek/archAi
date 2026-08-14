import { FEATURE_KEYS, type FeatureKey, type RoomConfig, SOTIX_IN_M2 } from '@archai/shared';
import { COLORS, CONTENT_WIDTH, TYPE } from '../theme';
import { formatNumber, round } from '../format';
import {
  type Column,
  type Doc,
  definitionRow,
  gap,
  paragraph,
  remaining,
  ROW_HEIGHT,
  sectionTitle,
  subsectionTitle,
  tableHeader,
  tableRow,
} from '../layout';
import { fill, type PdfStrings } from '../../pdf-strings';
import { type PdfReport } from '../report';

const ROOM_COLUMNS: Column[] = [
  { x: 0, width: CONTENT_WIDTH * 0.3 },
  { x: CONTENT_WIDTH * 0.3, width: CONTENT_WIDTH * 0.34 },
  { x: CONTENT_WIDTH * 0.64, width: CONTENT_WIDTH * 0.19, align: 'right' },
  { x: CONTENT_WIDTH * 0.83, width: CONTENT_WIDTH * 0.17, align: 'right' },
];

interface RowOptions {
  bold?: boolean;
  color?: string;
  size?: number;
  height?: number;
}

const FLOOR_ROW: RowOptions = {
  bold: true,
  color: COLORS.accentStrong,
  size: TYPE.small,
  height: 15,
};
const TOTAL_ROW: RowOptions = {
  bold: true,
  color: COLORS.inkSoft,
  size: TYPE.small,
  height: 15,
};

function enabledFeatures(report: PdfReport): FeatureKey[] {
  return FEATURE_KEYS.filter((key) => report.features[key] === true);
}

function roomArea(room: RoomConfig): number | null {
  if (room.widthM === null || room.widthM === undefined) {
    return null;
  }
  if (room.lengthM === null || room.lengthM === undefined) {
    return null;
  }
  return round(room.widthM * room.lengthM, 1);
}

/** Ascending floor index; rooms keep their configured order inside a floor. */
function floorsOf(rooms: RoomConfig[]): number[] {
  return [...new Set(rooms.map((room) => room.floor))].sort((a, b) => a - b);
}

/**
 * Land, house, extras and the rooms table. The rooms table is the one block that
 * can outgrow a page — `tableRow` breaks it and the header is redrawn on the new
 * page so a 40-room project stays readable.
 */
export function renderSummary(doc: Doc, report: PdfReport, strings: PdfStrings): void {
  const { land, house, rooms } = report;
  const footprint = round(house.widthM * house.lengthM, 1);
  const coverage = land.areaM2 > 0 ? Math.round((footprint / land.areaM2) * 100) : 0;

  sectionTitle(doc, strings.summaryTitle);

  subsectionTitle(doc, strings.landTitle);
  definitionRow(doc, strings.landArea, `${formatNumber(land.areaM2, 2)} ${strings.unitM2}`);
  definitionRow(
    doc,
    strings.landSotix,
    `${formatNumber(land.areaM2 / SOTIX_IN_M2, 2)} ${strings.unitSotix}`,
  );
  if (land.widthM != null && land.lengthM != null) {
    definitionRow(
      doc,
      strings.landSides,
      fill(strings.dimensions, {
        width: formatNumber(land.widthM, 2),
        length: formatNumber(land.lengthM, 2),
      }),
    );
  }
  gap(doc, 12);

  subsectionTitle(doc, strings.houseTitle);
  definitionRow(
    doc,
    strings.houseDimensions,
    fill(strings.dimensions, {
      width: formatNumber(house.widthM, 2),
      length: formatNumber(house.lengthM, 2),
    }),
  );
  definitionRow(doc, strings.houseFloors, String(house.floorCount));
  definitionRow(doc, strings.houseFootprint, `${formatNumber(footprint, 2)} ${strings.unitM2}`);
  definitionRow(doc, strings.houseCoverage, `${coverage}%`);
  if (house.style != null) {
    definitionRow(doc, strings.houseStyle, strings.styles[house.style]);
  }
  gap(doc, 12);

  subsectionTitle(doc, strings.featuresTitle);
  const features = enabledFeatures(report);
  paragraph(
    doc,
    features.length > 0
      ? features.map((key) => strings.features[key]).join(' · ')
      : strings.featuresNone,
    TYPE.body,
    features.length > 0 ? COLORS.ink : COLORS.inkFaint,
  );
  gap(doc, 12);

  subsectionTitle(doc, strings.roomsTitle);
  const headers = [
    strings.roomsColumnType,
    strings.roomsColumnLabel,
    strings.roomsColumnDimensions,
    strings.roomsColumnArea,
  ];
  tableHeader(doc, ROOM_COLUMNS, headers);

  /** Rows continue on the next page under a repeated column header. */
  const writeRow = (cells: string[], options: RowOptions = {}, keepWith = 0): void => {
    const height = options.height ?? ROW_HEIGHT;
    if (remaining(doc) < height + keepWith) {
      doc.addPage();
      tableHeader(doc, ROOM_COLUMNS, headers);
    }
    tableRow(doc, ROOM_COLUMNS, cells, options);
  };

  for (const floor of floorsOf(rooms)) {
    const onFloor = rooms.filter((room) => room.floor === floor);
    gap(doc, 4);
    // A floor heading must never be the last thing on a page.
    writeRow([fill(strings.roomsFloorHeading, { floor: floor + 1 })], FLOOR_ROW, ROW_HEIGHT * 2);

    let total = 0;
    for (const room of onFloor) {
      const area = roomArea(room);
      if (area !== null) {
        total += area;
      }
      const sized =
        room.widthM !== null &&
        room.widthM !== undefined &&
        room.lengthM !== null &&
        room.lengthM !== undefined;
      const dimensions = sized
        ? fill(strings.dimensions, {
            width: formatNumber(room.widthM ?? 0, 2),
            length: formatNumber(room.lengthM ?? 0, 2),
          })
        : strings.roomsUnsized;
      writeRow([
        strings.roomTypes[room.type],
        room.label ?? '',
        dimensions,
        area === null ? '—' : `${formatNumber(area, 1)} ${strings.unitM2}`,
      ]);
    }

    writeRow(
      [
        strings.roomsFloorTotal,
        '',
        '',
        total > 0 ? `${formatNumber(total, 1)} ${strings.unitM2}` : '—',
      ],
      TOTAL_ROW,
    );
  }
  gap(doc, 6);
}
