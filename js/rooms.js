// The house, room by room: what's on the shelves, what the walls look like, and how hard each room is.
//
// Each thing is [emoji, name] or [emoji, name, flags]. Flags:
//   big    sits on the floor or looks right drawn larger
//   decor  scenery only, never on the list
// Every emoji here is from Emoji 13.1 or earlier, so older phones draw them too.

export const ROOMS = [
  {
    id: 'closet',
    name: 'The hall closet',
    wall: { style: 'stripes', base: '#4d5a66', line: '#56646f' },
    shelf: { top: '#a2835f', face: '#7b5f41', edge: '#8f7150' },
    floor: { style: 'boards', base: '#5b4432', line: '#4a3627' },
    things: [
      ['🧥', 'Coat', 'big'], ['🧣', 'Scarf'], ['🧤', 'Gloves'], ['🧢', 'Cap'], ['🎩', 'Top hat'],
      ['👒', 'Sun hat'], ['🥾', 'Hiking boot', 'big'], ['👢', 'Rain boot', 'big'], ['👟', 'Sneaker', 'big'],
      ['👞', 'Dress shoe', 'big'], ['🩴', 'Flip-flop'], ['🧦', 'Socks'], ['☂️', 'Umbrella'],
      ['🌂', 'Folded umbrella'], ['🎒', 'Backpack', 'big'], ['👜', 'Handbag'], ['👛', 'Coin purse'],
      ['💼', 'Briefcase', 'big'], ['🕶️', 'Sunglasses'], ['👓', 'Glasses'], ['🔑', 'Keys'],
      ['🗝️', 'Old key'], ['🏈', 'Football'], ['⚾', 'Baseball'], ['🎾', 'Tennis ball'],
      ['🏸', 'Badminton racket'], ['🥏', 'Frisbee'], ['⛸️', 'Ice skate', 'big'], ['🛷', 'Sled', 'big'],
      ['🧳', 'Suitcase', 'big'], ['🦺', 'Safety vest'], ['🎫', 'Ticket'],
      ['🧶', 'Ball of yarn'], ['📦', 'Box', 'big'], ['🥊', 'Boxing glove'], ['🪁', 'Kite'],
    ],
  },
  {
    id: 'pantry',
    name: 'The pantry',
    wall: { style: 'plain', base: '#6a5a45', line: '#735f48' },
    shelf: { top: '#c9b79a', face: '#a38f70', edge: '#b39f80' },
    floor: { style: 'tiles', base: '#6d625a', line: '#5a504a' },
    things: [
      ['🥫', 'Can of soup'], ['🍯', 'Honey'], ['🧂', 'Salt'], ['🥖', 'Baguette'], ['🍞', 'Bread'],
      ['🧀', 'Cheese'], ['🍎', 'Red apple'], ['🍏', 'Green apple'], ['🍋', 'Lemon'], ['🍊', 'Orange'],
      ['🥔', 'Potato'], ['🧄', 'Garlic'], ['🧅', 'Onion'], ['🥕', 'Carrot'], ['🌽', 'Corn'],
      ['🍪', 'Cookie'], ['🍫', 'Chocolate'], ['🍬', 'Candy'], ['🍭', 'Lollipop'], ['🥜', 'Peanuts'],
      ['🌰', 'Chestnut'], ['☕', 'Coffee'], ['🫖', 'Teapot'], ['🍵', 'Tea'], ['🧃', 'Juice box'],
      ['🥛', 'Milk'], ['🍾', 'Bottle'], ['🍷', 'Wine'], ['🥚', 'Egg'], ['🍌', 'Banana'],
      ['🥥', 'Coconut'], ['🍍', 'Pineapple'], ['🥨', 'Pretzel'], ['🥐', 'Croissant'], ['🧈', 'Butter'],
      ['🥣', 'Bowl'], ['🥄', 'Spoon'], ['🍴', 'Fork and knife'], ['🍳', 'Frying pan'], ['🍇', 'Grapes'],
      ['🍒', 'Cherries'], ['🧁', 'Cupcake'], ['🥧', 'Pie'], ['🍩', 'Doughnut'], ['🍉', 'Watermelon'],
    ],
  },
  {
    id: 'kids',
    name: 'The kids’ room',
    wall: { style: 'dots', base: '#3f5d6e', line: '#4b6b7c' },
    shelf: { top: '#e2d8c6', face: '#bdb09a', edge: '#cfc3ae' },
    floor: { style: 'rug', base: '#6b3f4a', line: '#7a4b56' },
    things: [
      ['🧸', 'Teddy bear', 'big'], ['🪀', 'Yo-yo'], ['🎈', 'Balloon'], ['🎲', 'Die'], ['🧩', 'Puzzle piece'],
      ['🚂', 'Train'], ['🚗', 'Car'], ['🚓', 'Police car'], ['🚒', 'Fire engine'], ['🚜', 'Tractor'],
      ['✈️', 'Airplane'], ['🚀', 'Rocket'], ['🦖', 'T. rex'], ['🦕', 'Long-neck dinosaur'], ['🤖', 'Robot'],
      ['👾', 'Space alien'], ['🎨', 'Paint palette'], ['🖍️', 'Crayon'], ['📚', 'Books'], ['🪆', 'Nesting doll'],
      ['🎺', 'Trumpet'], ['🥁', 'Drum', 'big'], ['⚽', 'Soccer ball'], ['🏀', 'Basketball'], ['🎮', 'Game controller'],
      ['🕹️', 'Joystick'], ['🦄', 'Unicorn'], ['🐢', 'Turtle'], ['🦆', 'Rubber duck'], ['🐙', 'Octopus'],
      ['🎁', 'Present'], ['👑', 'Crown'], ['🪄', 'Magic wand'], ['🔮', 'Crystal ball'], ['🎯', 'Dartboard'],
      ['🛹', 'Skateboard', 'big'], ['🪃', 'Boomerang'], ['🐳', 'Whale'], ['🦒', 'Giraffe'], ['🐞', 'Ladybug'],
      ['🧃', 'Juice box'], ['🎀', 'Bow'],
    ],
  },
  {
    id: 'bathroom',
    name: 'The bathroom',
    wall: { style: 'tiles', base: '#5f7775', line: '#6c8583' },
    shelf: { top: '#e8e6df', face: '#c5c2b8', edge: '#d8d5cc' },
    floor: { style: 'checks', base: '#5a6160', line: '#4a504f' },
    things: [
      ['🧴', 'Lotion'], ['🧼', 'Soap'], ['🪥', 'Toothbrush'], ['🪒', 'Razor'], ['🧽', 'Sponge'],
      ['🧻', 'Toilet paper'], ['🩹', 'Bandage'], ['💊', 'Pill'], ['🌡️', 'Thermometer'], ['💄', 'Lipstick'],
      ['🧷', 'Safety pin'], ['🦆', 'Rubber duck'], ['🪞', 'Hand mirror'], ['🧺', 'Basket', 'big'], ['🪠', 'Plunger', 'big'],
      ['🩺', 'Stethoscope'], ['💉', 'Syringe'], ['✂️', 'Scissors'], ['🕯️', 'Candle'], ['🌸', 'Cherry blossom'],
      ['🌷', 'Tulip'], ['🐚', 'Seashell'], ['🪴', 'Potted plant', 'big'], ['💍', 'Ring'], ['💎', 'Gem'],
      ['📿', 'Beads'], ['⌚', 'Watch'], ['🥽', 'Swim goggles'], ['🩱', 'Swimsuit'], ['🩳', 'Shorts'],
      ['👙', 'Bikini'], ['🎀', 'Hair bow'], ['🧊', 'Ice cube'], ['🍋', 'Lemon'], ['🌵', 'Cactus'],
      ['🐠', 'Toy fish'], ['🪣', 'Bucket', 'big'], ['🧹', 'Broom', 'big'], ['🦷', 'Tooth'],
    ],
  },
  {
    id: 'garage',
    name: 'The garage',
    wall: { style: 'pegboard', base: '#6e5b40', line: '#3c3124' },
    shelf: { top: '#8d949a', face: '#62696f', edge: '#767d83' },
    floor: { style: 'concrete', base: '#55585a', line: '#4a4d4f' },
    things: [
      ['🔧', 'Wrench'], ['🔨', 'Hammer'], ['🪛', 'Screwdriver'], ['🪚', 'Saw'], ['🔩', 'Nut and bolt'],
      ['⚙️', 'Gear'], ['🧰', 'Toolbox', 'big'], ['🪜', 'Ladder', 'big'], ['🪣', 'Bucket', 'big'], ['🧯', 'Fire extinguisher', 'big'],
      ['🧲', 'Magnet'], ['🪝', 'Hook'], ['⛓️', 'Chain'], ['🔌', 'Plug'], ['🔗', 'Link'],
      ['🪓', 'Axe'], ['⛏️', 'Pickaxe'], ['🛠️', 'Hammer and wrench'], ['🗜️', 'Clamp'], ['📏', 'Ruler'],
      ['🛢️', 'Oil drum', 'big'], ['🚲', 'Bicycle', 'big'], ['🛴', 'Scooter', 'big'], ['🥽', 'Goggles'], ['🦺', 'Safety vest'],
      ['🪤', 'Mousetrap'], ['🧹', 'Broom', 'big'], ['🧽', 'Sponge'], ['🪵', 'Log'], ['🧱', 'Brick'],
      ['🎣', 'Fishing rod'], ['💡', 'Light bulb'], ['🔦', 'Flashlight'], ['🪢', 'Rope'], ['🗑️', 'Trash can', 'big'],
      ['📦', 'Box', 'big'], ['⛺', 'Tent', 'big'], ['🏐', 'Volleyball'], ['🧤', 'Work gloves'], ['🪨', 'Rock'],
    ],
  },
  {
    id: 'office',
    name: 'The study',
    wall: { style: 'panels', base: '#4c3f37', line: '#3f342d' },
    shelf: { top: '#6e4b35', face: '#553824', edge: '#62432e' },
    floor: { style: 'rug', base: '#3d4a5c', line: '#485668' },
    things: [
      ['📎', 'Paperclip'], ['🖇️', 'Two paperclips'], ['📌', 'Pushpin'], ['📍', 'Round pin'], ['✂️', 'Scissors'],
      ['📏', 'Ruler'], ['📐', 'Set square'], ['🖊️', 'Pen'], ['🖋️', 'Fountain pen'], ['✏️', 'Pencil'],
      ['🖌️', 'Paintbrush'], ['📒', 'Ledger'], ['📓', 'Notebook'], ['📕', 'Red book'], ['📗', 'Green book'],
      ['📘', 'Blue book'], ['📙', 'Orange book'], ['💾', 'Floppy disk'], ['💿', 'CD'], ['📀', 'DVD'],
      ['🖨️', 'Printer', 'big'], ['⌨️', 'Keyboard'], ['🖱️', 'Mouse'], ['☎️', 'Telephone'], ['📠', 'Fax machine'],
      ['📷', 'Camera'], ['⏰', 'Alarm clock'], ['📁', 'Folder'], ['📋', 'Clipboard'], ['🗃️', 'Card box'],
      ['🔍', 'Magnifying glass'], ['✉️', 'Envelope'], ['🗓️', 'Calendar'], ['🧮', 'Abacus'], ['🔖', 'Bookmark'],
      ['🏷️', 'Tag'], ['🪙', 'Coin'], ['🧾', 'Receipt'], ['💻', 'Laptop', 'big'], ['📻', 'Radio'],
      ['🧭', 'Compass'], ['⌛', 'Hourglass'], ['🌍', 'Globe'], ['🗄️', 'Filing cabinet', 'big'], ['📚', 'Books', 'big'],
    ],
  },
  {
    id: 'attic',
    name: 'The attic',
    wall: { style: 'planks', base: '#4a3a2c', line: '#3a2d21' },
    shelf: { top: '#7a6048', face: '#5a4533', edge: '#6a523d' },
    floor: { style: 'boards', base: '#4b3a2b', line: '#3b2d21' },
    webs: true,
    things: [
      ['📦', 'Box', 'big'], ['🧳', 'Suitcase', 'big'], ['🕰️', 'Mantel clock'], ['🪞', 'Mirror'], ['🖼️', 'Painting'],
      ['🎻', 'Violin'], ['🎸', 'Guitar', 'big'], ['🪕', 'Banjo'], ['🎺', 'Trumpet'], ['🪗', 'Accordion'],
      ['📻', 'Radio'], ['📼', 'Videotape'], ['📷', 'Camera'], ['🕯️', 'Candle'], ['🧵', 'Spool of thread'],
      ['🪡', 'Needle'], ['🧶', 'Yarn'], ['🪆', 'Nesting doll'], ['🏺', 'Vase'], ['🗿', 'Stone head'],
      ['🎭', 'Masks'], ['🎃', 'Jack-o’-lantern'], ['🦇', 'Bat'], ['🕷️', 'Spider'], ['🐁', 'Mouse'],
      ['⏳', 'Hourglass'], ['🧸', 'Old teddy'], ['🪑', 'Chair', 'big'], ['🏮', 'Paper lantern'], ['🪔', 'Oil lamp'],
      ['🔮', 'Crystal ball'], ['📜', 'Scroll'], ['🗺️', 'Map'], ['🧭', 'Compass'], ['⚱️', 'Urn'],
      ['🗝️', 'Old key'], ['💰', 'Money bag'], ['👑', 'Crown'], ['💎', 'Gem'], ['🎩', 'Top hat'],
      ['♟️', 'Chess pawn'], ['🃏', 'Joker card'], ['🪄', 'Magic wand'], ['🦉', 'Stuffed owl'], ['🥁', 'Drum', 'big'],
    ],
  },
];

