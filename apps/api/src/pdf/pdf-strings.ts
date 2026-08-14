import {
  type EstimateLineKey,
  type FeatureKey,
  type FinishLevel,
  type HouseStyle,
  type ProjectStatus,
  type RoomType,
} from '@archai/shared';

/** Document languages, in the same order as the web UI (docs/pdf-export.md §Document). */
export const PDF_LOCALES = ['uz', 'ru', 'en'] as const;
export type PdfLocale = (typeof PDF_LOCALES)[number];

export const DEFAULT_PDF_LOCALE: PdfLocale = 'uz';

/**
 * Every string the document prints, per locale. Wording follows the web catalogs
 * (`apps/web/messages/*.json`) so the PDF reads like the product, not like a
 * second translation of it. Placeholders are `{name}` and are filled by `fill`.
 */
export interface PdfStrings {
  /** Cover + running head. */
  reportTitle: string;
  reportSubtitle: string;
  owner: string;
  documentDate: string;
  projectId: string;
  /** Explains that the document date is the project's last edit, not the click. */
  documentDateNote: string;
  status: Record<ProjectStatus, string>;

  summaryTitle: string;
  landTitle: string;
  landArea: string;
  landSotix: string;
  landSides: string;
  houseTitle: string;
  houseDimensions: string;
  houseFloors: string;
  houseFootprint: string;
  houseCoverage: string;
  houseStyle: string;
  featuresTitle: string;
  featuresNone: string;
  roomsTitle: string;
  roomsColumnType: string;
  roomsColumnLabel: string;
  roomsColumnDimensions: string;
  roomsColumnArea: string;
  roomsFloorHeading: string;
  roomsFloorTotal: string;
  roomsUnsized: string;

  plansTitle: string;
  planFloorHeading: string;
  planScaleNote: string;
  planLegendTitle: string;
  planLegendDoor: string;
  planLegendWindow: string;
  planLegendStairs: string;
  planLegendCorridor: string;

  estimateTitle: string;
  estimateTotal: string;
  estimateRange: string;
  estimateCostPerM2: string;
  estimateGrossArea: string;
  estimateBreakdown: string;
  estimateColumnItem: string;
  estimateColumnAmount: string;
  estimateTotalRow: string;
  estimateLaborNote: string;
  estimateFootnote: string;
  estimateDisclaimerTitle: string;
  estimateDisclaimerBody: string;
  finishLevel: Record<FinishLevel, string>;
  estimateLine: Record<EstimateLineKey, string>;

  /** Page furniture. */
  footerDisclaimer: string;
  page: string;

  /** Units and value templates. */
  unitM: string;
  unitM2: string;
  unitSotix: string;
  currency: string;
  dimensions: string;

  roomTypes: Record<RoomType, string>;
  styles: Record<HouseStyle, string>;
  features: Record<FeatureKey, string>;
}

