const express = require('express');
const cors = require('cors');
const { loadEnv } = require('../config/env');
const { AppError } = require('../utils/errors');
const { mapAwsClientError } = require('../utils/mapAwsError');
const authRoutes = require('../routes/authRoutes');
const { authMiddleware } = require('../middleware/auth');
const taskRoutes = require('../routes/taskRoutes');
const projectRoutes = require('../routes/projectRoutes');
const commentRoutes = require('../routes/commentRoutes');
const userRoutes = require('../routes/userRoutes');
const auditRoutes = require('../routes/auditRoutes');

const cfg = loadEnv();
const app = express();

app.use(
  cors({
    origin: cfg.corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));

// Health check stays at /health (ALB checks this directly, not through CloudFront)
app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);

app.use(authMiddleware);
app.get('/api/auth/me', (req, res) => res.json(req.auth.profile));
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api', userRoutes);

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  const mapped = mapAwsClientError(err);
  if (mapped) {
    return res.status(mapped.status).json({ message: mapped.message, code: mapped.code });
  }
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(cfg.port, () => {
  console.log(`Mini Jira AWS API listening on :${cfg.port}`);
});
