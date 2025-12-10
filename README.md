# ObitFinder Pipeline CRM

A modern, interactive Pipeline CRM for managing family outreach built with Next.js, React, TailwindCSS, and Supabase.

## Features

- **📊 Dashboard** - Real-time statistics, conversion rates, and geographic distribution
- **📋 Kanban Pipeline** - Drag-free pipeline with 5 stages (New, Attempted, In Progress, Won, Lost)
- **🔍 Advanced Filters** - Filter by name, CPF, city, state, date range
- **👥 Contact Details** - Full contact info with all relatives of the same deceased
- **🏆 One-Win-Close-All** - Automatically closes all other relatives when one is marked as Won
- **📁 File Uploads** - Upload documents to Supabase Storage
- **📱 Responsive** - Works on desktop and mobile

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **TailwindCSS** - Utility-first CSS
- **shadcn/ui** - Beautiful UI components
- **Supabase** - Backend (PostgreSQL + Storage)
- **Lucide** - Icons

## Authentication

The system uses Supabase Auth with role-based access control.

### Test Account

| Email | Password | Role |
|-------|----------|------|
| `admin@obitfinder.com` | `Admin@123` | Admin |

### User Roles

| Role | Description |
|------|-------------|
| **Admin** | Full system access |
| **Empresa** | Company-level access |
| **Supervisor** | Team supervision access |
| **Operador** | Basic operator access |

## Getting Started

### 1. Install Dependencies

```bash
cd web
npm install
```

### 2. Configure Environment

The `.env.local` file is already configured with your Supabase credentials.

### 3. Run Database Migration

Go to your Supabase Dashboard → SQL Editor and run:

```sql
-- Add pipeline status column
ALTER TABLE contatos
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'New',
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records
UPDATE contatos SET status = 'New' WHERE status IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_contatos_status ON contatos(status);
```

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
web/
├── app/
│   ├── globals.css      # Global styles
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Main page with tabs
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── contact-card.tsx # Pipeline card
│   ├── contact-detail.tsx # Detail modal
│   ├── dashboard.tsx    # Dashboard tab
│   ├── filters.tsx      # Filter panel
│   └── pipeline.tsx     # Kanban board
├── lib/
│   ├── supabase.ts      # Supabase client
│   ├── types.ts         # TypeScript types
│   └── utils.ts         # Utility functions
└── .env.local           # Environment variables
```

## Pipeline Stages

| Stage | Description |
|-------|-------------|
| **New** | Fresh leads, not yet contacted |
| **Attempted** | Contact attempted but no response |
| **In Progress** | Active conversation ongoing |
| **Won** | Successfully converted |
| **Lost** | Did not convert or closed |

## Key Feature: One-Win-Close-All

When you mark a contact as **Won**:
1. The system identifies the deceased (`caso_id`) linked to that contact
2. Finds ALL other relatives linked to the same deceased
3. Automatically marks them as **Lost**
4. Adds a note explaining the auto-closure

This prevents multiple agents from calling the same family after a case is resolved.

## License

Private - ObitFinder © 2024
