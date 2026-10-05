import type { ObjectSpec, Size } from "../../components/clump/model";
import type { EmojiOption, Gift } from "./types";

const entries = [
  // Existing curated list
  ["popcorn", "🍿", "Popcorn", "movie cinema snack film watching food"],
  ["heart", "❤️", "Red Heart", "love affection care kind romance like favorite"],
  ["orange_heart", "🧡", "Orange Heart", "love warm care affection"],
  ["yellow_heart", "💛", "Yellow Heart", "friendship warmth sunny affection"],
  ["green_heart", "💚", "Green Heart", "nature peace health eco"],
  ["blue_heart", "💙", "Blue Heart", "trust harmony loyalty calm"],
  ["purple_heart", "💜", "Purple Heart", "compassion nobility kindness"],
  ["black_heart", "🖤", "Black Heart", "dark edgy chic grief"],
  ["white_heart", "🤍", "White Heart", "pure peace clean angel"],
  ["sparkling_heart", "💖", "Sparkling Heart", "sparkle affection glitter excited love"],
  ["growing_heart", "💗", "Growing Heart", "love expanding flutter warm"],
  ["broken_heart", "💔", "Broken Heart", "sad heartbreak sorrow breakup"],
  ["flower", "🌷", "Tulip", "flower spring beautiful gratitude bouquet nature"],
  ["rose", "🌹", "Rose", "romance love flowers romantic red garden"],
  ["sunflower", "🌻", "Sunflower", "happy cheerful yellow flower gratitude sun summer"],
  ["cherry_blossom", "🌸", "Cherry Blossom", "sakura spring flower pink japan aesthetic"],
  ["bouquet", "💐", "Bouquet", "flowers gift congratulations wedding romantic celebration"],
  ["sparkles", "✨", "Sparkles", "magic wonderful special shiny impressive sparkle clean"],
  ["coffee", "☕", "Coffee", "caffeine morning work warm drink espresso latte cafe tea"],
  ["tea", "🍵", "Tea", "tea matcha calm warm drink herbal relax zen green tea"],
  ["boba", "🧋", "Boba", "bubble tea milk boba tapioca sweet drink"],
  ["beer", "🍺", "Beer", "brew alcohol drink cheers bar pint pub"],
  ["beers", "🍻", "Clinking beers", "cheers toast celebration pub friends party drinks"],
  ["wine", "🍷", "Wine glass", "wine red alcohol toast drink dinner fancy"],
  ["cocktail", "🍸", "Cocktail", "martini bar party lounge drink alcohol"],
  ["octopus", "🐙", "Octopus", "ocean tentacles sea clever cephalopod marine"],
  ["computer", "🖥️", "Computer", "coding programming software desktop technology monitor pc work"],
  ["laptop", "💻", "Laptop", "macbook portable computer work coding dev engineer technology"],
  ["phone", "📱", "Mobile phone", "smartphone iphone android mobile call screen call"],
  ["keyboard", "⌨️", "Keyboard", "typing coding gamer mechanical computer tech"],
  ["shoes", "👟", "Sneaker", "walk walking run exercise shoe sneaker athletic sport"],
  ["globe", "🌍", "Globe", "world earth travel planet global international map geography"],
  ["plant", "🪴", "Plant", "monstera green growth garden growing potted houseplant flora"],
  ["cloud", "☁️", "Cloud", "sky dream dreaming weather hosting internet cloud compute"],
  ["bike", "🚲", "Bicycle", "cycling bike ride outdoors commute travel exercise"],
  ["boots", "🥾", "Hiking boot", "climbing mountain adventure hiking outdoors trail"],
  ["light", "💡", "Light bulb", "idea inspiration creative smart brainstorm solution energy"],
  ["case", "💼", "Briefcase", "work job career business professional portfolio"],
  ["gift", "🎁", "Present", "gift surprise birthday giving box holiday christmas ribbon"],
  ["cake", "🎂", "Cake", "birthday celebration sweet baking dessert party frosted"],
  ["party", "🎉", "Party popper", "celebration congratulations congrats hooray party yay festival"],
  ["balloon", "🎈", "Balloon", "party celebrate float cheerful birthday red"],
  ["confetti", "🎊", "Confetti", "success celebrate achievement celebration party"],
  ["star", "⭐", "Star", "excellent favorite awesome achievement yellow sky rating"],
  ["glowing_star", "🌟", "Glowing Star", "sparkle bright magic star shine shine radiant"],
  ["sun", "☀️", "Sun", "happy sunny warm summer bright day sunshine morning"],
  ["moon", "🌙", "Crescent Moon", "night quiet sleep evening dreamy dark space lunar bedtime"],
  ["full_moon", "🌕", "Full moon", "night space moon lunar phase sky astronomy"],
  ["rainbow", "🌈", "Rainbow", "hope colorful pride joy sky weather nature spectrum"],
  ["rain", "🌧️", "Rain cloud", "rainy sad melancholy cozy weather drizzle storm shower"],
  ["snow", "❄️", "Snowflake", "cold winter snow ice unique frozen weather chilly"],
  ["fire", "🔥", "Fire", "hot amazing cool impressive lit energy blaze warmth heat flame"],
  ["water", "💧", "Water drop", "thirst hydrate fresh rain water sweat moisture clean drip"],
  ["wave", "🌊", "Ocean wave", "surf beach ocean sea flow water coast tsunami swell"],
  ["mountain", "🏔️", "Snow mountain", "climb hiking alpine adventure challenge peak summit nature cold"],
  ["island", "🏝️", "Island", "vacation relax beach tropical holiday palm summer ocean paradise"],
  ["tent", "⛺", "Tent", "camp camping wilderness outdoors adventure hike nature wood"],
  ["rocket", "🚀", "Rocket", "launch ship fast startup space ambitious takeoff boost explore"],
  ["satellite", "🛰️", "Satellite", "space internet orbit signal technology science communication"],
  ["ufo", "🛸", "Flying saucer", "alien weird space unusual mystery sci-fi saucer extraterrestrial"],
  ["airplane", "✈️", "Airplane", "travel flight journey trip flying vacation aircraft airport"],
  ["train", "🚂", "Train", "rail travel steam journey locomotive commute track"],
  ["car", "🚗", "Car", "automobile drive commute travel vehicle road trip transport"],
  ["boat", "⛵", "Sailboat", "sailing sea voyage boat breeze ocean water lake yacht"],
  ["house", "🏠", "House", "home cozy welcome family building shelter residence"],
  ["castle", "🏰", "Castle", "fairytale medieval fantasy kingdom fortress historic magic"],
  ["key", "🔑", "Key", "unlock home access solution secret security password safe"],
  ["lock", "🔒", "Lock", "secure privacy locked security safe key closed safety"],
  ["books", "📚", "Books", "reading literature knowledge learn study library education reader"],
  ["book", "📖", "Open book", "story reading writing novel learn textbook literature novel"],
  ["pencil", "✏️", "Pencil", "write draw sketch creative draft edit school note"],
  ["paint", "🎨", "Paint palette", "art artist design color creative draw painting visual style"],
  ["camera", "📷", "Camera", "photo photography memory capture snapshot picture lens"],
  ["music", "🎵", "Musical note", "music song melody singing sound tune audio beat"],
  ["notes", "🎶", "Multiple notes", "music song melody tune harmony soundtrack rhythm audio"],
  ["guitar", "🎸", "Guitar", "music rock band play instrument acoustic electric acoustic strings"],
  ["headphones", "🎧", "Headphones", "listen music podcast focus sound beats earphone audio track"],
  ["game", "🎮", "Game controller", "gaming videogame play fun console joypad gamer playstation xbox"],
  ["dice", "🎲", "Dice", "random chance luck boardgame gamble game roll risk fortune"],
  ["puzzle", "🧩", "Puzzle piece", "problem solution fit logic mystery puzzle jigsaw solve clue"],
  ["yarn", "🧶", "Yarn", "knitting craft thread cozy crochet wool ball sew handmade"],
  ["teddy", "🧸", "Teddy bear", "hug comfort cute cuddly friend toy soft plushie childhood"],
  ["candle", "🕯️", "Candle", "peace cozy memory warmth light wax flame zen prayer gentle"],
  ["gem", "💎", "Gem", "precious diamond brilliant valuable crystal jewelry stone shine rich luxury"],
  ["trophy", "🏆", "Trophy", "winner success best award achievement champion cup victory first"],
  ["medal", "🥇", "Gold medal", "first champion achievement proud winner victory prize 1st place"],
  ["clover", "🍀", "Four-leaf clover", "luck good luck lucky fortune irish st patrick nature green"],
  ["seedling", "🌱", "Seedling", "growth beginning new nature potential sprout baby leaf plant initial"],
  ["tree", "🌳", "Tree", "forest nature roots strong shade woods park ecology landscape"],
  ["mushroom", "🍄", "Mushroom", "forest fungi magic mushroom toadstool mario nature forage"],
  ["cactus", "🌵", "Cactus", "desert resilient prickly plant succulent dry nature thorn"],
  ["leaf", "🍂", "Fallen leaf", "autumn fall nature season foliage brown orange leaves"],
  ["butterfly", "🦋", "Butterfly", "transformation freedom pretty graceful insect wings bug moth"],
  ["bee", "🐝", "Bee", "busy honey bee hard work buzzing insect honey pollinate bumblebee"],
  ["snail", "🐌", "Snail", "slow patient peaceful tiny shell animal garden nature slug"],
  ["cat", "🐈", "Cat", "kitty kitten meow pet cute feline purr whiskered"],
  ["dog", "🐕", "Dog", "puppy doggo loyal friend pet canine bark paws friend woof"],
  ["rabbit", "🐇", "Rabbit", "bunny hop cute soft animal hare woodland fur"],
  ["fox", "🦊", "Fox", "clever fox cunning wild orange woodland tail fur red"],
  ["bear", "🐻", "Bear", "teddy forest animal grizzly cute wild mammal paws brown"],
  ["panda", "🐼", "Panda", "panda bear bamboo cute china animal wildlife mammal black white"],
  ["otter", "🦦", "Otter", "playful cute water river aquatic mammal swimming curious"],
  ["sloth", "🦥", "Sloth", "relax lazy slow rest sleepy chill nap hanging tree"],
  ["penguin", "🐧", "Penguin", "cold linux bird tuxedo antarctica flipper waddle ice cute"],
  ["owl", "🦉", "Owl", "wise night wisdom clever bird nocturnal feathers eyes hoot"],
  ["duck", "🦆", "Duck", "rubber duck debugging quack pond mallard bird water swimming"],
  ["whale", "🐋", "Whale", "ocean big sea gentle blue mammal sea aquatic swim splash"],
  ["dolphin", "🐬", "Dolphin", "playful friendly ocean sea marine swimming clever jump mammal"],
  ["turtle", "🐢", "Turtle", "slow patient ocean steady shell reptilian tortoise water"],
  ["dinosaur", "🦕", "Dinosaur", "ancient dino tall prehistoric jurassic t-rex fossil reptile"],
  ["dragon", "🐉", "Dragon", "fantasy mythical magic powerful legendary reptile fire scales beast"],
  ["unicorn", "🦄", "Unicorn", "unique magical rainbow special fantasy horn horse glitter dream"],
  ["ghost", "👻", "Ghost", "spooky boo ghost playful halloween spirit phantom cute haunted"],
  ["skull", "💀", "Skull", "dead skeleton spooky bones death metal halloween rip pirate"],
  ["alien", "👽", "Alien", "extraterrestrial ufo space sci-fi mars outer creature cosmic"],
  ["robot", "🤖", "Robot", "ai automation computer machine technology android sci-fi bot metal"],
  ["pizza", "🍕", "Pizza", "pizza food dinner cheesy hungry slice pepperoni italian bake"],
  ["burger", "🍔", "Hamburger", "burger cheeseburger fastfood dinner beef american bun sesame"],
  ["fries", "🍟", "French fries", "fries potato fastfood snack salty crisps side"],
  ["taco", "🌮", "Taco", "mexican taco food dinner tortilla crunchy spicy fiesta"],
  ["cookie", "🍪", "Cookie", "snack sweet baked treat biscuit chocolate chip dessert crisp"],
  ["donut", "🍩", "Doughnut", "donut sweet treat sugar dessert frosted glaze bakery sprinkles"],
  ["icecream", "🍦", "Ice cream", "sweet summer icecream dessert soft serve cone vanilla cold"],
  ["chocolate", "🍫", "Chocolate", "chocolate sweet comfort treat candy bar cocoa dessert snack"],
  ["strawberry", "🍓", "Strawberry", "berry fruit sweet summer red fresh healthy dessert garden"],
  ["lemon", "🍋", "Lemon", "sour fresh yellow fruit citrus zest tart lemonade"],
  ["watermelon", "🍉", "Watermelon", "summer fruit sweet juicy fresh melon red green picnic slice"],
  ["banana", "🍌", "Banana", "yellow fruit potassium healthy sweet ripe peel monkey snack"],
  ["apple", "🍎", "Red apple", "fruit sweet healthy fresh red orchard teacher pie cider"],
  ["avocado", "🥑", "Avocado", "avocado breakfast toast green guacamole healthy vegetable pit"],
  ["ramen", "🍜", "Ramen", "noodle soup ramen bowl japanese chopsticks warm broth dinner"],
  ["sushi", "🍣", "Sushi", "japanese fish rice seafood sashimi nigiri roll delicious"],
  ["bread", "🍞", "Bread", "toast loaf bakery carb grain breakfast bake sandwich wheat"],
  ["croissant", "🥐", "Croissant", "french pastry breakfast buttery bakery flaky cafe paris"],
  ["soccer", "⚽", "Football", "soccer football sport play ball goal stadium match team"],
  ["basketball", "🏀", "Basketball", "basketball sport hoops court dribble slam dunk team ball"],
  ["tennis", "🎾", "Tennis ball", "tennis sport racket play court match serve ball green"],
  ["bow", "🎀", "Ribbon", "cute gift bow present pretty pink wrap decoration tie"],
  ["letter", "💌", "Love letter", "message affection note letter love envelope heart secret mail"],
  ["handshake", "🤝", "Handshake", "thanks friendship agreement support deal partnership hello shake"],
  ["wavehello", "👋", "Waving hand", "hello hi goodbye welcome wave greeting see you later hand"],
  ["clap", "👏", "Clapping hands", "bravo applause well done congratulations praise clap hand celebrate"],
  ["thumbsup", "👍", "Thumbs up", "great good yes like approve awesome cool positive ok perfect"],
  ["thumbsdown", "👎", "Thumbs down", "bad dislike disagree refuse deny disapproval no negative"],
  ["peace", "✌️", "Victory hand", "peace hello victory chill two two fingers sign rock"],
  ["fist", "👊", "Oncoming fist", "punch brofist bump power strike fistfight greet strong"],
  ["muscle", "💪", "Flexed biceps", "strong muscle strength fitness power workout gym flex tone"],
  ["pray", "🙏", "Folded hands", "please thank you gratitude pray wish hope respect namaste blessing"],
  ["raised_hands", "🙌", "Raising hands", "hooray celebrate praise joy worship success yay celebration"],
  ["eyes", "👀", "Eyes", "looking watching curious interesting notice gaze stare see witness"],
  ["brain", "🧠", "Brain", "smart intellect intelligence thinking mind memory logic idea clever neurology"],
  ["smile", "😊", "Smiling face", "happy smile kind pleased friendly warm blushes content gentle"],
  ["grinning", "😀", "Grinning face", "happy grin smiling cheerful joyful bright greeting beaming"],
  ["laugh", "😂", "Laughing face", "funny laughter lol hilarious joy crying laughing tears tears of joy"],
  ["rofl", "🤣", "Rolling on floor laughing", "lmao haha rofl cracking up dying funny hilarious"],
  ["wink", "😉", "Winking face", "flirt playful tease hint nudge joke secret knowing"],
  ["heart_eyes", "😍", "Heart eyes", "love adoration crush beautiful gorgeous admire infatuated heart"],
  ["star_struck", "🤩", "Star struck", "impressed excited wow amazed fan celebrity sparkling awesome"],
  ["thinking", "🤔", "Thinking face", "thinking curious wondering question hmm puzzle consider pondering"],
  ["cool", "😎", "Smiling with sunglasses", "cool awesome chill relaxed swagger sunglasses slick stylish"],
  ["nerd", "🤓", "Nerd face", "geek smart coding glasses studious study reading intelligent tech"],
  ["smirk", "😏", "Smirking face", "smug sly clever suggestive cheeky knowing flirt ironic"],
  ["plead", "🥺", "Pleading face", "puppy eyes beg please cute touched emotional sweet sad"],
  ["cry", "😢", "Crying face", "sad tear sorrow weep upset unhappy moved emotional hurt"],
  ["sob", "😭", "Loudly crying face", "tears crying drama sobbing overwhelmed devastated heartbroken sadness"],
  ["mindblown", "🤯", "Exploding head", "wow amazing surprising mindblown shocked stunned unbelievable insane"],
  ["party_face", "🥳", "Party face", "celebrate birthday party hat blower confetti celebration yay festive"],
  ["sleeping", "😴", "Sleeping face", "sleep tired nap zzz bedtime rest quiet goodnight peaceful"],
  ["salute", "🫡", "Saluting face", "respect salute yes sir okay military honor acknowledgment loyal"],
  ["crown", "👑", "Crown", "queen king royal majesty leader royalty triumph winner golden gold"],
  ["hundred", "💯", "Hundred points", "perfect excellent hundred amazing top score score keep it real facts"],
  ["check", "✅", "Check mark", "done complete correct yes approved verified passed task finished ok"],
  ["cross", "❌", "Cross mark", "no false wrong cancelled incorrect deny stop error failed x"],
  ["warning", "⚠️", "Warning", "caution alert danger attention watch out careful notice signal"],
  ["exclamation", "❗", "Exclamation mark", "alert important attention punctuation notice surprise prompt bold"],
  ["question", "❓", "Question mark", "wonder ask query doubt confusion help search inquiry curious"],
  ["zap", "⚡", "High voltage", "lightning fast speed electric bolt storm flash power energy quick"],
  ["compass", "🧭", "Compass", "direction navigation travel explorer map orient journey search finding"],
  ["anchor", "⚓", "Anchor", "ship boat sailor sea nautical marine stable hope harbor navy dock"],
  ["crystal_ball", "🔮", "Crystal ball", "magic psychic future fortune destiny mystical witch divination vision"],
  ["hourglass", "⏳", "Hourglass", "time running out timer wait sand deadline clock countdown moment"],
  ["bell", "🔔", "Bell", "ring notification chime alert sound chime reminder attention ding"],
] as const;

