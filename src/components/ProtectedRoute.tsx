import { Navigate, Outlet } from 'react-router-dom';
import { DEMO_MODE, ensureDemoSession } from '../demo/config';

export default function ProtectedRoute() {
  if (DEMO_MODE) {
    ensureDemoSession();
    return <Outlet />;
  }

  const token = localStorage.getItem('kfin_token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
