import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { 
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend 
} from 'recharts';
import { 
    Trophy, GraduationCap, Target, Clock, ChartLineUp, 
    BookOpen, CheckCircle, CircleDashed, CalendarBlank
} from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/dashboard/stats`);
            setStats(response.data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64" data-testid="dashboard-loading">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="text-center text-muted-foreground py-12">
                Error al cargar estadísticas
            </div>
        );
    }

    const statusData = [
        { name: 'Completadas', value: stats.subjects_completed, color: '#10B981' },
        { name: 'Cursando', value: stats.subjects_in_progress, color: '#F59E0B' },
        { name: 'Planificadas', value: stats.subjects_planned, color: '#3B82F6' },
        { name: 'Pendientes', value: stats.subjects_pending, color: '#4B5563' },
    ];

    const gradeColors = {
        '90-100': '#10B981',
        '80-89': '#3B82F6',
        '70-79': '#F59E0B',
        '60-69': '#F97316',
        '0-59': '#EF4444'
    };

    return (
        <div className="space-y-6 animate-fade-in" data-testid="dashboard">
            {/* Header */}
            <div className="mb-8">
                <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-2">
                    Dashboard
                </h1>
                <p className="text-muted-foreground">
                    Tu progreso en Ingeniería en Ciberseguridad
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* GPA Card */}
                <Card className="border-border bg-card card-hover" data-testid="gpa-card">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
                                    GPA Actual
                                </p>
                                <p className="font-mono text-4xl font-light text-foreground">
                                    {stats.gpa.toFixed(2)}
                                </p>
                                {stats.honor && (
                                    <Badge className="mt-2 bg-amber-500/20 text-amber-400 border-amber-500/30">
                                        <Trophy size={14} className="mr-1" />
                                        {stats.honor}
                                    </Badge>
                                )}
                            </div>
                            <div className="p-3 rounded-md bg-blue-500/10">
                                <ChartLineUp size={24} className="text-blue-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Credits Card */}
                <Card className="border-border bg-card card-hover" data-testid="credits-card">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
                                    Créditos
                                </p>
                                <p className="font-mono text-4xl font-light text-foreground">
                                    {stats.credits_earned}
                                    <span className="text-lg text-muted-foreground">/{stats.total_credits}</span>
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {stats.credits_remaining} restantes
                                </p>
                            </div>
                            <div className="p-3 rounded-md bg-emerald-500/10">
                                <GraduationCap size={24} className="text-emerald-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Progress Card */}
                <Card className="border-border bg-card card-hover" data-testid="progress-card">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
                                    Progreso
                                </p>
                                <p className="font-mono text-4xl font-light text-foreground">
                                    {stats.progress_percentage.toFixed(1)}%
                                </p>
                                <Progress 
                                    value={stats.progress_percentage} 
                                    className="mt-3 h-2 bg-secondary"
                                />
                            </div>
                            <div className="p-3 rounded-md bg-purple-500/10 ml-4">
                                <Target size={24} className="text-purple-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Time Estimate Card */}
                <Card className="border-border bg-card card-hover" data-testid="time-card">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
                                    Tiempo Estimado
                                </p>
                                <p className="font-mono text-4xl font-light text-foreground">
                                    {stats.estimated_months_remaining}
                                    <span className="text-lg text-muted-foreground"> meses</span>
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Para graduarte
                                </p>
                            </div>
                            <div className="p-3 rounded-md bg-cyan-500/10">
                                <Clock size={24} className="text-cyan-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Subject Status Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-emerald-500/20">
                            <CheckCircle size={20} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="font-mono text-2xl font-medium">{stats.subjects_completed}</p>
                            <p className="text-xs text-muted-foreground">Completadas</p>
                        </div>
                    </div>
                </Card>
                <Card className="border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-amber-500/20">
                            <BookOpen size={20} className="text-amber-400" />
                        </div>
                        <div>
                            <p className="font-mono text-2xl font-medium">{stats.subjects_in_progress}</p>
                            <p className="text-xs text-muted-foreground">Cursando</p>
                        </div>
                    </div>
                </Card>
                <Card className="border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-blue-500/20">
                            <CalendarBlank size={20} className="text-blue-400" />
                        </div>
                        <div>
                            <p className="font-mono text-2xl font-medium">{stats.subjects_planned}</p>
                            <p className="text-xs text-muted-foreground">Planificadas</p>
                        </div>
                    </div>
                </Card>
                <Card className="border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-gray-500/20">
                            <CircleDashed size={20} className="text-gray-400" />
                        </div>
                        <div>
                            <p className="font-mono text-2xl font-medium">{stats.subjects_pending}</p>
                            <p className="text-xs text-muted-foreground">Pendientes</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* GPA Evolution */}
                <Card className="border-border bg-card" data-testid="gpa-evolution-chart">
                    <CardHeader>
                        <CardTitle className="font-heading text-lg">Evolución del GPA</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {stats.gpa_by_quarter.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={stats.gpa_by_quarter}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                                    <XAxis 
                                        dataKey="name" 
                                        stroke="#6B7280" 
                                        fontSize={12}
                                        fontFamily="JetBrains Mono"
                                    />
                                    <YAxis 
                                        domain={[0, 4]} 
                                        stroke="#6B7280" 
                                        fontSize={12}
                                        fontFamily="JetBrains Mono"
                                    />
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: '#161B22', 
                                            border: '1px solid #1F2937',
                                            borderRadius: '6px',
                                            fontFamily: 'JetBrains Mono'
                                        }}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="gpa" 
                                        stroke="#3B82F6" 
                                        strokeWidth={2}
                                        dot={{ fill: '#3B82F6', strokeWidth: 2 }}
                                        activeDot={{ r: 6 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-64 flex items-center justify-center text-muted-foreground">
                                Completa materias para ver la evolución
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Grade Distribution */}
                <Card className="border-border bg-card" data-testid="grade-distribution-chart">
                    <CardHeader>
                        <CardTitle className="font-heading text-lg">Distribución de Calificaciones</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={stats.grade_distribution}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                                <XAxis 
                                    dataKey="range" 
                                    stroke="#6B7280" 
                                    fontSize={12}
                                    fontFamily="JetBrains Mono"
                                />
                                <YAxis 
                                    stroke="#6B7280" 
                                    fontSize={12}
                                    fontFamily="JetBrains Mono"
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: '#161B22', 
                                        border: '1px solid #1F2937',
                                        borderRadius: '6px',
                                        fontFamily: 'JetBrains Mono'
                                    }}
                                />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {stats.grade_distribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={gradeColors[entry.range]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Status Distribution Pie */}
                <Card className="border-border bg-card" data-testid="status-pie-chart">
                    <CardHeader>
                        <CardTitle className="font-heading text-lg">Estado de Materias</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: '#161B22', 
                                        border: '1px solid #1F2937',
                                        borderRadius: '6px'
                                    }}
                                />
                                <Legend 
                                    verticalAlign="bottom"
                                    formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* GPA by Category */}
                <Card className="border-border bg-card" data-testid="gpa-category-chart">
                    <CardHeader>
                        <CardTitle className="font-heading text-lg">GPA por Área</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {stats.gpa_by_category.length > 0 ? (
                            <div className="space-y-3">
                                {stats.gpa_by_category.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground truncate flex-1 mr-4">
                                            {item.category}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-blue-500 rounded-full"
                                                    style={{ width: `${(item.gpa / 4) * 100}%` }}
                                                />
                                            </div>
                                            <span className="font-mono text-sm w-10 text-right">
                                                {item.gpa.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                                Completa materias para ver estadísticas
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Available Subjects */}
                <Card className="border-border bg-card" data-testid="available-subjects-card">
                    <CardHeader>
                        <CardTitle className="font-heading text-lg">Próximas Materias Disponibles</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {stats.available_subjects.length > 0 ? (
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                {stats.available_subjects.slice(0, 5).map((subject) => (
                                    <div 
                                        key={subject.id}
                                        className="p-3 rounded-md bg-secondary/50 border border-border hover:border-blue-500/30 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="font-mono text-xs text-blue-400 mb-1">
                                                    {subject.code}
                                                </p>
                                                <p className="text-sm font-medium line-clamp-1">
                                                    {subject.name}
                                                </p>
                                            </div>
                                            <Badge variant="outline" className="ml-2 shrink-0">
                                                {subject.credits} cr
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                                Todas las materias requieren prerrequisitos
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
