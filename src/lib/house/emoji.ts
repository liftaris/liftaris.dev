import type { ObjectSpec, Size } from "../../components/clump/model";
import type { EmojiOption, Gift } from "./types";

const entries = [
  ["popcorn", "🍿", "Popcorn", "movie cinema snack film watching"],
  ["heart", "❤️", "Heart", "love affection care kind romance"],
  ["flower", "🌷", "Tulip", "flower spring beautiful gratitude bouquet"],
  ["sparkles", "✨", "Sparkles", "magic wonderful special shiny impressive"],
  ["coffee", "☕", "Coffee", "caffeine morning work warm drink espresso"],
  ["octopus", "🐙", "Octopus", "ocean tentacles sea clever"],
  ["computer", "🖥️", "Computer", "coding programming software desktop technology"],
  ["shoes", "👟", "Sneaker", "walk walking run exercise shoe"],
  ["globe", "🌍", "Globe", "world earth travel planet global"],
  ["plant", "🪴", "Plant", "monstera green growth garden growing"],
  ["cloud", "☁️", "Cloud", "sky dream dreaming weather hosting"],
  ["bike", "🚲", "Bicycle", "cycling bike ride outdoors"],
  ["boots", "🥾", "Hiking boot", "climbing mountain adventure hiking"],
  ["light", "💡", "Light bulb", "idea inspiration creative smart"],
  ["case", "💼", "Briefcase", "work job career business"],
  ["gift", "🎁", "Present", "gift surprise birthday giving"],
  ["cake", "🎂", "Cake", "birthday celebration sweet baking"],
  ["party", "🎉", "Party popper", "celebration congratulations congrats hooray"],
  ["balloon", "🎈", "Balloon", "party celebrate float cheerful"],
  ["confetti", "🎊", "Confetti", "success celebrate achievement"],
  ["star", "⭐", "Star", "excellent favorite awesome achievement"],
  ["sun", "☀️", "Sun", "happy sunny warm summer bright"],
  ["moon", "🌙", "Moon", "night quiet sleep evening dreamy"],
  ["rainbow", "🌈", "Rainbow", "hope colorful pride joy"],
  ["rain", "🌧️", "Rain cloud", "rainy sad melancholy cozy weather"],
  ["snow", "❄️", "Snowflake", "cold winter snow ice unique"],
  ["fire", "🔥", "Fire", "hot amazing cool impressive lit energy"],
  ["water", "💧", "Water drop", "thirst hydrate fresh rain water"],
  ["wave", "🌊", "Ocean wave", "surf beach ocean sea flow"],
  ["mountain", "🏔️", "Mountain", "climb hiking alpine adventure challenge"],
  ["island", "🏝️", "Island", "vacation relax beach tropical holiday"],
  ["tent", "⛺", "Tent", "camp camping wilderness outdoors"],
  ["rocket", "🚀", "Rocket", "launch ship fast startup space ambitious"],
  ["satellite", "🛰️", "Satellite", "space internet orbit signal"],
  ["ufo", "🛸", "Flying saucer", "alien weird space unusual mystery"],
  ["airplane", "✈️", "Airplane", "travel flight journey trip flying"],
  ["train", "🚂", "Train", "rail travel steam journey"],
  ["boat", "⛵", "Sailboat", "sailing sea voyage boat breeze"],
  ["house", "🏠", "House", "home cozy welcome family"],
  ["key", "🔑", "Key", "unlock home access solution secret"],
  ["books", "📚", "Books", "reading literature knowledge learn study"],
  ["book", "📖", "Open book", "story reading writing novel"],
  ["pencil", "✏️", "Pencil", "write draw sketch creative"],
  ["paint", "🎨", "Paint palette", "art artist design color creative"],
  ["camera", "📷", "Camera", "photo photography memory capture"],
  ["music", "🎵", "Musical note", "music song melody singing"],
  ["guitar", "🎸", "Guitar", "music rock band play instrument"],
  ["headphones", "🎧", "Headphones", "listen music podcast focus"],
  ["game", "🎮", "Game controller", "gaming videogame play fun"],
  ["dice", "🎲", "Dice", "random chance luck boardgame"],
  ["puzzle", "🧩", "Puzzle piece", "problem solution fit logic mystery"],
  ["yarn", "🧶", "Yarn", "knitting craft thread cozy"],
  ["teddy", "🧸", "Teddy bear", "hug comfort cute cuddly friend"],
  ["candle", "🕯️", "Candle", "peace cozy memory warmth light"],
  ["gem", "💎", "Gem", "precious diamond brilliant valuable"],
  ["trophy", "🏆", "Trophy", "winner success best award achievement"],
  ["medal", "🥇", "Gold medal", "first champion achievement proud"],
  ["clover", "🍀", "Four-leaf clover", "luck good luck lucky fortune"],
  ["seedling", "🌱", "Seedling", "growth beginning new nature potential"],
  ["tree", "🌳", "Tree", "forest nature roots strong shade"],
  ["mushroom", "🍄", "Mushroom", "forest fungi magic mushroom"],
  ["cactus", "🌵", "Cactus", "desert resilient prickly plant"],
  ["rose", "🌹", "Rose", "romance love flowers romantic"],
  ["sunflower", "🌻", "Sunflower", "happy cheerful yellow flower gratitude"],
  ["leaf", "🍂", "Fallen leaf", "autumn fall nature season"],
  ["butterfly", "🦋", "Butterfly", "transformation freedom pretty graceful"],
  ["bee", "🐝", "Bee", "busy honey bee hard work buzzing"],
  ["snail", "🐌", "Snail", "slow patient peaceful tiny"],
  ["cat", "🐈", "Cat", "kitty kitten meow pet cute"],
  ["dog", "🐕", "Dog", "puppy doggo loyal friend pet"],
  ["rabbit", "🐇", "Rabbit", "bunny hop cute soft"],
  ["fox", "🦊", "Fox", "clever fox cunning wild"],
  ["otter", "🦦", "Otter", "playful cute water river"],
  ["sloth", "🦥", "Sloth", "relax lazy slow rest sleepy"],
  ["penguin", "🐧", "Penguin", "cold linux bird tuxedo"],
  ["owl", "🦉", "Owl", "wise night wisdom clever"],
  ["duck", "🦆", "Duck", "rubber duck debugging quack pond"],
  ["whale", "🐋", "Whale", "ocean big sea gentle"],
  ["turtle", "🐢", "Turtle", "slow patient ocean steady"],
  ["dinosaur", "🦕", "Dinosaur", "ancient dino tall prehistoric"],
  ["dragon", "🐉", "Dragon", "fantasy mythical magic powerful"],
  ["unicorn", "🦄", "Unicorn", "unique magical rainbow special"],
  ["ghost", "👻", "Ghost", "spooky boo ghost playful halloween"],
  ["robot", "🤖", "Robot", "ai automation computer machine technology"],
  ["pizza", "🍕", "Pizza", "pizza food dinner cheesy hungry"],
  ["cookie", "🍪", "Cookie", "snack sweet baked treat biscuit"],
  ["donut", "🍩", "Doughnut", "donut sweet treat sugar dessert"],
  ["icecream", "🍦", "Ice cream", "sweet summer icecream dessert"],
  ["chocolate", "🍫", "Chocolate", "chocolate sweet comfort treat"],
  ["strawberry", "🍓", "Strawberry", "berry fruit sweet summer"],
  ["lemon", "🍋", "Lemon", "sour fresh yellow fruit"],
  ["avocado", "🥑", "Avocado", "avocado breakfast toast green"],
  ["tea", "🍵", "Tea", "tea matcha calm warm drink"],
  ["beer", "🍻", "Clinking beers", "cheers toast celebration pub friends"],
  ["soccer", "⚽", "Football", "soccer football sport play"],
  ["basketball", "🏀", "Basketball", "basketball sport hoops"],
  ["tennis", "🎾", "Tennis ball", "tennis sport racket play"],
  ["bow", "🎀", "Ribbon", "cute gift bow present pretty"],
  ["letter", "💌", "Love letter", "message affection note letter love"],
  ["handshake", "🤝", "Handshake", "thanks friendship agreement support"],
  ["wavehello", "👋", "Waving hand", "hello hi goodbye welcome wave"],
  ["clap", "👏", "Clapping hands", "bravo applause well done congratulations"],
  ["thumbsup", "👍", "Thumbs up", "great good yes like approve"],
  ["peace", "✌️", "Victory hand", "peace hello victory chill"],
  ["smile", "😊", "Smile", "happy smile kind pleased friendly"],
  ["laugh", "😂", "Laughing face", "funny laughter lol hilarious joy"],
  ["sad", "🥲", "Smiling tear", "bittersweet sad moved touched"],
  ["hug", "🤗", "Hug", "hug support comfort welcome warmth"],
  ["thinking", "🤔", "Thinking face", "thinking curious wondering question"],
  ["mindblown", "🤯", "Exploding head", "wow amazing surprising mindblown"],
  ["eyes", "👀", "Eyes", "looking watching curious interesting"],
  ["hundred", "💯", "Hundred points", "perfect excellent hundred amazing"],
] as const;

