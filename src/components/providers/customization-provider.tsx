"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type Persona = "student" | "creator" | "business" | "event" | "other" | "";

type CustomizationContextValue = {
  primaryColor: string;
  accentColor: string;
  initials: string;
  persona: Persona;
  setPrimaryColor: (value: string) => void;
  setAccentColor: (value: string) => void;
  setInitials: (value: string) => void;
  setPersona: (value: Persona) => void;
  resetCustomization: () => void;
};

const DEFAULT_PRIMARY = "#0f172a";
const DEFAULT_ACCENT = "#a7f3d0";
const DEFAULT_INITIALS = "TC";

const CustomizationContext = createContext<CustomizationContextValue | undefined>(undefined);

export function CustomizationProvider({ children }: { children: ReactNode }) {
  const [primaryColor, setPrimaryColorState] = useState(DEFAULT_PRIMARY);
  const [accentColor, setAccentColorState] = useState(DEFAULT_ACCENT);
  const [initials, setInitialsState] = useState(DEFAULT_INITIALS);
  const [persona, setPersonaState] = useState<Persona>("");

  const setPrimaryColor = useCallback((value: string) => {
    setPrimaryColorState(value || DEFAULT_PRIMARY);
  }, []);

  const setAccentColor = useCallback((value: string) => {
    setAccentColorState(value || DEFAULT_ACCENT);
  }, []);

  const setInitials = useCallback((value: string) => {
    const next = value?.slice(0, 3).toUpperCase() || DEFAULT_INITIALS;
    setInitialsState(next);
  }, []);

  const setPersona = useCallback((value: Persona) => {
    setPersonaState(value);
  }, []);

  const resetCustomization = useCallback(() => {
    setPrimaryColorState(DEFAULT_PRIMARY);
    setAccentColorState(DEFAULT_ACCENT);
    setInitialsState(DEFAULT_INITIALS);
    setPersonaState("");
  }, []);

  const value = useMemo(
    () => ({
      primaryColor,
      accentColor,
      initials,
      persona,
      setPrimaryColor,
      setAccentColor,
      setInitials,
      setPersona,
      resetCustomization,
    }),
    [primaryColor, accentColor, initials, persona, setPrimaryColor, setAccentColor, setInitials, setPersona, resetCustomization]
  );

  return <CustomizationContext.Provider value={value}>{children}</CustomizationContext.Provider>;
}

export function useCustomization() {
  const context = useContext(CustomizationContext);
  if (!context) {
    throw new Error("useCustomization must be used within a CustomizationProvider");
  }
  return context;
}


