import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Plus, Trash2 } from 'lucide-react';
import { DocMakerType } from '../types/tools';
import { downloadBlob, downloadBytes } from '../utils/download';
import { canvasToA4Pdf, canvasToCustomPdf } from '../utils/pdfUtils';
import {
  ApplicationData,
  InvoiceData,
  ResumeData,
  SalarySlipData,
  VisitingCardData,
  renderApplicationCanvas,
  renderInvoiceCanvas,
  renderResumeCanvas,
  renderSalarySlipCanvas,
  renderVisitingCardCanvas,
} from '../utils/docRenderers';
import { PrivacyNote } from '../components/PrivacyNote';

interface DocumentMakerPageProps {
  docType: DocMakerType;
  onBack: () => void;
  onSwitchDocType: (docType: DocMakerType) => void;
}

const DOC_TABS: { id: DocMakerType; label: string }[] = [
  { id: 'invoice', label: '🧾 Invoice Maker' },
  { id: 'salary-slip', label: '💰 Salary Slip' },
  { id: 'application', label: '📝 Application Maker' },
  { id: 'visiting-card', label: '💳 Visiting Card' },
  { id: 'resume', label: '📄 Resume / Biodata' },
];

export const DocumentMakerPage: React.FC<DocumentMakerPageProps> = ({
  docType,
  onBack,
  onSwitchDocType,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  const [invoice, setInvoice] = useState<InvoiceData>({
    businessName: 'কাজের এন্টারপ্রাইজ / Kaajer Enterprise',
    businessAddress: 'College Street, Kolkata - 700073',
    businessPhone: '90000 00000',
    invoiceNo: 'INV-2026-101',
    date: '2026-11-23',
    customerName: 'অনির্বাণ সেন / Anirban Sen',
    customerPhone: '98300 00000',
    customerAddress: 'Salt Lake Sector V, Kolkata',
    currency: '₹',
    taxPercent: 0,
    discount: 0,
    notes: 'ধন্যবাদ! ভবিষ্যতে আবার আসবেন। Goods once sold will not be returned.',
    items: [
      { id: '1', description: 'ডকুমেন্ট প্রিন্টিং ও লেমিনেশন', qty: 4, rate: 50 },
      { id: '2', description: 'পাসপোর্ট ফটো শিট (A4)', qty: 2, rate: 80 },
    ],
  });

  const [salary, setSalary] = useState<SalarySlipData>({
    companyName: 'বেঙ্গল ডিজিটাল সার্ভিসেস / Bengal Digital Services',
    companyAddress: 'Park Street, Kolkata - 700016',
    monthYear: 'November 2026',
    employeeName: 'সুমন চক্রবর্তী / Suman Chakraborty',
    employeeId: 'EMP-042',
    designation: 'Office Executive',
    department: 'Operations',
    bankAccount: 'XXXX-XXXX-4821',
    paidDays: 30,
    currency: '₹',
    basic: 18000,
    hra: 4500,
    da: 2000,
    conveyance: 1500,
    bonus: 1000,
    pf: 1800,
    pt: 150,
    tds: 0,
    otherDeduction: 0,
  });

  const [appData, setAppData] = useState<ApplicationData>({
    language: 'bn',
    date: '২৩/১১/২০২৬',
    toTitle: 'মাননীয় প্রধান শিক্ষক / ম্যানেজার মহাশয়,',
    toOrg: 'নবদ্বীপ উচ্চ বিদ্যালয় / অফিস',
    toAddress: 'নদীয়া, পশ্চিমবঙ্গ',
    subject: 'দুই দিনের ছুটির জন্য আবেদন।',
    salutation: 'মহাশয়,',
    body:
      'সবিনয় নিবেদন এই যে, পারিবারিক জরুরি কাজের কারণে আগামী ২৪/১১/২০২৬ ও ২৫/১১/২০২৬ তারিখে আমি উপস্থিত থাকতে পারব না।\n\nঅতএব মহাশয়ের নিকট বিনীত প্রার্থনা, আমাকে উক্ত দুই দিনের ছুটি মঞ্জুর করে বাধিত করুন।',
    closing: 'বিনীত নিবেদক,',
    senderName: 'সৌম্যজিৎ দাস',
    senderDetails: 'মোবাইল: 90000 00000',
  });

  const [card, setCard] = useState<VisitingCardData>({
    name: 'অরিন্দম মুখার্জি',
    role: 'ডিজিটাল সার্ভিস কনসালটেন্ট',
    company: 'Kaajer Digital Hub',
    phone: '+91 90000 00000',
    email: 'hello@kaajertools.example',
    website: 'www.kaajertools.example',
    address: 'Kolkata, West Bengal',
    themeColor: '#0f2a5c',
  });

  const [resume, setResume] = useState<ResumeData>({
    fullName: 'তানিয়া রায় / Tania Roy',
    headline: 'Administrative & Data Entry Specialist',
    phone: '+91 90000 00000',
    email: 'tania.roy@example.com',
    address: 'Howrah, West Bengal',
    summary:
      'Detail-oriented office coordinator with 3+ years of experience in documentation, spreadsheet reporting, and bilingual (Bengali & English) client support.',
    experience:
      '• Office Coordinator — ABC Services (2023 – Present)\n  Managed daily documentation, billing invoices, and digital filings.\n• Computer Operator — City Kendra (2021 – 2023)\n  Prepared online applications and verified records.',
    education:
      '• B.A. (Hons) — University of Calcutta (2020)\n• Diploma in Computer Applications (DCA) — 2021',
    skills: 'MS Office, Excel, Bengali & English Typing, PDF Documentation, Tally',
    languages: 'Bengali (Native), English (Fluent), Hindi (Conversational)',
  });

  const renderCurrentCanvas = async (): Promise<HTMLCanvasElement> => {
    switch (docType) {
      case 'invoice':
        return renderInvoiceCanvas(invoice);
      case 'salary-slip':
        return renderSalarySlipCanvas(salary);
      case 'application':
        return renderApplicationCanvas(appData);
      case 'visiting-card':
        return renderVisitingCardCanvas(card);
      case 'resume':
        return renderResumeCanvas(resume);
    }
  };

  useEffect(() => {
    let active = true;
    renderCurrentCanvas().then((rendered) => {
      if (!active || !previewCanvasRef.current) return;
      const target = previewCanvasRef.current;
      target.width = rendered.width;
      target.height = rendered.height;
      const ctx = target.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, target.width, target.height);
        ctx.drawImage(rendered, 0, 0);
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docType, invoice, salary, appData, card, resume]);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const canvas = await renderCurrentCanvas();
      const bytes =
        docType === 'visiting-card'
          ? await canvasToCustomPdf(canvas, 252, 144)
          : await canvasToA4Pdf(canvas);
      downloadBytes(bytes, `kaajer-${docType}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPng = async () => {
    const canvas = await renderCurrentCanvas();
    canvas.toBlob((b) => {
      if (b) downloadBlob(b, `kaajer-${docType}.png`);
    }, 'image/png');
  };

  const applyAppTemplate = (tpl: 'bn-leave' | 'bn-bank' | 'en-leave') => {
    if (tpl === 'bn-leave') {
      setAppData({
        language: 'bn',
        date: '২৩/১১/২০২৬',
        toTitle: 'মাননীয় প্রধান শিক্ষক / ম্যানেজার মহাশয়,',
        toOrg: 'নবদ্বীপ উচ্চ বিদ্যালয় / অফিস',
        toAddress: 'নদীয়া, পশ্চিমবঙ্গ',
        subject: 'দুই দিনের ছুটির জন্য আবেদন।',
        salutation: 'মহাশয়,',
        body:
          'সবিনয় নিবেদন এই যে, পারিবারিক জরুরি কাজের কারণে আগামী ২৪/১১/২০২৬ ও ২৫/১১/২০২৬ তারিখে আমি উপস্থিত থাকতে পারব না।\n\nঅতএব মহাশয়ের নিকট বিনীত প্রার্থনা, আমাকে উক্ত দুই দিনের ছুটি মঞ্জুর করে বাধিত করুন।',
        closing: 'বিনীত নিবেদক,',
        senderName: 'সৌম্যজিৎ দাস',
        senderDetails: 'মোবাইল: 90000 00000',
      });
    } else if (tpl === 'bn-bank') {
      setAppData({
        language: 'bn',
        date: '২৩/১১/২০২৬',
        toTitle: 'মাননীয় শাখা ব্যবস্থাপক (Branch Manager),',
        toOrg: 'স্টেট ব্যাংক অফ ইন্ডিয়া',
        toAddress: 'কলকাতা প্রধান শাখা',
        subject: 'ব্যাংক অ্যাকাউন্টে মোবাইল নম্বর আপডেট / KYC সংক্রান্ত আবেদন।',
        salutation: 'মহাশয়,',
        body:
          'সবিনয় নিবেদন এই যে, আমি আপনার শাখার একজন সেভিংস অ্যাকাউন্ট গ্রাহক (অ্যাকাউন্ট নং: XXXXXXXX1234)। আমার অ্যাকাউন্টের সাথে বর্তমান মোবাইল নম্বর ও KYC নথি যুক্ত করা প্রয়োজন।\n\nঅতএব প্রয়োজনীয় নথিপত্রসহ আমার আবেদনটি গ্রহণ করে দ্রুত ব্যবস্থা নিতে অনুরোধ করছি।',
        closing: 'আপনার বিশ্বস্ত,',
        senderName: 'রাহুল বিশ্বাস',
        senderDetails: 'অ্যাকাউন্ট নং: XXXXXXXX1234 · মোবাইল: 90000 00000',
      });
    } else {
      setAppData({
        language: 'en',
        date: '23 Nov 2026',
        toTitle: 'The Manager / Principal,',
        toOrg: 'Organization Name',
        toAddress: 'Kolkata, West Bengal',
        subject: 'Application for Two Days Leave',
        salutation: 'Respected Sir / Madam,',
        body:
          'I am writing to kindly request leave for two days (24 Nov 2026 and 25 Nov 2026) due to an urgent family commitment.\n\nI assure you that all pending tasks will be completed promptly upon my return. Kindly grant me leave for the mentioned dates.',
        closing: 'Yours sincerely,',
        senderName: 'Arjun Chatterjee',
        senderDetails: 'ID / Roll No: 104 · Phone: 90000 00000',
      });
    }
  };

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--card)] border border-[var(--bd)] text-[var(--tx)] text-sm font-semibold hover:border-[#f57c00] cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </button>

      {/* Switcher */}
      <div className="flex flex-wrap gap-1.5 bg-[var(--card)] border border-[var(--bd)] p-2 rounded-[16px]">
        {DOC_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSwitchDocType(t.id)}
            className={`px-3.5 py-2 rounded-[10px] text-xs sm:text-sm font-semibold cursor-pointer transition-colors ${
              docType === t.id
                ? 'bg-[#0f2a5c] text-white dark:bg-[#f57c00]'
                : 'text-[var(--tx)] hover:bg-[var(--bg)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main Split: Form + Live Preview */}
      <section className="bg-[var(--card)] border border-[var(--bd)] rounded-[22px] p-5 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Form Column */}
          <div className="lg:col-span-6 space-y-4">
            {docType === 'invoice' && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold m-0">🧾 Invoice / ক্যাশ মেমো তৈরি</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Business / Shop Name"
                    value={invoice.businessName}
                    onChange={(e) => setInvoice({ ...invoice, businessName: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Business Phone"
                    value={invoice.businessPhone}
                    onChange={(e) => setInvoice({ ...invoice, businessPhone: e.target.value })}
                  />
                  <input
                    className="sm:col-span-2 px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Business Address"
                    value={invoice.businessAddress}
                    onChange={(e) => setInvoice({ ...invoice, businessAddress: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Invoice No"
                    value={invoice.invoiceNo}
                    onChange={(e) => setInvoice({ ...invoice, invoiceNo: e.target.value })}
                  />
                  <input
                    type="date"
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    value={invoice.date}
                    onChange={(e) => setInvoice({ ...invoice, date: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Customer Name"
                    value={invoice.customerName}
                    onChange={(e) => setInvoice({ ...invoice, customerName: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Customer Phone"
                    value={invoice.customerPhone}
                    onChange={(e) => setInvoice({ ...invoice, customerPhone: e.target.value })}
                  />
                </div>

                {/* Line Items */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Line Items</span>
                    <button
                      type="button"
                      onClick={() =>
                        setInvoice({
                          ...invoice,
                          items: [
                            ...invoice.items,
                            { id: `${Date.now()}`, description: 'New Item', qty: 1, rate: 100 },
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#f57c00] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Item
                    </button>
                  </div>
                  {invoice.items.map((item, idx) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        className="col-span-6 px-2.5 py-1.5 rounded-lg border border-[var(--bd)] bg-[var(--bg)] text-xs"
                        value={item.description}
                        onChange={(e) => {
                          const next = [...invoice.items];
                          next[idx] = { ...item, description: e.target.value };
                          setInvoice({ ...invoice, items: next });
                        }}
                      />
                      <input
                        type="number"
                        min={1}
                        className="col-span-2 px-2 py-1.5 rounded-lg border border-[var(--bd)] bg-[var(--bg)] text-xs"
                        value={item.qty}
                        onChange={(e) => {
                          const next = [...invoice.items];
                          next[idx] = { ...item, qty: Math.max(1, Number(e.target.value)) };
                          setInvoice({ ...invoice, items: next });
                        }}
                      />
                      <input
                        type="number"
                        min={0}
                        className="col-span-3 px-2 py-1.5 rounded-lg border border-[var(--bd)] bg-[var(--bg)] text-xs"
                        value={item.rate}
                        onChange={(e) => {
                          const next = [...invoice.items];
                          next[idx] = { ...item, rate: Math.max(0, Number(e.target.value)) };
                          setInvoice({ ...invoice, items: next });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setInvoice({
                            ...invoice,
                            items: invoice.items.filter((x) => x.id !== item.id),
                          })
                        }
                        className="col-span-1 text-rose-600 cursor-pointer flex justify-center"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">Currency</label>
                    <select
                      value={invoice.currency}
                      onChange={(e) =>
                        setInvoice({ ...invoice, currency: e.target.value as '₹' | '৳' | '$' })
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-[var(--bd)] bg-[var(--bg)] text-xs"
                    >
                      <option value="₹">₹ (INR)</option>
                      <option value="৳">৳ (BDT)</option>
                      <option value="$">$ (USD)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">Tax / GST (%)</label>
                    <input
                      type="number"
                      min={0}
                      value={invoice.taxPercent}
                      onChange={(e) =>
                        setInvoice({ ...invoice, taxPercent: Math.max(0, Number(e.target.value)) })
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-[var(--bd)] bg-[var(--bg)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">Discount</label>
                    <input
                      type="number"
                      min={0}
                      value={invoice.discount}
                      onChange={(e) =>
                        setInvoice({ ...invoice, discount: Math.max(0, Number(e.target.value)) })
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-[var(--bd)] bg-[var(--bg)] text-xs"
                    />
                  </div>
                </div>

                <textarea
                  rows={2}
                  className="w-full px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-xs"
                  value={invoice.notes}
                  onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })}
                  placeholder="Notes / Terms"
                />
              </div>
            )}

            {docType === 'salary-slip' && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold m-0">💰 স্যালারি স্লিপ / Salary Slip Maker</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Company Name"
                    value={salary.companyName}
                    onChange={(e) => setSalary({ ...salary, companyName: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Salary Month & Year"
                    value={salary.monthYear}
                    onChange={(e) => setSalary({ ...salary, monthYear: e.target.value })}
                  />
                  <input
                    className="sm:col-span-2 px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Company Address"
                    value={salary.companyAddress}
                    onChange={(e) => setSalary({ ...salary, companyAddress: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Employee Name"
                    value={salary.employeeName}
                    onChange={(e) => setSalary({ ...salary, employeeName: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Employee ID"
                    value={salary.employeeId}
                    onChange={(e) => setSalary({ ...salary, employeeId: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Designation"
                    value={salary.designation}
                    onChange={(e) => setSalary({ ...salary, designation: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Department"
                    value={salary.department}
                    onChange={(e) => setSalary({ ...salary, department: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { label: 'Basic', key: 'basic' as const },
                    { label: 'HRA', key: 'hra' as const },
                    { label: 'DA', key: 'da' as const },
                    { label: 'Conveyance', key: 'conveyance' as const },
                    { label: 'Bonus', key: 'bonus' as const },
                    { label: 'PF Deduction', key: 'pf' as const },
                    { label: 'PT Deduction', key: 'pt' as const },
                    { label: 'TDS', key: 'tds' as const },
                    { label: 'Other Deduction', key: 'otherDeduction' as const },
                  ].map((fld) => (
                    <div key={fld.key}>
                      <label className="block text-[11px] font-bold mb-0.5">{fld.label}</label>
                      <input
                        type="number"
                        min={0}
                        value={salary[fld.key]}
                        onChange={(e) =>
                          setSalary({ ...salary, [fld.key]: Math.max(0, Number(e.target.value)) })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--bd)] bg-[var(--bg)] text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {docType === 'application' && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold m-0">📝 দরখাস্ত তৈরি / Application Maker</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyAppTemplate('bn-leave')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg)] border border-[var(--bd)] hover:border-[#f57c00] cursor-pointer"
                  >
                    বাংলা ছুটির আবেদন
                  </button>
                  <button
                    type="button"
                    onClick={() => applyAppTemplate('bn-bank')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg)] border border-[var(--bd)] hover:border-[#f57c00] cursor-pointer"
                  >
                    বাংলা ব্যাংক আবেদন
                  </button>
                  <button
                    type="button"
                    onClick={() => applyAppTemplate('en-leave')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg)] border border-[var(--bd)] hover:border-[#f57c00] cursor-pointer"
                  >
                    English Leave Letter
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Date"
                    value={appData.date}
                    onChange={(e) => setAppData({ ...appData, date: e.target.value })}
                  />
                  <select
                    value={appData.language}
                    onChange={(e) =>
                      setAppData({ ...appData, language: e.target.value as 'bn' | 'en' })
                    }
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                  >
                    <option value="bn">বাংলা (Bengali Format)</option>
                    <option value="en">English Format</option>
                  </select>
                  <input
                    className="sm:col-span-2 px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="To (Recipient Title)"
                    value={appData.toTitle}
                    onChange={(e) => setAppData({ ...appData, toTitle: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Organization"
                    value={appData.toOrg}
                    onChange={(e) => setAppData({ ...appData, toOrg: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Address"
                    value={appData.toAddress}
                    onChange={(e) => setAppData({ ...appData, toAddress: e.target.value })}
                  />
                  <input
                    className="sm:col-span-2 px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Subject / বিষয়"
                    value={appData.subject}
                    onChange={(e) => setAppData({ ...appData, subject: e.target.value })}
                  />
                </div>

                <textarea
                  rows={5}
                  className="w-full px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                  placeholder="Body of the application..."
                  value={appData.body}
                  onChange={(e) => setAppData({ ...appData, body: e.target.value })}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Your Name"
                    value={appData.senderName}
                    onChange={(e) => setAppData({ ...appData, senderName: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Phone / Roll / ID"
                    value={appData.senderDetails}
                    onChange={(e) => setAppData({ ...appData, senderDetails: e.target.value })}
                  />
                </div>
              </div>
            )}

            {docType === 'visiting-card' && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold m-0">💳 ভিজিটিং কার্ড / Visiting Card Maker</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Full Name"
                    value={card.name}
                    onChange={(e) => setCard({ ...card, name: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Role / Designation"
                    value={card.role}
                    onChange={(e) => setCard({ ...card, role: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Company / Shop Name"
                    value={card.company}
                    onChange={(e) => setCard({ ...card, company: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Phone"
                    value={card.phone}
                    onChange={(e) => setCard({ ...card, phone: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Email"
                    value={card.email}
                    onChange={(e) => setCard({ ...card, email: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Website"
                    value={card.website}
                    onChange={(e) => setCard({ ...card, website: e.target.value })}
                  />
                  <input
                    className="sm:col-span-2 px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Address"
                    value={card.address}
                    onChange={(e) => setCard({ ...card, address: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold">Accent Color:</span>
                  {['#0f2a5c', '#1e40af', '#7c3aed', '#b91c1c', '#0f766e'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCard({ ...card, themeColor: c })}
                      className="w-7 h-7 rounded-full border-2 border-white shadow cursor-pointer"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}

            {docType === 'resume' && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold m-0">📄 বায়োডাটা / Resume Maker</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Full Name"
                    value={resume.fullName}
                    onChange={(e) => setResume({ ...resume, fullName: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Headline / Role"
                    value={resume.headline}
                    onChange={(e) => setResume({ ...resume, headline: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Phone"
                    value={resume.phone}
                    onChange={(e) => setResume({ ...resume, phone: e.target.value })}
                  />
                  <input
                    className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Email"
                    value={resume.email}
                    onChange={(e) => setResume({ ...resume, email: e.target.value })}
                  />
                  <input
                    className="sm:col-span-2 px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    placeholder="Address"
                    value={resume.address}
                    onChange={(e) => setResume({ ...resume, address: e.target.value })}
                  />
                </div>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-xs"
                  placeholder="Summary"
                  value={resume.summary}
                  onChange={(e) => setResume({ ...resume, summary: e.target.value })}
                />
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-xs"
                  placeholder="Experience"
                  value={resume.experience}
                  onChange={(e) => setResume({ ...resume, experience: e.target.value })}
                />
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-xs"
                  placeholder="Education"
                  value={resume.education}
                  onChange={(e) => setResume({ ...resume, education: e.target.value })}
                />
                <input
                  className="w-full px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-xs"
                  placeholder="Skills"
                  value={resume.skills}
                  onChange={(e) => setResume({ ...resume, skills: e.target.value })}
                />
                <input
                  className="w-full px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-xs"
                  placeholder="Languages"
                  value={resume.languages}
                  onChange={(e) => setResume({ ...resume, languages: e.target.value })}
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2.5 pt-2">
              <button
                type="button"
                disabled={downloading}
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-bold bg-[#f57c00] hover:bg-[#e06d00] text-white cursor-pointer"
              >
                <Download className="w-4 h-4" />
                {downloading ? 'Generating PDF...' : 'Download PDF'}
              </button>
              <button
                type="button"
                onClick={handleDownloadPng}
                className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold bg-[#0f2a5c] hover:bg-[#193d7f] text-white cursor-pointer"
              >
                Download PNG
              </button>
            </div>
          </div>

          {/* Live Preview Column */}
          <div className="lg:col-span-6 bg-[var(--bg)] border border-[var(--bd)] rounded-[16px] p-4 flex flex-col items-center">
            <div className="text-xs font-semibold text-[var(--mut)] mb-2">
              Live Document Preview (Ready for PDF Download)
            </div>
            <canvas
              ref={previewCanvasRef}
              className="w-full max-w-[460px] h-auto rounded shadow-md bg-white border border-slate-300"
            />
          </div>
        </div>

        <PrivacyNote />
      </section>
    </div>
  );
};
