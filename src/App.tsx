import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth, homeRouteForRole } from './hooks/useAuth'
import { ProtectedRoute } from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'

import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'

import DashboardPage from './modules/dashboards/DashboardPage'
import UsersPage from './modules/users/UsersPage'
import TrackedAppsPage from './modules/activities/TrackedAppsPage'
import ActivityHistoryPage from './modules/activities/ActivityHistoryPage'
import ClientsPage from './modules/clients/ClientsPage'
import ProjectsPage from './modules/projects/ProjectsPage'
import TasksPage from './modules/tasks/TasksPage'
import TaskDetailPage from './modules/tasks/TaskDetailPage'
import TimeTrackerPage from './modules/timeTracker/TimeTrackerPage'
import ObligationsPage from './modules/obligations/ObligationsPage'
import NotificationsPage from './modules/notifications/NotificationsPage'
import ReportsPage from './modules/reports/ReportsPage'
import PanelUserPage from './modules/panel_user/PanelUser'

function RootRedirect() {
  const { profile, loading } = useAuth()
  if (loading) return <div className="page-loading">Cargando…</div>
  return <Navigate to={homeRouteForRole(profile?.role)} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/" element={<RootRedirect />} />

          {/* ===== OPERATOR ===== */}
          <Route path="/operator" element={<ProtectedRoute allowedRoles={['OPERATOR']}><AppLayout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="tasks" element={<TasksPage onlyMine />} />
            <Route path="tasks/:taskId" element={<TaskDetailPage />} />
            <Route path="time-tracker" element={<TimeTrackerPage />} />
            <Route path="activities" element={<ActivityHistoryPage />} />
            <Route path="obligations" element={<ObligationsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="panel_user" element={<PanelUserPage />} />
          </Route>

          {/* ===== SUPERVISOR ===== */}
          <Route path="/supervisor" element={<ProtectedRoute allowedRoles={['SUPERVISOR']}><AppLayout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="tasks/:taskId" element={<TaskDetailPage />} />
            <Route path="time-tracker" element={<TimeTrackerPage />} />
            <Route path="activities" element={<ActivityHistoryPage />} />
            <Route path="obligations" element={<ObligationsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          {/* ===== ADMIN (Superusuario + Administrador) ===== */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['SUPERUSER', 'ADMIN']}><AppLayout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="tracked-apps" element={<TrackedAppsPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="tasks/:taskId" element={<TaskDetailPage />} />
            <Route path="time-tracker" element={<TimeTrackerPage />} />
            <Route path="activities" element={<ActivityHistoryPage />} />
            <Route path="obligations" element={<ObligationsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
