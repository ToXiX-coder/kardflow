import type { DeckCard } from '../types';

export interface DeckStats {
  totalCards: number;
  avgCMC: number;
  manaCurve: Record<number, number>;
  colorDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
  totalValue: number;
  avgCardValue: number;
  powerScore: number;
  suggestions: string[];
  deckType: 'aggro' | 'midrange' | 'control' | 'combo' | 'unknown';
}

/**
 * Analyzes a deck and returns comprehensive statistics
 */
export function analyzeDeck(cards: DeckCard[]): DeckStats {
  const mainboard = cards.filter(c => c.board === 'main');
  const totalCards = mainboard.reduce((sum, c) => sum + c.quantity, 0);
  
  if (totalCards === 0) {
    return getEmptyStats();
  }
  
  let cmcSum = 0;
  const manaCurve: Record<number, number> = {};
  const colorDist: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const typeDist: Record<string, number> = {
    Creature: 0,
    Instant: 0,
    Sorcery: 0,
    Enchantment: 0,
    Artifact: 0,
    Planeswalker: 0,
    Land: 0,
  };
  let totalValue = 0;
  
  // Calculate distributions
  mainboard.forEach(card => {
    const qty = card.quantity;
    
    // CMC and mana curve
    cmcSum += card.cmc * qty;
    const cmc = Math.min(card.cmc, 7); // Cap at 7 for curve
    manaCurve[cmc] = (manaCurve[cmc] || 0) + qty;
    
    // Color distribution
    if (card.colors.length === 0) {
      colorDist.C += qty;
    } else {
      card.colors.forEach(c => {
        colorDist[c] = (colorDist[c] || 0) + qty;
      });
    }
    
    // Type distribution
    const type = card.typeLine.split(/[—\-]/)[0].trim().toLowerCase();
    if (type.includes('creature')) typeDist.Creature += qty;
    else if (type.includes('instant')) typeDist.Instant += qty;
    else if (type.includes('sorcery')) typeDist.Sorcery += qty;
    else if (type.includes('enchantment')) typeDist.Enchantment += qty;
    else if (type.includes('artifact')) typeDist.Artifact += qty;
    else if (type.includes('planeswalker')) typeDist.Planeswalker += qty;
    else if (type.includes('land')) typeDist.Land += qty;
    
    // Value calculation
    const price = parseFloat(card.priceUsd || '0');
    totalValue += price * qty;
  });
  
  const avgCMC = cmcSum / totalCards;
  const avgCardValue = totalValue / totalCards;
  
  // Determine deck type
  const deckType = determineDeckType(avgCMC, typeDist, totalCards);
  
  // Calculate power score (0-100)
  const powerScore = calculatePowerScore(avgCMC, typeDist, totalCards, avgCardValue, deckType);
  
  // Generate suggestions
  const suggestions = generateSuggestions(totalCards, avgCMC, typeDist, deckType);
  
  return {
    totalCards,
    avgCMC: Math.round(avgCMC * 100) / 100,
    manaCurve,
    colorDistribution: colorDist,
    typeDistribution: typeDist,
    totalValue: Math.round(totalValue * 100) / 100,
    avgCardValue: Math.round(avgCardValue * 100) / 100,
    powerScore,
    suggestions,
    deckType,
  };
}

function getEmptyStats(): DeckStats {
  return {
    totalCards: 0,
    avgCMC: 0,
    manaCurve: {},
    colorDistribution: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    typeDistribution: {
      Creature: 0,
      Instant: 0,
      Sorcery: 0,
      Enchantment: 0,
      Artifact: 0,
      Planeswalker: 0,
      Land: 0,
    },
    totalValue: 0,
    avgCardValue: 0,
    powerScore: 0,
    suggestions: ['Add cards to your deck to see analytics'],
    deckType: 'unknown',
  };
}

function determineDeckType(
  avgCMC: number,
  typeDist: Record<string, number>,
  totalCards: number
): 'aggro' | 'midrange' | 'control' | 'combo' | 'unknown' {
  const creaturePercent = typeDist.Creature / totalCards;
  const spellPercent = (typeDist.Instant + typeDist.Sorcery) / totalCards;
  
  if (avgCMC < 2.5 && creaturePercent > 0.45) return 'aggro';
  if (avgCMC > 3.5 && spellPercent > 0.35) return 'control';
  if (spellPercent > 0.45 && avgCMC < 3) return 'combo';
  if (avgCMC >= 2.5 && avgCMC <= 3.5) return 'midrange';
  
  return 'unknown';
}

