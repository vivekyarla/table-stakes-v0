// The guide. Coordinates are real (WGS84); markers are placed by Leaflet.
// Copy is placeholder for the Rox team to edit.
export const CITY = { name: 'San Francisco', short: 'SF' };

export const SPOTS = [
  {
    id: 'cotogna',
    name: 'Cotogna',
    neighborhood: 'Jackson Square',
    address: '490 Pacific Ave',
    kind: 'High-end Italian restaurant',
    handshakes: 3,
    lat: 37.79716, lon: -122.40262,
    photo: null,   // set to an image URL and it appears on the right of the entry
    line: 'The room where term sheets get toasted.',
    dealNotes: 'Closing dinners, four people at most. Loud enough that nobody overhears you, quiet enough that nobody leans in.',
    tip: 'Ask for a table on the brick wall, order the agnolotti for the table, and let the sommelier run the wine.',
    hours: 'Lunch & dinner · closed Sunday',
  },
];

export const RATING = {
  3: 'Worth the trip across town',
  2: 'Worth a detour',
  1: 'Good in its category',
};
