# Zeteo - Campus Lost and Found Platform

[![Next.js](https://img.shields.io/badge/Next.js-15.2-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20pgvector-3ECF8E?logo=supabase)](https://supabase.com/)
[![Transformers.js](https://img.shields.io/badge/AI%2FML-CLIP%20Multimodal%20Embeddings-FF6F61)](https://huggingface.co/docs/transformers.js)

An AI-assisted, centralized campus Lost & Found platform featuring multimodal similarity matching, direct item claims, optional report linking, real-time notifications, and OTP-verified physical item handovers.

---

## 🌐 Live Demo

🚀 **Production Web Application**: [https://smart-campus-lost-and-found-hub.vercel.app/](https://smart-campus-lost-and-found-hub.vercel.app/)

Judges and evaluators can interact with the live deployed application, explore reported items, test AI matching suggestions, and walk through the physical item claim and handover workflows.

---

## 📌 Overview

### The Problem
Traditional campus lost-and-found management relies heavily on manual physical inquiries, fragmented social media posts, or static bulletin boards. Students who lose items often face long delays, inaccurate item descriptions, and inefficient manual verification procedures.

### The Proposed Solution
**Zeteo** solves this problem by providing an automated, centralized digital platform powered by an **AI-Assisted Multimodal Matching Engine**. The system compares newly reported lost items against found item listings across multiple signals—**text semantic description**, **visual image similarity**, **campus location proximity**, and **time difference decay**—to instantly recommend potential candidate matches.

---

## ✨ Key Features

- **Item Reporting**: Report lost or found items with title, description, category, campus location, date/time (`incident_at`), and up to 5 multi-image photo uploads.
- **AI Multimodal Matching**: Hybrid matching engine ranking opposite-direction candidate reports (`LOST ↔ FOUND`) using text embeddings, vision embeddings, location scoring, and temporal decay.
- **Dynamic Weight Renormalization**: Evaluates candidate matches without penalizing items that lack photos or specific timestamp details.
- **Direct & Linked Claim Workflows**: Support for direct item claims without requiring a pre-existing report, alongside optional post-submission report linking via secure RPC (`link_claimant_report`).
- **Physical Handover & OTP Verification**: Physical holders initiate handover with campus spot selection, generating a secure 6-digit SHA-256 OTP verified in real time before an item transitions to `returned`.
- **Real-Time Notifications**: Instant updates for claim submissions, approval/rejection events, and handover scheduling.
- **Admin Moderation & Custody**: Admin dashboard for item moderation, user role management, location configuration, and campus custody tracking.

---

## 🧠 How AI Matching Works

The system calculates a dynamic composite similarity score between a target item and candidate items using **four independent signals**:

1. **Text Semantic Similarity ($S_{\text{text}}$)**:
   - Uses OpenAI CLIP text encoder (`Xenova/clip-vit-base-patch32` via `@xenova/transformers`).
   - Generates a **512-dimensional L2-normalized vector** from a structured representation:
     `"Item: {title}. Description: {description}. Category: {category}."`
   - Computes cosine similarity: $1.0 - (\mathbf{v}_{\text{target}} \cdot \mathbf{v}_{\text{candidate}})$.

2. **Visual Image Similarity ($S_{\text{image}}$)**:
   - Uses OpenAI CLIP vision encoder (`Xenova/clip-vit-base-patch32`).
   - Generates a **512-dimensional L2-normalized vector** from uploaded item photographs.
   - Evaluated **only when both target and candidate items have photos**.

3. **Location Similarity ($S_{\text{loc}}$)**:
   - Deterministic matching using normalized campus location strings:
     - Exact Location Match (e.g., `Central Library` = `Central Library`): **`1.00`**
     - Same Building Block (e.g., `Ramanujan Block - Ground Floor` vs `Ramanujan Block - 1st Floor`): **`0.75`**
     - Same General Area: **`0.50`**
     - Different Campus Area: **`0.00`**

4. **Time Difference Decay ($S_{\text{time}}$)**:
   - Exponential decay modeling based on elapsed days ($\Delta t$) between incident timestamps:
     $$S_{\text{time}} = \exp(-\lambda \cdot \Delta t) \quad \text{where } \lambda = 0.05$$

---

## 🔒 Authentication & Security

- **Campus Domain Guard**: User registration is currently restricted to valid campus emails (`@abes.ac.in`) as an intentional security control.
- **Row Level Security (RLS)**: PostgreSQL tables (`lost_items`, `claims`, `handovers`, `notifications`) enforce row-level access control.
- **RPC Encapsulation**: Critical state transitions (`approve_claim`, `verify_handover`, `link_claimant_report`) run as `SECURITY DEFINER` stored procedures.

---

## 📁 Project Structure

```
zeteo/
├── src/
│   ├── app/
│   │   ├── admin/             # Admin dashboard & management routes
│   │   ├── api/
│   │   │   ├── embed/         # Server route for CLIP text & image embeddings
│   │   │   └── match/         # Server route for hybrid match RPC invocation
│   │   ├── item/[id]/         # Item detail page & AI match suggestions
│   │   ├── login/             # Authentication login page
│   │   ├── my-claims/         # User submitted claims tracker
│   │   ├── my-reports/        # User submitted reports tracker
│   │   ├── notifications/     # User notifications page
│   │   ├── profile/           # User account profile
│   │   ├── report/            # Item report creation page
│   │   ├── layout.tsx         # Root layout wrapper
│   │   └── page.tsx           # Home page listing lost and found items
│   ├── components/
│   │   ├── AIMatchSuggestions.tsx  # Candidate match cards & breakdown UI
│   │   ├── ClaimModal.tsx          # Direct & linked claim submission modal
│   │   ├── Header.tsx              # Main navigation header
│   │   ├── HandoverCard.tsx        # OTP handover verification UI
│   │   └── NotificationBell.tsx    # Real-time notification dropdown
│   ├── lib/
│   │   ├── locations.ts        # Campus location vocabulary
│   │   ├── supabase.ts         # Client Supabase configuration
│   │   └── supabase/server.ts  # Server Supabase client creation
│   └── types/
│       └── database.ts         # TypeScript database interfaces & RPC signatures
├── public/                     # Static branding assets (logo.png)
├── .env.example                # Template for required environment variables
├── next.config.ts              # Next.js configuration
├── package.json                # Dependencies and scripts
└── tsconfig.json               # TypeScript configuration
```

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm or yarn package manager
- Supabase project instance with `pgvector` extension enabled

### Step 1: Clone Repository
```bash
git clone https://github.com/itskiishan/Smart-Campus-Lost-and-Found-Hub.git
cd Smart-Campus-Lost-and-Found-Hub
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Create a `.env.local` file in the root directory using `.env.example`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

### Step 4: Run Database Migration
Execute the SQL migration scripts in the Supabase SQL Editor to create tables, `pgvector` indexes, notification triggers, and SECURITY DEFINER RPCs (`match_hybrid_items`, `approve_claim`, `verify_handover`, `link_claimant_report`).

### Step 5: Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Demonstration & Test Scenarios

1. **Direct Item Claim**:
   - Open a lost or found report directly and submit a claim without needing a pre-existing report.
   - Optionally select a matching candidate report to link if a strong match ($\ge 55\%$) is detected.
2. **Photo + Text Multimodal Matching**:
   - Report an item with multi-image upload.
   - System generates 512-d text and vision embeddings, displaying visual match percentages alongside text similarities.
3. **Claim & Physical Handover Workflow**:
   - Submit claim $\rightarrow$ Reporter approves claim $\rightarrow$ Select handover spot $\rightarrow$ Retrieve 6-digit OTP $\rightarrow$ Verify OTP $\rightarrow$ Item status transitions to `RETURNED`.

---

## 🎓 Academic Statement

This project was developed as a final year B.Tech Computer Science Engineering project. It demonstrates the practical application of multimodal machine learning, vector database search (`pgvector`), and secure full-stack web architecture in solving real-world campus operational challenges.
