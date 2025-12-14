# Citi Cigars Shop - E-commerce Platform

## Overview

Citi Cigars Shop is a premium e-commerce platform for cigar enthusiasts, built as a full-stack web application. The platform features a comprehensive product catalog with advanced filtering, shopping cart functionality, wishlist management, and an admin panel for product management. The application targets the West African market (FCFA currency) and emphasizes luxury presentation with support for premium cigar brands from Cuba, Nicaragua, and the Dominican Republic.

The application serves both customers (browsing, purchasing) and administrators (product management, image associations, bundle creation).

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### 14 décembre 2025
- **Correction API Production** : Corrigé un bug dans `server/static.ts` où le fallback SPA interceptait les routes `/api/*` en production, renvoyant du HTML au lieu de JSON. Les requêtes API retournent maintenant correctement des réponses JSON.
- **Traductions i18n complétées** : Noms de pays, "Prix total", "Ajouter", descriptions des bundles traduits en français/anglais.

## System Architecture

### Technology Stack

**Frontend:**
- React 18 with TypeScript for type-safe UI development
- Vite as the build tool and development server
- Wouter for client-side routing
- TanStack Query (React Query) for server state management
- Tailwind CSS v4 (inline configuration) with custom theme
- Shadcn/ui component library (New York style variant)
- Radix UI primitives for accessible components

**Backend:**
- Express.js server with TypeScript
- RESTful API architecture
- Session-based request logging

**Database & ORM:**
- PostgreSQL as the primary database (via Neon serverless)
- Drizzle ORM for type-safe database queries
- WebSocket connections for database communication

**State Management:**
- React Context API for global state (Cart, Products, Wishlist, Config)
- IndexedDB for client-side product caching and image management
- Session storage for cart persistence

### Directory Structure

```
CitiCigarsShop/
├── client/              # Frontend application
│   ├── src/
│   │   ├── components/  # React components (UI, layout, features)
│   │   ├── context/     # Global state providers
│   │   ├── data/        # Static data (bundles, catalog, top25)
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Utilities and query client
│   │   ├── pages/       # Route components
│   │   ├── services/    # API and IndexedDB services
│   │   └── utils/       # Helper functions (pricing, WhatsApp)
│   ├── public/          # Static assets
│   └── index.html       # Entry HTML
├── server/              # Backend application
│   ├── db.ts           # Database connection
│   ├── index.ts        # Express server setup
│   ├── routes.ts       # API route definitions
│   ├── storage.ts      # Database abstraction layer
│   ├── static.ts       # Static file serving
│   └── vite.ts         # Vite dev middleware
├── shared/             # Shared code between client/server
│   └── schema.ts       # Drizzle schema definitions
├── migrations/         # Database migrations
└── script/            # Build scripts
```

### Database Schema

**Core Tables:**

1. **users**: Authentication and user management
   - id (UUID primary key)
   - username (unique)
   - password (hashed)

2. **products**: Main product catalog
   - sku (primary key, 50 char varchar)
   - Product details: marque, ligne, pays, modele, vitole, format, dimensions, longueur, diametre
   - Pricing: prixUnitaire, prixBoite, prixPack, prixBundle
   - Quantities: qteBoite, quantiteBoite, quantitePack, typePack
   - Metadata: puissance (1-5), rating, top25 (boolean), rank, year
   - Type classification: type (standard/bundle), inCatalogue (boolean)
   - Rich data: description, origine, promotions (JSONB), badges (JSONB), composition (JSONB)
   - Timestamps: createdAt, updatedAt

3. **productImages**: Image associations
   - id (UUID primary key)
   - sku (foreign key to products, cascade delete)
   - type (text: image classification)
   - url (text: image location)

**Design Decisions:**
- Products use individual image fields (imagePrincipale, imageSolo, imagePack, imageBoite) rather than a relation array for simpler querying
- JSONB fields for flexible nested data (promotions, badges, composition)
- Cascade deletes ensure orphaned images are removed
- SKU-based identification instead of numeric IDs for business logic integration

### Client-Side Data Flow

**Dual-Layer Caching Strategy:**
1. **IndexedDB Layer**: Long-term browser storage for products and images
   - Stores: products, images, associations
   - Normalized image type handling (removes accents, lowercase)
   - Provides offline-first capability

