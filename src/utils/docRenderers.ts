export interface InvoiceItem {
  id: string;
  description: string;
  qty: number;
  rate: number;
}

export interface InvoiceData {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  invoiceNo: string;
  date: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  currency: '₹' | '৳' | '$';
  taxPercent: number;
  discount: number;
  notes: string;
  items: InvoiceItem[];
}

export interface SalarySlipData {
  companyName: string;
  companyAddress: string;
  monthYear: string;
  employeeName: string;
  employeeId: string;
  designation: string;
  department: string;
  bankAccount: string;
  paidDays: number;
  currency: '₹' | '৳';
  basic: number;
  hra: number;
  da: number;
  conveyance: number;
  bonus: number;
  pf: number;
  pt: number;
  tds: number;
  otherDeduction: number;
}

export interface ApplicationData {
  language: 'bn' | 'en';
  date: string;
  toTitle: string;
  toOrg: string;
  toAddress: string;
  subject: string;
  salutation: string;
  body: string;
  closing: string;
  senderName: string;
  senderDetails: string;
}

export interface VisitingCardData {
  name: string;
  role: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  themeColor: string;
}

export interface ResumeData {
  fullName: string;
  headline: string;
  phone: string;
  email: string;
  address: string;
  summary: string;
  education: string;
  experience: string;
  skills: string;
  languages: string;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export async function renderInvoiceCanvas(data: InvoiceData): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const W = 1240;
  const H = 1754;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Header band
  ctx.fillStyle = '#0f2a5c';
  ctx.fillRect(0, 0, W, 220);
  ctx.fillStyle = '#f57c00';
  ctx.fillRect(0, 220, W, 10);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 42px "Hind Siliguri", sans-serif';
  ctx.fillText(data.businessName || 'Business Name', 70, 95);

  ctx.font = '400 22px "Hind Siliguri", sans-serif';
  ctx.fillStyle = '#dbeafe';
  ctx.fillText(data.businessAddress, 70, 140);
  ctx.fillText(`Phone: ${data.businessPhone}`, 70, 178);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffb347';
  ctx.font = '700 44px "Hind Siliguri", sans-serif';
  ctx.fillText('INVOICE / ক্যাশ মেমো', W - 70, 100);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 22px "Hind Siliguri", sans-serif';
  ctx.fillText(`No: ${data.invoiceNo}`, W - 70, 148);
  ctx.fillText(`Date: ${data.date}`, W - 70, 182);
  ctx.textAlign = 'left';

  // Customer info box
  ctx.fillStyle = '#f4f7fc';
  ctx.fillRect(70, 270, W - 140, 145);
  ctx.strokeStyle = '#d9e2f1';
  ctx.lineWidth = 2;
  ctx.strokeRect(70, 270, W - 140, 145);

  ctx.fillStyle = '#0f2a5c';
  ctx.font = '700 22px "Hind Siliguri", sans-serif';
  ctx.fillText('Bill To / গ্রাহকের তথ্য:', 95, 310);
  ctx.fillStyle = '#12263a';
  ctx.font = '600 24px "Hind Siliguri", sans-serif';
  ctx.fillText(data.customerName || 'Customer Name', 95, 348);
  ctx.font = '400 20px "Hind Siliguri", sans-serif';
  ctx.fillStyle = '#5b6b7a';
  ctx.fillText(`${data.customerAddress} • Ph: ${data.customerPhone}`, 95, 386);

  // Table header
  let y = 460;
  ctx.fillStyle = '#0f2a5c';
  ctx.fillRect(70, y, W - 140, 56);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 22px "Hind Siliguri", sans-serif';
  ctx.fillText('#', 90, y + 36);
  ctx.fillText('Item Description / বিবরণ', 145, y + 36);
  ctx.textAlign = 'right';
  ctx.fillText('Qty', 820, y + 36);
  ctx.fillText('Rate', 980, y + 36);
  ctx.fillText('Amount', W - 90, y + 36);
  ctx.textAlign = 'left';

  y += 56;
  let subtotal = 0;

  data.items.forEach((item, idx) => {
    const amount = item.qty * item.rate;
    subtotal += amount;

    ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillRect(70, y, W - 140, 54);
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(70, y + 54);
    ctx.lineTo(W - 70, y + 54);
    ctx.stroke();

    ctx.fillStyle = '#12263a';
    ctx.font = '400 22px "Hind Siliguri", sans-serif';
    ctx.fillText(`${idx + 1}`, 90, y + 35);
    ctx.fillText(item.description.slice(0, 44), 145, y + 35);
    ctx.textAlign = 'right';
    ctx.fillText(`${item.qty}`, 820, y + 35);
    ctx.fillText(`${data.currency}${item.rate.toFixed(2)}`, 980, y + 35);
    ctx.font = '600 22px "Hind Siliguri", sans-serif';
    ctx.fillText(`${data.currency}${amount.toFixed(2)}`, W - 90, y + 35);
    ctx.textAlign = 'left';

    y += 54;
  });

