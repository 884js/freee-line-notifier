# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

freee-line-notifier is a serverless application that integrates freee API (Japanese accounting software) with LINE Messaging API to send financial notifications. It runs on Cloudflare Workers/Pages using the HonoX framework with React for SSR.

## Architecture

- **Monorepo structure** using pnpm workspaces
  - `apps/server`: Main HonoX application (Cloudflare Pages)
  - `apps/worker`: Background worker for scheduled tasks (Cloudflare Workers)
  - `packages/external-api`: Shared API clients for freee and LINE
  - `packages/prisma`: Database ORM configuration

- **Key technologies**:
  - Runtime: Cloudflare Workers (edge runtime)
  - Backend: HonoX (Hono with React SSR)
  - Frontend: React 19 with Mantine UI
  - Database: PostgreSQL with Prisma ORM
  - External APIs: freee API, LINE Messaging API, LINE LIFF

## Development Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev          # Run all apps in parallel
pnpm dev:server   # Server only
pnpm dev:worker   # Worker only

# Database
pnpm db:push      # Push Prisma schema to database
pnpm db:generate  # Generate Prisma client

# Code quality
pnpm lint         # Run Biome linter with auto-fix
pnpm format       # Format code with Biome
pnpm fix          # Run both lint and format

# Build & Deploy
pnpm build        # Build server app
pnpm deploy       # Deploy all apps to Cloudflare
```

## Testing

No test framework is currently configured. When implementing tests, follow TDD principles:
1. Write tests first based on expected behavior
2. Verify tests fail correctly
3. Implement code to pass tests

## Code Structure

### Server App (`apps/server`)
- `routes/`: HonoX routes with file-based routing
  - `_renderer.tsx`: Global layout component
  - `api/`: API endpoints
  - `webhook.ts`: LINE webhook handler
- `islands/`: Interactive React components
- `functions/`: Business logic modules
- `middlewares/`: Hono middleware for auth and data fetching

### Environment Variables
Required environment variables are defined in:
- `apps/server/global.d.ts`: Server environment types
- `apps/worker/global.d.ts`: Worker environment types

Key variables include:
- Database: `DATABASE_URL`
- freee API: `FREEE_CLIENT_ID`, `FREEE_CLIENT_SECRET`
- LINE: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LIFF_ID`

## Important Patterns

1. **Middleware-based data fetching**: Use `companyAuthMiddleware` and `currentUserMiddleware` to fetch user/company data before route handlers
2. **Type-safe environment access**: Use `Bindings` type from `global.d.ts` for environment variables
3. **Edge-compatible code**: Avoid Node.js-specific APIs, use Web APIs instead
4. **Biome for code quality**: Code formatting and linting are handled by Biome (not ESLint/Prettier)