import { restrooms } from './restrooms';
import type { RestroomKind } from './restrooms';

// Kinds of place a route can end at "the nearest one of". Add new kinds (water fountains, ...) here.
export interface Amenity {
  id: string;
  // Shown in To once chosen, and searchable there.
  label: string;
  // Shown on the quick-pick button and with the room number on arrival.
  name: string;
  // Extra words that find it in the To search.
  keywords: string;
  places: string[];
}

const restroomsFor = (kind: RestroomKind) => Object.keys(restrooms).filter((room) => restrooms[room] === kind || restrooms[room] === 'all');
const restroomWords = 'restroom bathroom toilet washroom wc 화장실';

export const amenities: Amenity[] = [
  { id: 'restroom-women', label: "Nearest women's room", name: "Women's room", keywords: `${restroomWords} ladies female 여자`, places: restroomsFor('women') },
  { id: 'restroom-men', label: "Nearest men's room", name: "Men's room", keywords: `${restroomWords} gents male 남자`, places: restroomsFor('men') },
];

// Places reached through an amenity rather than listed in the room search.
export const amenityPlaces = new Set(amenities.flatMap((amenity) => amenity.places));
