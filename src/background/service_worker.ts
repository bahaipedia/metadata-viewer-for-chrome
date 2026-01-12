const API_BASE = "https://digitalbahairesources.org";

// 1. SIDE PANEL TOGGLE
// Opens the sidebar when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: 'public/side_panel.html',
        enabled: true
    });
    (chrome.sidePanel as any).open({ tabId: tab.id });
});

// 2. AUTHENTICATION HANDSHAKE
// Listens for a message from the Side Panel to start the login flow
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'PERFORM_HANDSHAKE') {
        console.log("[Background] Handshake requested.");
        performHandshake().then((response) => {
            console.log("[Background] Sending response back to UI:", response);
            sendResponse(response);
        });
        return true; 
    }
});

async function performHandshake() {
    try {
        console.log("[Background] Step 1: Getting Cookie 'enworks_session' from https://bahai.works");
        const cookie = await chrome.cookies.get({ 
            url: "https://bahai.works", 
            name: "enworks_session" 
        });

        if (!cookie) {
            console.error("[Background] Error: Cookie not found.");
            return { success: false, error: "Not logged into Bahai.works (Cookie missing)" };
        }
        console.log("[Background] Cookie found:", cookie.value.substring(0, 10) + "...");

        console.log(`[Background] Step 2: POSTing to ${API_BASE}/auth/verify-session`);
        const response = await fetch(`${API_BASE}/auth/verify-session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_cookie: cookie.value })
        });

        console.log("[Background] API Response Status:", response.status);

        if (!response.ok) {
            const errText = await response.text();
            console.error("[Background] API Error Body:", errText);
            try {
                const data = JSON.parse(errText);
                return { success: false, error: data.error || `API Error: ${response.status}` };
            } catch (e) {
                return { success: false, error: `API Error: ${response.status} - ${errText}` };
            }
        }

        const data = await response.json();
        console.log("[Background] Handshake Success. User:", data.username);

        await chrome.storage.local.set({ 
            api_token: data.token,
            user_info: { username: data.username, role: data.role }
        });

        return { success: true, user: data.username };

    } catch (err: any) {
        console.error("[Background] Critical Catch:", err);
        return { success: false, error: err.message || "Unknown Network Error" };
    }
}
