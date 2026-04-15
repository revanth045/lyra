import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import ordersRouter from './routes/orders.js';
import menuRouter from './routes/menu.js';
import analyticsRouter from './routes/analytics.js';
import promotionsRouter from './routes/promotions.js';
import reviewsRouter from './routes/reviews.js';
import aiWaiterRouter from './routes/aiWaiter.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust Replit's proxy so rate-limit can read the real client IP
app.set('trust proxy', 1);

// ── Security middleware ────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Rate limiting — 300 req / 15 min per IP
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/orders', ordersRouter);
app.use('/api/menu', menuRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/promotions', promotionsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/ai-waiter', aiWaiterRouter);


// ── Health check ───────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── 404 handler ────────────────────────────────────────────────────────────
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));

// ── Error handler ──────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🍽️  Liora API server running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
});

export default app;
