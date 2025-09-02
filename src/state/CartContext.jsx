import React, { createContext, useContext, useState, useMemo } from 'react';

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

export function CartProvider({ children }){
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const addItem = (item) => {
    setItems(prev => {
      const i = prev.findIndex(p => p.id === item.id);
      if (i > -1) {
        const next = [...prev];
        next[i] = { ...next[i], qty: (next[i].qty || 1) + (item.qty || 1) };
        return next;
      }
      return [...prev, { ...item, qty: item.qty || 1 }];
    });
    setOpen(true);
  };
  const removeItem = (id) => setItems(prev => prev.filter(p => p.id !== id));
  const clear = () => setItems([]);

  const total = useMemo(() => items.reduce((s, x) => s + x.price * (x.qty || 1), 0), [items]);
  const count = useMemo(() => items.reduce((s, x) => s + (x.qty || 1), 0), [items]);

  const value = { items, addItem, removeItem, clear, total, count, open, setOpen };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
