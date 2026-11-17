import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const API_BASE = "https://digitalbahairesources.org";

export interface StoredUserInfo {
  uid?: number;
  username: string;
  role: string;
  is_showcase_owner?: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  userInfo: StoredUserInfo | null;
  showcaseMode: boolean;
  isShowcaseOwner: boolean;
  isReadOnly: boolean;
  showLogin: boolean;
  workspaceKey: number;
  openLogin: () => void;
  closeLogin: () => void;
  setShowcaseMode: (enabled: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<StoredUserInfo | null>(null);
  const [showcaseMode, setShowcaseModeState] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [workspaceKey, setWorkspaceKey] = useState(0);

  const hydrateSessionMeta = async (token: string, existingInfo?: StoredUserInfo | null) => {
    if (existingInfo && typeof existingInfo.is_showcase_owner === 'boolean') return;
    try {
      const manifest = chrome.runtime.getManifest();
      const res = await fetch(`${API_BASE}/api/session`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Client-Version': manifest.version
        }
      });
      if (!res.ok) return;
      const data = await res.json();
      const updated: StoredUserInfo = {
        username: existingInfo?.username || 'User',
        role: existingInfo?.role || 'user',
        uid: data.uid,
        is_showcase_owner: Boolean(data.is_showcase_owner)
      };
      setUserInfo(updated);
      await chrome.storage.local.set({ user_info: updated });
    } catch (e) {
      console.warn("Could not hydrate session info", e);
    }
  };

  useEffect(() => {
    chrome.storage.local.get(['api_token', 'user_info', 'showcase_mode'], (res) => {
      const hasToken = Boolean(res.api_token);
      setIsAuthenticated(hasToken);
      setUserInfo(res.user_info || null);
      setShowcaseModeState(Boolean(res.showcase_mode));

      if (hasToken) {
        hydrateSessionMeta(res.api_token, res.user_info || null);
      }
    });

    const handleStorage = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== 'local') return;

      let workspaceChanged = false;

      if (changes.api_token) {
        const nextToken = changes.api_token.newValue;
        setIsAuthenticated(Boolean(nextToken));
        workspaceChanged = true;
        if (nextToken) {
          setShowLogin(false);
        }
      }

      if (changes.user_info) {
        setUserInfo(changes.user_info.newValue || null);
      }

      if (changes.showcase_mode) {
        setShowcaseModeState(Boolean(changes.showcase_mode.newValue));
        workspaceChanged = true;
      }

      if (workspaceChanged) {
        setWorkspaceKey(prev => prev + 1);
      }
    };

    chrome.storage.onChanged.addListener(handleStorage);
    return () => chrome.storage.onChanged.removeListener(handleStorage);
  }, []);

  const isShowcaseOwner = Boolean(
    isAuthenticated && (userInfo?.is_showcase_owner || userInfo?.role === 'admin')
  );

  const isReadOnly = !isAuthenticated || (showcaseMode && !isShowcaseOwner);

  const setShowcaseMode = async (enabled: boolean) => {
    await chrome.storage.local.set({ showcase_mode: enabled });
    await chrome.storage.local.remove(['linkerState']);
    chrome.runtime.sendMessage({ type: 'REFRESH_HIGHLIGHTS' }).catch(() => {});
  };

  const logout = async () => {
    await chrome.storage.local.remove(['api_token', 'user_info', 'showcase_mode', 'linkerState']);
    chrome.runtime.sendMessage({ type: 'REFRESH_HIGHLIGHTS' }).catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userInfo,
        showcaseMode,
        isShowcaseOwner,
        isReadOnly,
        showLogin,
        workspaceKey,
        openLogin: () => setShowLogin(true),
        closeLogin: () => setShowLogin(false),
        setShowcaseMode,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