export const EMOJI_CATALOG: readonly EmojiOption[] = entries.map(([id, emoji, name, keywords]) => ({ id, emoji, name, keywords }));
const byId = new Map(EMOJI_CATALOG.map((item) => [item.id, item]));
export const findEmoji = (id: string): EmojiOption | undefined => byId.get(id);

export function localSuggestions(text: string, limit = 5): EmojiOption[] {
  const input = text.trim().toLocaleLowerCase();
  const words = input.split(/\s+/).filter(Boolean);
  return EMOJI_CATALOG.map((item, index) => {
    const tokens = `${item.name} ${item.keywords}`.toLocaleLowerCase().split(/\s+/);
    const exact = input === item.id || input === item.emoji || input === item.name.toLocaleLowerCase();
    const score = (exact ? 100 : 0) + words.reduce((sum, word) => sum + (tokens.includes(word) ? 10 : tokens.some((token) => word.length > 2 && token.startsWith(word)) ? 3 : 0), 0);
    return { item, score, index };
  }).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit).map(({ item }) => item);
}

export function giftObjects(gifts: readonly Gift[]): ObjectSpec[] {
  return gifts.flatMap((gift) => {
    const emoji = findEmoji(gift.emojiId);
    return emoji ? [{ id: gift.id, name: emoji.name, emoji: emoji.emoji, width: 48, height: 48, shape: "circle" as const }] : [];
  });
}

export function worldSize(giftCount: number): Size {
  const growth = Math.max(1, Math.sqrt((10 + giftCount) / 16));
  return { width: Math.ceil(500 * growth), height: Math.ceil(600 * growth) };
}
