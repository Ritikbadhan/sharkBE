const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

dotenv.config();

const app = express();

app.use(express.json());

// CORS
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3001')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

// Swagger UI
try {
  const swaggerDocument = YAML.load(path.join(__dirname, 'docs', 'api-docs.yaml'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (err) {
  console.warn('Could not load Swagger docs:', err.message || err);
}

connectDB().catch((err) => console.error(err));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/cart', require('./routes/cart.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/account', require('./routes/account.routes'));
app.use('/api/wishlist', require('./routes/wishlist.routes'));
app.use('/api/addresses', require('./routes/address.routes'));
app.use('/api/categories', require('./routes/category.routes'));
app.use('/api/reviews', require('./routes/review.routes'));
app.use('/api/orders', require('./routes/order.routes'));
app.use('/api/returns', require('./routes/return.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/admin', require('./routes/admin.routes'));

app.get('/', (req, res) => res.json({ message: 'Ecommerce API' }));

module.exports = app;
