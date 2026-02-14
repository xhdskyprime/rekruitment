import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Status from './pages/Status';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import VerificationPending from './pages/VerificationPending';
import { ConfigProvider, useConfig } from './contexts/ConfigContext';

const AppRoutes = () => {
    const { recruitmentPhase, loading } = useConfig();
    console.log('[AppRoutes] Current phase:', recruitmentPhase, 'Loading:', loading);

    if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

    return (
    <Routes>
      {/* Public Routes based on Phase */}
      <Route path="/" element={
        recruitmentPhase === 'registration' ? <Home /> : 
        recruitmentPhase === 'verification' ? <VerificationPending /> :
        <Navigate to="/status" replace />
      } />
      
      <Route path="/status" element={
        recruitmentPhase === 'announcement' ? <Status /> :
        recruitmentPhase === 'verification' ? <Navigate to="/" replace /> :
        <Navigate to="/" replace /> // In registration phase, status is hidden
      } />

      {/* Admin Routes */}
      <Route path="/portal-rsud-secure-auth" element={<Login />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/admin/dashboard" element={<Dashboard />} />
      <Route path="/admin" element={<Dashboard />} />
    </Routes>
  );
};

function App() {
  return (
    <ConfigProvider>
      <Router>
        <Layout>
          <AppRoutes />
        </Layout>
      </Router>
    </ConfigProvider>
  );
}

export default App;
