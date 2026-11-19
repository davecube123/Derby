export const SEX = {
  cock: { label: 'Cock', male: true, hint: 'Adult male' },
  stag: { label: 'Stag', male: true, hint: 'Young male, under ~1 yr' },
  hen: { label: 'Hen', male: false, hint: 'Adult female' },
  pullet: { label: 'Pullet', male: false, hint: 'Young female, under ~1 yr' },
};

export const STATUS = {
  brood: 'Brood stock',
  active: 'Active / battle',
  growing: 'Growing out',
  sold: 'Sold',
  deceased: 'Deceased',
  reference: 'Reference only',
};

// Common gamefowl bloodlines in the Philippines. Users can add their own.
export const PRESET_LINES = [
  'Sweater', 'Kelso', 'Hatch', 'Yellow Legged Hatch', 'Roundhead', 'Boston Roundhead',
  'Lemon', 'Grey', 'Claret', 'Radio', 'Butcher', 'Whitehackle', 'Albany', 'Brownred',
  'McLean Hatch', 'Asil', 'Shamo', 'Thai', 'Black', 'Pumpkin',
];

export const FEATHER_COLORS = [
  'Red', 'Dark Red', 'Light Red', 'Black', 'Grey', 'Lemon', 'Pumpkin', 'Bulik',
  'Talisain', 'Abuhin', 'Puti (White)', 'Blue', 'Spangled', 'Brown Red', 'Ginger',
];

export const LEG_COLORS = ['Yellow', 'White', 'Green', 'Slate', 'Black', 'Blue', 'Straw'];

export const COMBS = ['Straight (single)', 'Pea', 'Dubbed', 'Rose', 'Walnut'];
