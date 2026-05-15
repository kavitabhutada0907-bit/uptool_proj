# QuoteMachine Frontend

React dashboard for the AI email quoting backend.

---

## 🚀 Local Setup

```bash
# 1. Install deps
npm install

# 2. Create env file
cp .env.example .env.local
# Edit .env.local → set VITE_API_URL to your FastAPI backend URL

# 3. Start dev server
npm run dev
# → http://localhost:5173
```

Your FastAPI backend must be running at `http://localhost:8000`.
The Vite dev proxy forwards `/api/*` requests to it automatically.

---

## 🔌 FastAPI — Required Endpoints

Add these routes to your FastAPI backend:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/mail/fetch` | Trigger email check, returns `{ new_emails: N }` |
| GET  | `/rfqs` | List all RFQs |
| GET  | `/rfqs/{id}` | Single RFQ with items array |
| GET  | `/quotes` | List all quotes |
| GET  | `/quotes/{id}` | Single quote with items array |
| POST | `/quotes/generate/{rfq_id}` | Generate quote from RFQ, returns `{ id }` |
| POST | `/quotes/{id}/send` | Email the quote |
| GET  | `/quotes/{id}/pdf` | Download quote as file |
| GET  | `/parts` | List all parts/pricing |
| POST | `/parts` | Add part `{ name, price }` |
| PUT  | `/parts/{id}` | Update part |
| DELETE | `/parts/{id}` | Delete part |
| GET  | `/stats` | `{ total_rfqs, quotes_sent, pending, grand_total }` |

### CORS — add this to main.py:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://your-app.vercel.app",   # ← replace with real URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## ☁️ Hosting

### Frontend → Vercel (Free)

```bash
# Option A: CLI
npm install -g vercel
npm run build
vercel --prod

# Option B: GitHub Auto-deploy
# Push to GitHub → connect repo on vercel.com → auto-deploys on push
```

In Vercel dashboard → Settings → Environment Variables:
```
VITE_API_URL = https://your-backend.onrender.com
```

### Backend → Render (Free)

1. Push your FastAPI code to GitHub
2. Go to https://render.com → New → Web Service
3. Connect your repo
4. Set:
   - **Environment:** Python 3
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add env vars for your DB credentials under Environment tab

**⚠️ Render free tier spins down after 15min of inactivity.**
Add a `/health` endpoint and use https://uptimerobot.com (free) to ping it every 5min.

```python
@app.get("/health")
def health(): return {"status": "ok"}
```

---

## 📁 Project Structure

```
src/
├── api/client.js          ← all API calls
├── components/
│   ├── Sidebar.jsx
│   └── Toast.jsx
├── pages/
│   ├── Dashboard.jsx
│   ├── RFQList.jsx
│   ├── RFQDetail.jsx
│   ├── Quotes.jsx         ← QuoteList + QuoteDetail
│   ├── Pricing.jsx
│   └── Settings.jsx
├── App.jsx                ← routing
├── main.jsx
└── index.css              ← all styles (CSS variables)
```