export const normalizeEmojiPresentation = (emoji: string): string => emoji.replace(/\uFE0F/g, "");

export const EMOJI_CATALOG: readonly EmojiOption[] = entries.map(([id, emoji, name, keywords]) => ({
  id,
  emoji,
  name,
  keywords,
}));

const byId = new Map<string, EmojiOption>(EMOJI_CATALOG.map((item) => [item.id, item]));

/** Convert any raw emoji string into a valid, decodeable EmojiOption. */
export function emojiToOption(char: string, name = "Icon"): EmojiOption {
  const actualPoints = Array.from(char).map((c) => c.codePointAt(0)!);
  const id = "u_" + actualPoints.map((cp) => cp.toString(16)).join("_");
  return { id, emoji: char, name, keywords: "" };
}

/** Looks up an emoji by registered ID or decodes any unicode hex ID (e.g. 'u_1f600'). */
export const findEmoji = (id: string): EmojiOption | undefined => {
  const found = byId.get(id);
  if (found) return found;
  if (id.startsWith("u_")) {
    try {
      const codePoints = id
        .slice(2)
        .split("_")
        .map((hex) => parseInt(hex, 16));
      if (codePoints.length > 0 && codePoints.every((cp) => !isNaN(cp) && cp > 0)) {
        const char = String.fromCodePoint(...codePoints);
        return { id, emoji: char, name: "Icon", keywords: "" };
      }
    } catch {
      // ignore parsing failure
    }
  }
  return undefined;
};

