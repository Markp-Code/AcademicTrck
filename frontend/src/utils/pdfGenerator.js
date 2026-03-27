import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateProgressPDF = async (user, stats, subjects, progress, career, university) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(5, 7, 10);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('UniProgress', 14, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Reporte de Progreso Académico', 14, 28);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-DO')}`, 14, 35);
    
    // Student Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Información del Estudiante', 14, 50);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nombre: ${user?.name || 'N/A'}`, 14, 58);
    doc.text(`Email: ${user?.email || 'N/A'}`, 14, 64);
    doc.text(`Matrícula: ${user?.student_id || 'N/A'}`, 14, 70);
    doc.text(`Universidad: ${university?.name || 'N/A'}`, 14, 76);
    doc.text(`Carrera: ${career?.name || 'N/A'}`, 14, 82);
    
    // Academic Summary Box
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(pageWidth - 80, 45, 66, 42, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('GPA Actual', pageWidth - 75, 53);
    
    doc.setFontSize(28);
    doc.setTextColor(59, 130, 246);
    doc.setFont('helvetica', 'bold');
    doc.text(stats?.gpa?.toFixed(2) || '0.00', pageWidth - 75, 68);
    
    if (stats?.honor) {
        doc.setFontSize(8);
        doc.setTextColor(245, 158, 11);
        doc.text(stats.honor, pageWidth - 75, 78);
    }
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(`${stats?.credits_earned || 0}/${stats?.total_credits || 0} créditos`, pageWidth - 75, 85);
    
    // Progress Stats
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen de Progreso', 14, 98);
    
    const statsData = [
        ['Materias Completadas', stats?.subjects_completed || 0],
        ['Materias Cursando', stats?.subjects_in_progress || 0],
        ['Materias Planificadas', stats?.subjects_planned || 0],
        ['Materias Pendientes', stats?.subjects_pending || 0],
        ['Créditos Obtenidos', stats?.credits_earned || 0],
        ['Créditos Restantes', stats?.credits_remaining || 0],
        ['Progreso', `${stats?.progress_percentage?.toFixed(1) || 0}%`],
        ['Tiempo Estimado', `${stats?.estimated_years_remaining || 0} años`]
    ];
    
    autoTable(doc, {
        startY: 102,
        head: [],
        body: statsData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 50 },
            1: { halign: 'right', cellWidth: 30 }
        },
        margin: { left: 14 }
    });
    
    // Completed Subjects Table
    const completedSubjects = subjects
        .filter(s => {
            const prog = progress.find(p => p.subject_id === s.id);
            return prog?.status === 'completed' && prog?.grade;
        })
        .map(s => {
            const prog = progress.find(p => p.subject_id === s.id);
            const gpaPoints = prog.grade >= 90 ? 4.0 : prog.grade >= 80 ? 3.0 : prog.grade >= 70 ? 2.0 : prog.grade >= 60 ? 1.0 : 0.0;
            return [s.code, s.name, s.credits, prog.grade, gpaPoints.toFixed(1)];
        });
    
    if (completedSubjects.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Materias Completadas', 14, doc.lastAutoTable.finalY + 15);
        
        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 19,
            head: [['Código', 'Materia', 'Créditos', 'Nota', 'GPA']],
            body: completedSubjects,
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246], textColor: 255 },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 20, fontStyle: 'bold' },
                1: { cellWidth: 80 },
                2: { cellWidth: 18, halign: 'center' },
                3: { cellWidth: 15, halign: 'center' },
                4: { cellWidth: 15, halign: 'center' }
            }
        });
    }
    
    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Página ${i} de ${pageCount} | UniProgress - Sistema de Seguimiento Académico`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );
    }
    
    // Save
    doc.save(`UniProgress_Reporte_${user?.name?.replace(/\s+/g, '_') || 'estudiante'}_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateTranscriptPDF = async (user, subjects, progress, career, university) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Official-looking header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(university?.name || 'Universidad', pageWidth / 2, 18, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('RECORD ACADÉMICO OFICIAL', pageWidth / 2, 28, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(career?.name || 'Carrera', pageWidth / 2, 38, { align: 'center' });
    
    // Student Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Estudiante: ${user?.name || 'N/A'}`, 14, 60);
    doc.text(`Matrícula: ${user?.student_id || 'N/A'}`, 14, 67);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-DO')}`, pageWidth - 14, 60, { align: 'right' });
    
    // All subjects by quarter
    const subjectsByQuarter = {};
    subjects.forEach(s => {
        if (!subjectsByQuarter[s.quarter]) subjectsByQuarter[s.quarter] = [];
        const prog = progress.find(p => p.subject_id === s.id);
        subjectsByQuarter[s.quarter].push({
            ...s,
            status: prog?.status || 'pending',
            grade: prog?.grade
        });
    });
    
    let currentY = 75;
    
    Object.entries(subjectsByQuarter)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([quarter, quarterSubjects]) => {
            if (currentY > 250) {
                doc.addPage();
                currentY = 20;
            }
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(59, 130, 246);
            doc.text(`Cuatrimestre ${quarter}`, 14, currentY);
            currentY += 4;
            
            const tableData = quarterSubjects.map(s => {
                let status = '-';
                let grade = '-';
                let gpa = '-';
                
                if (s.status === 'completed' && s.grade) {
                    status = 'Aprobada';
                    grade = s.grade.toString();
                    gpa = (s.grade >= 90 ? 4.0 : s.grade >= 80 ? 3.0 : s.grade >= 70 ? 2.0 : s.grade >= 60 ? 1.0 : 0.0).toFixed(1);
                } else if (s.status === 'in_progress') {
                    status = 'Cursando';
                } else if (s.status === 'planned') {
                    status = 'Planificada';
                }
                
                return [s.code, s.name, s.credits, grade, gpa, status];
            });
            
            autoTable(doc, {
                startY: currentY,
                head: [['Código', 'Materia', 'Cr', 'Nota', 'GPA', 'Estado']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [100, 100, 100], textColor: 255, fontSize: 7 },
                styles: { fontSize: 7, cellPadding: 1.5 },
                columnStyles: {
                    0: { cellWidth: 18 },
                    1: { cellWidth: 70 },
                    2: { cellWidth: 12, halign: 'center' },
                    3: { cellWidth: 15, halign: 'center' },
                    4: { cellWidth: 15, halign: 'center' },
                    5: { cellWidth: 22, halign: 'center' }
                },
                margin: { left: 14, right: 14 }
            });
            
            currentY = doc.lastAutoTable.finalY + 8;
        });
    
    // Save
    doc.save(`UniProgress_Transcript_${user?.name?.replace(/\s+/g, '_') || 'estudiante'}_${new Date().toISOString().split('T')[0]}.pdf`);
};