  // Totals
  const taxAmt = (subtotal * data.taxPercent) / 100;
  const grandTotal = Math.max(0, subtotal + taxAmt - data.discount);

  y += 40;
  const boxX = W - 470;
  ctx.fillStyle = '#f4f7fc';
  ctx.fillRect(boxX, y, 400, 195);
  ctx.strokeStyle = '#d9e2f1';
  ctx.strokeRect(boxX, y, 400, 195);

  const drawRow = (label: string, val: string, rowY: number, bold = false) => {
    ctx.fillStyle = bold ? '#0f2a5c' : '#334155';
    ctx.font = `${bold ? '700 26px' : '400 22px'} "Hind Siliguri", sans-serif`;
    ctx.fillText(label, boxX + 24, rowY);
    ctx.textAlign = 'right';
    ctx.fillText(val, boxX + 376, rowY);
    ctx.textAlign = 'left';
  };

  drawRow('Subtotal:', `${data.currency}${subtotal.toFixed(2)}`, y + 42);
  drawRow(`Tax / GST (${data.taxPercent}%):`, `${data.currency}${taxAmt.toFixed(2)}`, y + 84);
  drawRow('Discount:', `-${data.currency}${data.discount.toFixed(2)}`, y + 126);

  ctx.fillStyle = '#f57c00';
  ctx.fillRect(boxX, y + 145, 400, 50);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 26px "Hind Siliguri", sans-serif';
  ctx.fillText('Grand Total:', boxX + 24, y + 179);
  ctx.textAlign = 'right';
  ctx.fillText(`${data.currency}${grandTotal.toFixed(2)}`, boxX + 376, y + 179);
  ctx.textAlign = 'left';

  // Notes & Signature
  ctx.fillStyle = '#5b6b7a';
  ctx.font = '600 20px "Hind Siliguri", sans-serif';
  ctx.fillText('Notes / Terms:', 70, y + 40);
  ctx.font = '400 19px "Hind Siliguri", sans-serif';
  wrapLines(ctx, data.notes, 600).forEach((ln, i) => {
    ctx.fillText(ln, 70, y + 74 + i * 28);
  });

  ctx.strokeStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(W - 350, H - 140);
  ctx.lineTo(W - 80, H - 140);
  ctx.stroke();
  ctx.fillStyle = '#12263a';
  ctx.font = '600 20px "Hind Siliguri", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Authorized Signature', W - 215, H - 108);
  ctx.textAlign = 'left';

  return canvas;
}

