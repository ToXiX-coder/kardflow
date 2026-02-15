import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useStore } from './store';
import { GAMES, THEMES, type GameCategory, type MarketCard, type CartItem, type CollectionItem, type SavedDeck, type DeckCard, type ActivePage, type CardPrinting } from './types';
import { DeckAIAssistant } from './DeckAIAssistant';
import {
  Search, ShoppingCart, Heart, Menu, X, ChevronDown, ChevronRight,
  Plus, Minus, Trash2, Filter, Grid, List, Star, Shield, Package,
  TrendingUp, Users, Zap, DollarSign, Settings, LogIn, LogOut, User,
  Copy, Layers, BarChart3, Sparkles, Mountain, BookOpen, Upload,
  CreditCard, Eye, ArrowRight, Bell, Loader2, Bot, Brain,
  ChevronLeft, FileText, Download, ExternalLink
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════
   LOGO
   ═══════════════════════════════════════════════════════════════════ */
function KardFlowLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect x="3" y="1" width="42" height="46" rx="8" fill="var(--bg-tertiary)" stroke="var(--accent)" strokeWidth="1.5" opacity="0.9"/>
      <path d="M6 20 C12 14, 18 26, 24 20 C30 14, 36 26, 42 20" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="1"/>
      <path d="M6 28 C12 22, 18 34, 24 28 C30 22, 36 34, 42 28" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6"/>
      <path d="M6 14 C12 8, 18 20, 24 14 C30 8, 36 20, 42 14" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.35"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MULTI-GAME API HELPERS
   ═══════════════════════════════════════════════════════════════════ */

// --- MTG (Scryfall) ---
async function scryfallSearch(query: string, limit = 40): Promise<DeckCard[]> {
  try {
    const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&order=name&unique=cards`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).slice(0, limit).map(mapScryfallCard);
  } catch { return []; }
}

async function scryfallNameExact(name: string): Promise<DeckCard | null> {
  try {
    const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    return mapScryfallCard(await res.json());
  } catch { return null; }
}

async function scryfallGetPrintings(name: string): Promise<CardPrinting[]> {
  try {
    const res = await fetch(`https://api.scryfall.com/cards/search?q=!"${encodeURIComponent(name)}"&unique=prints&order=released`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((c: Record<string, unknown>) => {
      const iu = c.image_uris as Record<string, string> | undefined;
      const cf = c.card_faces as Array<{ image_uris?: Record<string, string> }> | undefined;
      const pr = c.prices as Record<string, string | null>;
      return {
        id: c.id as string, name: c.name as string, setName: c.set_name as string,
        setCode: (c.set as string || '').toUpperCase(), collectorNumber: c.collector_number as string || '',
        rarity: c.rarity as string,
        imageSmall: iu?.small || cf?.[0]?.image_uris?.small || '',
        imageNormal: iu?.normal || cf?.[0]?.image_uris?.normal || '',
        imageLarge: iu?.large || cf?.[0]?.image_uris?.large || '',
        priceUsd: pr?.usd || null, priceFoil: pr?.usd_foil || null,
        priceTcg: pr?.usd || null, priceTcgFoil: pr?.usd_foil || null,
        releasedAt: c.released_at as string || '', artist: c.artist as string || '',
        frame: c.frame as string || '', fullArt: c.full_art as boolean || false,
        borderColor: c.border_color as string || '',
      } as CardPrinting;
    });
  } catch { return []; }
}

function mapScryfallCard(c: Record<string, unknown>): DeckCard {
  const iu = c.image_uris as Record<string, string> | undefined;
  const cf = c.card_faces as Array<{ image_uris?: Record<string, string> }> | undefined;
  const pr = c.prices as Record<string, string | null>;
  return {
    id: c.id as string, name: c.name as string, manaCost: c.mana_cost as string | undefined,
    cmc: c.cmc as number, typeLine: c.type_line as string,
    colors: (c.colors || []) as string[], colorIdentity: (c.color_identity || []) as string[],
    setName: c.set_name as string, setCode: c.set as string, rarity: c.rarity as string,
    imageSmall: iu?.small || cf?.[0]?.image_uris?.small || '',
    imageNormal: iu?.normal || cf?.[0]?.image_uris?.normal || '',
    imageLarge: iu?.large || cf?.[0]?.image_uris?.large || '',
    priceUsd: pr?.usd || null, priceFoil: pr?.usd_foil || null,
    oracleText: c.oracle_text as string | undefined,
    power: c.power as string | undefined, toughness: c.toughness as string | undefined,
    legalities: c.legalities as Record<string, string>,
    quantity: 0, board: 'main', printsSearchUri: c.prints_search_uri as string | undefined,
  };
}

// --- Yu-Gi-Oh! (YGOPRODeck) ---
async function yugiohSearch(query: string, limit = 40): Promise<DeckCard[]> {
  try {
    const res = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(query)}&num=${limit}&offset=0`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).slice(0, limit).map(mapYugiohCard);
  } catch { return []; }
}

async function yugiohNameExact(name: string): Promise<DeckCard | null> {
  try {
    const res = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(name)}`);
    if (!res.ok) {
      const res2 = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(name)}&num=1&offset=0`);
      if (!res2.ok) return null;
      const data2 = await res2.json();
      if (data2.data?.[0]) return mapYugiohCard(data2.data[0]);
      return null;
    }
    const data = await res.json();
    if (data.data?.[0]) return mapYugiohCard(data.data[0]);
    return null;
  } catch { return null; }
}

function mapYugiohCard(c: Record<string, unknown>): DeckCard {
  const imgs = c.card_images as Array<Record<string, unknown>> | undefined;
  const prices = c.card_prices as Array<Record<string, string>> | undefined;
  const img = imgs?.[0];
  const price = prices?.[0];
  const type = (c.type as string) || '';
  const isExtra = type.includes('Fusion') || type.includes('Synchro') || type.includes('Xyz') || type.includes('Link');
  return {
    id: `ygo-${c.id}`, name: c.name as string, manaCost: undefined,
    cmc: (c.level as number) || 0, typeLine: type,
    colors: [], colorIdentity: [],
    setName: (c.archetype as string) || 'Yu-Gi-Oh!',
    setCode: '', rarity: type,
    imageSmall: (img?.image_url_small as string) || '',
    imageNormal: (img?.image_url as string) || '',
    imageLarge: (img?.image_url as string) || '',
    priceUsd: price?.tcgplayer_price || null,
    priceFoil: null,
    oracleText: c.desc as string || '',
    power: c.atk !== undefined ? String(c.atk) : undefined,
    toughness: c.def !== undefined ? String(c.def) : undefined,
    legalities: {}, quantity: 0,
    board: isExtra ? 'sideboard' : 'main',
  };
}

// --- Pokémon (Pokemon TCG API) ---
async function pokemonSearch(query: string, limit = 40): Promise<DeckCard[]> {
  try {
    const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(query)}&pageSize=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).slice(0, limit).map(mapPokemonCard);
  } catch { return []; }
}

async function pokemonNameExact(name: string): Promise<DeckCard | null> {
  try {
    const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(name)}"&pageSize=1`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.data?.[0]) return mapPokemonCard(data.data[0]);
    return null;
  } catch { return null; }
}

// --- Star Wars Unlimited (SWUDB API) ---
async function starwarsSearch(query: string, limit = 40): Promise<DeckCard[]> {
  try {
    // SWUDB API endpoint
    const res = await fetch(`https://api.swu-db.com/cards/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      // Fallback to local database if API fails
      return [];
    }
    const data = await res.json();
    return (data.data || []).slice(0, limit).map(mapStarWarsCard);
  } catch {
    return [];
  }
}

async function starwarsNameExact(name: string): Promise<DeckCard | null> {
  try {
    const res = await fetch(`https://api.swu-db.com/cards/search?q=${encodeURIComponent(name)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        const exact = data.data.find((c: Record<string, unknown>) => 
          (c.name as string || '').toLowerCase() === name.toLowerCase()
        );
        if (exact) return mapStarWarsCard(exact);
        return mapStarWarsCard(data.data[0]);
      }
    }
    return null;
  } catch {
    return null;
  }
}

function mapStarWarsCard(c: Record<string, unknown>): DeckCard {
  const cost = (c.cost as number) || 0;
  const frontArt = (c.frontArt as string) || (c.FrontArt as string) || '';
  const set = (c.set as string) || (c.Set as string) || '';
  const aspects = (c.aspects as string[]) || [];
  const type = (c.type as string) || (c.Type as string) || 'Unit';
  const rarity = (c.rarity as string) || (c.Rarity as string) || 'Common';
  const power = (c.power as number) || 0;
  const hp = (c.hp as number) || 0;
  
  return {
    id: `swu-${c.id || Math.random().toString(36).slice(2)}`,
    name: (c.name as string) || (c.Name as string) || '',
    manaCost: undefined,
    cmc: cost,
    typeLine: type,
    colors: aspects,
    colorIdentity: aspects,
    setName: set,
    setCode: (c.setCode as string) || '',
    rarity: rarity,
    imageSmall: frontArt,
    imageNormal: frontArt,
    imageLarge: frontArt,
    priceUsd: null,
    priceFoil: null,
    oracleText: (c.text as string) || (c.Text as string) || '',
    power: power > 0 ? String(power) : undefined,
    toughness: hp > 0 ? String(hp) : undefined,
    legalities: {},
    quantity: 0,
    board: 'main',
  };
}