function calculatePowerScore(
  avgCMC: number,
  typeDist: Record<string, number>,
  totalCards: number,
  avgCardValue: number,
  deckType: string
): number {
  let score = 50; // Base score
  
  // CMC score (depends on deck type)
  if (deckType === 'aggro') {
    if (avgCMC >= 1.5 && avgCMC <= 2.5) score += 15;
    else if (avgCMC > 3) score -= 10;
  } else if (deckType === 'control') {
    if (avgCMC >= 3 && avgCMC <= 4.5) score += 15;
  } else {
    if (avgCMC >= 2.5 && avgCMC <= 3.5) score += 10;
  }
  
  // Creature count score
  const creatureCount = typeDist.Creature;
  if (deckType === 'aggro' && creatureCount >= 24 && creatureCount <= 32) score += 10;
  else if (deckType === 'control' && creatureCount <= 12) score += 10;
  else if (creatureCount >= 18 && creatureCount <= 28) score += 5;
  
  // Land count score
  const landCount = typeDist.Land;
  if (totalCards === 60) {
    if (landCount >= 22 && landCount <= 26) score += 10;
    else if (landCount < 20 || landCount > 28) score -= 10;
  } else if (totalCards === 100) {
    if (landCount >= 35 && landCount <= 40) score += 10;
  }
  
  // Value score (higher value often means better cards)
  if (avgCardValue > 3) score += Math.min(15, avgCardValue * 2);
  
  // Deck size score
  if (totalCards === 60) score += 5;
  else if (totalCards === 100) score += 5;
  else if (totalCards < 60) score -= 15;
  else if (totalCards > 60 && totalCards !== 100) score -= 5;
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

function generateSuggestions(
  totalCards: number,
  avgCMC: number,
  typeDist: Record<string, number>,
  deckType: string
): string[] {
  const suggestions: string[] = [];
  
  // Deck size suggestions
  if (totalCards < 60) {
    suggestions.push(`Add ${60 - totalCards} more cards to reach the 60-card minimum for constructed formats`);
  } else if (totalCards > 60 && totalCards < 100) {
    suggestions.push('Consider trimming to exactly 60 cards for better consistency');
  } else if (totalCards > 100) {
    suggestions.push('Deck exceeds Commander format limit of 100 cards');
  }
  
  // Land count suggestions
  const landCount = typeDist.Land;
  if (totalCards === 60) {
    if (landCount < 20) {
      suggestions.push(`Add ${20 - landCount} more lands (target: 23-24 for most decks)`);
    } else if (landCount < 22) {
      suggestions.push('Consider adding 1-2 more lands for consistency');
    } else if (landCount > 26) {
      suggestions.push('You may have too many lands - consider cutting some for more spells');
    }
  } else if (totalCards === 100) {
    if (landCount < 35) {
      suggestions.push(`Add ${35 - landCount} more lands (target: 36-38 for Commander)`);
    } else if (landCount > 40) {
      suggestions.push('High land count - consider replacing some with mana rocks or ramp spells');
    }
  }
  
  // CMC suggestions
  if (avgCMC > 4) {
    suggestions.push('High average CMC - add ramp spells or cheaper cards to improve consistency');
  } else if (avgCMC < 2 && deckType !== 'aggro') {
    suggestions.push('Very low curve - make sure you have enough impactful cards for longer games');
  }
  
  // Mana curve suggestions
  if (deckType === 'aggro' && avgCMC > 3) {
    suggestions.push('For aggro, aim for average CMC between 1.5-2.5 to maximize speed');
  } else if (deckType === 'control' && avgCMC < 3) {
    suggestions.push('Control decks typically want more expensive, powerful spells');
  }
  
  // Creature suggestions
  const creatureCount = typeDist.Creature;
  if (deckType === 'aggro' && creatureCount < 20) {
    suggestions.push('Aggro decks typically run 24-32 creatures for consistent pressure');
  } else if (deckType === 'control' && creatureCount > 15) {
    suggestions.push('Control decks usually run fewer creatures (8-12) and more removal/card draw');
  }
  
  // General balance suggestions
  const spellCount = typeDist.Instant + typeDist.Sorcery;
  if (spellCount < 8 && deckType !== 'aggro') {
    suggestions.push('Consider adding more instants/sorceries for interaction and card advantage');
  }
  
  return suggestions;
}

/**
 * Simulates drawing an opening hand from the deck
 */
export function drawHand(cards: DeckCard[], handSize = 7): DeckCard[] {
  const deck = cards
    .filter(c => c.board === 'main')
    .flatMap(c => Array(c.quantity).fill(c));
  
  if (deck.length < handSize) {
    return deck;
  }
  
  // Fisher-Yates shuffle
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled.slice(0, handSize);
}

/**
 * Calculates the hypergeometric probability of drawing X copies in Y cards
 * Useful for: "What's the probability I draw at least 1 Sol Ring in my opening hand?"
 */
export function calculateDrawProbability(
  deckSize: number,
  copiesInDeck: number,
  cardsToDraw: number,
  copiesNeeded: number
): number {
  if (copiesNeeded > copiesInDeck || copiesNeeded > cardsToDraw) {
    return 0;
  }
  
  // Calculate using hypergeometric distribution
  // P(X >= k) = 1 - P(X < k)
  let probability = 0;
  
  for (let i = copiesNeeded; i <= Math.min(copiesInDeck, cardsToDraw); i++) {
    const numerator = combination(copiesInDeck, i) * combination(deckSize - copiesInDeck, cardsToDraw - i);
    const denominator = combination(deckSize, cardsToDraw);
    probability += numerator / denominator;
  }
  
  return Math.round(probability * 10000) / 100; // Return as percentage with 2 decimals
}

function combination(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result *= (n - i + 1) / i;
  }
  
  return result;
}
