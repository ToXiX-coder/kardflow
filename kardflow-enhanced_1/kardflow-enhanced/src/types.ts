export type ThemeId = 'cyber-blue' | 'neon-green' | 'plasma-purple' | 'solar-orange' | 'crimson-red';
export type ActivePage = 'home' | 'marketplace' | 'deckbuilder' | 'collection' | 'sell' | 'profile' | 'deploy';
export type GameCategory = 'all' | 'mtg' | 'pokemon' | 'yugioh' | 'sports' | 'onepiece' | 'starwars' | 'gundam' | 'lorcana';

export interface Theme {
  id: ThemeId;
  label: string;
  dataAttr: string;
  preview: string;
}

export const THEMES: Theme[] = [
  { id: 'cyber-blue', label: 'Cyber Blue', dataAttr: 'cyber-blue', preview: '#00d4ff' },
  { id: 'neon-green', label: 'Neon Green', dataAttr: 'neon-green', preview: '#39ff14' },
  { id: 'plasma-purple', label: 'Plasma Purple', dataAttr: 'plasma-purple', preview: '#bf5af2' },
  { id: 'solar-orange', label: 'Solar Orange', dataAttr: 'solar-orange', preview: '#ff9500' },
  { id: 'crimson-red', label: 'Crimson Red', dataAttr: 'crimson-red', preview: '#ff3b30' },
];

export interface GameInfo {
  id: GameCategory;
  name: string;
  icon: string;
  color: string;
}

export const GAMES: GameInfo[] = [
  { id: 'mtg', name: 'Magic: The Gathering', icon: '🧙', color: '#e69138' },
  { id: 'pokemon', name: 'Pokémon', icon: '⚡', color: '#f6d02f' },
  { id: 'yugioh', name: 'Yu-Gi-Oh!', icon: '🎴', color: '#9b59b6' },
  { id: 'sports', name: 'Sports Cards', icon: '🏆', color: '#27ae60' },
  { id: 'onepiece', name: 'One Piece', icon: '🏴‍☠️', color: '#e74c3c' },
  { id: 'starwars', name: 'Star Wars Unlimited', icon: '⭐', color: '#3498db' },
  { id: 'gundam', name: 'Gundam Card Game', icon: '🤖', color: '#1abc9c' },
  { id: 'lorcana', name: 'Disney Lorcana', icon: '✨', color: '#8e44ad' },
];

export interface MarketCard {
  id: string;
  name: string;
  set: string;
  game: GameCategory;
  rarity: string;
  condition: string;
  price: number;
  marketPrice?: number;
  image: string;
  seller: string;
  type: 'single' | 'sealed';
  sealedType?: string;
  color?: string;
  featured?: boolean;
}

export interface CartItem extends MarketCard {
  qty: number;
}

export interface WishlistItem {
  id: string;
  name: string;
  game: GameCategory;
  image: string;
  price: number;
}

export interface CollectionItem {
  id: string;
  name: string;
  game: GameCategory;
  set: string;
  image: string;
  value: number;
  condition: string;
  dateAdded: string;
  collectionName: string;
}

export interface CardPrinting {
  id: string;
  name: string;
  setName: string;
  setCode: string;
  collectorNumber: string;
  rarity: string;
  imageSmall: string;
  imageNormal: string;
  imageLarge: string;
  priceUsd: string | null;
  priceFoil: string | null;
  priceTcg: string | null;
  priceTcgFoil: string | null;
  releasedAt: string;
  artist: string;
  frame: string;
  fullArt: boolean;
  borderColor: string;
}

export interface DeckCard {
  id: string;
  name: string;
  manaCost?: string;
  cmc: number;
  typeLine: string;
  colors: string[];
  colorIdentity: string[];
  setName: string;
  setCode: string;
  rarity: string;
  imageSmall: string;
  imageNormal: string;
  imageLarge: string;
  priceUsd: string | null;
  priceFoil: string | null;
  oracleText?: string;
  power?: string;
  toughness?: string;
  legalities: Record<string, string>;
  quantity: number;
  board: 'main' | 'sideboard' | 'maybe' | 'commander';
  printsSearchUri?: string;
}

export interface SavedDeck {
  id: string;
  name: string;
  format: string;
  game: GameCategory;
  cards: DeckCard[];
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  username: string;
  joinDate: string;
  collectionValue: number;
  totalTrades: number;
  avatar: string;
}

export interface AppState {
  theme: ThemeId;
  activePage: ActivePage;
  cart: CartItem[];
  wishlist: WishlistItem[];
  collections: CollectionItem[];
  decks: SavedDeck[];
  user: UserProfile | null;
  isLoggedIn: boolean;
}
