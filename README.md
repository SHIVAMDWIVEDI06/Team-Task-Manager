# Team Task Manager

This is a full-stack web application designed for task management within a team.

## Architecture

This repository is structured as a monorepo containing both the frontend and backend codebases.

### Tech Stack
*   **Frontend:** React 19, Vite, Tailwind CSS v4, Material UI (MUI) v6
*   **Backend:** Node.js, Express, PostgreSQL (`pg` driver)

### Folder Structure
```text
TeamTaskManager/
├── frontend/             # React single-page application (Vite)
│   ├── src/              # React source code
│   ├── public/           # Static assets
│   ├── package.json      # Frontend dependencies & scripts
│   └── vite.config.js    # Vite configuration
├── backend/              # Node.js API server
│   ├── src/              # Express backend source code
│   │   ├── index.js      # Server entry point
│   │   └── config/       # Configuration (e.g. database setup)
│   ├── package.json      # Backend dependencies & scripts
│   └── .env              # Environment variables (DB config)
└── README.md             # This architecture document
```

## Getting Started

### Prerequisites
*   Node.js installed
*   PostgreSQL installed and running

### Backend Setup
1.  Navigate to the `backend` directory: `cd backend`
2.  Install dependencies: `npm install`
3.  Ensure your PostgreSQL server is running and matches the `.env` configuration (default: DB `team_task_manager`, user `postgres`, password `your_password`). You may need to create the database manually first:
    ```sql
    CREATE DATABASE team_task_manager;
    ```
4.  Start the development server: `npm run dev`
    *   The backend will run on `http://localhost:5000`

### Frontend Setup
1.  Navigate to the `frontend` directory: `cd frontend`
2.  Install dependencies: `npm install`
3.  Start the development server: `npm run dev`
    *   Vite will start the frontend on `http://localhost:5173` (or similar).

## Environment Variables
The `backend/.env` file controls the database connection. Make sure to update `DB_PASSWORD` or other fields as necessary for your local environment.

```env
PORT=5000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=team_task_manager
DB_PASSWORD=your_password
DB_PORT=5432
```
