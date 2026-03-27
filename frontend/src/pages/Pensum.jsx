import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import ReactFlow, {
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { GridFour, TreeStructure, Warning, CheckCircle } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Custom Node Component
const SubjectNode = ({ data }) => {
    const statusColors = {
        completed: 'border-l-emerald-500 bg-emerald-500/5',
        in_progress: 'border-l-amber-500 bg-amber-500/5',
        planned: 'border-l-blue-500 bg-blue-500/5',
        pending: 'border-l-gray-500 bg-gray-500/5'
    };

    const statusLabels = {
        completed: 'Completada',
        in_progress: 'Cursando',
        planned: 'Planificada',
        pending: 'Pendiente'
    };

    return (
        <div 
            className={`px-4 py-3 rounded-sm border border-border bg-card ${statusColors[data.status]} border-l-4 min-w-[180px] cursor-pointer hover:border-gray-500 transition-colors`}
            onClick={data.onClick}
            data-testid={`node-${data.code}`}
        >
            <p className="font-mono text-xs text-blue-400 mb-1">{data.code}</p>
            <p className="text-sm font-medium line-clamp-2 mb-2">{data.name}</p>
            <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">
                    {data.credits} cr
                </Badge>
                <span className={`text-xs ${
                    data.status === 'completed' ? 'text-emerald-400' :
                    data.status === 'in_progress' ? 'text-amber-400' :
                    data.status === 'planned' ? 'text-blue-400' : 'text-gray-400'
                }`}>
                    {statusLabels[data.status]}
                </span>
            </div>
            {data.grade && (
                <p className="font-mono text-xs text-emerald-400 mt-1">
                    Nota: {data.grade}
                </p>
            )}
        </div>
    );
};

const nodeTypes = { subjectNode: SubjectNode };

const Pensum = () => {
    const [subjects, setSubjects] = useState([]);
    const [progress, setProgress] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [newGrade, setNewGrade] = useState('');
    const [prerequisiteWarning, setPrerequisiteWarning] = useState(null);
    const [updating, setUpdating] = useState(false);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [subjectsRes, progressRes] = await Promise.all([
                axios.get(`${API_URL}/api/subjects`),
                axios.get(`${API_URL}/api/progress`)
            ]);
            setSubjects(subjectsRes.data);
            setProgress(progressRes.data);
            generateFlowData(subjectsRes.data, progressRes.data);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getSubjectStatus = (subjectId) => {
        const prog = progress.find(p => p.subject_id === subjectId);
        return prog?.status || 'pending';
    };

    const getSubjectGrade = (subjectId) => {
        const prog = progress.find(p => p.subject_id === subjectId);
        return prog?.grade;
    };

    const generateFlowData = useCallback((subjectsData, progressData) => {
        const progressMap = {};
        progressData.forEach(p => {
            progressMap[p.subject_id] = p;
        });

        // Group by quarter
        const quarters = {};
        subjectsData.forEach(s => {
            if (!quarters[s.quarter]) quarters[s.quarter] = [];
            quarters[s.quarter].push(s);
        });

        const newNodes = [];
        const newEdges = [];
        const subjectCodeToId = {};

        subjectsData.forEach(s => {
            subjectCodeToId[s.code] = s.id;
        });

        // Position nodes
        Object.entries(quarters).forEach(([quarter, quarterSubjects]) => {
            quarterSubjects.forEach((subject, idx) => {
                const prog = progressMap[subject.id];
                newNodes.push({
                    id: subject.id,
                    type: 'subjectNode',
                    position: { 
                        x: (parseInt(quarter) - 1) * 250, 
                        y: idx * 140 
                    },
                    data: {
                        ...subject,
                        status: prog?.status || 'pending',
                        grade: prog?.grade,
                        onClick: () => handleSubjectClick(subject, prog)
                    }
                });

                // Create edges for prerequisites
                subject.prerequisites?.forEach(prereqCode => {
                    const prereqId = subjectCodeToId[prereqCode];
                    if (prereqId) {
                        newEdges.push({
                            id: `${prereqId}-${subject.id}`,
                            source: prereqId,
                            target: subject.id,
                            type: 'smoothstep',
                            animated: false,
                            style: { stroke: '#4B5563' },
                            markerEnd: {
                                type: MarkerType.ArrowClosed,
                                color: '#4B5563'
                            }
                        });
                    }
                });
            });
        });

        setNodes(newNodes);
        setEdges(newEdges);
    }, []);

    const handleSubjectClick = (subject, prog) => {
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

            // Refresh data
            await fetchData();
            setDialogOpen(false);
            setPrerequisiteWarning(null);
        } catch (error) {
            console.error('Failed to update progress:', error);
        } finally {
            setUpdating(false);
        }
    };

    // Group subjects by quarter for grid view
    const quarterGroups = {};
    subjects.forEach(s => {
        if (!quarterGroups[s.quarter]) quarterGroups[s.quarter] = [];
        quarterGroups[s.quarter].push(s);
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64" data-testid="pensum-loading">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6" data-testid="pensum-page">
            {/* Header */}
            <div className="mb-8">
                <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-2">
                    Pensum Académico
                </h1>
                <p className="text-muted-foreground">
                    Ingeniería en Ciberseguridad • 185 créditos • 12 cuatrimestres
                </p>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-sm text-muted-foreground">Completada</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-sm text-muted-foreground">Cursando</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-sm text-muted-foreground">Planificada</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-500" />
                    <span className="text-sm text-muted-foreground">Pendiente</span>
                </div>
            </div>

            <Tabs defaultValue="grid" className="w-full">
                <TabsList className="bg-secondary mb-6">
                    <TabsTrigger value="grid" className="data-[state=active]:bg-card" data-testid="grid-view-tab">
                        <GridFour size={18} className="mr-2" />
                        Por Cuatrimestre
                    </TabsTrigger>
                    <TabsTrigger value="tree" className="data-[state=active]:bg-card" data-testid="tree-view-tab">
                        <TreeStructure size={18} className="mr-2" />
                        Árbol de Prerrequisitos
                    </TabsTrigger>
                </TabsList>

                {/* Grid View */}
                <TabsContent value="grid" className="mt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {Object.entries(quarterGroups).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([quarter, quarterSubjects]) => (
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
                                    {quarterSubjects.map(subject => {
                                        const status = getSubjectStatus(subject.id);
                                        const grade = getSubjectGrade(subject.id);
                                        const statusColors = {
                                            completed: 'border-l-emerald-500 bg-emerald-500/5',
                                            in_progress: 'border-l-amber-500 bg-amber-500/5',
                                            planned: 'border-l-blue-500 bg-blue-500/5',
                                            pending: 'border-l-gray-500 bg-gray-500/5'
                                        };
                                        
                                        return (
                                            <div
                                                key={subject.id}
                                                className={`p-3 rounded-sm border border-border ${statusColors[status]} border-l-4 cursor-pointer hover:border-gray-500 transition-colors`}
                                                onClick={() => handleSubjectClick(subject, progress.find(p => p.subject_id === subject.id))}
                                                data-testid={`subject-card-${subject.code}`}
                                            >
                                                <p className="font-mono text-xs text-blue-400 mb-1">{subject.code}</p>
                                                <p className="text-sm font-medium line-clamp-2">{subject.name}</p>
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-xs text-muted-foreground">{subject.credits} cr</span>
                                                    {grade && (
                                                        <span className="font-mono text-xs text-emerald-400">
                                                            {grade}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* Tree View */}
                <TabsContent value="tree" className="mt-0">
                    <Card className="border-border bg-card">
                        <CardContent className="p-0">
                            <div className="h-[600px] w-full" data-testid="prerequisites-tree">
                                <ReactFlow
                                    nodes={nodes}
                                    edges={edges}
                                    onNodesChange={onNodesChange}
                                    onEdgesChange={onEdgesChange}
                                    nodeTypes={nodeTypes}
                                    fitView
                                    minZoom={0.1}
                                    maxZoom={1.5}
                                    defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
                                >
                                    <Background color="#1F2937" gap={20} />
                                    <Controls />
                                </ReactFlow>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Subject Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-card border-border max-w-md" data-testid="subject-dialog">
                    <DialogHeader>
                        <DialogTitle className="font-heading">
                            {selectedSubject?.code} - {selectedSubject?.name}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedSubject?.credits} créditos • Cuatrimestre {selectedSubject?.quarter}
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
                                    <p className="text-xs text-muted-foreground mt-2">
                                        ¿Deseas continuar de todos modos?
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Estado</Label>
                            <Select value={newStatus} onValueChange={setNewStatus}>
                                <SelectTrigger className="bg-secondary border-border" data-testid="status-select">
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
                                    data-testid="grade-input"
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        {prerequisiteWarning ? (
                            <>
                                <Button 
                                    variant="outline" 
                                    onClick={() => setPrerequisiteWarning(null)}
                                >
                                    Cancelar
                                </Button>
                                <Button 
                                    className="bg-amber-600 hover:bg-amber-500"
                                    onClick={() => handleUpdateProgress(true)}
                                    disabled={updating}
                                    data-testid="override-button"
                                >
                                    Continuar de todos modos
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button 
                                    variant="outline" 
                                    onClick={() => setDialogOpen(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button 
                                    className="bg-blue-600 hover:bg-blue-500"
                                    onClick={() => handleUpdateProgress(false)}
                                    disabled={updating || (newStatus === 'completed' && (!newGrade || parseFloat(newGrade) < 0 || parseFloat(newGrade) > 100))}
                                    data-testid="save-progress-button"
                                >
                                    {updating ? (
                                        <span className="animate-spin">⏳</span>
                                    ) : (
                                        <>
                                            <CheckCircle size={18} className="mr-2" />
                                            Guardar
                                        </>
                                    )}
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Pensum;
