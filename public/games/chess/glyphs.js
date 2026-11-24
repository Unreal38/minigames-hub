// Small flat pictures of the six chess pieces for the HUD (name tags, move list, promotion picker, results).
// type 1 pawn .. 6 king; side 0 cream (White), 1 dark (Black).
const SHAPE = [null,
  '<circle cx="12" cy="7.4" r="3.7"/><path d="M8 18.2c.4-3.2 1.700-4.900 2.300-6.800h3.400c.6 1.900 1.900 3.600 2.300 6.800z"/>',
  '<path d="M7.200 18.200c-.2-4 1.300-5.700 3-7.600l-3.200 1.300-1.300-1.800 3.700-5.300 1.300-2 1.100 1.900c3.600.7 5.500 3.700 5.500 7.700v5.800z"/><circle cx="10.300" cy="7.700" r=".9" class="e"/>',
  '<path d="M12 5c2.700 2.100 4 4.100 4 6.100 0 1.500-.8 2.600-1.800 3.200l1.500 3.900H8.300l1.500-3.900c-1-.6-1.800-1.700-1.800-3.200 0-2 1.300-4 4-6.100z"/><circle cx="12" cy="3.500" r="1.500"/><path d="M13.800 7.600l-2.600 3.600" class="l"/>',
  '<path d="M6.300 3.800h2.700v2h1.700v-2h2.600v2h1.700v-2h2.700v5.100l-1.700 1.500v5.700l1.500 2.100H6.500L8 16.100v-5.700L6.300 8.900z"/>',
  '<path d="M4.300 7l3.300 5.200 1.700-6.900 2.700 6.400 2.700-6.400 1.700 6.900L19.700 7l-1.900 11.200H6.200z"/><circle cx="4.300" cy="6" r="1.300"/><circle cx="9.300" cy="4.200" r="1.300"/><circle cx="14.700" cy="4.200" r="1.300"/><circle cx="19.700" cy="6" r="1.300"/>',
  '<path d="M11 1.800h2v1.900h1.900v2H13v2.100c3.100-.5 5.700 1.300 5.700 4.100 0 2.200-1.500 4.200-1.600 6.300H6.900c-.1-2.100-1.600-4.100-1.600-6.300 0-2.800 2.600-4.600 5.700-4.100V5.700H9.100v-2H11z"/>',
];
// The bare shapes (24 x 24 box, no base), for bigger drawings such as the hub card.
export const pieceShape = type => SHAPE[type] + '<path d="M5.300 18.200h13.400l1 3H4.300z"/>';
export function pieceSvg(type, side, cls = '') {
  const fill = side ? '#4d362e' : '#fffaf0', ink = side ? '#20120d' : '#3b2219', eye = side ? '#f3e2bf' : '#3b2219';
  return `<svg class="ch-pc ${cls}" viewBox="0 0 24 24" aria-hidden="true"><g fill="${fill}" stroke="${ink}" stroke-width="1.5" stroke-linejoin="round">${SHAPE[type]
    .replace('class="e"', `fill="${eye}" stroke="none"`).replace('class="l"', `fill="none" stroke="${eye}" stroke-width="1.4" stroke-linecap="round"`)}<path d="M5.300 18.200h13.400l1 3H4.300z"/></g></svg>`;
}
