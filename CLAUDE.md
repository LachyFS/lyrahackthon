# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `pnpm run dev` - Start the Next.js development server (port 3000)
- `pnpm run build` - Build the production application
- `pnpm run start` - Start the production server
- `pnpm run lint` - Run ESLint

### Package Management
The project supports pnpm, yarn, pnpm, or bun for package management.

## Architecture

This is a Next.js 16 application using the App Router with TypeScript and Tailwind CSS v4.

### Key Technologies
- **Framework**: Next.js 16.0.8 with App Router
- **UI Components**: Radix UI primitives with custom components in `components/ui/`
- **Styling**: Tailwind CSS v4 with PostCSS
- **Forms**: react-hook-form with Zod validation
- **Utilities**: 
  - `lib/utils.ts` - Contains `cn()` utility for className merging using clsx and tailwind-merge
  - Path alias `@/*` maps to the project root

### Project Structure
- `app/` - Next.js App Router pages and layouts
- `components/ui/` - Reusable UI components built on Radix UI primitives
- `hooks/` - Custom React hooks
- `lib/` - Utility functions and shared code

### TypeScript Configuration
- Strict mode enabled
- Module resolution: bundler
- Path alias: `@/*` for root imports