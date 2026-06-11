export interface ProjectTemplate {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly files?: readonly { readonly path: string; readonly content: string }[];
  readonly commands?: readonly string[];
  readonly postMessage?: string;
}

export const PROJECT_TEMPLATES: readonly ProjectTemplate[] = [
  {
    id: "empty",
    name: "Empty Project",
    icon: "📁",
    description: "Blank project with no files",
    tags: [],
  },
  {
    id: "html-css-js",
    name: "HTML/CSS/JS",
    icon: "🌐",
    description: "Basic web page with HTML, CSS, and JavaScript",
    tags: ["HTML", "CSS", "JavaScript"],
    files: [
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Project</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <h1>Hello World</h1>
  <p>Welcome to your new project.</p>
  <script src="script.js"></script>
</body>
</html>`,
      },
      {
        path: "styles.css",
        content: `*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background-color: #1a1a2e;
  color: #e0e0e0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 1rem;
}

h1 {
  color: #61dafb;
}
`,
      },
      {
        path: "script.js",
        content: `console.log('Hello World');

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded');
});
`,
      },
    ],
    postMessage: "Your HTML/CSS/JS project is ready. Open index.html to start editing.",
  },
  {
    id: "nextjs",
    name: "Next.js",
    icon: "▲",
    description: "Full-stack React framework with TypeScript and Tailwind",
    tags: ["React", "TypeScript", "Tailwind"],
    commands: [
      'npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm',
    ],
    postMessage:
      "Your Next.js project is ready. Run 'npm run dev' in the terminal to start the dev server.",
  },
  {
    id: "react-vite",
    name: "React (Vite)",
    icon: "⚛",
    description: "Fast React setup with Vite and TypeScript",
    tags: ["React", "TypeScript", "Vite"],
    commands: ["npm create vite@latest . -- --template react-ts", "npm install"],
    postMessage: "Your React + Vite project is ready. Run 'npm run dev' in the terminal to start.",
  },
  {
    id: "node-api",
    name: "Node.js API",
    icon: "🟢",
    description: "Express server with a basic REST endpoint",
    tags: ["Node.js", "Express", "JavaScript"],
    files: [
      {
        path: "package.json",
        content: JSON.stringify(
          {
            name: "node-api",
            version: "1.0.0",
            description: "Basic Express API server",
            main: "src/index.js",
            scripts: {
              start: "node src/index.js",
              dev: "node --watch src/index.js",
            },
            dependencies: {
              express: "^4.18.2",
            },
          },
          null,
          2,
        ),
      },
      {
        path: "src/index.js",
        content: `const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Express!' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});
`,
      },
      {
        path: ".gitignore",
        content: `node_modules
.env
dist
`,
      },
    ],
    postMessage: "Your Node.js API is ready. Run 'npm install' then 'npm run dev' in the terminal.",
  },
  {
    id: "python",
    name: "Python",
    icon: "🐍",
    description: "FastAPI server with uvicorn",
    tags: ["Python", "FastAPI"],
    files: [
      {
        path: "main.py",
        content: `from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def read_root():
    return {"message": "Hello from FastAPI!"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
`,
      },
      {
        path: "requirements.txt",
        content: `fastapi>=0.104.0
uvicorn>=0.24.0
`,
      },
    ],
    postMessage:
      "Your Python project is ready. Run 'pip install -r requirements.txt' then 'python main.py'.",
  },
  {
    id: "static-site",
    name: "Static Site",
    icon: "📄",
    description: "Multi-page static website with shared styles",
    tags: ["HTML", "CSS", "Multi-page"],
    files: [
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Home</title>
  <link rel="stylesheet" href="styles/main.css">
</head>
<body>
  <nav>
    <a href="index.html" class="active">Home</a>
    <a href="about.html">About</a>
  </nav>
  <main>
    <h1>Welcome</h1>
    <p>This is your static site. Edit these files to get started.</p>
  </main>
  <script src="js/main.js"></script>
</body>
</html>`,
      },
      {
        path: "about.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About</title>
  <link rel="stylesheet" href="styles/main.css">
</head>
<body>
  <nav>
    <a href="index.html">Home</a>
    <a href="about.html" class="active">About</a>
  </nav>
  <main>
    <h1>About</h1>
    <p>Tell visitors about your project here.</p>
  </main>
  <script src="js/main.js"></script>
</body>
</html>`,
      },
      {
        path: "styles/main.css",
        content: `*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background-color: #1a1a2e;
  color: #e0e0e0;
  min-height: 100vh;
}

nav {
  display: flex;
  gap: 1rem;
  padding: 1rem 2rem;
  background-color: #16213e;
  border-bottom: 1px solid #0f3460;
}

nav a {
  color: #a0a0a0;
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

nav a:hover,
nav a.active {
  color: #61dafb;
}

main {
  max-width: 800px;
  margin: 2rem auto;
  padding: 0 2rem;
}

h1 {
  color: #61dafb;
  margin-bottom: 1rem;
}
`,
      },
      {
        path: "js/main.js",
        content: `console.log('Static site loaded');

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready');
});
`,
      },
    ],
    postMessage: "Your static site is ready. Open index.html to start editing.",
  },
];

const ADJECTIVES = [
  "swift",
  "bright",
  "cool",
  "bold",
  "calm",
  "keen",
  "neat",
  "warm",
  "fair",
  "pure",
  "sage",
  "wise",
  "glad",
  "able",
  "true",
  "kind",
];

const NOUNS = [
  "fox",
  "owl",
  "elk",
  "jay",
  "bee",
  "oak",
  "gem",
  "star",
  "wave",
  "leaf",
  "dawn",
  "dusk",
  "peak",
  "vale",
  "reef",
  "cove",
];

export function generateProjectName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}-${noun}-${num}`;
}
