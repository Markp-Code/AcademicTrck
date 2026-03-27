import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { GridFour, TreeStructure, Warning, CheckCircle } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Pensum = () => {
    const { user } = useAuth();
    const [subjects, setSubjects] = useState([]);
    const [progress, setProgress] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [newGrade, setNewGrade] = useState('');
    const [prerequisiteWarning, setPrerequisiteWarning] = useState(null);
    const [updating, setUpdating] = useState(false);
    const [hoveredSubject, setHoveredSubject] = useState(null);

    useEffect(() => {
        fetchData();
    }, [user?.career_id]);

    const fetchData = async () => {
        try {
            // Filter subjects by user's career
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

    const getSubjectStatus = useCallback((subjectId) => {
        const prog = progress.find(p => p.subject_id === subjectId);
        return prog?.status || 'pending';
    }, [progress]);

    const getSubjectGrade = useCallback((subjectId) => {
        const prog = progress.find(p => p.subject_id === subjectId);
        return prog?.grade;
    }, [progress]);

    // Check if a subject is available (all prerequisites completed)
    const isSubjectAvailable = useCallback((subject) => {
        if (!subject.prerequisites || subject.prerequisites.length === 0) {
            return true;
        }
        return subject.prerequisites.every(prereqCode => {
            const prereqSubject = subjects.find(s => s.code === prereqCode);
            if (!prereqSubject) return true;
            return getSubjectStatus(prereqSubject.id) === 'completed';
        });
    }, [subjects, getSubjectStatus]);

    // Get subjects that would be unlocked if this subject is completed
    const getUnlockedSubjects = useCallback((subjectCode) => {
        return subjects.filter(s => 
            s.prerequisites && 
            s.prerequisites.includes(subjectCode) &&
            getSubjectStatus(s.id) !== 'completed'
        );
    }, [subjects, getSubjectStatus]);

    // Get all subjects that would eventually be unlocked (chain)
    const getUnlockChain = useCallback((subjectCode, visited = new Set()) => {
        if (visited.has(subjectCode)) return [];
        visited.add(subjectCode);
        
        const directUnlocks = getUnlockedSubjects(subjectCode);
        let allUnlocks = [...directUnlocks];
        
        directUnlocks.forEach(s => {
            const chainUnlocks = getUnlockChain(s.code, visited);
            allUnlocks = [...allUnlocks, ...chainUnlocks];
        });
        
        return allUnlocks;
    }, [getUnlockedSubjects]);

    const handleSubjectClick = (subject) => {
        const prog = progress.find(p => p.subject_id === subject.id);
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

    // Group subjects by quarter
    const quarterGroups = useMemo(() => {
        const groups = {};
        subjects.forEach(s => {
            if (!groups[s.quarter]) groups[s.quarter] = [];
            groups[s.quarter].push(s);
        });
        return groups;
    }, [subjects]);

    // Get status display info
    const getStatusInfo = (subject) => {
        const status = getSubjectStatus(subject.id);
        const available = isSubjectAvailable(subject);
        
        if (status === 'completed') {
            return { 
                label: 'COMPLETADA', 
                bgClass: 'bg-emerald-600', 
                borderClass: 'border-emerald-500',
                textClass: 'text-emerald-400',
                dotClass: 'bg-emerald-400'
            };
        }
        if (status === 'in_progress') {
            return { 
                label: 'CURSANDO', 
                bgClass: 'bg-amber-700', 
                borderClass: 'border-amber-500',
                textClass: 'text-amber-400',
                dotClass: 'bg-amber-400'
            };
        }
        if (status === 'planned') {
            return { 
                label: 'PLANIFICADA', 
                bgClass: 'bg-purple-700', 
                borderClass: 'border-purple-500',
                textClass: 'text-purple-400',
                dotClass: 'bg-purple-400'
            };
        }
        if (available) {
            return { 
                label: 'DISPONIBLE', 
                bgClass: 'bg-blue-900/50', 
                borderClass: 'border-blue-500',
                textClass: 'text-blue-400',
                dotClass: 'bg-blue-400'
            };
        }
        return { 
            label: 'PENDIENTE', 
            bgClass: 'bg-gray-800/50', 
            borderClass: 'border-gray-600',
            textClass: 'text-gray-500',
            dotClass: 'bg-gray-500'
        };
    };

    // Check if subject should be highlighted (would be unlocked)
    const shouldHighlight = (subject) => {
        if (!hoveredSubject) return false;
        const unlockChain = getUnlockChain(hoveredSubject.code);
        return unlockChain.some(s => s.id === subject.id);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64" data-testid="pensum-loading">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    const quarterNames = {
        1: '1ER CUAT.',
        2: '2DO CUAT.',
        3: '3ER CUAT.',
        4: '4TO CUAT.',
        5: '5TO CUAT.',
        6: '6TO CUAT.',
        7: '7MO CUAT.',
        8: '8VO CUAT.',
        9: '9NO CUAT.',
        10: '10MO CUAT.',
        11: '11VO CUAT.',
        12: '12VO CUAT.'
    };

    return (
        <div className="space-y-6" data-testid="pensum-page">
            {/* Header */}
            <div className="mb-8">
                <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-2">
                    Pensum Académico
                </h1>
                <p className="text-muted-foreground">
                    {subjects.length} materias • Selecciona una materia para ver qué se desbloquea
                </p>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mb-6 p-4 bg-card rounded-lg border border-border">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="text-sm text-muted-foreground">Completada</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="text-sm text-muted-foreground">Cursando</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-400" />
                    <span className="text-sm text-muted-foreground">Planificada</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-400" />
                    <span className="text-sm text-muted-foreground">Disponible</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-500" />
                    <span className="text-sm text-muted-foreground">Pendiente</span>
                </div>
                <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border">
                    <div className="w-4 h-4 rounded border-2 border-green-400 border-dashed" />
                    <span className="text-sm text-green-400">Se desbloquearía</span>
                </div>
            </div>

            <Tabs defaultValue="tree" className="w-full">
                <TabsList className="bg-secondary mb-6">
                    <TabsTrigger value="tree" className="data-[state=active]:bg-card" data-testid="tree-view-tab">
                        <TreeStructure size={18} className="mr-2" />
                        Árbol de Prerrequisitos
                    </TabsTrigger>
                    <TabsTrigger value="grid" className="data-[state=active]:bg-card" data-testid="grid-view-tab">
                        <GridFour size={18} className="mr-2" />
                        Vista Compacta
                    </TabsTrigger>
                </TabsList>

                {/* Tree View - Like the reference image */}
                <TabsContent value="tree" className="mt-0">
                    <div className="space-y-8 overflow-x-auto pb-4" data-testid="prerequisites-tree">
                        {Object.entries(quarterGroups)
                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                            .map(([quarter, quarterSubjects]) => (
                                <div key={quarter} className="relative">
                                    {/* Quarter Label */}
                                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full hidden lg:block">
                                        <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                                            {quarterNames[quarter] || `${quarter}° CUAT.`}
                                        </span>
                                    </div>
                                    
                                    {/* Mobile Quarter Label */}
                                    <div className="lg:hidden mb-3">
                                        <span className="font-mono text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                                            {quarterNames[quarter] || `${quarter}° CUAT.`}
                                        </span>
                                    </div>

                                    {/* Subjects Row */}
                                    <div className="flex flex-wrap gap-4 lg:gap-3 lg:ml-20">
                                        {quarterSubjects.map(subject => {
                                            const statusInfo = getStatusInfo(subject);
                                            const isHighlighted = shouldHighlight(subject);
                                            const isHovered = hoveredSubject?.id === subject.id;
                                            const grade = getSubjectGrade(subject.id);

                                            return (
                                                <div
                                                    key={subject.id}
                                                    className={`
                                                        relative w-full sm:w-[200px] min-h-[100px] p-3 rounded-md cursor-pointer
                                                        transition-all duration-300 border-2
                                                        ${statusInfo.bgClass}
                                                        ${isHighlighted 
                                                            ? 'border-green-400 border-dashed shadow-lg shadow-green-500/20 scale-105' 
                                                            : statusInfo.borderClass
                                                        }
                                                        ${isHovered ? 'ring-2 ring-white/30' : ''}
                                                        hover:scale-[1.02]
                                                    `}
                                                    onClick={() => handleSubjectClick(subject)}
                                                    onMouseEnter={() => setHoveredSubject(subject)}
                                                    onMouseLeave={() => setHoveredSubject(null)}
                                                    data-testid={`subject-card-${subject.code}`}
                                                >
                                                    {/* Code with dot */}
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
                                                        <span className={`font-mono text-xs font-bold ${statusInfo.textClass}`}>
                                                            {subject.code}
                                                        </span>
                                                    </div>

                                                    {/* Subject Name */}
                                                    <h3 className="text-sm font-semibold text-foreground uppercase leading-tight mb-2 line-clamp-3">
                                                        {subject.name}
                                                    </h3>

                                                    {/* Status Label */}
                                                    <div className="absolute bottom-2 left-3 right-3">
                                                        <span className={`text-[10px] font-mono ${statusInfo.textClass}`}>
                                                            {statusInfo.label}
                                                        </span>
                                                        {grade && (
                                                            <span className="float-right font-mono text-xs text-emerald-400">
                                                                {grade}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Unlock indicator */}
                                                    {isHighlighted && (
                                                        <div className="absolute -top-2 -right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                                            <CheckCircle size={12} className="text-white" weight="bold" />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Connection lines (visual only) */}
                                    {parseInt(quarter) < Math.max(...Object.keys(quarterGroups).map(Number)) && (
                                        <div className="hidden lg:block absolute left-20 right-0 bottom-0 h-8 pointer-events-none">
                                            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                                                {quarterSubjects.map((subject, idx) => {
                                                    const nextQuarterSubjects = quarterGroups[parseInt(quarter) + 1] || [];
                                                    const dependents = nextQuarterSubjects.filter(s => 
                                                        s.prerequisites?.includes(subject.code)
                                                    );
                                                    
                                                    return dependents.map((dep, depIdx) => {
                                                        const startX = idx * 215 + 100;
                                                        const endX = nextQuarterSubjects.indexOf(dep) * 215 + 100;
                                                        const statusInfo = getStatusInfo(subject);
                                                        const isHighlightedLine = hoveredSubject?.code === subject.code;
                                                        
                                                        return (
                                                            <path
                                                                key={`${subject.id}-${dep.id}`}
                                                                d={`M ${startX} 0 Q ${startX} 30, ${(startX + endX) / 2} 30 T ${endX} 60`}
                                                                fill="none"
                                                                stroke={isHighlightedLine ? '#22c55e' : '#4B5563'}
                                                                strokeWidth={isHighlightedLine ? 2 : 1}
                                                                strokeDasharray={isHighlightedLine ? '5,5' : '3,3'}
                                                                className="transition-all duration-300"
                                                            />
                                                        );
                                                    });
                                                })}
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            ))}
                    </div>
                </TabsContent>

                {/* Grid View - Compact cards by quarter */}
                <TabsContent value="grid" className="mt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {Object.entries(quarterGroups)
                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                            .map(([quarter, quarterSubjects]) => (
                                <Card key={quarter} className="border-border bg-card">
                                    <div className="p-4 border-b border-border">
                                        <h3 className="font-heading text-base flex items-center justify-between">
                                            <span>Cuatrimestre {quarter}</span>
                                            <Badge variant="outline" className="font-mono">
                                                {quarterSubjects.reduce((acc, s) => acc + s.credits, 0)} cr
                                            </Badge>
                                        </h3>
                                    </div>
                                    <CardContent className="p-3 space-y-2">
                                        {quarterSubjects.map(subject => {
                                            const statusInfo = getStatusInfo(subject);
                                            const grade = getSubjectGrade(subject.id);
                                            
                                            return (
                                                <div
                                                    key={subject.id}
                                                    className={`p-3 rounded-sm border-l-4 cursor-pointer transition-all hover:bg-secondary/50 ${statusInfo.borderClass.replace('border-', 'border-l-')}`}
                                                    onClick={() => handleSubjectClick(subject)}
                                                >
                                                    <p className={`font-mono text-xs ${statusInfo.textClass} mb-1`}>
                                                        {subject.code}
                                                    </p>
                                                    <p className="text-sm font-medium line-clamp-2">{subject.name}</p>
                                                    <div className="flex items-center justify-between mt-2">
                                                        <span className="text-xs text-muted-foreground">{subject.credits} cr</span>
                                                        {grade && (
                                                            <span className="font-mono text-xs text-emerald-400">{grade}</span>
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
            </Tabs>

            {/* Hover Info Panel */}
            {hoveredSubject && (
                <div className="fixed bottom-4 right-4 max-w-sm p-4 bg-card border border-border rounded-lg shadow-xl z-50 animate-fade-in">
                    <h4 className="font-mono text-sm text-blue-400 mb-1">{hoveredSubject.code}</h4>
                    <p className="font-medium text-sm mb-2">{hoveredSubject.name}</p>
                    {getUnlockChain(hoveredSubject.code).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border">
                            <p className="text-xs text-green-400 mb-1">
                                Al completar esta materia se desbloquean:
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {getUnlockChain(hoveredSubject.code).slice(0, 5).map(s => (
                                    <Badge key={s.id} variant="outline" className="text-xs font-mono border-green-500/50 text-green-400">
                                        {s.code}
                                    </Badge>
                                ))}
                                {getUnlockChain(hoveredSubject.code).length > 5 && (
                                    <Badge variant="outline" className="text-xs">
                                        +{getUnlockChain(hoveredSubject.code).length - 5} más
                                    </Badge>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Subject Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-card border-border max-w-md" data-testid="subject-dialog">
                    <DialogHeader>
                        <DialogTitle className="font-heading">
                            <span className="font-mono text-blue-400 text-sm block mb-1">{selectedSubject?.code}</span>
                            {selectedSubject?.name}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedSubject?.credits} créditos • Cuatrimestre {selectedSubject?.quarter}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSubject?.prerequisites?.length > 0 && (
                        <div className="py-2">
                            <Label className="text-muted-foreground text-xs">Prerrequisitos:</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {selectedSubject.prerequisites.map(prereq => {
                                    const prereqSubject = subjects.find(s => s.code === prereq);
                                    const isCompleted = prereqSubject && getSubjectStatus(prereqSubject.id) === 'completed';
                                    return (
                                        <Badge 
                                            key={prereq} 
                                            variant="outline" 
                                            className={`font-mono text-xs ${isCompleted ? 'border-emerald-500 text-emerald-400' : 'border-gray-500 text-gray-400'}`}
                                        >
                                            {isCompleted && <CheckCircle size={12} className="mr-1" />}
                                            {prereq}
                                        </Badge>
                                    );
                                })}
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
