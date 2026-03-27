# Sistema de Seguimiento Académico - Unicaribe

## Problema Original
Aplicación Web de Seguimiento Académico para estudiantes universitarios de Unicaribe (República Dominicana), carrera de Ingeniería en Ciberseguridad.

## Arquitectura
- **Frontend**: React + TailwindCSS + Recharts + React Flow
- **Backend**: FastAPI + MongoDB
- **Autenticación**: JWT

## Usuario Demo
- Email: test@unicaribe.edu.do
- Password: test123

## Funcionalidades Implementadas
1. ✅ Autenticación JWT (registro/login)
2. ✅ Dashboard con GPA, créditos, gráficos, honores académicos
3. ✅ Pensum por cuatrimestres (53 materias, 185 créditos, 12 cuatrimestres)
4. ✅ Árbol de prerrequisitos interactivo (React Flow)
5. ✅ Gestión de estados de materias (Completada, Cursando, Planificada, Pendiente)
6. ✅ Validación de prerrequisitos con opción de anular
7. ✅ Cálculo de GPA según escala Unicaribe (4.0, 3.0, 2.0, 1.0, 0.0)
8. ✅ Honores académicos (Summa, Magna, Cum Laude)
9. ✅ Estimación de tiempo de graduación
10. ✅ Página de materias con filtros y tabla detallada
11. ✅ Perfil del estudiante

## Datos de la Carrera
- Universidad: Unicaribe
- Carrera: Ingeniería en Ciberseguridad
- Total asignaturas: 53
- Total créditos: 185
- Formato: Cuatrimestral (1 materia/mes)

## P0 - Completado
- Autenticación, Dashboard, Pensum, Materias, Perfil

## P1 - Backlog Pendiente
- Exportar progreso a PDF
- Notificaciones
- CRUD de administrador para carreras/materias
- Soporte multi-carrera

## Próximos Pasos
1. Agregar más materias completadas para ver evolución del GPA
2. Explorar árbol de prerrequisitos
3. Filtrar materias por estado/cuatrimestre
