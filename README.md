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
   CORS_ORIGIN=http://localhost:3001

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

### Account
- `GET /api/account` (auth)

Returns:
- `profile`
- `orders`
- `addresses`
- `paymentMethods`
- `rewards`
- `returns`

### Categories
- `GET /api/categories` (public, active categories)
- `POST /api/categories` (admin)
- `PUT /api/categories/:id` (admin)
- `DELETE /api/categories/:id` (admin)

### Products
- `GET /api/products`
  - query params: `sort`, `category`, `collection`, `search`, `page`, `limit`
- `GET /api/products/trending`
- `GET /api/products/:id`
- `POST /api/products` (admin)
- `PUT /api/products/:id` (admin)
- `DELETE /api/products/:id` (admin)

Product fields include:
- `id/_id`, `name`, `description`, `category`, `collection`, `price`, `originalPrice`, `mrp`
- `images[]`, `stock`, `isNew`, `isBestSeller`, `isLimited`
- `rating`, `reviewCount`, `sizes`, `variants`, `colors`
- `productSpecifications` (fit/material/pattern/size chart/care/manufacturing details)
- `viewCount`, `addedToCartCount`, `trendingScore`, `dropDate`, `releaseDate`
- `createdAt`, `updatedAt`

### Cart
- `GET /api/cart` (auth)
- `POST /api/cart/add` (auth)
- `PUT /api/cart/update` (auth)
- `DELETE /api/cart/remove/:productId` (auth)
- `DELETE /api/cart/clear` (auth)

Cart add/update contract:
```json
{
  "productId": "<product-id>",
  "quantity": 1,
  "size": "M",
  "color": "Black"
}
```

Cart item response fields:
- `productId`, `name`, `price`, `originalPrice`, `image`, `quantity`
- `size`, `color`, `category`, `collection`, `description`, `stock`

Note:
- `DELETE /api/cart/remove/:productId` supports variant targeting with optional `size` and `color` query params.

### Wishlist
- `GET /api/wishlist` (auth)
- `POST /api/wishlist` (auth)
- `DELETE /api/wishlist/:productId` (auth)

`POST /api/wishlist` body:
```json
{ "productId": "<product-id>" }
```

Wishlist item fields are card-ready:
- `id`, `name`, `price`, `originalPrice`, `images/image`, `category`, `collection`
- `stock`, `sizes/variants`, `isNew`, `isBestSeller`, `isLimited`

### Addresses
- `GET /api/addresses` (auth)
- `POST /api/addresses` (auth)
- `PUT /api/addresses/:id` (auth)
- `DELETE /api/addresses/:id` (auth)

Address object:
- `id`, `name`, `phone`, `line1`, `line2`, `city`, `state`, `pincode`
- `landmark`, `instructions`, `isDefault`

### Orders
- `POST /api/orders` (auth)
- `GET /api/orders/my-orders` (auth)
- `GET /api/orders/:id` (owner/admin)
- `PUT /api/orders/:id/status` (admin)

Order object for account:
- `id`, `date`, `status`, `total`
- `items[{ productId, name, qty, size, color, price, image }]`
- `shippingAddress`, `paymentMethod`, `invoiceUrl`, `trackingUrl`, `returnEligible`

### Returns
- `POST /api/returns` (auth)
- `GET /api/returns/my` (auth)

`POST /api/returns` body:
```json
{
  "orderId": "<optional-order-id>",
  "productId": "<optional-product-id>",
  "reason": "Damaged item",
  "comment": "Box was torn"
}
```

### Reviews
- `POST /api/reviews` (auth)
- `GET /api/reviews/:productId`
- `DELETE /api/reviews/:id` (owner/admin)

`POST /api/reviews` contract:
```json
{
  "productId": "<product-id>",
  "rating": 5,
  "title": "Great",
  "comment": "Loved it",
  "images": ["https://..."]
}
```

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

- Route params using IDs return `400` for invalid ObjectId format.
- Authorization failures return `401`/`403`.
- Validation failures return `400`.
