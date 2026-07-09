"use client";

import React, {createContext, useContext, useState} from "react";

const CartSheetContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({
  open: false, setOpen: () => {
  },
});

export const useCartSheet = () => useContext(CartSheetContext);

export function CartSheetProvider({children}: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <CartSheetContext.Provider value={{open, setOpen}}>
      {children}
    </CartSheetContext.Provider>
  );
}