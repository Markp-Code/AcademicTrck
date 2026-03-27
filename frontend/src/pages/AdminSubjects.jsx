import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ArrowLeft, Plus, Pencil, Trash, BookOpen } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = [
    'Formación General',
    'Matemáticas',
    'Ciencias',
    'Programación',
    'Ingeniería',
    'Tecnología',
    'Seguridad',
    'Redes',
    'Administración',
    'Proyecto',
    'Electiva',
    'Otro'
];

const AdminSubjects = () => {
    const { careerId } = useParams();
    const [career, setCareer] = useState(null);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Subject dialog
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState(null);
    const [form, setForm] = useState({
        code: '',
        name: '',
        credits: 3,
        quarter: 1,
        category: 'Formación General',
        prerequisites: ''
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, [careerId]);

    const fetchData = async () => {
        try {
            const [careerRes, subjectsRes] = await Promise.all([
                axios.get(`${API_URL}/api/careers/${careerId}`),
                axios.get(`${API_URL}/api/subjects?career_id=${careerId}`)
            ]);
            setCareer(careerRes.data);
            setSubjects(subjectsRes.data);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (subject = null) => {
        if (subject) {
            setEditingSubject(subject);
            setForm({
                code: subject.code,
                name: subject.name,
                credits: subject.credits,
                quarter: subject.quarter,
                category: subject.category || 'Formación General',
                prerequisites: (subject.prerequisites || []).join(', ')
            });
        } else {
            setEditingSubject(null);
            setForm({
                code: '',
                name: '',
                credits: 3,
                quarter: 1,
                category: 'Formación General',
                prerequisites: ''
            });
        }
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.code.trim() || !form.name.trim()) return;
        setSaving(true);

        try {
            const prereqs = form.prerequisites
                .split(',')
                .map(p => p.trim())
                .filter(p => p.length > 0);

            const data = {
                code: form.code.trim().toUpperCase(),
                name: form.name.trim(),
                credits: form.credits,
                quarter: form.quarter,
                category: form.category,
                prerequisites: prereqs,
                career_id: careerId
            };

            if (editingSubject) {
                await axios.put(`${API_URL}/api/admin/subjects/${editingSubject.id}`, data);
            } else {
                await axios.post(`${API_URL}/api/admin/subjects`, data);
            }
            await fetchData();
            setDialogOpen(false);
        } catch (error) {
            console.error('Failed to save subject:', error);
            alert(error.response?.data?.detail || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (subject) => {
        if (!window.confirm(`¿Estás seguro de eliminar "${subject.name}"?`)) {
            return;
        }

        try {
            await axios.delete(`${API_URL}/api/admin/subjects/${subject.id}`);
            await fetchData();
        } catch (error) {
            console.error('Failed to delete subject:', error);
        }
    };

    // Group subjects by quarter
    const subjectsByQuarter = {};
    subjects.forEach(s => {
        if (!subjectsByQuarter[s.quarter]) {
            subjectsByQuarter[s.quarter] = [];
        }
        subjectsByQuarter[s.quarter].push(s);
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in" data-testid="admin-subjects-page">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Link to={`/admin/universities/${career?.university_id}`}>
                    <Button variant="ghost" size="icon">
                        <ArrowLeft size={20} />
                    </Button>
                </Link>
                <div>
                    <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">
                        Pensum: {career?.name}
                    </h1>
                    <p className="text-muted-foreground">
                        {subjects.length} materias • {career?.total_credits} créditos totales
                    </p>
                </div>
            </div>

            {/* Add Subject Button */}
            <div className="flex justify-end">
                <Button 
                    className="bg-blue-600 hover:bg-blue-500"
                    onClick={() => handleOpenDialog()}
                    data-testid="add-subject-btn"
                >
                    <Plus size={18} className="mr-2" />
                    Nueva Materia
                </Button>
            </div>

            {/* Subjects by Quarter */}
            {Object.keys(subjectsByQuarter).length === 0 ? (
                <Card className="border-border bg-card">
                    <CardContent className="py-12 text-center text-muted-foreground">
                        No hay materias registradas. Comienza agregando la primera materia.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(subjectsByQuarter)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([quarter, quarterSubjects]) => (
                            <Card key={quarter} className="border-border bg-card">
                                <CardHeader className="pb-3">
                                    <CardTitle className="font-heading text-base flex items-center justify-between">
                                        <span>Cuatrimestre {quarter}</span>
                                        <Badge variant="outline" className="font-mono">
                                            {quarterSubjects.reduce((acc, s) => acc + s.credits, 0)} cr
                                        </Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {quarterSubjects.map(subject => (
                                        <div
                                            key={subject.id}
                                            className="p-3 rounded-sm border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors group"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-mono text-xs text-blue-400 mb-1">
                                                        {subject.code}
                                                    </p>
                                                    <p className="text-sm font-medium line-clamp-2">
                                                        {subject.name}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="text-xs text-muted-foreground">
                                                            {subject.credits} cr
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">•</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {subject.category}
                                                        </span>
                                                    </div>
                                                    {subject.prerequisites?.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {subject.prerequisites.map(prereq => (
                                                                <Badge 
                                                                    key={prereq} 
                                                                    variant="outline" 
                                                                    className="text-xs font-mono"
                                                                >
                                                                    {prereq}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() => handleOpenDialog(subject)}
                                                    >
                                                        <Pencil size={14} />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon"
                                                        className="h-7 w-7 text-red-400 hover:text-red-300"
                                                        onClick={() => handleDelete(subject)}
                                                    >
                                                        <Trash size={14} />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        ))}
                </div>
            )}

            {/* Subject Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-card border-border max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="font-heading">
                            {editingSubject ? 'Editar Materia' : 'Nueva Materia'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Código</Label>
                                <Input
                                    value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                                    placeholder="MAT-101"
                                    className="bg-secondary border-border font-mono uppercase"
                                    data-testid="subject-code-input"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Créditos</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="12"
                                    value={form.credits}
                                    onChange={(e) => setForm({ ...form, credits: parseInt(e.target.value) || 1 })}
                                    className="bg-secondary border-border font-mono"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Cuatrimestre</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="16"
                                    value={form.quarter}
                                    onChange={(e) => setForm({ ...form, quarter: parseInt(e.target.value) || 1 })}
                                    className="bg-secondary border-border font-mono"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Nombre de la Materia</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Matemáticas I"
                                className="bg-secondary border-border"
                                data-testid="subject-name-input"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Categoría</Label>
                            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                                <SelectTrigger className="bg-secondary border-border">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Prerrequisitos (códigos separados por coma)</Label>
                            <Input
                                value={form.prerequisites}
                                onChange={(e) => setForm({ ...form, prerequisites: e.target.value })}
                                placeholder="MAT-100, FIS-100"
                                className="bg-secondary border-border font-mono"
                            />
                            <p className="text-xs text-muted-foreground">
                                Deja vacío si no tiene prerrequisitos
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button 
                            className="bg-blue-600 hover:bg-blue-500"
                            onClick={handleSave}
                            disabled={saving || !form.code.trim() || !form.name.trim()}
                            data-testid="save-subject-btn"
                        >
                            {saving ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AdminSubjects;