// --- One Piece TCG (OPTCG API) ---
async function onepieceSearch(query: string, limit = 40): Promise<DeckCard[]> {
  try {
    // Try the One Piece TCG API
    const res = await fetch(`https://optcgapi.com/api/cards?name=${encodeURIComponent(query)}&limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.cards || data || []).slice(0, limit).map(mapOnePieceCard);
  } catch {
    return [];
  }
}

async function onepieceNameExact(name: string): Promise<DeckCard | null> {
  try {
    const res = await fetch(`https://optcgapi.com/api/cards?name=${encodeURIComponent(name)}&limit=1`);
    if (res.ok) {
      const data = await res.json();
      const cards = data.cards || data || [];
      if (cards.length > 0) return mapOnePieceCard(cards[0]);
    }
    return null;
  } catch {
    return null;
  }
}

function mapOnePieceCard(c: Record<string, unknown>): DeckCard {
  const cost = (c.cost as number) || (c.life as number) || 0;
  const img = (c.image as string) || (c.imageUrl as string) || '';
  const set = (c.set as string) || (c.cardSet as string) || '';
  const type = (c.type as string) || (c.category as string) || 'Character';
  const rarity = (c.rarity as string) || 'Common';
  const power = (c.power as number) || 0;
  const counter = (c.counter as number) || 0;
  
  return {
    id: `op-${c.id || c.code || Math.random().toString(36).slice(2)}`,
    name: (c.name as string) || '',
    manaCost: undefined,
    cmc: cost,
    typeLine: type,
    colors: (c.color as string[]) || [(c.color as string) || ''],
    colorIdentity: [],
    setName: set,
    setCode: (c.code as string) || '',
    rarity: rarity,
    imageSmall: img,
    imageNormal: img,
    imageLarge: img,
    priceUsd: null,
    priceFoil: null,
    oracleText: `${(c.effect as string) || (c.text as string) || ''} ${power > 0 ? `Power: ${power}` : ''} ${counter > 0 ? `Counter: +${counter}` : ''}`.trim(),
    power: power > 0 ? String(power) : undefined,
    legalities: {},
    quantity: 0,
    board: 'main',
  };
}

// --- Disney Lorcana (Lorcana API) ---
async function lorcanaSearch(query: string, limit = 40): Promise<DeckCard[]> {
  try {
    const res = await fetch(`https://api.lorcana-api.com/cards/fetch?search=${encodeURIComponent(query)}&pageSize=${limit}`);
    if (!res.ok) {
      // Fallback: try all cards endpoint and filter locally
      const allRes = await fetch('https://api.lorcana-api.com/cards/all');
      if (!allRes.ok) return [];
      const allData = await allRes.json();
      const q = query.toLowerCase();
      const filtered = (allData || []).filter((c: Record<string, unknown>) => {
        const name = (c.Name as string || '').toLowerCase();
        const type = (c.Type as string || '').toLowerCase();
        return name.includes(q) || type.includes(q);
      }).slice(0, limit);
      return filtered.map(mapLorcanaCard);
    }
    const data = await res.json();
    return (data || []).slice(0, limit).map(mapLorcanaCard);
  } catch { return []; }
}

async function lorcanaNameExact(name: string): Promise<DeckCard | null> {
  try {
    const res = await fetch(`https://api.lorcana-api.com/cards/fetch?search=${encodeURIComponent(name)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const exact = data.find((c: Record<string, unknown>) => (c.Name as string || '').toLowerCase() === name.toLowerCase());
        if (exact) return mapLorcanaCard(exact);
        return mapLorcanaCard(data[0]);
      }
    }
    return null;
  } catch { return null; }
}

function mapLorcanaCard(c: Record<string, unknown>): DeckCard {
  const inkCost = (c.Cost as number) || (c.Ink_Cost as number) || 0;
  const img = (c.Image as string) || '';
  const set = (c.Set_Name as string) || (c.Set as string) || '';
  const inkColor = (c.Color as string) || (c.Ink as string) || '';
  return {
    id: `lorcana-${c.Set_ID || c.Set_Num || Math.random().toString(36).slice(2)}-${c.Card_Num || ''}`,
    name: (c.Name as string) || '',
    manaCost: undefined,
    cmc: inkCost,
    typeLine: (c.Type as string) || 'Character',
    colors: inkColor ? [inkColor] : [],
    colorIdentity: inkColor ? [inkColor] : [],
    setName: set,
    setCode: (c.Set_ID as string) || '',
    rarity: (c.Rarity as string) || 'Common',
    imageSmall: img,
    imageNormal: img,
    imageLarge: img,
    priceUsd: null,
    priceFoil: null,
    oracleText: (c.Body_Text as string) || (c.Abilities as string) || '',
    power: c.Strength !== undefined ? String(c.Strength) : undefined,
    toughness: c.Willpower !== undefined ? String(c.Willpower) : undefined,
    legalities: {},
    quantity: 0,
    board: 'main',
  };
}

function mapPokemonCard(c: Record<string, unknown>): DeckCard {
  const images = c.images as Record<string, string> | undefined;
  const tcgp = c.tcgplayer as { prices?: Record<string, { market?: number }> } | undefined;
  const price = tcgp?.prices?.holofoil?.market || tcgp?.prices?.normal?.market || 0;
  const set = c.set as Record<string, string> | undefined;
  return {
    id: `pkm-${c.id}`, name: c.name as string, manaCost: undefined,
    cmc: 0, typeLine: (c.supertype as string) || 'Pokémon',
    colors: ((c.types || []) as string[]), colorIdentity: [],
    setName: set?.name || '', setCode: set?.id || '',
    rarity: (c.rarity as string) || 'Common',
    imageSmall: images?.small || '', imageNormal: images?.large || images?.small || '',
    imageLarge: images?.large || '',
    priceUsd: price > 0 ? price.toFixed(2) : null, priceFoil: null,
    oracleText: '', legalities: {},
    quantity: 0, board: 'main',
  };
}

// --- Other Games (Comprehensive Card Database) ---
// Each game has 50+ cards with types, costs, rarities, and prices

const ONEPIECE_CARDS: Array<{ name: string; type: string; rarity: string; price: string; cost: number; set: string; power?: string; counter?: string }> = [
  // Leaders (20+)
  { name: 'Monkey D. Luffy', type: 'Leader', rarity: 'Leader', price: '12.50', cost: 0, set: 'OP01 Romance Dawn', power: '5000' },
  { name: 'Monkey D. Luffy (Film Red)', type: 'Leader', rarity: 'Leader', price: '45.00', cost: 0, set: 'OP02 Paramount War', power: '5000' },
  { name: 'Monkey D. Luffy (Gear 5)', type: 'Leader', rarity: 'Leader', price: '85.00', cost: 0, set: 'OP05 Awakening', power: '6000' },
  { name: 'Trafalgar Law', type: 'Leader', rarity: 'Leader', price: '15.00', cost: 0, set: 'OP01 Romance Dawn', power: '5000' },
  { name: 'Trafalgar Law (Film Red)', type: 'Leader', rarity: 'Leader', price: '32.00', cost: 0, set: 'OP02 Paramount War', power: '5000' },
  { name: 'Kaido', type: 'Leader', rarity: 'Leader', price: '18.00', cost: 0, set: 'OP03 Pillars of Strength', power: '5000' },
  { name: 'Big Mom', type: 'Leader', rarity: 'Leader', price: '14.00', cost: 0, set: 'OP03 Pillars of Strength', power: '5000' },
  { name: 'Shanks', type: 'Leader', rarity: 'Leader', price: '22.00', cost: 0, set: 'OP01 Romance Dawn', power: '5000' },
  { name: 'Shanks (Film Red)', type: 'Leader', rarity: 'Leader', price: '55.00', cost: 0, set: 'OP02 Paramount War', power: '5000' },
  { name: 'Eustass Kid', type: 'Leader', rarity: 'Leader', price: '10.00', cost: 0, set: 'OP02 Paramount War', power: '5000' },
  { name: 'Whitebeard', type: 'Leader', rarity: 'Leader', price: '16.00', cost: 0, set: 'OP02 Paramount War', power: '5000' },
  { name: 'Doflamingo', type: 'Leader', rarity: 'Leader', price: '9.00', cost: 0, set: 'OP04 Kingdoms', power: '5000' },
  { name: 'Boa Hancock (Leader)', type: 'Leader', rarity: 'Leader', price: '28.00', cost: 0, set: 'OP01 Romance Dawn', power: '5000' },
  { name: 'Crocodile (Leader)', type: 'Leader', rarity: 'Leader', price: '11.00', cost: 0, set: 'OP03 Pillars of Strength', power: '5000' },
  { name: 'Smoker (Leader)', type: 'Leader', rarity: 'Leader', price: '8.00', cost: 0, set: 'OP02 Paramount War', power: '5000' },
  { name: 'Nami (Leader)', type: 'Leader', rarity: 'Leader', price: '15.00', cost: 0, set: 'OP03 Pillars of Strength', power: '5000' },
  { name: 'Zoro (Leader)', type: 'Leader', rarity: 'Leader', price: '35.00', cost: 0, set: 'OP06 Wings of Captain', power: '5000' },
  { name: 'Sanji (Leader)', type: 'Leader', rarity: 'Leader', price: '20.00', cost: 0, set: 'OP05 Awakening', power: '5000' },
  { name: 'Uta (Leader)', type: 'Leader', rarity: 'Leader', price: '65.00', cost: 0, set: 'OP02 Paramount War', power: '5000' },
  { name: 'Sabo (Leader)', type: 'Leader', rarity: 'Leader', price: '12.00', cost: 0, set: 'OP04 Kingdoms', power: '5000' },
  // Characters - Straw Hats
  { name: 'Roronoa Zoro', type: 'Character', rarity: 'Super Rare', price: '8.00', cost: 3, set: 'OP01 Romance Dawn', power: '5000' },
  { name: 'Nami', type: 'Character', rarity: 'Rare', price: '3.50', cost: 1, set: 'OP01 Romance Dawn', power: '1000' },
  { name: 'Nico Robin', type: 'Character', rarity: 'Uncommon', price: '1.50', cost: 3, set: 'OP01 Romance Dawn', power: '3000' },
  { name: 'Tony Tony Chopper', type: 'Character', rarity: 'Common', price: '0.50', cost: 2, set: 'OP01 Romance Dawn', power: '2000' },
  { name: 'Sanji', type: 'Character', rarity: 'Rare', price: '4.00', cost: 4, set: 'OP01 Romance Dawn', power: '6000' },
  { name: 'Usopp', type: 'Character', rarity: 'Common', price: '0.25', cost: 2, set: 'OP01 Romance Dawn', power: '2000' },
  { name: 'Franky', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 4, set: 'OP01 Romance Dawn', power: '5000' },
  { name: 'Brook', type: 'Character', rarity: 'Uncommon', price: '0.75', cost: 3, set: 'OP01 Romance Dawn', power: '4000' },
  { name: 'Jinbe', type: 'Character', rarity: 'Rare', price: '3.00', cost: 5, set: 'OP02 Paramount War', power: '6000' },
  { name: 'Yamato', type: 'Character', rarity: 'Super Rare', price: '12.00', cost: 5, set: 'OP01 Romance Dawn', power: '5000' },
  { name: 'Gear 5 Luffy', type: 'Character', rarity: 'Secret Rare', price: '85.00', cost: 9, set: 'OP05 Awakening', power: '10000' },
  // Characters - Other Pirates
  { name: 'Portgas D. Ace', type: 'Character', rarity: 'Super Rare', price: '6.00', cost: 5, set: 'OP02 Paramount War', power: '7000' },
  { name: 'Boa Hancock', type: 'Character', rarity: 'Super Rare', price: '10.00', cost: 4, set: 'OP01 Romance Dawn', power: '4000' },
  { name: 'Sabo', type: 'Character', rarity: 'Super Rare', price: '7.50', cost: 5, set: 'OP04 Kingdoms', power: '6000' },
  { name: 'Marco', type: 'Character', rarity: 'Rare', price: '4.50', cost: 4, set: 'OP02 Paramount War', power: '5000' },
  { name: 'Crocodile', type: 'Character', rarity: 'Rare', price: '3.00', cost: 4, set: 'OP03 Pillars of Strength', power: '5000' },
  { name: 'Dracule Mihawk', type: 'Character', rarity: 'Super Rare', price: '9.00', cost: 7, set: 'OP03 Pillars of Strength', power: '7000' },
  { name: 'Katakuri', type: 'Character', rarity: 'Super Rare', price: '11.00', cost: 7, set: 'OP03 Pillars of Strength', power: '8000' },
  { name: 'King', type: 'Character', rarity: 'Rare', price: '3.50', cost: 6, set: 'OP04 Kingdoms', power: '7000' },
  { name: 'Queen', type: 'Character', rarity: 'Uncommon', price: '1.25', cost: 5, set: 'OP04 Kingdoms', power: '6000' },
  { name: 'Jack', type: 'Character', rarity: 'Common', price: '0.50', cost: 4, set: 'OP04 Kingdoms', power: '5000' },
  { name: 'Buggy', type: 'Character', rarity: 'Common', price: '0.25', cost: 1, set: 'OP03 Pillars of Strength', power: '2000' },
  { name: 'Blackbeard', type: 'Character', rarity: 'Super Rare', price: '14.00', cost: 8, set: 'OP03 Pillars of Strength', power: '9000' },
  { name: 'Akainu', type: 'Character', rarity: 'Super Rare', price: '8.50', cost: 7, set: 'OP02 Paramount War', power: '8000' },
  { name: 'Kizaru', type: 'Character', rarity: 'Rare', price: '4.00', cost: 5, set: 'OP02 Paramount War', power: '6000' },
  { name: 'Aokiji', type: 'Character', rarity: 'Rare', price: '3.50', cost: 5, set: 'OP02 Paramount War', power: '6000' },
  { name: 'Garp', type: 'Character', rarity: 'Rare', price: '2.50', cost: 4, set: 'OP02 Paramount War', power: '5000' },
  // Events
  { name: 'Gum-Gum Red Hawk', type: 'Event', rarity: 'Rare', price: '2.00', cost: 2, set: 'OP01 Romance Dawn' },
  { name: 'Radical Beam', type: 'Event', rarity: 'Common', price: '0.25', cost: 4, set: 'OP01 Romance Dawn' },
  { name: 'Diable Jambe', type: 'Event', rarity: 'Uncommon', price: '0.75', cost: 3, set: 'OP01 Romance Dawn' },
  { name: 'Jet Pistol', type: 'Event', rarity: 'Common', price: '0.15', cost: 1, set: 'OP01 Romance Dawn' },
  { name: 'Overheat', type: 'Event', rarity: 'Rare', price: '1.50', cost: 3, set: 'OP03 Pillars of Strength' },
  { name: 'Thunder Bagua', type: 'Event', rarity: 'Super Rare', price: '5.00', cost: 5, set: 'OP03 Pillars of Strength' },
  { name: 'Hiken', type: 'Event', rarity: 'Rare', price: '2.50', cost: 4, set: 'OP02 Paramount War' },
  { name: 'Conqueror\'s Haki', type: 'Event', rarity: 'Super Rare', price: '6.00', cost: 5, set: 'OP05 Awakening' },
  // Stages
  { name: 'Thousand Sunny', type: 'Stage', rarity: 'Rare', price: '3.00', cost: 2, set: 'OP01 Romance Dawn' },
  { name: 'Moby Dick', type: 'Stage', rarity: 'Rare', price: '2.50', cost: 3, set: 'OP02 Paramount War' },
  { name: 'Onigashima', type: 'Stage', rarity: 'Uncommon', price: '1.00', cost: 2, set: 'OP03 Pillars of Strength' },
  { name: 'Baratie', type: 'Stage', rarity: 'Common', price: '0.50', cost: 1, set: 'OP01 Romance Dawn' },
  { name: 'Whole Cake Island', type: 'Stage', rarity: 'Uncommon', price: '0.75', cost: 2, set: 'OP03 Pillars of Strength' },
  { name: 'Impel Down', type: 'Stage', rarity: 'Rare', price: '2.00', cost: 2, set: 'OP02 Paramount War' },
  { name: 'Going Merry', type: 'Stage', rarity: 'Uncommon', price: '1.25', cost: 1, set: 'OP01 Romance Dawn' },
  // More Characters (100+)
  { name: 'Nico Robin (Miss All Sunday)', type: 'Character', rarity: 'Rare', price: '4.00', cost: 4, set: 'OP03 Pillars of Strength', power: '5000' },
  { name: 'Nico Robin (Onigashima)', type: 'Character', rarity: 'Super Rare', price: '8.00', cost: 5, set: 'OP04 Kingdoms', power: '6000' },
  { name: 'Franky (Shogun)', type: 'Character', rarity: 'Rare', price: '3.50', cost: 5, set: 'OP04 Kingdoms', power: '6000' },
  { name: 'Brook (Soul King)', type: 'Character', rarity: 'Rare', price: '3.00', cost: 4, set: 'OP03 Pillars of Strength', power: '5000' },
  { name: 'Jinbe (Warlord)', type: 'Character', rarity: 'Super Rare', price: '6.00', cost: 6, set: 'OP02 Paramount War', power: '7000' },
  { name: 'Yamato (Oni Princess)', type: 'Character', rarity: 'Secret Rare', price: '25.00', cost: 6, set: 'OP04 Kingdoms', power: '7000' },
  { name: 'Carrot', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 3, set: 'OP03 Pillars of Strength', power: '4000' },
  { name: 'Carrot (Sulong)', type: 'Character', rarity: 'Rare', price: '3.50', cost: 5, set: 'OP04 Kingdoms', power: '6000' },
  { name: 'Vivi', type: 'Character', rarity: 'Uncommon', price: '1.25', cost: 2, set: 'OP01 Romance Dawn', power: '2000' },
  { name: 'Shirahoshi', type: 'Character', rarity: 'Rare', price: '4.00', cost: 4, set: 'OP02 Paramount War', power: '4000' },
  { name: 'Rebecca', type: 'Character', rarity: 'Common', price: '0.50', cost: 2, set: 'OP04 Kingdoms', power: '3000' },
  { name: 'Koala', type: 'Character', rarity: 'Common', price: '0.50', cost: 2, set: 'OP04 Kingdoms', power: '2000' },
  { name: 'Perona', type: 'Character', rarity: 'Uncommon', price: '1.50', cost: 3, set: 'OP03 Pillars of Strength', power: '3000' },
  { name: 'Reiju', type: 'Character', rarity: 'Rare', price: '3.00', cost: 4, set: 'OP03 Pillars of Strength', power: '5000' },
  { name: 'Pudding', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 2, set: 'OP03 Pillars of Strength', power: '2000' },
  { name: 'Kozuki Oden', type: 'Character', rarity: 'Super Rare', price: '15.00', cost: 7, set: 'OP04 Kingdoms', power: '8000' },
  { name: 'Kozuki Momonosuke', type: 'Character', rarity: 'Rare', price: '2.50', cost: 3, set: 'OP04 Kingdoms', power: '3000' },
  { name: 'Kozuki Hiyori', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 2, set: 'OP04 Kingdoms', power: '2000' },
  { name: 'Kinemon', type: 'Character', rarity: 'Rare', price: '2.00', cost: 4, set: 'OP04 Kingdoms', power: '5000' },
  { name: 'Raizo', type: 'Character', rarity: 'Common', price: '0.50', cost: 3, set: 'OP04 Kingdoms', power: '4000' },
  { name: 'Kiku', type: 'Character', rarity: 'Common', price: '0.50', cost: 3, set: 'OP04 Kingdoms', power: '4000' },
  { name: 'Ashura Doji', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 4, set: 'OP04 Kingdoms', power: '5000' },
  { name: 'Denjiro', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 4, set: 'OP04 Kingdoms', power: '5000' },
  { name: 'Nekomamushi', type: 'Character', rarity: 'Rare', price: '2.50', cost: 5, set: 'OP04 Kingdoms', power: '6000' },
  { name: 'Inuarashi', type: 'Character', rarity: 'Rare', price: '2.50', cost: 5, set: 'OP04 Kingdoms', power: '6000' },
  { name: 'Kyoshiro', type: 'Character', rarity: 'Common', price: '0.50', cost: 3, set: 'OP04 Kingdoms', power: '4000' },
  { name: 'Hyogoro', type: 'Character', rarity: 'Common', price: '0.25', cost: 2, set: 'OP04 Kingdoms', power: '3000' },
  // Warlords
  { name: 'Dracule Mihawk (Warlord)', type: 'Character', rarity: 'Super Rare', price: '12.00', cost: 8, set: 'OP01 Romance Dawn', power: '9000' },
  { name: 'Bartholomew Kuma', type: 'Character', rarity: 'Rare', price: '3.50', cost: 5, set: 'OP02 Paramount War', power: '6000' },
  { name: 'Gecko Moria', type: 'Character', rarity: 'Rare', price: '2.50', cost: 5, set: 'OP03 Pillars of Strength', power: '5000' },
  { name: 'Buggy the Clown (Warlord)', type: 'Character', rarity: 'Rare', price: '2.00', cost: 2, set: 'OP04 Kingdoms', power: '3000' },
  { name: 'Edward Weevil', type: 'Character', rarity: 'Uncommon', price: '1.50', cost: 5, set: 'OP03 Pillars of Strength', power: '7000' },
  // Admirals
  { name: 'Akainu (Sakazuki)', type: 'Character', rarity: 'Super Rare', price: '10.00', cost: 8, set: 'OP02 Paramount War', power: '9000' },
  { name: 'Kizaru (Borsalino)', type: 'Character', rarity: 'Rare', price: '5.00', cost: 6, set: 'OP02 Paramount War', power: '7000' },
  { name: 'Aokiji (Kuzan)', type: 'Character', rarity: 'Rare', price: '4.50', cost: 6, set: 'OP02 Paramount War', power: '7000' },
  { name: 'Fujitora (Issho)', type: 'Character', rarity: 'Rare', price: '4.00', cost: 6, set: 'OP04 Kingdoms', power: '7000' },
  { name: 'Green Bull (Ryokugyu)', type: 'Character', rarity: 'Rare', price: '3.50', cost: 6, set: 'OP05 Awakening', power: '7000' },
  { name: 'Sengoku', type: 'Character', rarity: 'Rare', price: '3.00', cost: 5, set: 'OP02 Paramount War', power: '6000' },
  { name: 'Monkey D. Garp', type: 'Character', rarity: 'Rare', price: '3.50', cost: 5, set: 'OP02 Paramount War', power: '6000' },
  { name: 'Tsuru', type: 'Character', rarity: 'Common', price: '0.50', cost: 3, set: 'OP02 Paramount War', power: '3000' },
  // Emperors/Yonko
  { name: 'Blackbeard (Marshall D. Teach)', type: 'Character', rarity: 'Super Rare', price: '18.00', cost: 9, set: 'OP03 Pillars of Strength', power: '10000' },
  { name: 'Charlotte Linlin', type: 'Character', rarity: 'Super Rare', price: '12.00', cost: 8, set: 'OP03 Pillars of Strength', power: '9000' },
  { name: 'Kaido (Dragon Form)', type: 'Character', rarity: 'Secret Rare', price: '35.00', cost: 10, set: 'OP04 Kingdoms', power: '12000' },
  { name: 'Red-Haired Shanks', type: 'Character', rarity: 'Secret Rare', price: '40.00', cost: 9, set: 'OP02 Paramount War', power: '10000' },
  // Beast Pirates
  { name: 'King the Wildfire', type: 'Character', rarity: 'Super Rare', price: '7.00', cost: 7, set: 'OP04 Kingdoms', power: '8000' },
  { name: 'Queen the Plague', type: 'Character', rarity: 'Rare', price: '3.50', cost: 6, set: 'OP04 Kingdoms', power: '7000' },
  { name: 'Jack the Drought', type: 'Character', rarity: 'Rare', price: '2.50', cost: 5, set: 'OP04 Kingdoms', power: '6000' },
  { name: 'Who\'s Who', type: 'Character', rarity: 'Uncommon', price: '1.25', cost: 4, set: 'OP04 Kingdoms', power: '5000' },
  { name: 'Black Maria', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 4, set: 'OP04 Kingdoms', power: '4000' },
  { name: 'Sasaki', type: 'Character', rarity: 'Common', price: '0.50', cost: 4, set: 'OP04 Kingdoms', power: '5000' },
  { name: 'Ulti', type: 'Character', rarity: 'Uncommon', price: '1.50', cost: 4, set: 'OP04 Kingdoms', power: '5000' },
  { name: 'Page One', type: 'Character', rarity: 'Common', price: '0.50', cost: 3, set: 'OP04 Kingdoms', power: '4000' },
  // Big Mom Pirates
  { name: 'Charlotte Katakuri (Sweet Commander)', type: 'Character', rarity: 'Super Rare', price: '14.00', cost: 8, set: 'OP03 Pillars of Strength', power: '9000' },
  { name: 'Charlotte Smoothie', type: 'Character', rarity: 'Rare', price: '3.00', cost: 5, set: 'OP03 Pillars of Strength', power: '6000' },
  { name: 'Charlotte Cracker', type: 'Character', rarity: 'Rare', price: '3.00', cost: 5, set: 'OP03 Pillars of Strength', power: '6000' },
  { name: 'Charlotte Perospero', type: 'Character', rarity: 'Uncommon', price: '1.25', cost: 4, set: 'OP03 Pillars of Strength', power: '5000' },
  { name: 'Charlotte Oven', type: 'Character', rarity: 'Common', price: '0.75', cost: 4, set: 'OP03 Pillars of Strength', power: '5000' },
  { name: 'Charlotte Daifuku', type: 'Character', rarity: 'Common', price: '0.50', cost: 4, set: 'OP03 Pillars of Strength', power: '5000' },
  { name: 'Charlotte Brulee', type: 'Character', rarity: 'Common', price: '0.50', cost: 3, set: 'OP03 Pillars of Strength', power: '3000' },
  { name: 'Charlotte Mont-d\'Or', type: 'Character', rarity: 'Common', price: '0.25', cost: 3, set: 'OP03 Pillars of Strength', power: '4000' },
  // Supernovas
  { name: 'Eustass Kid (Captain)', type: 'Character', rarity: 'Super Rare', price: '9.00', cost: 6, set: 'OP02 Paramount War', power: '7000' },
  { name: 'Killer', type: 'Character', rarity: 'Rare', price: '3.00', cost: 4, set: 'OP02 Paramount War', power: '5000' },
  { name: 'Basil Hawkins', type: 'Character', rarity: 'Rare', price: '2.50', cost: 4, set: 'OP04 Kingdoms', power: '5000' },
  { name: 'X Drake', type: 'Character', rarity: 'Rare', price: '2.50', cost: 5, set: 'OP04 Kingdoms', power: '6000' },
  { name: 'Scratchmen Apoo', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 4, set: 'OP04 Kingdoms', power: '5000' },
  { name: 'Capone Bege', type: 'Character', rarity: 'Rare', price: '2.00', cost: 4, set: 'OP03 Pillars of Strength', power: '5000' },
  { name: 'Jewelry Bonney', type: 'Character', rarity: 'Uncommon', price: '1.50', cost: 3, set: 'OP05 Awakening', power: '4000' },
  { name: 'Urouge', type: 'Character', rarity: 'Common', price: '0.75', cost: 4, set: 'OP01 Romance Dawn', power: '5000' },
  // More Events
  { name: 'Gum-Gum Gigant', type: 'Event', rarity: 'Super Rare', price: '6.00', cost: 7, set: 'OP05 Awakening' },
  { name: 'Three Thousand Worlds', type: 'Event', rarity: 'Rare', price: '3.00', cost: 4, set: 'OP01 Romance Dawn' },
  { name: 'Shambles', type: 'Event', rarity: 'Uncommon', price: '1.50', cost: 2, set: 'OP01 Romance Dawn' },
  { name: 'Soul Parade', type: 'Event', rarity: 'Common', price: '0.50', cost: 2, set: 'OP03 Pillars of Strength' },
  { name: 'Heavy Point', type: 'Event', rarity: 'Common', price: '0.25', cost: 1, set: 'OP01 Romance Dawn' },
  { name: 'I Will Surpass You', type: 'Event', rarity: 'Rare', price: '2.00', cost: 3, set: 'OP04 Kingdoms' },
  { name: 'Fire Fist', type: 'Event', rarity: 'Rare', price: '2.50', cost: 4, set: 'OP02 Paramount War' },
  { name: 'Divine Departure', type: 'Event', rarity: 'Super Rare', price: '8.00', cost: 6, set: 'OP02 Paramount War' },
  { name: 'Gamma Knife', type: 'Event', rarity: 'Rare', price: '2.00', cost: 3, set: 'OP01 Romance Dawn' },
  { name: 'Punk Gibson', type: 'Event', rarity: 'Uncommon', price: '1.00', cost: 3, set: 'OP02 Paramount War' },
  // More Stages
  { name: 'Polar Tang', type: 'Stage', rarity: 'Uncommon', price: '1.00', cost: 2, set: 'OP01 Romance Dawn' },
  { name: 'Victoria Punk', type: 'Stage', rarity: 'Uncommon', price: '0.75', cost: 2, set: 'OP02 Paramount War' },
  { name: 'Big Mom\'s Ship', type: 'Stage', rarity: 'Rare', price: '2.00', cost: 3, set: 'OP03 Pillars of Strength' },
  { name: 'Marineford', type: 'Stage', rarity: 'Rare', price: '2.50', cost: 2, set: 'OP02 Paramount War' },
  { name: 'Wano Country', type: 'Stage', rarity: 'Uncommon', price: '1.25', cost: 2, set: 'OP04 Kingdoms' },
  { name: 'Fish-Man Island', type: 'Stage', rarity: 'Common', price: '0.50', cost: 1, set: 'OP02 Paramount War' },
  { name: 'Dressrosa', type: 'Stage', rarity: 'Common', price: '0.50', cost: 2, set: 'OP04 Kingdoms' },
  { name: 'Sabaody Archipelago', type: 'Stage', rarity: 'Common', price: '0.50', cost: 1, set: 'OP01 Romance Dawn' },
  { name: 'Thriller Bark', type: 'Stage', rarity: 'Uncommon', price: '0.75', cost: 2, set: 'OP03 Pillars of Strength' },
  { name: 'Water 7', type: 'Stage', rarity: 'Common', price: '0.50', cost: 1, set: 'OP01 Romance Dawn' },
  { name: 'Skypiea', type: 'Stage', rarity: 'Common', price: '0.50', cost: 1, set: 'OP01 Romance Dawn' },
  { name: 'Alabasta', type: 'Stage', rarity: 'Common', price: '0.50', cost: 1, set: 'OP01 Romance Dawn' },
];

const STARWARS_CARDS: Array<{ name: string; type: string; rarity: string; price: string; cost: number; set: string; power?: string; hp?: string }> = [
  // Units - Heroes
  { name: 'Luke Skywalker', type: 'Unit', rarity: 'Legendary', price: '18.00', cost: 6, set: 'SOR Spark of Rebellion', power: '4', hp: '7' },
  { name: 'Han Solo', type: 'Unit', rarity: 'Rare', price: '7.50', cost: 4, set: 'SOR Spark of Rebellion', power: '3', hp: '6' },
  { name: 'Princess Leia', type: 'Unit', rarity: 'Rare', price: '6.00', cost: 3, set: 'SOR Spark of Rebellion', power: '2', hp: '4' },
  { name: 'Chewbacca', type: 'Unit', rarity: 'Uncommon', price: '2.50', cost: 5, set: 'SOR Spark of Rebellion', power: '4', hp: '7' },
  { name: 'Obi-Wan Kenobi', type: 'Unit', rarity: 'Legendary', price: '22.00', cost: 6, set: 'SOR Spark of Rebellion', power: '4', hp: '6' },
  { name: 'Yoda', type: 'Unit', rarity: 'Legendary', price: '25.00', cost: 5, set: 'SOR Spark of Rebellion', power: '2', hp: '5' },
  { name: 'Ahsoka Tano', type: 'Unit', rarity: 'Rare', price: '8.00', cost: 4, set: 'SHD Shadows', power: '3', hp: '5' },
  { name: 'Padme Amidala', type: 'Unit', rarity: 'Uncommon', price: '2.00', cost: 3, set: 'SOR Spark of Rebellion', power: '2', hp: '4' },
  { name: 'Mace Windu', type: 'Unit', rarity: 'Rare', price: '5.00', cost: 5, set: 'SHD Shadows', power: '4', hp: '5' },
  { name: 'Anakin Skywalker', type: 'Unit', rarity: 'Legendary', price: '20.00', cost: 5, set: 'SOR Spark of Rebellion', power: '4', hp: '6' },
  { name: 'R2-D2', type: 'Unit', rarity: 'Uncommon', price: '1.50', cost: 1, set: 'SOR Spark of Rebellion', power: '0', hp: '3' },
  { name: 'C-3PO', type: 'Unit', rarity: 'Common', price: '0.50', cost: 2, set: 'SOR Spark of Rebellion', power: '0', hp: '3' },
  { name: 'Lando Calrissian', type: 'Unit', rarity: 'Uncommon', price: '1.75', cost: 3, set: 'SOR Spark of Rebellion', power: '2', hp: '4' },
  { name: 'Wedge Antilles', type: 'Unit', rarity: 'Common', price: '0.50', cost: 2, set: 'SOR Spark of Rebellion', power: '2', hp: '3' },
  // Units - Villains
  { name: 'Darth Vader', type: 'Unit', rarity: 'Legendary', price: '28.00', cost: 7, set: 'SOR Spark of Rebellion', power: '5', hp: '8' },
  { name: 'Boba Fett', type: 'Unit', rarity: 'Rare', price: '8.50', cost: 4, set: 'SOR Spark of Rebellion', power: '3', hp: '5' },
  { name: 'Emperor Palpatine', type: 'Unit', rarity: 'Legendary', price: '30.00', cost: 8, set: 'SOR Spark of Rebellion', power: '3', hp: '7' },
  { name: 'Darth Maul', type: 'Unit', rarity: 'Rare', price: '7.00', cost: 5, set: 'SHD Shadows', power: '4', hp: '5' },
  { name: 'Grand Moff Tarkin', type: 'Unit', rarity: 'Uncommon', price: '1.50', cost: 3, set: 'SOR Spark of Rebellion', power: '1', hp: '4' },
  { name: 'General Grievous', type: 'Unit', rarity: 'Rare', price: '5.50', cost: 5, set: 'SOR Spark of Rebellion', power: '4', hp: '5' },
  { name: 'Count Dooku', type: 'Unit', rarity: 'Rare', price: '4.50', cost: 4, set: 'SHD Shadows', power: '3', hp: '5' },
  { name: 'Kylo Ren', type: 'Unit', rarity: 'Rare', price: '6.00', cost: 5, set: 'SOR Spark of Rebellion', power: '4', hp: '5' },
  { name: 'Jabba the Hutt', type: 'Unit', rarity: 'Uncommon', price: '2.00', cost: 4, set: 'SOR Spark of Rebellion', power: '1', hp: '6' },
  { name: 'IG-88', type: 'Unit', rarity: 'Uncommon', price: '1.50', cost: 3, set: 'SOR Spark of Rebellion', power: '3', hp: '3' },
  { name: 'Stormtrooper', type: 'Unit', rarity: 'Common', price: '0.25', cost: 1, set: 'SOR Spark of Rebellion', power: '1', hp: '2' },
  { name: 'Death Trooper', type: 'Unit', rarity: 'Common', price: '0.50', cost: 3, set: 'SOR Spark of Rebellion', power: '3', hp: '3' },
  { name: 'TIE Fighter Pilot', type: 'Unit', rarity: 'Common', price: '0.25', cost: 2, set: 'SOR Spark of Rebellion', power: '2', hp: '2' },
  { name: 'Jango Fett', type: 'Unit', rarity: 'Uncommon', price: '2.00', cost: 3, set: 'SHD Shadows', power: '3', hp: '4' },
  { name: 'Asajj Ventress', type: 'Unit', rarity: 'Rare', price: '4.00', cost: 4, set: 'SHD Shadows', power: '3', hp: '5' },
  { name: 'Cad Bane', type: 'Unit', rarity: 'Uncommon', price: '1.75', cost: 3, set: 'SHD Shadows', power: '3', hp: '3' },
  // Events
  { name: 'Force Push', type: 'Event', rarity: 'Common', price: '0.25', cost: 1, set: 'SOR Spark of Rebellion' },
  { name: 'Force Lightning', type: 'Event', rarity: 'Rare', price: '3.00', cost: 3, set: 'SOR Spark of Rebellion' },
  { name: 'Lightsaber Duel', type: 'Event', rarity: 'Uncommon', price: '1.00', cost: 2, set: 'SOR Spark of Rebellion' },
  { name: 'Reinforcements', type: 'Event', rarity: 'Common', price: '0.15', cost: 2, set: 'SOR Spark of Rebellion' },
  { name: 'Orbital Bombardment', type: 'Event', rarity: 'Rare', price: '4.00', cost: 5, set: 'SOR Spark of Rebellion' },
  { name: 'Jedi Mind Trick', type: 'Event', rarity: 'Uncommon', price: '0.75', cost: 1, set: 'SHD Shadows' },
  { name: 'Surprise Attack', type: 'Event', rarity: 'Common', price: '0.25', cost: 1, set: 'SOR Spark of Rebellion' },
  { name: 'Escape Plan', type: 'Event', rarity: 'Common', price: '0.25', cost: 1, set: 'SOR Spark of Rebellion' },
  { name: 'Force Choke', type: 'Event', rarity: 'Uncommon', price: '1.25', cost: 2, set: 'SOR Spark of Rebellion' },
  // Upgrades
  { name: 'Lightsaber', type: 'Upgrade', rarity: 'Common', price: '0.50', cost: 2, set: 'SOR Spark of Rebellion' },
  { name: 'Darksaber', type: 'Upgrade', rarity: 'Legendary', price: '15.00', cost: 3, set: 'SHD Shadows' },
  { name: 'Jetpack', type: 'Upgrade', rarity: 'Uncommon', price: '1.00', cost: 2, set: 'SOR Spark of Rebellion' },
  { name: 'Blaster', type: 'Upgrade', rarity: 'Common', price: '0.25', cost: 1, set: 'SOR Spark of Rebellion' },
  { name: 'Shield Generator', type: 'Upgrade', rarity: 'Uncommon', price: '1.50', cost: 3, set: 'SOR Spark of Rebellion' },
  // Bases
  { name: 'Death Star', type: 'Base', rarity: 'Legendary', price: '12.00', cost: 0, set: 'SOR Spark of Rebellion' },
  { name: 'Echo Base', type: 'Base', rarity: 'Rare', price: '4.00', cost: 0, set: 'SOR Spark of Rebellion' },
  { name: 'Jabba\'s Palace', type: 'Base', rarity: 'Uncommon', price: '1.50', cost: 0, set: 'SOR Spark of Rebellion' },
  { name: 'Cloud City', type: 'Base', rarity: 'Uncommon', price: '1.25', cost: 0, set: 'SOR Spark of Rebellion' },
  { name: 'Jedi Temple', type: 'Base', rarity: 'Rare', price: '3.50', cost: 0, set: 'SHD Shadows' },
  // More Units - Rebels
  { name: 'Admiral Ackbar', type: 'Unit', rarity: 'Rare', price: '5.00', cost: 4, set: 'SOR Spark of Rebellion', power: '2', hp: '5' },
  { name: 'Mon Mothma', type: 'Unit', rarity: 'Rare', price: '4.50', cost: 3, set: 'SOR Spark of Rebellion', power: '1', hp: '4' },
  { name: 'K-2SO', type: 'Unit', rarity: 'Uncommon', price: '2.00', cost: 4, set: 'SHD Shadows', power: '3', hp: '5' },
  { name: 'Cassian Andor', type: 'Unit', rarity: 'Rare', price: '4.00', cost: 3, set: 'SHD Shadows', power: '2', hp: '4' },
  { name: 'Jyn Erso', type: 'Unit', rarity: 'Rare', price: '4.50', cost: 4, set: 'SHD Shadows', power: '3', hp: '4' },
  { name: 'Bodhi Rook', type: 'Unit', rarity: 'Common', price: '0.50', cost: 2, set: 'SHD Shadows', power: '1', hp: '3' },
  { name: 'Chirrut Imwe', type: 'Unit', rarity: 'Uncommon', price: '1.75', cost: 3, set: 'SHD Shadows', power: '2', hp: '4' },
  { name: 'Baze Malbus', type: 'Unit', rarity: 'Uncommon', price: '1.50', cost: 4, set: 'SHD Shadows', power: '4', hp: '4' },
  { name: 'Sabine Wren', type: 'Unit', rarity: 'Rare', price: '5.00', cost: 3, set: 'SOR Spark of Rebellion', power: '3', hp: '3' },
  { name: 'Ezra Bridger', type: 'Unit', rarity: 'Rare', price: '4.50', cost: 3, set: 'SOR Spark of Rebellion', power: '2', hp: '4' },
  { name: 'Kanan Jarrus', type: 'Unit', rarity: 'Rare', price: '5.50', cost: 4, set: 'SOR Spark of Rebellion', power: '3', hp: '5' },
  { name: 'Hera Syndulla', type: 'Unit', rarity: 'Rare', price: '5.00', cost: 4, set: 'SOR Spark of Rebellion', power: '2', hp: '5' },
  { name: 'Chopper', type: 'Unit', rarity: 'Uncommon', price: '1.50', cost: 2, set: 'SOR Spark of Rebellion', power: '1', hp: '3' },
  { name: 'Zeb Orrelios', type: 'Unit', rarity: 'Uncommon', price: '1.25', cost: 3, set: 'SOR Spark of Rebellion', power: '3', hp: '3' },
  { name: 'Nien Nunb', type: 'Unit', rarity: 'Common', price: '0.50', cost: 2, set: 'SOR Spark of Rebellion', power: '2', hp: '2' },
  { name: 'Biggs Darklighter', type: 'Unit', rarity: 'Common', price: '0.50', cost: 2, set: 'SOR Spark of Rebellion', power: '2', hp: '2' },
  { name: 'Rebel Trooper', type: 'Unit', rarity: 'Common', price: '0.25', cost: 1, set: 'SOR Spark of Rebellion', power: '1', hp: '2' },
  { name: 'X-Wing Fighter', type: 'Unit', rarity: 'Common', price: '0.50', cost: 3, set: 'SOR Spark of Rebellion', power: '3', hp: '3' },
  { name: 'Y-Wing Bomber', type: 'Unit', rarity: 'Uncommon', price: '1.00', cost: 4, set: 'SOR Spark of Rebellion', power: '3', hp: '4' },
  { name: 'A-Wing Fighter', type: 'Unit', rarity: 'Uncommon', price: '1.00', cost: 2, set: 'SOR Spark of Rebellion', power: '2', hp: '2' },
  { name: 'B-Wing Fighter', type: 'Unit', rarity: 'Uncommon', price: '1.25', cost: 4, set: 'SOR Spark of Rebellion', power: '4', hp: '3' },
  { name: 'Millennium Falcon', type: 'Unit', rarity: 'Legendary', price: '20.00', cost: 5, set: 'SOR Spark of Rebellion', power: '4', hp: '6' },
  { name: 'Ghost', type: 'Unit', rarity: 'Rare', price: '6.00', cost: 5, set: 'SOR Spark of Rebellion', power: '3', hp: '6' },
  // More Units - Empire
  { name: 'Grand Admiral Thrawn', type: 'Unit', rarity: 'Legendary', price: '25.00', cost: 6, set: 'SHD Shadows', power: '2', hp: '7' },
  { name: 'Director Krennic', type: 'Unit', rarity: 'Rare', price: '5.00', cost: 4, set: 'SHD Shadows', power: '2', hp: '5' },
  { name: 'Inquisitor', type: 'Unit', rarity: 'Uncommon', price: '1.75', cost: 4, set: 'SHD Shadows', power: '3', hp: '4' },
  { name: 'Grand Inquisitor', type: 'Unit', rarity: 'Rare', price: '6.00', cost: 5, set: 'SOR Spark of Rebellion', power: '4', hp: '5' },
  { name: 'Fifth Brother', type: 'Unit', rarity: 'Uncommon', price: '1.50', cost: 3, set: 'SOR Spark of Rebellion', power: '3', hp: '3' },
  { name: 'Seventh Sister', type: 'Unit', rarity: 'Uncommon', price: '1.50', cost: 3, set: 'SOR Spark of Rebellion', power: '2', hp: '4' },
  { name: 'Agent Kallus', type: 'Unit', rarity: 'Rare', price: '3.00', cost: 3, set: 'SOR Spark of Rebellion', power: '2', hp: '4' },
  { name: 'Admiral Piett', type: 'Unit', rarity: 'Uncommon', price: '1.50', cost: 3, set: 'SOR Spark of Rebellion', power: '1', hp: '4' },
  { name: 'Captain Needa', type: 'Unit', rarity: 'Common', price: '0.50', cost: 2, set: 'SOR Spark of Rebellion', power: '1', hp: '3' },
  { name: 'AT-AT Walker', type: 'Unit', rarity: 'Rare', price: '5.00', cost: 6, set: 'SOR Spark of Rebellion', power: '5', hp: '7' },
  { name: 'AT-ST Walker', type: 'Unit', rarity: 'Uncommon', price: '1.50', cost: 4, set: 'SOR Spark of Rebellion', power: '4', hp: '4' },
  { name: 'TIE Fighter', type: 'Unit', rarity: 'Common', price: '0.25', cost: 2, set: 'SOR Spark of Rebellion', power: '2', hp: '2' },
  { name: 'TIE Interceptor', type: 'Unit', rarity: 'Uncommon', price: '0.75', cost: 3, set: 'SOR Spark of Rebellion', power: '3', hp: '2' },
  { name: 'TIE Advanced', type: 'Unit', rarity: 'Uncommon', price: '1.00', cost: 3, set: 'SOR Spark of Rebellion', power: '3', hp: '3' },
  { name: 'TIE Defender', type: 'Unit', rarity: 'Rare', price: '3.00', cost: 4, set: 'SHD Shadows', power: '4', hp: '4' },
  { name: 'TIE Bomber', type: 'Unit', rarity: 'Common', price: '0.50', cost: 3, set: 'SOR Spark of Rebellion', power: '2', hp: '4' },
  { name: 'Imperial Star Destroyer', type: 'Unit', rarity: 'Legendary', price: '18.00', cost: 8, set: 'SOR Spark of Rebellion', power: '6', hp: '10' },
  { name: 'Devastator', type: 'Unit', rarity: 'Rare', price: '7.00', cost: 7, set: 'SOR Spark of Rebellion', power: '5', hp: '8' },
  { name: 'Imperial Shuttle', type: 'Unit', rarity: 'Common', price: '0.50', cost: 2, set: 'SOR Spark of Rebellion', power: '1', hp: '3' },
  // More Units - Prequel Era
  { name: 'Qui-Gon Jinn', type: 'Unit', rarity: 'Rare', price: '5.50', cost: 5, set: 'SHD Shadows', power: '3', hp: '6' },
  { name: 'Jar Jar Binks', type: 'Unit', rarity: 'Common', price: '0.50', cost: 1, set: 'SHD Shadows', power: '0', hp: '2' },
  { name: 'Captain Rex', type: 'Unit', rarity: 'Rare', price: '5.00', cost: 3, set: 'SHD Shadows', power: '3', hp: '4' },
  { name: 'Clone Commander Cody', type: 'Unit', rarity: 'Uncommon', price: '1.75', cost: 3, set: 'SHD Shadows', power: '3', hp: '3' },
  { name: 'Clone Trooper', type: 'Unit', rarity: 'Common', price: '0.25', cost: 2, set: 'SHD Shadows', power: '2', hp: '2' },
  { name: 'ARC Trooper', type: 'Unit', rarity: 'Uncommon', price: '1.00', cost: 3, set: 'SHD Shadows', power: '3', hp: '3' },
  { name: 'Battle Droid', type: 'Unit', rarity: 'Common', price: '0.15', cost: 1, set: 'SHD Shadows', power: '1', hp: '1' },
  { name: 'Super Battle Droid', type: 'Unit', rarity: 'Common', price: '0.25', cost: 2, set: 'SHD Shadows', power: '2', hp: '2' },
  { name: 'Droideka', type: 'Unit', rarity: 'Uncommon', price: '1.00', cost: 3, set: 'SHD Shadows', power: '2', hp: '4' },
  { name: 'Nute Gunray', type: 'Unit', rarity: 'Uncommon', price: '0.75', cost: 2, set: 'SHD Shadows', power: '1', hp: '3' },
  { name: 'Watto', type: 'Unit', rarity: 'Common', price: '0.50', cost: 1, set: 'SHD Shadows', power: '0', hp: '2' },
  // More Events
  { name: 'Force Pull', type: 'Event', rarity: 'Common', price: '0.25', cost: 1, set: 'SOR Spark of Rebellion' },
  { name: 'Mind Trick', type: 'Event', rarity: 'Uncommon', price: '0.75', cost: 2, set: 'SOR Spark of Rebellion' },
  { name: 'Force Heal', type: 'Event', rarity: 'Common', price: '0.25', cost: 2, set: 'SHD Shadows' },
  { name: 'Force Barrier', type: 'Event', rarity: 'Uncommon', price: '1.00', cost: 2, set: 'SOR Spark of Rebellion' },
  { name: 'Starfighter Assault', type: 'Event', rarity: 'Rare', price: '3.00', cost: 4, set: 'SOR Spark of Rebellion' },
  { name: 'Imperial Blockade', type: 'Event', rarity: 'Uncommon', price: '1.25', cost: 3, set: 'SOR Spark of Rebellion' },
  { name: 'Rebel Sabotage', type: 'Event', rarity: 'Uncommon', price: '1.00', cost: 2, set: 'SOR Spark of Rebellion' },
  { name: 'Coordinated Attack', type: 'Event', rarity: 'Common', price: '0.50', cost: 2, set: 'SOR Spark of Rebellion' },
  { name: 'Inspiring Speech', type: 'Event', rarity: 'Uncommon', price: '0.75', cost: 1, set: 'SOR Spark of Rebellion' },
  { name: 'It\'s a Trap!', type: 'Event', rarity: 'Rare', price: '2.50', cost: 3, set: 'SOR Spark of Rebellion' },
  { name: 'I Have a Bad Feeling', type: 'Event', rarity: 'Common', price: '0.25', cost: 1, set: 'SOR Spark of Rebellion' },
  { name: 'Use the Force', type: 'Event', rarity: 'Rare', price: '3.00', cost: 2, set: 'SOR Spark of Rebellion' },
  { name: 'Execute Order 66', type: 'Event', rarity: 'Legendary', price: '15.00', cost: 6, set: 'SHD Shadows' },
  { name: 'Duel of the Fates', type: 'Event', rarity: 'Rare', price: '4.00', cost: 4, set: 'SHD Shadows' },
  // More Upgrades
  { name: 'E-11 Blaster Rifle', type: 'Upgrade', rarity: 'Common', price: '0.25', cost: 1, set: 'SOR Spark of Rebellion' },
  { name: 'DL-44 Heavy Blaster', type: 'Upgrade', rarity: 'Uncommon', price: '1.00', cost: 2, set: 'SOR Spark of Rebellion' },
  { name: 'Bowcaster', type: 'Upgrade', rarity: 'Uncommon', price: '1.25', cost: 2, set: 'SOR Spark of Rebellion' },
  { name: 'Thermal Detonator', type: 'Upgrade', rarity: 'Uncommon', price: '1.00', cost: 1, set: 'SOR Spark of Rebellion' },
  { name: 'Mandalorian Armor', type: 'Upgrade', rarity: 'Rare', price: '4.00', cost: 3, set: 'SOR Spark of Rebellion' },
  { name: 'Sith Holocron', type: 'Upgrade', rarity: 'Rare', price: '3.50', cost: 2, set: 'SHD Shadows' },
  { name: 'Jedi Holocron', type: 'Upgrade', rarity: 'Rare', price: '3.00', cost: 2, set: 'SHD Shadows' },
  { name: 'Clone Trooper Armor', type: 'Upgrade', rarity: 'Common', price: '0.50', cost: 1, set: 'SHD Shadows' },
  // More Bases
  { name: 'Mos Eisley Cantina', type: 'Base', rarity: 'Uncommon', price: '1.00', cost: 0, set: 'SOR Spark of Rebellion' },
  { name: 'Imperial Palace', type: 'Base', rarity: 'Rare', price: '3.00', cost: 0, set: 'SOR Spark of Rebellion' },
  { name: 'Rebel Cruiser', type: 'Base', rarity: 'Uncommon', price: '1.25', cost: 0, set: 'SOR Spark of Rebellion' },
  { name: 'Dagobah', type: 'Base', rarity: 'Rare', price: '2.50', cost: 0, set: 'SOR Spark of Rebellion' },
  { name: 'Mustafar', type: 'Base', rarity: 'Uncommon', price: '1.50', cost: 0, set: 'SHD Shadows' },
  { name: 'Kamino', type: 'Base', rarity: 'Uncommon', price: '1.25', cost: 0, set: 'SHD Shadows' },
  { name: 'Geonosis', type: 'Base', rarity: 'Common', price: '0.75', cost: 0, set: 'SHD Shadows' },
  { name: 'Coruscant', type: 'Base', rarity: 'Rare', price: '3.00', cost: 0, set: 'SHD Shadows' },
  { name: 'Naboo', type: 'Base', rarity: 'Uncommon', price: '1.25', cost: 0, set: 'SHD Shadows' },
  { name: 'Endor', type: 'Base', rarity: 'Common', price: '0.75', cost: 0, set: 'SOR Spark of Rebellion' },
  { name: 'Bespin', type: 'Base', rarity: 'Common', price: '0.75', cost: 0, set: 'SOR Spark of Rebellion' },
  { name: 'Hoth', type: 'Base', rarity: 'Common', price: '0.75', cost: 0, set: 'SOR Spark of Rebellion' },
];

const GUNDAM_CARDS: Array<{ name: string; type: string; rarity: string; price: string; cost: number; set: string; power?: string }> = [
  // Mobile Suits - Universal Century
  { name: 'RX-78-2 Gundam', type: 'Mobile Suit', rarity: 'Rare', price: '12.00', cost: 5, set: 'GCG01 Start', power: '8000' },
  { name: 'Zaku II', type: 'Mobile Suit', rarity: 'Common', price: '1.00', cost: 2, set: 'GCG01 Start', power: '3000' },
  { name: 'Zaku II Commander Type', type: 'Mobile Suit', rarity: 'Uncommon', price: '2.50', cost: 3, set: 'GCG01 Start', power: '4000' },
  { name: 'Char\'s Zaku II', type: 'Mobile Suit', rarity: 'Rare', price: '8.00', cost: 3, set: 'GCG01 Start', power: '5000' },
  { name: 'Gouf', type: 'Mobile Suit', rarity: 'Common', price: '0.75', cost: 3, set: 'GCG01 Start', power: '4000' },
  { name: 'Dom', type: 'Mobile Suit', rarity: 'Common', price: '0.50', cost: 3, set: 'GCG01 Start', power: '4000' },
  { name: 'Gelgoog', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.50', cost: 4, set: 'GCG01 Start', power: '5000' },
  { name: 'Guncannon', type: 'Mobile Suit', rarity: 'Common', price: '0.50', cost: 3, set: 'GCG01 Start', power: '4000' },
  { name: 'Guntank', type: 'Mobile Suit', rarity: 'Common', price: '0.25', cost: 2, set: 'GCG01 Start', power: '3000' },
  { name: 'GM', type: 'Mobile Suit', rarity: 'Common', price: '0.25', cost: 2, set: 'GCG01 Start', power: '2000' },
  { name: 'Zeong', type: 'Mobile Suit', rarity: 'Super Rare', price: '15.00', cost: 7, set: 'GCG01 Start', power: '9000' },
  { name: 'Nu Gundam', type: 'Mobile Suit', rarity: 'Super Rare', price: '18.00', cost: 7, set: 'GCG02 Evolution', power: '10000' },
  { name: 'Sazabi', type: 'Mobile Suit', rarity: 'Super Rare', price: '16.00', cost: 7, set: 'GCG02 Evolution', power: '9000' },
  { name: 'Zeta Gundam', type: 'Mobile Suit', rarity: 'Rare', price: '10.00', cost: 6, set: 'GCG02 Evolution', power: '8000' },
  { name: 'ZZ Gundam', type: 'Mobile Suit', rarity: 'Rare', price: '8.00', cost: 6, set: 'GCG02 Evolution', power: '8000' },
  { name: 'The-O', type: 'Mobile Suit', rarity: 'Rare', price: '6.00', cost: 6, set: 'GCG02 Evolution', power: '7000' },
  // Mobile Suits - Alternate Universe
  { name: 'Strike Freedom', type: 'Mobile Suit', rarity: 'Super Rare', price: '20.00', cost: 8, set: 'GCG03 Cosmos', power: '11000' },
  { name: 'Wing Gundam Zero', type: 'Mobile Suit', rarity: 'Super Rare', price: '18.00', cost: 7, set: 'GCG03 Cosmos', power: '10000' },
  { name: 'Unicorn Gundam', type: 'Mobile Suit', rarity: 'Super Rare', price: '22.00', cost: 8, set: 'GCG02 Evolution', power: '11000' },
  { name: 'Barbatos', type: 'Mobile Suit', rarity: 'Rare', price: '9.00', cost: 5, set: 'GCG03 Cosmos', power: '7000' },
  { name: 'Barbatos Lupus Rex', type: 'Mobile Suit', rarity: 'Super Rare', price: '14.00', cost: 7, set: 'GCG03 Cosmos', power: '10000' },
  { name: 'Exia', type: 'Mobile Suit', rarity: 'Rare', price: '7.00', cost: 5, set: 'GCG03 Cosmos', power: '7000' },
  { name: '00 Raiser', type: 'Mobile Suit', rarity: 'Super Rare', price: '16.00', cost: 7, set: 'GCG03 Cosmos', power: '10000' },
  { name: 'Destiny Gundam', type: 'Mobile Suit', rarity: 'Rare', price: '8.00', cost: 6, set: 'GCG03 Cosmos', power: '8000' },
  { name: 'Freedom Gundam', type: 'Mobile Suit', rarity: 'Rare', price: '10.00', cost: 6, set: 'GCG03 Cosmos', power: '8000' },
  { name: 'Turn A Gundam', type: 'Mobile Suit', rarity: 'Super Rare', price: '12.00', cost: 7, set: 'GCG03 Cosmos', power: '9000' },
  { name: 'God Gundam', type: 'Mobile Suit', rarity: 'Super Rare', price: '15.00', cost: 7, set: 'GCG03 Cosmos', power: '10000' },
  { name: 'Tallgeese', type: 'Mobile Suit', rarity: 'Uncommon', price: '3.00', cost: 4, set: 'GCG03 Cosmos', power: '5000' },
  { name: 'Epyon', type: 'Mobile Suit', rarity: 'Rare', price: '7.00', cost: 6, set: 'GCG03 Cosmos', power: '8000' },
  { name: 'Deathscythe Hell', type: 'Mobile Suit', rarity: 'Rare', price: '6.00', cost: 5, set: 'GCG03 Cosmos', power: '7000' },
  // Pilots
  { name: 'Amuro Ray', type: 'Pilot', rarity: 'Rare', price: '8.00', cost: 2, set: 'GCG01 Start' },
  { name: 'Char Aznable', type: 'Pilot', rarity: 'Super Rare', price: '15.00', cost: 2, set: 'GCG01 Start' },
  { name: 'Kamille Bidan', type: 'Pilot', rarity: 'Uncommon', price: '2.00', cost: 2, set: 'GCG02 Evolution' },
  { name: 'Judau Ashta', type: 'Pilot', rarity: 'Common', price: '0.75', cost: 1, set: 'GCG02 Evolution' },
  { name: 'Heero Yuy', type: 'Pilot', rarity: 'Rare', price: '5.00', cost: 2, set: 'GCG03 Cosmos' },
  { name: 'Kira Yamato', type: 'Pilot', rarity: 'Super Rare', price: '10.00', cost: 2, set: 'GCG03 Cosmos' },
  { name: 'Setsuna F. Seiei', type: 'Pilot', rarity: 'Rare', price: '4.00', cost: 2, set: 'GCG03 Cosmos' },
  { name: 'Mikazuki Augus', type: 'Pilot', rarity: 'Rare', price: '5.00', cost: 2, set: 'GCG03 Cosmos' },
  { name: 'Banagher Links', type: 'Pilot', rarity: 'Rare', price: '6.00', cost: 2, set: 'GCG02 Evolution' },
  // Tactics
  { name: 'Beam Rifle Shot', type: 'Tactic', rarity: 'Common', price: '0.25', cost: 1, set: 'GCG01 Start' },
  { name: 'Colony Drop', type: 'Tactic', rarity: 'Super Rare', price: '12.00', cost: 8, set: 'GCG01 Start' },
  { name: 'Newtype Flash', type: 'Tactic', rarity: 'Rare', price: '4.00', cost: 3, set: 'GCG01 Start' },
  { name: 'Funnel Attack', type: 'Tactic', rarity: 'Uncommon', price: '1.50', cost: 2, set: 'GCG02 Evolution' },
  { name: 'Trans-Am', type: 'Tactic', rarity: 'Rare', price: '5.00', cost: 3, set: 'GCG03 Cosmos' },
  { name: 'NT-D System', type: 'Tactic', rarity: 'Rare', price: '4.50', cost: 3, set: 'GCG02 Evolution' },
  { name: 'Solar Ray', type: 'Tactic', rarity: 'Uncommon', price: '2.00', cost: 4, set: 'GCG01 Start' },
  { name: 'Strategic Retreat', type: 'Tactic', rarity: 'Common', price: '0.25', cost: 1, set: 'GCG01 Start' },
  { name: 'Resupply', type: 'Tactic', rarity: 'Common', price: '0.25', cost: 1, set: 'GCG01 Start' },
  // More Mobile Suits - UC (50+)
  { name: 'Gundam Mk-II', type: 'Mobile Suit', rarity: 'Rare', price: '8.00', cost: 5, set: 'GCG02 Evolution', power: '7000' },
  { name: 'Hyaku Shiki', type: 'Mobile Suit', rarity: 'Rare', price: '7.00', cost: 5, set: 'GCG02 Evolution', power: '7000' },
  { name: 'Methuss', type: 'Mobile Suit', rarity: 'Common', price: '0.75', cost: 3, set: 'GCG02 Evolution', power: '4000' },
  { name: 'Qubeley', type: 'Mobile Suit', rarity: 'Super Rare', price: '12.00', cost: 6, set: 'GCG02 Evolution', power: '8000' },
  { name: 'Rick Dias', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.50', cost: 4, set: 'GCG02 Evolution', power: '5000' },
  { name: 'Nemo', type: 'Mobile Suit', rarity: 'Common', price: '0.50', cost: 3, set: 'GCG02 Evolution', power: '4000' },
  { name: 'Dijeh', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.25', cost: 4, set: 'GCG02 Evolution', power: '5000' },
  { name: 'Hizack', type: 'Mobile Suit', rarity: 'Common', price: '0.50', cost: 3, set: 'GCG02 Evolution', power: '4000' },
  { name: 'Marasai', type: 'Mobile Suit', rarity: 'Common', price: '0.50', cost: 3, set: 'GCG02 Evolution', power: '4000' },
  { name: 'Gabthley', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.00', cost: 4, set: 'GCG02 Evolution', power: '5000' },
  { name: 'Barzam', type: 'Mobile Suit', rarity: 'Common', price: '0.50', cost: 3, set: 'GCG02 Evolution', power: '4000' },
  { name: 'Bound Doc', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.50', cost: 5, set: 'GCG02 Evolution', power: '6000' },
  { name: 'Psycho Gundam', type: 'Mobile Suit', rarity: 'Super Rare', price: '15.00', cost: 8, set: 'GCG02 Evolution', power: '10000' },
  { name: 'Palace Athene', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.25', cost: 4, set: 'GCG02 Evolution', power: '5000' },
  { name: 'Messala', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.00', cost: 4, set: 'GCG02 Evolution', power: '5000' },
  { name: 'Baund Doc', type: 'Mobile Suit', rarity: 'Rare', price: '3.50', cost: 5, set: 'GCG02 Evolution', power: '6000' },
  { name: 'Jegan', type: 'Mobile Suit', rarity: 'Common', price: '0.50', cost: 3, set: 'GCG02 Evolution', power: '4000' },
  { name: 'Geara Doga', type: 'Mobile Suit', rarity: 'Common', price: '0.50', cost: 3, set: 'GCG02 Evolution', power: '4000' },
  { name: 'Re-GZ', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.50', cost: 4, set: 'GCG02 Evolution', power: '5000' },
  { name: 'Jagd Doga', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.25', cost: 5, set: 'GCG02 Evolution', power: '6000' },
  { name: 'Alpha Azieru', type: 'Mobile Suit', rarity: 'Rare', price: '4.00', cost: 7, set: 'GCG02 Evolution', power: '8000' },
  { name: 'Kshatriya', type: 'Mobile Suit', rarity: 'Super Rare', price: '14.00', cost: 7, set: 'GCG02 Evolution', power: '9000' },
  { name: 'Sinanju', type: 'Mobile Suit', rarity: 'Super Rare', price: '18.00', cost: 8, set: 'GCG02 Evolution', power: '10000' },
  { name: 'Banshee', type: 'Mobile Suit', rarity: 'Super Rare', price: '16.00', cost: 7, set: 'GCG02 Evolution', power: '9000' },
  { name: 'Rozen Zulu', type: 'Mobile Suit', rarity: 'Rare', price: '5.00', cost: 5, set: 'GCG02 Evolution', power: '6000' },
  { name: 'Delta Plus', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.75', cost: 4, set: 'GCG02 Evolution', power: '5000' },
  { name: 'Byarlant Custom', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.50', cost: 4, set: 'GCG02 Evolution', power: '5000' },
  { name: 'ReZEL', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.25', cost: 4, set: 'GCG02 Evolution', power: '5000' },
  { name: 'Stark Jegan', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.00', cost: 4, set: 'GCG02 Evolution', power: '5000' },
  { name: 'Full Armor Gundam', type: 'Mobile Suit', rarity: 'Rare', price: '6.00', cost: 6, set: 'GCG01 Start', power: '8000' },
  { name: 'Gundam Ground Type', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.75', cost: 4, set: 'GCG01 Start', power: '5000' },
  { name: 'Ez8', type: 'Mobile Suit', rarity: 'Rare', price: '4.00', cost: 5, set: 'GCG01 Start', power: '6000' },
  { name: 'Ball', type: 'Mobile Suit', rarity: 'Common', price: '0.25', cost: 1, set: 'GCG01 Start', power: '2000' },
  { name: 'Core Fighter', type: 'Mobile Suit', rarity: 'Common', price: '0.25', cost: 1, set: 'GCG01 Start', power: '2000' },
  // More Alternate Universe MS
  { name: 'Heavyarms', type: 'Mobile Suit', rarity: 'Rare', price: '6.00', cost: 5, set: 'GCG03 Cosmos', power: '7000' },
  { name: 'Sandrock', type: 'Mobile Suit', rarity: 'Rare', price: '5.00', cost: 5, set: 'GCG03 Cosmos', power: '6000' },
  { name: 'Shenlong', type: 'Mobile Suit', rarity: 'Rare', price: '5.00', cost: 5, set: 'GCG03 Cosmos', power: '6000' },
  { name: 'Altron Gundam', type: 'Mobile Suit', rarity: 'Rare', price: '6.00', cost: 6, set: 'GCG03 Cosmos', power: '7000' },
  { name: 'Mercurius', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.50', cost: 4, set: 'GCG03 Cosmos', power: '5000' },
  { name: 'Vayeate', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.50', cost: 4, set: 'GCG03 Cosmos', power: '5000' },
  { name: 'Leo', type: 'Mobile Suit', rarity: 'Common', price: '0.25', cost: 2, set: 'GCG03 Cosmos', power: '3000' },
  { name: 'Taurus', type: 'Mobile Suit', rarity: 'Common', price: '0.50', cost: 3, set: 'GCG03 Cosmos', power: '4000' },
  { name: 'Virgo', type: 'Mobile Suit', rarity: 'Common', price: '0.50', cost: 3, set: 'GCG03 Cosmos', power: '4000' },
  { name: 'Strike Gundam', type: 'Mobile Suit', rarity: 'Rare', price: '7.00', cost: 5, set: 'GCG03 Cosmos', power: '7000' },
  { name: 'Aegis Gundam', type: 'Mobile Suit', rarity: 'Rare', price: '5.00', cost: 5, set: 'GCG03 Cosmos', power: '6000' },
  { name: 'Buster Gundam', type: 'Mobile Suit', rarity: 'Uncommon', price: '2.00', cost: 4, set: 'GCG03 Cosmos', power: '5000' },
  { name: 'Blitz Gundam', type: 'Mobile Suit', rarity: 'Uncommon', price: '2.00', cost: 4, set: 'GCG03 Cosmos', power: '5000' },
  { name: 'Duel Gundam', type: 'Mobile Suit', rarity: 'Uncommon', price: '2.00', cost: 4, set: 'GCG03 Cosmos', power: '5000' },
  { name: 'Justice Gundam', type: 'Mobile Suit', rarity: 'Rare', price: '6.00', cost: 6, set: 'GCG03 Cosmos', power: '7000' },
  { name: 'Infinite Justice', type: 'Mobile Suit', rarity: 'Super Rare', price: '12.00', cost: 7, set: 'GCG03 Cosmos', power: '9000' },
  { name: 'Akatsuki', type: 'Mobile Suit', rarity: 'Rare', price: '5.00', cost: 5, set: 'GCG03 Cosmos', power: '6000' },
  { name: 'Providence Gundam', type: 'Mobile Suit', rarity: 'Super Rare', price: '14.00', cost: 7, set: 'GCG03 Cosmos', power: '9000' },
  { name: 'Legend Gundam', type: 'Mobile Suit', rarity: 'Rare', price: '6.00', cost: 6, set: 'GCG03 Cosmos', power: '7000' },
  { name: 'GINN', type: 'Mobile Suit', rarity: 'Common', price: '0.25', cost: 2, set: 'GCG03 Cosmos', power: '3000' },
  { name: 'GuAIZ', type: 'Mobile Suit', rarity: 'Common', price: '0.50', cost: 3, set: 'GCG03 Cosmos', power: '4000' },
  { name: 'GOUF Ignited', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.00', cost: 4, set: 'GCG03 Cosmos', power: '5000' },
  { name: 'Zaku Warrior', type: 'Mobile Suit', rarity: 'Common', price: '0.50', cost: 3, set: 'GCG03 Cosmos', power: '4000' },
  { name: 'Murasame', type: 'Mobile Suit', rarity: 'Common', price: '0.50', cost: 3, set: 'GCG03 Cosmos', power: '4000' },
  { name: 'Windam', type: 'Mobile Suit', rarity: 'Common', price: '0.50', cost: 3, set: 'GCG03 Cosmos', power: '4000' },
  { name: 'Dynames', type: 'Mobile Suit', rarity: 'Rare', price: '6.00', cost: 5, set: 'GCG03 Cosmos', power: '6000' },
  { name: 'Kyrios', type: 'Mobile Suit', rarity: 'Rare', price: '5.00', cost: 5, set: 'GCG03 Cosmos', power: '6000' },
  { name: 'Virtue', type: 'Mobile Suit', rarity: 'Rare', price: '5.00', cost: 5, set: 'GCG03 Cosmos', power: '6000' },
  { name: 'Nadleeh', type: 'Mobile Suit', rarity: 'Rare', price: '4.00', cost: 4, set: 'GCG03 Cosmos', power: '5000' },
  { name: 'Cherudim', type: 'Mobile Suit', rarity: 'Rare', price: '7.00', cost: 6, set: 'GCG03 Cosmos', power: '7000' },
  { name: 'Arios', type: 'Mobile Suit', rarity: 'Rare', price: '6.00', cost: 5, set: 'GCG03 Cosmos', power: '6000' },
  { name: 'Seravee', type: 'Mobile Suit', rarity: 'Rare', price: '6.00', cost: 6, set: 'GCG03 Cosmos', power: '7000' },
  { name: 'Reborns Gundam', type: 'Mobile Suit', rarity: 'Super Rare', price: '14.00', cost: 7, set: 'GCG03 Cosmos', power: '9000' },
  { name: 'Flag', type: 'Mobile Suit', rarity: 'Common', price: '0.25', cost: 2, set: 'GCG03 Cosmos', power: '3000' },
  { name: 'Over Flag', type: 'Mobile Suit', rarity: 'Common', price: '0.50', cost: 3, set: 'GCG03 Cosmos', power: '4000' },
  { name: 'GN-X', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.00', cost: 4, set: 'GCG03 Cosmos', power: '5000' },
  { name: 'Tieren', type: 'Mobile Suit', rarity: 'Common', price: '0.25', cost: 2, set: 'GCG03 Cosmos', power: '3000' },
  // Iron-Blooded Orphans
  { name: 'Grimgerde', type: 'Mobile Suit', rarity: 'Uncommon', price: '2.00', cost: 4, set: 'GCG03 Cosmos', power: '5000' },
  { name: 'Gusion', type: 'Mobile Suit', rarity: 'Uncommon', price: '1.50', cost: 4, set: 'GCG03 Cosmos', power: '5000' },
  { name: 'Gusion Rebake', type: 'Mobile Suit', rarity: 'Rare', price: '4.00', cost: 5, set: 'GCG03 Cosmos', power: '6000' },
  { name: 'Flauros', type: 'Mobile Suit', rarity: 'Rare', price: '4.00', cost: 5, set: 'GCG03 Cosmos', power: '6000' },
  { name: 'Bael', type: 'Mobile Suit', rarity: 'Super Rare', price: '15.00', cost: 7, set: 'GCG03 Cosmos', power: '9000' },
  { name: 'Graze', type: 'Mobile Suit', rarity: 'Common', price: '0.25', cost: 2, set: 'GCG03 Cosmos', power: '3000' },
  { name: 'Graze Ein', type: 'Mobile Suit', rarity: 'Rare', price: '5.00', cost: 6, set: 'GCG03 Cosmos', power: '8000' },
  { name: 'Vidar', type: 'Mobile Suit', rarity: 'Rare', price: '6.00', cost: 5, set: 'GCG03 Cosmos', power: '7000' },
  // More Pilots
  { name: 'Lalah Sune', type: 'Pilot', rarity: 'Rare', price: '4.00', cost: 2, set: 'GCG01 Start' },
  { name: 'Sayla Mass', type: 'Pilot', rarity: 'Uncommon', price: '1.50', cost: 1, set: 'GCG01 Start' },
  { name: 'Bright Noa', type: 'Pilot', rarity: 'Uncommon', price: '1.25', cost: 1, set: 'GCG01 Start' },
  { name: 'Kai Shiden', type: 'Pilot', rarity: 'Common', price: '0.50', cost: 1, set: 'GCG01 Start' },
  { name: 'Hayato Kobayashi', type: 'Pilot', rarity: 'Common', price: '0.50', cost: 1, set: 'GCG01 Start' },
  { name: 'Frau Bow', type: 'Pilot', rarity: 'Common', price: '0.25', cost: 1, set: 'GCG01 Start' },
  { name: 'Four Murasame', type: 'Pilot', rarity: 'Rare', price: '3.50', cost: 2, set: 'GCG02 Evolution' },
  { name: 'Paptimus Scirocco', type: 'Pilot', rarity: 'Super Rare', price: '8.00', cost: 2, set: 'GCG02 Evolution' },
  { name: 'Haman Karn', type: 'Pilot', rarity: 'Super Rare', price: '9.00', cost: 2, set: 'GCG02 Evolution' },
  { name: 'Reccoa Londe', type: 'Pilot', rarity: 'Uncommon', price: '1.00', cost: 1, set: 'GCG02 Evolution' },
  { name: 'Emma Sheen', type: 'Pilot', rarity: 'Uncommon', price: '1.25', cost: 1, set: 'GCG02 Evolution' },
  { name: 'Full Frontal', type: 'Pilot', rarity: 'Super Rare', price: '10.00', cost: 2, set: 'GCG02 Evolution' },
  { name: 'Marida Cruz', type: 'Pilot', rarity: 'Rare', price: '4.00', cost: 2, set: 'GCG02 Evolution' },
  { name: 'Riddhe Marcenas', type: 'Pilot', rarity: 'Uncommon', price: '1.50', cost: 1, set: 'GCG02 Evolution' },
  { name: 'Athrun Zala', type: 'Pilot', rarity: 'Rare', price: '5.00', cost: 2, set: 'GCG03 Cosmos' },
  { name: 'Lacus Clyne', type: 'Pilot', rarity: 'Rare', price: '4.00', cost: 2, set: 'GCG03 Cosmos' },
  { name: 'Cagalli Yula Athha', type: 'Pilot', rarity: 'Uncommon', price: '1.50', cost: 1, set: 'GCG03 Cosmos' },
  { name: 'Mu La Flaga', type: 'Pilot', rarity: 'Rare', price: '3.50', cost: 2, set: 'GCG03 Cosmos' },
  { name: 'Rau Le Creuset', type: 'Pilot', rarity: 'Super Rare', price: '8.00', cost: 2, set: 'GCG03 Cosmos' },
  { name: 'Shinn Asuka', type: 'Pilot', rarity: 'Rare', price: '4.00', cost: 2, set: 'GCG03 Cosmos' },
  { name: 'Lockon Stratos', type: 'Pilot', rarity: 'Rare', price: '4.50', cost: 2, set: 'GCG03 Cosmos' },
  { name: 'Allelujah Haptism', type: 'Pilot', rarity: 'Uncommon', price: '2.00', cost: 2, set: 'GCG03 Cosmos' },
  { name: 'Tieria Erde', type: 'Pilot', rarity: 'Uncommon', price: '2.00', cost: 2, set: 'GCG03 Cosmos' },
  { name: 'Orga Itsuka', type: 'Pilot', rarity: 'Rare', price: '3.50', cost: 2, set: 'GCG03 Cosmos' },
  // More Tactics
  { name: 'Hyper Beam Saber', type: 'Tactic', rarity: 'Rare', price: '3.00', cost: 3, set: 'GCG01 Start' },
  { name: 'Shield Block', type: 'Tactic', rarity: 'Common', price: '0.25', cost: 1, set: 'GCG01 Start' },
  { name: 'Flanking Maneuver', type: 'Tactic', rarity: 'Uncommon', price: '0.75', cost: 2, set: 'GCG01 Start' },
  { name: 'Coordinate Attack', type: 'Tactic', rarity: 'Uncommon', price: '1.00', cost: 2, set: 'GCG01 Start' },
  { name: 'Emergency Repair', type: 'Tactic', rarity: 'Common', price: '0.25', cost: 1, set: 'GCG01 Start' },
  { name: 'AMBAC Maneuver', type: 'Tactic', rarity: 'Uncommon', price: '0.75', cost: 2, set: 'GCG01 Start' },
  { name: 'Psycommu System', type: 'Tactic', rarity: 'Rare', price: '4.00', cost: 3, set: 'GCG02 Evolution' },
  { name: 'Awakening', type: 'Tactic', rarity: 'Super Rare', price: '8.00', cost: 4, set: 'GCG02 Evolution' },
  { name: 'Full Burst', type: 'Tactic', rarity: 'Rare', price: '5.00', cost: 4, set: 'GCG03 Cosmos' },
  { name: 'METEOR Strike', type: 'Tactic', rarity: 'Super Rare', price: '10.00', cost: 6, set: 'GCG03 Cosmos' },
  { name: 'GN Field', type: 'Tactic', rarity: 'Uncommon', price: '1.50', cost: 2, set: 'GCG03 Cosmos' },
  { name: 'Alaya-Vijnana', type: 'Tactic', rarity: 'Rare', price: '4.00', cost: 3, set: 'GCG03 Cosmos' },
];

const LORCANA_CARDS: Array<{ name: string; type: string; rarity: string; price: string; cost: number; set: string; inkColor: string; strength?: string; willpower?: string; lore?: string }> = [
  // Characters - Amber
  { name: 'Elsa - Spirit of Winter', type: 'Character', rarity: 'Enchanted', price: '85.00', cost: 8, set: 'TFC The First Chapter', inkColor: 'Amber', strength: '4', willpower: '6', lore: '3' },
  { name: 'Rapunzel - Gifted with Healing', type: 'Character', rarity: 'Rare', price: '6.00', cost: 4, set: 'TFC The First Chapter', inkColor: 'Amber', strength: '2', willpower: '4', lore: '2' },
  { name: 'Simba - Returned King', type: 'Character', rarity: 'Super Rare', price: '10.00', cost: 6, set: 'TFC The First Chapter', inkColor: 'Amber', strength: '4', willpower: '5', lore: '2' },
  { name: 'Cinderella - Gentle and Kind', type: 'Character', rarity: 'Common', price: '0.25', cost: 2, set: 'TFC The First Chapter', inkColor: 'Amber', strength: '1', willpower: '3', lore: '1' },
  { name: 'Snow White - Well Wisher', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 3, set: 'TFC The First Chapter', inkColor: 'Amber', strength: '2', willpower: '3', lore: '1' },
  { name: 'Aurora - Dreaming Guardian', type: 'Character', rarity: 'Rare', price: '3.50', cost: 5, set: 'ROF Rise of the Floodborn', inkColor: 'Amber', strength: '3', willpower: '5', lore: '2' },
  { name: 'Moana - Of Motunui', type: 'Character', rarity: 'Uncommon', price: '1.50', cost: 3, set: 'TFC The First Chapter', inkColor: 'Amber', strength: '2', willpower: '3', lore: '1' },
  // Characters - Amethyst
  { name: 'Mickey Mouse - Brave Little Tailor', type: 'Character', rarity: 'Super Rare', price: '12.00', cost: 5, set: 'TFC The First Chapter', inkColor: 'Amethyst', strength: '3', willpower: '4', lore: '2' },
  { name: 'Genie - On the Job', type: 'Character', rarity: 'Rare', price: '4.00', cost: 4, set: 'TFC The First Chapter', inkColor: 'Amethyst', strength: '3', willpower: '3', lore: '1' },
  { name: 'Ursula - Power Hungry', type: 'Character', rarity: 'Super Rare', price: '8.00', cost: 6, set: 'TFC The First Chapter', inkColor: 'Amethyst', strength: '3', willpower: '5', lore: '2' },
  { name: 'Merlin - Goat', type: 'Character', rarity: 'Common', price: '0.25', cost: 3, set: 'TFC The First Chapter', inkColor: 'Amethyst', strength: '2', willpower: '3', lore: '1' },
  { name: 'Yen Sid - Powerful Sorcerer', type: 'Character', rarity: 'Rare', price: '3.00', cost: 5, set: 'ROF Rise of the Floodborn', inkColor: 'Amethyst', strength: '2', willpower: '5', lore: '2' },
  // Characters - Emerald
  { name: 'Aladdin - Prince Ali', type: 'Character', rarity: 'Rare', price: '4.50', cost: 4, set: 'TFC The First Chapter', inkColor: 'Emerald', strength: '3', willpower: '3', lore: '2' },
  { name: 'Peter Pan - Never Landing', type: 'Character', rarity: 'Super Rare', price: '9.00', cost: 3, set: 'TFC The First Chapter', inkColor: 'Emerald', strength: '3', willpower: '2', lore: '2' },
  { name: 'Robin Hood - Unrivaled Archer', type: 'Character', rarity: 'Uncommon', price: '1.25', cost: 3, set: 'ROF Rise of the Floodborn', inkColor: 'Emerald', strength: '3', willpower: '2', lore: '1' },
  { name: 'Flynn Rider - Charming Rogue', type: 'Character', rarity: 'Common', price: '0.50', cost: 2, set: 'TFC The First Chapter', inkColor: 'Emerald', strength: '2', willpower: '2', lore: '1' },
  { name: 'Jasmine - Desert Princess', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 3, set: 'TFC The First Chapter', inkColor: 'Emerald', strength: '2', willpower: '3', lore: '1' },
  // Characters - Ruby
  { name: 'Stitch - Carefree Surfer', type: 'Character', rarity: 'Rare', price: '5.00', cost: 3, set: 'TFC The First Chapter', inkColor: 'Ruby', strength: '3', willpower: '3', lore: '1' },
  { name: 'Maui - Hero to All', type: 'Character', rarity: 'Super Rare', price: '7.00', cost: 5, set: 'TFC The First Chapter', inkColor: 'Ruby', strength: '4', willpower: '5', lore: '1' },
  { name: 'Hercules - True Hero', type: 'Character', rarity: 'Rare', price: '4.00', cost: 6, set: 'ROF Rise of the Floodborn', inkColor: 'Ruby', strength: '5', willpower: '5', lore: '2' },
  { name: 'Beast - Wolfsbane', type: 'Character', rarity: 'Uncommon', price: '1.50', cost: 5, set: 'TFC The First Chapter', inkColor: 'Ruby', strength: '4', willpower: '5', lore: '1' },
  { name: 'Gaston - Arrogant Hunter', type: 'Character', rarity: 'Common', price: '0.50', cost: 4, set: 'TFC The First Chapter', inkColor: 'Ruby', strength: '4', willpower: '3', lore: '1' },
  // Characters - Sapphire
  { name: 'Belle - Strange but Special', type: 'Character', rarity: 'Uncommon', price: '2.00', cost: 3, set: 'TFC The First Chapter', inkColor: 'Sapphire', strength: '2', willpower: '3', lore: '2' },
  { name: 'Hades - King of Olympus', type: 'Character', rarity: 'Legendary', price: '18.00', cost: 7, set: 'ROF Rise of the Floodborn', inkColor: 'Sapphire', strength: '3', willpower: '6', lore: '3' },
  { name: 'Cogsworth - Grandfather Clock', type: 'Character', rarity: 'Common', price: '0.25', cost: 2, set: 'TFC The First Chapter', inkColor: 'Sapphire', strength: '1', willpower: '3', lore: '1' },
  { name: 'Lumiere - Candlestick', type: 'Character', rarity: 'Common', price: '0.25', cost: 2, set: 'TFC The First Chapter', inkColor: 'Sapphire', strength: '1', willpower: '2', lore: '1' },
  // Characters - Steel
  { name: 'Maleficent - Monstrous Dragon', type: 'Character', rarity: 'Legendary', price: '25.00', cost: 8, set: 'TFC The First Chapter', inkColor: 'Steel', strength: '5', willpower: '7', lore: '3' },
  { name: 'Captain Hook - Captain of the Jolly Roger', type: 'Character', rarity: 'Rare', price: '3.50', cost: 5, set: 'TFC The First Chapter', inkColor: 'Steel', strength: '3', willpower: '5', lore: '1' },
  { name: 'Scar - Vicious Cheater', type: 'Character', rarity: 'Super Rare', price: '8.00', cost: 6, set: 'ROF Rise of the Floodborn', inkColor: 'Steel', strength: '4', willpower: '4', lore: '2' },
  { name: 'Cruella De Vil - Miserable as Usual', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 4, set: 'TFC The First Chapter', inkColor: 'Steel', strength: '2', willpower: '4', lore: '1' },
  { name: 'Jafar - Royal Vizier', type: 'Character', rarity: 'Rare', price: '3.00', cost: 5, set: 'TFC The First Chapter', inkColor: 'Steel', strength: '3', willpower: '4', lore: '2' },
  // Actions
  { name: 'Freeze', type: 'Action', rarity: 'Common', price: '0.25', cost: 2, set: 'TFC The First Chapter', inkColor: 'Amber' },
  { name: 'Befuddle', type: 'Action', rarity: 'Common', price: '0.25', cost: 1, set: 'TFC The First Chapter', inkColor: 'Amethyst' },
  { name: 'Stolen Scimitar', type: 'Action', rarity: 'Uncommon', price: '0.75', cost: 2, set: 'TFC The First Chapter', inkColor: 'Emerald' },
  { name: 'Dragon Fire', type: 'Action', rarity: 'Rare', price: '5.00', cost: 5, set: 'TFC The First Chapter', inkColor: 'Steel' },
  { name: 'Smash', type: 'Action', rarity: 'Common', price: '0.25', cost: 1, set: 'TFC The First Chapter', inkColor: 'Ruby' },
  { name: 'Develop Your Brain', type: 'Action', rarity: 'Common', price: '0.25', cost: 1, set: 'TFC The First Chapter', inkColor: 'Sapphire' },
  { name: 'Whole New World', type: 'Action', rarity: 'Super Rare', price: '12.00', cost: 5, set: 'TFC The First Chapter', inkColor: 'Amber' },
  { name: 'Be Prepared', type: 'Action', rarity: 'Super Rare', price: '10.00', cost: 5, set: 'TFC The First Chapter', inkColor: 'Steel' },
  // Items
  { name: 'Magic Mirror', type: 'Item', rarity: 'Rare', price: '3.00', cost: 2, set: 'TFC The First Chapter', inkColor: 'Amethyst' },
  { name: 'Poisoned Apple', type: 'Item', rarity: 'Uncommon', price: '1.00', cost: 1, set: 'TFC The First Chapter', inkColor: 'Steel' },
  { name: 'Sorcerer\'s Hat', type: 'Item', rarity: 'Rare', price: '4.00', cost: 3, set: 'TFC The First Chapter', inkColor: 'Amethyst' },
  { name: 'Lantern', type: 'Item', rarity: 'Common', price: '0.25', cost: 1, set: 'TFC The First Chapter', inkColor: 'Amber' },
  { name: 'Trident', type: 'Item', rarity: 'Rare', price: '3.50', cost: 3, set: 'ROF Rise of the Floodborn', inkColor: 'Sapphire' },
  // More Characters
  { name: 'Ariel - Spectacular Singer', type: 'Character', rarity: 'Super Rare', price: '8.00', cost: 5, set: 'TFC The First Chapter', inkColor: 'Amber', strength: '3', willpower: '5', lore: '2' },
  { name: 'Sebastian - Court Composer', type: 'Character', rarity: 'Common', price: '0.25', cost: 2, set: 'TFC The First Chapter', inkColor: 'Amber', strength: '1', willpower: '2', lore: '1' },
  { name: 'Flounder - Voice of Reason', type: 'Character', rarity: 'Common', price: '0.25', cost: 1, set: 'TFC The First Chapter', inkColor: 'Sapphire', strength: '0', willpower: '2', lore: '1' },
  { name: 'Tinker Bell - Giant Fairy', type: 'Character', rarity: 'Super Rare', price: '12.00', cost: 4, set: 'TFC The First Chapter', inkColor: 'Emerald', strength: '2', willpower: '4', lore: '2' },
  { name: 'Tinker Bell - Tiny Tactician', type: 'Character', rarity: 'Uncommon', price: '1.50', cost: 2, set: 'ROF Rise of the Floodborn', inkColor: 'Emerald', strength: '1', willpower: '2', lore: '1' },
  { name: 'Captain Hook - Forceful Duelist', type: 'Character', rarity: 'Rare', price: '4.00', cost: 6, set: 'ROF Rise of the Floodborn', inkColor: 'Steel', strength: '4', willpower: '5', lore: '2' },
  { name: 'Mr. Smee - Loyal First Mate', type: 'Character', rarity: 'Common', price: '0.25', cost: 2, set: 'TFC The First Chapter', inkColor: 'Steel', strength: '1', willpower: '3', lore: '1' },
  { name: 'Pongo - Determined Father', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 3, set: 'TFC The First Chapter', inkColor: 'Amber', strength: '2', willpower: '3', lore: '1' },
  { name: 'Perdita - Devoted Mother', type: 'Character', rarity: 'Common', price: '0.50', cost: 2, set: 'TFC The First Chapter', inkColor: 'Amber', strength: '1', willpower: '3', lore: '1' },
  { name: 'Dalmatian Puppy - Adventurous Pup', type: 'Character', rarity: 'Common', price: '0.25', cost: 1, set: 'TFC The First Chapter', inkColor: 'Amber', strength: '1', willpower: '1', lore: '1' },
  { name: 'Mulan - Imperial Soldier', type: 'Character', rarity: 'Super Rare', price: '9.00', cost: 5, set: 'ROF Rise of the Floodborn', inkColor: 'Steel', strength: '4', willpower: '5', lore: '2' },
  { name: 'Mushu - Lucky Cricket', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 2, set: 'ROF Rise of the Floodborn', inkColor: 'Ruby', strength: '1', willpower: '2', lore: '1' },
  { name: 'Li Shang - Captain', type: 'Character', rarity: 'Rare', price: '3.00', cost: 4, set: 'ROF Rise of the Floodborn', inkColor: 'Steel', strength: '3', willpower: '4', lore: '1' },
  { name: 'Donald Duck - Musketeer', type: 'Character', rarity: 'Uncommon', price: '1.25', cost: 3, set: 'TFC The First Chapter', inkColor: 'Amethyst', strength: '2', willpower: '3', lore: '1' },
  { name: 'Goofy - Musketeer', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 3, set: 'TFC The First Chapter', inkColor: 'Emerald', strength: '2', willpower: '4', lore: '1' },
  { name: 'Pluto - Friendly Pooch', type: 'Character', rarity: 'Common', price: '0.50', cost: 2, set: 'TFC The First Chapter', inkColor: 'Ruby', strength: '2', willpower: '2', lore: '1' },
  { name: 'Minnie Mouse - Beloved Princess', type: 'Character', rarity: 'Rare', price: '4.00', cost: 4, set: 'TFC The First Chapter', inkColor: 'Amber', strength: '2', willpower: '4', lore: '2' },
  { name: 'Daisy Duck - Secret Agent', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 3, set: 'ROF Rise of the Floodborn', inkColor: 'Amethyst', strength: '2', willpower: '3', lore: '1' },
  { name: 'Scrooge McDuck - Richest Duck', type: 'Character', rarity: 'Rare', price: '3.50', cost: 4, set: 'ROF Rise of the Floodborn', inkColor: 'Sapphire', strength: '2', willpower: '4', lore: '2' },
  { name: 'Bambi - Young Prince', type: 'Character', rarity: 'Uncommon', price: '0.75', cost: 2, set: 'TFC The First Chapter', inkColor: 'Amber', strength: '1', willpower: '3', lore: '1' },
  { name: 'Thumper - Rabbit Friend', type: 'Character', rarity: 'Common', price: '0.25', cost: 1, set: 'TFC The First Chapter', inkColor: 'Emerald', strength: '1', willpower: '1', lore: '1' },
  { name: 'Dumbo - Flying Elephant', type: 'Character', rarity: 'Rare', price: '3.00', cost: 4, set: 'TFC The First Chapter', inkColor: 'Sapphire', strength: '2', willpower: '4', lore: '2' },
  { name: 'Timothy Q. Mouse', type: 'Character', rarity: 'Common', price: '0.25', cost: 1, set: 'TFC The First Chapter', inkColor: 'Emerald', strength: '0', willpower: '2', lore: '1' },
  { name: 'Woody - Sheriff', type: 'Character', rarity: 'Rare', price: '3.50', cost: 4, set: 'ROF Rise of the Floodborn', inkColor: 'Amber', strength: '2', willpower: '4', lore: '2' },
  { name: 'Buzz Lightyear - Space Ranger', type: 'Character', rarity: 'Super Rare', price: '7.00', cost: 5, set: 'ROF Rise of the Floodborn', inkColor: 'Steel', strength: '3', willpower: '5', lore: '2' },
  { name: 'Jessie - Yodeling Cowgirl', type: 'Character', rarity: 'Uncommon', price: '1.25', cost: 3, set: 'ROF Rise of the Floodborn', inkColor: 'Ruby', strength: '2', willpower: '3', lore: '1' },
  { name: 'Rex - Nervous Dinosaur', type: 'Character', rarity: 'Common', price: '0.50', cost: 2, set: 'ROF Rise of the Floodborn', inkColor: 'Emerald', strength: '1', willpower: '3', lore: '1' },
  { name: 'Baloo - von Bruinwald XIII', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 4, set: 'ROF Rise of the Floodborn', inkColor: 'Emerald', strength: '3', willpower: '4', lore: '1' },
  { name: 'Mowgli - Man Cub', type: 'Character', rarity: 'Common', price: '0.50', cost: 2, set: 'ROF Rise of the Floodborn', inkColor: 'Ruby', strength: '1', willpower: '3', lore: '1' },
  { name: 'Shere Khan - Menacing Predator', type: 'Character', rarity: 'Rare', price: '4.00', cost: 5, set: 'ROF Rise of the Floodborn', inkColor: 'Steel', strength: '4', willpower: '4', lore: '1' },
  { name: 'Kaa - Slippery Snake', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 3, set: 'ROF Rise of the Floodborn', inkColor: 'Amethyst', strength: '2', willpower: '3', lore: '1' },
  { name: 'Pocahontas - Daughter of the Chief', type: 'Character', rarity: 'Rare', price: '3.50', cost: 4, set: 'ROF Rise of the Floodborn', inkColor: 'Emerald', strength: '2', willpower: '4', lore: '2' },
  { name: 'Meeko - Loyal Raccoon', type: 'Character', rarity: 'Common', price: '0.25', cost: 1, set: 'ROF Rise of the Floodborn', inkColor: 'Emerald', strength: '1', willpower: '1', lore: '1' },
  { name: 'John Smith - Explorer', type: 'Character', rarity: 'Uncommon', price: '1.25', cost: 3, set: 'ROF Rise of the Floodborn', inkColor: 'Ruby', strength: '2', willpower: '3', lore: '1' },
  { name: 'Pinocchio - Talkative Puppet', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 2, set: 'TFC The First Chapter', inkColor: 'Sapphire', strength: '1', willpower: '3', lore: '1' },
  { name: 'Jiminy Cricket - Conscience', type: 'Character', rarity: 'Uncommon', price: '1.50', cost: 2, set: 'TFC The First Chapter', inkColor: 'Emerald', strength: '0', willpower: '3', lore: '1' },
  { name: 'Geppetto - Toymaker', type: 'Character', rarity: 'Common', price: '0.25', cost: 2, set: 'TFC The First Chapter', inkColor: 'Sapphire', strength: '1', willpower: '3', lore: '1' },
  { name: 'Figaro - Pampered Cat', type: 'Character', rarity: 'Common', price: '0.25', cost: 1, set: 'TFC The First Chapter', inkColor: 'Amber', strength: '1', willpower: '1', lore: '1' },
  { name: 'Alice - Growing Girl', type: 'Character', rarity: 'Rare', price: '3.00', cost: 4, set: 'TFC The First Chapter', inkColor: 'Amethyst', strength: '2', willpower: '4', lore: '2' },
  { name: 'Queen of Hearts - Impulsive Ruler', type: 'Character', rarity: 'Rare', price: '3.50', cost: 5, set: 'TFC The First Chapter', inkColor: 'Ruby', strength: '3', willpower: '5', lore: '1' },
  { name: 'Cheshire Cat - Not All There', type: 'Character', rarity: 'Super Rare', price: '10.00', cost: 4, set: 'TFC The First Chapter', inkColor: 'Amethyst', strength: '2', willpower: '3', lore: '2' },
  { name: 'Mad Hatter - Gracious Host', type: 'Character', rarity: 'Uncommon', price: '1.25', cost: 3, set: 'TFC The First Chapter', inkColor: 'Amethyst', strength: '1', willpower: '4', lore: '1' },
  { name: 'White Rabbit - Hurried', type: 'Character', rarity: 'Common', price: '0.50', cost: 2, set: 'TFC The First Chapter', inkColor: 'Sapphire', strength: '1', willpower: '2', lore: '1' },
  { name: 'Wreck-It Ralph - Wrecking Ball', type: 'Character', rarity: 'Super Rare', price: '8.00', cost: 6, set: 'ROF Rise of the Floodborn', inkColor: 'Ruby', strength: '5', willpower: '6', lore: '1' },
  { name: 'Vanellope - Glitch', type: 'Character', rarity: 'Rare', price: '4.00', cost: 3, set: 'ROF Rise of the Floodborn', inkColor: 'Amethyst', strength: '2', willpower: '3', lore: '2' },
  { name: 'Fix-It Felix Jr.', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 3, set: 'ROF Rise of the Floodborn', inkColor: 'Amber', strength: '1', willpower: '4', lore: '1' },
  { name: 'Tiana - Celebrating Princess', type: 'Character', rarity: 'Super Rare', price: '10.00', cost: 5, set: 'TFC The First Chapter', inkColor: 'Amber', strength: '3', willpower: '5', lore: '2' },
  { name: 'Prince Naveen - Penniless Royal', type: 'Character', rarity: 'Uncommon', price: '1.25', cost: 3, set: 'TFC The First Chapter', inkColor: 'Emerald', strength: '2', willpower: '3', lore: '1' },
  { name: 'Louis - Jazz Musician', type: 'Character', rarity: 'Uncommon', price: '1.00', cost: 4, set: 'TFC The First Chapter', inkColor: 'Ruby', strength: '3', willpower: '4', lore: '1' },
  { name: 'Dr. Facilier - Agent Provocateur', type: 'Character', rarity: 'Rare', price: '4.50', cost: 5, set: 'TFC The First Chapter', inkColor: 'Steel', strength: '2', willpower: '4', lore: '2' },
  { name: 'Mama Odie - Voice of Wisdom', type: 'Character', rarity: 'Uncommon', price: '1.50', cost: 4, set: 'TFC The First Chapter', inkColor: 'Amethyst', strength: '1', willpower: '5', lore: '2' },
  // More Actions
  { name: 'Let It Go', type: 'Action', rarity: 'Super Rare', price: '10.00', cost: 4, set: 'TFC The First Chapter', inkColor: 'Amber' },
  { name: 'Fire the Cannons!', type: 'Action', rarity: 'Uncommon', price: '1.00', cost: 3, set: 'TFC The First Chapter', inkColor: 'Steel' },
  { name: 'Grab Your Sword', type: 'Action', rarity: 'Common', price: '0.25', cost: 2, set: 'TFC The First Chapter', inkColor: 'Steel' },
  { name: 'Breaking and Entering', type: 'Action', rarity: 'Uncommon', price: '0.75', cost: 2, set: 'TFC The First Chapter', inkColor: 'Emerald' },
  { name: 'Strength of a Raging Fire', type: 'Action', rarity: 'Rare', price: '3.00', cost: 3, set: 'ROF Rise of the Floodborn', inkColor: 'Ruby' },
  { name: 'Cut to the Chase', type: 'Action', rarity: 'Common', price: '0.25', cost: 1, set: 'ROF Rise of the Floodborn', inkColor: 'Emerald' },
  { name: 'Mother Knows Best', type: 'Action', rarity: 'Uncommon', price: '1.00', cost: 3, set: 'TFC The First Chapter', inkColor: 'Amethyst' },
  { name: 'Feel the Power', type: 'Action', rarity: 'Uncommon', price: '0.75', cost: 2, set: 'TFC The First Chapter', inkColor: 'Amethyst' },
  { name: 'A Pirate\'s Life', type: 'Action', rarity: 'Common', price: '0.50', cost: 2, set: 'TFC The First Chapter', inkColor: 'Steel' },
  { name: 'Charge!', type: 'Action', rarity: 'Common', price: '0.25', cost: 1, set: 'TFC The First Chapter', inkColor: 'Ruby' },
  { name: 'Into the Unknown', type: 'Action', rarity: 'Rare', price: '4.00', cost: 4, set: 'ROF Rise of the Floodborn', inkColor: 'Sapphire' },
  { name: 'Under the Sea', type: 'Action', rarity: 'Rare', price: '3.50', cost: 3, set: 'TFC The First Chapter', inkColor: 'Amber' },
  { name: 'Reflection', type: 'Action', rarity: 'Uncommon', price: '1.00', cost: 2, set: 'ROF Rise of the Floodborn', inkColor: 'Sapphire' },
  { name: 'Bibbidi Bobbidi Boo', type: 'Action', rarity: 'Rare', price: '5.00', cost: 4, set: 'TFC The First Chapter', inkColor: 'Amethyst' },
  // More Items
  { name: 'Frying Pan', type: 'Item', rarity: 'Uncommon', price: '1.00', cost: 2, set: 'TFC The First Chapter', inkColor: 'Ruby' },
  { name: 'Glass Slipper', type: 'Item', rarity: 'Rare', price: '4.00', cost: 3, set: 'TFC The First Chapter', inkColor: 'Amber' },
  { name: 'Enchanted Compass', type: 'Item', rarity: 'Uncommon', price: '1.25', cost: 2, set: 'TFC The First Chapter', inkColor: 'Emerald' },
  { name: 'Beast\'s Mirror', type: 'Item', rarity: 'Rare', price: '3.50', cost: 3, set: 'TFC The First Chapter', inkColor: 'Sapphire' },
  { name: 'Pawpsicle', type: 'Item', rarity: 'Common', price: '0.50', cost: 1, set: 'ROF Rise of the Floodborn', inkColor: 'Emerald' },
  { name: 'Dinglehopper', type: 'Item', rarity: 'Common', price: '0.50', cost: 1, set: 'TFC The First Chapter', inkColor: 'Amber' },
  { name: 'Shield of Virtue', type: 'Item', rarity: 'Uncommon', price: '1.50', cost: 2, set: 'TFC The First Chapter', inkColor: 'Amber' },
  { name: 'Sword of Truth', type: 'Item', rarity: 'Rare', price: '4.00', cost: 3, set: 'TFC The First Chapter', inkColor: 'Steel' },
];

const SPORTS_CARDS: Array<{ name: string; type: string; rarity: string; price: string; year: number; set: string; team: string }> = [
  // Basketball
  { name: 'Michael Jordan Rookie', type: 'Basketball', rarity: 'Ultra Rare', price: '3200.00', year: 1986, set: 'Fleer', team: 'Chicago Bulls' },
  { name: 'LeBron James Rookie', type: 'Basketball', rarity: 'Ultra Rare', price: '1500.00', year: 2003, set: 'Topps Chrome', team: 'Cleveland Cavaliers' },
  { name: 'Luka Doncic Rookie', type: 'Basketball', rarity: 'Rare', price: '280.00', year: 2018, set: 'Panini Prizm', team: 'Dallas Mavericks' },
  { name: 'Stephen Curry Rookie', type: 'Basketball', rarity: 'Rare', price: '350.00', year: 2009, set: 'Topps', team: 'Golden State Warriors' },
  { name: 'Kobe Bryant Rookie', type: 'Basketball', rarity: 'Ultra Rare', price: '800.00', year: 1996, set: 'Topps Chrome', team: 'Los Angeles Lakers' },
  { name: 'Giannis Antetokounmpo Rookie', type: 'Basketball', rarity: 'Rare', price: '180.00', year: 2013, set: 'Panini NBA Hoops', team: 'Milwaukee Bucks' },
  { name: 'Jayson Tatum Rookie', type: 'Basketball', rarity: 'Uncommon', price: '65.00', year: 2017, set: 'Panini Prizm', team: 'Boston Celtics' },
  { name: 'Kevin Durant Rookie', type: 'Basketball', rarity: 'Rare', price: '250.00', year: 2007, set: 'Topps', team: 'Seattle SuperSonics' },
  { name: 'Wilt Chamberlain Vintage', type: 'Basketball', rarity: 'Ultra Rare', price: '5500.00', year: 1961, set: 'Fleer', team: 'Philadelphia Warriors' },
  { name: 'Larry Bird Rookie', type: 'Basketball', rarity: 'Rare', price: '400.00', year: 1980, set: 'Topps', team: 'Boston Celtics' },
  { name: 'Magic Johnson Rookie', type: 'Basketball', rarity: 'Rare', price: '350.00', year: 1980, set: 'Topps', team: 'Los Angeles Lakers' },
  { name: 'Victor Wembanyama Rookie', type: 'Basketball', rarity: 'Rare', price: '120.00', year: 2023, set: 'Panini Prizm', team: 'San Antonio Spurs' },
  // Football
  { name: 'Tom Brady Rookie', type: 'Football', rarity: 'Ultra Rare', price: '800.00', year: 2000, set: 'Bowman Chrome', team: 'New England Patriots' },
  { name: 'Patrick Mahomes Rookie', type: 'Football', rarity: 'Rare', price: '450.00', year: 2017, set: 'Panini Prizm', team: 'Kansas City Chiefs' },
  { name: 'Josh Allen Rookie', type: 'Football', rarity: 'Rare', price: '200.00', year: 2018, set: 'Panini Prizm', team: 'Buffalo Bills' },
  { name: 'Joe Montana Rookie', type: 'Football', rarity: 'Rare', price: '300.00', year: 1981, set: 'Topps', team: 'San Francisco 49ers' },
  { name: 'Peyton Manning Rookie', type: 'Football', rarity: 'Rare', price: '150.00', year: 1998, set: 'Topps Chrome', team: 'Indianapolis Colts' },
  { name: 'Lamar Jackson Rookie', type: 'Football', rarity: 'Uncommon', price: '45.00', year: 2018, set: 'Panini Prizm', team: 'Baltimore Ravens' },
  { name: 'Jerry Rice Rookie', type: 'Football', rarity: 'Rare', price: '180.00', year: 1986, set: 'Topps', team: 'San Francisco 49ers' },
  { name: 'CJ Stroud Rookie', type: 'Football', rarity: 'Uncommon', price: '55.00', year: 2023, set: 'Panini Prizm', team: 'Houston Texans' },
  // Baseball
  { name: 'Mike Trout Rookie', type: 'Baseball', rarity: 'Rare', price: '600.00', year: 2011, set: 'Topps Update', team: 'Los Angeles Angels' },
  { name: 'Shohei Ohtani Rookie', type: 'Baseball', rarity: 'Rare', price: '350.00', year: 2018, set: 'Topps', team: 'Los Angeles Angels' },
  { name: 'Ken Griffey Jr. Rookie', type: 'Baseball', rarity: 'Rare', price: '250.00', year: 1989, set: 'Upper Deck', team: 'Seattle Mariners' },
  { name: 'Derek Jeter Rookie', type: 'Baseball', rarity: 'Rare', price: '180.00', year: 1993, set: 'SP', team: 'New York Yankees' },
  { name: 'Mickey Mantle Vintage', type: 'Baseball', rarity: 'Ultra Rare', price: '8000.00', year: 1952, set: 'Topps', team: 'New York Yankees' },
  { name: 'Babe Ruth Vintage', type: 'Baseball', rarity: 'Ultra Rare', price: '15000.00', year: 1933, set: 'Goudey', team: 'New York Yankees' },
  { name: 'Ronald Acuna Jr. Rookie', type: 'Baseball', rarity: 'Uncommon', price: '80.00', year: 2018, set: 'Topps Chrome', team: 'Atlanta Braves' },
  { name: 'Juan Soto Rookie', type: 'Baseball', rarity: 'Uncommon', price: '65.00', year: 2018, set: 'Topps Chrome', team: 'Washington Nationals' },
  // Hockey
  { name: 'Wayne Gretzky Rookie', type: 'Hockey', rarity: 'Ultra Rare', price: '2500.00', year: 1979, set: 'O-Pee-Chee', team: 'Edmonton Oilers' },
  { name: 'Connor McDavid Rookie', type: 'Hockey', rarity: 'Rare', price: '320.00', year: 2015, set: 'Upper Deck Young Guns', team: 'Edmonton Oilers' },
  { name: 'Sidney Crosby Rookie', type: 'Hockey', rarity: 'Rare', price: '200.00', year: 2005, set: 'Upper Deck Young Guns', team: 'Pittsburgh Penguins' },
  { name: 'Mario Lemieux Rookie', type: 'Hockey', rarity: 'Rare', price: '350.00', year: 1985, set: 'O-Pee-Chee', team: 'Pittsburgh Penguins' },
  { name: 'Bobby Orr Vintage', type: 'Hockey', rarity: 'Ultra Rare', price: '1200.00', year: 1966, set: 'Topps', team: 'Boston Bruins' },
  { name: 'Alex Ovechkin Rookie', type: 'Hockey', rarity: 'Rare', price: '150.00', year: 2005, set: 'Upper Deck Young Guns', team: 'Washington Capitals' },
  { name: 'Auston Matthews Rookie', type: 'Hockey', rarity: 'Uncommon', price: '90.00', year: 2016, set: 'Upper Deck Young Guns', team: 'Toronto Maple Leafs' },
  // Soccer
  { name: 'Lionel Messi Rookie', type: 'Soccer', rarity: 'Ultra Rare', price: '1800.00', year: 2004, set: 'Panini Mega Cracks', team: 'FC Barcelona' },
  { name: 'Cristiano Ronaldo Rookie', type: 'Soccer', rarity: 'Ultra Rare', price: '1200.00', year: 2003, set: 'Panini', team: 'Manchester United' },
  { name: 'Erling Haaland Rookie', type: 'Soccer', rarity: 'Rare', price: '180.00', year: 2019, set: 'Topps Chrome', team: 'Red Bull Salzburg' },
  { name: 'Kylian Mbappe Rookie', type: 'Soccer', rarity: 'Rare', price: '250.00', year: 2016, set: 'Topps Chrome', team: 'AS Monaco' },
  { name: 'Jude Bellingham Rookie', type: 'Soccer', rarity: 'Uncommon', price: '85.00', year: 2020, set: 'Topps Chrome', team: 'Borussia Dortmund' },
  // More Basketball
  { name: 'Shaquille O\'Neal Rookie', type: 'Basketball', rarity: 'Rare', price: '220.00', year: 1992, set: 'Topps', team: 'Orlando Magic' },
  { name: 'Tim Duncan Rookie', type: 'Basketball', rarity: 'Rare', price: '150.00', year: 1997, set: 'Topps', team: 'San Antonio Spurs' },
  { name: 'Dirk Nowitzki Rookie', type: 'Basketball', rarity: 'Uncommon', price: '80.00', year: 1998, set: 'Topps', team: 'Dallas Mavericks' },
  { name: 'Allen Iverson Rookie', type: 'Basketball', rarity: 'Rare', price: '200.00', year: 1996, set: 'Topps Chrome', team: 'Philadelphia 76ers' },
  { name: 'Dwyane Wade Rookie', type: 'Basketball', rarity: 'Rare', price: '120.00', year: 2003, set: 'Topps Chrome', team: 'Miami Heat' },
  { name: 'Chris Paul Rookie', type: 'Basketball', rarity: 'Uncommon', price: '55.00', year: 2005, set: 'Topps', team: 'New Orleans Hornets' },
  { name: 'Russell Westbrook Rookie', type: 'Basketball', rarity: 'Uncommon', price: '45.00', year: 2008, set: 'Topps', team: 'Oklahoma City Thunder' },
  { name: 'James Harden Rookie', type: 'Basketball', rarity: 'Uncommon', price: '75.00', year: 2009, set: 'Topps', team: 'Oklahoma City Thunder' },
  { name: 'Kawhi Leonard Rookie', type: 'Basketball', rarity: 'Uncommon', price: '95.00', year: 2011, set: 'Panini', team: 'San Antonio Spurs' },
  { name: 'Anthony Davis Rookie', type: 'Basketball', rarity: 'Uncommon', price: '55.00', year: 2012, set: 'Panini Prizm', team: 'New Orleans Pelicans' },
  { name: 'Damian Lillard Rookie', type: 'Basketball', rarity: 'Uncommon', price: '40.00', year: 2012, set: 'Panini Prizm', team: 'Portland Trail Blazers' },
  { name: 'Joel Embiid Rookie', type: 'Basketball', rarity: 'Uncommon', price: '65.00', year: 2016, set: 'Panini Prizm', team: 'Philadelphia 76ers' },
  { name: 'Nikola Jokic Rookie', type: 'Basketball', rarity: 'Rare', price: '200.00', year: 2015, set: 'Panini Prizm', team: 'Denver Nuggets' },
  { name: 'Devin Booker Rookie', type: 'Basketball', rarity: 'Uncommon', price: '85.00', year: 2015, set: 'Panini Prizm', team: 'Phoenix Suns' },
  { name: 'Ja Morant Rookie', type: 'Basketball', rarity: 'Uncommon', price: '95.00', year: 2019, set: 'Panini Prizm', team: 'Memphis Grizzlies' },
  { name: 'Zion Williamson Rookie', type: 'Basketball', rarity: 'Rare', price: '150.00', year: 2019, set: 'Panini Prizm', team: 'New Orleans Pelicans' },
  { name: 'Anthony Edwards Rookie', type: 'Basketball', rarity: 'Uncommon', price: '75.00', year: 2020, set: 'Panini Prizm', team: 'Minnesota Timberwolves' },
  { name: 'LaMelo Ball Rookie', type: 'Basketball', rarity: 'Uncommon', price: '85.00', year: 2020, set: 'Panini Prizm', team: 'Charlotte Hornets' },
  { name: 'Chet Holmgren Rookie', type: 'Basketball', rarity: 'Uncommon', price: '45.00', year: 2023, set: 'Panini Prizm', team: 'Oklahoma City Thunder' },
  { name: 'Paolo Banchero Rookie', type: 'Basketball', rarity: 'Uncommon', price: '35.00', year: 2022, set: 'Panini Prizm', team: 'Orlando Magic' },
  // More Football
  { name: 'Aaron Rodgers Rookie', type: 'Football', rarity: 'Rare', price: '180.00', year: 2005, set: 'Topps Chrome', team: 'Green Bay Packers' },
  { name: 'Drew Brees Rookie', type: 'Football', rarity: 'Uncommon', price: '75.00', year: 2001, set: 'Topps', team: 'San Diego Chargers' },
  { name: 'Russell Wilson Rookie', type: 'Football', rarity: 'Uncommon', price: '85.00', year: 2012, set: 'Topps Chrome', team: 'Seattle Seahawks' },
  { name: 'Jalen Hurts Rookie', type: 'Football', rarity: 'Uncommon', price: '65.00', year: 2020, set: 'Panini Prizm', team: 'Philadelphia Eagles' },
  { name: 'Justin Herbert Rookie', type: 'Football', rarity: 'Uncommon', price: '95.00', year: 2020, set: 'Panini Prizm', team: 'Los Angeles Chargers' },
  { name: 'Joe Burrow Rookie', type: 'Football', rarity: 'Rare', price: '150.00', year: 2020, set: 'Panini Prizm', team: 'Cincinnati Bengals' },
  { name: 'Trevor Lawrence Rookie', type: 'Football', rarity: 'Uncommon', price: '55.00', year: 2021, set: 'Panini Prizm', team: 'Jacksonville Jaguars' },
  { name: 'Tua Tagovailoa Rookie', type: 'Football', rarity: 'Uncommon', price: '35.00', year: 2020, set: 'Panini Prizm', team: 'Miami Dolphins' },
  { name: 'Justin Jefferson Rookie', type: 'Football', rarity: 'Rare', price: '200.00', year: 2020, set: 'Panini Prizm', team: 'Minnesota Vikings' },
  { name: 'Ja\'Marr Chase Rookie', type: 'Football', rarity: 'Uncommon', price: '85.00', year: 2021, set: 'Panini Prizm', team: 'Cincinnati Bengals' },
  { name: 'Randy Moss Rookie', type: 'Football', rarity: 'Rare', price: '120.00', year: 1998, set: 'Topps', team: 'Minnesota Vikings' },
  { name: 'Terrell Owens Rookie', type: 'Football', rarity: 'Uncommon', price: '45.00', year: 1996, set: 'Topps', team: 'San Francisco 49ers' },
  { name: 'Barry Sanders Rookie', type: 'Football', rarity: 'Rare', price: '200.00', year: 1989, set: 'Score', team: 'Detroit Lions' },
  { name: 'Emmitt Smith Rookie', type: 'Football', rarity: 'Rare', price: '100.00', year: 1990, set: 'Score', team: 'Dallas Cowboys' },
  { name: 'Walter Payton Vintage', type: 'Football', rarity: 'Ultra Rare', price: '600.00', year: 1976, set: 'Topps', team: 'Chicago Bears' },
  { name: 'Brett Favre Rookie', type: 'Football', rarity: 'Rare', price: '85.00', year: 1991, set: 'Upper Deck', team: 'Atlanta Falcons' },
  { name: 'Dan Marino Rookie', type: 'Football', rarity: 'Rare', price: '150.00', year: 1984, set: 'Topps', team: 'Miami Dolphins' },
  { name: 'John Elway Rookie', type: 'Football', rarity: 'Rare', price: '180.00', year: 1984, set: 'Topps', team: 'Denver Broncos' },
  // More Baseball
  { name: 'Bryce Harper Rookie', type: 'Baseball', rarity: 'Rare', price: '120.00', year: 2012, set: 'Topps Update', team: 'Washington Nationals' },
  { name: 'Mookie Betts Rookie', type: 'Baseball', rarity: 'Uncommon', price: '85.00', year: 2014, set: 'Topps Update', team: 'Boston Red Sox' },
  { name: 'Fernando Tatis Jr. Rookie', type: 'Baseball', rarity: 'Rare', price: '150.00', year: 2019, set: 'Topps Chrome', team: 'San Diego Padres' },
  { name: 'Vladimir Guerrero Jr. Rookie', type: 'Baseball', rarity: 'Uncommon', price: '95.00', year: 2019, set: 'Topps Chrome', team: 'Toronto Blue Jays' },
  { name: 'Julio Rodriguez Rookie', type: 'Baseball', rarity: 'Rare', price: '180.00', year: 2022, set: 'Topps Chrome', team: 'Seattle Mariners' },
  { name: 'Gunnar Henderson Rookie', type: 'Baseball', rarity: 'Uncommon', price: '65.00', year: 2023, set: 'Topps Chrome', team: 'Baltimore Orioles' },
  { name: 'Corey Seager Rookie', type: 'Baseball', rarity: 'Uncommon', price: '45.00', year: 2016, set: 'Topps Chrome', team: 'Los Angeles Dodgers' },
  { name: 'Cody Bellinger Rookie', type: 'Baseball', rarity: 'Uncommon', price: '35.00', year: 2017, set: 'Topps Chrome', team: 'Los Angeles Dodgers' },
  { name: 'Aaron Judge Rookie', type: 'Baseball', rarity: 'Rare', price: '250.00', year: 2017, set: 'Topps Chrome', team: 'New York Yankees' },
  { name: 'Pete Alonso Rookie', type: 'Baseball', rarity: 'Uncommon', price: '40.00', year: 2019, set: 'Topps Chrome', team: 'New York Mets' },
  { name: 'Corbin Carroll Rookie', type: 'Baseball', rarity: 'Uncommon', price: '55.00', year: 2023, set: 'Topps Chrome', team: 'Arizona Diamondbacks' },
  { name: 'Bo Bichette Rookie', type: 'Baseball', rarity: 'Uncommon', price: '35.00', year: 2019, set: 'Topps Chrome', team: 'Toronto Blue Jays' },
  { name: 'Cal Ripken Jr. Rookie', type: 'Baseball', rarity: 'Rare', price: '400.00', year: 1982, set: 'Topps', team: 'Baltimore Orioles' },
  { name: 'Nolan Ryan Vintage', type: 'Baseball', rarity: 'Ultra Rare', price: '2500.00', year: 1968, set: 'Topps', team: 'New York Mets' },
  { name: 'Hank Aaron Vintage', type: 'Baseball', rarity: 'Ultra Rare', price: '5000.00', year: 1954, set: 'Topps', team: 'Milwaukee Braves' },
  { name: 'Willie Mays Vintage', type: 'Baseball', rarity: 'Ultra Rare', price: '6000.00', year: 1952, set: 'Topps', team: 'New York Giants' },
  { name: 'Roberto Clemente Vintage', type: 'Baseball', rarity: 'Ultra Rare', price: '3500.00', year: 1955, set: 'Topps', team: 'Pittsburgh Pirates' },
  // More Hockey
  { name: 'Nathan MacKinnon Rookie', type: 'Hockey', rarity: 'Rare', price: '180.00', year: 2013, set: 'Upper Deck Young Guns', team: 'Colorado Avalanche' },
  { name: 'Cale Makar Rookie', type: 'Hockey', rarity: 'Rare', price: '120.00', year: 2019, set: 'Upper Deck Young Guns', team: 'Colorado Avalanche' },
  { name: 'Leon Draisaitl Rookie', type: 'Hockey', rarity: 'Uncommon', price: '75.00', year: 2014, set: 'Upper Deck Young Guns', team: 'Edmonton Oilers' },
  { name: 'David Pastrnak Rookie', type: 'Hockey', rarity: 'Uncommon', price: '65.00', year: 2014, set: 'Upper Deck Young Guns', team: 'Boston Bruins' },
  { name: 'Mitch Marner Rookie', type: 'Hockey', rarity: 'Uncommon', price: '55.00', year: 2016, set: 'Upper Deck Young Guns', team: 'Toronto Maple Leafs' },
  { name: 'Patrick Kane Rookie', type: 'Hockey', rarity: 'Rare', price: '120.00', year: 2007, set: 'Upper Deck Young Guns', team: 'Chicago Blackhawks' },
  { name: 'Jonathan Toews Rookie', type: 'Hockey', rarity: 'Uncommon', price: '65.00', year: 2007, set: 'Upper Deck Young Guns', team: 'Chicago Blackhawks' },
  { name: 'Steven Stamkos Rookie', type: 'Hockey', rarity: 'Uncommon', price: '55.00', year: 2008, set: 'Upper Deck Young Guns', team: 'Tampa Bay Lightning' },
  { name: 'Nikita Kucherov Rookie', type: 'Hockey', rarity: 'Uncommon', price: '45.00', year: 2013, set: 'Upper Deck Young Guns', team: 'Tampa Bay Lightning' },
  { name: 'Jack Hughes Rookie', type: 'Hockey', rarity: 'Uncommon', price: '50.00', year: 2019, set: 'Upper Deck Young Guns', team: 'New Jersey Devils' },
  { name: 'Andrei Svechnikov Rookie', type: 'Hockey', rarity: 'Uncommon', price: '40.00', year: 2018, set: 'Upper Deck Young Guns', team: 'Carolina Hurricanes' },
  { name: 'Elias Pettersson Rookie', type: 'Hockey', rarity: 'Uncommon', price: '45.00', year: 2018, set: 'Upper Deck Young Guns', team: 'Vancouver Canucks' },
  { name: 'Jaromir Jagr Rookie', type: 'Hockey', rarity: 'Rare', price: '150.00', year: 1990, set: 'Score', team: 'Pittsburgh Penguins' },
  { name: 'Patrick Roy Rookie', type: 'Hockey', rarity: 'Rare', price: '200.00', year: 1986, set: 'O-Pee-Chee', team: 'Montreal Canadiens' },
  { name: 'Connor Bedard Rookie', type: 'Hockey', rarity: 'Rare', price: '250.00', year: 2023, set: 'Upper Deck Young Guns', team: 'Chicago Blackhawks' },
  // More Soccer
  { name: 'Neymar Jr. Rookie', type: 'Soccer', rarity: 'Rare', price: '350.00', year: 2010, set: 'Panini Adrenalyn', team: 'Santos FC' },
  { name: 'Mohamed Salah Rookie', type: 'Soccer', rarity: 'Uncommon', price: '120.00', year: 2012, set: 'Panini', team: 'FC Basel' },
  { name: 'Kevin De Bruyne Rookie', type: 'Soccer', rarity: 'Uncommon', price: '95.00', year: 2010, set: 'Panini', team: 'Genk' },
  { name: 'Vinicius Jr. Rookie', type: 'Soccer', rarity: 'Rare', price: '150.00', year: 2017, set: 'Topps Chrome', team: 'Flamengo' },
  { name: 'Phil Foden Rookie', type: 'Soccer', rarity: 'Uncommon', price: '75.00', year: 2018, set: 'Topps Chrome', team: 'Manchester City' },
  { name: 'Bukayo Saka Rookie', type: 'Soccer', rarity: 'Uncommon', price: '65.00', year: 2019, set: 'Topps Chrome', team: 'Arsenal' },
  { name: 'Pedri Rookie', type: 'Soccer', rarity: 'Uncommon', price: '55.00', year: 2019, set: 'Topps Chrome', team: 'Barcelona' },
  { name: 'Jamal Musiala Rookie', type: 'Soccer', rarity: 'Uncommon', price: '60.00', year: 2020, set: 'Topps Chrome', team: 'Bayern Munich' },
  { name: 'Robert Lewandowski', type: 'Soccer', rarity: 'Uncommon', price: '40.00', year: 2014, set: 'Topps Chrome', team: 'Bayern Munich' },
  { name: 'Karim Benzema', type: 'Soccer', rarity: 'Uncommon', price: '35.00', year: 2008, set: 'Panini', team: 'Real Madrid' },
  { name: 'Thierry Henry Rookie', type: 'Soccer', rarity: 'Rare', price: '300.00', year: 1996, set: 'Panini', team: 'Monaco' },
  { name: 'Ronaldinho Rookie', type: 'Soccer', rarity: 'Rare', price: '400.00', year: 1998, set: 'Panini', team: 'Gremio' },
  { name: 'Zinedine Zidane Rookie', type: 'Soccer', rarity: 'Ultra Rare', price: '800.00', year: 1992, set: 'Panini', team: 'Bordeaux' },
  { name: 'Pele Vintage', type: 'Soccer', rarity: 'Ultra Rare', price: '5000.00', year: 1958, set: 'Panini', team: 'Santos FC' },
  { name: 'Diego Maradona Vintage', type: 'Soccer', rarity: 'Ultra Rare', price: '3000.00', year: 1978, set: 'Panini', team: 'Boca Juniors' },
];

// Build the card database with generated placeholder images
function generateCardImage(name: string, type: string, game: string, color: string): string {
  const encoded = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="250" height="350" viewBox="0 0 250 350">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${color}"/>
          <stop offset="100%" stop-color="#111"/>
        </linearGradient>
      </defs>
      <rect width="250" height="350" rx="12" fill="url(#bg)"/>
      <rect x="10" y="10" width="230" height="165" rx="8" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
      <text x="125" y="100" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="40" font-family="sans-serif">${game.slice(0,2).toUpperCase()}</text>
      <rect x="10" y="185" width="230" height="155" rx="8" fill="rgba(0,0,0,0.2)"/>
      <text x="125" y="215" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="sans-serif">${name.length > 25 ? name.slice(0, 25) + '...' : name}</text>
      <text x="125" y="240" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="10" font-family="sans-serif">${type}</text>
      <rect x="20" y="260" width="210" height="70" rx="6" fill="rgba(255,255,255,0.05)"/>
      <text x="125" y="300" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="9" font-family="sans-serif">${game} Trading Card</text>
    </svg>
  `.trim().replace(/\n/g, ''));
  return `data:image/svg+xml,${encoded}`;
}

const GAME_COLORS: Record<string, string> = {
  onepiece: '#e74c3c',
  starwars: '#2980b9',
  gundam: '#8e44ad',
  lorcana: '#f39c12',
  sports: '#27ae60',
};

// Cached databases
let _opCards: DeckCard[] | null = null;
let _swCards: DeckCard[] | null = null;
let _gdCards: DeckCard[] | null = null;
let _lcCards: DeckCard[] | null = null;
let _spCards: DeckCard[] | null = null;

function buildOnePieceCards(): DeckCard[] {
  if (_opCards) return _opCards;
  _opCards = ONEPIECE_CARDS.map((c, i) => {
    const img = generateCardImage(c.name, c.type, 'One Piece', GAME_COLORS.onepiece);
    return {
      id: `op-${i}`, name: c.name, cmc: c.cost, typeLine: c.type,
      colors: [], colorIdentity: [], setName: c.set, setCode: c.set.split(' ')[0],
      rarity: c.rarity, imageSmall: img, imageNormal: img, imageLarge: img,
      priceUsd: c.price, priceFoil: null,
      oracleText: c.power ? `Power: ${c.power}${c.counter ? ` | Counter: ${c.counter}` : ''}` : '',
      power: c.power, legalities: {}, quantity: 0, board: 'main' as const,
    };
  });
  return _opCards;
}

function buildStarWarsCards(): DeckCard[] {
  if (_swCards) return _swCards;
  _swCards = STARWARS_CARDS.map((c, i) => {
    const img = generateCardImage(c.name, c.type, 'Star Wars', GAME_COLORS.starwars);
    return {
      id: `sw-${i}`, name: c.name, cmc: c.cost, typeLine: c.type,
      colors: [], colorIdentity: [], setName: c.set, setCode: c.set.split(' ')[0],
      rarity: c.rarity, imageSmall: img, imageNormal: img, imageLarge: img,
      priceUsd: c.price, priceFoil: null,
      oracleText: c.power ? `Power: ${c.power} | HP: ${c.hp || '?'}` : '',
      power: c.power, toughness: c.hp, legalities: {}, quantity: 0, board: 'main' as const,
    };
  });
  return _swCards;
}

function buildGundamCards(): DeckCard[] {
  if (_gdCards) return _gdCards;
  _gdCards = GUNDAM_CARDS.map((c, i) => {
    const img = generateCardImage(c.name, c.type, 'Gundam', GAME_COLORS.gundam);
    return {
      id: `gd-${i}`, name: c.name, cmc: c.cost, typeLine: c.type,
      colors: [], colorIdentity: [], setName: c.set, setCode: c.set.split(' ')[0],
      rarity: c.rarity, imageSmall: img, imageNormal: img, imageLarge: img,
      priceUsd: c.price, priceFoil: null,
      oracleText: c.power ? `Power: ${c.power}` : '',
      power: c.power, legalities: {}, quantity: 0, board: 'main' as const,
    };
  });
  return _gdCards;
}

function buildLorcanaCards(): DeckCard[] {
  if (_lcCards) return _lcCards;
  _lcCards = LORCANA_CARDS.map((c, i) => {
    const img = generateCardImage(c.name, c.type, 'Lorcana', GAME_COLORS.lorcana);
    return {
      id: `lc-${i}`, name: c.name, cmc: c.cost, typeLine: c.type,
      colors: [c.inkColor], colorIdentity: [c.inkColor], setName: c.set, setCode: c.set.split(' ')[0],
      rarity: c.rarity, imageSmall: img, imageNormal: img, imageLarge: img,
      priceUsd: c.price, priceFoil: null,
      oracleText: c.strength ? `Strength: ${c.strength} | Willpower: ${c.willpower} | Lore: ${c.lore} | Ink: ${c.inkColor}` : `Ink: ${c.inkColor}`,
      power: c.strength, toughness: c.willpower, legalities: {}, quantity: 0, board: 'main' as const,
    };
  });
  return _lcCards;
}

function buildSportsCards(): DeckCard[] {
  if (_spCards) return _spCards;
  _spCards = SPORTS_CARDS.map((c, i) => {
    const img = generateCardImage(c.name, c.type, 'Sports', GAME_COLORS.sports);
    return {
      id: `sp-${i}`, name: c.name, cmc: 0, typeLine: c.type,
      colors: [], colorIdentity: [], setName: `${c.year} ${c.set}`, setCode: c.set,
      rarity: c.rarity, imageSmall: img, imageNormal: img, imageLarge: img,
      priceUsd: c.price, priceFoil: null,
      oracleText: `${c.team} | ${c.year} ${c.set}`,
      legalities: {}, quantity: 0, board: 'main' as const,
    };
  });
  return _spCards;
}

function getOtherGameCards(game: GameCategory): DeckCard[] {
  switch (game) {
    case 'onepiece': return buildOnePieceCards();
    case 'starwars': return buildStarWarsCards();
    case 'gundam': return buildGundamCards();
    case 'lorcana': return buildLorcanaCards();
    case 'sports': return buildSportsCards();
    default: return [];
  }
}

// Universal search - works for ALL 8 games
async function universalSearch(query: string, game: GameCategory): Promise<DeckCard[]> {
  if (!query || query.length < 2) return [];
  switch (game) {
    case 'mtg': return scryfallSearch(query);
    case 'yugioh': return yugiohSearch(query);
    case 'pokemon': return pokemonSearch(query);
    case 'lorcana': {
      // Try API first, fallback to offline
      const apiResults = await lorcanaSearch(query);
      if (apiResults.length > 0) return apiResults;
      // Fallback to offline database
      const all = getOtherGameCards(game);
      const q = query.toLowerCase().trim();
      return all.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.typeLine.toLowerCase().includes(q) ||
        c.setName.toLowerCase().includes(q) ||
        c.rarity.toLowerCase().includes(q) ||
        (c.oracleText || '').toLowerCase().includes(q)
      );
    }
    case 'starwars': {
      // Try Star Wars Unlimited API first
      const apiResults = await starwarsSearch(query);
      if (apiResults.length > 0) return apiResults;
      // Fallback to offline database
      const all = getOtherGameCards(game);
      const q = query.toLowerCase().trim();
      return all.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.typeLine.toLowerCase().includes(q) ||
        c.setName.toLowerCase().includes(q) ||
        c.rarity.toLowerCase().includes(q) ||
        (c.oracleText || '').toLowerCase().includes(q)
      );
    }
    case 'onepiece': {
      // Try One Piece TCG API first
      const apiResults = await onepieceSearch(query);
      if (apiResults.length > 0) return apiResults;
      // Fallback to offline database
      const all = getOtherGameCards(game);
      const q = query.toLowerCase().trim();
      return all.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.typeLine.toLowerCase().includes(q) ||
        c.setName.toLowerCase().includes(q) ||
        c.rarity.toLowerCase().includes(q) ||
        (c.oracleText || '').toLowerCase().includes(q)
      );
    }
    default: {
      const all = getOtherGameCards(game);
      const q = query.toLowerCase().trim();
      // Fuzzy search: match by name, type, set, or rarity
      return all.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.typeLine.toLowerCase().includes(q) ||
        c.setName.toLowerCase().includes(q) ||
        c.rarity.toLowerCase().includes(q) ||
        (c.oracleText || '').toLowerCase().includes(q)
      );
    }
  }
}

