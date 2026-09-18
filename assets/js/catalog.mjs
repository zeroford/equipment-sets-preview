/**
 * ของที่ "fix ตาม slot / grade" อยู่แล้ว — ไม่ต้องเก็บซ้ำในชีต
 *
 * - ชื่อของ ผูกกับ (slot, grade)
 * - base stat ผูกกับ slot
 *
 * NOTE: substat ไม่ได้ผูกกับ slot (slot เดียวออกได้หลายแบบ) เลยยังต้องเก็บในชีต
 *
 * ‼️ ไฟล์นี้ generate จาก data/oven-tool-v1.json — อย่าแก้มือ
 *    แก้แล้วรัน: node tools/build-catalog.mjs
 *    source: CookieRun: Crumble APK decoded tables 1.2.002
 */
import { SLOT_TYPES } from './constants.mjs';

/** grade code (1–10) → key; 9 = legendary, 10 = eternal */
export const GRADE_KEYS = [
  'normal',
  'advanced',
  'fine',
  'magic',
  'epic',
  'special',
  'superepic',
  'unique',
  'legendary',
  'eternal',
];

/** slot (1–12) → stat id ของ base stat */
export const BASE_STAT_BY_SLOT = [
  'atk', // 1 sword
  'accuracy', // 2 bow
  'critRate', // 3 staff
  'def', // 4 helmet
  'hp', // 5 armor
  'evasion', // 6 shield
  'critRes', // 7 necklace
  'focus', // 8 ring
  'resistance', // 9 brooch
  'critDmg', // 10 artifact
  'skillAmp', // 11 book
  'dmgReduction', // 12 food
];

