const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

dotenv.config();

const app = express();

app.use(express.json());

// Swagger UI
try {
	const swaggerDocument = YAML.load(path.join(__dirname, 'docs', 'api-docs.yaml'));
	app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (err) {
	console.warn('Could not load Swagger docs:', err.message || err);
}

// Connect DB (deferred connection; apps may call connect in server)
connectDB().catch((err) => console.error(err));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/cart', require('./routes/cart.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/addresses', require('./routes/address.routes'));
app.use('/api/categories', require('./routes/category.routes'));
app.use('/api/reviews', require('./routes/review.routes'));
app.use('/api/orders', require('./routes/order.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/admin', require('./routes/admin.routes'));

app.get('/', (req, res) => res.json({ message: 'Ecommerce API' }));

module.exports = app;
