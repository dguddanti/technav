export type RestroomKind = 'women' | 'men' | 'all';

// Restrooms on the floor plans, by the figure drawn in them; 'all' rooms have no figure.
// They are routable but are offered through the nearest-amenity options instead of the room search.
export const restrooms: Record<string, RestroomKind> = {
  AG81: 'women', AG82: 'men', EG31: 'women', EG47: 'men', FG28: 'all', KG25: 'women', KG39: 'men',
  LG51: 'men', LG79: 'women', MG31: 'men', MG69: 'women', MG85: 'women',
  A141: 'women', A181: 'women', A182: 'men', E131: 'women', E147: 'men', F128: 'men', K125: 'women',
  K139: 'men', L157: 'women', L169: 'men', M131: 'men', M135: 'women', M161: 'women', M173: 'women',
  A241: 'men', E237: 'women', E247: 'men', F230: 'women', F287: 'all', K225: 'women', K239: 'men',
  L281: 'women', L283: 'men', M231: 'men', M275: 'women',
  A380: 'women', A382: 'men', E347: 'men', E349: 'women', K325: 'women', K339: 'men', L319: 'men',
  L383: 'women', M331: 'men', M373: 'women',
  A480: 'men', A481: 'women', L451: 'women', L479: 'men', M433: 'men', M439: 'women',
};
