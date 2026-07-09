"use client";

import React, {createContext, useContext, useState} from "react";

const LoginSheetContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({
  open: false, setOpen: () => {
  },
});

export const useLoginSheet = () => useContext(LoginSheetContext);

export function LoginSheetProvider({children}: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <LoginSheetContext.Provider value={{open, setOpen}}>
      {children}
    </LoginSheetContext.Provider>
  );
}