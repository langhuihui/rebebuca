# Rebebuca Auth Server

User authentication and subscription management server for Rebebuca.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth
- **Payment**: PayPal
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account
- PayPal Developer account (for payments)

### Setup

1. Install dependencies:

```bash
cd server
npm install
```

2. Set up environment variables:

```bash
cp env.example .env.local
```

Edit `.env.local` with your credentials:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# PayPal
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. Set up Supabase database:

- Go to your Supabase project dashboard
- Navigate to SQL Editor
- Run the SQL from `supabase/migrations/001_initial_schema.sql`

4. Run the development server:

```bash
npm run dev
```

The server will be available at `http://localhost:3000`.

## Database Schema

### Tables

- **products**: Subscription plans (Free, Pro, Enterprise)
- **user_profiles**: Extended user information
- **subscriptions**: User subscription records
- **payments**: Payment transaction history

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user

### User

- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `GET /api/user/subscriptions` - Get user subscriptions
- `GET /api/user/payments` - Get payment history

### Products

- `GET /api/products` - Get all active products

### Payment

- `POST /api/payment/paypal/create` - Create PayPal order
- `POST /api/payment/paypal/capture` - Capture PayPal payment
- `POST /api/payment/webhook` - PayPal webhook handler

## Deployment

### Vercel

1. Push the code to GitHub
2. Import the project in Vercel
3. Set the root directory to `server`
4. Add environment variables in Vercel dashboard
5. Deploy

### Environment Variables for Production

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=live
PAYPAL_WEBHOOK_ID=
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

## Features

- Email/password authentication
- Email verification
- Password reset
- User profile management
- Subscription management (Free, Pro, Enterprise plans)
- PayPal payment integration
- Payment history tracking
- Dark mode support
- Responsive design

## Future Enhancements

- [ ] OAuth login (GitHub, Google)
- [ ] Two-factor authentication
- [ ] Chinese payment methods (Alipay, WeChat Pay)
- [ ] Team/organization management
- [ ] Invoice generation
