# Developer Setup & Deployment Guide

This guide walks through configuring, running, and deploying the complete **Neko Music** platform, including the core **Slothify** full-stack streaming application and the companion **Saavn Audio Services** edge microservice.

---

## 1. System Requirements & Prerequisites

| Tool | Minimum Version | Recommended | Notes |
|:---|:---|:---|:---|
| **Node.js** | `>= 20.10.0` | `v24.22.1` | Used for Slothify client, server, and test harness |
| **npm** | `>= 10.0.0` | `11.19.1` | Package manager for Slothify |
| **Bun** | `>= 1.0.29` | `1.2.8+` | Required for Saavn Audio Services microservice |
| **Git** | `>= 2.30.0` | Latest | Version control |
| **MongoDB** | `>= 6.0` | Atlas or Local | Required for user accounts, encrypted libraries |
| **Redis** | Optional | Latest | Caching acceleration (in-memory fallback built-in) |

---

## 2. Setting Up Slothify Core Platform

### Step 1: Clone Repository
```bash
git clone https://github.com/PurveshShinde/Slothify.git
cd Slothify
```

### Step 2: Install Dependencies
Install dependencies for both frontend and backend:
```bash
# Install backend dependencies
npm install --prefix server

# Install frontend dependencies
npm install --prefix client
```

### Step 3: Configure Environment Variables

#### Backend (`server/.env`)
Create a `.env` file in the `server/` directory (refer to `.example.env` in the root):
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration (MongoDB Atlas or local instance)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.cpjwwpy.mongodb.net/slothify?retryWrites=true&w=majority

# Zero-Knowledge Security & Authentication
JWT_SECRET=your-super-secure-jwt-secret-key-32-chars-min
ENCRYPTION_SECRET=slothify_zero_knowledge_super_secret_pepper_2026

# Audio Services Integration
# Point to your dedicated Cloudflare Worker or local microservice instance:
SAAVN_API_URL=https://slothify-audio-services.shindepurvesh007.workers.dev

# Optional Caching (Falls back to in-memory cache if omitted or unreachable)
REDIS_URL=redis://localhost:6379
```

#### Frontend (`client/.env`)
Create a `.env` file in the `client/` directory (optional in local development due to Vite proxy):
```env
# API Endpoint (Defaults to relative /api handled by Vite proxy to localhost:5000)
VITE_API_BASE=http://localhost:5000
```

### Step 4: Run Development Servers
Open two terminal windows:

* **Terminal 1: Backend Server**
  ```bash
  npm run dev --prefix server
  ```
  *Server starts on `http://localhost:5000` via `tsx watch` with live auto-reload.*

* **Terminal 2: Frontend Client**
  ```bash
  npm run dev --prefix client
  ```
  *Frontend starts on `http://localhost:5173` via Vite.*

Open [http://localhost:5173](http://localhost:5173) in your browser to start streaming music.

---

## 3. Setting Up Saavn Audio Services Microservice

The Saavn Audio Services extension resides in `saavn-extension-main/slothify-audio-services`.

### Step 1: Navigate & Install
```bash
cd ../saavn-extension-main/slothify-audio-services
bun install
```

### Step 2: Start Development Server
```bash
bun run dev
```
*The Hono edge server will start at `http://localhost:3000`.*

### Step 3: Interactive API Docs
Navigate to:
```
http://localhost:3000/docs
```
to explore interactive Scalar OpenAPI documentation for all song, album, artist, and playlist resolution endpoints.

### Alternative: Docker Compose
You can also run the microservice via Docker:
```bash
docker-compose up -d
```

---

## 4. Running Tests & Quality Verification

Slothify includes an ultra-fast, zero-dependency unit test runner powered by Node.js 24's native `node:test` harness and `tsx`:

```bash
# Run full unit test suite
npm test

# Run backend TypeScript check
npm run build --prefix server

# Run frontend TypeScript check & production build
npm run build --prefix client
```

For the Saavn Audio Services microservice:
```bash
cd ../saavn-extension-main/slothify-audio-services
bun run test
```

---

## 5. Production Build & Deployment

### 5.1 Building Slothify for Production
```bash
# Compile backend (emits to server/dist/)
npm run build --prefix server

# Compile frontend (emits to client/dist/)
npm run build --prefix client
```

To run the production backend with pre-compiled assets:
```bash
npm start --prefix server
```

### 5.2 Deploying Frontend to Vercel / Netlify / Cloudflare Pages
- **Build Command**: `npm run build --prefix client`
- **Output Directory**: `client/dist`
- **Environment Variables**: Set `VITE_API_BASE` to your deployed backend URL.

### 5.3 Deploying Backend to Render / Railway / Docker
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Port**: Ensure your cloud host exposes the `PORT` specified in environment variables (default `5000`).

### 5.4 Deploying Saavn Audio Services to Cloudflare Workers
```bash
cd ../saavn-extension-main/slothify-audio-services

# Authenticate with Cloudflare
bun run wrangler login

# Deploy globally to Cloudflare Workers
bun run deploy
```
Once deployed, copy your worker URL (e.g., `https://slothify-audio-services.<subdomain>.workers.dev`) into your Slothify backend `.env` as `SAAVN_API_URL`.

---

## 6. Troubleshooting Common Issues

### Issue 1: Audio Fails to Play (CORS or Network Error)
* **Check**: Ensure `SAAVN_API_URL` is accessible. If using a local microservice, verify it is running on `http://localhost:3000`.
* **Fix**: In `Settings -> Audio Provider`, toggle between **JioSaavn** and **YouTube** to verify provider fallback.

### Issue 2: `Cannot find module 'jsonwebtoken'` During Test Run
* **Cause**: Test runner launched without `NODE_PATH` pointing to `server/node_modules`.
* **Fix**: Always execute tests via `npm test` rather than invoking `tsx --test` directly.

### Issue 3: In-Memory MongoDB Sort Warning
* **Cause**: Querying user history without the compound index.
* **Fix**: Ensure `server/src/models/ListeningHistory.ts` defines `ListeningHistorySchema.index({ userId: 1, playedAt: -1 })`.

