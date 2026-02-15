import type { CollectionItem, GameCategory } from '../types';

export interface CollectionStats {
  totalCards: number;
  totalValue: number;
  avgValue: number;
  byGame: Record<GameCategory, { count: number; value: number }>;
  byCondition: Record<string, { count: number; value: number }>;
  topCards: CollectionItem[];
  recentlyAdded: CollectionItem[];
  valueGrowth: number; // Percentage change (mock for now)
  totalSets: number;
  mostValuableSet: string;
}

/**
 * Analyzes a collection and returns comprehensive statistics
 */
export function analyzeCollection(items: CollectionItem[]): CollectionStats {
  if (items.length === 0) {
    return getEmptyStats();
  }
  
  const totalCards = items.length;
  const totalValue = items.reduce((sum, item) => sum + item.value, 0);
  const avgValue = totalValue / totalCards;
  
  // Group by game
  const byGame: Record<string, { count: number; value: number }> = {};
  items.forEach(item => {
    if (!byGame[item.game]) {
      byGame[item.game] = { count: 0, value: 0 };
    }
    byGame[item.game].count++;
    byGame[item.game].value += item.value;
  });
  
  // Group by condition
  const byCondition: Record<string, { count: number; value: number }> = {};
  items.forEach(item => {
    const condition = item.condition || 'Unknown';
    if (!byCondition[condition]) {
      byCondition[condition] = { count: 0, value: 0 };
    }
    byCondition[condition].count++;
    byCondition[condition].value += item.value;
  });
  
  // Top 5 most valuable cards
  const topCards = [...items]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  
  // Recently added cards
  const recentlyAdded = [...items]
    .sort((a, b) => {
      const dateA = new Date(b.dateAdded).getTime();
      const dateB = new Date(a.dateAdded).getTime();
      return dateA - dateB;
    })
    .slice(0, 5);
  
  // Calculate unique sets
  const uniqueSets = new Set(items.map(item => item.set));
  const totalSets = uniqueSets.size;
  
  // Find most valuable set
  const setValues: Record<string, number> = {};
  items.forEach(item => {
    setValues[item.set] = (setValues[item.set] || 0) + item.value;
  });
  const mostValuableSet = Object.entries(setValues)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';
  
  // Mock value growth (in production, compare with historical data)
  const valueGrowth = calculateMockValueGrowth(items);
  
  return {
    totalCards,
    totalValue: Math.round(totalValue * 100) / 100,
    avgValue: Math.round(avgValue * 100) / 100,
    byGame: byGame as Record<GameCategory, { count: number; value: number }>,
    byCondition,
    topCards,
    recentlyAdded,
    valueGrowth,
    totalSets,
    mostValuableSet,
  };
}

function getEmptyStats(): CollectionStats {
  return {
    totalCards: 0,
    totalValue: 0,
    avgValue: 0,
    byGame: {} as Record<GameCategory, { count: number; value: number }>,
    byCondition: {},
    topCards: [],
    recentlyAdded: [],
    valueGrowth: 0,
    totalSets: 0,
    mostValuableSet: 'None',
  };
}

/**
 * Calculates mock value growth based on card types and dates
 * In production, this would compare against historical price data
 */