2. **Context Layer**: In-memory React state
   - ProductContext: Active product list with real-time updates
   - CartContext: Shopping cart with session persistence
   - WishlistContext: Saved items list
   - ConfigContext: Application configuration (pack defaults, pricing rules)

**Data Synchronization:**
- Products loaded from static data files (catalogueData.js, bundles.js) on initial load
- Admin changes update both IndexedDB and server via API
- Image associations managed separately with type-based retrieval
- Cart persists to sessionStorage on every change

### API Architecture

**RESTful Endpoints:**
- GET /api/products - List all products with images
- GET /api/products/:sku - Get single product with images
- PUT /api/products/:sku - Update product
- DELETE /api/products/:sku - Delete product
- POST /api/products/:sku/images - Upload images
- DELETE /api/products/:sku/images - Delete all images
- DELETE /api/products/:sku/images/:type - Delete specific image type

**Request/Response Flow:**
1. Client makes request via apiService or TanStack Query
2. Express routes handle business logic
3. Storage layer abstracts database operations
4. Drizzle ORM executes type-safe queries
5. Response includes joined data (products + images)

**Error Handling:**
- Try-catch blocks with descriptive error messages
- HTTP status codes (404 for not found, 500 for server errors)
- Client-side toast notifications for user feedback

### Frontend Architecture

**Component Organization:**
- **UI Components**: Shadcn/ui library (buttons, cards, dialogs, etc.)
- **Layout Components**: Header, Footer, navigation
- **Feature Components**: Product cards, cart drawer, filters, admin panels
- **Page Components**: Home, Catalogue, Bundles, Promotions, Wishlist, Admin

**Routing Strategy:**
- Wouter for lightweight client-side routing
- Nested routes for admin panel (/admin/*)
- 404 handling with NotFound component

**Styling Approach:**
- Tailwind CSS with custom CSS variables for theming
- Luxury brand color palette (tobacco browns, golds, creams)
- Custom fonts: Playfair Display (serif headings), Inter (sans-serif body)
- Responsive design with mobile-first breakpoints
- Hover and active state utilities (hover-elevate, active-elevate-2)

### Key Features

**Product Display:**
- Format-specific images (principale, solo, pack, boite)
- Badge system for awards (COTY, Top 25, ratings)
- Dynamic pricing based on format selection
- Vitole/format conditional rendering logic
- Origin display without duplication

**Shopping Experience:**
- Multi-format purchasing (unitaire, pack, boite)
- Real-time cart updates with drawer UI
- WhatsApp checkout integration
- Promotion pricing calculations
- Bundle composition display

**Admin Capabilities:**
- Product CRUD operations
- Image upload and association by type
- Bulk import via data files
- Real-time preview of changes

### Build & Deployment

**Development:**
- `npm run dev` - Starts Vite dev server on port 5000
- Hot module replacement enabled
- Vite middleware integrated with Express
- TypeScript compilation checking

**Production:**
- `npm run build` - Builds both client (Vite) and server (esbuild)
- Client output: dist/public
- Server output: dist/index.cjs (bundled, external dependencies listed)
- `npm start` - Runs production server

**Build Optimization:**
- Server dependencies bundled to reduce syscalls (cold start optimization)
- Allowlist for bundling specific heavy dependencies
- Source maps for debugging
- Asset optimization via Vite

## External Dependencies

**Database:**
- Neon Serverless PostgreSQL (DATABASE_URL environment variable required)
- WebSocket-based connection pooling

**Third-Party Services:**
- WhatsApp Business API (phone: 237675784830) for order processing
- Image hosting (URLs stored in database, actual storage not specified)

**Development Tools:**
- Replit-specific plugins (cartographer, dev-banner, runtime-error-modal)
- ESBuild for server bundling
- Drizzle Kit for migrations

**Key NPM Packages:**
- @neondatabase/serverless - Database driver
- drizzle-orm & drizzle-zod - ORM and validation
- @tanstack/react-query - Server state management
- @radix-ui/* - Accessible UI primitives
- express & related middleware
- react-day-picker - Date selection
- nanoid - ID generation
- date-fns - Date utilities

**Configuration Requirements:**
- DATABASE_URL must be set (throws error if missing)
- Drizzle config points to shared/schema.ts
- PostgreSQL dialect specified
- Migration output: ./migrations directory