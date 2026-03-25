Keep it Organized — with Supabase Login

A note-taking app with real user accounts and cloud storage,
built with HTML + CSS + JavaScript + Supabase.

----------------------------------------------------------------

Project Structure

keep-it-organized/
index.html (Main page (HTML))
css/styles.css (All styles (CSS))
js/app.js (All logic (JavaScript))
supabase-setup.sql (Database setup script)
README.md (This file)

----------------------------------------------------------------

What is Supabase?

Supabase is a free backend service that gives you:
- Authentication — login/signup with email and password
- Database — a PostgreSQL database in the cloud

Every user gets their own private data – nobody else can see it.

----------------------------------------------------------------

Setup Guide (10 minutes)

1. Create a Supabase project

   - Go to supabase.com and click "Start your project"
   - Sign up with GitHub or email
   - Click "New project"
   - Name it (e.g. "keep-it-organized")
   - Set a strong database password (save it!)
   - Choose a region close to you
   - Click "Create new project" and wait a minute

2. Set up the database tables

   - In Supabase dashboard, go to "SQL Editor" (left sidebar)
   - Click "New query"
   - Open supabase-setup.sql from this project, copy everything
   - Paste into the SQL editor, click "Run"
   - You should see "Success. No rows returned"

3. Disable email confirmation (optional, makes testing easier)

   By default, Supabase sends a confirmation email when someone signs up.
   For a class demo, you can turn this off:

   - In Supabase, go to "Authentication" → "Providers"
   - Click "Email"
   - Turn off "Confirm email"
   - Click "Save"

   Note: In a real app, you'd keep it on. But for testing, off is easier.

4. Get your API credentials

   - In Supabase, go to "Settings" → "API"
   - Copy two things:
     - Project URL — looks like https://abcdefghij.supabase.co
     - anon / public key — a long string starting with eyJ...

5. Add credentials to the code

   - Open js/app.js in a text editor
   - Find these two lines near the top:

     const SUPABASE_URL      = 'PASTE_YOUR_PROJECT_URL_HERE';
     const SUPABASE_ANON_KEY = 'PASTE_YOUR_ANON_KEY_HERE';

   - Replace them with your Project URL and anon key
   - Save the file

6. Test locally

   - Open index.html in your browser (double-click)
   - You should see the login page
   - Click "Sign Up", create an account
   - You're logged in! Try creating notes – they're saved in Supabase

7. Deploy (go live)

   Option A — Netlify (free, drag-and-drop)
     - Go to netlify.com, sign up
     - Drag your whole project folder onto the page
     - You'll get a URL like https://your-app.netlify.app

   Option B — GitHub Pages
     - Push files to a GitHub repo
     - Settings → Pages → Source → main branch
     - Your site is live at https://yourusername.github.io/your-repo

----------------------------------------------------------------

How the code works

Authentication flow

User opens app >> Supabase checks for saved session (cookie/localStorage) >> Session found? > Load user data > Show app >> Show login form >> User submits form > Supabase validates > Returns session >> Load user data > Show app

Data security (Row Level Security)

The supabase-setup.sql file creates policies on each table.
These tell the database: "only return rows where user_id = the logged-in user's ID".

Even if someone stole your anon key, they still couldn't read other people's notes – the database blocks it.

Why async/await?

When you call localStorage, it's instant.
When you call Supabase, you're making a request over the internet – it can take 100–500ms.
JavaScript uses async/await to wait for the response without freezing the page.

  // Synchronous (localStorage – instant)
  const notes = JSON.parse(localStorage.getItem('notes'));

  // Asynchronous (Supabase – waits for network)
  const { data: notes } = await db.from('notes').select('*');

----------------------------------------------------------------

Features

- Real sign in / sign up with Supabase Auth
- Each user's data is private
- Works on any device – data syncs via cloud
- Create, edit, delete notes with categories
- Drag categories to reorder them
- Organize notes in folders (drag & drop)
- Deadline badges (green / yellow / red / expired)
- Trash with 30‑day auto‑cleanup
- Keyboard shortcut: Ctrl+N to create a note
