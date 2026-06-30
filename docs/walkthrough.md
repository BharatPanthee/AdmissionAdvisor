# AI Admissions Advisor (Astra) - Walkthrough

This document outlines the completed implementation of the AI Admissions Advisor (Astra). We successfully set up the backend database model, implemented full-stack logic, added advanced advisor features, and executed automated validations.

---

## 🛠️ Features Implemented

### 1. Database & Seeding (SQLite + Prisma 6)
- Configured a local SQLite database using **Prisma 6** to ensure zero-setup execution.
- Configured a database seed script that populates the `ProjectDB` with **15 diverse curated project ideas** across STEM, environment, business, humanities, and arts.
- Generated the database schema models representing Users, Profiles, Profile Drafts, User Projects, Milestones, Tasks, and Reflection Logs.
- **Upgraded**: Added `ChatMessage` schema table to store conversation logs, `alignmentScoreDetails` on `UserProject` to store compiled advisor report cards, and `mediaLinks` on `ReflectionLog` to store attachments.

### 2. Resumable Profile Wizard Form
- Developed a 4-step wizard form capturing academic subjects, university goals, skills, interests, and activities.
- Implemented **debounced auto-saving** to save the form state as a draft in the database periodically.
- Created a **session restoration popup toast** notifying users of existing draft profiles upon page reload to prevent data loss.

### 3. AI-Assisted Project Suggestion & Customization
- Built the backend API that feeds profile attributes and curated projects into the **Google Gemini API** (`gemini-2.5-flash`).
- Returns **1-3 ranked project suggestions** with customized reasoning explaining university portfolio benefits.
- Integrated a project customization view displaying **2-3 AI-generated execution pathways** per project.

### 4. Interactive AI Advisor Chat (Phase 7 & 8)
- Added an **Advisor Assistant Chat Sidebar** inside the active project dashboard.
- Enables students to converse with Astra regarding their milestones, technical roadblocks, or presentation strategies.
- Contextualizes conversation history (up to last 15 messages) to provide cohesive responses.

### 5. Media Attachments & Proof of Work (Phase 7 & 8)
- Upgraded the milestone reflection form to support **Rich Media & Attachment links** (e.g. GitHub repos, Google Drive folders, YouTube mockups).
- Renders links as custom badges under active milestone logs and embeds clickable links inside the final portfolio.

### 6. University Admissions Alignment Score (Phase 7 & 8)
- Completing a project queries Gemini to compile a **Target University Alignment Score**.
- Matches student execution logs to university admission rubrics and outputs:
  - **Match Score (Percentage)**
  - **Core Strengths Highlighted**
  - **Value Alignment Analysis**
  - **Portfolio Description Recommendations** (Common App bullet advice)

### 7. Cost-Management & Security Upgrades
- Configured backend dynamic client key override. Users can paste their own Google Gemini API key via the **Settings Modal** to bypass server costs.
- Installed `express-rate-limit` restricting endpoints to prevent spamming.

---

## 📸 Visual Demos

Here is the complete end-to-end user experience of Astra captured during validation.

### End-to-End Walkthrough Video
The recording below demonstrates Google Sign-In simulation, completing the Profile Wizard, receiving ranked suggestions, customizing execution pathways, completing tasks, logging reflections, and generating the printable report:

![Astra Walkthrough Video](/Users/bharatpanthee/.gemini/antigravity-ide/brain/08d9ead5-7c2a-45ee-8276-0bb618c1bc2f/astra_full_flow_1782778661691.webp)

---

### Step-by-Step UI Screenshots

````carousel
![Landing Page](/Users/bharatpanthee/.gemini/antigravity-ide/brain/08d9ead5-7c2a-45ee-8276-0bb618c1bc2f/landing_page_1782778672556.png)
Landing Page (OAuth login entrance)
<!-- slide -->
![Suggestions Screen](/Users/bharatpanthee/.gemini/antigravity-ide/brain/08d9ead5-7c2a-45ee-8276-0bb618c1bc2f/suggestions_page_1782778900298.png)
AI-Assisted Suggestions & Pathway Selection
<!-- slide -->
![Timeline Roadmap Page](/Users/bharatpanthee/.gemini/antigravity-ide/brain/08d9ead5-7c2a-45ee-8276-0bb618c1bc2f/roadmap_page_1782778954119.png)
Interactive Milestones Roadmap & Tasks Tracker
<!-- slide -->
![Portfolio Report](/Users/bharatpanthee/.gemini/antigravity-ide/brain/08d9ead5-7c2a-45ee-8276-0bb618c1bc2f/portfolio_report_1782779279615.png)
Final Printable Portfolio Report & University Score Card
````

---

## 🔬 Verification & Validation

The system was verified end-to-end using automated integration tests and browser reviews:
1. **Frontend Hot-Reloading**: Running on `http://localhost:5174/`.
2. **Backend Responsiveness**: Active on port `5050` with SQLite db pushing.
3. **Billing Integration Test Suite (`billing_test.js`)**: Verified the hybrid credit system end-to-end:
   - Registration grants **5.0 default free credits**.
   - Suggestions fetch deducts exactly **1.0 credit**.
   - Selecting a project roadmap deducts exactly **1.0 credit**.
   - Sending chat messages deducts **0.1 credit**.
   - Completing a project and generating University Alignment scoring deducts **2.0 credits**.
   - Out of Credits successfully triggers **HTTP 402 Insufficient Credits** response when requesting operations below balance.
   - Mock Stripe Top-Ups and subscription upgrades dynamically add credits and update tier flags.
4. **Rate Limiting & Cost Management**: Successfully verified rate limits and settings key overrides.

