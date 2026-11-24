export type A4StartPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center';

export interface A4SlotPlacement {
  slotIndex: number; // 0-based grid slot
  row: number;
  col: number;
  xMm: number; // bottom-left or top-left? Always TOP-DOWN mm coordinates for UI, converted to PDF bottom-up when drawing
  yTopMm: number;
  slotWMm: number;
  slotHMm: number;
  cardWMm: number;
  cardHMm: number;
}

export interface A4GridCalculation {
  pageWMm: number;
  pageHMm: number;
  edgeMarginMm: number;
  cols: number;
  rows: number;
  maxSlots: number;
  slots: A4SlotPlacement[];
  remainingFreeSlots: number;
  remainingHeightMm: number;
}

export function calculateA4Grid(params: {
  cardWMm: number;
  cardHMm: number;
  laminationMarginMm: number;
  gapMm: number;
  cardsPerSheet: number;
  startPosition: A4StartPosition;
  startSlotOffset: number;
  cardCount: number;
}): A4GridCalculation {
  const pageWMm = 210;
  const pageHMm = 297;
  const edgeMarginMm = 8;

  const slotWMm = params.cardWMm + params.laminationMarginMm * 2;
  const slotHMm = params.cardHMm + params.laminationMarginMm * 2;

  const usableW = pageWMm - edgeMarginMm * 2;
  const usableH = pageHMm - edgeMarginMm * 2;

  const cols = Math.max(1, Math.floor((usableW + params.gapMm) / (slotWMm + params.gapMm)));
  const maxRowsFit = Math.max(1, Math.floor((usableH + params.gapMm) / (slotHMm + params.gapMm)));
  const maxSlots = Math.min(params.cardsPerSheet, cols * maxRowsFit);
  const rows = Math.max(1, Math.ceil(maxSlots / cols));

  const gridTotalW = cols * slotWMm + (cols - 1) * params.gapMm;
  const gridTotalH = rows * slotHMm + (rows - 1) * params.gapMm;

  const slots: A4SlotPlacement[] = [];

  for (let i = 0; i < maxSlots; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;

    let xMm = edgeMarginMm + c * (slotWMm + params.gapMm);
    let yTopMm = edgeMarginMm + r * (slotHMm + params.gapMm);

    if (params.startPosition === 'top-right') {
      xMm = pageWMm - edgeMarginMm - slotWMm - c * (slotWMm + params.gapMm);
      yTopMm = edgeMarginMm + r * (slotHMm + params.gapMm);
    } else if (params.startPosition === 'bottom-left') {
      xMm = edgeMarginMm + c * (slotWMm + params.gapMm);
      yTopMm = pageHMm - edgeMarginMm - slotHMm - r * (slotHMm + params.gapMm);
    } else if (params.startPosition === 'bottom-right') {
      xMm = pageWMm - edgeMarginMm - slotWMm - c * (slotWMm + params.gapMm);
      yTopMm = pageHMm - edgeMarginMm - slotHMm - r * (slotHMm + params.gapMm);
    } else if (params.startPosition === 'center') {
      const originX = (pageWMm - gridTotalW) / 2;
      const originY = (pageHMm - gridTotalH) / 2;
      xMm = originX + c * (slotWMm + params.gapMm);
      yTopMm = originY + r * (slotHMm + params.gapMm);
    }

    slots.push({
      slotIndex: i,
      row: r,
      col: c,
      xMm,
      yTopMm,
      slotWMm,
      slotHMm,
      cardWMm: params.cardWMm,
      cardHMm: params.cardHMm,
    });
  }

  const endSlotUsed = Math.min(maxSlots, params.startSlotOffset + params.cardCount);
  const remainingFreeSlots = Math.max(0, maxSlots - endSlotUsed);
  const rowsUsed = endSlotUsed > 0 ? Math.ceil(endSlotUsed / cols) : 0;
  const usedHeightMm =
    rowsUsed > 0 ? edgeMarginMm + rowsUsed * slotHMm + (rowsUsed - 1) * params.gapMm : 0;
  const remainingHeightMm = Math.max(0, Math.round(pageHMm - usedHeightMm - edgeMarginMm));

  return {
    pageWMm,
    pageHMm,
    edgeMarginMm,
    cols,
    rows,
    maxSlots,
    slots,
    remainingFreeSlots,
    remainingHeightMm,
  };
}
