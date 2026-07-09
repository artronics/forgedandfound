"use client";

import React, {createContext, useContext, useState} from "react";

const SearchSheetContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({
  open: false, setOpen: () => {
  },
});

export const useSearchSheet = () => useContext(SearchSheetContext);

export function SearchSheetProvider({children}: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <SearchSheetContext.Provider value={{open, setOpen}}>
      {children}
    </SearchSheetContext.Provider>
  );
}