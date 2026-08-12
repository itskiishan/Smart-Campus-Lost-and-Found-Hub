# Smart Campus Lost and Found Hub

[![Next.js](https://img.shields.io/badge/Next.js-15.2-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20pgvector-3ECF8E?logo=supabase)](https://supabase.com/)
[![Transformers.js](https://img.shields.io/badge/AI%2FML-CLIP%20Multimodal%20Embeddings-FF6F61)](https://huggingface.co/docs/transformers.js)

An AI-assisted, centralized campus Lost & Found platform featuring multimodal similarity matching, secure claim workflows, and OTP-verified physical item handovers.

---

## 📌 Overview

### The Problem
Traditional campus lost-and-found management relies heavily on manual physical inquiries, fragmented social media posts, or static bulletin boards. Students who lose items often face long delays, inaccurate item descriptions, and inefficient manual verification procedures.

### The Proposed Solution
The **Smart Campus Lost and Found Hub** solves this problem by providing an automated, centralized digital platform powered by an **AI-Assisted Multimodal Matching Engine**. The system compares newly reported lost items against found item listings across multiple signals—**text semantic description**, **visual image similarity**, **campus location proximity**, and **time difference decay**—to instantly recommend potential candidate matches.

---

## ✨ Key Features

- **Item Reporting**: Report lost or found items with title, description, category, campus location, date/time (`incident_at`), and optional photo upload.
- **AI Multimodal Matching**: Hybrid matching engine ranking opposite-direction candidate reports (`LOST ↔ FOUND`) using text embeddings, vision embeddings, location scoring, and temporal decay.
- **Dynamic Weight Renormalization**: Evaluates candidate matches without penalizing items that lack photos or specific timestamp details.
- **Secure Claim Workflow**: Item owners and claimants can submit claims with text details and photo proof, while reporters can approve or reject claims.
- **Physical Handover & OTP Verification**: Physical holders initiate handover with campus spot selection, generating a secure 6-digit OTP verified in real time before an item transitions to `returned`.
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
     - Different Campus Locations: **`0.00`**

4. **Time Similarity ($S_{\text{time}}$)**:
   - Temporal decay curve calculated from the absolute difference in hours between `incident_at` timestamps:
     - $\le 1$ hour: **`1.00`**
     - $1 - 3$ hours: **`0.85`**
     - $3 - 6$ hours: **`0.70`**
     - $6 - 12$ hours: **`0.50`**
     - $12 - 24$ hours: **`0.30`**
     - $24 - 48$ hours: **`0.10`**
     - $> 48$ hours: **`0.00`**

### Core Matching Rules
- **Opposite Direction Requirement**: `LOST` items are strictly matched against `FOUND` items, and `FOUND` items against `LOST` items (`item_type != target_item_type`).
- **Self Exclusion**: Items cannot match themselves (`id != p_item_id`).
- **Status Filter**: Completed/returned items (`status = 'returned'`) are automatically excluded from candidate pools.
- **Dynamic Renormalization**: If a signal is unavailable (e.g., no photo provided), its weight is excluded and the remaining active weights are scaled so they sum to 100%. Missing data does **not** penalize a candidate item.

---

## 🧮 Matching Formula

$$\text{Raw Score} = (S_{\text{text}} \cdot 0.40) + (S_{\text{image}} \cdot 0.25) + (S_{\text{loc}} \cdot 0.20) + (S_{\text{time}} \cdot 0.15)$$

$$\text{Final Match Score} = \frac{\text{Raw Score}}{\sum \text{Weights of Available Signals}}$$

$$\text{Match Threshold} \ge 0.55 \quad (\text{Top } 5 \text{ Candidates Returned})$$

---

## 🔄 System Workflow

```
[ User Reports Item (Lost/Found) ]
              │
              ▼
[ Generate 512-d CLIP Embeddings (Text & Image) ]
              │
              ▼
[ Hybrid Match RPC (Cosine Vector Distance + Location + Time Decay) ]
              │
              ▼
[ Display AI Match Suggestions on Item Detail Page ]
              │
              ▼
[ User Submits Claim with Proof ] ──► [ Reporter Approves Claim ]
                                                    │
                                                    ▼
                                    [ Physical Handover Initiated ]
                                                    │
                                                    ▼
                                    [ 6-Digit OTP Verification ]
                                                    │
                                                    ▼
                                    [ Status Updated to RETURNED ]
```

---

## 🛠️ Technology Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | Next.js 15.2 (App Router), React 19, TypeScript 5 | Modern, responsive server/client web application |
| **Styling** | Tailwind CSS v4, Vanilla CSS | Glassmorphism UI, custom badges, dark mode theme |
| **Database** | Supabase PostgreSQL 15 | Relational storage with row-level security (RLS) |
| **Vector Search** | PostgreSQL `pgvector` (v0.8.2) | HNSW index (`vector_cosine_ops`) for 512-d vectors |
| **AI/ML Engine** | `@xenova/transformers` (Transformers.js) | Server-side `Xenova/clip-vit-base-patch32` inference |
| **Authentication** | Supabase SSR Auth (`@supabase/ssr`) | Cookie/Bearer token session management |
| **Storage** | Supabase Storage Bucket | Public item image storage and claim proof uploads |

---

## 🗄️ Database Schema Overview

- **`public.lost_items`**: Core reports table containing title, description, category, location, photo URL, status (`lost`, `found`, `claimed`, `returned`), `item_type`, `image_embedding vector(512)`, and `text_embedding vector(512)`.
- **`public.claims`**: Claim submissions linking claimants to item reports with proof message, proof photo, and status (`pending`, `approved`, `rejected`).
- **`public.handovers`**: Physical item handover records managing location spots, preferred times, OTP hashes, and completion timestamps.
- **`public.users`**: Registered campus user profiles (students, admins, super admins).
- **`public.item_custody`**: Admin custody logging when items are placed in college vault storage.

---

## 📁 Project Structure

```
abes-lost-found/
├── src/
│   ├── app/
│   │   ├── admin/             # Admin dashboard & management routes
│   │   ├── api/
│   │   │   ├── embed/         # Server route for CLIP text & image embeddings
│   │   │   └── match/         # Server route for hybrid match RPC invocation
│   │   ├── item/[id]/         # Item detail page & AI match suggestions
│   │   ├── login/             # Authentication login page
│   │   ├── report/            # Item report creation page
│   │   ├── layout.tsx         # Root layout wrapper
│   │   └── page.tsx           # Home page listing lost and found items
│   ├── components/
│   │   ├── AIMatchSuggestions.tsx  # Candidate match cards & breakdown UI
│   │   ├── ClaimModal.tsx          # Claim submission modal
│   │   ├── Header.tsx              # Main navigation header
│   │   └── HandoverCard.tsx        # OTP handover verification UI
│   ├── lib/
│   │   ├── locations.ts        # Campus location vocabulary
│   │   ├── supabase.ts         # Client Supabase configuration
│   │   └── supabase/server.ts  # Server Supabase client creation
│   └── types/
│       └── database.ts         # TypeScript database interfaces & RPC signatures
├── .env.example                # Template for required environment variables
├── next.config.ts              # Next.js configuration
├── package.json                # Dependencies and scripts
├── postcss.config.mjs          # PostCSS styling setup
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
Execute the SQL migration script (found in `src/types/database.ts` or project documentation) in the Supabase SQL Editor to create `image_embedding vector(512)`, `text_embedding vector(512)`, HNSW vector indexes, and `match_hybrid_items` RPC function.

### Step 5: Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Demonstration & Test Scenarios

1. **No-Photo Lost Item Matching**:
   - Report a lost item without uploading a photo (e.g., *"Black Samsung Smartphone"* lost at *"Central Library"*).
   - The system generates a 512-d CLIP text embedding and successfully recommends matching found items based on description, location, and time.
2. **Photo + Text Multimodal Matching**:
   - Report an item with a photo upload.
   - The system generates both 512-d text and vision embeddings, displaying visual match percentages alongside description similarities.
3. **Claim & Physical Handover Workflow**:
   - Submit a claim $\rightarrow$ Approve claim $\rightarrow$ Select handover spot $\rightarrow$ Retrieve 6-digit OTP $\rightarrow$ Verify OTP $\rightarrow$ Item status transitions to `RETURNED`.

---

## 🔬 Limitations & Future Scope

### Current Prototype Limitations
- Image similarity quality depends on photo clarity, lighting, and viewing angles.
- Signal weights (Text 40%, Image 25%, Location 20%, Time 15%) are statically configured.
- Primary testing was conducted on campus-scale datasets.

### Future Scope
- **Automated Weight Optimization**: Machine learning model to dynamically learn feature weights from historical claim approvals.
- **Precision / Recall Benchmark**: Benchmark dataset evaluation for F1-score and Top-K accuracy optimization.
- **Instant Push Notifications**: Automated email/SMS alerts when high-confidence matches ($\ge 85\%$) are detected.

---

## 🎓 Academic Statement

This project was developed as a final year B.Tech Computer Science Engineering project. It demonstrates the practical application of multimodal machine learning, vector database search (`pgvector`), and secure full-stack web architecture in solving real-world campus operational challenges.