/**
 * Searches the emoji catalog efficiently.
 * - Supports direct emoji input (e.g. pasted emojis or emoji keyboard).
 * - Matches by exact id, name, keywords, prefix, and substrings.
 * - Does NOT impose arbitrary small caps (e.g. 5 items).
 */
export function searchEmojiCatalog(text: string): EmojiOption[] {
  const input = text.trim();
  if (!input) return [...EMOJI_CATALOG];

  const lower = input.toLowerCase();
  const normalizedInput = normalizeEmojiPresentation(input);
  const words = lower.split(/\s+/).filter(Boolean);

  // Check if query contains any raw emoji characters directly
  const customEmojis: EmojiOption[] = [];
  const emojiMatches = input.match(/\p{Extended_Pictographic}/gu) || [];
  for (const char of emojiMatches) {
    const existing = EMOJI_CATALOG.find(
      (e) => e.emoji === char || normalizeEmojiPresentation(e.emoji) === normalizeEmojiPresentation(char)
    );
    if (existing) {
      if (!customEmojis.some((e) => e.id === existing.id)) {
        customEmojis.push(existing);
      }
    } else {
      const opt = emojiToOption(char);
      if (!customEmojis.some((e) => e.id === opt.id)) {
        customEmojis.push(opt);
      }
    }
  }

  const scored = EMOJI_CATALOG.map((item, index) => {
    const lowerName = item.name.toLowerCase();
    const lowerKeywords = item.keywords.toLowerCase();
    const tokens = `${lowerName} ${lowerKeywords}`.split(/\s+/);

    const exact =
      lower === item.id ||
      input === item.emoji ||
      normalizedInput === normalizeEmojiPresentation(item.emoji) ||
      lower === lowerName;
    const namePrefix = lowerName.startsWith(lower);

    let score = exact ? 100 : namePrefix ? 50 : 0;
    for (const word of words) {
      if (lowerName.includes(word)) score += 25;
      if (tokens.includes(word)) score += 15;
      else if (tokens.some((token) => token.startsWith(word))) score += 8;
      else if (lowerKeywords.includes(word)) score += 4;
    }
    return { item, score, index };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);

  // Deduplicate items that might be in customEmojis already
  const seen = new Set(customEmojis.map((e) => e.id));
  const result = [...customEmojis];
  for (const item of scored) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }

  return result;
}

/** Legacy alias for backwards compatibility */
export function localSuggestions(text: string, limit?: number): EmojiOption[] {
  const results = searchEmojiCatalog(text);
  return limit ? results.slice(0, limit) : results;
}

export function giftObjects(gifts: readonly Gift[]): ObjectSpec[] {
  return gifts.flatMap((gift) => {
    const emoji = findEmoji(gift.emojiId);
    return emoji ? [{ id: gift.id, name: emoji.name, emoji: emoji.emoji, width: 48, height: 48, isGift: true }] : [];
  });
}

export function worldSize(giftCount: number): Size {
  const growth = Math.max(1, Math.sqrt((10 + giftCount) / 16));
  return { width: Math.ceil(500 * growth), height: Math.ceil(600 * growth) };
}
