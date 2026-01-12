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

async function performHandshake(credentials?: {username: string, password: string}) {
    try {
        if (!credentials) {
            return { success: false, error: "Credentials missing" };
        }

        console.log(`[Background] Authenticating as ${credentials.username}...`);

        const response = await fetch(`${API_BASE}/auth/verify-session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                username: credentials.username, 
                bot_password: credentials.password 
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            return { success: false, error: `Login Failed: ${response.statusText}` };
        }

        const data = await response.json();

        // Store the JWT
        await chrome.storage.local.set({ 
            api_token: data.token,
            user_info: { username: data.username, role: data.role }
        });

        return { success: true, user: data.username };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// Update the listener to accept the payload
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'PERFORM_HANDSHAKE') {
        // Pass the credentials from UI to the function
        performHandshake(request.credentials).then(sendResponse);
        return true; 
    }
});
