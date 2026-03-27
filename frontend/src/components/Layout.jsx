import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { 
    ShieldCheck, 
    House, 
    TreeStructure, 
    ChartBar, 
    User, 
    SignOut,
    List,
    X
} from '@phosphor-icons/react';

const Layout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { path: '/dashboard', icon: House, label: 'Dashboard' },
        { path: '/pensum', icon: TreeStructure, label: 'Pensum' },
        { path: '/subjects', icon: ChartBar, label: 'Materias' },
        { path: '/profile', icon: User, label: 'Perfil' },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <div className="min-h-screen bg-background" data-testid="main-layout">
            {/* Mobile Header */}
            <header className="lg:hidden glass fixed top-0 left-0 right-0 z-50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldCheck weight="duotone" className="w-7 h-7 text-blue-400" />
                    <span className="font-heading font-bold text-lg">Unicaribe</span>
                </div>
                <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    data-testid="mobile-menu-toggle"
                >
                    {sidebarOpen ? <X size={24} /> : <List size={24} />}
                </Button>
            </header>

            {/* Sidebar */}
            <aside 
                className={`fixed top-0 left-0 h-full w-64 bg-card border-r border-border z-40 transform transition-transform duration-300 lg:translate-x-0 ${
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
                data-testid="sidebar"
            >
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <ShieldCheck weight="duotone" className="w-10 h-10 text-blue-400" />
                        <div>
                            <span className="font-heading font-bold text-lg block">Unicaribe</span>
                            <span className="text-xs text-muted-foreground">Academic Tracker</span>
                        </div>
                    </div>

                    <nav className="space-y-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setSidebarOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 ${
                                    isActive(item.path)
                                        ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-400'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                                }`}
                                data-testid={`nav-${item.label.toLowerCase()}`}
                            >
                                <item.icon size={20} weight={isActive(item.path) ? 'fill' : 'regular'} />
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        ))}
                    </nav>
                </div>

                {/* User section */}
                <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-border">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                            <span className="font-heading font-bold text-white">
                                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{user?.name || 'Usuario'}</p>
                            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                        </div>
                    </div>
                    <Button 
                        variant="ghost" 
                        className="w-full justify-start text-muted-foreground hover:text-red-400"
                        onClick={handleLogout}
                        data-testid="logout-button"
                    >
                        <SignOut size={18} className="mr-2" />
                        Cerrar Sesión
                    </Button>
                </div>
            </aside>

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main content */}
            <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
                <div className="p-6 lg:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
