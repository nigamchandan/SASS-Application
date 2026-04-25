const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const multer = require('multer');

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const customerRoutes = require('./routes/customer.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const paymentRoutes = require('./routes/payment.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const whatsappRoutes = require('./routes/whatsapp.routes');
const settingsRoutes = require('./routes/settings.routes');
const expenseRoutes = require('./routes/expense.routes');
const reportRoutes = require('./routes/report.routes');
const { requireAuth } = require('./middleware/auth.middleware');

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);

app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', 'uploads'), {
    maxAge: '7d',
    fallthrough: true,
  })
);

app.get('/api/protected/ping', requireAuth, (req, res) => {
  res.json({
    success: true,
    message: `Hello ${req.user.name}, this is a protected route.`,
  });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'SaaS Application API',
    version: '1.0.0',
    status: 'running',
  });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.message || 'Internal Server Error';
  if (err instanceof multer.MulterError) {
    status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') message = 'File too large (max 2 MB)';
  }
  if (status >= 500) console.error(err);
  res.status(status).json({
    success: false,
    message,
    ...(err.details ? { details: err.details } : {}),
  });
});

module.exports = app;
