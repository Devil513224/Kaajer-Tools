export type CardTypeId =
  | 'aadhaar'
  | 'ration'
  | 'voter'
  | 'pan'
  | 'ayushman'
  | 'dl'
  | 'custom';

export interface CardTypeConfig {
  id: CardTypeId;
  hashSlug: string;
  name: string;
  bnName: string;
  shortDesc: string;
  instructions: string;
  instructionsBn: string;
  icon: string;
  gradient: string;
  widthMm: number;
  heightMm: number;
  cornerRadiusMm: number;
  hasFrontBack: boolean;
  supportsPaperPrintMode?: boolean;
  isNew?: boolean;
}

/**
 * Single configuration array for all Smart Card Crop types.
 * Add new card types here to automatically generate their hub cards and pages.
 */
export const CARD_TYPES_CONFIG: CardTypeConfig[] = [
  {
    id: 'aadhaar',
    hashSlug: 'card-aadhaar',
    name: 'Aadhaar Card Crop',
    bnName: 'আধার কার্ড ক্রপ',
    shortDesc: 'PVC 85.6 × 54 mm & e-Aadhaar Paper Print mode',
    instructions:
      'Upload Aadhaar front & back photos (or e-Aadhaar screenshot). Automatically aligns, removes background leakage, and prepares print & lamination A4 PDF.',
    instructionsBn:
      'আধার কার্ডের সামনে ও পেছনের ছবি আপলোড করুন। অটোমেটিক সোজা, পরিষ্কার এবং প্রিন্ট ও লেমিনেশন-রেডি A4 PDF তৈরি হবে।',
    icon: '🪪',
    gradient: 'linear-gradient(120deg, #0f2a5c, #2563eb)',
    widthMm: 85.6,
    heightMm: 54,
    cornerRadiusMm: 3.2,
    hasFrontBack: true,
    supportsPaperPrintMode: true,
    isNew: true,
  },
  {
    id: 'ration',
    hashSlug: 'card-ration',
    name: 'Ration Card Crop',
    bnName: 'রেশন কার্ড ক্রপ',
    shortDesc: 'Digital Ration Card front & back clean crop',
    instructions:
      'Photograph your Ration Card on any surface. Auto-crop removes table/cloth edges and brightens faded prints for clean lamination.',
    instructionsBn:
      'রেশন কার্ডের ছবি তুলুন বা আপলোড করুন। বাড়তি ব্যাকগ্রাউন্ড বাদ দিয়ে ঝকঝকে ও লেমিনেশনের উপযোগী কার্ড তৈরি হবে।',
    icon: '🌾',
    gradient: 'linear-gradient(120deg, #0d9488, #16a34a)',
    widthMm: 85.6,
    heightMm: 54,
    cornerRadiusMm: 3.2,
    hasFrontBack: true,
    isNew: true,
  },
  {
    id: 'voter',
    hashSlug: 'card-voter',
    name: 'Voter Card (EPIC) Crop',
    bnName: 'ভোটার কার্ড (EPIC) ক্রপ',
    shortDesc: 'New & old EPIC card auto straighten & print',
    instructions:
      'Upload Voter ID (EPIC) front and back photos. Automatically crops, whitens background edges, and pairs side-by-side on A4.',
    instructionsBn:
      'ভোটার আইডি (EPIC) কার্ডের সামনে ও পেছনের ছবি আপলোড করে সহজেই এক ক্লিকে A4 প্রিন্ট শিট বানান।',
    icon: '🗳️',
    gradient: 'linear-gradient(120deg, #4338ca, #7c3aed)',
    widthMm: 85.6,
    heightMm: 54,
    cornerRadiusMm: 3.2,
    hasFrontBack: true,
  },
  {
    id: 'pan',
    hashSlug: 'card-pan',
    name: 'PAN Card Crop',
    bnName: 'প্যান কার্ড ক্রপ',
    shortDesc: 'PAN Card crisp 300 DPI crop & shadow fix',
    instructions:
      'Cleanly crop PAN Card front & back with shadow removal and auto white-balance so hologram glare and desk colors are minimized.',
    instructionsBn:
      'প্যান কার্ডের ছবি থেকে ছায়া ও বাড়তি রঙ সরিয়ে ঝকঝকে প্রিন্ট-রেডি কার্ড তৈরি করুন।',
    icon: '💳',
    gradient: 'linear-gradient(120deg, #1d4ed8, #0ea5e9)',
    widthMm: 85.6,
    heightMm: 54,
    cornerRadiusMm: 3.2,
    hasFrontBack: true,
  },
  {
    id: 'ayushman',
    hashSlug: 'card-ayushman',
    name: 'Ayushman Card Crop',
    bnName: 'আয়ুষ্মান কার্ড ক্রপ',
    shortDesc: 'Ayushman Bharat / PM-JAY card print ready',
    instructions:
      'Upload Ayushman Bharat / Swasthya card photos (even multiple cards in one photo). Auto-detect crops each card accurately.',
    instructionsBn:
      'আয়ুষ্মান ভারত কার্ডের ছবি (একসাথে একাধিক কার্ড থাকলেও) অটো ডিটেক্ট করে প্রিন্ট ও লেমিনেশনের জন্য প্রস্তুত করুন।',
    icon: '🏥',
    gradient: 'linear-gradient(120deg, #b02a6e, #f57c00)',
    widthMm: 85.6,
    heightMm: 54,
    cornerRadiusMm: 3.2,
    hasFrontBack: true,
    isNew: true,
  },
  {
    id: 'dl',
    hashSlug: 'card-dl',
    name: 'Driving Licence Crop',
    bnName: 'ড্রাইভিং লাইসেন্স ক্রপ',
    shortDesc: 'Smart Driving Licence front & back A4 sheet',
    instructions:
      'Crop your Driving Licence front and back at exact 85.6 × 54 mm size with 2 mm or 3 mm lamination margin.',
    instructionsBn:
      'ড্রাইভিং লাইসেন্সের সামনে ও পেছনের অংশ সঠিক মাপে ক্রপ করে লেমিনেশন মার্জিনসহ A4 PDF ডাউনলোড করুন।',
    icon: '🚗',
    gradient: 'linear-gradient(120deg, #d97706, #ea580c)',
    widthMm: 85.6,
    heightMm: 54,
    cornerRadiusMm: 3.2,
    hasFrontBack: true,
  },
  {
    id: 'custom',
    hashSlug: 'card-custom',
    name: 'Other / Custom Card Crop',
    bnName: 'অন্যান্য / কাস্টম কার্ড ক্রপ',
    shortDesc: 'Any ID, Student, Health, Office card (custom mm)',
    instructions:
      'Set any custom width, height, and corner radius in millimeters (mm) for school IDs, office badges, or special cards.',
    instructionsBn:
      'স্কুল আইডি, অফিস কার্ড বা যেকোনো বিশেষ কার্ডের জন্য নিজের পছন্দমতো মাপ (mm) সেট করে ক্রপ করুন।',
    icon: '📐',
    gradient: 'linear-gradient(120deg, #334155, #0f2a5c)',
    widthMm: 85.6,
    heightMm: 54,
    cornerRadiusMm: 3.2,
    hasFrontBack: true,
  },
];
