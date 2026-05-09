import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import AdminLayout from '@/components/layout/AdminLayout'
import LoginPage from '@/pages/auth/LoginPage'
import MFAVerifyPage from '@/pages/auth/MFAVerifyPage'
import DashboardPage from '@/pages/DashboardPage'
import PostsPage from '@/pages/PostsPage'
import PostEditorPage from '@/pages/PostEditorPage'
import CategoriesPage from '@/pages/CategoriesPage'
import TagsPage from '@/pages/TagsPage'
import SubscribersPage from '@/pages/SubscribersPage'
import CommentsPage from '@/pages/CommentsPage'
import MediaPage from '@/pages/MediaPage'
import SettingsPage from '@/pages/SettingsPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center p-8">
      <p className="text-5xl font-bold text-slate-600">404</p>
      <p className="text-slate-400">Page not found</p>
      <Navigate to="/dashboard" replace />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/mfa" element={<MFAVerifyPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="posts" element={<PostsPage />} />
          <Route path="posts/new" element={<PostEditorPage />} />
          <Route path="posts/:id/edit" element={<PostEditorPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="tags" element={<TagsPage />} />
          <Route path="subscribers" element={<SubscribersPage />} />
          <Route path="comments" element={<CommentsPage />} />
          <Route path="media" element={<MediaPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