// Things that are easy to mix up in the dark. In the harder rooms, both of a pair can be on the shelves at once.
export const LOOKALIKES = [
  ['🔑', '🗝️'], ['👢', '🥾'], ['☂️', '🌂'], ['👛', '👜'], ['🧢', '👒'], ['🏈', '🥊'], ['👞', '👟'],
  ['🍎', '🍏'], ['🍋', '🍊'], ['🍵', '☕'], ['🥄', '🍴'], ['🍷', '🍾'], ['🥐', '🥨'], ['🍩', '🍪'], ['🧄', '🧅'],
  ['🦖', '🦕'], ['🚓', '🚗'], ['🎮', '🕹️'], ['⚽', '🏀'], ['🪄', '🔮'], ['🦆', '🐢'], ['🎁', '🎀'],
  ['💊', '🩹'], ['🧴', '🧼'], ['💍', '💎'], ['🌸', '🌷'], ['💉', '🌡️'], ['🩱', '👙'], ['🪥', '🪒'],
  ['🔧', '🛠️'], ['🔩', '⚙️'], ['⛏️', '🪓'], ['🔗', '⛓️'], ['🪛', '🔨'], ['🧹', '🪜'], ['🧯', '🛢️'],
  ['📎', '🖇️'], ['📌', '📍'], ['📏', '📐'], ['🖊️', '🖋️'], ['📕', '📙'], ['📗', '📘'], ['💿', '📀'],
  ['☎️', '📠'], ['📁', '🗃️'], ['📒', '📓'], ['⌛', '🧭'], ['✏️', '🖌️'],
  ['🎸', '🪕'], ['🎻', '🎸'], ['🐁', '🦇'], ['🏮', '🪔'], ['📜', '🗺️'], ['🕰️', '⏳'], ['🏺', '⚱️'], ['🎭', '🗿'],
];

