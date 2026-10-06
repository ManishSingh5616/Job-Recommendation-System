import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Assistant from './pages/Assistant.jsx';
import AuthPage from './pages/AuthPage.jsx';
import ResumeJobs from './pages/ResumeJobs.jsx';
import SkillGap from './pages/SkillGap.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-full items-center justify-center text-teal-700"><Spinner className="h-6 w-6" /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<ResumeJobs />} />
        <Route path="skill-gap" element={<SkillGap />} />
        <Route path="assistant" element={<Assistant />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