// Universal name lookup - works for ALL 8 games (used by import)
async function universalNameLookup(name: string, game: GameCategory): Promise<DeckCard | null> {
  switch (game) {
    case 'mtg': return scryfallNameExact(name);
    case 'yugioh': return yugiohNameExact(name);
    case 'pokemon': return pokemonNameExact(name);
    case 'lorcana': {
      // Try API first
      const apiResult = await lorcanaNameExact(name);
      if (apiResult) return apiResult;
      // Fallback to offline database
      const all = getOtherGameCards(game);
      const q = name.toLowerCase().trim();
      const exact = all.find(c => c.name.toLowerCase() === q);
      if (exact) return { ...exact };
      const starts = all.find(c => c.name.toLowerCase().startsWith(q));
      if (starts) return { ...starts };
      const contains = all.find(c => c.name.toLowerCase().includes(q));
      if (contains) return { ...contains };
      return null;
    }
    case 'starwars': {
      // Try Star Wars Unlimited API first
      const apiResult = await starwarsNameExact(name);
      if (apiResult) return apiResult;
      // Fallback to offline database
      const all = getOtherGameCards(game);
      const q = name.toLowerCase().trim();
      const exact = all.find(c => c.name.toLowerCase() === q);
      if (exact) return { ...exact };
      const starts = all.find(c => c.name.toLowerCase().startsWith(q));
      if (starts) return { ...starts };
      const contains = all.find(c => c.name.toLowerCase().includes(q));
      if (contains) return { ...contains };
      return null;
    }
    case 'onepiece': {
      // Try One Piece TCG API first
      const apiResult = await onepieceNameExact(name);
      if (apiResult) return apiResult;
      // Fallback to offline database
      const all = getOtherGameCards(game);
      const q = name.toLowerCase().trim();
      const exact = all.find(c => c.name.toLowerCase() === q);
      if (exact) return { ...exact };
      const starts = all.find(c => c.name.toLowerCase().startsWith(q));
      if (starts) return { ...starts };
      const contains = all.find(c => c.name.toLowerCase().includes(q));
      if (contains) return { ...contains };
      return null;
    }
    default: {
      const all = getOtherGameCards(game);
      const q = name.toLowerCase().trim();
      // Try exact match first
      const exact = all.find(c => c.name.toLowerCase() === q);
      if (exact) return { ...exact };
      // Then try starts-with
      const starts = all.find(c => c.name.toLowerCase().startsWith(q));
      if (starts) return { ...starts };
      // Then try contains
      const contains = all.find(c => c.name.toLowerCase().includes(q));
      if (contains) return { ...contains };
      // Then try fuzzy: each word in query matches somewhere in name
      const words = q.split(/\s+/);
      const fuzzy = all.find(c => {
        const cn = c.name.toLowerCase();
        return words.every(w => cn.includes(w));
      });
      return fuzzy ? { ...fuzzy } : null;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════
   SAMPLE MARKETPLACE CARDS
   ═══════════════════════════════════════════════════════════════════ */
const SAMPLE_CARDS: MarketCard[] = [
  { id: 's1', name: 'Black Lotus', set: 'Alpha', game: 'mtg', rarity: 'Mythic', condition: 'Near Mint', price: 15000, marketPrice: 18000, image: 'https://cards.scryfall.io/normal/front/b/d/bd8fa327-dd41-4737-8f19-2cf5eb1f7571.jpg', seller: 'VintageMTG', type: 'single', color: 'Colorless', featured: true },
  { id: 's2', name: 'Charizard VMAX', set: 'Shining Fates', game: 'pokemon', rarity: 'Ultra Rare', condition: 'Mint', price: 249.99, marketPrice: 275, image: 'https://images.pokemontcg.io/swsh45/SV107.png', seller: 'DragonMaster', type: 'single', featured: true },
  { id: 's3', name: 'Blue-Eyes White Dragon', set: 'LOB', game: 'yugioh', rarity: 'Ultra Rare', condition: 'Near Mint', price: 189.99, marketPrice: 210, image: 'https://images.ygoprodeck.com/images/cards_small/89631139.jpg', seller: 'KaibaCorpFan', type: 'single', featured: true },
  { id: 's4', name: 'Michael Jordan Rookie', set: 'Fleer 1986', game: 'sports', rarity: 'Rare', condition: 'Excellent', price: 3200, marketPrice: 3500, image: '', seller: 'SportsKing', type: 'single', featured: true },
  { id: 's5', name: 'Monkey D. Luffy Leader', set: 'Romance Dawn', game: 'onepiece', rarity: 'Super Rare', condition: 'Mint', price: 85, marketPrice: 95, image: '', seller: 'PirateCollector', type: 'single' },
  { id: 's6', name: 'Luke Skywalker', set: 'Spark of Rebellion', game: 'starwars', rarity: 'Legendary', condition: 'Mint', price: 120, marketPrice: 140, image: '', seller: 'JediTrader', type: 'single' },
  { id: 's7', name: 'RX-78-2 Gundam', set: 'Gundam War', game: 'gundam', rarity: 'Rare', condition: 'Near Mint', price: 45, marketPrice: 50, image: '', seller: 'MechaFan', type: 'single' },
  { id: 's8', name: 'Elsa - Spirit of Winter', set: 'Rise of the Floodborn', game: 'lorcana', rarity: 'Enchanted', condition: 'Mint', price: 210, marketPrice: 235, image: '', seller: 'LorcanaLover', type: 'single', featured: true },
  { id: 's9', name: 'Jace, the Mind Sculptor', set: 'Worldwake', game: 'mtg', rarity: 'Mythic', condition: 'Near Mint', price: 89.99, marketPrice: 95, image: 'https://cards.scryfall.io/normal/front/c/8/c8817585-0d32-4d56-9142-0d29512e86a9.jpg', seller: 'PlaneswalkerPro', type: 'single' },
  { id: 's10', name: 'Pikachu VMAX', set: 'Vivid Voltage', game: 'pokemon', rarity: 'Rare', condition: 'Mint', price: 35, marketPrice: 40, image: 'https://images.pokemontcg.io/swsh4/188.png', seller: 'PikaCollector', type: 'single' },
  { id: 's11', name: 'Dark Magician', set: 'SDY', game: 'yugioh', rarity: 'Ultra Rare', condition: 'Near Mint', price: 65, marketPrice: 75, image: 'https://images.ygoprodeck.com/images/cards_small/46986414.jpg', seller: 'DuelKing', type: 'single' },
  { id: 's12', name: 'Umbreon VMAX Alt Art', set: 'Evolving Skies', game: 'pokemon', rarity: 'Ultra Rare', condition: 'Mint', price: 340, marketPrice: 380, image: 'https://images.pokemontcg.io/swsh7/215.png', seller: 'MoonlightTrader', type: 'single', featured: true },
  { id: 'sl1', name: 'MTG Booster Box - MH3', set: 'Modern Horizons 3', game: 'mtg', rarity: 'Sealed', condition: 'Sealed', price: 289.99, image: '', seller: 'BoxBreakers', type: 'sealed', sealedType: 'Booster Box' },
  { id: 'sl2', name: 'Pokemon ETB - 151', set: 'Scarlet & Violet 151', game: 'pokemon', rarity: 'Sealed', condition: 'Sealed', price: 54.99, image: '', seller: 'SealedDeals', type: 'sealed', sealedType: 'ETB' },
  { id: 'sl3', name: 'YGO Structure Deck', set: 'Cyberstorm Access', game: 'yugioh', rarity: 'Sealed', condition: 'Sealed', price: 12.99, image: '', seller: 'DuelShop', type: 'sealed', sealedType: 'Starter Deck' },
  { id: 'sl4', name: 'Lorcana Booster Box', set: 'Shimmering Skies', game: 'lorcana', rarity: 'Sealed', condition: 'Sealed', price: 143.99, image: '', seller: 'DisneyCards', type: 'sealed', sealedType: 'Booster Box' },
];

/* ═══════════════════════════════════════════════════════════════════
   COMMUNITY DECKS DATA
   ═══════════════════════════════════════════════════════════════════ */
interface CommunityDeck {
  id: string; name: string; game: GameCategory; format: string;
  author: string; authorAvatar: string;
  likes: number; views: number; comments: number; cardCount: number;
  previewCards: string[]; description: string; createdAt: string;
  colors?: string[];
  cards: DeckCard[]; // Added cards property
}

const COMMUNITY_DECKS: CommunityDeck[] = [
  { 
    id: 'cd1', name: 'Atraxa Superfriends', game: 'mtg', format: 'Commander', author: 'MtgPro99', authorAvatar: 'MP', likes: 342, views: 5680, comments: 28, cardCount: 15, 
    previewCards: ['https://cards.scryfall.io/art_crop/front/d/0/d0d33d52-3d28-4635-b985-51e126571571.jpg', 'https://cards.scryfall.io/art_crop/front/c/8/c8817585-0d32-4d56-9142-0d29512e86a9.jpg', 'https://cards.scryfall.io/art_crop/front/3/9/395c6e2e-1599-44f6-9283-4e740a45e519.jpg', 'https://cards.scryfall.io/art_crop/front/0/1/01bc7b26-3946-4467-b195-e23aff0e9598.jpg'], 
    description: 'Planeswalker tribal with proliferate synergies', createdAt: '2024-01-15', colors: ['W', 'U', 'B', 'G'],
    cards: [
      { id: 'at1', name: 'Atraxa, Praetors\' Voice', typeLine: 'Legendary Creature', manaCost: '{G}{W}{U}{B}', cmc: 4, colors: ['G','W','U','B'], colorIdentity: ['G','W','U','B'], rarity: 'mythic', quantity: 1, board: 'commander', priceUsd: '35.00', imageNormal: 'https://cards.scryfall.io/normal/front/d/0/d0d33d52-3d28-4635-b985-51e126571571.jpg', imageSmall: 'https://cards.scryfall.io/small/front/d/0/d0d33d52-3d28-4635-b985-51e126571571.jpg', imageLarge: 'https://cards.scryfall.io/normal/front/d/0/d0d33d52-3d28-4635-b985-51e126571571.jpg', priceFoil: null, setName: 'Double Masters', setCode: '2XM', legalities: {} },
      { id: 'at2', name: 'Doubling Season', typeLine: 'Enchantment', manaCost: '{4}{G}', cmc: 5, colors: ['G'], colorIdentity: ['G'], rarity: 'mythic', quantity: 1, board: 'main', priceUsd: '45.00', imageNormal: 'https://cards.scryfall.io/normal/front/8/6/8676d164-c76e-402b-a649-6ded3f549b6e.jpg', imageSmall: 'https://cards.scryfall.io/small/front/8/6/8676d164-c76e-402b-a649-6ded3f549b6e.jpg', imageLarge: 'https://cards.scryfall.io/normal/front/8/6/8676d164-c76e-402b-a649-6ded3f549b6e.jpg', priceFoil: null, setName: 'Commander Masters', setCode: 'CMM', legalities: {} },
      { id: 'at3', name: 'Teferi, Hero of Dominaria', typeLine: 'Legendary Planeswalker', manaCost: '{3}{W}{U}', cmc: 5, colors: ['W','U'], colorIdentity: ['W','U'], rarity: 'mythic', quantity: 1, board: 'main', priceUsd: '18.00', imageNormal: 'https://cards.scryfall.io/normal/front/5/d/5d10b752-d9cb-419d-a5c4-d4ee1acb655e.jpg', imageSmall: 'https://cards.scryfall.io/small/front/5/d/5d10b752-d9cb-419d-a5c4-d4ee1acb655e.jpg', imageLarge: 'https://cards.scryfall.io/normal/front/5/d/5d10b752-d9cb-419d-a5c4-d4ee1acb655e.jpg', priceFoil: null, setName: 'Dominaria', setCode: 'DOM', legalities: {} },
      { id: 'at4', name: 'Deepglow Skate', typeLine: 'Creature', manaCost: '{4}{U}', cmc: 5, colors: ['U'], colorIdentity: ['U'], rarity: 'rare', quantity: 1, board: 'main', priceUsd: '6.00', imageNormal: 'https://cards.scryfall.io/normal/front/4/a/4a8b26dc-7980-48d0-a1f6-2a0329445871.jpg', imageSmall: 'https://cards.scryfall.io/small/front/4/a/4a8b26dc-7980-48d0-a1f6-2a0329445871.jpg', imageLarge: 'https://cards.scryfall.io/normal/front/4/a/4a8b26dc-7980-48d0-a1f6-2a0329445871.jpg', priceFoil: null, setName: 'Commander Masters', setCode: 'CMM', legalities: {} },
      { id: 'at5', name: 'Sol Ring', typeLine: 'Artifact', manaCost: '{1}', cmc: 1, colors: [], colorIdentity: [], rarity: 'uncommon', quantity: 1, board: 'main', priceUsd: '1.50', imageNormal: 'https://cards.scryfall.io/normal/front/2/0/2047502c-7713-4147-9039-2762ea1f42e6.jpg', imageSmall: 'https://cards.scryfall.io/small/front/2/0/2047502c-7713-4147-9039-2762ea1f42e6.jpg', imageLarge: 'https://cards.scryfall.io/normal/front/2/0/2047502c-7713-4147-9039-2762ea1f42e6.jpg', priceFoil: null, setName: 'Commander Masters', setCode: 'CMM', legalities: {} },
      { id: 'at6', name: 'Arcane Signet', typeLine: 'Artifact', manaCost: '{2}', cmc: 2, colors: [], colorIdentity: [], rarity: 'common', quantity: 1, board: 'main', priceUsd: '0.80', imageNormal: 'https://cards.scryfall.io/normal/front/f/0/f0b75431-4735-4082-9612-bfd74766853f.jpg', imageSmall: 'https://cards.scryfall.io/small/front/f/0/f0b75431-4735-4082-9612-bfd74766853f.jpg', imageLarge: 'https://cards.scryfall.io/normal/front/f/0/f0b75431-4735-4082-9612-bfd74766853f.jpg', priceFoil: null, setName: 'Commander Masters', setCode: 'CMM', legalities: {} },
      { id: 'at7', name: 'Command Tower', typeLine: 'Land', manaCost: '', cmc: 0, colors: [], colorIdentity: [], rarity: 'common', quantity: 1, board: 'main', priceUsd: '0.50', imageNormal: 'https://cards.scryfall.io/normal/front/a/f/afc8572c-b714-43c7-af31-9569e10260e2.jpg', imageSmall: 'https://cards.scryfall.io/small/front/a/f/afc8572c-b714-43c7-af31-9569e10260e2.jpg', imageLarge: 'https://cards.scryfall.io/normal/front/a/f/afc8572c-b714-43c7-af31-9569e10260e2.jpg', priceFoil: null, setName: 'Commander Masters', setCode: 'CMM', legalities: {} },
      { id: 'at8', name: 'Breeding Pool', typeLine: 'Land', manaCost: '', cmc: 0, colors: [], colorIdentity: ['G','U'], rarity: 'rare', quantity: 1, board: 'main', priceUsd: '15.00', imageNormal: 'https://cards.scryfall.io/normal/front/b/b/bb54233c-0844-4965-9cde-e8a4ef3e11b8.jpg', imageSmall: 'https://cards.scryfall.io/small/front/b/b/bb54233c-0844-4965-9cde-e8a4ef3e11b8.jpg', imageLarge: 'https://cards.scryfall.io/normal/front/b/b/bb54233c-0844-4965-9cde-e8a4ef3e11b8.jpg', priceFoil: null, setName: 'Ravnica Allegiance', setCode: 'RNA', legalities: {} },
      { id: 'at9', name: 'Jace, the Mind Sculptor', typeLine: 'Legendary Planeswalker', manaCost: '{2}{U}{U}', cmc: 4, colors: ['U'], colorIdentity: ['U'], rarity: 'mythic', quantity: 1, board: 'main', priceUsd: '20.00', imageNormal: 'https://cards.scryfall.io/normal/front/c/8/c8817585-0d32-4d56-9142-0d29512e86a9.jpg', imageSmall: 'https://cards.scryfall.io/small/front/c/8/c8817585-0d32-4d56-9142-0d29512e86a9.jpg', imageLarge: 'https://cards.scryfall.io/normal/front/c/8/c8817585-0d32-4d56-9142-0d29512e86a9.jpg', priceFoil: null, setName: 'Worldwake', setCode: 'WWK', legalities: {} },
      { id: 'at10', name: 'Narset, Parter of Veils', typeLine: 'Legendary Planeswalker', manaCost: '{1}{U}{U}', cmc: 3, colors: ['U'], colorIdentity: ['U'], rarity: 'uncommon', quantity: 1, board: 'main', priceUsd: '2.00', imageNormal: 'https://cards.scryfall.io/normal/front/8/c/8c39f9b4-02b9-4d44-b8d6-4fd02ebbb0c5.jpg', imageSmall: 'https://cards.scryfall.io/small/front/8/c/8c39f9b4-02b9-4d44-b8d6-4fd02ebbb0c5.jpg', imageLarge: 'https://cards.scryfall.io/normal/front/8/c/8c39f9b4-02b9-4d44-b8d6-4fd02ebbb0c5.jpg', priceFoil: null, setName: 'War of the Spark', setCode: 'WAR', legalities: {} },
    ]
  },
  { 
    id: 'cd2', name: 'Mono Red Burn', game: 'mtg', format: 'Modern', author: 'BurnBaby', authorAvatar: 'BB', likes: 189, views: 3200, comments: 15, cardCount: 16, 
    previewCards: ['https://cards.scryfall.io/art_crop/front/0/1/01bc7b26-3946-4467-b195-e23aff0e9598.jpg', 'https://cards.scryfall.io/art_crop/front/e/3/e36ed0e8-8837-460b-905f-a21695de82f7.jpg'], 
    description: 'Fast aggressive burn strategy', createdAt: '2024-02-20', colors: ['R'],
    cards: [
      { id: 'rb1', name: 'Lightning Bolt', typeLine: 'Instant', manaCost: '{R}', cmc: 1, colors: ['R'], colorIdentity: ['R'], rarity: 'common', quantity: 4, board: 'main', priceUsd: '1.00', imageNormal: 'https://cards.scryfall.io/normal/front/c/e/ce711943-c1a1-43a0-8b89-8d169cfb8e06.jpg', imageSmall: 'https://cards.scryfall.io/small/front/c/e/ce711943-c1a1-43a0-8b89-8d169cfb8e06.jpg', imageLarge: 'https://cards.scryfall.io/normal/front/c/e/ce711943-c1a1-43a0-8b89-8d169cfb8e06.jpg', priceFoil: null, setName: 'Jumpstart', setCode: 'JMP', legalities: {} },
      { id: 'rb2', name: 'Goblin Guide', typeLine: 'Creature', manaCost: '{R}', cmc: 1, colors: ['R'], colorIdentity: ['R'], rarity: 'rare', quantity: 4, board: 'main', priceUsd: '4.00', imageNormal: 'https://cards.scryfall.io/normal/front/3/c/3c0f5411-19ea-4c85-9874-54a71b5a8b2b.jpg', imageSmall: 'https://cards.scryfall.io/small/front/3/c/3c0f5411-19ea-4c85-9874-54a71b5a8b2b.jpg', imageLarge: 'https://cards.scryfall.io/normal/front/3/c/3c0f5411-19ea-4c85-9874-54a71b5a8b2b.jpg', priceFoil: null, setName: 'Double Masters', setCode: '2XM', legalities: {} },
      { id: 'rb3', name: 'Monastery Swiftspear', typeLine: 'Creature', manaCost: '{R}', cmc: 1, colors: ['R'], colorIdentity: ['R'], rarity: 'uncommon', quantity: 4, board: 'main', priceUsd: '0.50', imageNormal: 'https://cards.scryfall.io/normal/front/5/8/58db2f81-6ff5-402c-8aef-0b667e82cdc4.jpg', imageSmall: 'https://cards.scryfall.io/small/front/5/8/58db2f81-6ff5-402c-8aef-0b667e82cdc4.jpg', imageLarge: 'https://cards.scryfall.io/normal/front/5/8/58db2f81-6ff5-402c-8aef-0b667e82cdc4.jpg', priceFoil: null, setName: 'Brothers War', setCode: 'BRO', legalities: {} },
      { id: 'rb4', name: 'Eidolon of the Great Revel', typeLine: 'Enchantment Creature', manaCost: '{R}{R}', cmc: 2, colors: ['R'], colorIdentity: ['R'], rarity: 'rare', quantity: 4, board: 'main', priceUsd: '8.00', imageNormal: 'https://cards.scryfall.io/normal/front/1/8/183ef738-0559-49ca-85b4-e6836521f203.jpg', imageSmall: 'https://cards.scryfall.io/small/front/1/8/183ef738-0559-49ca-85b4-e6836521f203.jpg', imageLarge: 'https://cards.scryfall.io/normal/front/1/8/183ef738-0559-49ca-85b4-e6836521f203.jpg', priceFoil: null, setName: 'Journey into Nyx', setCode: 'JOU', legalities: {} },
    ]
  },
  { 
    id: 'cd3', name: 'Blue-Eyes Chaos MAX', game: 'yugioh', format: 'Casual', author: 'KaibaFan', authorAvatar: 'KF', likes: 256, views: 4100, comments: 22, cardCount: 14, 
    previewCards: ['https://images.ygoprodeck.com/images/cards_small/89631139.jpg', 'https://images.ygoprodeck.com/images/cards_small/23995346.jpg'], 
    description: 'Blue-Eyes focused OTK deck with Chaos MAX Dragon', createdAt: '2024-03-10',
    cards: [
      { id: 'be1', name: 'Blue-Eyes White Dragon', typeLine: 'Monster', cmc: 8, colors: [], colorIdentity: [], rarity: 'Ultra Rare', quantity: 3, board: 'main', priceUsd: '1.50', imageNormal: 'https://images.ygoprodeck.com/images/cards/89631139.jpg', imageSmall: 'https://images.ygoprodeck.com/images/cards_small/89631139.jpg', imageLarge: 'https://images.ygoprodeck.com/images/cards/89631139.jpg', priceFoil: null, setName: 'LOB', setCode: '', legalities: {} },
      { id: 'be2', name: 'Blue-Eyes Chaos MAX Dragon', typeLine: 'Ritual Monster', cmc: 8, colors: [], colorIdentity: [], rarity: 'Secret Rare', quantity: 3, board: 'main', priceUsd: '4.50', imageNormal: 'https://images.ygoprodeck.com/images/cards/55410871.jpg', imageSmall: 'https://images.ygoprodeck.com/images/cards_small/55410871.jpg', imageLarge: 'https://images.ygoprodeck.com/images/cards/55410871.jpg', priceFoil: null, setName: 'MVP1', setCode: '', legalities: {} },
      { id: 'be3', name: 'Blue-Eyes Alternative White Dragon', typeLine: 'Effect Monster', cmc: 8, colors: [], colorIdentity: [], rarity: 'Ultra Rare', quantity: 3, board: 'main', priceUsd: '8.00', imageNormal: 'https://images.ygoprodeck.com/images/cards/23995346.jpg', imageSmall: 'https://images.ygoprodeck.com/images/cards_small/23995346.jpg', imageLarge: 'https://images.ygoprodeck.com/images/cards/23995346.jpg', priceFoil: null, setName: 'MVP1', setCode: '', legalities: {} },
      { id: 'be4', name: 'Trade-In', typeLine: 'Spell', cmc: 0, colors: [], colorIdentity: [], rarity: 'Common', quantity: 3, board: 'main', priceUsd: '0.50', imageNormal: 'https://images.ygoprodeck.com/images/cards/38120068.jpg', imageSmall: 'https://images.ygoprodeck.com/images/cards_small/38120068.jpg', imageLarge: 'https://images.ygoprodeck.com/images/cards/38120068.jpg', priceFoil: null, setName: 'SDRL', setCode: '', legalities: {} },
    ]
  },
  { 
    id: 'cd5', name: 'Charizard ex Meta', game: 'pokemon', format: 'Standard', author: 'FireTrainer', authorAvatar: 'FT', likes: 312, views: 5200, comments: 35, cardCount: 15, 
    previewCards: ['https://images.pokemontcg.io/swsh45/SV107.png', 'https://images.pokemontcg.io/swsh4/188.png'], 
    description: 'Competitive Charizard ex deck for Standard format', createdAt: '2024-04-12',
    cards: [
      { id: 'pk1', name: 'Charizard ex', typeLine: 'Pokémon', cmc: 0, colors: ['Fire'], colorIdentity: [], rarity: 'Double Rare', quantity: 3, board: 'main', priceUsd: '12.00', imageNormal: 'https://images.pokemontcg.io/sv3/125.png', imageSmall: 'https://images.pokemontcg.io/sv3/125.png', imageLarge: 'https://images.pokemontcg.io/sv3/125.png', priceFoil: null, setName: 'Obsidian Flames', setCode: 'OBF', legalities: {} },
      { id: 'pk2', name: 'Charmander', typeLine: 'Pokémon', cmc: 0, colors: ['Fire'], colorIdentity: [], rarity: 'Common', quantity: 4, board: 'main', priceUsd: '0.10', imageNormal: 'https://images.pokemontcg.io/sv3/26.png', imageSmall: 'https://images.pokemontcg.io/sv3/26.png', imageLarge: 'https://images.pokemontcg.io/sv3/26.png', priceFoil: null, setName: 'Obsidian Flames', setCode: 'OBF', legalities: {} },
      { id: 'pk3', name: 'Rare Candy', typeLine: 'Trainer', cmc: 0, colors: [], colorIdentity: [], rarity: 'Uncommon', quantity: 4, board: 'main', priceUsd: '0.50', imageNormal: 'https://images.pokemontcg.io/sv1/191.png', imageSmall: 'https://images.pokemontcg.io/sv1/191.png', imageLarge: 'https://images.pokemontcg.io/sv1/191.png', priceFoil: null, setName: 'Scarlet & Violet', setCode: 'SVI', legalities: {} },
      { id: 'pk4', name: 'Fire Energy', typeLine: 'Energy', cmc: 0, colors: [], colorIdentity: [], rarity: 'Common', quantity: 12, board: 'main', priceUsd: '0.10', imageNormal: 'https://images.pokemontcg.io/sv3/230.png', imageSmall: 'https://images.pokemontcg.io/sv3/230.png', imageLarge: 'https://images.pokemontcg.io/sv3/230.png', priceFoil: null, setName: 'Obsidian Flames', setCode: 'OBF', legalities: {} },
    ]
  },
  { 
    id: 'cd7', name: 'Luffy Aggro Rush', game: 'onepiece', format: 'Standard', author: 'StrawHat', authorAvatar: 'SH', likes: 145, views: 2200, comments: 10, cardCount: 50, previewCards: [], description: 'Fast Luffy aggro with Red/Green engine', createdAt: '2024-05-01',
    cards: [
      { id: 'op1', name: 'Monkey D. Luffy', typeLine: 'Leader', cmc: 0, colors: [], colorIdentity: [], rarity: 'Leader', quantity: 1, board: 'main', priceUsd: '10.00', imageNormal: '', imageSmall: '', imageLarge: '', priceFoil: null, setName: 'Romance Dawn', setCode: 'OP01', legalities: {} },
      { id: 'op2', name: 'Roronoa Zoro', typeLine: 'Character', cmc: 3, colors: [], colorIdentity: [], rarity: 'Super Rare', quantity: 4, board: 'main', priceUsd: '15.00', imageNormal: '', imageSmall: '', imageLarge: '', priceFoil: null, setName: 'Romance Dawn', setCode: 'OP01', legalities: {} },
    ]
  },
  { 
    id: 'cd8', name: 'Vader Control', game: 'starwars', format: 'Standard', author: 'SithLord', authorAvatar: 'SL', likes: 167, views: 2600, comments: 14, cardCount: 50, previewCards: [], description: 'Dark Side control with Vader finisher', createdAt: '2024-05-10',
    cards: [
      { id: 'sw1', name: 'Darth Vader', typeLine: 'Unit', cmc: 7, colors: [], colorIdentity: [], rarity: 'Legendary', quantity: 3, board: 'main', priceUsd: '35.00', imageNormal: '', imageSmall: '', imageLarge: '', priceFoil: null, setName: 'Spark of Rebellion', setCode: 'SOR', legalities: {} },
    ]
  },
  // Default fallbacks for others
  { id: 'cd4', name: 'Branded Despia', game: 'yugioh', format: 'Competitive', author: 'DuelMaster', authorAvatar: 'DM', likes: 198, views: 3800, comments: 18, cardCount: 40, previewCards: ['https://images.ygoprodeck.com/images/cards_small/46986414.jpg'], description: 'Tier 1 Branded Despia fusion strategy', createdAt: '2024-03-05', cards: [] },
  { id: 'cd6', name: 'Lost Zone Giratina', game: 'pokemon', format: 'Standard', author: 'GhostPlayer', authorAvatar: 'GP', likes: 178, views: 2900, comments: 12, cardCount: 60, previewCards: ['https://images.pokemontcg.io/swsh7/215.png'], description: 'Lost Zone engine with Giratina VSTAR finisher', createdAt: '2024-04-08', cards: [] },
  { id: 'cd9', name: 'Zaku Swarm', game: 'gundam', format: 'Standard', author: 'ZeonPilot', authorAvatar: 'ZP', likes: 89, views: 1400, comments: 6, cardCount: 50, previewCards: [], description: 'Overwhelming board presence with Zaku variants', createdAt: '2024-05-15', cards: [] },
  { id: 'cd10', name: 'Amber/Steel Midrange', game: 'lorcana', format: 'Standard', author: 'LorcanaLove', authorAvatar: 'LL', likes: 201, views: 3100, comments: 20, cardCount: 60, previewCards: [], description: 'Balanced midrange strategy with Amber/Steel inkwell cards', createdAt: '2024-05-20', cards: [] },
  { id: 'cd11', name: 'Esper Control', game: 'mtg', format: 'Standard', author: 'ControlFreak', authorAvatar: 'CF', likes: 156, views: 2800, comments: 11, cardCount: 60, previewCards: ['https://cards.scryfall.io/art_crop/front/c/8/c8817585-0d32-4d56-9142-0d29512e86a9.jpg'], description: 'Classic Esper control with counterspells and removal', createdAt: '2024-02-28', colors: ['W', 'U', 'B'], cards: [] },
  { id: 'cd12', name: 'Rookie Investment Portfolio', game: 'sports', format: 'Collecting', author: 'CardInvestor', authorAvatar: 'CI', likes: 98, views: 1800, comments: 8, cardCount: 25, previewCards: [], description: 'Top rookie cards to invest in for 2024', createdAt: '2024-06-01', cards: [] },
];

/* ═══════════════════════════════════════════════════════════════════
   GAME CONFIG FOR DECK BUILDER
   ═══════════════════════════════════════════════════════════════════ */
interface GameDeckConfig {
  boards: { id: string; label: string; min?: number; max?: number }[];
  formats: string[];
  searchPlaceholder: string;
  importExamples: string;
}

const GAME_DECK_CONFIGS: Record<string, GameDeckConfig> = {
  onepiece: {
    boards: [
      { id: 'main', label: 'Main Deck', min: 50 },
      { id: 'sideboard', label: 'Sideboard' },
      { id: 'maybe', label: 'Maybeboard' },
    ],
    formats: ['standard', 'casual'],
    searchPlaceholder: 'Search One Piece cards (API + 100+ offline)...',
    importExamples: '1x Monkey D. Luffy\n4x Roronoa Zoro\n4x Nami\n4x Sanji\n2x Portgas D. Ace\n3x Trafalgar Law',
  },
  starwars: {
    boards: [
      { id: 'main', label: 'Main Deck' },
      { id: 'sideboard', label: 'Sideboard' },
      { id: 'maybe', label: 'Maybeboard' },
    ],
    formats: ['standard', 'casual'],
    searchPlaceholder: 'Search Star Wars Unlimited (API + 100+ offline)...',
    importExamples: '1x Luke Skywalker\n2x Darth Vader\n3x Han Solo\n4x Stormtrooper\n2x Obi-Wan Kenobi\n1x Emperor Palpatine',
  },
  gundam: {
    boards: [
      { id: 'main', label: 'Main Deck' },
      { id: 'sideboard', label: 'Sideboard' },
      { id: 'maybe', label: 'Maybeboard' },
    ],
    formats: ['standard', 'casual'],
    searchPlaceholder: 'Search Gundam cards (50+ cards)...',
    importExamples: '1x RX-78-2 Gundam\n3x Zaku II\n1x Char Aznable\n1x Amuro Ray',
  },
  lorcana: {
    boards: [
      { id: 'main', label: 'Main Deck', min: 60, max: 60 },
      { id: 'sideboard', label: 'Sideboard' },
      { id: 'maybe', label: 'Maybeboard' },
    ],
    formats: ['standard', 'casual'],
    searchPlaceholder: 'Search Lorcana cards (45+ cards)...',
    importExamples: '4x Elsa - Spirit of Winter\n3x Mickey Mouse - Brave Little Tailor\n4x Stitch - Carefree Surfer',
  },
  sports: {
    boards: [
      { id: 'main', label: 'Collection' },
      { id: 'sideboard', label: 'Trade Pile' },
      { id: 'maybe', label: 'Watchlist' },
    ],
    formats: ['collecting', 'investment', 'casual'],
    searchPlaceholder: 'Search Sports cards (40+ cards)...',
    importExamples: '1x Michael Jordan Rookie\n1x LeBron James Rookie\n1x Tom Brady Rookie',
  },
  mtg: {
    boards: [
      { id: 'main', label: 'Main Deck', min: 60 },
      { id: 'sideboard', label: 'Sideboard', max: 15 },
      { id: 'commander', label: 'Commander', max: 1 },
      { id: 'maybe', label: 'Maybeboard' },
    ],
    formats: ['commander', 'standard', 'modern', 'legacy', 'pioneer', 'pauper', 'vintage', 'casual'],
    searchPlaceholder: 'Search MTG cards (Scryfall)...',
    importExamples: '4x Lightning Bolt\n4x Counterspell\n2x Jace, the Mind Sculptor\n20x Island\n\nSideboard:\n2x Negate',
  },
  yugioh: {
    boards: [
      { id: 'main', label: 'Main Deck', min: 40, max: 60 },
      { id: 'sideboard', label: 'Extra Deck', max: 15 },
      { id: 'maybe', label: 'Side Deck', max: 15 },
    ],
    formats: ['competitive', 'casual', 'traditional', 'speed duel'],
    searchPlaceholder: 'Search Yu-Gi-Oh! cards (YGOPRODeck)...',
    importExamples: '3x Blue-Eyes White Dragon\n3x Blue-Eyes Alternative\n1x Blue-Eyes Chaos MAX\n\nExtra Deck:\n2x Blue-Eyes Twin Burst\n1x Neo Blue-Eyes Ultimate',
  },
  pokemon: {
    boards: [
      { id: 'main', label: 'Main Deck', min: 60, max: 60 },
      { id: 'sideboard', label: 'Sideboard' },
      { id: 'maybe', label: 'Maybeboard' },
    ],
    formats: ['standard', 'expanded', 'unlimited', 'casual'],
    searchPlaceholder: 'Search Pokémon cards (Pokemon TCG API)...',
    importExamples: '4x Charizard ex\n3x Arcanine\n4x Rare Candy\n10x Fire Energy',
  },
  default: {
    boards: [
      { id: 'main', label: 'Main Deck' },
      { id: 'sideboard', label: 'Sideboard' },
      { id: 'maybe', label: 'Maybeboard' },
    ],
    formats: ['standard', 'casual'],
    searchPlaceholder: 'Search cards...',
    importExamples: '1x Card Name\n2x Another Card',
  },
};

function getGameConfig(game: GameCategory): GameDeckConfig {
  return GAME_DECK_CONFIGS[game] || GAME_DECK_CONFIGS.default;
}

/* ═══════════════════════════════════════════════════════════════════
   CARD DETAIL MODAL
   ═══════════════════════════════════════════════════════════════════ */
function CardDetailModal({ card, onClose }: {
  card: MarketCard | DeckCard | null;
  onClose: () => void;
}) {
  const [printings, setPrintings] = useState<CardPrinting[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPrinting, setSelectedPrinting] = useState<CardPrinting | null>(null);
  const { addToCart } = useStore();

  useEffect(() => {
    if (!card) return;
    setLoading(true);
    setPrintings([]);
    setSelectedPrinting(null);
    scryfallGetPrintings(card.name).then(p => {
      setPrintings(p);
      if (p.length > 0) setSelectedPrinting(p[0]);
      setLoading(false);
    });
  }, [card]);

  if (!card) return null;

  const handleBuy = (p: CardPrinting) => {
    const cartItem: CartItem = {
      id: `print-${p.id}`, name: `${p.name} (${p.setCode} #${p.collectorNumber})`,
      set: p.setName, game: 'mtg' as GameCategory, rarity: p.rarity,
      condition: 'Near Mint', price: parseFloat(p.priceUsd || '0'),
      image: p.imageNormal, seller: 'TCGPlayer', type: 'single', qty: 1,
    };
    addToCart(cartItem);
  };

  const active = selectedPrinting;

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-8 overflow-y-auto" onClick={onClose}>
        <div className="glass-strong rounded-2xl w-full max-w-5xl glow-border animate-slide-in-up my-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <h2 className="font-display text-sm font-bold glow-text flex items-center gap-2">
              <Eye size={16} /> {card.name}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">{printings.length} printings found</span>
              <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg"><X size={18} /></button>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-[320px] flex-shrink-0 p-6 flex flex-col items-center border-b lg:border-b-0 lg:border-r border-white/5">
              {active?.imageNormal ? (
                <img src={active.imageLarge || active.imageNormal} alt={active.name} className="w-full max-w-[280px] rounded-xl shadow-2xl border border-white/10" />
              ) : (
                <div className="w-full max-w-[280px] aspect-[5/7] rounded-xl bg-white/5 flex items-center justify-center">
                  <Package size={40} className="text-[var(--text-muted)] opacity-30" />
                </div>
              )}
              {active && (
                <div className="mt-4 w-full max-w-[280px] space-y-2">
                  <p className="text-sm font-bold">{active.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{active.setName} ({active.setCode}) #{active.collectorNumber}</p>
                  <p className="text-xs text-[var(--text-muted)]">Artist: {active.artist}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${
                      active.rarity === 'mythic' ? 'bg-orange-500/20 text-orange-400' :
                      active.rarity === 'rare' ? 'bg-amber-500/20 text-amber-400' :
                      active.rarity === 'uncommon' ? 'bg-gray-400/20 text-gray-300' :
                      'bg-white/10 text-[var(--text-muted)]'
                    }`}>{active.rarity}</span>
                    {active.fullArt && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">Full Art</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="glass rounded-lg p-2.5 text-center">
                      <p className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider">TCGPlayer</p>
                      <p className="text-sm font-bold glow-text">{active.priceUsd ? `$${active.priceUsd}` : 'N/A'}</p>
                    </div>
                    <div className="glass rounded-lg p-2.5 text-center">
                      <p className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider">Foil</p>
                      <p className="text-sm font-bold text-amber-400">{active.priceFoil ? `$${active.priceFoil}` : 'N/A'}</p>
                    </div>
                  </div>
                  <button onClick={() => handleBuy(active)} className="w-full btn-accent py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 mt-2">
                    <ShoppingCart size={14} /> Add to Cart — {active.priceUsd ? `$${active.priceUsd}` : 'N/A'}
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 p-4 max-h-[70vh] overflow-y-auto">
              <h3 className="font-display text-xs font-bold glow-text mb-3 uppercase tracking-wider">ALL PRINTINGS & EDITIONS</h3>
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
                  <span className="ml-3 text-sm text-[var(--text-secondary)]">Loading printings...</span>
                </div>
              ) : printings.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted)]">
                  <Package size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No printings found</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {printings.map(p => (
                    <button key={p.id} onClick={() => setSelectedPrinting(p)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group ${
                        selectedPrinting?.id === p.id ? 'glow-border bg-white/5' : 'hover:bg-white/[0.03] border border-transparent'
                      }`}>
                      <div className="w-10 h-14 rounded-md overflow-hidden flex-shrink-0 border border-white/10 bg-white/5">
                        {p.imageSmall ? <img src={p.imageSmall} alt="" className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-[8px]">IMG</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold truncate">{p.setName}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full capitalize ${
                            p.rarity === 'mythic' ? 'bg-orange-500/20 text-orange-400' :
                            p.rarity === 'rare' ? 'bg-amber-500/20 text-amber-400' :
                            p.rarity === 'uncommon' ? 'bg-gray-400/20 text-gray-300' :
                            'bg-white/10 text-[var(--text-muted)]'
                          }`}>{p.rarity}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[var(--text-muted)]">{p.setCode} #{p.collectorNumber}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">• {p.releasedAt?.slice(0, 4)}</span>
                          {p.fullArt && <span className="text-[8px] text-purple-400">Full Art</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-[8px] text-[var(--text-muted)] uppercase">Normal</p>
                          <p className={`text-xs font-bold ${p.priceUsd ? 'glow-text' : 'text-[var(--text-muted)]'}`}>
                            {p.priceUsd ? `$${p.priceUsd}` : '—'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] text-[var(--text-muted)] uppercase">Foil</p>
                          <p className={`text-xs font-bold ${p.priceFoil ? 'text-amber-400' : 'text-[var(--text-muted)]'}`}>
                            {p.priceFoil ? `$${p.priceFoil}` : '—'}
                          </p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleBuy(p); }}
                          className="btn-accent px-2.5 py-1.5 rounded-lg text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <ShoppingCart size={10} /> Buy
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {printings.length > 0 && (
                <div className="mt-4 p-3 glass rounded-xl text-center">
                  <a href={`https://www.tcgplayer.com/search/magic/product?q=${encodeURIComponent(card.name)}`} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] font-medium flex items-center justify-center gap-1 hover:underline" style={{ color: 'var(--accent)' }}>
                    View on TCGPlayer <ExternalLink size={9} />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   NAVBAR
   ═══════════════════════════════════════════════════════════════════ */
function Navbar() {
  const { activePage, setActivePage, cart, setCartOpen, isLoggedIn, user, setAuthModal, setSettingsOpen } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: { id: ActivePage; label: string }[] = [
    { id: 'home', label: 'Home' }, { id: 'marketplace', label: 'Marketplace' },
    { id: 'deckbuilder', label: 'Deck Builder' }, { id: 'collection', label: 'Collection' },
    { id: 'sell', label: 'Sell' }, { id: 'deploy', label: 'Deploy' },
  ];

  return (
    <nav className="sticky top-0 z-50 glass-strong">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <button onClick={() => setActivePage('home')} className="flex items-center gap-2.5 group">
            <KardFlowLogo size={34} />
            <span className="font-display text-lg font-bold glow-text tracking-wider">KARDFLOW</span>
          </button>
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map(item => (
              <button key={item.id} onClick={() => setActivePage(item.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activePage === item.id ? 'btn-accent text-black' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
                }`}>{item.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] relative">
              <Bell size={18} /><span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
            </button>
            <button onClick={() => setCartOpen(true)} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] relative">
              <ShoppingCart size={18} />
              {cart.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full btn-accent text-[10px] flex items-center justify-center font-bold">{cart.reduce((s, c) => s + c.qty, 0)}</span>}
            </button>
            <button onClick={() => setSettingsOpen(true)} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><Settings size={18} /></button>
            {isLoggedIn && user ? (
              <button onClick={() => setActivePage('profile')} className="w-8 h-8 rounded-full btn-accent flex items-center justify-center text-xs font-bold">{user.avatar}</button>
            ) : (
              <button onClick={() => setAuthModal('login')} className="btn-ghost px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"><LogIn size={14} /> Sign In</button>
            )}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden p-2 text-[var(--text-secondary)]">
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="lg:hidden pb-4 space-y-1 animate-slide-in-up">
            {navItems.map(item => (
              <button key={item.id} onClick={() => { setActivePage(item.id); setMobileOpen(false); }}
                className={`block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activePage === item.id ? 'btn-accent text-black' : 'text-[var(--text-secondary)] hover:bg-white/5'
                }`}>{item.label}</button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CART SIDEBAR
   ═══════════════════════════════════════════════════════════════════ */
function CartSidebar() {
  const { cartOpen, setCartOpen, cart, removeFromCart, updateCartQty, clearCart } = useStore();
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  if (!cartOpen) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setCartOpen(false)} />
      <div className="fixed top-0 right-0 z-50 h-full w-full sm:w-96 glass-strong animate-slide-in-right flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="font-display text-sm font-bold glow-text flex items-center gap-2"><ShoppingCart size={16} /> CART ({cart.reduce((s, c) => s + c.qty, 0)})</h2>
          <button onClick={() => setCartOpen(false)} className="p-1 hover:bg-white/5 rounded-lg"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
              <ShoppingCart size={40} className="mb-3 opacity-30" /><p className="text-sm font-medium">Cart is empty</p>
            </div>
          ) : cart.map(item => (
            <div key={item.id} className="glass rounded-xl p-3 flex items-center gap-3 glow-border-hover">
              <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
                {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <Package size={20} className="text-[var(--text-muted)]" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.name}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{item.set}</p>
                <div className="flex items-center gap-2 mt-1">
                  <button onClick={() => updateCartQty(item.id, item.qty - 1)} className="p-0.5 hover:bg-white/10 rounded"><Minus size={10} /></button>
                  <span className="text-xs font-bold">{item.qty}</span>
                  <button onClick={() => updateCartQty(item.id, item.qty + 1)} className="p-0.5 hover:bg-white/10 rounded"><Plus size={10} /></button>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold glow-text">${(item.price * item.qty).toFixed(2)}</p>
                <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-300 mt-1"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="p-4 border-t border-white/5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Total</span>
              <span className="text-xl font-bold glow-text">${total.toFixed(2)}</span>
            </div>
            <button className="w-full btn-accent py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"><CreditCard size={16} /> Checkout</button>
            <button onClick={clearCart} className="w-full text-center text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors">Clear Cart</button>
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SETTINGS PANEL
   ═══════════════════════════════════════════════════════════════════ */
function SettingsPanel() {
  const { settingsOpen, setSettingsOpen, theme, setTheme, isLoggedIn, logout } = useStore();
  if (!settingsOpen) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSettingsOpen(false)} />
      <div className="fixed top-0 right-0 z-50 h-full w-full sm:w-96 glass-strong animate-slide-in-right flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="font-display text-sm font-bold glow-text flex items-center gap-2"><Settings size={16} /> SETTINGS</h2>
          <button onClick={() => setSettingsOpen(false)} className="p-1 hover:bg-white/5 rounded-lg"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Theme</h3>
            <div className="grid grid-cols-1 gap-2">
              {THEMES.map(t => (
                <button key={t.id} onClick={() => setTheme(t.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${theme === t.id ? 'glow-border bg-white/5' : 'glass hover:bg-white/5'}`}>
                  <div className="w-5 h-5 rounded-full flex-shrink-0 border-2" style={{ backgroundColor: t.preview, borderColor: theme === t.id ? t.preview : 'transparent' }} />
                  <span className="text-sm font-medium">{t.label}</span>
                  {theme === t.id && <Star size={14} className="ml-auto" style={{ color: t.preview }} />}
                </button>
              ))}
            </div>
          </div>
          {isLoggedIn && (
            <button onClick={() => { logout(); setSettingsOpen(false); }} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium">
              <LogOut size={16} /> Sign Out
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AUTH MODAL
   ═══════════════════════════════════════════════════════════════════ */
function AuthModal() {
  const { authModal, setAuthModal, login } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  if (!authModal) return null;
  const handleSubmit = () => { if (username.trim()) { login(username.trim()); setUsername(''); setPassword(''); } };
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setAuthModal(null)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setAuthModal(null)}>
        <div className="glass-strong rounded-2xl w-full max-w-md glow-border animate-slide-in-up" onClick={e => e.stopPropagation()}>
          <div className="p-6 text-center border-b border-white/5">
            <KardFlowLogo size={48} />
            <h2 className="font-display text-lg font-bold glow-text mt-3">{authModal === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" className="w-full input-dark rounded-xl px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" className="w-full input-dark rounded-xl px-4 py-2.5 text-sm" />
            </div>
            <button onClick={handleSubmit} className="w-full btn-accent py-3 rounded-xl text-sm font-bold">{authModal === 'login' ? 'Sign In' : 'Create Account'}</button>
            <p className="text-center text-xs text-[var(--text-muted)]">
              {authModal === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => setAuthModal(authModal === 'login' ? 'signup' : 'login')} className="glow-text font-medium">{authModal === 'login' ? 'Sign Up' : 'Sign In'}</button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HOME PAGE
   ═══════════════════════════════════════════════════════════════════ */
function HomePage() {
  const { setActivePage } = useStore();
  return (
    <div>
      <section className="relative animated-bg overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-[20%] w-72 h-72 rounded-full animate-pulse-glow" style={{ background: 'radial-gradient(circle, var(--accent-glow-strong), transparent)' }} />
          <div className="absolute bottom-10 right-[20%] w-96 h-96 rounded-full animate-pulse-glow" style={{ background: 'radial-gradient(circle, var(--accent-glow), transparent)', animationDelay: '1.5s' }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 py-20 sm:py-32">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 glass rounded-full px-5 py-2 text-xs font-medium glow-border">
              <Zap size={14} style={{ color: 'var(--accent)' }} /><span>The Ultimate Trading Card Platform</span>
            </div>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display font-black leading-tight">
              <span className="block text-[var(--text-primary)]">BUY · SELL · TRADE</span>
              <span className="block accent-gradient-text mt-2">CARDS THAT MATTER</span>
            </h1>
            <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">8 supported games. Real-time pricing. Advanced deck building. Every card ever printed.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button onClick={() => setActivePage('marketplace')} className="btn-accent px-8 py-3.5 rounded-xl text-sm font-bold flex items-center gap-2">Explore Marketplace <ArrowRight size={16} /></button>
              <button onClick={() => setActivePage('deckbuilder')} className="btn-ghost px-8 py-3.5 rounded-xl text-sm font-medium">Build a Deck</button>
            </div>
            <div className="flex items-center justify-center gap-8 sm:gap-14 pt-8">
              {[{ icon: <TrendingUp size={18} />, value: '120K+', label: 'Cards Listed' }, { icon: <Users size={18} />, value: '35K+', label: 'Active Traders' }, { icon: <Shield size={18} />, value: '100%', label: 'Buyer Protection' }].map((s, i) => (
                <div key={i} className="flex items-center gap-2.5 animate-counter" style={{ animationDelay: `${i * 0.2}s` }}>
                  <span style={{ color: 'var(--accent)' }}>{s.icon}</span>
                  <div className="text-left"><p className="text-xl font-bold">{s.value}</p><p className="text-[10px] text-[var(--text-muted)]">{s.label}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="font-display text-2xl font-bold glow-text mb-8">BROWSE BY GAME</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {GAMES.map(game => (
            <button key={game.id} onClick={() => setActivePage('marketplace')} className="glass rounded-2xl p-5 text-center card-hover glow-border-hover group">
              <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">{game.icon}</div>
              <p className="text-sm font-semibold">{game.name}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Browse cards →</p>
            </button>
          ))}
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold glow-text">FEATURED SINGLES</h2>
          <button onClick={() => setActivePage('marketplace')} className="text-xs font-medium glow-text flex items-center gap-1 hover:underline">View All <ArrowRight size={12} /></button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {SAMPLE_CARDS.filter(c => c.featured && c.type === 'single').map(card => <MarketCardItem key={card.id} card={card} />)}
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-4 py-8 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold glow-text">SEALED PRODUCTS</h2>
          <button onClick={() => setActivePage('marketplace')} className="text-xs font-medium glow-text flex items-center gap-1 hover:underline">View All <ArrowRight size={12} /></button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {SAMPLE_CARDS.filter(c => c.type === 'sealed').slice(0, 4).map(card => <MarketCardItem key={card.id} card={card} />)}
        </div>
      </section>
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4"><KardFlowLogo size={24} /><span className="font-display text-sm font-bold glow-text">KARDFLOW</span></div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">The ultimate trading card platform.</p>
            </div>
            {[{ title: 'Platform', items: ['Marketplace', 'Deck Builder', 'Collections'] }, { title: 'Games', items: ['MTG', 'Pokémon', 'Yu-Gi-Oh!'] }, { title: 'Support', items: ['Help', 'Protection', 'Contact'] }].map(col => (
              <div key={col.title}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">{col.title}</h3>
                <ul className="space-y-2">{col.items.map(i => <li key={i} className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer transition-colors">{i}</li>)}</ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 mt-10 pt-6 text-center text-[10px] text-[var(--text-muted)]">© 2024 KardFlow. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MARKET CARD ITEM
   ═══════════════════════════════════════════════════════════════════ */
function MarketCardItem({ card }: { card: MarketCard }) {
  const { addToCart, addToWishlist } = useStore();
  const [showDetail, setShowDetail] = useState(false);
  const gameInfo = GAMES.find(g => g.id === card.game);

  return (
    <>
      <div className="glass rounded-2xl overflow-hidden card-hover group glow-border-hover cursor-pointer relative" onClick={() => setShowDetail(true)}>
        {card.featured && <div className="absolute top-2 left-2 z-10 btn-accent text-[9px] font-bold px-2 py-0.5 rounded-full">⚡ FEATURED</div>}
        <div className="relative h-44 bg-white/[0.02] flex items-center justify-center overflow-hidden">
          {card.image ? <img src={card.image} alt={card.name} className="h-full w-full object-contain p-2 group-hover:scale-110 transition-transform duration-500" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : null}
          {!card.image && <div className="text-center"><span className="text-4xl">{gameInfo?.icon || '🃏'}</span>{card.sealedType && <p className="text-[10px] text-[var(--text-muted)] mt-2">{card.sealedType}</p>}</div>}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-transparent to-transparent" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button onClick={e => { e.stopPropagation(); addToCart({ ...card, qty: 1 }); }} className="p-2.5 glass rounded-xl hover:bg-white/20 transition-colors" title="Add to Cart"><ShoppingCart size={16} /></button>
            <button onClick={e => { e.stopPropagation(); addToWishlist({ id: card.id, name: card.name, game: card.game, image: card.image, price: card.price }); }} className="p-2.5 glass rounded-xl hover:bg-white/20 transition-colors" title="Wishlist"><Heart size={16} /></button>
            <button onClick={e => { e.stopPropagation(); setShowDetail(true); }} className="p-2.5 glass rounded-xl hover:bg-white/20 transition-colors" title="View Printings"><Eye size={16} /></button>
          </div>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-1.5"><span className="text-xs">{gameInfo?.icon}</span><span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{card.set}</span></div>
          <h3 className="text-sm font-semibold truncate">{card.name}</h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full glass">{card.rarity}</span>
            {card.condition !== 'Sealed' && <span className="text-[9px] text-[var(--text-muted)]">{card.condition}</span>}
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-lg font-bold glow-text">${card.price.toLocaleString()}</span>
            {card.marketPrice && card.marketPrice !== card.price && <span className="text-[10px] text-[var(--text-muted)] line-through">${card.marketPrice}</span>}
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <div className="flex items-center gap-1.5"><User size={10} className="text-[var(--text-muted)]" /><span className="text-[10px] text-[var(--text-muted)]">{card.seller}</span></div>
          </div>
        </div>
      </div>
      {showDetail && <CardDetailModal card={card as unknown as MarketCard} onClose={() => setShowDetail(false)} />}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MARKETPLACE PAGE
   ═══════════════════════════════════════════════════════════════════ */
function MarketplacePage() {
  const [gameFilter, setGameFilter] = useState<GameCategory>('all');
  const [productType, setProductType] = useState<'all' | 'single' | 'sealed'>('all');
  const [sort, setSort] = useState('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [rarityFilter, setRarityFilter] = useState('');
  const [apiResults, setApiResults] = useState<MarketCard[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchAPIs = useCallback(async (query: string, game: GameCategory) => {
    if (!query || query.length < 2) { setApiResults([]); return; }
    setApiLoading(true);
    const results: MarketCard[] = [];
    try {
      if (game === 'all' || game === 'mtg') {
        const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&order=name&unique=cards`);
        if (res.ok) {
          const data = await res.json();
          (data.data || []).slice(0, 20).forEach((c: Record<string, unknown>) => {
            const iu = c.image_uris as Record<string, string> | undefined;
            const cf = c.card_faces as Array<{ image_uris?: Record<string, string> }> | undefined;
            const pr = c.prices as Record<string, string | null>;
            results.push({ id: `mtg-${c.id}`, name: c.name as string, set: (c.set_name as string) || '', game: 'mtg', rarity: c.rarity as string, condition: 'Near Mint', price: parseFloat(pr?.usd || '0') || 0, marketPrice: parseFloat(pr?.usd || '0') || 0, image: iu?.normal || cf?.[0]?.image_uris?.normal || '', seller: 'TCGPlayer', type: 'single', color: ((c.colors || []) as string[]).join(',') });
          });
        }
      }
      if (game === 'all' || game === 'pokemon') {
        const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(query)}&pageSize=12`);
        if (res.ok) {
          const data = await res.json();
          (data.data || []).forEach((c: Record<string, unknown>) => {
            const images = c.images as Record<string, string> | undefined;
            const tcgp = c.tcgplayer as { prices?: Record<string, { market?: number }> } | undefined;
            const price = tcgp?.prices?.holofoil?.market || tcgp?.prices?.normal?.market || 0;
            results.push({ id: `pkmn-${c.id}`, name: c.name as string, set: (c.set as Record<string, string>)?.name || '', game: 'pokemon', rarity: c.rarity as string || 'Common', condition: 'Near Mint', price, marketPrice: price, image: images?.small || '', seller: 'TCGPlayer', type: 'single' });
          });
        }
      }
      if (game === 'all' || game === 'yugioh') {
        const res = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(query)}&num=12&offset=0`);
        if (res.ok) {
          const data = await res.json();
          (data.data || []).slice(0, 12).forEach((c: Record<string, unknown>) => {
            const images = (c.card_images as Array<Record<string, unknown>>)?.[0];
            const prices = (c.card_prices as Array<Record<string, string>>)?.[0];
            results.push({ id: `ygo-${c.id}`, name: c.name as string, set: (c.archetype as string) || 'Yu-Gi-Oh!', game: 'yugioh', rarity: (c.type as string) || 'Common', condition: 'Near Mint', price: parseFloat(prices?.tcgplayer_price || '0') || 0, marketPrice: parseFloat(prices?.tcgplayer_price || '0') || 0, image: (images?.image_url_small as string) || '', seller: 'TCGPlayer', type: 'single' });
          });
        }
      }
    } catch { /* silently handled */ }
    setApiResults(results);
    setApiLoading(false);
  }, []);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchAPIs(val, gameFilter), 400);
  }, [searchAPIs, gameFilter]);

  const allCards = useMemo(() => {
    const base = search.length >= 2 ? apiResults : SAMPLE_CARDS;
    return base.filter(c => {
      if (gameFilter !== 'all' && c.game !== gameFilter) return false;
      if (productType !== 'all' && c.type !== productType) return false;
      if (rarityFilter && c.rarity.toLowerCase() !== rarityFilter.toLowerCase()) return false;
      if (priceRange.min && c.price < parseFloat(priceRange.min)) return false;
      if (priceRange.max && c.price > parseFloat(priceRange.max)) return false;
      if (!search && c.name) return true;
      return c.name.toLowerCase().includes(search.toLowerCase());
    }).sort((a, b) => {
      if (sort === 'price-low') return a.price - b.price;
      if (sort === 'price-high') return b.price - a.price;
      if (sort === 'name') return a.name.localeCompare(b.name);
      return 0;
    });
  }, [search, apiResults, gameFilter, productType, sort, rarityFilter, priceRange]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center glass rounded-xl px-4 py-2.5 glow-border-hover">
            <Search size={18} className="text-[var(--text-muted)] flex-shrink-0" />
            <input type="text" value={search} onChange={e => handleSearchChange(e.target.value)} placeholder="Search cards across all games..." className="bg-transparent border-none outline-none text-sm ml-3 w-full text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" />
            {apiLoading && <Loader2 size={16} className="animate-spin flex-shrink-0" style={{ color: 'var(--accent)' }} />}
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className="btn-ghost px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
            <Filter size={14} /> Filters <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => { setGameFilter('all'); if (search) searchAPIs(search, 'all'); }} className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${gameFilter === 'all' ? 'btn-accent' : 'glass text-[var(--text-secondary)] hover:bg-white/5'}`}>🃏 All Games</button>
          {GAMES.map(g => (
            <button key={g.id} onClick={() => { setGameFilter(g.id); if (search) searchAPIs(search, g.id); }} className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${gameFilter === g.id ? 'btn-accent' : 'glass text-[var(--text-secondary)] hover:bg-white/5'}`}>{g.icon} {g.name}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center glass rounded-xl overflow-hidden">
            {(['all', 'single', 'sealed'] as const).map(t => (
              <button key={t} onClick={() => setProductType(t)} className={`px-4 py-2 text-xs font-medium transition-colors ${productType === t ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-secondary)] hover:bg-white/5'}`}>{t === 'all' ? 'All' : t === 'single' ? '🎴 Singles' : '📦 Sealed'}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select value={sort} onChange={e => setSort(e.target.value)} className="input-dark rounded-xl px-3 py-2 text-xs cursor-pointer">
              <option value="newest">Newest</option><option value="price-low">Price: Low → High</option><option value="price-high">Price: High → Low</option><option value="name">Name A-Z</option>
            </select>
            <div className="flex glass rounded-xl overflow-hidden">
              <button onClick={() => setViewMode('grid')} className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-muted)]'}`}><Grid size={14} /></button>
              <button onClick={() => setViewMode('list')} className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-muted)]'}`}><List size={14} /></button>
            </div>
          </div>
        </div>
        {showFilters && (
          <div className="glass rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 glow-border animate-slide-in-up">
            <div><label className="text-[10px] text-[var(--text-muted)] mb-1 block uppercase tracking-wider">Min Price</label><input type="number" placeholder="$0" value={priceRange.min} onChange={e => setPriceRange(p => ({ ...p, min: e.target.value }))} className="w-full input-dark rounded-lg px-3 py-2 text-xs" /></div>
            <div><label className="text-[10px] text-[var(--text-muted)] mb-1 block uppercase tracking-wider">Max Price</label><input type="number" placeholder="$99,999" value={priceRange.max} onChange={e => setPriceRange(p => ({ ...p, max: e.target.value }))} className="w-full input-dark rounded-lg px-3 py-2 text-xs" /></div>
            <div><label className="text-[10px] text-[var(--text-muted)] mb-1 block uppercase tracking-wider">Rarity</label><select value={rarityFilter} onChange={e => setRarityFilter(e.target.value)} className="w-full input-dark rounded-lg px-3 py-2 text-xs cursor-pointer"><option value="">Any</option><option value="common">Common</option><option value="uncommon">Uncommon</option><option value="rare">Rare</option><option value="mythic">Mythic</option></select></div>
            <div><label className="text-[10px] text-[var(--text-muted)] mb-1 block uppercase tracking-wider">Condition</label><select className="w-full input-dark rounded-lg px-3 py-2 text-xs cursor-pointer"><option>Any</option><option>Mint</option><option>Near Mint</option><option>Excellent</option></select></div>
          </div>
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-4">Showing <span className="font-bold text-[var(--text-primary)]">{allCards.length}</span> results{search && <> for "<span className="glow-text">{search}</span>"</>}</p>
      {allCards.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">{allCards.map(card => <MarketCardItem key={card.id} card={card} />)}</div>
        ) : (
          <div className="space-y-2">{allCards.map(card => {
            const gameInfo = GAMES.find(g => g.id === card.game);
            return (
              <div key={card.id} className="glass rounded-xl p-3 flex items-center gap-4 card-hover glow-border-hover">
                <div className="w-14 h-14 rounded-xl bg-white/[0.03] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {card.image ? <img src={card.image} alt="" className="h-full object-contain" loading="lazy" /> : <span className="text-2xl">{gameInfo?.icon || '🃏'}</span>}
                </div>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{card.name}</p><p className="text-[10px] text-[var(--text-muted)]">{gameInfo?.icon} {card.set} • {card.rarity}</p></div>
                <span className="text-lg font-bold glow-text">${card.price.toLocaleString()}</span>
              </div>
            );
          })}</div>
        )
      ) : (
        <div className="text-center py-20"><Search size={40} className="mx-auto text-[var(--text-muted)] opacity-30 mb-3" /><p className="text-lg font-bold">No cards found</p><p className="text-sm text-[var(--text-muted)]">Try searching above</p></div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DECK BUILDER PAGE — with Homepage + Editor
   ═══════════════════════════════════════════════════════════════════ */
function DeckBuilderPage() {
  const [view, setView] = useState<'homepage' | 'editor'>('homepage');
  const [selectedGame, setSelectedGame] = useState<GameCategory>('mtg');
  const [preloadCards, setPreloadCards] = useState<DeckCard[]>([]);
  const [preloadName, setPreloadName] = useState('');
  const [preloadFormat, setPreloadFormat] = useState('');
  const [preloadOpenAI, setPreloadOpenAI] = useState(false);

  const openEditor = (game: GameCategory, name?: string, format?: string, cards?: DeckCard[], withAI?: boolean) => {
    setSelectedGame(game);
    setPreloadName(name || '');
    setPreloadFormat(format || '');
    setPreloadCards(cards || []);
    setPreloadOpenAI(!!withAI);
    setView('editor');
  };

  if (view === 'editor') {
    return <DeckEditorPage game={selectedGame} onBack={() => setView('homepage')} preloadName={preloadName} preloadFormat={preloadFormat} preloadCards={preloadCards} openAI={preloadOpenAI} />;
  }

  return <DeckHomepage onCreateDeck={openEditor} />;
}

/* ═══════════════════════════════════════════════════════════════════
   DECK HOMEPAGE — Archidekt style
   ═══════════════════════════════════════════════════════════════════ */
function DeckHomepage({ onCreateDeck }: { onCreateDeck: (game: GameCategory, name?: string, format?: string, cards?: DeckCard[], withAI?: boolean) => void }) {
  const { decks, deleteDeck } = useStore();
  const [search, setSearch] = useState('');
  const [gameFilter, setGameFilter] = useState<GameCategory>('all');
  const [sortBy, setSortBy] = useState('popular');

  const filteredDecks = useMemo(() => {
    let d = [...COMMUNITY_DECKS];
    if (gameFilter !== 'all') d = d.filter(deck => deck.game === gameFilter);
    if (search) {
      const q = search.toLowerCase();
      d = d.filter(deck => deck.name.toLowerCase().includes(q) || deck.author.toLowerCase().includes(q) || deck.game.includes(q) || deck.format.toLowerCase().includes(q));
    }
    if (sortBy === 'popular') d.sort((a, b) => b.views - a.views);
    else if (sortBy === 'newest') d.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else if (sortBy === 'likes') d.sort((a, b) => b.likes - a.likes);
    return d;
  }, [search, gameFilter, sortBy]);

  const gameCounts = useMemo(() => {
    const counts: Record<string, number> = { all: COMMUNITY_DECKS.length };
    COMMUNITY_DECKS.forEach(d => { counts[d.game] = (counts[d.game] || 0) + 1; });
    return counts;
  }, []);

  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* Hero */}
      <section className="relative animated-bg overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-10 left-[30%] w-64 h-64 rounded-full animate-pulse-glow" style={{ background: 'radial-gradient(circle, var(--accent-glow-strong), transparent)' }} />
          <div className="absolute bottom-10 right-[25%] w-48 h-48 rounded-full animate-pulse-glow" style={{ background: 'radial-gradient(circle, var(--accent-glow), transparent)', animationDelay: '2s' }} />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-16 text-center">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-[10px] font-medium glow-border mb-4">
            <Layers size={12} style={{ color: 'var(--accent)' }} /> {COMMUNITY_DECKS.length} Community Decks • {decks.length} Your Decks
          </div>
          <h1 className="text-3xl sm:text-5xl font-display font-black mb-3">
            <span className="accent-gradient-text">DECK BUILDER</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-sm max-w-xl mx-auto mb-6">Build decks for MTG, Yu-Gi-Oh!, Pokémon, and 5 more games. Real card search via live APIs.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            <div className="flex items-center gap-2">
              <button onClick={() => onCreateDeck('mtg')} className="btn-accent px-8 py-3.5 rounded-xl text-sm font-bold flex items-center gap-2">
                <Plus size={16} /> Create New Deck
              </button>
              <button onClick={() => onCreateDeck('mtg', 'AI Deck', 'standard', [], true)} className="btn-ghost px-8 py-3.5 rounded-xl text-sm font-bold flex items-center gap-2">
                <Brain size={16} /> Create with AI
              </button>
            </div>
          </div>
          {/* Game quick select */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {GAMES.map(g => (
              <button key={g.id} onClick={() => onCreateDeck(g.id)} className="glass rounded-xl px-4 py-2.5 text-xs font-medium glow-border-hover flex items-center gap-2 hover:bg-white/5 transition-all">
                <span className="text-lg">{g.icon}</span> {g.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Your Saved Decks */}
      {decks.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-8">
          <h2 className="font-display text-lg font-bold glow-text mb-4 flex items-center gap-2"><BookOpen size={18} /> YOUR DECKS</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {decks.map(deck => {
              const gameInfo = GAMES.find(g => g.id === deck.game);
              const cardCount = deck.cards.reduce((s, c) => s + c.quantity, 0);
              const totalPrice = deck.cards.reduce((s, c) => s + (parseFloat(c.priceUsd || '0') * c.quantity), 0);
              return (
                <div key={deck.id} className="glass rounded-2xl overflow-hidden card-hover glow-border-hover group">
                  {/* Card preview strip */}
                  <div className="h-24 bg-white/[0.02] flex items-center justify-center gap-1 px-2 overflow-hidden">
                    {deck.cards.slice(0, 5).map((c, i) => (
                      c.imageSmall ? <img key={i} src={c.imageSmall} alt="" className="h-20 rounded-md object-cover border border-white/10" loading="lazy" /> :
                      <div key={i} className="h-20 w-14 rounded-md bg-white/5 flex items-center justify-center text-lg">{gameInfo?.icon}</div>
                    ))}
                    {deck.cards.length === 0 && <span className="text-3xl">{gameInfo?.icon}</span>}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded-full glass font-medium" style={{ color: gameInfo?.color }}>{gameInfo?.icon} {gameInfo?.name}</span>
                      <span className="text-[9px] text-[var(--text-muted)] capitalize">{deck.format}</span>
                    </div>
                    <h3 className="text-sm font-bold mb-1">{deck.name}</h3>
                    <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
                      <span>{cardCount} cards</span>
                      <span className="glow-text font-medium">${totalPrice.toFixed(2)}</span>
                      <span>{new Date(deck.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={() => onCreateDeck(deck.game, deck.name, deck.format, deck.cards)} className="flex-1 btn-accent py-2 rounded-lg text-xs font-bold">Edit</button>
                      <button onClick={() => deleteDeck(deck.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Community Decks */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-lg font-bold glow-text flex items-center gap-2"><Users size={18} /> COMMUNITY DECKS</h2>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input-dark rounded-xl px-3 py-2 text-xs cursor-pointer">
            <option value="popular">Most Popular</option><option value="newest">Newest</option><option value="likes">Most Liked</option>
          </select>
        </div>

        {/* Search */}
        <div className="flex items-center glass rounded-xl px-4 py-2.5 glow-border-hover mb-4">
          <Search size={16} className="text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search community decks by name, author, game, format..." className="bg-transparent border-none outline-none text-sm ml-3 w-full text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" />
        </div>

        {/* Game filter */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-4">
          <button onClick={() => setGameFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${gameFilter === 'all' ? 'btn-accent' : 'glass text-[var(--text-secondary)] hover:bg-white/5'}`}>All ({gameCounts.all})</button>
          {GAMES.map(g => (
            <button key={g.id} onClick={() => setGameFilter(g.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${gameFilter === g.id ? 'btn-accent' : 'glass text-[var(--text-secondary)] hover:bg-white/5'}`}>{g.icon} {g.name} {gameCounts[g.id] ? `(${gameCounts[g.id]})` : ''}</button>
          ))}
        </div>

        {/* Deck Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDecks.map(deck => {
            const gameInfo = GAMES.find(g => g.id === deck.game);
            return (
              <div key={deck.id} className="glass rounded-2xl overflow-hidden card-hover glow-border-hover group cursor-pointer" onClick={() => onCreateDeck(deck.game, deck.name, deck.format)}>
                {/* Preview images */}
                <div className="h-28 bg-white/[0.02] flex items-center justify-center gap-1 px-2 overflow-hidden relative">
                  {deck.previewCards.length > 0 ? (
                    deck.previewCards.map((img, i) => (
                      <img key={i} src={img} alt="" className="h-24 rounded-lg object-cover border border-white/10 shadow-lg" loading="lazy"
                        style={{ transform: `rotate(${(i - 1.5) * 3}deg)`, zIndex: i }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ))
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-5xl">{gameInfo?.icon}</span>
                      <div className="text-left"><p className="text-xs font-bold">{gameInfo?.name}</p><p className="text-[10px] text-[var(--text-muted)]">{deck.format}</p></div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-transparent to-transparent" />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${gameInfo?.color}20`, color: gameInfo?.color }}>{gameInfo?.icon} {gameInfo?.name}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full glass text-[var(--text-muted)]">{deck.format}</span>
                  </div>
                  <h3 className="text-sm font-bold mb-1 group-hover:text-[var(--accent)] transition-colors">{deck.name}</h3>
                  <p className="text-[10px] text-[var(--text-muted)] mb-3 line-clamp-2">{deck.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full btn-accent flex items-center justify-center text-[8px] font-bold">{deck.authorAvatar}</div>
                      <span className="text-[10px] text-[var(--text-secondary)]">{deck.author}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                      <span className="flex items-center gap-0.5"><Heart size={10} /> {deck.likes}</span>
                      <span className="flex items-center gap-0.5"><Eye size={10} /> {deck.views}</span>
                      <span>{deck.cardCount} cards</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredDecks.length === 0 && (
          <div className="text-center py-16">
            <Search size={40} className="mx-auto text-[var(--text-muted)] opacity-20 mb-3" />
            <p className="text-sm font-medium">No decks found</p>
            <p className="text-xs text-[var(--text-muted)]">Try adjusting your search or filters</p>
          </div>
        )}
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DECK EDITOR — Full Moxfield/Archidekt editor with multi-game
   ═══════════════════════════════════════════════════════════════════ */
function DeckEditorPage({ game, onBack, preloadName, preloadFormat, preloadCards, openAI }: {
  game: GameCategory; onBack: () => void;
  preloadName: string; preloadFormat: string; preloadCards: DeckCard[]; openAI?: boolean;
}) {
  const { decks, saveDeck, showToast } = useStore();
  const gameConfig = getGameConfig(game);
  const gameInfo = GAMES.find(g => g.id === game);

  const [deckId] = useState(() => `deck-${Date.now()}`);
  const [deckName, setDeckName] = useState(preloadName || 'Untitled Deck');
  const [deckFormat, setDeckFormat] = useState(preloadFormat || gameConfig.formats[0]);
  const [deckGame, setDeckGame] = useState<GameCategory>(game);
  const [cards, setCards] = useState<DeckCard[]>(preloadCards || []);
  const [activeBoard, setActiveBoard] = useState('main');
  const [viewMode, setViewMode] = useState<'categories' | 'visual' | 'table' | 'stats'>('categories');
  const [sortBy, setSortBy] = useState<'cmc' | 'name' | 'price'>('cmc');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DeckCard[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [hoveredCard, setHoveredCard] = useState<DeckCard | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [savedDecksList, setSavedDecksList] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, errors: [] as string[] });
  const [showDetailCard, setShowDetailCard] = useState<DeckCard | null>(null);
  const [showAI, setShowAI] = useState(!!openAI);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When game changes, update config
  const currentConfig = getGameConfig(deckGame);

  const loadDeck = useCallback((deck: SavedDeck) => {
    setDeckName(deck.name);
    setDeckFormat(deck.format);
    setDeckGame(deck.game);
    setCards(deck.cards);
    setSavedDecksList(false);
    showToast(`Loaded "${deck.name}"`);
  }, [showToast]);

  // Search using the correct game API
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    const results = await universalSearch(q, deckGame);
    setSearchResults(results);
    setIsSearching(false);
  }, [deckGame]);

  const handleSearch = useCallback((v: string) => {
    setSearchQuery(v);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => doSearch(v), 350);
  }, [doSearch]);

  // Import cards using the correct game API
  const handleImport = useCallback(async () => {
    if (!importText.trim()) return;
    const lines = importText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//') && !l.startsWith('#'));
    if (lines.length === 0) return;

    setImporting(true);
    const errors: string[] = [];
    setImportProgress({ done: 0, total: lines.length, errors: [] });

    let currentBoard = 'main';
    const boardHeaders: Record<string, string> = {
      'sideboard': 'sideboard', 'side deck': 'maybe', 'extra deck': 'sideboard',
      'commander': 'commander', 'maybe': 'maybe', 'maybeboard': 'maybe',
      'main': 'main', 'mainboard': 'main', 'main deck': 'main',
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check board headers
      const headerMatch = line.match(/^([^:]+)\s*:\s*$/);
      if (headerMatch) {
        const h = headerMatch[1].toLowerCase().trim();
        if (boardHeaders[h]) { currentBoard = boardHeaders[h]; }
        setImportProgress(p => ({ ...p, done: i + 1 }));
        continue;
      }

      // Parse qty
      const qtyMatch = line.match(/^(\d+)\s*x?\s+(.+)$/i);
      let qty = 1;
      let cardName = line;
      if (qtyMatch) { qty = parseInt(qtyMatch[1], 10) || 1; cardName = qtyMatch[2].trim(); }
      cardName = cardName.replace(/\s*\([^)]*\)\s*\d*\s*$/, '').trim();

      try {
        if (i > 0) await new Promise(r => setTimeout(r, 80));
        const found = await universalNameLookup(cardName, deckGame);
        if (found) {
          setCards(prev => {
            const existing = prev.find(c => c.name === found.name && c.board === currentBoard);
            if (existing) {
              return prev.map(c => c.name === found.name && c.board === currentBoard ? { ...c, quantity: c.quantity + qty } : c);
            }
            return [...prev, { ...found, quantity: qty, board: currentBoard as DeckCard['board'] }];
          });
        } else { errors.push(cardName); }
      } catch { errors.push(cardName); }

      setImportProgress({ done: i + 1, total: lines.length, errors: [...errors] });
    }

    setImporting(false);
    if (errors.length === 0) {
      showToast(`Imported ${lines.length} cards!`);
      setImportText('');
      setShowImport(false);
    } else {
      showToast(`Imported with ${errors.length} not found`);
    }
  }, [importText, showToast, deckGame]);

  // Card operations
  const addCard = useCallback((c: DeckCard) => {
    setCards(prev => {
      const ex = prev.find(d => d.name === c.name && d.board === activeBoard);
      if (ex) {
        const max = activeBoard === 'commander' ? 1 : 99;
        if (ex.quantity >= max) return prev;
        return prev.map(d => d.name === c.name && d.board === activeBoard ? { ...d, quantity: d.quantity + 1 } : d);
      }
      return [...prev, { ...c, quantity: 1, board: activeBoard as DeckCard['board'] }];
    });
  }, [activeBoard]);

  const removeOne = useCallback((id: string, board: string) => {
    setCards(prev => {
      const ex = prev.find(d => d.id === id && d.board === board);
      if (ex && ex.quantity > 1) return prev.map(d => d.id === id && d.board === board ? { ...d, quantity: d.quantity - 1 } : d);
      return prev.filter(d => !(d.id === id && d.board === board));
    });
  }, []);

  const deleteCard = useCallback((id: string, board: string) => {
    setCards(prev => prev.filter(d => !(d.id === id && d.board === board)));
  }, []);

  // Computed
  const boardCards = useMemo(() => cards.filter(c => c.board === activeBoard), [cards, activeBoard]);
  const totalMain = useMemo(() => cards.filter(c => c.board === 'main' || c.board === 'commander').reduce((s, c) => s + c.quantity, 0), [cards]);
  const totalPrice = useMemo(() => cards.reduce((s, c) => s + (parseFloat(c.priceUsd || '0') * c.quantity), 0), [cards]);

  const categorized = useMemo(() => {
    const cats: Record<string, DeckCard[]> = {};
    let order: string[];
    if (deckGame === 'yugioh') {
      order = ['Monster', 'Spell', 'Trap', 'Other'];
    } else if (deckGame === 'pokemon') {
      order = ['Pokémon', 'Trainer', 'Energy', 'Other'];
    } else if (deckGame === 'onepiece') {
      order = ['Leader', 'Character', 'Event', 'Stage', 'Other'];
    } else if (deckGame === 'starwars') {
      order = ['Unit', 'Event', 'Upgrade', 'Base', 'Other'];
    } else if (deckGame === 'gundam') {
      order = ['Mobile Suit', 'Pilot', 'Tactic', 'Other'];
    } else if (deckGame === 'lorcana') {
      order = ['Character', 'Action', 'Item', 'Other'];
    } else if (deckGame === 'sports') {
      order = ['Basketball', 'Football', 'Baseball', 'Hockey', 'Soccer', 'Other'];
    } else {
      order = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land', 'Other'];
    }
    order.forEach(c => { cats[c] = []; });
    boardCards.forEach(dc => {
      const t = dc.typeLine.toLowerCase();
      let cat = 'Other';
      for (const c of order) { if (c !== 'Other' && t.includes(c.toLowerCase())) { cat = c; break; } }
      cats[cat] = cats[cat] || [];
      cats[cat].push(dc);
    });
    Object.keys(cats).forEach(k => {
      cats[k].sort((a, b) => {
        if (sortBy === 'cmc') return a.cmc - b.cmc || a.name.localeCompare(b.name);
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'price') return parseFloat(b.priceUsd || '0') - parseFloat(a.priceUsd || '0');
        return 0;
      });
    });
    return cats;
  }, [boardCards, sortBy, deckGame]);

  const manaCurve = useMemo(() => {
    const curve: Record<number, number> = {};
    cards.filter(c => (c.board === 'main' || c.board === 'commander') && !c.typeLine.toLowerCase().includes('land'))
      .forEach(c => { const cmc = Math.min(Math.floor(c.cmc), 7); curve[cmc] = (curve[cmc] || 0) + c.quantity; });
    return curve;
  }, [cards]);

  const colorDist = useMemo(() => {
    const d: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    cards.filter(c => c.board === 'main' || c.board === 'commander').forEach(c => {
      const symbols = (c.manaCost || '').match(/\{([WUBRG])\}/gi) || [];
      symbols.forEach(s => { const k = s.replace(/[{}]/g, '').toUpperCase(); if (d[k] !== undefined) d[k] += c.quantity; });
    });
    return d;
  }, [cards]);

  const handleSave = () => {
    const deck: SavedDeck = {
      id: deckId, name: deckName, format: deckFormat, game: deckGame,
      cards, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    saveDeck(deck);
  };

  const exportDeck = () => {
    let text = `// ${deckName}\n// Game: ${gameInfo?.name}\n// Format: ${deckFormat}\n\n`;
    currentConfig.boards.forEach(board => {
      const bc = cards.filter(c => c.board === board.id);
      if (bc.length > 0) {
        text += `${board.label}:\n`;
        bc.forEach(c => { text += `${c.quantity}x ${c.name}\n`; });
        text += '\n';
      }
    });
    navigator.clipboard.writeText(text).catch(() => {});
    showToast('Deck copied to clipboard');
  };

  const catIcons: Record<string, React.ReactNode> = {
    Creature: <Sparkles size={13} />, Instant: <Zap size={13} />, Sorcery: <Star size={13} />,
    Enchantment: <Shield size={13} />, Artifact: <Package size={13} />, Planeswalker: <User size={13} />,
    Land: <Mountain size={13} />, Other: <BookOpen size={13} />,
    Monster: <Sparkles size={13} />, Spell: <Zap size={13} />, Trap: <Shield size={13} />,
    'Pokémon': <Sparkles size={13} />, Trainer: <Star size={13} />, Energy: <Zap size={13} />,
    // One Piece
    Leader: <Star size={13} />, Character: <Sparkles size={13} />, Event: <Zap size={13} />, Stage: <Mountain size={13} />,
    // Star Wars
    Unit: <Sparkles size={13} />, Upgrade: <Shield size={13} />, Base: <Mountain size={13} />,
    // Gundam
    'Mobile Suit': <Sparkles size={13} />, Pilot: <User size={13} />, Tactic: <Zap size={13} />,
    // Lorcana
    Action: <Zap size={13} />, Item: <Package size={13} />,
    // Sports
    Basketball: <Star size={13} />, Football: <Shield size={13} />, Baseball: <Sparkles size={13} />,
    Hockey: <Zap size={13} />, Soccer: <Package size={13} />,
  };

  const manaColorMap: Record<string, string> = { W: 'bg-amber-100 text-amber-900', U: 'bg-blue-400 text-blue-950', B: 'bg-gray-700 text-gray-200', R: 'bg-red-500 text-red-100', G: 'bg-green-500 text-green-100' };

  const renderMana = (cost: string | undefined, sz = 'w-3.5 h-3.5 text-[7px]') => {
    if (!cost) return null;
    const symbols = cost.match(/\{([^}]+)\}/g) || [];
    return (
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {symbols.map((s, i) => {
          const sym = s.replace(/[{}]/g, '');
          return <span key={i} className={`${sz} rounded-full flex items-center justify-center font-bold ${manaColorMap[sym.toUpperCase()] || 'bg-gray-500 text-white'}`}>{sym}</span>;
        })}
      </div>
    );
  };

  const maxCurve = Math.max(...Object.values(manaCurve), 1);
  const colorBarColors: Record<string, string> = { W: 'bg-amber-100', U: 'bg-blue-400', B: 'bg-gray-600', R: 'bg-red-500', G: 'bg-green-500' };
  const totalPips = Object.values(colorDist).reduce((a, b) => a + b, 0) || 1;

  // Get suggested searches based on game
  const suggestedSearches: Record<string, string[]> = {
    mtg: ['Lightning Bolt', 'Black Lotus', 'Sol Ring', 'Counterspell', 'Mana Crypt', 'Force of Will', 'Jace', 'Liliana'],
    yugioh: ['Blue-Eyes White Dragon', 'Dark Magician', 'Ash Blossom', 'Nibiru', 'Branded Fusion', 'Exodia', 'Kaiba', 'Effect Veiler'],
    pokemon: ['Charizard', 'Pikachu', 'Mewtwo', 'Gardevoir', 'Lugia', 'Umbreon', 'Rayquaza', 'Gengar'],
    onepiece: ['Monkey D. Luffy', 'Roronoa Zoro', 'Nami', 'Trafalgar Law', 'Kaido', 'Shanks', 'Portgas D. Ace', 'Boa Hancock', 'Gear 5'],
    starwars: ['Luke Skywalker', 'Darth Vader', 'Han Solo', 'Yoda', 'Obi-Wan Kenobi', 'Boba Fett', 'Emperor Palpatine', 'Ahsoka', 'Thrawn'],
    gundam: ['RX-78-2 Gundam', 'Zaku II', 'Char Aznable', 'Wing Gundam Zero', 'Barbatos', 'Unicorn', 'Nu Gundam', 'Strike Freedom', 'Exia'],
    lorcana: ['Elsa', 'Mickey Mouse', 'Stitch', 'Maleficent', 'Aladdin', 'Belle', 'Simba', 'Ursula', 'Rapunzel'],
    sports: ['Michael Jordan', 'LeBron James', 'Tom Brady', 'Mike Trout', 'Wayne Gretzky', 'Patrick Mahomes', 'Shohei Ohtani', 'Connor McDavid'],
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Top bar */}
      <div className="flex-shrink-0 glass-strong border-b border-white/5 px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="p-1.5 hover:bg-white/5 rounded-lg flex-shrink-0" title="Back to Deck Builder"><ChevronLeft size={18} /></button>
            {/* Game Selector */}
            <div className="flex items-center gap-1 border-r border-white/10 pr-3 flex-shrink-0">
              {GAMES.map(g => (
                <button key={g.id} onClick={() => { setDeckGame(g.id); setSearchResults([]); setSearchQuery(''); }}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all ${deckGame === g.id ? 'glow-border scale-110' : 'opacity-40 hover:opacity-80 hover:bg-white/5'}`}
                  title={g.name}>{g.icon}</button>
              ))}
            </div>
            <input value={deckName} onChange={e => setDeckName(e.target.value)}
              className="bg-transparent font-display text-base font-bold outline-none border-b border-transparent hover:border-white/10 focus:border-[var(--accent)] transition-colors min-w-0 max-w-[180px] sm:max-w-[280px] glow-text" />
            <select value={deckFormat} onChange={e => setDeckFormat(e.target.value)} className="input-dark rounded-lg px-2 py-1 text-xs cursor-pointer">
              {currentConfig.formats.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-4 text-xs text-[var(--text-secondary)] mr-3">
              <span className="flex items-center gap-1"><span className="text-sm">{gameInfo?.icon}</span> <b className="text-[var(--text-primary)]">{gameInfo?.name}</b></span>
              <span><Layers size={12} className="inline mr-1" /><b className="text-[var(--text-primary)]">{totalMain}</b> cards</span>
              <span><DollarSign size={12} className="inline mr-1" /><b className="glow-text">${totalPrice.toFixed(2)}</b></span>
            </div>
            <button onClick={() => setShowImport(true)} className="btn-ghost px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5" title="Import Cards"><Download size={13} /> Import</button>
            <button onClick={() => setShowAI(!showAI)} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${showAI ? 'btn-accent' : 'btn-ghost'}`} title="AI Assistant"><Bot size={13} /> AI</button>
            <button onClick={() => setSavedDecksList(!savedDecksList)} className="btn-ghost px-2 py-1 rounded-lg text-xs" title="Load Deck"><BookOpen size={14} /></button>
            <button onClick={handleSave} className="btn-accent px-3 py-1.5 rounded-lg text-xs font-bold">Save</button>
            <button onClick={exportDeck} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-lg"><Copy size={14} /></button>
            <button onClick={() => setCards([])} className="p-1.5 text-[var(--text-secondary)] hover:text-red-400 hover:bg-white/5 rounded-lg"><Trash2 size={14} /></button>
          </div>
        </div>
        {savedDecksList && decks.length > 0 && (
          <div className="mt-2 glass rounded-xl p-3 glow-border animate-slide-in-up max-h-48 overflow-y-auto space-y-1">
            {decks.map(d => (
              <button key={d.id} onClick={() => loadDeck(d)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-xs flex items-center justify-between">
                <span className="font-medium flex items-center gap-2"><span>{GAMES.find(g => g.id === d.game)?.icon}</span> {d.name}</span>
                <span className="text-[var(--text-muted)]">{d.cards.reduce((s, c) => s + c.quantity, 0)} cards</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImport && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => !importing && setShowImport(false)} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="glass-strong rounded-2xl w-full max-w-xl glow-border animate-slide-in-up" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <h3 className="font-display text-sm font-bold glow-text flex items-center gap-2">
                  <FileText size={16} /> IMPORT {gameInfo?.icon} {gameInfo?.name?.toUpperCase()} CARDS
                </h3>
                {!importing && <button onClick={() => setShowImport(false)} className="p-1 hover:bg-white/5 rounded-lg"><X size={18} /></button>}
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-2 block">Paste your card list:</label>
                  <div className="text-[10px] text-[var(--text-muted)] space-y-0.5 mb-3 glass rounded-lg p-3">
                    <p><code className="text-[var(--accent)]">4x Card Name</code> — quantity + name</p>
                    <p><code className="text-[var(--accent)]">Card Name</code> — defaults to qty 1</p>
                    <p><code className="text-[var(--accent)]">{currentConfig.boards[1]?.label || 'Sideboard'}:</code> — board header</p>
                  </div>
                  <textarea value={importText} onChange={e => setImportText(e.target.value)}
                    placeholder={gameConfig.importExamples}
                    className="w-full input-dark rounded-xl px-4 py-3 text-sm resize-none font-mono h-48" disabled={importing} />
                </div>
                {importing && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-secondary)] flex items-center gap-2">
                        <Loader2 size={12} className="animate-spin" style={{ color: 'var(--accent)' }} /> Importing {gameInfo?.name} cards...
                      </span>
                      <span className="font-bold">{importProgress.done}/{importProgress.total}</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                      <div className="h-full accent-gradient rounded-full transition-all duration-300" style={{ width: `${(importProgress.done / Math.max(importProgress.total, 1)) * 100}%` }} />
                    </div>
                    {importProgress.errors.length > 0 && <div className="text-[10px] text-red-400 mt-1">Not found: {importProgress.errors.join(', ')}</div>}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button onClick={handleImport} disabled={importing || !importText.trim()}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${importing || !importText.trim() ? 'bg-white/5 text-[var(--text-muted)] cursor-not-allowed' : 'btn-accent'}`}>
                    <Download size={16} /> {importing ? `Importing ${importProgress.done}/${importProgress.total}...` : 'Import Cards'}
                  </button>
                  {!importing && <button onClick={() => { setImportText(''); setImportProgress({ done: 0, total: 0, errors: [] }); }} className="px-4 py-3 rounded-xl text-sm font-medium glass hover:bg-white/5 transition-colors">Clear</button>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Search Panel */}
        {showSearch && (
          <div className="w-80 lg:w-96 flex-shrink-0 border-r border-white/5 flex flex-col glass">
            <div className="p-3 border-b border-white/5">
              <div className="flex items-center glass rounded-xl px-3 py-2 glow-border-hover">
                <Search size={14} className="text-[var(--text-muted)]" />
                <input value={searchQuery} onChange={e => handleSearch(e.target.value)}
                  placeholder={currentConfig.searchPlaceholder}
                  className="bg-transparent border-none outline-none text-xs ml-2 w-full text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" />
                {isSearching && <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: 'var(--accent)' }} />}
                {searchQuery && !isSearching && <button onClick={() => { setSearchQuery(''); setSearchResults([]); }}><X size={12} className="text-[var(--text-muted)]" /></button>}
              </div>
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {currentConfig.boards.map(b => (
                  <button key={b.id} onClick={() => setActiveBoard(b.id)}
                    className={`px-2 py-1 text-[9px] font-bold uppercase rounded-md transition-colors ${activeBoard === b.id ? 'btn-accent' : 'text-[var(--text-muted)] hover:bg-white/5'}`}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!searchQuery && searchResults.length === 0 && (
                <div className="p-6 text-center">
                  <div className="text-4xl mb-3">{gameInfo?.icon}</div>
                  <p className="text-xs font-medium text-[var(--text-secondary)]">Search {gameInfo?.name} cards</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                    {deckGame === 'mtg' ? 'Scryfall API' : deckGame === 'yugioh' ? 'YGOPRODeck API' : deckGame === 'pokemon' ? 'Pokemon TCG API' : 'Sample Data'}
                  </p>
                  <div className="mt-4 space-y-1 text-left max-w-[180px] mx-auto">
                    {(suggestedSearches[deckGame] || ['Search...']).map(s => (
                      <button key={s} onClick={() => { setSearchQuery(s); doSearch(s); }} className="block text-xs hover:underline transition-colors w-full text-left py-0.5" style={{ color: 'var(--accent)' }}>→ {s}</button>
                    ))}
                  </div>
                  <div className="mt-6 border-t border-white/5 pt-4">
                    <button onClick={() => setShowImport(true)} className="btn-ghost px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 mx-auto"><Download size={13} /> Import Card List</button>
                  </div>
                </div>
              )}
              {searchResults.map(c => (
                <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer transition-colors group border-b border-white/[0.03]"
                  onClick={() => addCard(c)}
                  onMouseEnter={e => { setHoveredCard(c); setHoverPos({ x: e.clientX, y: e.clientY }); }}
                  onMouseMove={e => setHoverPos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredCard(null)}>
                  {c.imageSmall ? <img src={c.imageSmall} alt="" className="w-7 h-10 rounded-sm object-cover flex-shrink-0 border border-white/10" loading="lazy" /> : <div className="w-7 h-10 rounded-sm bg-white/5 flex-shrink-0 flex items-center justify-center text-xs">{gameInfo?.icon}</div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-medium truncate">{c.name}</span>
                      {cards.find(d => d.name === c.name) && (
                        <span className="flex-shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent)', color: '#000' }}>
                          {cards.filter(d => d.name === c.name).reduce((s, d) => s + d.quantity, 0)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {renderMana(c.manaCost, 'w-3 h-3 text-[6px]')}
                      <span className="text-[9px] text-[var(--text-muted)] truncate">{c.typeLine}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`text-[9px] font-medium ${c.priceUsd ? 'glow-text' : 'text-[var(--text-muted)]'}`}>{c.priceUsd ? `$${c.priceUsd}` : ''}</span>
                    <button onClick={e => { e.stopPropagation(); setShowDetailCard(c); }} className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded transition-all" title="View printings"><Eye size={10} className="text-[var(--text-muted)]" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Toggle */}
        <button onClick={() => setShowSearch(!showSearch)} className="flex-shrink-0 w-5 border-r border-white/5 hover:bg-white/5 flex items-center justify-center text-[var(--text-muted)]">
          {showSearch ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Center: Deck View */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/5">
            <div className="flex items-center gap-1">
              {([
                { m: 'categories' as const, icon: <List size={13} />, label: 'Type' },
                { m: 'visual' as const, icon: <Grid size={13} />, label: 'Visual' },
                { m: 'table' as const, icon: <BarChart3 size={13} />, label: 'Table' },
                { m: 'stats' as const, icon: <TrendingUp size={13} />, label: 'Stats' },
              ]).map(v => (
                <button key={v.m} onClick={() => setViewMode(v.m)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${viewMode === v.m ? 'btn-accent' : 'text-[var(--text-secondary)] hover:bg-white/5'}`}>
                  {v.icon}<span className="hidden sm:inline">{v.label}</span>
                </button>
              ))}
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="input-dark rounded-lg px-2 py-1 text-xs cursor-pointer">
              <option value="cmc">Mana Value</option><option value="name">Name</option><option value="price">Price</option>
            </select>
          </div>

          {/* Board tabs */}
          <div className="flex-shrink-0 flex items-center gap-1 px-4 py-1.5 border-b border-white/5 bg-black/20">
            {currentConfig.boards.map(b => {
              const cnt = cards.filter(c => c.board === b.id).reduce((s, c) => s + c.quantity, 0);
              return (
                <button key={b.id} onClick={() => setActiveBoard(b.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeBoard === b.id ? 'glow-border' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                  style={activeBoard === b.id ? { color: 'var(--accent)' } : {}}>
                  {b.label} {cnt > 0 && <span className="opacity-60 ml-1">({cnt}{b.max ? `/${b.max}` : ''})</span>}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {boardCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
                <div className="text-4xl mb-3">{gameInfo?.icon}</div>
                <p className="text-sm font-medium">No cards in {currentConfig.boards.find(b => b.id === activeBoard)?.label}</p>
                <p className="text-xs mt-1">Search and click {gameInfo?.name} cards to add, or import a list</p>
                <button onClick={() => setShowImport(true)} className="btn-ghost px-4 py-2 rounded-xl text-xs font-medium mt-4 flex items-center gap-2"><Download size={13} /> Import Card List</button>
              </div>
            ) : viewMode === 'categories' ? (
              <div className="space-y-1 max-w-3xl">
                {Object.entries(categorized).map(([cat, catCards]) => {
                  if (catCards.length === 0) return null;
                  const cnt = catCards.reduce((s, c) => s + c.quantity, 0);
                  const isCollapsed = collapsed.has(cat);
                  return (
                    <div key={cat}>
                      <button onClick={() => { const n = new Set(collapsed); isCollapsed ? n.delete(cat) : n.add(cat); setCollapsed(n); }}
                        className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                        {isCollapsed ? <ChevronRight size={12} className="text-[var(--text-muted)]" /> : <ChevronDown size={12} className="text-[var(--text-muted)]" />}
                        <span style={{ color: 'var(--accent)' }}>{catIcons[cat] || <BookOpen size={13} />}</span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{cat}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">({cnt})</span>
                      </button>
                      {!isCollapsed && (
                        <div className="ml-2 border-l border-white/5 pl-2 space-y-0.5">
                          {catCards.map(dc => (
                            <div key={dc.id} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/5 transition-colors group"
                              onMouseEnter={e => { setHoveredCard(dc); setHoverPos({ x: e.clientX, y: e.clientY }); }}
                              onMouseMove={e => setHoverPos({ x: e.clientX, y: e.clientY })}
                              onMouseLeave={() => setHoveredCard(null)}>
                              <span className="text-xs font-bold w-5 text-center flex-shrink-0" style={{ color: 'var(--accent)' }}>{dc.quantity}x</span>
                              {dc.imageSmall ? <img src={dc.imageSmall} alt="" className="w-4 h-6 rounded-sm object-cover flex-shrink-0 border border-white/10" loading="lazy" /> : <div className="w-4 h-6 rounded-sm bg-white/5 flex-shrink-0" />}
                              <span className="text-[11px] truncate flex-1 cursor-pointer hover:underline" onClick={() => setShowDetailCard(dc)}>{dc.name}</span>
                              {renderMana(dc.manaCost, 'w-3 h-3 text-[6px]')}
                              {dc.priceUsd && <span className="text-[9px] text-[var(--text-muted)] flex-shrink-0">${(parseFloat(dc.priceUsd) * dc.quantity).toFixed(2)}</span>}
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <button onClick={() => removeOne(dc.id, activeBoard)} className="p-0.5 hover:bg-white/10 rounded"><Minus size={9} /></button>
                                <button onClick={() => addCard(dc)} className="p-0.5 hover:bg-white/10 rounded"><Plus size={9} /></button>
                                <button onClick={() => deleteCard(dc.id, activeBoard)} className="p-0.5 hover:bg-white/10 rounded text-red-400"><X size={9} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : viewMode === 'visual' ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                {boardCards.map(dc => (
                  <div key={dc.id} className="relative group cursor-pointer" onClick={() => setShowDetailCard(dc)}>
                    {dc.imageNormal ? (
                      <img src={dc.imageNormal} alt={dc.name} className="w-full rounded-lg border border-white/10 group-hover:border-[var(--accent)] transition-colors shadow-lg" loading="lazy" />
                    ) : (
                      <div className="w-full aspect-[5/7] rounded-lg bg-white/5 border border-white/10 flex flex-col items-center justify-center text-xs text-center px-2 gap-1">
                        <span className="text-2xl">{gameInfo?.icon}</span>
                        <span className="text-[10px]">{dc.name}</span>
                      </div>
                    )}
                    <div className="absolute top-1 left-1 rounded-md text-[9px] font-bold px-1.5 py-0.5" style={{ background: 'rgba(0,0,0,0.8)' }}>{dc.quantity}x</div>
                    {dc.priceUsd && <div className="absolute top-1 right-1 rounded-md text-[9px] font-medium px-1.5 py-0.5 glow-text" style={{ background: 'rgba(0,0,0,0.8)' }}>${dc.priceUsd}</div>}
                    <div className="absolute bottom-1 inset-x-1 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); removeOne(dc.id, activeBoard); }} className="p-1 rounded-md hover:bg-white/20" style={{ background: 'rgba(0,0,0,0.8)' }}><Minus size={11} /></button>
                      <button onClick={e => { e.stopPropagation(); addCard(dc); }} className="p-1 rounded-md hover:bg-white/20" style={{ background: 'rgba(0,0,0,0.8)' }}><Plus size={11} /></button>
                      <button onClick={e => { e.stopPropagation(); deleteCard(dc.id, activeBoard); }} className="p-1 rounded-md hover:bg-white/20 text-red-400" style={{ background: 'rgba(0,0,0,0.8)' }}><Trash2 size={11} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : viewMode === 'table' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-white/10 text-[var(--text-muted)] uppercase text-[10px] tracking-wider">
                    <th className="text-left py-2 px-2">Qty</th><th className="text-left py-2 px-2">Name</th>
                    <th className="text-left py-2 px-2 hidden sm:table-cell">Mana</th><th className="text-left py-2 px-2 hidden md:table-cell">Type</th>
                    <th className="text-right py-2 px-2">Price</th><th className="text-right py-2 px-2">Total</th><th className="w-20"></th>
                  </tr></thead>
                  <tbody>
                    {[...boardCards].sort((a, b) => sortBy === 'cmc' ? a.cmc - b.cmc : sortBy === 'name' ? a.name.localeCompare(b.name) : parseFloat(b.priceUsd || '0') - parseFloat(a.priceUsd || '0')).map(dc => {
                      const p = parseFloat(dc.priceUsd || '0');
                      return (
                        <tr key={dc.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                          <td className="py-1.5 px-2 font-bold" style={{ color: 'var(--accent)' }}>{dc.quantity}</td>
                          <td className="py-1.5 px-2 font-medium"><span className="cursor-pointer hover:underline" onClick={() => setShowDetailCard(dc)}>{dc.name}</span></td>
                          <td className="py-1.5 px-2 hidden sm:table-cell">{renderMana(dc.manaCost, 'w-3 h-3 text-[6px]')}</td>
                          <td className="py-1.5 px-2 text-[var(--text-muted)] hidden md:table-cell truncate max-w-[120px]">{dc.typeLine}</td>
                          <td className="py-1.5 px-2 text-right text-[var(--text-secondary)]">{p > 0 ? `$${p.toFixed(2)}` : '—'}</td>
                          <td className="py-1.5 px-2 text-right font-medium glow-text">{p > 0 ? `$${(p * dc.quantity).toFixed(2)}` : '—'}</td>
                          <td className="py-1.5 px-2">
                            <div className="flex items-center justify-end gap-0.5">
                              <button onClick={() => removeOne(dc.id, activeBoard)} className="p-0.5 hover:bg-white/10 rounded"><Minus size={9} /></button>
                              <button onClick={() => addCard(dc)} className="p-0.5 hover:bg-white/10 rounded"><Plus size={9} /></button>
                              <button onClick={() => deleteCard(dc.id, activeBoard)} className="p-0.5 hover:bg-white/10 rounded text-red-400"><X size={9} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr className="border-t border-white/10">
                    <td className="py-2 px-2 font-bold">{boardCards.reduce((s, c) => s + c.quantity, 0)}</td>
                    <td className="py-2 px-2 font-medium" colSpan={3}>Total</td>
                    <td></td>
                    <td className="py-2 px-2 text-right font-bold glow-text">${boardCards.reduce((s, c) => s + parseFloat(c.priceUsd || '0') * c.quantity, 0).toFixed(2)}</td>
                    <td></td>
                  </tr></tfoot>
                </table>
              </div>
            ) : (
              /* Stats View */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl">
                <div className="glass rounded-xl p-5 glow-border">
                  <h3 className="text-xs font-display font-bold glow-text mb-4 uppercase tracking-wider">Deck Overview</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Total Cards', value: totalMain.toString() },
                      { label: 'Total Price', value: `$${totalPrice.toFixed(2)}` },
                      { label: 'Avg CMC', value: (() => { const nl = cards.filter(c => (c.board === 'main' || c.board === 'commander') && !c.typeLine.toLowerCase().includes('land')); const t = nl.reduce((s, c) => s + c.cmc * c.quantity, 0); const ct = nl.reduce((s, c) => s + c.quantity, 0); return ct > 0 ? (t / ct).toFixed(2) : '0'; })() },
                      { label: 'Unique', value: cards.filter(c => c.board === 'main').length.toString() },
                    ].map(s => (
                      <div key={s.label}><p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></div>
                    ))}
                  </div>
                </div>
                {deckGame === 'mtg' && (
                  <>
                    <div className="glass rounded-xl p-5 glow-border">
                      <h3 className="text-xs font-display font-bold glow-text mb-4 uppercase tracking-wider">Mana Curve</h3>
                      <div className="flex items-end gap-2 h-28">
                        {[0, 1, 2, 3, 4, 5, 6, 7].map(cmc => {
                          const count = manaCurve[cmc] || 0;
                          const h = maxCurve > 0 ? (count / maxCurve) * 100 : 0;
                          return (
                            <div key={cmc} className="flex-1 flex flex-col items-center gap-1">
                              <span className="text-[9px] text-[var(--text-secondary)] font-medium">{count}</span>
                              <div className="w-full rounded-t-md overflow-hidden" style={{ height: '80px', background: 'rgba(255,255,255,0.03)' }}>
                                <div className="w-full accent-gradient rounded-t-md transition-all duration-500" style={{ height: `${h}%`, marginTop: `${100 - h}%` }} />
                              </div>
                              <span className="text-[9px] text-[var(--text-muted)]">{cmc === 7 ? '7+' : cmc}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="glass rounded-xl p-5 glow-border">
                      <h3 className="text-xs font-display font-bold glow-text mb-4 uppercase tracking-wider">Color Distribution</h3>
                      <div className="flex h-3 rounded-full overflow-hidden mb-4">
                        {Object.entries(colorDist).map(([c, cnt]) => cnt > 0 ? <div key={c} className={`${colorBarColors[c]} transition-all`} style={{ width: `${(cnt / totalPips) * 100}%` }} /> : null)}
                        {totalPips <= 1 && <div className="bg-white/10 w-full" />}
                      </div>
                      <div className="space-y-1.5">
                        {Object.entries(colorDist).map(([c, cnt]) => (
                          <div key={c} className="flex items-center gap-2 text-xs">
                            <span className={`w-3 h-3 rounded-full ${colorBarColors[c]}`} />
                            <span className="text-[var(--text-secondary)] flex-1">{{ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c]}</span>
                            <span className="font-medium">{cnt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <div className="glass rounded-xl p-5 glow-border">
                  <h3 className="text-xs font-display font-bold glow-text mb-4 uppercase tracking-wider">Type Breakdown</h3>
                  <div className="space-y-2">
                    {Object.entries(categorized).map(([cat, catCards]) => {
                      const cnt = catCards.reduce((s, c) => s + c.quantity, 0);
                      if (cnt === 0) return null;
                      const pct = totalMain > 0 ? (cnt / totalMain) * 100 : 0;
                      return (
                        <div key={cat} className="flex items-center gap-2">
                          <span className="flex-shrink-0" style={{ color: 'var(--accent)' }}>{catIcons[cat] || <BookOpen size={13} />}</span>
                          <span className="text-xs text-[var(--text-secondary)] w-20 flex-shrink-0">{cat}</span>
                          <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden"><div className="h-full accent-gradient rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
                          <span className="text-xs font-medium w-5 text-right">{cnt}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="glass rounded-xl p-5 glow-border">
                  <h3 className="text-xs font-display font-bold glow-text mb-3 uppercase tracking-wider">Format Validation</h3>
                  {currentConfig.boards.map(b => {
                    const cnt = cards.filter(c => c.board === b.id).reduce((s, c) => s + c.quantity, 0);
                    const valid = (!b.min || cnt >= b.min) && (!b.max || cnt <= b.max);
                    return (
                      <div key={b.id} className="flex items-center gap-2 text-xs mb-1">
                        {valid ? <Shield size={12} className="text-emerald-400" /> : <Sparkles size={12} className="text-amber-400" />}
                        <span className={valid ? 'text-emerald-400' : 'text-amber-400'}>
                          {b.label}: {cnt} cards {b.min && cnt < b.min ? `(min ${b.min})` : ''}{b.max && cnt > b.max ? `(max ${b.max})` : ''}
                          {valid ? ' ✓' : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hover preview */}
      {hoveredCard && (hoveredCard.imageLarge || hoveredCard.imageNormal) && (
        <div className="fixed z-[100] pointer-events-none animate-fade-in"
          style={{ left: Math.min(hoverPos.x + 20, window.innerWidth - 280), top: Math.max(10, Math.min(hoverPos.y - 120, window.innerHeight - 450)) }}>
          <div className="glass-strong rounded-xl overflow-hidden glow-border w-[250px] shadow-2xl">
            <img src={hoveredCard.imageLarge || hoveredCard.imageNormal} alt={hoveredCard.name} className="w-full" />
            <div className="p-2.5 space-y-1">
              <p className="text-[10px] font-bold truncate">{hoveredCard.name}</p>
              <p className="text-[8px] text-[var(--text-muted)]">{hoveredCard.setName}</p>
              {hoveredCard.priceUsd && <p className="text-[10px] font-bold glow-text">${hoveredCard.priceUsd}</p>}
            </div>
          </div>
        </div>
      )}

      {showDetailCard && <CardDetailModal card={showDetailCard} onClose={() => setShowDetailCard(null)} />}
      
      {/* AI Assistant Panel */}
      {showAI && (
        <DeckAIAssistant
          isOpen={showAI}
          onClose={() => setShowAI(false)}
          deckCards={cards}
          deckGame={deckGame}
          deckFormat={deckFormat}
          onSearchCard={(cardName: string) => {
            setSearchQuery(cardName);
            doSearch(cardName);
            setShowSearch(true);
          }}
          onAddCard={async (cardName: string) => {
            const found = await universalNameLookup(cardName, deckGame);
            if (found) {
              setCards(prev => {
                const existing = prev.find(c => c.name === found.name && c.board === activeBoard);
                if (existing) {
                  return prev.map(c => c.name === found.name && c.board === activeBoard ? { ...c, quantity: c.quantity + 1 } : c);
                }
                return [...prev, { ...found, quantity: 1, board: activeBoard as DeckCard['board'] }];
              });
              showToast(`Added ${found.name} to deck!`);
            } else {
              showToast(`Could not find "${cardName}"`);
            }
          }}
          onBuildDeck={async (items, options) => {
            if (options?.reset) setCards([]);
            for (let i = 0; i < items.length; i++) {
              const it = items[i];
              const found = await universalNameLookup(it.name, deckGame);
              if (found) {
                setCards(prev => {
                  const board = (it.board as DeckCard['board']) || activeBoard as DeckCard['board'];
                  const existing = prev.find(c => c.name === found.name && c.board === board);
                  if (existing) {
                    return prev.map(c => c.name === found.name && c.board === board ? { ...c, quantity: c.quantity + it.qty } : c);
                  }
                  return [...prev, { ...found, quantity: it.qty, board }];
                });
              }
              if (i % 5 === 0) await new Promise(r => setTimeout(r, 60));
            }
            showToast('Auto-build complete');
          }}
          accentColor={gameInfo?.color || '#00d4ff'}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COLLECTION PAGE — Streamlined with instant version selection
   ═══════════════════════════════════════════════════════════════════ */
function CollectionPage() {
  const { collections, addToCollection, removeFromCollection, wishlist, removeFromWishlist, showToast } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const totalValue = collections.reduce((s, c) => s + c.value, 0);
  const collNames = [...new Set(collections.map(c => c.collectionName))];
  if (collNames.length === 0) collNames.push('Default');

  // Streamlined Add Card State - search results show prices inline, one-click add
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DeckCard[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null);
  const [printings, setPrintings] = useState<CardPrinting[]>([]);
  const [loadingPrintings, setLoadingPrintings] = useState(false);
  const [selectedPrinting, setSelectedPrinting] = useState<CardPrinting | null>(null);
  const [selectedGame, setSelectedGame] = useState<GameCategory>('mtg');
  const [condition, setCondition] = useState('Near Mint');
  const [quantity, setQuantity] = useState(1);
  const [collectionName, setCollectionName] = useState('Default');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search cards using universal search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    const results = await universalSearch(q, selectedGame);
    setSearchResults(results.slice(0, 20));
    setIsSearching(false);
  }, [selectedGame]);

  const handleSearchChange = (v: string) => {
    setSearchQuery(v);
    setSelectedCard(null);
    setPrintings([]);
    setSelectedPrinting(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => doSearch(v), 350);
  };

  // When a card is selected, fetch all printings
  const handleSelectCard = async (card: DeckCard) => {
    setSelectedCard(card);
    setSearchResults([]);
    setSearchQuery(card.name);
    
    // For MTG, fetch all printings from Scryfall
    if (selectedGame === 'mtg') {
      setLoadingPrintings(true);
      const prints = await scryfallGetPrintings(card.name);
      setPrintings(prints);
      if (prints.length > 0) {
        setSelectedPrinting(prints[0]);
      }
      setLoadingPrintings(false);
    } else {
      // For other games, create a single "printing" from the card data
      const fakePrinting: CardPrinting = {
        id: card.id,
        name: card.name,
        setName: card.setName,
        setCode: card.setCode || '',
        collectorNumber: '',
        rarity: card.rarity,
        imageSmall: card.imageSmall,
        imageNormal: card.imageNormal,
        imageLarge: card.imageLarge,
        priceUsd: card.priceUsd,
        priceFoil: card.priceFoil,
        priceTcg: card.priceUsd,
        priceTcgFoil: card.priceFoil,
        releasedAt: '',
        artist: '',
        frame: '',
        fullArt: false,
        borderColor: '',
      };
      setPrintings([fakePrinting]);
      setSelectedPrinting(fakePrinting);
    }
  };

  // Quick add a card directly from search results (default: Near Mint, qty 1)
  const quickAddCard = (card: DeckCard) => {
    const item: CollectionItem = {
      id: `col-${Date.now()}`,
      name: card.name,
      game: selectedGame,
      set: card.setName,
      image: card.imageNormal || card.imageSmall,
      value: parseFloat(card.priceUsd || '0'),
      condition: 'Near Mint',
      dateAdded: new Date().toISOString().slice(0, 10),
      collectionName: collectionName || 'Default',
    };
    addToCollection(item);
    showToast(`Added ${card.name} to collection — $${card.priceUsd || '0'}`);
  };

  // Quick add a specific printing
  const quickAddPrinting = (p: CardPrinting) => {
    const item: CollectionItem = {
      id: `col-${Date.now()}`,
      name: p.name,
      game: selectedGame,
      set: p.setName,
      image: p.imageNormal || p.imageSmall,
      value: parseFloat(p.priceUsd || '0'),
      condition: 'Near Mint',
      dateAdded: new Date().toISOString().slice(0, 10),
      collectionName: collectionName || 'Default',
    };
    addToCollection(item);
    showToast(`Added ${p.name} (${p.setCode}) — $${p.priceUsd || '0'}`);
  };

  // Add selected printing to collection with options
  const handleAddToCollection = () => {
    if (!selectedPrinting) return;
    
    for (let i = 0; i < quantity; i++) {
      const item: CollectionItem = {
        id: `col-${Date.now()}-${i}`,
        name: selectedPrinting.name,
        game: selectedGame,
        set: selectedPrinting.setName,
        image: selectedPrinting.imageNormal || selectedPrinting.imageSmall,
        value: parseFloat(selectedPrinting.priceUsd || '0'),
        condition: condition,
        dateAdded: new Date().toISOString().slice(0, 10),
        collectionName: collectionName,
      };
      addToCollection(item);
    }
    
    showToast(`Added ${quantity}x ${selectedPrinting.name} to ${collectionName}`);
    
    // Reset
    setSearchQuery('');
    setSearchResults([]);
    setSelectedCard(null);
    setPrintings([]);
    setSelectedPrinting(null);
    setQuantity(1);
    setShowAdd(false);
  };

  // Close and reset modal
  const closeModal = () => {
    setShowAdd(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedCard(null);
    setPrintings([]);
    setSelectedPrinting(null);
    setQuantity(1);
  };

  const gameInfo = GAMES.find(g => g.id === selectedGame);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="font-display text-2xl font-bold glow-text flex items-center gap-3"><Package size={24} /> COLLECTION</h1><p className="text-sm text-[var(--text-secondary)] mt-1">Track and manage your cards</p></div>
        <button onClick={() => setShowAdd(true)} className="btn-accent px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"><Plus size={14} /> Add Card</button>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[{ icon: <Package size={16} />, value: collections.length.toString(), label: 'Cards' }, { icon: <DollarSign size={16} />, value: `$${totalValue.toLocaleString()}`, label: 'Value' }, { icon: <Star size={16} />, value: collNames.length.toString(), label: 'Collections' }].map((s, i) => (
          <div key={i} className="glass rounded-xl p-4 glow-border"><div className="flex items-center gap-2"><span style={{ color: 'var(--accent)' }}>{s.icon}</span><div><p className="text-xl font-bold">{s.value}</p><p className="text-[10px] text-[var(--text-muted)]">{s.label}</p></div></div></div>
        ))}
      </div>
      {wishlist.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display text-sm font-bold glow-text mb-3 uppercase tracking-wider flex items-center gap-2"><Heart size={14} /> WISHLIST ({wishlist.length})</h2>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {wishlist.map(w => (
              <div key={w.id} className="glass rounded-xl p-3 min-w-[140px] flex-shrink-0 glow-border-hover relative group">
                <div className="h-20 bg-white/[0.02] rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                  {w.image ? <img src={w.image} alt="" className="h-full object-contain" loading="lazy" /> : <span className="text-2xl">{GAMES.find(g => g.id === w.game)?.icon || '🃏'}</span>}
                </div>
                <p className="text-[10px] font-medium truncate">{w.name}</p>
                <p className="text-[10px] glow-text font-bold">${w.price.toLocaleString()}</p>
                <button onClick={() => removeFromWishlist(w.id)} className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded transition-all"><X size={10} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
      {collNames.map(collName => {
        const collCards = collections.filter(c => c.collectionName === collName);
        if (collCards.length === 0) return null;
        const collValue = collCards.reduce((s, c) => s + c.value, 0);
        return (
          <div key={collName} className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">{collName} ({collCards.length})</h3>
              <span className="text-xs glow-text font-bold">${collValue.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {collCards.map(card => {
                const gi = GAMES.find(g => g.id === card.game);
                return (
                  <div key={card.id} className="glass rounded-xl overflow-hidden card-hover glow-border-hover group relative">
                    <div className="h-32 bg-white/[0.02] flex items-center justify-center overflow-hidden">{card.image ? <img src={card.image} alt="" className="h-full object-contain" loading="lazy" /> : <span className="text-3xl">{gi?.icon || '🃏'}</span>}</div>
                    <div className="p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-lg">{gi?.icon}</span>
                        <span className="text-[9px] text-[var(--text-muted)] uppercase">{gi?.name}</span>
                      </div>
                      <p className="text-xs font-semibold truncate">{card.name}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">{card.set}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[9px] px-1.5 py-0.5 rounded glass">{card.condition}</span>
                        <span className="text-sm font-bold glow-text">${card.value.toFixed(2)}</span>
                      </div>
                    </div>
                    <button onClick={() => removeFromCollection(card.id)} className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all text-red-400"><Trash2 size={12} /></button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {collections.length === 0 && (<div className="text-center py-20"><Package size={40} className="mx-auto opacity-20 mb-3" style={{ color: 'var(--accent)' }} /><p className="text-lg font-bold">No cards yet</p><p className="text-sm text-[var(--text-muted)]">Search and add cards with automatic pricing</p><button onClick={() => setShowAdd(true)} className="btn-accent px-6 py-2.5 rounded-xl text-sm font-bold mt-4 flex items-center gap-2 mx-auto"><Plus size={14} /> Add Your First Card</button></div>)}
      
      {/* Streamlined Add Card Modal — Quick search, instant prices, one-click add */}
      {showAdd && (
        <>
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md animate-fade-in" onClick={closeModal} />
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-6 overflow-y-auto" onClick={closeModal}>
            <div className="glass-strong rounded-2xl w-full max-w-5xl glow-border animate-slide-in-up my-4" onClick={e => e.stopPropagation()}>
              {/* Header with game tabs */}
              <div className="flex items-center justify-between p-3 border-b border-white/5">
                <div className="flex items-center gap-4">
                  <h3 className="font-display text-sm font-bold glow-text flex items-center gap-2">
                    <Package size={14} /> ADD TO COLLECTION
                  </h3>
                  <div className="flex items-center gap-1">
                    {GAMES.map(g => (
                      <button key={g.id} onClick={() => { setSelectedGame(g.id); setSearchQuery(''); setSearchResults([]); setSelectedCard(null); setPrintings([]); }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all ${selectedGame === g.id ? 'glow-border scale-105' : 'opacity-40 hover:opacity-80 hover:bg-white/5'}`}
                        title={g.name}>{g.icon}</button>
                    ))}
                  </div>
                </div>
                <button onClick={closeModal} className="p-1.5 hover:bg-white/5 rounded-lg"><X size={18} /></button>
              </div>
              
              {/* Search bar - full width, prominent */}
              <div className="p-4 border-b border-white/5 bg-white/[0.01]">
                <div className="flex items-center glass rounded-xl px-4 py-3 glow-border-hover max-w-2xl mx-auto">
                  <Search size={18} className="text-[var(--text-muted)]" />
                  <input value={searchQuery} onChange={e => handleSearchChange(e.target.value)} autoFocus
                    placeholder={`Search ${gameInfo?.name} cards — type at least 2 characters...`}
                    className="bg-transparent border-none outline-none text-sm ml-3 w-full text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" />
                  {isSearching && <Loader2 size={16} className="animate-spin flex-shrink-0" style={{ color: 'var(--accent)' }} />}
                  {searchQuery && !isSearching && <button onClick={() => { setSearchQuery(''); setSearchResults([]); setSelectedCard(null); setPrintings([]); }} className="p-1 hover:bg-white/10 rounded"><X size={14} className="text-[var(--text-muted)]" /></button>}
                </div>
                <p className="text-[10px] text-[var(--text-muted)] text-center mt-2">
                  {selectedGame === 'mtg' ? '🔌 Scryfall API — Every printing with TCGPlayer prices' :
                   selectedGame === 'yugioh' ? '🔌 YGOPRODeck API — All Yu-Gi-Oh! cards with market prices' :
                   selectedGame === 'pokemon' ? '🔌 Pokemon TCG API — Every card with market prices' :
                   `📦 ${gameInfo?.name} card database`}
                </p>
              </div>
              
              <div className="flex min-h-[400px] max-h-[65vh]">
                {/* Left: Search results with quick-add */}
                <div className="w-1/2 border-r border-white/5 overflow-y-auto">
                  {!searchQuery && !selectedCard ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-[var(--text-muted)]">
                      <span className="text-5xl mb-4">{gameInfo?.icon}</span>
                      <p className="text-sm font-medium">Search {gameInfo?.name} Cards</p>
                      <p className="text-[10px] mt-1">Cards show prices inline • Click to see all printings</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="divide-y divide-white/[0.03]">
                      {searchResults.map(card => (
                        <div key={card.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer group ${selectedCard?.id === card.id ? 'bg-white/5' : ''}`}
                          onClick={() => handleSelectCard(card)}>
                          {card.imageSmall ? (
                            <img src={card.imageSmall} alt="" className="w-10 h-14 rounded object-cover border border-white/10 flex-shrink-0" loading="lazy" />
                          ) : (
                            <div className="w-10 h-14 rounded bg-white/5 flex items-center justify-center text-xl flex-shrink-0">{gameInfo?.icon}</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{card.name}</p>
                            <p className="text-[10px] text-[var(--text-muted)] truncate">{card.setName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                card.rarity === 'mythic' || card.rarity === 'Ultra Rare' ? 'bg-orange-500/20 text-orange-400' :
                                card.rarity === 'rare' || card.rarity === 'Rare' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-white/10 text-[var(--text-muted)]'
                              }`}>{card.rarity}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <p className={`text-sm font-bold ${card.priceUsd ? 'glow-text' : 'text-[var(--text-muted)]'}`}>
                                {card.priceUsd ? `$${card.priceUsd}` : '—'}
                              </p>
                              <p className="text-[9px] text-[var(--text-muted)]">TCGPlayer</p>
                            </div>
                            {/* Quick add button */}
                            <button onClick={(e) => { e.stopPropagation(); quickAddCard(card); }}
                              className="btn-accent p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Quick add (Near Mint, 1x)">
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : searchQuery.length >= 2 && !isSearching ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-[var(--text-muted)]">
                      <Search size={32} className="mb-3 opacity-20" />
                      <p className="text-sm">No cards found for "{searchQuery}"</p>
                    </div>
                  ) : searchQuery.length > 0 && searchQuery.length < 2 ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-[var(--text-muted)]">
                      <Loader2 size={24} className="mb-3 opacity-30" />
                      <p className="text-xs">Type at least 2 characters...</p>
                    </div>
                  ) : null}
                </div>
                
                {/* Right: Selected card printings */}
                <div className="w-1/2 overflow-y-auto bg-black/20">
                  {loadingPrintings ? (
                    <div className="flex flex-col items-center justify-center h-full py-12">
                      <Loader2 size={28} className="animate-spin mb-3" style={{ color: 'var(--accent)' }} />
                      <p className="text-sm text-[var(--text-secondary)]">Loading all printings...</p>
                    </div>
                  ) : selectedCard && printings.length > 0 ? (
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                          {selectedCard.name} — {printings.length} Printing{printings.length > 1 ? 's' : ''}
                        </h4>
                        <button onClick={() => { setSelectedCard(null); setPrintings([]); setSelectedPrinting(null); }} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)]">← Back to search</button>
                      </div>
                      
                      <div className="space-y-2">
                        {printings.map(p => (
                          <div key={p.id} className={`glass rounded-xl p-3 transition-all cursor-pointer group ${selectedPrinting?.id === p.id ? 'glow-border' : 'hover:bg-white/5'}`}
                            onClick={() => setSelectedPrinting(p)}>
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 bg-white/5">
                                {p.imageSmall ? <img src={p.imageSmall} alt="" className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center">{gameInfo?.icon}</div>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold">{p.setName}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-[9px] text-[var(--text-muted)]">{p.setCode} {p.collectorNumber ? `#${p.collectorNumber}` : ''}</span>
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full capitalize ${
                                    p.rarity === 'mythic' ? 'bg-orange-500/20 text-orange-400' :
                                    p.rarity === 'rare' ? 'bg-amber-500/20 text-amber-400' :
                                    p.rarity === 'uncommon' ? 'bg-gray-400/20 text-gray-300' :
                                    'bg-white/10 text-[var(--text-muted)]'
                                  }`}>{p.rarity}</span>
                                  {p.fullArt && <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full">Full Art</span>}
                                </div>
                                {p.artist && <p className="text-[9px] text-[var(--text-muted)] mt-0.5">Artist: {p.artist}</p>}
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="text-right">
                                  <p className={`text-sm font-bold ${p.priceUsd ? 'glow-text' : 'text-[var(--text-muted)]'}`}>{p.priceUsd ? `$${p.priceUsd}` : '—'}</p>
                                  {p.priceFoil && <p className="text-[10px] text-amber-400">Foil: ${p.priceFoil}</p>}
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); quickAddPrinting(p); }}
                                  className="btn-accent p-2 rounded-lg opacity-60 group-hover:opacity-100 transition-opacity"
                                  title="Quick add this printing">
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Selected printing options */}
                      {selectedPrinting && (
                        <div className="mt-4 glass rounded-xl p-4 glow-border">
                          <div className="flex items-center gap-4 mb-4">
                            {selectedPrinting.imageNormal && (
                              <img src={selectedPrinting.imageLarge || selectedPrinting.imageNormal} alt="" className="w-20 rounded-lg border border-white/10" />
                            )}
                            <div>
                              <p className="text-sm font-bold">{selectedPrinting.name}</p>
                              <p className="text-[10px] text-[var(--text-muted)]">{selectedPrinting.setName} ({selectedPrinting.setCode})</p>
                              <p className="text-lg font-bold glow-text mt-1">${selectedPrinting.priceUsd || '0.00'}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            <div>
                              <label className="text-[8px] text-[var(--text-muted)] uppercase mb-1 block">Qty</label>
                              <div className="flex items-center glass rounded-lg">
                                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-2 py-1.5 hover:bg-white/5"><Minus size={10} /></button>
                                <span className="flex-1 text-center text-xs font-bold">{quantity}</span>
                                <button onClick={() => setQuantity(quantity + 1)} className="px-2 py-1.5 hover:bg-white/5"><Plus size={10} /></button>
                              </div>
                            </div>
                            <div>
                              <label className="text-[8px] text-[var(--text-muted)] uppercase mb-1 block">Condition</label>
                              <select value={condition} onChange={e => setCondition(e.target.value)} className="w-full input-dark rounded-lg px-2 py-1.5 text-[10px]">
                                {['Mint', 'Near Mint', 'Excellent', 'Good', 'Fair', 'Poor'].map(c => <option key={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[8px] text-[var(--text-muted)] uppercase mb-1 block">Collection</label>
                              <input value={collectionName} onChange={e => setCollectionName(e.target.value)} className="w-full input-dark rounded-lg px-2 py-1.5 text-[10px]" placeholder="Default" />
                            </div>
                          </div>
                          <button onClick={handleAddToCollection} className="w-full btn-accent py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                            <Plus size={14} /> Add {quantity}× {selectedPrinting.name} — ${(parseFloat(selectedPrinting.priceUsd || '0') * quantity).toFixed(2)}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-[var(--text-muted)]">
                      <Layers size={36} className="mb-3 opacity-20" />
                      <p className="text-sm font-medium">Select a card to see printings</p>
                      <p className="text-[10px] mt-1">Click any search result →</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SELL PAGE
   ═══════════════════════════════════════════════════════════════════ */
function SellPage() {
  const [submitted, setSubmitted] = useState(false);
  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="glass rounded-2xl p-12 glow-border">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--accent-glow)' }}><Shield size={32} style={{ color: 'var(--accent)' }} /></div>
          <h2 className="font-display text-xl font-bold glow-text mb-2">LISTING CREATED</h2>
          <p className="text-[var(--text-secondary)] text-sm mb-6">Your card is now live on KardFlow</p>
          <button onClick={() => setSubmitted(false)} className="btn-accent px-6 py-3 rounded-xl text-sm font-bold">List Another Card</button>
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold glow-text mb-2">SELL YOUR CARDS</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-8">List cards on KardFlow</p>
      <div className="glass rounded-2xl glow-border overflow-hidden">
        <div className="p-6 space-y-5">
          <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block uppercase tracking-wider">Card Photos</label><div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-[var(--accent)]/30 transition-colors cursor-pointer"><Upload size={28} className="mx-auto text-[var(--text-muted)] mb-2" /><p className="text-xs text-[var(--text-secondary)]">Drag & drop or click to upload</p></div></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">Card Name *</label><input className="w-full input-dark rounded-xl px-4 py-2.5 text-sm" placeholder="e.g. Charizard VMAX" /></div>
            <div><label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">Set *</label><input className="w-full input-dark rounded-xl px-4 py-2.5 text-sm" placeholder="e.g. Shining Fates" /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">Game *</label><select className="w-full input-dark rounded-xl px-3 py-2.5 text-sm cursor-pointer">{GAMES.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}</select></div>
            <div><label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">Condition *</label><select className="w-full input-dark rounded-xl px-3 py-2.5 text-sm cursor-pointer">{['Mint', 'Near Mint', 'Excellent', 'Good', 'Fair'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">Price *</label><input type="number" className="w-full input-dark rounded-xl px-4 py-2.5 text-sm" placeholder="$0.00" /></div>
          </div>
          <div><label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">Description</label><textarea rows={3} className="w-full input-dark rounded-xl px-4 py-2.5 text-sm resize-none" placeholder="Describe condition..." /></div>
          <div className="flex items-start gap-3 glass rounded-xl p-4 glow-border"><Shield size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} /><div className="text-xs"><p className="font-medium" style={{ color: 'var(--accent)' }}>Seller Protection</p><p className="text-[var(--text-muted)] mt-0.5">5% fee on sales. All transactions protected.</p></div></div>
        </div>
        <div className="p-6 border-t border-white/5"><button onClick={() => setSubmitted(true)} className="w-full btn-accent py-3.5 rounded-xl text-sm font-bold">Create Listing</button></div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PROFILE PAGE
   ═══════════════════════════════════════════════════════════════════ */
function ProfilePage() {
  const { user, isLoggedIn, collections, decks, setAuthModal, logout } = useStore();
  if (!isLoggedIn || !user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <User size={48} className="mx-auto mb-4 opacity-20" style={{ color: 'var(--accent)' }} />
        <h2 className="font-display text-xl font-bold glow-text mb-2">SIGN IN</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">Create an account to track your collection and more</p>
        <button onClick={() => setAuthModal('login')} className="btn-accent px-8 py-3 rounded-xl text-sm font-bold">Sign In / Sign Up</button>
      </div>
    );
  }
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="glass rounded-2xl p-8 glow-border mb-8 text-center">
        <div className="w-20 h-20 rounded-full btn-accent mx-auto flex items-center justify-center text-2xl font-bold mb-4">{user.avatar}</div>
        <h1 className="font-display text-2xl font-bold glow-text">{user.username}</h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">Joined {user.joinDate}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[{ label: 'Collection Value', value: `$${collections.reduce((s, c) => s + c.value, 0).toLocaleString()}` }, { label: 'Cards Owned', value: collections.length.toString() }, { label: 'Saved Decks', value: decks.length.toString() }, { label: 'Total Trades', value: '0' }].map((s, i) => (
          <div key={i} className="glass rounded-xl p-4 glow-border text-center"><p className="text-lg font-bold">{s.value}</p><p className="text-[10px] text-[var(--text-muted)]">{s.label}</p></div>
        ))}
      </div>
      <div className="text-center"><button onClick={logout} className="btn-ghost px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 mx-auto"><LogOut size={14} /> Sign Out</button></div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════════════════ */
function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] glass-strong glow-border rounded-xl px-5 py-3 text-sm font-medium animate-slide-in-up flex items-center gap-2 shadow-2xl">
      <span style={{ color: 'var(--accent)' }}>✓</span>{toast}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DEPLOY PAGE
   ═══════════════════════════════════════════════════════════════════ */
function DeployPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="glass rounded-2xl p-6 glow-border mb-6">
        <h1 className="font-display text-2xl font-bold glow-text mb-2">Deploy KardFlow</h1>
        <p className="text-sm text-[var(--text-secondary)]">Host this site in minutes on Netlify, Vercel, or GitHub Pages.</p>
      </div>

      <div className="space-y-6">
        <section className="glass rounded-2xl p-5 glow-border">
          <h2 className="font-display text-sm font-bold glow-text mb-3 uppercase tracking-wider">Build</h2>
          <ol className="list-decimal pl-5 text-sm space-y-1 text-[var(--text-secondary)]">
            <li>Install Node.js 18+ and pnpm or npm</li>
            <li>Install deps: <code className="glow-text">npm install</code></li>
            <li>Build: <code className="glow-text">npm run build</code></li>
            <li>Preview locally: <code className="glow-text">npm run preview</code></li>
          </ol>
        </section>

        <section className="glass rounded-2xl p-5 glow-border">
          <h2 className="font-display text-sm font-bold glow-text mb-3 uppercase tracking-wider">Netlify (Fastest)</h2>
          <ol className="list-decimal pl-5 text-sm space-y-1 text-[var(--text-secondary)]">
            <li>Create a Netlify account</li>
            <li>New site from Git → connect your GitHub repo</li>
            <li>Build command: <code className="glow-text">npm run build</code></li>
            <li>Publish directory: <code className="glow-text">dist</code></li>
            <li>Deploy → set a custom domain in Site settings (optional)</li>
          </ol>
        </section>

        <section className="glass rounded-2xl p-5 glow-border">
          <h2 className="font-display text-sm font-bold glow-text mb-3 uppercase tracking-wider">Vercel</h2>
          <ol className="list-decimal pl-5 text-sm space-y-1 text-[var(--text-secondary)]">
            <li>Install Vercel CLI: <code className="glow-text">npm i -g vercel</code></li>
            <li>Run <code className="glow-text">vercel</code> and follow prompts</li>
            <li>Framework preset: <code className="glow-text">Vite</code></li>
            <li>Build command: <code className="glow-text">npm run build</code></li>
            <li>Output dir: <code className="glow-text">dist</code></li>
          </ol>
        </section>

        <section className="glass rounded-2xl p-5 glow-border">
          <h2 className="font-display text-sm font-bold glow-text mb-3 uppercase tracking-wider">GitHub Pages</h2>
          <ol className="list-decimal pl-5 text-sm space-y-1 text-[var(--text-secondary)]">
            <li>Push this project to a GitHub repo</li>
            <li>Enable Pages: Settings → Pages → Deploy from GitHub Actions</li>
            <li>Create a workflow that runs <code className="glow-text">npm ci && npm run build</code> then uploads <code className="glow-text">dist</code></li>
          </ol>
        </section>

        <section className="glass rounded-2xl p-5 glow-border">
          <h2 className="font-display text-sm font-bold glow-text mb-3 uppercase tracking-wider">Environment & CORS</h2>
          <ul className="list-disc pl-5 text-sm space-y-1 text-[var(--text-secondary)]">
            <li>APIs used are public (Scryfall, YGOPRODeck, PokemonTCG). No keys required.</li>
            <li>If a host blocks CORS, proxy via your platform (Vercel/Netlify functions) or backend.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════════ */
export function App() {
  const { activePage } = useStore();
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Navbar />
      <main>
        {activePage === 'home' && <HomePage />}
        {activePage === 'marketplace' && <MarketplacePage />}
        {activePage === 'deckbuilder' && <DeckBuilderPage />}
        {activePage === 'collection' && <CollectionPage />}
        {activePage === 'sell' && <SellPage />}
        {activePage === 'profile' && <ProfilePage />}
        {activePage === 'deploy' && <DeployPage />}
      </main>
      <CartSidebar />
      <SettingsPanel />
      <AuthModal />
      <Toast />
    </div>
  );
}