/** slot (1–12) → { grade key: ชื่อของ } */
export const ITEM_NAMES = [
  // 1 sword
  {
    normal: "GingerBrave's Candy Cane",
    advanced: "Blacksmith's Pickaxe",
    fine: 'Avocado Sword',
    magic: "Rogue's Spicy Dagger",
    epic: 'Raspberry Sword',
    special: 'Strawberry Jam Sword',
    superepic: 'Frozen Sea Dagger',
    unique: 'Giant Sonic Embroider',
    legendary: "Ruthless Red Dragon's Greatsword",
    eternal: 'Axe-Spear of Blind Destruction',
  },
  // 2 bow
  {
    normal: 'Toy Slingshot',
    advanced: 'Ninja Shuriken',
    fine: 'Cherry Bomb',
    magic: 'Throwing Spear',
    epic: 'Organic Ryevolver',
    special: 'Bow of Love',
    superepic: 'Blessed Silver Fork Crossbow',
    unique: "Divine Archer's Bow Sword",
    legendary: "Sovereign's Radiant Spear",
    eternal: 'Resplendent Wind Guardian',
  },
  // 3 staff
  {
    normal: "GingerBright's Lollipop",
    advanced: 'Caramel Apple Staff',
    fine: 'Magic Candy Staff',
    magic: 'Cream Puff Star Wand',
    epic: 'Gloomy Matcha Staff',
    special: 'Witchberry Fork',
    superepic: 'Sacred Purifying Whisk',
    unique: 'Blazing Wildfire',
    legendary: 'Bitter Frost Storm',
    eternal: 'Dreaming Moon',
  },
  // 4 helmet
  {
    normal: 'Blueberry Ribbon',
    advanced: 'Gnome Hat',
    fine: 'Meringue Earmuffs',
    magic: "Knight's Helmet",
    epic: 'Breadcopter Hat',
    special: 'Cat Ear Headset',
    superepic: 'Silver Infuser Helmet',
    unique: 'Crimson Dragon Helmet',
    legendary: "Healer's Hat",
    eternal: 'Helmet of Silence',
  },
  // 5 armor
  {
    normal: 'Loose Tank Top',
    advanced: 'Cute Sailor Outfit',
    fine: 'Custard Cloak',
    magic: "Princess's Dress",
    epic: 'Pistachio Armor',
    special: 'Dark Choco Armor',
    superepic: 'Silver Infuser Armor',
    unique: "Starlight Traveler's Cloak",
    legendary: 'Proud Dragon Eye Armor',
    eternal: "Awakened Dragon Lord's Armor",
  },
  // 6 shield
  {
    normal: 'Wooden Shield',
    advanced: 'Avocado-shaped Shield',
    fine: 'Checkered Shield',
    magic: 'Pistachio Shield',
    epic: 'Green Tea Mousse Shield',
    special: 'Solid Stone Shield',
    superepic: 'Sacred Milk Shield',
    unique: "Resplendent Commander's Shield",
    legendary: "Awakened Dragon Lord's Shield",
    eternal: 'Hollyberry Shield',
  },
  // 7 necklace
  {
    normal: 'Dog Collar',
    advanced: "Wizard's Scarf",
    fine: 'Fang Necklace',
    magic: 'Jelly Worm Necklace',
    epic: 'Crystal Necklace',
    special: 'Eternal Friendship Necklace',
    superepic: "Conductor's Starlight Whistle",
    unique: 'Magma Pendulum',
    legendary: 'Subtle Fragrant Remedy',
    eternal: 'Endless Void Necklace',
  },
  // 8 ring
  {
    normal: 'Wooden Ring',
    advanced: 'Candy Gem Ring',
    fine: 'Clover Ring',
    magic: 'Yellow Bear Jelly Ring',
    epic: 'Ring of Eternal Flame',
    special: 'Solid Bond Ring',
    superepic: 'Bangle of Abundance',
    unique: 'Giant Bear Jelly Gem Ring',
    legendary: 'Sacred Millennial Glory',
    eternal: 'Eternally Sweet Paradise',
  },
  // 9 brooch
  {
    normal: 'Worn Skull Button',
    advanced: 'Cola Bottle Cap',
    fine: 'Simple Wildflower Brooch',
    magic: 'Coco Drop Brooch',
    epic: 'Cross Brooch',
    special: 'Scorpion Tail Brooch',
    superepic: 'Apricot Jam Syndicate Brooch',
    unique: "Guardian's Brooch",
    legendary: 'Brooch of Primordial Light',
    eternal: 'Light of Deceit',
  },
  // 10 artifact
  {
    normal: 'Small Crystal Orb',
    advanced: 'Bread Cat Doll',
    fine: 'Rune-engraved Mana Stone',
    magic: 'Squishy Jelly Watch',
    epic: 'Lemon Cube',
    special: 'Sugar Swan Coin',
    superepic: 'Golden Drop Statue',
    unique: 'Writhing Gaze of the Abyss',
    legendary: 'Darkness-Imbued Skull',
    eternal: "Free Explorer's Lily",
  },
  // 11 book
  {
    normal: 'Tattered Map',
    advanced: 'Perfect Landing Book',
    fine: "Maid's Secret Diary",
    magic: 'Secret Research Journal',
    epic: "Popular Idol's Photocard",
    special: 'Script of Deceit',
    superepic: "Blue Librarian's Book",
    unique: 'Forbidden Tome',
    legendary: "Pilgrim's Martial Arts Manual",
    eternal: 'Ultimate Recipe Book',
  },
  // 12 food
  {
    normal: 'Wild Berry',
    advanced: 'Poison Mushroom Skewer',
    fine: 'Simple Rice Ball',
    magic: 'Energy Drink',
    epic: 'Sprinkled Doughnut',
    special: 'Bear Jelly Burger',
    superepic: 'Delicious Omurice',
    unique: 'Premium Grape Juice',
    legendary: 'Cherry Bomb Cake',
    eternal: 'Rainbow Ginseng',
  },
];

/** ชีตเก็บ grade เป็นเลข (9/10) — รับ key ตรงๆ ก็ได้ */
export function resolveGrade(raw) {
  const key = String(raw).trim().toLowerCase();
  const code = Number(key);
  if (code >= 1 && code <= GRADE_KEYS.length) {
    return GRADE_KEYS[code - 1];
  }
  return GRADE_KEYS.includes(key) ? key : GRADE_KEYS[GRADE_KEYS.length - 2];
}

/** grade → เลข tier ในชื่อไฟล์ไอคอน (legendary → '09') */
export function gradeTier(grade) {
  const index = GRADE_KEYS.indexOf(grade);
  return String(index < 0 ? GRADE_KEYS.length : index + 1).padStart(2, '0');
}

export function baseStatForSlot(slot) {
  return BASE_STAT_BY_SLOT[slot - 1] || '';
}

/** ไม่มีในตาราง (ของใหม่) → คืนชื่อ slot ไว้ก่อน ไม่ให้การ์ดว่าง */
export function itemNameFor(slot, grade) {
  const entry = ITEM_NAMES[slot - 1] || {};
  return entry[grade] || SLOT_TYPES[slot - 1] || '';
}
