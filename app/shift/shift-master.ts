'use client';

export type OfficeMaster = {
  id: string;
  name: string;
  drivers: string[];
  courses: string[];
};

export const SHIFT_MASTER_KEY = 'unite-fleet-shift-master-v1';

export const DEFAULT_SHIFT_MASTER: OfficeMaster[] = [
  {
    id: 'matsusaka',
    name: '松阪営業所',
    drivers: ['清水國光', '清水光真', '徳田亮太', '横溝一泰', '中川昭治', '楠滝空杜', '真田拓海','福田華月', '垣内連','伊藤圭志','齋藤朋樹'],
    courses: ['Aコース', 'Bコース', 'Cコース', 'Dコース', 'Eコース', 'Fコース', 'Gコース', 'Hコース'],
  },
  {
    id: 'ise',
    name: '伊勢営業所',
    drivers: ['東真規', '勝村武史', '藤原颯士', '西田勇太','清水國光', '清水光真', '徳田亮太', '横溝一泰', '中川昭治', '楠滝空杜', '吉田健人'],
    courses: ['朝熊コース', '神久コース', '御薗コース', '高向コース'],
  },
  {
    id: 'iga',
    name: '伊賀営業所',
    drivers: ['山崎雅也', '辻本顕寛', '小倉祐司','吉田健人',],
    courses: ['赤目コース'],
  },
];

export function loadShiftMaster(): OfficeMaster[] {
  if (typeof window === 'undefined') return DEFAULT_SHIFT_MASTER;
  try {
    const saved = window.localStorage.getItem(SHIFT_MASTER_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_SHIFT_MASTER;
  } catch {
    return DEFAULT_SHIFT_MASTER;
  }
}

export function saveShiftMaster(data: OfficeMaster[]) {
  window.localStorage.setItem(SHIFT_MASTER_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event('shift-master-updated'));
}