# Stage 1: Build the React/Vite frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Build and run the Express backend
FROM node:20-alpine AS app

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm install --omit=dev

COPY backend/ ./

# Copy the built frontend into the location the backend expects:
# backend/src/index.js resolves ../frontend/dist from __dirname (backend/src),
# which means it looks for frontend/dist relative to the backend root (/app).
COPY --from=frontend-builder /frontend/dist ./frontend/dist

EXPOSE 5000

CMD ["node", "src/index.js"]
