import express from 'express';
import session from 'express-session';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
import youtubeRoutes from './routes/youtube.js';


const app = express();
const PORT = process.env.PORT || 5000;

// CSP Middleware
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "connect-src 'self' https://accounts.spotify.com https://api.spotify.com http://127.0.0.1:5000 http://127.0.0.1:3000",
      "frame-src https://accounts.spotify.com",
      "img-src 'self' data: https:",
      "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://esm.sh",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com"
    ].join('; ')
  );
  next();
});

app.use(cors({
  origin: 'http://127.0.0.1:3000',
  credentials: true
}));
app.use(express.json() as any);

app.use(session({
  name: 'nyx.sid',
  secret: 'nyx-super-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    sameSite: 'lax', // 'lax' works for same-site with different ports
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days for persistent auth
  }
}) as any);

// Mount Routes
app.use('/api/auth', authRoutes);

app.use('/api', apiRoutes);

app.use('/api/youtube', youtubeRoutes);


//Android 
app.listen(5000, '0.0.0.0', () => {
  console.log('Nyx Server running at http://0.0.0.0:5000');
});

// HTTP Server on 127.0.0.1
app.listen(5000, '127.0.0.1', () => {
  console.log('Nyx Server running at http://127.0.0.1:5000');
});
