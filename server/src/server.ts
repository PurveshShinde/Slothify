import dotenv from 'dotenv';
dotenv.config();

// Slothify Server - MongoDB Atlas Integration
import express from 'express';
import cors from 'cors';
import { connectDB } from './db/connection.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
import youtubeRoutes from './routes/youtube.js';
import audioRoutes from './routes/audio.js';
import saavnRoutes from './routes/saavn.js';

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL;

// Initialize Database connection (asynchronous with local fallback)
connectDB().catch((err) => {
  console.warn('[Server] DB initialization warning:', err.message);
});

// CSP Middleware
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "connect-src 'self' http://127.0.0.1:5000 http://127.0.0.1:3000 http://localhost:3000 http://localhost:5000 https:",
      "img-src 'self' data: https:",
      "media-src 'self' data: https: blob:",
      "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://esm.sh",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com"
    ].join('; ')
  );
  next();
});

// CORS configuration supporting local dev and Render production
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (CLIENT_URL && origin === CLIENT_URL) return callback(null, true);
    if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('onrender.com') || origin.includes('vercel.app')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

// Normalize duplicate slashes in request URLs (e.g. //api/search -> /api/search)
app.use((req, _res, next) => {
  if (req.url && req.url.includes('//')) {
    req.url = req.url.replace(/\/{2,}/g, '/');
  }
  next();
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/saavn', saavnRoutes);

// Health check endpoints for Render and keep-alive monitoring
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'slothify-backend',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Slothify Server running on port ${PORT}`);

  // Self-ping Keep-Alive service to prevent Render Free Tier from idling/sleeping
  const PING_INTERVAL_MS = 12 * 60 * 1000; // Ping every 12 minutes (under Render's 15-min sleep threshold)
  const pingTargetUrl = (process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL || 'https://slothify-server.onrender.com').replace(/\/$/, '');

  console.log(`[KeepAlive] Service active. Keeping backend alive at ${pingTargetUrl}/health`);
  setInterval(async () => {
    try {
      const res = await fetch(`${pingTargetUrl}/health`, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'SlothifyKeepAlive/1.0' }
      });
      console.log(`[KeepAlive] Pinged ${pingTargetUrl}/health - Status: ${res.status}`);
    } catch (err: any) {
      console.warn(`[KeepAlive] Ping warning: ${err.message}`);
    }
  }, PING_INTERVAL_MS);
});

