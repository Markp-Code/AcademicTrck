import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Calculator, Target, TrendingUp } from '@phosphor-icons/react';

const GPASimulator = ({ isOpen, onClose, currentGPA, creditsEarned, totalCredits }) => {
    const [targetGPA, setTargetGPA] = useState('3.5');
    const [plannedCredits, setPlannedCredits] = useState('15');
    const [result, setResult] = useState(null);

    const calculateRequiredGrade = () => {
        const target = parseFloat(targetGPA);
        const planned = parseInt(plannedCredits);
        const currentPoints = currentGPA * creditsEarned;
        
        // GPA = totalPoints / totalCredits
        // target = (currentPoints + newPoints) / (creditsEarned + plannedCredits)
        // newPoints = target * (creditsEarned + plannedCredits) - currentPoints
        // requiredGPA = newPoints / plannedCredits
        
        const totalCreditsAfter = creditsEarned + planned;
        const requiredPoints = target * totalCreditsAfter - currentPoints;
        const requiredGPA = requiredPoints / planned;
        
        // Convert GPA to grade
        let requiredGrade = 0;
        let message = '';
        let achievable = true;
        
        if (requiredGPA >= 4.0) {
            requiredGrade = 95;
            if (requiredGPA > 4.0) {
                achievable = false;
                message = 'No es posible alcanzar este GPA con los créditos planificados. Necesitarías más de 4.0 de promedio.';
            } else {
                message = 'Necesitas obtener A (90-100) en todas las materias.';
            }
        } else if (requiredGPA >= 3.0) {
            requiredGrade = 85;
            message = 'Necesitas obtener principalmente B (80-89) o mejor.';
        } else if (requiredGPA >= 2.0) {
            requiredGrade = 75;
            message = 'Necesitas obtener al menos C (70-79) en promedio.';
        } else if (requiredGPA >= 1.0) {
            requiredGrade = 65;
            message = 'Necesitas obtener al menos D (60-69) en promedio.';
        } else if (requiredGPA >= 0) {
            requiredGrade = 50;
            message = 'Tu GPA actual ya supera o iguala el objetivo.';
        } else {
            achievable = false;
            message = 'Tu GPA actual ya supera el objetivo. ¡Felicidades!';
        }
        
        setResult({
            requiredGPA: Math.max(0, requiredGPA).toFixed(2),
            requiredGrade,
            message,
            achievable,
            projectedGPA: target.toFixed(2)
        });
    };

    const gpaToGrade = (gpa) => {
        if (gpa >= 4.0) return '90-100 (A)';
        if (gpa >= 3.0) return '80-89 (B)';
        if (gpa >= 2.0) return '70-79 (C)';
        if (gpa >= 1.0) return '60-69 (D)';
        return '0-59 (F)';
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-card border-border max-w-lg">
                <DialogHeader>
                    <DialogTitle className="font-heading flex items-center gap-2">
                        <Calculator size={24} className="text-blue-400" />
                        Simulador de GPA
                    </DialogTitle>
                    <DialogDescription>
                        Calcula qué calificaciones necesitas para alcanzar tu GPA objetivo
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Current Stats */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/50 rounded-lg">
                        <div>
                            <p className="text-xs text-muted-foreground">GPA Actual</p>
                            <p className="font-mono text-2xl font-bold text-blue-400">{currentGPA.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Créditos Cursados</p>
                            <p className="font-mono text-2xl font-bold">{creditsEarned}</p>
                        </div>
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Target size={16} className="text-emerald-400" />
                                GPA Objetivo
                            </Label>
                            <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="4"
                                value={targetGPA}
                                onChange={(e) => setTargetGPA(e.target.value)}
                                className="bg-secondary border-border font-mono"
                                placeholder="3.5"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <TrendingUp size={16} className="text-amber-400" />
                                Créditos a Cursar
                            </Label>
                            <Input
                                type="number"
                                min="1"
                                max="50"
                                value={plannedCredits}
                                onChange={(e) => setPlannedCredits(e.target.value)}
                                className="bg-secondary border-border font-mono"
                                placeholder="15"
                            />
                        </div>
                    </div>

                    <Button 
                        className="w-full bg-blue-600 hover:bg-blue-500"
                        onClick={calculateRequiredGrade}
                    >
                        <Calculator size={18} className="mr-2" />
                        Calcular
                    </Button>

                    {/* Result */}
                    {result && (
                        <Card className={`border ${result.achievable ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-amber-500/50 bg-amber-500/5'}`}>
                            <CardContent className="p-4">
                                <div className="text-center mb-3">
                                    <p className="text-xs text-muted-foreground mb-1">GPA Requerido por Materia</p>
                                    <p className={`font-mono text-4xl font-bold ${result.achievable ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {result.requiredGPA}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Equivalente a: {gpaToGrade(parseFloat(result.requiredGPA))}
                                    </p>
                                </div>
                                <p className={`text-sm text-center ${result.achievable ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {result.message}
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default GPASimulator;
