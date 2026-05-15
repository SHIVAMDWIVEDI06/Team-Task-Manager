# Team Task Manager - Full-Stack Coding Assignment

A professional, high-performance Team Task Management application built with **Node.js**, **PostgreSQL**, and **React**. Designed to help teams collaborate, assign tasks, and track progress with real-time analytics.

## 🚀 Live Demo
- **URL:** [Insert Railway URL here]
- **Admin Login:** `admin@example.com` / `password123` (or create your own)

## ✨ Features

### 1. User Authentication
- Secure **JWT-based** authentication.
- Signup with name, email, and password.
- Protected routes and session management.

### 2. Project Management
- Create projects (creator automatically becomes **Project Admin**).
- Admins can **add/remove members** from their projects.
- Dashboard overview of all projects.

### 3. Task Management (Visual Kanban)
- **Visual Board:** Three columns: *To Do*, *In Progress*, and *Done*.
- **Task Cards:** Displays title, assignee, and color-coded priority (High, Medium, Low).
- **Interactivity:** Quick Edit modal to update status and due dates instantly.

### 4. Analytical Dashboard
- **Total Tasks Count:** Live tracking of project volume.
- **Completion Rate:** Visual percentage of finished work.
- **Team Workload:** Analytics on tasks per user.
- **Critical Alerts:** Panel for overdue high-priority tasks.

### 5. Role-Based Access Control (RBAC)
- **Admin:** Can create projects, delete projects, manage members, and create/edit any task.
- **Member:** Can view assigned projects and **only view/update tasks assigned to them**.

## 🛠️ Tech Stack
- **Frontend:** React (Vite), Material UI (MUI), Tailwind CSS v4, Framer Motion (Animations).
- **Backend:** Node.js, Express, PostgreSQL (pg).
- **Database:** PostgreSQL with optimized analytical queries (CTEs).
- **Icons:** Lucide React.

## 📦 Setup Instructions

### Backend Setup
1. `cd backend`
2. `npm install`
3. Create a `.env` file:
   ```env
   PORT=5000
   DATABASE_URL=your_postgresql_url
   JWT_SECRET=your_super_secret_key
   ```
4. Run migrations: `npm run setup:db`
5. Start server: `npm run start`

### Frontend Setup
1. `cd frontend`
2. `npm install`
3. Start development: `npm run dev`

## 🚢 Deployment (Railway)
1. Push this repository to GitHub.
2. Connect your repository to **Railway.app**.
3. Add the environment variables (`DATABASE_URL`, `JWT_SECRET`) in the Railway dashboard.
4. Railway will automatically detect the `npm start` script for the backend and `npm run build` for the frontend.

## 🎥 Demo Video
[Link to your 2-5 minute demo video here]

---
Developed as part of a Full-Stack Coding Assignment.
