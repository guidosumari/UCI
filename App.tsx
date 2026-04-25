
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './screens/Dashboard';
import HandoffForm from './screens/HandoffForm';
import SafetyPanel from './screens/SafetyPanel';
import NewAdmission from './screens/NewAdmission';
import LoginScreen from './screens/LoginScreen';
import InterconsultasScreen from './screens/InterconsultasScreen';
import InterconsultasDashboard from './screens/InterconsultasDashboard';
import UCIAnalysis from './screens/UCIAnalysis';
import AntibioticsScreen from './screens/AntibioticsScreen';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';

const PrivateRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]">
        <span className="size-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/" element={
        <PrivateRoute>
          <Dashboard />
        </PrivateRoute>
      } />
      <Route path="/new-admission" element={
        <PrivateRoute>
          <NewAdmission />
        </PrivateRoute>
      } />
      <Route path="/interconsultas" element={
        <PrivateRoute>
          <InterconsultasScreen />
        </PrivateRoute>
      } />
      <Route path="/interconsultas/dashboard" element={
        <PrivateRoute>
          <InterconsultasDashboard />
        </PrivateRoute>
      } />
      <Route path="/uci-analysis" element={
        <PrivateRoute>
          <UCIAnalysis />
        </PrivateRoute>
      } />
      <Route path="/antibiotics" element={
        <PrivateRoute>
          <AntibioticsScreen />
        </PrivateRoute>
      } />
      <Route path="/handoff/:id" element={
        <PrivateRoute>
          <HandoffForm />
        </PrivateRoute>
      } />
      <Route path="/safety/:id" element={
        <PrivateRoute>
          <ErrorBoundary>
            <SafetyPanel />
          </ErrorBoundary>
        </PrivateRoute>
      } />
    </Routes>
  );
}

const App: React.FC = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <div className="min-h-screen">
          <AppRoutes />
        </div>
      </AuthProvider>
    </HashRouter>
  );
};

export default App;
