import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Pensum from './pages/Pensum';
import Subjects from './pages/Subjects';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import AdminCareers from './pages/AdminCareers';
import AdminSubjects from './pages/AdminSubjects';
import './App.css';

// Protected Route wrapper
const ProtectedRoute = ({ children, adminOnly = false }) => {
    const { isAuthenticated, isAdmin, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (adminOnly && !isAdmin) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Layout>{children}</Layout>;
};

// Public Route wrapper
const PublicRoute = ({ children }) => {
    const { isAuthenticated, isAdmin, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (isAuthenticated) {
        return <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />;
    }

    return children;
};

function AppRoutes() {
    return (
        <Routes>
            {/* Public routes */}
            <Route
                path="/login"
                element={
                    <PublicRoute>
                        <Login />
                    </PublicRoute>
                }
            />
            <Route
                path="/register"
                element={
                    <PublicRoute>
                        <Register />
                    </PublicRoute>
                }
            />

            {/* Protected routes */}
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/pensum"
                element={
                    <ProtectedRoute>
                        <Pensum />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/subjects"
                element={
                    <ProtectedRoute>
                        <Subjects />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/profile"
                element={
                    <ProtectedRoute>
                        <Profile />
                    </ProtectedRoute>
                }
            />

            {/* Admin routes */}
            <Route
                path="/admin"
                element={
                    <ProtectedRoute adminOnly>
                        <Admin />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/universities/:universityId"
                element={
                    <ProtectedRoute adminOnly>
                        <AdminCareers />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/careers/:careerId/subjects"
                element={
                    <ProtectedRoute adminOnly>
                        <AdminSubjects />
                    </ProtectedRoute>
                }
            />

            {/* Redirect root */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Catch all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}

function App() {
    return (
        <BrowserRouter>
            <ThemeProvider>
                <AuthProvider>
                    <AppRoutes />
                </AuthProvider>
            </ThemeProvider>
        </BrowserRouter>
    );
}

export default App;
