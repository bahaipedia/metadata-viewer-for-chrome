```
metadata-viewer/
├── public/
│   ├── manifest.json              # Extension config (Points to src/ for scripts per build)
│   ├── side_panel.html            # HTML Entry for the React App
│   └── icons/                     # (Optional) Extension icons
│
├── src/
│   ├── background/
│   │   └── service_worker.ts      # Auth: Mediates Bot Password handshake & stores JWT
│   │
│   ├── content/
│   │   ├── index.ts               # Content Script Entry: Bridges DOM events to Side Panel
│   │   ├── scraper.ts             # Metadata: Extracts MediaWiki Article ID & Rev ID from HTML
│   │   ├── highlighter.ts         # View: Logic for rendering DB units as DOM highlights
│   │   └── selection_handler.ts   # Interaction: Captured text & DOM Range data
│   │
│   ├── side_panel/                # React Sidebar UI
│   │   ├── index.tsx              # React Entry Point
│   │   ├── App.tsx                # Main Router: Switches between AuthGate & UnitForm
│   │   └── components/
│   │       ├── AuthGate.tsx       # UI for MediaWiki Bot Password Login
│   │       ├── UnitForm.tsx       # Contribution form (Author, Unit Type, Text Preview)
│   │       └── TagInput.tsx       # Autocomplete tagging with "Create on the Fly" logic
│   │
│   ├── hooks/
│   │   └── useApi.ts              # Custom Hook: Axios wrapper for JWT-authenticated requests
│   │
│   ├── utils/
│   │   ├── offset_calculator.ts   # Logic for converting DOM ranges to database indices
│   │   └── types.ts               # Shared TypeScript Interfaces (Unit, Metadata, etc.)
│   │
│   └── styles/
│       ├── highlights.css         # CSS for injecting highlights into the Wiki body
│       └── side_panel.css         # Tailwind & custom styles for the sidebar
│
├── vite.config.ts                 # Build config for Chrome Extension output
├── tailwind.config.js             # UI styling configuration
├── tsconfig.json                  # TypeScript project settings
└── package.json                   # Dependencies & build scripts
```