export async function renderSalarySlipCanvas(data: SalarySlipData): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const W = 1240;
  const H = 1754;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#0f2a5c';
  ctx.fillRect(60, 60, W - 120, 175);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '700 40px "Hind Siliguri", sans-serif';
  ctx.fillText(data.companyName || 'Company Name', W / 2, 128);
  ctx.font = '400 22px "Hind Siliguri", sans-serif';
  ctx.fillStyle = '#dbeafe';
  ctx.fillText(data.companyAddress, W / 2, 168);
  ctx.fillStyle = '#ffb347';
  ctx.font = '700 26px "Hind Siliguri", sans-serif';
  ctx.fillText(`SALARY SLIP / বেতন রসিদ — ${data.monthYear}`, W / 2, 214);
  ctx.textAlign = 'left';

  // Employee grid
  ctx.fillStyle = '#f4f7fc';
  ctx.fillRect(60, 260, W - 120, 190);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 260, W - 120, 190);

  const infoRows: [string, string, string, string][] = [
    ['Employee Name:', data.employeeName, 'Employee ID:', data.employeeId],
    ['Designation:', data.designation, 'Department:', data.department],
    ['Bank A/C:', data.bankAccount, 'Paid Days:', `${data.paidDays} Days`],
  ];

  infoRows.forEach(([l1, v1, l2, v2], idx) => {
    const ry = 310 + idx * 52;
    ctx.fillStyle = '#5b6b7a';
    ctx.font = '600 21px "Hind Siliguri", sans-serif';
    ctx.fillText(l1, 88, ry);
    ctx.fillText(l2, 650, ry);
    ctx.fillStyle = '#12263a';
    ctx.font = '700 22px "Hind Siliguri", sans-serif';
    ctx.fillText(v1, 265, ry);
    ctx.fillText(v2, 815, ry);
  });

  // Earnings & Deductions side by side
  const tableY = 490;
  const colW = (W - 140) / 2;
  const drawTable = (
    x: number,
    title: string,
    headerColor: string,
    rows: [string, number][]
  ) => {
    ctx.fillStyle = headerColor;
    ctx.fillRect(x, tableY, colW, 56);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 23px "Hind Siliguri", sans-serif';
    ctx.fillText(title, x + 20, tableY + 36);

    rows.forEach(([label, amt], idx) => {
      const ry = tableY + 56 + idx * 54;
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(x, ry, colW, 54);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(x, ry, colW, 54);
      ctx.fillStyle = '#12263a';
      ctx.font = '400 21px "Hind Siliguri", sans-serif';
      ctx.fillText(label, x + 20, ry + 34);
      ctx.textAlign = 'right';
      ctx.font = '600 21px "Hind Siliguri", sans-serif';
      ctx.fillText(`${data.currency}${amt.toFixed(2)}`, x + colW - 20, ry + 34);
      ctx.textAlign = 'left';
    });
  };

  const earnings: [string, number][] = [
    ['Basic Salary / মূল বেতন', data.basic],
    ['HRA / বাড়ি ভাড়া ভাতা', data.hra],
    ['DA / মহার্ঘ ভাতা', data.da],
    ['Conveyance / যাতায়াত', data.conveyance],
    ['Bonus / অন্যান্য ভাতা', data.bonus],
  ];
  const deductions: [string, number][] = [
    ['Provident Fund (PF)', data.pf],
    ['Professional Tax (PT)', data.pt],
    ['TDS / Income Tax', data.tds],
    ['Advance / Other', data.otherDeduction],
    ['', 0],
  ];

  drawTable(60, 'Earnings / আয়', '#0f2a5c', earnings);
  drawTable(80 + colW, 'Deductions / কর্তন', '#b91c1c', deductions);

  const gross = data.basic + data.hra + data.da + data.conveyance + data.bonus;
  const totalDed = data.pf + data.pt + data.tds + data.otherDeduction;
  const netPay = Math.max(0, gross - totalDed);

  const sumY = tableY + 56 + 5 * 54 + 36;
  ctx.fillStyle = '#e8f1ff';
  ctx.fillRect(60, sumY, W - 120, 120);
  ctx.strokeStyle = '#0f2a5c';
  ctx.lineWidth = 3;
  ctx.strokeRect(60, sumY, W - 120, 120);

  ctx.fillStyle = '#12263a';
  ctx.font = '600 24px "Hind Siliguri", sans-serif';
  ctx.fillText(`Gross Earnings: ${data.currency}${gross.toFixed(2)}`, 92, sumY + 46);
  ctx.fillText(`Total Deductions: ${data.currency}${totalDed.toFixed(2)}`, 92, sumY + 88);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#f57c00';
  ctx.font = '700 34px "Hind Siliguri", sans-serif';
  ctx.fillText(`Net Pay: ${data.currency}${netPay.toFixed(2)}`, W - 92, sumY + 72);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#5b6b7a';
  ctx.font = '400 18px "Hind Siliguri", sans-serif';
  ctx.fillText(
    'This is a computer-generated salary slip created via Kaajer Tools.',
    60,
    H - 90
  );

  return canvas;
}

