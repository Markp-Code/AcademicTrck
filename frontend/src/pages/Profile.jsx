import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { 
    User, Envelope, IdentificationCard, GraduationCap, 
    Trophy, Target, Clock, Pencil, Check
} from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Profile = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [career, setCareer] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [statsRes, careersRes] = await Promise.all([
                axios.get(`${API_URL}/api/dashboard/stats`),
                axios.get(`${API_URL}/api/careers`)
            ]);
            setStats(statsRes.data);
            if (careersRes.data.length > 0) {
                setCareer(careersRes.data[0]);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64" data-testid="profile-loading">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in" data-testid="profile-page">
            {/* Header */}
            <div className="mb-8">
                <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-2">
                    Mi Perfil
                </h1>
                <p className="text-muted-foreground">
                    Información de tu cuenta y progreso académico
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* User Info Card */}
                <Card className="border-border bg-card lg:col-span-1" data-testid="user-info-card">
                    <CardContent className="p-6">
                        {/* Avatar */}
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
                                <span className="font-heading text-4xl font-bold text-white">
                                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                </span>
                            </div>
                            <h2 className="font-heading text-xl font-semibold">{user?.name}</h2>
                            <p className="text-sm text-muted-foreground">Estudiante</p>
                        </div>

                        {/* User Details */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 rounded-md bg-secondary/50">
                                <Envelope size={20} className="text-blue-400" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground">Correo</p>
                                    <p className="text-sm font-medium truncate">{user?.email}</p>
                                </div>
                            </div>

                            {user?.student_id && (
                                <div className="flex items-center gap-3 p-3 rounded-md bg-secondary/50">
                                    <IdentificationCard size={20} className="text-emerald-400" />
                                    <div>
                                        <p className="text-xs text-muted-foreground">Matrícula</p>
                                        <p className="text-sm font-medium font-mono">{user.student_id}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3 p-3 rounded-md bg-secondary/50">
                                <GraduationCap size={20} className="text-purple-400" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Carrera</p>
                                    <p className="text-sm font-medium">{career?.name || 'Ingeniería en Ciberseguridad'}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 rounded-md bg-secondary/50">
                                <Target size={20} className="text-amber-400" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Universidad</p>
                                    <p className="text-sm font-medium">{career?.university || 'Unicaribe'}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Academic Summary */}
                <Card className="border-border bg-card lg:col-span-2" data-testid="academic-summary-card">
                    <CardHeader>
                        <CardTitle className="font-heading text-lg">Resumen Académico</CardTitle>
                        <CardDescription>Tu progreso en la carrera</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* GPA and Honor */}
                        <div className="flex items-center justify-between p-4 rounded-md bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                            <div>
                                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                                    Índice Académico (GPA)
                                </p>
                                <p className="font-mono text-5xl font-light text-foreground mt-1">
                                    {stats?.gpa?.toFixed(2) || '0.00'}
                                </p>
                            </div>
                            {stats?.honor && (
                                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-sm px-3 py-1">
                                    <Trophy size={16} className="mr-2" />
                                    {stats.honor}
                                </Badge>
                            )}
                        </div>

                        {/* Progress Bar */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-muted-foreground">Progreso de la Carrera</span>
                                <span className="font-mono text-sm">{stats?.progress_percentage?.toFixed(1) || 0}%</span>
                            </div>
                            <Progress value={stats?.progress_percentage || 0} className="h-3 bg-secondary" />
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 rounded-md bg-secondary/50 border border-border">
                                <p className="text-xs text-muted-foreground mb-1">Créditos Obtenidos</p>
                                <p className="font-mono text-2xl font-medium">{stats?.credits_earned || 0}</p>
                                <p className="text-xs text-muted-foreground">de {stats?.total_credits || 185}</p>
                            </div>
                            <div className="p-4 rounded-md bg-secondary/50 border border-border">
                                <p className="text-xs text-muted-foreground mb-1">Materias Completadas</p>
                                <p className="font-mono text-2xl font-medium text-emerald-400">{stats?.subjects_completed || 0}</p>
                                <p className="text-xs text-muted-foreground">de 53 materias</p>
                            </div>
                            <div className="p-4 rounded-md bg-secondary/50 border border-border">
                                <p className="text-xs text-muted-foreground mb-1">Cursando Actualmente</p>
                                <p className="font-mono text-2xl font-medium text-amber-400">{stats?.subjects_in_progress || 0}</p>
                                <p className="text-xs text-muted-foreground">materias activas</p>
                            </div>
                            <div className="p-4 rounded-md bg-secondary/50 border border-border">
                                <p className="text-xs text-muted-foreground mb-1">Tiempo Estimado</p>
                                <p className="font-mono text-2xl font-medium text-cyan-400">{stats?.estimated_months_remaining || 0}</p>
                                <p className="text-xs text-muted-foreground">meses restantes</p>
                            </div>
                        </div>

                        {/* Career Info */}
                        {career && (
                            <div className="p-4 rounded-md bg-secondary/30 border border-border">
                                <h3 className="font-heading font-medium mb-3">Información de la Carrera</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-muted-foreground">Total de Créditos</p>
                                        <p className="font-mono font-medium">{career.total_credits}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Duración</p>
                                        <p className="font-mono font-medium">{career.duration_quarters} cuatrimestres</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-muted-foreground">Formato</p>
                                        <p className="font-medium">{career.format}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* GPA Scale Reference */}
            <Card className="border-border bg-card" data-testid="gpa-scale-card">
                <CardHeader>
                    <CardTitle className="font-heading text-lg">Escala de Calificación</CardTitle>
                    <CardDescription>Sistema de puntos GPA de Unicaribe</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-center">
                            <p className="font-mono text-lg font-medium text-emerald-400">4.0</p>
                            <p className="text-sm text-muted-foreground">90-100</p>
                        </div>
                        <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/30 text-center">
                            <p className="font-mono text-lg font-medium text-blue-400">3.0</p>
                            <p className="text-sm text-muted-foreground">80-89</p>
                        </div>
                        <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-center">
                            <p className="font-mono text-lg font-medium text-amber-400">2.0</p>
                            <p className="text-sm text-muted-foreground">70-79</p>
                        </div>
                        <div className="p-3 rounded-md bg-orange-500/10 border border-orange-500/30 text-center">
                            <p className="font-mono text-lg font-medium text-orange-400">1.0</p>
                            <p className="text-sm text-muted-foreground">60-69</p>
                        </div>
                        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-center">
                            <p className="font-mono text-lg font-medium text-red-400">0.0</p>
                            <p className="text-sm text-muted-foreground">0-59</p>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-border">
                        <h4 className="font-heading font-medium mb-3">Honores Académicos</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex items-center gap-3 p-3 rounded-md bg-amber-500/5 border border-amber-500/20">
                                <Trophy size={24} className="text-amber-400" />
                                <div>
                                    <p className="font-medium text-amber-400">Summa Cum Laude</p>
                                    <p className="text-xs text-muted-foreground">GPA ≥ 3.90</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-md bg-gray-500/5 border border-gray-500/20">
                                <Trophy size={24} className="text-gray-300" />
                                <div>
                                    <p className="font-medium text-gray-300">Magna Cum Laude</p>
                                    <p className="text-xs text-muted-foreground">GPA 3.75 - 3.89</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-md bg-orange-500/5 border border-orange-500/20">
                                <Trophy size={24} className="text-orange-400" />
                                <div>
                                    <p className="font-medium text-orange-400">Cum Laude</p>
                                    <p className="text-xs text-muted-foreground">GPA 3.50 - 3.74</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Profile;
