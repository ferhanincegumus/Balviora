import React, { createContext, useContext, useState, useCallback } from "react";

const SidePanelContext = createContext(null);

export function useSidePanel() {
  const ctx = useContext(SidePanelContext);
  if (!ctx) {
    return { panels: [], openPanel: () => {}, closePanel: () => {}, closeTop: () => {}, closeAll: () => {} };
  }
  return ctx;
}

export function SidePanelProvider({ children }) {
  const [panels, setPanels] = useState([]);

  const openPanel = useCallback((type, data, opts = {}) => {
    setPanels((p) => [...p, { type, data: data || {}, title: opts.title, key: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }]);
  }, []);

  const closePanel = useCallback((key) => setPanels((p) => p.filter((x) => x.key !== key)), []);
  const closeTop = useCallback(() => setPanels((p) => p.slice(0, -1)), []);
  const closeAll = useCallback(() => setPanels([]), []);

  return (
    <SidePanelContext.Provider value={{ panels, openPanel, closePanel, closeTop, closeAll }}>
      {children}
    </SidePanelContext.Provider>
  );
}