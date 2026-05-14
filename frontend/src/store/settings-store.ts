import { createStore } from "zustand/vanilla";

export type SettingsState = {
  isConnectionMonitorEnabled: boolean;
  setConnectionMonitorEnabled: (enabled: boolean) => void;
};

const getInitialMonitorState = () => {
  const stored = localStorage.getItem("setting_connection_monitor");
  return stored ? stored === "true" : false;
};

export const settingsStore = createStore<SettingsState>((set) => ({
  isConnectionMonitorEnabled: getInitialMonitorState(),

  setConnectionMonitorEnabled: (enabled) => {
    localStorage.setItem("setting_connection_monitor", String(enabled));
    set({ isConnectionMonitorEnabled: enabled });
  },
}));
