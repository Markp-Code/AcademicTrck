import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { 
    Buildings, GraduationCap, BookOpen, Users, Plus, 
    Pencil, Trash, ArrowRight
} from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Admin = () => {
    const [stats, setStats] = useState({ universities: 0, careers: 0, subjects: 0, users: 0 });
    const [universities, setUniversities] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // University dialog
    const [uniDialogOpen, setUniDialogOpen] = useState(false);
    const [editingUni, setEditingUni] = useState(null);
    const [uniForm, setUniForm] = useState({ name: '', country: 'República Dominicana' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [statsRes, unisRes] = await Promise.all([
                axios.get(`${API_URL}/api/admin/stats`),
                axios.get(`${API_URL}/api/universities`)
            ]);
            setStats(statsRes.data);
            setUniversities(unisRes.data);
        } catch (error) {
            console.error('Failed to fetch admin data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenUniDialog = (uni = null) => {
        if (uni) {
            setEditingUni(uni);
            setUniForm({ name: uni.name, country: uni.country || 'República Dominicana' });
        } else {
            setEditingUni(null);
            setUniForm({ name: '', country: 'República Dominicana' });
        }
        setUniDialogOpen(true);
    };

    const handleSaveUniversity = async () => {
        if (!uniForm.name.trim()) return;
        setSaving(true);

        try {
            if (editingUni) {
                await axios.put(`${API_URL}/api/admin/universities/${editingUni.id}`, uniForm);
            } else {
                await axios.post(`${API_URL}/api/admin/universities`, uniForm);
            }
            await fetchData();
            setUniDialogOpen(false);
        } catch (error) {
            console.error('Failed to save university:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUniversity = async (uni) => {
        if (!window.confirm(`¿Estás seguro de eliminar "${uni.name}"? Esto eliminará todas las carreras y materias asociadas.`)) {
            return;
        }

        try {
            await axios.delete(`${API_URL}/api/admin/universities/${uni.id}`);
            await fetchData();
        } catch (error) {
            console.error('Failed to delete university:', error);
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
        <div className="space-y-6 animate-fade-in" data-testid="admin-page">
            {/* Header */}
            <div className="mb-8">
                <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-2">
                    Panel de Administración
                </h1>
                <p className="text-muted-foreground">
                    Gestiona universidades, carreras y pensum
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border bg-card">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-md bg-blue-500/10">
                                <Buildings size={24} className="text-blue-400" />
                            </div>
                            <div>
                                <p className="font-mono text-3xl font-medium">{stats.universities}</p>
                                <p className="text-sm text-muted-foreground">Universidades</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border bg-card">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-md bg-emerald-500/10">
                                <GraduationCap size={24} className="text-emerald-400" />
                            </div>
                            <div>
                                <p className="font-mono text-3xl font-medium">{stats.careers}</p>
                                <p className="text-sm text-muted-foreground">Carreras</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border bg-card">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-md bg-amber-500/10">
                                <BookOpen size={24} className="text-amber-400" />
                            </div>
                            <div>
                                <p className="font-mono text-3xl font-medium">{stats.subjects}</p>
                                <p className="text-sm text-muted-foreground">Materias</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border bg-card">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-md bg-purple-500/10">
                                <Users size={24} className="text-purple-400" />
                            </div>
                            <div>
                                <p className="font-mono text-3xl font-medium">{stats.users}</p>
                                <p className="text-sm text-muted-foreground">Usuarios</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Universities Section */}
            <Card className="border-border bg-card" data-testid="universities-section">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="font-heading text-lg">Universidades</CardTitle>
                        <CardDescription>Gestiona las universidades del sistema</CardDescription>
                    </div>
                    <Button 
                        className="bg-blue-600 hover:bg-blue-500"
                        onClick={() => handleOpenUniDialog()}
                        data-testid="add-university-btn"
                    >
                        <Plus size={18} className="mr-2" />
                        Nueva Universidad
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border">
                                <TableHead>Nombre</TableHead>
                                <TableHead>País</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {universities.map(uni => (
                                <TableRow key={uni.id} className="border-border">
                                    <TableCell className="font-medium">{uni.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{uni.country}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link to={`/admin/universities/${uni.id}`}>
                                                <Button variant="ghost" size="sm" className="text-blue-400">
                                                    <ArrowRight size={16} className="mr-1" />
                                                    Ver Carreras
                                                </Button>
                                            </Link>
                                            <Button 
                                                variant="ghost" 
                                                size="icon"
                                                onClick={() => handleOpenUniDialog(uni)}
                                            >
                                                <Pencil size={16} />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon"
                                                className="text-red-400 hover:text-red-300"
                                                onClick={() => handleDeleteUniversity(uni)}
                                            >
                                                <Trash size={16} />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {universities.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                        No hay universidades registradas
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* University Dialog */}
            <Dialog open={uniDialogOpen} onOpenChange={setUniDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading">
                            {editingUni ? 'Editar Universidad' : 'Nueva Universidad'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nombre de la Universidad</Label>
                            <Input
                                value={uniForm.name}
                                onChange={(e) => setUniForm({ ...uniForm, name: e.target.value })}
                                placeholder="Universidad Nacional"
                                className="bg-secondary border-border"
                                data-testid="university-name-input"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>País</Label>
                            <Input
                                value={uniForm.country}
                                onChange={(e) => setUniForm({ ...uniForm, country: e.target.value })}
                                placeholder="República Dominicana"
                                className="bg-secondary border-border"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUniDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button 
                            className="bg-blue-600 hover:bg-blue-500"
                            onClick={handleSaveUniversity}
                            disabled={saving || !uniForm.name.trim()}
                            data-testid="save-university-btn"
                        >
                            {saving ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Admin;
