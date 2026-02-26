# Ecommerce Backend

This is a minimal Node.js/Express backend for an ecommerce application. It uses MongoDB via Mongoose and provides a set of RESTful endpoints for authentication, product management, cart/order handling, etc.

## Getting started

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure environment**
   Copy `.env.example` (if exists) or create `.env` with the required values:
   ```dotenv
   MONGO_URI=...                          # your Atlas or local URI
   PORT=3000
   JWT_SECRET=secure-secret
   
   # email (SMTP) settings
   EMAIL_HOST=smtp-relay.brevo.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=<smtp-username>
   EMAIL_PASS=<smtp-password>
   EMAIL_FROM=<verified-from-address>
   ```
3. **Run**
   ```bash
   npm start          # production
   npm run dev        # with nodemon
   ```
4. **Swagger UI** available at `http://localhost:3000/docs` for exploring the API.

## High-level data flow

- **User registration**: client sends name/email/password (optional `phone`). Backend stores user with an OTP code and sends verification email. The user must call `/api/auth/verify-email` with the code to activate the account before logging in.

- **Authentication**: logging in returns a JWT. All protected routes require the token in `Authorization: Bearer <token>` header.

- **Categories & products**:
  - There is a `categories` collection. Admins can create categories separately (e.g. via custom admin endpoint or manually in database).
  - When creating/updating a product, `categoryId` should point to an existing category. For convenience, you may pass the category slug or name instead of the raw ObjectId; server will resolve it automatically. If no category exists, the value may be any string but it won't be linked.
  - The product schema allows `name`, `description`, `price`, `stock`, `images` array and optional `categoryId`. The example payload in Swagger reflects all fields.

- **Admin flow**:
  1. Create an account and verify email.
  2. In the database, set `role` field of the user to `admin` (no UI provided yet).
  3. Use `/api/products` POST/PUT/DELETE to manage products.
  4. Create categories as needed and reference them when creating products.

- **Frontend notes**:
  - After registration, show OTP input. Post-code to `/api/auth/verify-email`.
  - For product creation forms, offer category dropdown populated from `/api/categories` (list them). Use the category `_id` when sending to backend or the slug/name if easier.
  - Use Swagger as reference for request/response shapes.
  - Endpoints are grouped by resource: `/api/products`, `/api/cart`, `/api/users`, etc. Use GET/POST/PUT/DELETE accordingly.

## Full backend flow overview

### Authentication & users
1. **Register** (`POST /api/auth/register`): provide name/email/password (optional phone). Backend stores user with unverified flag and sends OTP email.  
2. **Verify email** (`POST /api/auth/verify-email`): supply received code to active account.  
3. **Login** (`POST /api/auth/login`): supply email+password to receive JWT.  
4. **Profile** (`GET /api/auth/me`, `PUT /api/users/profile`): use auth header to retrieve or update details.  
5. **Password reset** (`/api/auth/forgot-password` and `/api/auth/reset-password`).

### Products & categories
- **Categories**: managed by admin (currently no direct endpoints; create manually or add an admin route). Each has `name`, `slug`, `isActive`. Category list used to populate drop-downs.
- **Products**:
  1. Admin creates/updates/deletes via protected `/api/products` routes.
  2. Regular users can list (`GET /api/products`) and view details (`GET /api/products/:id`).
  3. When creating, `categoryId` may be an ObjectId, slug, or name; server resolves it if possible.

### Cart & orders
1. **Cart**:
   - `GET /api/cart` returns current user's cart (requires auth).
   - `POST /api/cart/add` add item or quantity (requires auth).
   - `PUT /api/cart/update` modify quantity or items (requires auth).
   - `DELETE /api/cart` could be implemented to clear cart (not currently present).
2. **Orders**:
   - `POST /api/orders` to place an order from cart (auth required).
   - `GET /api/orders` lists user's orders; admin can view all via `/api/admin/orders`.
   - Order schema includes items, total, status, etc.

### Reviews & ratings
- `POST /api/reviews` allow authenticated users to leave a rating/title/body for a product they purchased.
- `GET /api/reviews/product/:id` fetch reviews for a given product.

### Admin operations
1. Promote a user to admin by setting `role` field in database or via admin endpoint.  
2. Manage products and categories as above.  
3. Fetch dashboard stats via `/api/admin/dashboard-stats`.
4. List all users and orders for moderation.

### Payment & checkout
- `POST /api/payments` to record a payment; integration with gateway can be added.
- Order creation may validate payment status before finalising.

### Data validation & error handling
- All endpoints return standard JSON responses with `message` and optional `errors` for validation failures.
- Authorization failures return 401/403; missing fields return 400.

### Notes for developers
- Use Swagger at `/docs` for up-to-date structure.  
- Schemas are defined in `src/docs/api-docs.yaml`; keep them in sync when models change.  
- Add new routes under `src/routes` and controllers under `src/controllers`, following existing patterns.

## Category handling discussion

Currently categories are stored in Mongo with `name`, `slug`, and `isActive` flags. There's no `enum` constraint on products; you may either:

1. Create categories ahead of time and let admins choose them. The backend will map slug/name to ID.
2. If you want a fixed list, implement an `enum` field on the product schema and maintain it manually (not currently implemented).

Until categories are in place you can still supply any string for `categoryId` — the field will simply be stored as-is.

## Additional notes

- `email.service.js` uses nodemailer with SMTP; you can swap it for a transactional API if preferred.
- `sms.service.js` remains in the repo but is unused after switching to email OTPs.

Feel free to expand this README with frontend-specific examples or to add scripts for seeding categories/users.