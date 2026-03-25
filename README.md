# Keep it Organized — with Supabase Login

A note-taking app with real user accounts and cloud storage,
built with HTML + CSS + JavaScript + Supabase.

---

## Project Structure

```
keep-it-organized/
│
├── index.html              ← Page structure
├── css/
│   └── styles.css          ← All visual styles
├── js/
│   └── app.js              ← All logic (edit this file first with your own database keys if you want to use the app.)
├── supabase-setup.sql      ← Database setup script
└── README.md               ← This file
```

---

## What is Supabase?

Supabase is a free service that gives your app two things:
- **Authentication** — login and signup with email/password
- **Database** — a cloud PostgreSQL database to store notes, folders, etc.

Every user who signs up gets their own private data —
no one can see another user's notes.

---

## Setup Guide (takes about 10 minutes)

### Step 1 — Create a Supabase account

1. Go to [supabase.com](https://supabase.com) and click **Start your project**
2. Sign up with GitHub or email
3. Click **New project**
4. Give it a name (e.g. "keep-it-organized")
5. Set a strong database password (save it somewhere!)
6. Choose a region close to you
7. Click **Create new project** and wait ~1 minute for it to initialize

---

### Step 2 — Set up the database tables

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase-setup.sql` from this project
4. Copy ALL the contents and paste them into the SQL editor
5. Click **Run** (or press Ctrl+Enter)
6. You should see "Success. No rows returned" — that means it worked!

---

### Step 3 — Disable email confirmation (for easier testing)

By default, Supabase sends a confirmation email when someone signs up.
For a demo/class project, it's easier to disable this:

1. In your Supabase dashboard, go to **Authentication** → **Providers**
2. Click on **Email**
3. Toggle **off** the option "Confirm email"
4. Click **Save**

> Note: In a real production app you'd want to keep email confirmation ON.
> For a class demo, turning it off makes testing much easier.

---

### Step 4 — Get your API credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. You'll see two values you need:
   - **Project URL** — looks like `https://abcdefghij.supabase.co`
   - **Project API keys** → **anon / public** — a long string starting with `eyJ...`
3. Copy both values

---

### Step 5 — Add credentials to the code

1. Open `js/app.js` in a text editor
2. Find these two lines near the top (around line 25):

```javascript
const SUPABASE_URL      = 'PASTE_YOUR_PROJECT_URL_HERE';
const SUPABASE_ANON_KEY = 'PASTE_YOUR_ANON_KEY_HERE';
```

3. Replace `PASTE_YOUR_PROJECT_URL_HERE` with your Project URL
4. Replace `PASTE_YOUR_ANON_KEY_HERE` with your anon key

It should look something like this:
```javascript
const SUPABASE_URL      = 'https://abcdefghij.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

5. Save the file

---

### Step 6 — Test locally

1. Open `index.html` in your browser (double-click it)
2. You should see the login page
3. Click "Sign Up", create an account with any email/password
4. You should be logged in and see the app with sample notes!
5. Try creating notes, they'll be saved to your Supabase database

> You can verify this by going to Supabase → **Table Editor** → select the `notes` table

---

### Step 7 — Deploy (go live)

#### Option A — Netlify (recommended, free)
1. Go to [netlify.com](https://netlify.com) and sign up
2. Click **Add new site** → **Deploy manually**
3. Drag the entire project folder onto the page
4. Done! You'll get a URL like `https://your-app.netlify.app`

#### Option B — GitHub Pages
1. Create a GitHub repository and push all files
2. Go to **Settings** → **Pages** → **Source** → select `main` branch
3. Your site will be live at `https://yourusername.github.io/your-repo`

---

## How the code works (for your class)

### Authentication flow
```
User opens app
     ↓
Supabase checks for saved session (cookie/localStorage)
     ↓
Session found?  →  Load user data  →  Show app
     ↓ No
Show login form
     ↓
User submits form  →  Supabase validates  →  Returns session
     ↓
Load user data  →  Show app
```

### Data security (Row Level Security)
The `supabase-setup.sql` file creates "policies" on each table.
These tell the database: **"only return rows where user_id = the logged in user's ID"**.

This means even if someone found your API key, they still couldn't
read another user's notes — the database itself blocks it.

### Why async/await?
When you call `localStorage`, it's instant (in-memory).
When you call Supabase, you're making a request over the internet —
it might take 100ms–500ms. JavaScript uses `async/await` to handle
this without freezing the page.

```javascript
// Synchronous (old localStorage way — instant)
const notes = JSON.parse(localStorage.getItem('notes'));

// Asynchronous (Supabase way — waits for network response)
const { data: notes } = await db.from('notes').select('*');
```

---

## Features

- ✅ Real Sign In / Sign Up (Supabase Auth)
- ✅ Each user has their own private data
- ✅ Works on any device / browser (data syncs via cloud)
- ✅ Create, edit, delete notes with categories
- ✅ Drag categories to reorder them
- ✅ Organize notes in folders (drag & drop)
- ✅ Deadline badges (green / yellow / red / expired)
- ✅ Trash with 30-day auto-cleanup
- ✅ Keyboard shortcut: Ctrl+N to create a note
