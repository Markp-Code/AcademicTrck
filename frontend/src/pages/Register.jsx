import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { GraduationCap, Eye, EyeSlash, Spinner } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Register = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [studentId, setStudentId] = useState('');
    const [universityId, setUniversityId] = useState('');
    const [careerId, setCareerId] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const [universities, setUniversities] = useState([]);
    const [careers, setCareers] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    
    const { register } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        fetchUniversities();
    }, []);

    useEffect(() => {
        if (universityId) {
            fetchCareers(universityId);
        } else {
            setCareers([]);
            setCareerId('');
        }
    }, [universityId]);

    const fetchUniversities = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/universities`);
            setUniversities(response.data);
        } catch (error) {
            console.error('Failed to fetch universities:', error);
        } finally {
            setLoadingData(false);
        }
    };

    const fetchCareers = async (uniId) => {
        try {
            const response = await axios.get(`${API_URL}/api/careers?university_id=${uniId}`);
            setCareers(response.data);
        } catch (error) {
            console.error('Failed to fetch careers:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);

        try {
            await register(name, email, password, studentId, universityId, careerId);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.detail || 'Error al registrar usuario');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex" data-testid="register-page">
            {/* Left side - Image */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
                <div 
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                        backgroundImage: `url('https://images.pexels.com/photos/2881229/pexels-photo-2881229.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2')`
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-[#05070A]/95 via-[#05070A]/80 to-blue-900/30" />
                <div className="relative z-10 flex flex-col justify-center p-12">
                    <div className="flex items-center gap-3 mb-8">
                        <GraduationCap weight="duotone" className="w-12 h-12 text-blue-400" />
                        <span className="font-heading text-3xl font-bold text-white">UniProgress</span>
                    </div>
                    <h1 className="font-heading text-4xl sm:text-5xl font-bold text-white leading-tight mb-4">
                        Únete a<br />
                        <span className="text-gradient">UniProgress</span>
                    </h1>
                    <p className="text-gray-400 text-lg max-w-md">
                        Crea tu cuenta y comienza a gestionar tu progreso académico 
                        universitario de forma inteligente.
                    </p>
                </div>
            </div>

            {/* Right side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background overflow-y-auto">
                <Card className="w-full max-w-md border-border bg-card">
                    <CardHeader className="space-y-1">
                        <div className="flex items-center gap-2 lg:hidden mb-4">
                            <GraduationCap weight="duotone" className="w-8 h-8 text-blue-400" />
                            <span className="font-heading text-xl font-bold">UniProgress</span>
                        </div>
                        <CardTitle className="font-heading text-2xl">Crear Cuenta</CardTitle>
                        <CardDescription>
                            Completa el formulario para registrarte
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div 
                                    className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
                                    data-testid="register-error"
                                >
                                    {error}
                                </div>
                            )}
                            
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre Completo</Label>
                                <Input
                                    id="name"
                                    type="text"
                                    placeholder="Juan Pérez"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    data-testid="register-name-input"
                                    className="bg-secondary border-border"
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="email">Correo Electrónico</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="correo@universidad.edu"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    data-testid="register-email-input"
                                    className="bg-secondary border-border"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="studentId">Matrícula (opcional)</Label>
                                <Input
                                    id="studentId"
                                    type="text"
                                    placeholder="2024-0001"
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value)}
                                    data-testid="register-studentid-input"
                                    className="bg-secondary border-border"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Universidad</Label>
                                <Select value={universityId} onValueChange={setUniversityId}>
                                    <SelectTrigger className="bg-secondary border-border" data-testid="university-select">
                                        <SelectValue placeholder="Selecciona tu universidad" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {universities.map(uni => (
                                            <SelectItem key={uni.id} value={uni.id}>
                                                {uni.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {universityId && (
                                <div className="space-y-2">
                                    <Label>Carrera</Label>
                                    <Select value={careerId} onValueChange={setCareerId}>
                                        <SelectTrigger className="bg-secondary border-border" data-testid="career-select">
                                            <SelectValue placeholder="Selecciona tu carrera" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {careers.map(career => (
                                                <SelectItem key={career.id} value={career.id}>
                                                    {career.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            
                            <div className="space-y-2">
                                <Label htmlFor="password">Contraseña</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        data-testid="register-password-input"
                                        className="bg-secondary border-border pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                                <Input
                                    id="confirmPassword"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    data-testid="register-confirm-password-input"
                                    className="bg-secondary border-border"
                                />
                            </div>
                            
                            <Button 
                                type="submit" 
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white"
                                disabled={loading}
                                data-testid="register-submit-button"
                            >
                                {loading ? (
                                    <Spinner className="w-5 h-5 animate-spin" />
                                ) : (
                                    'Crear Cuenta'
                                )}
                            </Button>
                        </form>
                        
                        <div className="mt-6 text-center text-sm">
                            <span className="text-muted-foreground">¿Ya tienes una cuenta? </span>
                            <Link 
                                to="/login" 
                                className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                                data-testid="login-link"
                            >
                                Inicia sesión
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Register;
