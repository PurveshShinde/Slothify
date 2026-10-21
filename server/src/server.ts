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

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/audio', audioRoutes);

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'slothify-backend' });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Slothify Server running on port ${PORT}`);
});