/** Replaces `{key}` placeholders; an unknown key is left untouched on purpose. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

const UZ: PdfStrings = {
  reportTitle: 'Loyiha hisoboti',
  reportSubtitle: 'Dastlabki reja va taxminiy qiymat',
  owner: 'Buyurtmachi',
  documentDate: 'Hujjat sanasi',
  projectId: 'Loyiha raqami',
  documentDateNote: 'Sana — loyihaning oxirgi tahriri (Toshkent vaqti).',
  status: {
    DRAFT: 'Qoralama',
    CONFIGURED: 'Sozlangan',
    GENERATING: 'Yaratilmoqda',
    READY: 'Tayyor',
    ARCHIVED: 'Arxivlangan',
    FAILED: 'Xatolik',
  },

  summaryTitle: 'Loyiha sozlamalari',
  landTitle: 'Yer uchastkasi',
  landArea: 'Maydoni',
  landSotix: 'Sotixda',
  landSides: "O'lchamlari",
  houseTitle: 'Uy',
  houseDimensions: "O'lchamlari",
  houseFloors: 'Qavatlar',
  houseFootprint: 'Uy asosi',
  houseCoverage: 'Yer bandligi',
  houseStyle: 'Uslub',
  featuresTitle: "Qo'shimchalar",
  featuresNone: "Qo'shimchalar tanlanmagan",
  roomsTitle: 'Xonalar',
  roomsColumnType: 'Turi',
  roomsColumnLabel: 'Nomi',
  roomsColumnDimensions: "O'lchami",
  roomsColumnArea: 'Maydoni',
  roomsFloorHeading: '{floor}-qavat',
  roomsFloorTotal: "Qavat bo'yicha jami",
  roomsUnsized: "o'lcham berilmagan",

  plansTitle: 'Qavat rejalari',
  planFloorHeading: '{floor}-qavat rejasi',
  planScaleNote: 'sxematik reja — masshtabsiz',
  planLegendTitle: 'Belgilar',
  planLegendDoor: 'Eshik',
  planLegendWindow: 'Deraza',
  planLegendStairs: 'Zinapoya',
  planLegendCorridor: "Umumiy yo'lak",

  estimateTitle: 'Taxminiy qiymat',
  estimateTotal: 'Taxminiy umumiy qiymat',
  estimateRange: 'Ehtimoliy oraliq',
  estimateCostPerM2: '1 m² narxi',
  estimateGrossArea: 'Umumiy qurilish maydoni',
  estimateBreakdown: 'Xarajatlar tarkibi',
  estimateColumnItem: 'Modda',
  estimateColumnAmount: "Summa, so'm",
  estimateTotalRow: 'Jami',
  estimateLaborNote:
    "Ish haqi yuqoridagi qurilish va pardoz summalari ichida — jamiga alohida qo'shilmaydi.",
  estimateFootnote: 'Hisob qoidalari: v{version} · Pardoz darajasi: {level}',
  estimateDisclaimerTitle: "Dastlabki mo'ljal — qurilish hujjati emas",
  estimateDisclaimerBody:
    "Hisob-kitob o'lchamlar va tanlangan pardoz darajasi asosida avtomatik tuzildi. Haqiqiy narxlar mintaqa, materiallar, pudratchi va mavsumga qarab sezilarli farq qiladi. Qaror qabul qilishdan oldin mahalliy pudratchidan rasmiy smeta oling.",
  finishLevel: { STANDARD: 'Standart', COMFORT: 'Komfort', PREMIUM: 'Premium' },
  estimateLine: {
    structure: 'Qurilish ishlari',
    finish: 'Pardoz ishlari — {level}',
    features: "Qo'shimchalar",
    'labor-info': 'Shundan ish haqi',
    contingency: 'Zaxira',
  },

  footerDisclaimer: "Dastlabki mo'ljal — qurilish hujjati emas",
  page: '{page} / {total}',

  unitM: 'm',
  unitM2: 'm²',
  unitSotix: 'sotix',
  currency: "so'm",
  dimensions: '{width} × {length} m',

  roomTypes: {
    BEDROOM: 'Yotoqxona',
    LIVING_ROOM: 'Mehmonxona',
    KITCHEN: 'Oshxona',
    BATHROOM: 'Hammom',
    DINING_ROOM: 'Ovqatlanish xonasi',
    OFFICE: 'Ish xonasi',
    STORAGE: 'Omborxona',
    LAUNDRY: 'Kir yuvish xonasi',
    HALLWAY: "Yo'lak",
    OTHER: 'Boshqa',
  },
  styles: {
    MODERN: 'Zamonaviy',
    MINIMALIST: 'Minimalizm',
    CLASSIC: 'Klassik',
    TRADITIONAL: "An'anaviy",
    EUROPEAN: 'Yevropacha',
    NATIONAL: 'Milliy',
  },
  features: {
    garage: 'Garaj',
    terrace: 'Ayvon',
    balcony: 'Balkon',
    pool: 'Basseyn',
    garden: "Bog'",
  },
};

const RU: PdfStrings = {
  reportTitle: 'Отчёт по проекту',
  reportSubtitle: 'Предварительный план и ориентировочная стоимость',
  owner: 'Заказчик',
  documentDate: 'Дата документа',
  projectId: 'Номер проекта',
  documentDateNote: 'Дата — последнее изменение проекта (время Ташкента).',
  status: {
    DRAFT: 'Черновик',
    CONFIGURED: 'Настроен',
    GENERATING: 'Генерируется',
    READY: 'Готов',
    ARCHIVED: 'В архиве',
    FAILED: 'Ошибка',
  },

  summaryTitle: 'Параметры проекта',
  landTitle: 'Участок',
  landArea: 'Площадь',
  landSotix: 'В сотках',
  landSides: 'Размеры',
  houseTitle: 'Дом',
  houseDimensions: 'Размеры',
  houseFloors: 'Этажей',
  houseFootprint: 'Пятно застройки',
  houseCoverage: 'Занято участка',
  houseStyle: 'Стиль',
  featuresTitle: 'Дополнения',
  featuresNone: 'Дополнения не выбраны',
  roomsTitle: 'Комнаты',
  roomsColumnType: 'Тип',
  roomsColumnLabel: 'Название',
  roomsColumnDimensions: 'Размер',
  roomsColumnArea: 'Площадь',
  roomsFloorHeading: '{floor}-й этаж',
  roomsFloorTotal: 'Итого по этажу',
  roomsUnsized: 'размер не задан',

  plansTitle: 'Планы этажей',
  planFloorHeading: 'План {floor}-го этажа',
  planScaleNote: 'схематичный план — без масштаба',
  planLegendTitle: 'Обозначения',
  planLegendDoor: 'Дверь',
  planLegendWindow: 'Окно',
  planLegendStairs: 'Лестница',
  planLegendCorridor: 'Общий проход',

  estimateTitle: 'Ориентировочная стоимость',
  estimateTotal: 'Ориентировочная общая стоимость',
  estimateRange: 'Вероятный диапазон',
  estimateCostPerM2: 'Цена 1 м²',
  estimateGrossArea: 'Общая площадь застройки',
  estimateBreakdown: 'Структура затрат',
  estimateColumnItem: 'Статья',
  estimateColumnAmount: 'Сумма, сум',
  estimateTotalRow: 'Итого',
  estimateLaborNote:
    'Оплата труда уже входит в строительные и отделочные работы — в итог отдельно не добавляется.',
  estimateFootnote: 'Правила расчёта: v{version} · Уровень отделки: {level}',
  estimateDisclaimerTitle: 'Предварительный ориентир — не проектная документация',
  estimateDisclaimerBody:
    'Расчёт составлен автоматически по размерам и выбранному уровню отделки. Реальные цены заметно зависят от региона, материалов, подрядчика и сезона. Перед решением возьмите официальную смету у местного подрядчика.',
  finishLevel: { STANDARD: 'Стандарт', COMFORT: 'Комфорт', PREMIUM: 'Премиум' },
  estimateLine: {
    structure: 'Строительные работы',
    finish: 'Отделка — {level}',
    features: 'Дополнения',
    'labor-info': 'В том числе оплата труда',
    contingency: 'Резерв',
  },

  footerDisclaimer: 'Предварительный ориентир — не проектная документация',
  page: '{page} / {total}',

  unitM: 'м',
  unitM2: 'м²',
  unitSotix: 'соток',
  currency: 'сум',
  dimensions: '{width} × {length} м',

  roomTypes: {
    BEDROOM: 'Спальня',
    LIVING_ROOM: 'Гостиная',
    KITCHEN: 'Кухня',
    BATHROOM: 'Санузел',
    DINING_ROOM: 'Столовая',
    OFFICE: 'Кабинет',
    STORAGE: 'Кладовая',
    LAUNDRY: 'Постирочная',
    HALLWAY: 'Коридор',
    OTHER: 'Другое',
  },
  styles: {
    MODERN: 'Современный',
    MINIMALIST: 'Минимализм',
    CLASSIC: 'Классический',
    TRADITIONAL: 'Традиционный',
    EUROPEAN: 'Европейский',
    NATIONAL: 'Национальный',
  },
  features: {
    garage: 'Гараж',
    terrace: 'Терраса',
    balcony: 'Балкон',
    pool: 'Бассейн',
    garden: 'Сад',
  },
};

const EN: PdfStrings = {
  reportTitle: 'Project report',
  reportSubtitle: 'Preliminary plan and indicative cost',
  owner: 'Client',
  documentDate: 'Document date',
  projectId: 'Project id',
  documentDateNote: "The date is the project's last edit (Tashkent time).",
  status: {
    DRAFT: 'Draft',
    CONFIGURED: 'Configured',
    GENERATING: 'Generating',
    READY: 'Ready',
    ARCHIVED: 'Archived',
    FAILED: 'Failed',
  },

  summaryTitle: 'Project configuration',
  landTitle: 'Land',
  landArea: 'Area',
  landSotix: 'In sotix',
  landSides: 'Sides',
  houseTitle: 'House',
  houseDimensions: 'Dimensions',
  houseFloors: 'Floors',
  houseFootprint: 'Footprint',
  houseCoverage: 'Land coverage',
  houseStyle: 'Style',
  featuresTitle: 'Extras',
  featuresNone: 'No extras selected',
  roomsTitle: 'Rooms',
  roomsColumnType: 'Type',
  roomsColumnLabel: 'Name',
  roomsColumnDimensions: 'Size',
  roomsColumnArea: 'Area',
  roomsFloorHeading: 'Floor {floor}',
  roomsFloorTotal: 'Floor total',
  roomsUnsized: 'no size given',

  plansTitle: 'Floor plans',
  planFloorHeading: 'Floor {floor} plan',
  planScaleNote: 'schematic plan — not to scale',
  planLegendTitle: 'Legend',
  planLegendDoor: 'Door',
  planLegendWindow: 'Window',
  planLegendStairs: 'Stairs',
  planLegendCorridor: 'Shared hallway',

  estimateTitle: 'Indicative cost',
  estimateTotal: 'Indicative total cost',
  estimateRange: 'Likely range',
  estimateCostPerM2: 'Cost per m²',
  estimateGrossArea: 'Gross floor area',
  estimateBreakdown: 'Cost breakdown',
  estimateColumnItem: 'Item',
  estimateColumnAmount: "Amount, so'm",
  estimateTotalRow: 'Total',
  estimateLaborNote:
    'Labour is already part of the structural and finishing lines — it is not added to the total again.',
  estimateFootnote: 'Calculation rules: v{version} · Finish level: {level}',
  estimateDisclaimerTitle: 'Preliminary estimate — not a construction document',
  estimateDisclaimerBody:
    'This calculation is generated automatically from the dimensions and the chosen finish level. Real prices vary considerably by region, materials, contractor and season. Get a formal quote from a local contractor before committing.',
  finishLevel: { STANDARD: 'Standard', COMFORT: 'Comfort', PREMIUM: 'Premium' },
  estimateLine: {
    structure: 'Structural works',
    finish: 'Finishing — {level}',
    features: 'Extras',
    'labor-info': 'Of which labour',
    contingency: 'Contingency',
  },

  footerDisclaimer: 'Preliminary estimate — not a construction document',
  page: '{page} / {total}',

  unitM: 'm',
  unitM2: 'm²',
  unitSotix: 'sotix',
  currency: "so'm",
  dimensions: '{width} × {length} m',

  roomTypes: {
    BEDROOM: 'Bedroom',
    LIVING_ROOM: 'Living room',
    KITCHEN: 'Kitchen',
    BATHROOM: 'Bathroom',
    DINING_ROOM: 'Dining room',
    OFFICE: 'Office',
    STORAGE: 'Storage',
    LAUNDRY: 'Laundry',
    HALLWAY: 'Hallway',
    OTHER: 'Other',
  },
  styles: {
    MODERN: 'Modern',
    MINIMALIST: 'Minimalist',
    CLASSIC: 'Classic',
    TRADITIONAL: 'Traditional',
    EUROPEAN: 'European',
    NATIONAL: 'National',
  },
  features: {
    garage: 'Garage',
    terrace: 'Terrace',
    balcony: 'Balcony',
    pool: 'Pool',
    garden: 'Garden',
  },
};

export const PDF_STRINGS: Record<PdfLocale, PdfStrings> = { uz: UZ, ru: RU, en: EN };

export function stringsFor(locale: PdfLocale): PdfStrings {
  return PDF_STRINGS[locale];
}
