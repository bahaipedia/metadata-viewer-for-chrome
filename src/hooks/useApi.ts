import { useState } from 'react';

const API_BASE = "https://digitalbahairesources.org";

export const useApi = () => {
  const [error, setError] = useState<string | null>(null);

  const request = async (endpoint: string, method: string, body?: any) => {
    // 1. Get Token
    const storage = await chrome.storage.local.get(['api_token']);
    const token = storage.api_token;
    const manifest = chrome.runtime.getManifest();

    if (!token) throw new Error("No API token found. Please login.");

    // 2. Fetch
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Client-Version': manifest.version
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) {
      // Clear token if unauthorized or forbidden
      if (res.status === 401 || res.status === 403) {
        await chrome.storage.local.remove(['api_token']);
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