export async function renderApplicationCanvas(data: ApplicationData): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const W = 1240;
  const H = 1754;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const left = 110;
  const maxW = W - 220;
  let y = 130;

  ctx.fillStyle = '#12263a';
  ctx.font = '600 24px "Hind Siliguri", sans-serif';
  ctx.fillText(`${data.language === 'bn' ? 'তারিখ:' : 'Date:'} ${data.date}`, left, y);
  y += 65;

  ctx.font = '600 25px "Hind Siliguri", sans-serif';
  ctx.fillText(data.language === 'bn' ? 'বরাবর,' : 'To,', left, y);
  y += 38;
  ctx.font = '400 24px "Hind Siliguri", sans-serif';
  [data.toTitle, data.toOrg, data.toAddress].forEach((line) => {
    if (line.trim()) {
      ctx.fillText(line, left, y);
      y += 36;
    }
  });

  y += 34;
  ctx.font = '700 25px "Hind Siliguri", sans-serif';
  const subjPrefix = data.language === 'bn' ? 'বিষয়: ' : 'Subject: ';
  const subjLines = wrapLines(ctx, subjPrefix + data.subject, maxW);
  subjLines.forEach((ln) => {
    ctx.fillText(ln, left, y);
    y += 38;
  });

  y += 28;
  ctx.font = '600 24px "Hind Siliguri", sans-serif';
  ctx.fillText(data.salutation, left, y);
  y += 44;

  ctx.font = '400 23px "Hind Siliguri", sans-serif';
  const bodyLines = wrapLines(ctx, data.body, maxW);
  bodyLines.forEach((ln) => {
    if (ln === '') {
      y += 22;
    } else {
      ctx.fillText(ln, left, y);
      y += 37;
    }
  });

  y += 56;
  ctx.font = '600 24px "Hind Siliguri", sans-serif';
  ctx.fillText(data.closing, left, y);
  y += 65;
  ctx.font = '700 25px "Hind Siliguri", sans-serif';
  ctx.fillText(data.senderName, left, y);
  y += 36;
  ctx.font = '400 22px "Hind Siliguri", sans-serif';
  ctx.fillStyle = '#475569';
  wrapLines(ctx, data.senderDetails, maxW).forEach((ln) => {
    ctx.fillText(ln, left, y);
    y += 34;
  });

  return canvas;
}

export async function renderVisitingCardCanvas(data: VisitingCardData): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const W = 1050;
  const H = 600;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Left accent band
  ctx.fillStyle = data.themeColor || '#0f2a5c';
  ctx.fillRect(0, 0, 340, H);
  ctx.fillStyle = '#f57c00';
  ctx.fillRect(340, 0, 14, H);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 36px "Hind Siliguri", sans-serif';
  wrapLines(ctx, data.company || 'Kaajer Studio', 280).forEach((ln, idx) => {
    ctx.fillText(ln, 36, 220 + idx * 46);
  });

  ctx.fillStyle = '#12263a';
  ctx.font = '700 44px "Hind Siliguri", sans-serif';
  ctx.fillText(data.name || 'Your Name', 400, 145);

  ctx.fillStyle = '#f57c00';
  ctx.font = '600 26px "Hind Siliguri", sans-serif';
  ctx.fillText(data.role || 'Designation', 400, 192);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(400, 225);
  ctx.lineTo(W - 50, 225);
  ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.font = '400 24px "Hind Siliguri", sans-serif';
  const details = [
    `📞  ${data.phone}`,
    `✉️  ${data.email}`,
    `🌐  ${data.website}`,
    `📍  ${data.address}`,
  ].filter((x) => x.trim().length > 4);

  details.forEach((line, i) => {
    ctx.fillText(line, 400, 290 + i * 54);
  });

  return canvas;
}

export async function renderResumeCanvas(data: ResumeData): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const W = 1240;
  const H = 1754;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#0f2a5c';
  ctx.fillRect(0, 0, W, 230);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 46px "Hind Siliguri", sans-serif';
  ctx.fillText(data.fullName || 'Full Name', 80, 100);
  ctx.fillStyle = '#ffb347';
  ctx.font = '600 26px "Hind Siliguri", sans-serif';
  ctx.fillText(data.headline, 80, 145);
  ctx.fillStyle = '#dbeafe';
  ctx.font = '400 21px "Hind Siliguri", sans-serif';
  ctx.fillText(`${data.phone}  |  ${data.email}  |  ${data.address}`, 80, 190);

  let y = 290;
  const drawSection = (title: string, content: string) => {
    if (!content.trim()) return;
    ctx.fillStyle = '#0f2a5c';
    ctx.font = '700 27px "Hind Siliguri", sans-serif';
    ctx.fillText(title, 80, y);
    ctx.fillStyle = '#f57c00';
    ctx.fillRect(80, y + 10, W - 160, 3);
    y += 48;

    ctx.fillStyle = '#1e293b';
    ctx.font = '400 22px "Hind Siliguri", sans-serif';
    wrapLines(ctx, content, W - 160).forEach((ln) => {
      if (ln === '') {
        y += 18;
      } else {
        ctx.fillText(ln, 80, y);
        y += 34;
      }
    });
    y += 32;
  };

  drawSection('Career Summary / সংক্ষিপ্ত পরিচিতি', data.summary);
  drawSection('Work Experience / অভিজ্ঞতা', data.experience);
  drawSection('Education / শিক্ষাগত যোগ্যতা', data.education);
  drawSection('Skills / দক্ষতা', data.skills);
  drawSection('Languages / ভাষা', data.languages);

  return canvas;
}
