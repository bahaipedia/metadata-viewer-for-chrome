import { useState } from 'react';

const API_BASE = "https://digitalbahairesources.org";

export const useApi = () => {
  const [error, setError] = useState<string | null>(null);

  const request = async (endpoint: string, method: string, body?: any) => {
    // 1. Get Token
    const storage = await chrome.storage.local.get(['api_token', 'showcase_mode']);
    const token = storage.api_token;
    const isShowcaseMode = Boolean(storage.showcase_mode);
    const manifest = chrome.runtime.getManifest();

    const isReadRequest = method === 'GET' || endpoint === '/api/units/batch';
    if (!isReadRequest && (!token || isShowcaseMode)) {
      throw new Error("Action unavailable in read-only mode.");
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Client-Version': manifest.version
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (isShowcaseMode) {
      headers['X-View-Showcase'] = 'true';
    }

    // 2. Fetch
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) {
      // Clear token if unauthorized or forbidden
      if ((res.status === 401 || res.status === 403) && token && !isShowcaseMode && isReadRequest) {
        await chrome.storage.local.remove(['api_token', 'user_info']);
      }

      // Fallback if the response isn't JSON
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `API Request failed with status ${res.status}`);
    }

    return res.json();
  };

  return {
    get: (url: string) => request(url, 'GET'),
    post: (url: string, data: any) => request(url, 'POST', data),
    put: (url: string, data: any) => request(url, 'PUT', data),
    del: (url: string, data?: any) => request(url, 'DELETE', data),
    error
  };
};
