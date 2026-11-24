export interface PhotoSignaturePreset {
  id: string;
  name: string;
  bnName: string;
  category: 'photo' | 'signature' | 'custom';
  widthPx: number;
  heightPx: number;
  minKB: number;
  maxKB: number;
  format: 'jpeg' | 'png';
  isCustom?: boolean;
}

/**
 * Editable preset configuration for Photo + Signature Size Tool.
 * Add new presets or update dimensions/KB limits in this single array.
 */
export const PHOTO_SIGNATURE_PRESETS: PhotoSignaturePreset[] = [
  {
    id: 'photo-200x230',
    name: 'Photo 200 × 230 px (20–50 KB, JPG)',
    bnName: 'পাসপোর্ট/অনলাইন ফর্ম ফটো (২০–৫০ KB)',
    category: 'photo',
    widthPx: 200,
    heightPx: 230,
    minKB: 20,
    maxKB: 50,
    format: 'jpeg',
  },
  {
    id: 'sign-140x60',
    name: 'Signature 140 × 60 px (10–20 KB, JPG)',
    bnName: 'অনলাইন ফর্ম স্বাক্ষর (১০–২০ KB)',
    category: 'signature',
    widthPx: 140,
    heightPx: 60,
    minKB: 10,
    maxKB: 20,
    format: 'jpeg',
  },
  {
    id: 'photo-35x45mm',
    name: 'Photo 3.5 × 4.5 cm (413 × 531 px)',
    bnName: '৩.৫ × ৪.৫ সেমি স্ট্যান্ডার্ড ফটো',
    category: 'photo',
    widthPx: 413,
    heightPx: 531,
    minKB: 20,
    maxKB: 100,
    format: 'jpeg',
  },
  {
    id: 'job-photo-100x120',
    name: 'Job form photo 100 × 120 px',
    bnName: 'চাকরির ফর্ম ফটো (১০০ × ১২০ px)',
    category: 'photo',
    widthPx: 100,
    heightPx: 120,
    minKB: 10,
    maxKB: 30,
    format: 'jpeg',
  },
  {
    id: 'custom-size',
    name: 'Custom size (কাস্টম সাইজ)',
    bnName: 'নিজের মতো প্রস্থ, উচ্চতা ও KB দিন',
    category: 'custom',
    widthPx: 300,
    heightPx: 300,
    minKB: 15,
    maxKB: 60,
    format: 'jpeg',
    isCustom: true,
  },
];
