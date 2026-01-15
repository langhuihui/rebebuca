# Rebebuca Website

A modern website for Rebebuca terminal collaboration platform, built with Vite, Vue 3, and TypeScript.

## Features

- **User Authentication**: Get user information and authentication status
- **Login/Registration**: Redirect to auth server for login and registration
- **User Info Display**: Show user details and subscription plan
- **Responsive Design**: Mobile-friendly interface
- **Modern UI**: Clean and professional design

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Edit .env to configure auth server URL
```

### Development

```bash
# Start development server
pnpm dev
```

The website will be available at `http://localhost:3001`

### Build

```bash
# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Project Structure

```
website/
├── src/
│   ├── components/       # Vue components
│   │   ├── Header.vue    # Navigation header with user info
│   │   └── Footer.vue    # Footer component
│   ├── composables/      # Vue composables
│   │   └── useAuth.ts    # Authentication composable
│   ├── router/          # Vue Router configuration
│   │   └── index.ts      # Route definitions
│   ├── services/        # API services
│   │   └── authService.ts # Authentication service
│   ├── stores/          # Pinia stores
│   │   └── auth.ts       # Authentication store
│   ├── types/           # TypeScript types
│   │   └── auth.ts       # Auth-related types
│   ├── views/           # Page components
│   │   ├── HomeView.vue     # Home page
│   │   ├── PricingView.vue  # Pricing page
│   │   └── AboutView.vue    # About page
│   ├── App.vue          # Root component
│   └── main.ts          # Application entry point
├── index.html           # HTML template
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Project dependencies
```

## Authentication

The website integrates with the Rebebuca auth server for user authentication:

### Getting User Information

```typescript
import { useAuth } from '@/composables/useAuth';

const {
  user,
  subscription,
  isAuthenticated,
  initialize,
} = useAuth();

// Initialize authentication
await initialize();

// Check if user is authenticated
if (isAuthenticated.value) {
  console.log('User:', user.value);
  console.log('Subscription:', subscription.value);
}
```

### Redirecting to Login

```typescript
import { useAuth } from '@/composables/useAuth';

const { redirectToLogin } = useAuth();

// Redirect to login page
redirectToLogin('/dashboard');
```

### Displaying User Info

The Header component automatically displays user information when authenticated:

- User display name or email
- Current subscription plan (Free/Pro/Enterprise)
- Dashboard link
- Refresh subscription button

## API Integration

The website communicates with the auth server through the `authService`:

- **Get User Info**: `GET /api/auth/me`
- **Login**: Redirect to `/login`
- **Register**: Redirect to `/register`
- **Dashboard**: Redirect to `/dashboard`

## Environment Variables

Create a `.env` file in the root directory:

```env
VITE_AUTH_SERVER_URL=http://localhost:3000
```

## Styling

The website uses custom CSS with a modern design system:

- Colors: Dark theme with purple/blue gradients
- Typography: System fonts with good readability
- Components: Clean and consistent design
- Responsive: Mobile-friendly layout

## Deployment

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod
```

### Static Hosting

Build the project and deploy the `dist` folder to any static hosting service.

## License

MIT
