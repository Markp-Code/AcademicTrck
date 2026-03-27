import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { 
    MagnifyingGlass, Funnel, CheckCircle, Warning, 
    BookOpen, CalendarBlank, CircleDashed, SortAscending
} from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Subjects = () => {
    const { user } = useAuth();
    const [subjects, setSubjects] = useState([]);
    const [progress, setProgress] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [quarterFilter, setQuarterFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [newGrade, setNewGrade] = useState('');
    const [prerequisiteWarning, setPrerequisiteWarning] = useState(null);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        fetchData();
    }, [user?.career_id]);

    const fetchData = async () => {
        try {
            const careerId = user?.career_id;
            const subjectsUrl = careerId 
                ? `${API_URL}/api/subjects?career_id=${careerId}`
                : `${API_URL}/api/subjects`;
                
            const [subjectsRes, progressRes] = await Promise.all([
                axios.get(subjectsUrl),
                axios.get(`${API_URL}/api/progress`)
            ]);
            setSubjects(subjectsRes.data);
            setProgress(progressRes.data);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getSubjectProgress = (subjectId) => {
        return progress.find(p => p.subject_id === subjectId);
    };

    const handleSubjectClick = (subject) => {
        const prog = getSubjectProgress(subject.id);
        setSelectedSubject(subject);
        setNewStatus(prog?.status || 'pending');
        setNewGrade(prog?.grade?.toString() || '');
        setPrerequisiteWarning(null);
        setDialogOpen(true);
    };

    const handleUpdateProgress = async (override = false) => {
        if (!selectedSubject) return;
        setUpdating(true);

        try {
            const data = {
                subject_id: selectedSubject.id,
                status: newStatus,
                grade: newStatus === 'completed' ? parseFloat(newGrade) : null,
                override_prerequisite: override
            };

            const response = await axios.put(
                `${API_URL}/api/progress/${selectedSubject.id}`,
                data
            );

            if (response.data.error === 'prerequisites_not_met') {
                setPrerequisiteWarning(response.data);
                setUpdating(false);
                return;
            }

            await fetchData();
            setDialogOpen(false);
            setPrerequisiteWarning(null);
        } catch (error) {
            console.error('Failed to update progress:', error);
        } finally {
            setUpdating(false);
        }
    };

    const calculateGpaPoints = (grade) => {
        if (grade >= 90) return 4.0;
        if (grade >= 80) return 3.0;
        if (grade >= 70) return 2.0;
        if (grade >= 60) return 1.0;
        return 0.0;
    };

    // Get unique categories
    const categories = [...new Set(subjects.map(s => s.category))].sort();

    // Filter subjects
    const filteredSubjects = subjects.filter(subject => {
        const prog = getSubjectProgress(subject.id);
        const status = prog?.status || 'pending';

        const matchesSearch = 
            subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            subject.code.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || status === statusFilter;
        const matchesQuarter = quarterFilter === 'all' || subject.quarter === parseInt(quarterFilter);
        const matchesCategory = categoryFilter === 'all' || subject.category === categoryFilter;

        return matchesSearch && matchesStatus && matchesQuarter && matchesCategory;
    });

    // Sort by quarter, then by code
    const sortedSubjects = [...filteredSubjects].sort((a, b) => {
        if (a.quarter !== b.quarter) return a.quarter - b.quarter;
        return a.code.localeCompare(b.code);
    });

    const getStatusBadge = (status) => {
        const statusConfig = {
            completed: { label: 'Completada', className: 'status-completed', icon: CheckCircle },
            in_progress: { label: 'Cursando', className: 'status-in-progress', icon: BookOpen },
            planned: { label: 'Planificada', className: 'status-planned', icon: CalendarBlank },
            pending: { label: 'Pendiente', className: 'status-pending', icon: CircleDashed }
        };
        const config = statusConfig[status] || statusConfig.pending;
        const Icon = config.icon;
        return (
            <Badge className={`${config.className} border`}>
                <Icon size={14} className="mr-1" />
                {config.label}
            </Badge>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64" data-testid="subjects-loading">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6" data-testid="subjects-page">
            {/* Header */}
            <div className="mb-8">
                <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-2">
                    Gestión de Materias
                </h1>
                <p className="text-muted-foreground">
                    {subjects.length} materias • {filteredSubjects.length} mostradas
                </p>
            </div>

            {/* Filters */}
            <Card className="border-border bg-card">
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Search */}
                        <div className="relative lg:col-span-2">
                            <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre o código..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 bg-secondary border-border"
                                data-testid="search-input"
                            />
                        </div>

                        {/* Status Filter */}
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="bg-secondary border-border" data-testid="status-filter">
                                <Funnel size={16} className="mr-2" />
                                <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los estados</SelectItem>
                                <SelectItem value="completed">Completadas</SelectItem>
                                <SelectItem value="in_progress">Cursando</SelectItem>
                                <SelectItem value="planned">Planificadas</SelectItem>
                                <SelectItem value="pending">Pendientes</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Quarter Filter */}
                        <Select value={quarterFilter} onValueChange={setQuarterFilter}>
                            <SelectTrigger className="bg-secondary border-border" data-testid="quarter-filter">
                                <SortAscending size={16} className="mr-2" />
                                <SelectValue placeholder="Cuatrimestre" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los cuatrimestres</SelectItem>
                                {[...Array(12)].map((_, i) => (
                                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                                        Cuatrimestre {i + 1}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Category Filter */}
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="bg-secondary border-border" data-testid="category-filter">
                                <SelectValue placeholder="Categoría" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las categorías</SelectItem>
                                {categories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Subjects Table */}
            <Card className="border-border bg-card">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-border hover:bg-transparent">
                                    <TableHead className="font-mono text-xs uppercase">Código</TableHead>
                                    <TableHead>Materia</TableHead>
                                    <TableHead className="text-center">Cuatri</TableHead>
                                    <TableHead className="text-center">Créditos</TableHead>
                                    <TableHead className="text-center">Calificación</TableHead>
                                    <TableHead className="text-center">GPA</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedSubjects.map(subject => {
                                    const prog = getSubjectProgress(subject.id);
                                    const status = prog?.status || 'pending';
                                    const grade = prog?.grade;
                                    const gpaPoints = grade ? calculateGpaPoints(grade) : null;

                                    return (
                                        <TableRow 
                                            key={subject.id} 
                                            className="border-border cursor-pointer hover:bg-secondary/50"
                                            onClick={() => handleSubjectClick(subject)}
                                            data-testid={`subject-row-${subject.code}`}
                                        >
                                            <TableCell className="font-mono text-blue-400 text-sm">
                                                {subject.code}
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-sm">{subject.name}</p>
                                                    <p className="text-xs text-muted-foreground">{subject.category}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-sm">
                                                {subject.quarter}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-sm">
                                                {subject.credits}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-sm">
                                                {grade !== undefined && grade !== null ? (
                                                    <span className={grade >= 70 ? 'text-emerald-400' : 'text-red-400'}>
                                                        {grade}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-sm">
                                                {gpaPoints !== null ? (
                                                    <span className={gpaPoints >= 3 ? 'text-emerald-400' : gpaPoints >= 2 ? 'text-amber-400' : 'text-red-400'}>
                                                        {gpaPoints.toFixed(1)}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(status)}
                                            </TableCell>
                                            <TableCell>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    className="text-blue-400 hover:text-blue-300"
                                                    data-testid={`edit-${subject.code}`}
                                                >
                                                    Editar
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {filteredSubjects.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    No se encontraron materias con los filtros seleccionados
                </div>
            )}

            {/* Subject Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-card border-border max-w-md" data-testid="subject-edit-dialog">
                    <DialogHeader>
                        <DialogTitle className="font-heading">
                            {selectedSubject?.code} - {selectedSubject?.name}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedSubject?.credits} créditos • Cuatrimestre {selectedSubject?.quarter} • {selectedSubject?.category}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSubject?.prerequisites?.length > 0 && (
                        <div className="py-2">
                            <Label className="text-muted-foreground text-xs">Prerrequisitos:</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {selectedSubject.prerequisites.map(prereq => (
                                    <Badge key={prereq} variant="outline" className="font-mono text-xs">
                                        {prereq}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {prerequisiteWarning && (
                        <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
                            <div className="flex items-start gap-2">
                                <Warning size={20} className="text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm text-amber-400 font-medium">Prerrequisitos no cumplidos</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {prerequisiteWarning.message}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Estado</Label>
                            <Select value={newStatus} onValueChange={setNewStatus}>
                                <SelectTrigger className="bg-secondary border-border">
                                    <SelectValue placeholder="Seleccionar estado" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">Pendiente</SelectItem>
                                    <SelectItem value="planned">Planificada</SelectItem>
                                    <SelectItem value="in_progress">Cursando</SelectItem>
                                    <SelectItem value="completed">Completada</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {newStatus === 'completed' && (
                            <div className="space-y-2">
                                <Label>Calificación (0-100)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={newGrade}
                                    onChange={(e) => setNewGrade(e.target.value)}
                                    className="bg-secondary border-border font-mono"
                                    placeholder="85"
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        {prerequisiteWarning ? (
                            <>
                                <Button variant="outline" onClick={() => setPrerequisiteWarning(null)}>
                                    Cancelar
                                </Button>
                                <Button 
                                    className="bg-amber-600 hover:bg-amber-500"
                                    onClick={() => handleUpdateProgress(true)}
                                    disabled={updating}
                                >
                                    Continuar de todos modos
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button 
                                    className="bg-blue-600 hover:bg-blue-500"
                                    onClick={() => handleUpdateProgress(false)}
                                    disabled={updating || (newStatus === 'completed' && (!newGrade || parseFloat(newGrade) < 0 || parseFloat(newGrade) > 100))}
                                >
                                    <CheckCircle size={18} className="mr-2" />
                                    Guardar
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Subjects;
