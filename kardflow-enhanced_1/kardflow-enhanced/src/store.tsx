import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { type ThemeId, type ActivePage, type CartItem, type WishlistItem, type CollectionItem, type SavedDeck, type UserProfile, THEMES } from './types';

interface StoreContextType {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  activePage: ActivePage;
  setActivePage: (p: ActivePage) => void;
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateCartQty: (id: string, qty: number) => void;
  clearCart: () => void;
  wishlist: WishlistItem[];
  addToWishlist: (item: WishlistItem) => void;
  removeFromWishlist: (id: string) => void;
  collections: CollectionItem[];
  addToCollection: (item: CollectionItem) => void;
  removeFromCollection: (id: string) => void;
  decks: SavedDeck[];
  saveDeck: (deck: SavedDeck) => void;
  deleteDeck: (id: string) => void;
  user: UserProfile | null;
  isLoggedIn: boolean;
  login: (username: string) => void;
  logout: () => void;
  toast: string | null;
  showToast: (msg: string) => void;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  authModal: 'login' | 'signup' | null;
  setAuthModal: (v: 'login' | 'signup' | null) => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem('kf_' + key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

function save(key: string, value: unknown) {
  try { localStorage.setItem('kf_' + key, JSON.stringify(value)); } catch { /* noop */ }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [theme, _setTheme] = useState<ThemeId>(() => load('theme', 'cyber-blue'));
  const [activePage, setActivePage] = useState<ActivePage>('home');
  const [cart, setCart] = useState<CartItem[]>(() => load('cart', []));
  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => load('wishlist', []));
  const [collections, setCollections] = useState<CollectionItem[]>(() => load('collections', []));
  const [decks, setDecks] = useState<SavedDeck[]>(() => load('decks', []));
  const [user, setUser] = useState<UserProfile | null>(() => load('user', null));
  const [isLoggedIn, setIsLoggedIn] = useState(() => load('loggedIn', false));
  const [toast, setToast] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authModal, setAuthModal] = useState<'login' | 'signup' | null>(null);

  const setTheme = useCallback((t: ThemeId) => {
    _setTheme(t);
    const themeInfo = THEMES.find(th => th.id === t);
    if (themeInfo && t !== 'cyber-blue') {
      document.documentElement.setAttribute('data-theme', themeInfo.dataAttr);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    save('theme', t);
  }, []);

  useEffect(() => {
    if (theme !== 'cyber-blue') {
      const themeInfo = THEMES.find(t => t.id === theme);
      if (themeInfo) document.documentElement.setAttribute('data-theme', themeInfo.dataAttr);
    }
  }, [theme]);

  useEffect(() => { save('cart', cart); }, [cart]);
  useEffect(() => { save('wishlist', wishlist); }, [wishlist]);
  useEffect(() => { save('collections', collections); }, [collections]);
  useEffect(() => { save('decks', decks); }, [decks]);
  useEffect(() => { save('user', user); }, [user]);
  useEffect(() => { save('loggedIn', isLoggedIn); }, [isLoggedIn]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const addToCart = useCallback((item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
    showToast(`${item.name} added to cart`);
  }, [showToast]);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateCartQty = useCallback((id: string, qty: number) => {
    if (qty <= 0) { removeFromCart(id); return; }
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty } : c));
  }, [removeFromCart]);

  const clearCart = useCallback(() => setCart([]), []);

  const addToWishlist = useCallback((item: WishlistItem) => {
    setWishlist(prev => {
      if (prev.find(w => w.id === item.id)) return prev;
      return [...prev, item];
    });
    showToast(`${item.name} added to wishlist`);
  }, [showToast]);

  const removeFromWishlist = useCallback((id: string) => {
    setWishlist(prev => prev.filter(w => w.id !== id));
  }, []);

  const addToCollection = useCallback((item: CollectionItem) => {
    setCollections(prev => [...prev, item]);
    showToast(`${item.name} added to collection`);
  }, [showToast]);

  const removeFromCollection = useCallback((id: string) => {
    setCollections(prev => prev.filter(c => c.id !== id));
  }, []);

  const saveDeck = useCallback((deck: SavedDeck) => {
    setDecks(prev => {
      const idx = prev.findIndex(d => d.id === deck.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = deck; return next; }
      return [...prev, deck];
    });
    showToast(`Deck "${deck.name}" saved`);
  }, [showToast]);

  const deleteDeck = useCallback((id: string) => {
    setDecks(prev => prev.filter(d => d.id !== id));
  }, []);

  const login = useCallback((username: string) => {
    const profile: UserProfile = {
      username,
      joinDate: new Date().toISOString().slice(0, 10),
      collectionValue: 0,
      totalTrades: 0,
      avatar: username.slice(0, 2).toUpperCase(),
    };
    setUser(profile);
    setIsLoggedIn(true);
    setAuthModal(null);
    showToast(`Welcome, ${username}!`);
  }, [showToast]);

  const logout = useCallback(() => {
    setUser(null);
    setIsLoggedIn(false);
    showToast('Logged out');
  }, [showToast]);

  return (
    <StoreContext.Provider value={{
      theme, setTheme, activePage, setActivePage,
      cart, addToCart, removeFromCart, updateCartQty, clearCart,
      wishlist, addToWishlist, removeFromWishlist,
      collections, addToCollection, removeFromCollection,
      decks, saveDeck, deleteDeck,
      user, isLoggedIn, login, logout,
      toast, showToast,
      cartOpen, setCartOpen,
      settingsOpen, setSettingsOpen,
      authModal, setAuthModal,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
