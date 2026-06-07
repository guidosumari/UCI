
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';

type Tab = 'login' | 'register';

const LoginScreen: React.FC = () => {
    const [tab, setTab] = useState<Tab>('login');
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
    const navigate = useNavigate();

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setFullName('');
        setMessage(null);
        setShowPassword(false);
    };

    const switchTab = (t: Tab) => {
        setTab(t);
        resetForm();
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            navigate('/');
        } catch (error: any) {
            const msg = error.message?.includes('Invalid login credentials')
                ? 'Correo o contraseña incorrectos.'
                : error.message || 'Ocurrió un error inesperado.';
            setMessage({ type: 'error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'Las contraseñas no coinciden.' });
            return;
        }
        if (password.length < 6) {
            setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' });
            return;
        }
        setLoading(true);
        setMessage(null);
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName } },
            });
            if (error) throw error;

            if (data.session) {
                navigate('/');
                return;
            }

            // Intentar login inmediato si no hay confirmación requerida
            const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
            if (!loginError) {
                navigate('/');
            } else {
                setMessage({ type: 'success', text: '¡Registro exitoso! Ahora puedes iniciar sesión.' });
                switchTab('login');
            }
        } catch (error: any) {
            const msg = error.message?.includes('already registered')
                ? 'Este correo ya está registrado. Inicia sesión.'
                : error.message || 'Ocurrió un error inesperado.';
            setMessage({ type: 'error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc] p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center size-12 bg-primary/10 rounded-xl text-primary mb-4">
                        <span className="material-symbols-outlined text-3xl">local_hospital</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">MediSafe ISBAR</h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        {tab === 'login' ? 'Inicia sesión para continuar con tu guardia' : 'Crea tu cuenta para comenzar'}
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
                    <button
                        type="button"
                        onClick={() => switchTab('login')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Iniciar Sesión
                    </button>
                    <button
                        type="button"
                        onClick={() => switchTab('register')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'register' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Crear Cuenta
                    </button>
                </div>

                {/* Mensaje */}
                {message && (
                    <div className={`p-4 rounded-xl text-sm font-bold mb-6 flex items-start gap-3 ${message.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-red-50 text-red-700 border border-red-100'}`}>
                        <span className="material-symbols-outlined text-lg">
                            {message.type === 'success' ? 'check_circle' : 'error'}
                        </span>
                        {message.text}
                    </div>
                )}

                {/* LOGIN */}
                {tab === 'login' && (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Correo Electrónico</label>
                            <input
                                id="login-email"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 font-medium text-slate-800 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                                placeholder="nombre@hospital.com"
                                autoComplete="email"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Contraseña</label>
                            <div className="relative">
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    className="w-full h-12 px-4 pr-12 rounded-xl border border-slate-200 font-medium text-slate-800 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    tabIndex={-1}
                                >
                                    <span className="material-symbols-outlined text-xl">
                                        {showPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <button
                            id="login-submit"
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-lg shadow-primary/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                        >
                            {loading
                                ? <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : 'Iniciar Sesión'}
                        </button>

                        <p className="text-center text-sm text-slate-400 mt-2">
                            ¿No tienes cuenta?{' '}
                            <button type="button" onClick={() => switchTab('register')} className="font-bold text-primary hover:underline">
                                Regístrate gratis
                            </button>
                        </p>
                    </form>
                )}

                {/* REGISTER */}
                {tab === 'register' && (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Nombre Completo</label>
                            <input
                                id="register-name"
                                type="text"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                required
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 font-medium text-slate-800 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                                placeholder="Dr. Juan Pérez"
                                autoComplete="name"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Correo Electrónico</label>
                            <input
                                id="register-email"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 font-medium text-slate-800 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                                placeholder="nombre@hospital.com"
                                autoComplete="email"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Contraseña</label>
                            <div className="relative">
                                <input
                                    id="register-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="w-full h-12 px-4 pr-12 rounded-xl border border-slate-200 font-medium text-slate-800 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                                    placeholder="Mínimo 6 caracteres"
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    tabIndex={-1}
                                >
                                    <span className="material-symbols-outlined text-xl">
                                        {showPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                            {/* Barra de fortaleza */}
                            {password.length > 0 && (
                                <div className="mt-2 flex gap-1">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
                                            i === 1 ? (password.length >= 1 ? (password.length < 6 ? 'bg-red-400' : 'bg-emerald-400') : 'bg-slate-200')
                                            : i === 2 ? (password.length >= 6 ? (password.length < 10 ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-slate-200')
                                            : (password.length >= 10 ? 'bg-emerald-500' : 'bg-slate-200')
                                        }`} />
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Confirmar Contraseña</label>
                            <input
                                id="register-confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                                className={`w-full h-12 px-4 rounded-xl border font-medium text-slate-800 focus:ring-4 transition-all outline-none ${
                                    confirmPassword && confirmPassword !== password
                                        ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                        : 'border-slate-200 focus:border-primary focus:ring-primary/10'
                                }`}
                                placeholder="Repite tu contraseña"
                                autoComplete="new-password"
                            />
                            {confirmPassword && confirmPassword !== password && (
                                <p className="text-xs text-red-500 font-semibold mt-1">Las contraseñas no coinciden</p>
                            )}
                        </div>

                        <button
                            id="register-submit"
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-lg shadow-primary/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                        >
                            {loading
                                ? <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : 'Crear Cuenta'}
                        </button>

                        <p className="text-center text-sm text-slate-400 mt-2">
                            ¿Ya tienes cuenta?{' '}
                            <button type="button" onClick={() => switchTab('login')} className="font-bold text-primary hover:underline">
                                Iniciar sesión
                            </button>
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
};

export default LoginScreen;
