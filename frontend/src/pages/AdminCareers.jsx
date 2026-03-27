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
import { 
    ArrowLeft, Plus, Pencil, Trash, ArrowRight, GraduationCap
} from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminCareers = () => {
    const { universityId } = useParams();
    const [university, setUniversity] = useState(null);
    const [careers, setCareers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Career dialog
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingCareer, setEditingCareer] = useState(null);
    const [form, setForm] = useState({
        name: '',
        total_credits: 180,
        duration_quarters: 12,
        format: 'Cuatrimestral'
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, [universityId]);

    const fetchData = async () => {
        try {
            const [uniRes, careersRes] = await Promise.all([
                axios.get(`${API_URL}/api/universities/${universityId}`),
                axios.get(`${API_URL}/api/careers?university_id=${universityId}`)
            ]);
            setUniversity(uniRes.data);
            setCareers(careersRes.data);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (career = null) => {
        if (career) {
            setEditingCareer(career);
            setForm({
                name: career.name,
                total_credits: career.total_credits,
                duration_quarters: career.duration_quarters,
                format: career.format
            });
        } else {
            setEditingCareer(null);
            setForm({
                name: '',
                total_credits: 180,
                duration_quarters: 12,
                format: 'Cuatrimestral'
            });
        }
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) return;
        setSaving(true);

        try {
            const data = { ...form, university_id: universityId };
            if (editingCareer) {
                await axios.put(`${API_URL}/api/admin/careers/${editingCareer.id}`, data);
            } else {
                await axios.post(`${API_URL}/api/admin/careers`, data);
            }
            await fetchData();
            setDialogOpen(false);
        } catch (error) {
            console.error('Failed to save career:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (career) => {
        if (!window.confirm(`¿Estás seguro de eliminar "${career.name}"? Esto eliminará todas las materias asociadas.`)) {
            return;
        }

        try {
            await axios.delete(`${API_URL}/api/admin/careers/${career.id}`);
            await fetchData();
        } catch (error) {
            console.error('Failed to delete career:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in" data-testid="admin-careers-page">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Link to="/admin">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft size={20} />
                    </Button>
                </Link>
                <div>
                    <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">
                        {university?.name}
                    </h1>
                    <p className="text-muted-foreground">
                        Gestiona las carreras de esta universidad
                    </p>
                </div>
            </div>

            {/* Careers Section */}
            <Card className="border-border bg-card">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="font-heading text-lg">Carreras</CardTitle>
                        <CardDescription>{careers.length} carreras registradas</CardDescription>
                    </div>
                    <Button 
                        className="bg-blue-600 hover:bg-blue-500"
                        onClick={() => handleOpenDialog()}
                        data-testid="add-career-btn"
                    >
                        <Plus size={18} className="mr-2" />
                        Nueva Carrera
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border">
                                <TableHead>Carrera</TableHead>
                                <TableHead className="text-center">Créditos</TableHead>
                                <TableHead className="text-center">Duración</TableHead>
                                <TableHead>Formato</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {careers.map(career => (
                                <TableRow key={career.id} className="border-border">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded bg-emerald-500/10">
                                                <GraduationCap size={18} className="text-emerald-400" />
                                            </div>
                                            <span className="font-medium">{career.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="font-mono">
                                            {career.total_credits} cr
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center text-muted-foreground">
                                        {career.duration_quarters} cuatrimestres
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {career.format}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link to={`/admin/careers/${career.id}/subjects`}>
                                                <Button variant="ghost" size="sm" className="text-blue-400">
                                                    <ArrowRight size={16} className="mr-1" />
                                                    Ver Pensum
                                                </Button>
                                            </Link>
                                            <Button 
                                                variant="ghost" 
                                                size="icon"
                                                onClick={() => handleOpenDialog(career)}
                                            >
                                                <Pencil size={16} />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon"
                                                className="text-red-400 hover:text-red-300"
                                                onClick={() => handleDelete(career)}
                                            >
                                                <Trash size={16} />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {careers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                        No hay carreras registradas
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Career Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading">
                            {editingCareer ? 'Editar Carrera' : 'Nueva Carrera'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nombre de la Carrera</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Ingeniería en Sistemas"
                                className="bg-secondary border-border"
                                data-testid="career-name-input"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Total de Créditos</Label>
                                <Input
                                    type="number"
                                    value={form.total_credits}
                                    onChange={(e) => setForm({ ...form, total_credits: parseInt(e.target.value) || 0 })}
                                    className="bg-secondary border-border font-mono"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Duración (cuatrimestres)</Label>
                                <Input
                                    type="number"
                                    value={form.duration_quarters}
                                    onChange={(e) => setForm({ ...form, duration_quarters: parseInt(e.target.value) || 0 })}
                                    className="bg-secondary border-border font-mono"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Formato</Label>
                            <Input
                                value={form.format}
                                onChange={(e) => setForm({ ...form, format: e.target.value })}
                                placeholder="Cuatrimestral"
                                className="bg-secondary border-border"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button 
                            className="bg-blue-600 hover:bg-blue-500"
                            onClick={handleSave}
                            disabled={saving || !form.name.trim()}
                            data-testid="save-career-btn"
                        >
                            {saving ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AdminCareers;
