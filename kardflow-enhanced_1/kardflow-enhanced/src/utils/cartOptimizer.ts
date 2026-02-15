import type { CartItem } from './types';

export interface SellerGroup {
  seller: string;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
}

export interface CartOptimization {
  groups: SellerGroup[];
  savings: number;
  originalTotal: number;
  optimizedTotal: number;
}

/**
 * Optimizes cart by grouping items by seller to minimize shipping costs
 * Shipping rates:
 * - $0 for orders over $50
 * - $2.99 for orders $25-$50
 * - $4.99 for orders under $25
 */
export function optimizeCart(cart: CartItem[]): CartOptimization {
  if (cart.length === 0) {
    return {
      groups: [],
      savings: 0,
      originalTotal: 0,
      optimizedTotal: 0,
    };
  }

  // Group items by seller
  const sellerMap = new Map<string, CartItem[]>();
  
  cart.forEach(item => {
    if (!sellerMap.has(item.seller)) {
      sellerMap.set(item.seller, []);
    }
    sellerMap.get(item.seller)!.push(item);
  });
  
  // Calculate shipping for each seller group
  const groups: SellerGroup[] = Array.from(sellerMap.entries()).map(([seller, items]) => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    
    // Shipping calculation
    let shipping = 0;
    if (subtotal < 25) {
      shipping = 4.99;
    } else if (subtotal < 50) {
      shipping = 2.99;
    }
    // Free shipping for orders $50+
    
    return {
      seller,
      items,
      subtotal: Math.round(subtotal * 100) / 100,
      shipping: Math.round(shipping * 100) / 100,
      total: Math.round((subtotal + shipping) * 100) / 100,
    };
  });
  
  // Calculate savings
  const regularSubtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const originalTotal = regularSubtotal + (groups.length * 4.99); // Assume worst case shipping
  const optimizedTotal = groups.reduce((sum, g) => sum + g.total, 0);
  const savings = Math.max(0, originalTotal - optimizedTotal);
  
  return {
    groups: groups.sort((a, b) => b.subtotal - a.subtotal), // Sort by value
    savings: Math.round(savings * 100) / 100,
    originalTotal: Math.round(originalTotal * 100) / 100,
    optimizedTotal: Math.round(optimizedTotal * 100) / 100,
  };
}

/**
 * Gets shipping estimate for a single seller order
 */
export function getShippingCost(subtotal: number): number {
  if (subtotal >= 50) return 0;
  if (subtotal >= 25) return 2.99;
  return 4.99;
}

/**
 * Calculates how much more is needed for free shipping
 */
export function getFreeShippingRemaining(subtotal: number): number {
  if (subtotal >= 50) return 0;
  return Math.round((50 - subtotal) * 100) / 100;
}
