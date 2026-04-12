# Liora - AI-Powered Restaurant Management Platform

## Project Overview

Liora is a dual-portal AI-powered restaurant management and customer experience platform. It bridges restaurant operations and customer service using Google Gemini AI.

### Portals
- **Consumer Portal**: Mobile-centric web app for diners to discover restaurants, scan QR codes, chat with an AI Waiter, place orders, split bills, and track wellness/calories.
- **Restaurant Portal**: Management dashboard for owners/staff to manage menus, track KPIs, handle orders, run loyalty programs, and use an AI Consultant for business insights.

## Tech Stack

- **Frontend**: React 19 + TypeScript, Vite 6, Tailwind CSS (CDN)
- **Backend**: Node.js + Express 5
- **AI**: Google Gemini (`@google/genai`)
- **Database/Auth**: Supabase (`@supabase/supabase-js`), with in-memory session store
- **Package Manager**: npm

## Project Structure

```
liora-main/
├── components/          # Shared UI components
├── hooks/               # Custom React hooks
├── public/              # Static assets
├── server/              # Express backend (port 3001)
│   ├── routes/          # API endpoints
│   └── store.js         # In-memory session management
├── services/            # API service layers (Gemini, AI Waiter)
├── src/
│   ├── auth/            # Authentication (Supabase & Demo mode)
│   ├── context/         # React Context providers
│   ├── portals/         # App entry points
│   │   ├── restaurant/  # Restaurant owner pages
│   │   └── user/        # Consumer pages
│   ├── lib/             # Supabase client initialization
│   └── RoleRouter.tsx   # Core routing by user role
├── utils/               # Helpers (QR generation, NLU)
├── vite.config.ts       # Vite config (port 5000, proxy to backend)
└── package.json
```

## Development

The app uses `concurrently` to run both frontend and backend:

```bash
cd liora-main && npm run dev
```

- Frontend: http://localhost:5000 (Vite dev server)
- Backend API: http://localhost:3001 (Express)
- Vite proxies `/api` requests to the backend

## Environment Variables

- `GEMINI_API_KEY` - Google Gemini API key (required for AI features)
- Supabase credentials configured in `src/lib/supabase.ts`

## Workflow

- **Start application**: `cd liora-main && npm run dev` (port 5000, webview)