export const BATTERY = ['🔋', 'Battery'];

// How each room plays, from the first to the last.
//   targets   how many things are on its list
//   batteries spare batteries hidden in it
//   density   how tightly the shelves are packed (1 = normal)
//   scale     how big things are drawn (1 = normal)
//   tucked    share of list things put at the back of a shelf, behind others
//   lookalikes whether a list thing's look-alike can be on the shelves too
export const DIFFICULTY = [
  { targets: 4, batteries: 2, density: 0.72, scale: 1.12, tucked: 0, lookalikes: false },
  { targets: 5, batteries: 1, density: 0.82, scale: 1.05, tucked: 0, lookalikes: false },
  { targets: 5, batteries: 1, density: 0.9, scale: 1.0, tucked: 0.2, lookalikes: true },
  { targets: 5, batteries: 1, density: 0.95, scale: 0.96, tucked: 0.2, lookalikes: true },
  { targets: 6, batteries: 1, density: 1.0, scale: 0.94, tucked: 0.34, lookalikes: true },
  { targets: 6, batteries: 1, density: 1.05, scale: 0.9, tucked: 0.34, lookalikes: true },
  { targets: 6, batteries: 1, density: 1.1, scale: 0.88, tucked: 0.5, lookalikes: true },
];

export function lookalikeOf(emoji) {
  const out = [];
  for (const [a, b] of LOOKALIKES) {
    if (a === emoji) out.push(b);
    else if (b === emoji) out.push(a);
  }
  return out;
}
