import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
    GridFour, TreeStructure, Warning, CheckCircle, CalendarBlank, 
    DotsSixVertical, Trash, Plus, ArrowRight, FilePdf
} from '@phosphor-icons/react';
import { generateTranscriptPDF } from '../utils/pdfGenerator';

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
    
    // Planner state
    const [plannerSlots, setPlannerSlots] = useState({});
    const [draggedSubject, setDraggedSubject] = useState(null);
    const [career, setCareer] = useState(null);
    const [university, setUniversity] = useState(null);
    const [exportingPDF, setExportingPDF] = useState(false);

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
            
            // Fetch career and university for PDF export
            if (careerId) {
                try {
                    const careerRes = await axios.get(`${API_URL}/api/careers/${careerId}`);
                    setCareer(careerRes.data);
                    if (careerRes.data?.university_id) {
                        const uniRes = await axios.get(`${API_URL}/api/universities/${careerRes.data.university_id}`);
                        setUniversity(uniRes.data);
                    }
                } catch (e) {
                    console.error('Failed to fetch career/university:', e);
                }
            }
            
            // Initialize planner with planned subjects
            const planned = {};
            progressRes.data.forEach(p => {
                if (p.status === 'planned') {
                    const subject = subjectsRes.data.find(s => s.id === p.subject_id);
                    if (subject) {
                        // Group by planned quarter (using subject's original quarter as default)
                        const slot = subject.quarter;
                        if (!planned[slot]) planned[slot] = [];
                        planned[slot].push(subject);
                    }
                }
            });
            setPlannerSlots(planned);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportTranscript = async () => {
        setExportingPDF(true);
        try {
            await generateTranscriptPDF(user, subjects, progress, career, university);
        } catch (error) {
            console.error('Failed to export transcript:', error);
        } finally {
            setExportingPDF(false);
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

    const getUnlockedSubjects = useCallback((subjectCode) => {
        return subjects.filter(s => 
            s.prerequisites && 
            s.prerequisites.includes(subjectCode) &&
            getSubjectStatus(s.id) !== 'completed'
        );
    }, [subjects, getSubjectStatus]);

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

    // Planner drag & drop handlers
    const handleDragStart = (e, subject) => {
        setDraggedSubject(subject);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e, slotNumber) => {
        e.preventDefault();
        if (!draggedSubject) return;

        // Update status to planned
        try {
            await axios.put(`${API_URL}/api/progress/${draggedSubject.id}`, {
                subject_id: draggedSubject.id,
                status: 'planned',
                override_prerequisite: true
            });
            
            // Update local state
            setPlannerSlots(prev => {
                const updated = { ...prev };
                // Remove from old slot
                Object.keys(updated).forEach(key => {
                    updated[key] = updated[key]?.filter(s => s.id !== draggedSubject.id) || [];
                });
                // Add to new slot
                if (!updated[slotNumber]) updated[slotNumber] = [];
                updated[slotNumber].push(draggedSubject);
                return updated;
            });
            
            await fetchData();
        } catch (error) {
            console.error('Failed to update planner:', error);
        }
        
        setDraggedSubject(null);
    };

    const removeFromPlanner = async (subject) => {
        try {
            await axios.put(`${API_URL}/api/progress/${subject.id}`, {
                subject_id: subject.id,
                status: 'pending',
                override_prerequisite: true
            });
            await fetchData();
        } catch (error) {
            console.error('Failed to remove from planner:', error);
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

    // Get available subjects for planner
    const availableForPlanner = useMemo(() => {
        return subjects.filter(s => {
            const status = getSubjectStatus(s.id);
            return (status === 'pending' || status === 'planned') && isSubjectAvailable(s);
        });
    }, [subjects, getSubjectStatus, isSubjectAvailable]);

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

    const shouldHighlight = (subject) => {
        if (!hoveredSubject) return false;
        const unlockChain = getUnlockChain(hoveredSubject.code);
        return unlockChain.some(s => s.id === subject.id);
    };

    // Get prerequisite subjects for drawing connections
    const getPrerequisiteSubject = (prereqCode) => {
        return subjects.find(s => s.code === prereqCode);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64" data-testid="pensum-loading">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    const quarterNames = {
        1: '1°', 2: '2°', 3: '3°', 4: '4°', 5: '5°', 6: '6°',
        7: '7°', 8: '8°', 9: '9°', 10: '10°', 11: '11°', 12: '12°'
    };

    return (
        <div className="space-y-6" data-testid="pensum-page">
            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-2">
                        Pensum Académico
                    </h1>
                    <p className="text-muted-foreground">
                        {subjects.length} materias • Selecciona una materia para ver qué se desbloquea
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={handleExportTranscript}
                    disabled={exportingPDF || subjects.length === 0}
                    className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                    data-testid="export-transcript-btn"
                >
                    {exportingPDF ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400 mr-2" />
                    ) : (
                        <FilePdf size={18} className="mr-2" />
                    )}
                    Exportar Record
                </Button>
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
                    <TabsTrigger value="planner" className="data-[state=active]:bg-card" data-testid="planner-tab">
                        <CalendarBlank size={18} className="mr-2" />
                        Planificador
                    </TabsTrigger>
                    <TabsTrigger value="grid" className="data-[state=active]:bg-card" data-testid="grid-view-tab">
                        <GridFour size={18} className="mr-2" />
                        Vista Compacta
                    </TabsTrigger>
                </TabsList>

                {/* Tree View */}
                <TabsContent value="tree" className="mt-0">
                    <div className="space-y-1 overflow-x-auto pb-4" data-testid="prerequisites-tree">
                        {Object.entries(quarterGroups)
                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                            .map(([quarter, quarterSubjects], quarterIndex) => (
                                <div key={quarter} className="relative flex items-start gap-4">
                                    {/* Quarter Label */}
                                    <div className="w-12 shrink-0 pt-8 text-center">
                                        <span className="font-mono text-xs text-muted-foreground font-bold">
                                            {quarterNames[quarter]}
                                        </span>
                                    </div>

                                    {/* Subjects Row */}
                                    <div className="flex-1 flex flex-wrap gap-3 py-2 relative">
                                        {quarterSubjects.map((subject, subjectIndex) => {
                                            const statusInfo = getStatusInfo(subject);
                                            const isHighlighted = shouldHighlight(subject);
                                            const isHovered = hoveredSubject?.id === subject.id;
                                            const grade = getSubjectGrade(subject.id);

                                            return (
                                                <div key={subject.id} className="relative">
                                                    {/* Connection lines to prerequisites */}
                                                    {subject.prerequisites?.map(prereqCode => {
                                                        const prereq = getPrerequisiteSubject(prereqCode);
                                                        if (!prereq || prereq.quarter >= parseInt(quarter)) return null;
                                                        
                                                        const isLineHighlighted = hoveredSubject?.code === prereqCode;
                                                        
                                                        return (
                                                            <div
                                                                key={prereqCode}
                                                                className={`absolute -top-1 left-1/2 w-0.5 h-3 
                                                                    ${isLineHighlighted ? 'bg-green-400' : 'bg-gray-600'}
                                                                    transition-colors duration-200`}
                                                                style={{ transform: 'translateX(-50%)' }}
                                                            />
                                                        );
                                                    })}
                                                    
                                                    <div
                                                        className={`
                                                            relative w-[180px] min-h-[90px] p-3 rounded-md cursor-pointer
                                                            transition-all duration-200 border-2
                                                            ${statusInfo.bgClass}
                                                            ${isHighlighted 
                                                                ? 'border-green-400 border-dashed shadow-lg shadow-green-500/20 scale-105 z-10' 
                                                                : statusInfo.borderClass
                                                            }
                                                            ${isHovered ? 'ring-2 ring-white/30 z-20' : ''}
                                                            hover:scale-[1.02]
                                                        `}
                                                        onClick={() => handleSubjectClick(subject)}
                                                        onMouseEnter={() => setHoveredSubject(subject)}
                                                        onMouseLeave={() => setHoveredSubject(null)}
                                                        data-testid={`subject-card-${subject.code}`}
                                                    >
                                                        {/* Code with dot */}
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
                                                            <span className={`font-mono text-xs font-bold ${statusInfo.textClass}`}>
                                                                {subject.code}
                                                            </span>
                                                        </div>

                                                        {/* Subject Name */}
                                                        <h3 className="text-xs font-semibold text-foreground uppercase leading-tight mb-1 line-clamp-2">
                                                            {subject.name}
                                                        </h3>

                                                        {/* Credits */}
                                                        <div className="text-[10px] text-muted-foreground mb-1">
                                                            {subject.credits} créditos
                                                        </div>

                                                        {/* Status and Grade */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-[10px] font-mono ${statusInfo.textClass}`}>
                                                                {statusInfo.label}
                                                            </span>
                                                            {grade && (
                                                                <span className="font-mono text-xs text-emerald-400 font-bold">
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
                                                    
                                                    {/* Arrow to next subjects */}
                                                    {getUnlockedSubjects(subject.code).length > 0 && (
                                                        <div className={`absolute -bottom-1 left-1/2 w-0.5 h-3 
                                                            ${isHovered ? 'bg-green-400' : 'bg-gray-600'}
                                                            transition-colors duration-200`}
                                                            style={{ transform: 'translateX(-50%)' }}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                    </div>
                </TabsContent>

                {/* Planner View */}
                <TabsContent value="planner" className="mt-0">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" data-testid="planner-view">
                        {/* Available Subjects */}
                        <div className="lg:col-span-1">
                            <Card className="border-border bg-card sticky top-4">
                                <CardHeader className="pb-3">
                                    <CardTitle className="font-heading text-base flex items-center gap-2">
                                        <Plus size={18} className="text-blue-400" />
                                        Materias Disponibles
                                    </CardTitle>
                                    <p className="text-xs text-muted-foreground">
                                        Arrastra a un periodo para planificar
                                    </p>
                                </CardHeader>
                                <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                                    {availableForPlanner.filter(s => getSubjectStatus(s.id) !== 'planned').map(subject => (
                                        <div
                                            key={subject.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, subject)}
                                            className="p-3 rounded-md bg-blue-900/30 border border-blue-500/50 cursor-grab active:cursor-grabbing hover:bg-blue-900/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                            <DotsSixVertical size={14} className="text-blue-400" />
                                                <span className="font-mono text-xs text-blue-400 font-bold">
                                                    {subject.code}
                                                </span>
                                            </div>
                                            <p className="text-xs font-medium line-clamp-2">{subject.name}</p>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {subject.credits} cr • Cuat. {subject.quarter}
                                            </p>
                                        </div>
                                    ))}
                                    {availableForPlanner.filter(s => getSubjectStatus(s.id) !== 'planned').length === 0 && (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            No hay materias disponibles para planificar
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Planner Timeline */}
                        <div className="lg:col-span-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {[1, 2, 3, 4, 5, 6].map(slotNum => {
                                    const slotSubjects = Object.entries(plannerSlots)
                                        .filter(([key]) => Math.ceil(parseInt(key) / 2) === slotNum)
                                        .flatMap(([, subjects]) => subjects);
                                    
                                    const totalCredits = slotSubjects.reduce((acc, s) => acc + s.credits, 0);

                                    return (
                                        <Card 
                                            key={slotNum}
                                            className={`border-border bg-card min-h-[200px] transition-colors ${
                                                draggedSubject ? 'border-dashed border-blue-500/50' : ''
                                            }`}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, slotNum * 2 - 1)}
                                        >
                                            <CardHeader className="pb-2">
                                                <CardTitle className="font-heading text-sm flex items-center justify-between">
                                                    <span className="flex items-center gap-2">
                                                        <CalendarBlank size={16} className="text-purple-400" />
                                                        Periodo {slotNum}
                                                    </span>
                                                    <Badge variant="outline" className="font-mono text-xs">
                                                        {totalCredits} cr
                                                    </Badge>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-2">
                                                {slotSubjects.map(subject => (
                                                    <div
                                                        key={subject.id}
                                                        className="p-2 rounded bg-purple-900/30 border border-purple-500/50 group"
                                                    >
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1 min-w-0">
                                                                <span className="font-mono text-xs text-purple-400">
                                                                    {subject.code}
                                                                </span>
                                                                <p className="text-xs font-medium line-clamp-1">{subject.name}</p>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"
                                                                onClick={() => removeFromPlanner(subject)}
                                                            >
                                                                <Trash size={14} />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {slotSubjects.length === 0 && (
                                                    <div className="h-24 flex items-center justify-center border-2 border-dashed border-gray-700 rounded-md">
                                                        <p className="text-xs text-muted-foreground">
                                                            Arrastra materias aquí
                                                        </p>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* Grid View */}
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
                    
                    {hoveredSubject.prerequisites?.length > 0 && (
                        <div className="mb-2">
                            <p className="text-xs text-muted-foreground mb-1">Prerrequisitos:</p>
                            <div className="flex flex-wrap gap-1">
                                {hoveredSubject.prerequisites.map(code => {
                                    const prereq = getPrerequisiteSubject(code);
                                    const isCompleted = prereq && getSubjectStatus(prereq.id) === 'completed';
                                    return (
                                        <Badge 
                                            key={code} 
                                            variant="outline" 
                                            className={`text-xs font-mono ${isCompleted ? 'border-emerald-500 text-emerald-400' : 'border-gray-500'}`}
                                        >
                                            {isCompleted && <CheckCircle size={10} className="mr-1" />}
                                            {code}
                                        </Badge>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    
                    {getUnlockChain(hoveredSubject.code).length > 0 && (
                        <div className="pt-2 border-t border-border">
                            <p className="text-xs text-green-400 mb-1 flex items-center gap-1">
                                <ArrowRight size={12} />
                                Al completar se desbloquean:
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {getUnlockChain(hoveredSubject.code).slice(0, 6).map(s => (
                                    <Badge key={s.id} variant="outline" className="text-xs font-mono border-green-500/50 text-green-400">
                                        {s.code}
                                    </Badge>
                                ))}
                                {getUnlockChain(hoveredSubject.code).length > 6 && (
                                    <Badge variant="outline" className="text-xs">
                                        +{getUnlockChain(hoveredSubject.code).length - 6} más
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
                                    data-testid="save-progress-button"
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

export default Pensum;
