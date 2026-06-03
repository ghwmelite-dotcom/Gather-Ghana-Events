import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import { Spinner } from '../lib/icons.jsx'

/** Gates portal routes. Shows a loader while the session resolves. */
export default function ProtectedRoute({ children }) {
  const { client, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center text-plum">
        <Spinner size={32} />
      </div>
    )
  }
  if (!client) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}