function calculateMockValueGrowth(items: CollectionItem[]): number {
  // Simulate growth based on card characteristics
  let growthScore = 0;
  
  items.forEach(item => {
    // Newer cards tend to be more volatile
    const daysSinceAdded = Math.floor(
      (Date.now() - new Date(item.dateAdded).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Higher value cards contribute more to growth
    const valueWeight = Math.min(item.value / 100, 1);
    
    // Near Mint cards hold value better
    const conditionMultiplier = item.condition === 'NM' ? 1.2 : item.condition === 'LP' ? 1.0 : 0.8;
    
    growthScore += valueWeight * conditionMultiplier * (daysSinceAdded < 30 ? 1.5 : 1.0);
  });
  
  // Normalize to percentage (-20% to +20%)
  const normalizedGrowth = (growthScore / items.length) * 10 - 5;
  return Math.round(Math.max(-20, Math.min(20, normalizedGrowth)) * 100) / 100;
}

/**
 * Finds hidden gems (cards that are spiking in value)
 * In production, this would check real-time price data
 */
export function findHiddenGems(items: CollectionItem[]): CollectionItem[] {
  // Mock implementation - in production, compare current prices with historical data
  return items
    .filter(item => {
      // Look for cards with certain characteristics that might spike
      const isRare = item.set.includes('Alpha') || item.set.includes('Beta') || item.value > 50;
      const isNM = item.condition === 'NM';
      const recentlyAdded = new Date(item.dateAdded) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      
      return isRare && isNM && !recentlyAdded;
    })
    .slice(0, 10);
}

/**
 * Calculates portfolio diversity score (0-100)
 * Higher score means more diversified across games and sets
 */
export function calculateDiversityScore(items: CollectionItem[]): number {
  if (items.length === 0) return 0;
  
  const uniqueGames = new Set(items.map(item => item.game)).size;
  const uniqueSets = new Set(items.map(item => item.set)).size;
  const uniqueCollections = new Set(items.map(item => item.collectionName)).size;
  
  // Calculate distribution evenness
  const gameDistribution: Record<string, number> = {};
  items.forEach(item => {
    gameDistribution[item.game] = (gameDistribution[item.game] || 0) + 1;
  });
  
  const maxConcentration = Math.max(...Object.values(gameDistribution)) / items.length;
  const evenness = 1 - maxConcentration;
  
  // Score based on variety and evenness
  const varietyScore = Math.min((uniqueGames / 8) * 40, 40); // Max 40 points for game variety
  const setScore = Math.min((uniqueSets / 20) * 30, 30); // Max 30 points for set variety
  const evennessScore = evenness * 30; // Max 30 points for even distribution
  
  return Math.round(varietyScore + setScore + evennessScore);
}

/**
 * Generates collection insights and recommendations
 */
export function generateCollectionInsights(items: CollectionItem[]): string[] {
  const insights: string[] = [];
  const stats = analyzeCollection(items);
  
  if (items.length === 0) {
    insights.push('Start building your collection by adding cards from the marketplace or deck builder');
    return insights;
  }
  
  // Value insights
  if (stats.totalValue > 1000) {
    insights.push(`Your collection is worth $${stats.totalValue.toFixed(2)} - consider insurance for high-value cards`);
  }
  
  if (stats.valueGrowth > 5) {
    insights.push(`Your collection grew ${stats.valueGrowth}% this month - great investments!`);
  } else if (stats.valueGrowth < -5) {
    insights.push(`Collection value down ${Math.abs(stats.valueGrowth)}% - consider diversifying into Reserved List cards`);
  }
  
  // Diversity insights
  const diversity = calculateDiversityScore(items);
  if (diversity < 30) {
    insights.push('Your collection is highly concentrated - consider diversifying across more games and sets');
  } else if (diversity > 70) {
    insights.push('Excellent portfolio diversification across games and sets!');
  }
  
  // Game-specific insights
  const topGame = Object.entries(stats.byGame)
    .sort((a, b) => b[1].value - a[1].value)[0];
  
  if (topGame) {
    const [game, data] = topGame;
    const percentage = (data.value / stats.totalValue) * 100;
    if (percentage > 60) {
      insights.push(`${percentage.toFixed(0)}% of your value is in ${game} - consider diversifying`);
    }
  }
  
  // Condition insights
  const nmPercentage = (stats.byCondition['NM']?.count || 0) / stats.totalCards * 100;
  if (nmPercentage < 50) {
    insights.push('Less than half your cards are Near Mint - NM cards hold value better long-term');
  } else if (nmPercentage > 80) {
    insights.push('Excellent card condition! NM cards command premium prices');
  }
  
  // Set completion opportunities
  if (stats.totalSets > 10) {
    insights.push(`You collect from ${stats.totalSets} different sets - consider completing some sets for bonus value`);
  }
  
  return insights;
}

/**
 * Calculates ROI for individual cards (requires purchase price data)
 */
export interface CardROI extends CollectionItem {
  purchasePrice?: number;
  roi?: number; // Percentage gain/loss
  totalGainLoss?: number; // Dollar amount
}

export function calculateROI(item: CollectionItem, purchasePrice: number): CardROI {
  const currentValue = item.value;
  const gainLoss = currentValue - purchasePrice;
  const roi = (gainLoss / purchasePrice) * 100;
  
  return {
    ...item,
    purchasePrice,
    roi: Math.round(roi * 100) / 100,
    totalGainLoss: Math.round(gainLoss * 100) / 100,
  };
}
