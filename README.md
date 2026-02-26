# Ecommerce Backend

Node.js/Express backend for an ecommerce application using MongoDB (Mongoose).

## Getting started

1. Install dependencies
   ```bash
   npm install
   ```
2. Configure environment in `.env`
   ```dotenv
   MONGO_URI=...
   PORT=3000
   JWT_SECRET=secure-secret

   # payment verification secret (required for /api/payments/verify)
   PAYMENT_WEBHOOK_SECRET=replace-with-strong-secret

   # frontend URL used to build password reset links
   FRONTEND_URL=http://localhost:3000

   # email (SMTP)
   EMAIL_HOST=smtp-relay.brevo.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=<smtp-username>
   EMAIL_PASS=<smtp-password>
   EMAIL_FROM=<verified-from-address>
   ```
3. Run
   ```bash
   npm start
   npm run dev
   ```

Swagger UI: `http://localhost:3000/docs`

## API flow summary

### Auth
- `POST /api/auth/register`
- `POST /api/auth/verify-email`
- `POST /api/auth/login`
- `POST /api/auth/logout` (auth)
- `GET /api/auth/me` (auth)
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Notes:
- Forgot-password no longer returns reset tokens in API response.
- Reset tokens are hashed in DB.

### Users
- `GET /api/users/profile` (auth)
- `PUT /api/users/profile` (auth)
- `DELETE /api/users/profile` (auth)

Notes:
- Email updates enforce uniqueness.
- Changing email sets `emailVerified=false` and sends a fresh verification code.

### Categories
- `GET /api/categories` (public, active categories)
- `POST /api/categories` (admin)
- `PUT /api/categories/:id` (admin)
- `DELETE /api/categories/:id` (admin)

### Products
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products` (admin)
- `PUT /api/products/:id` (admin)
- `DELETE /api/products/:id` (admin)

### Cart
- `GET /api/cart` (auth)
- `POST /api/cart/add` (auth)
- `PUT /api/cart/update` (auth)
- `DELETE /api/cart/remove/:productId` (auth)
- `DELETE /api/cart/clear` (auth)

Notes:
- Item pricing is server-controlled from Product data.

### Orders
- `POST /api/orders` (auth)
- `GET /api/orders/my-orders` (auth)
- `GET /api/orders/:id` (owner/admin)
- `PUT /api/orders/:id/status` (admin)

Notes:
- Order item price/name/image and `totalAmount` are derived server-side.

### Reviews
- `POST /api/reviews` (auth)
- `GET /api/reviews/:productId`
- `DELETE /api/reviews/:id` (owner/admin)

### Payments
- `POST /api/payments/create` (auth)
- `POST /api/payments/verify` (auth)
- `GET /api/payments/:orderId` (auth)

Notes:
- `/api/payments/verify` requires `orderId`, `paymentId`, and `signature`.
- Signature is validated as HMAC-SHA256 of `"${orderId}:${paymentId}"` using `PAYMENT_WEBHOOK_SECRET`.

### Admin
- `GET /api/admin/users` (admin)
- `GET /api/admin/orders` (admin)
- `GET /api/admin/dashboard-stats` (admin)
- `POST /api/admin/promote` (admin)

## Validation and error handling

- Route params using IDs now return `400` for invalid ObjectId format.
- Authorization failures return `401`/`403`.
- Validation failures return `400`.
