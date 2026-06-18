import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, Mail, Lock, Eye, EyeOff, ArrowRight, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'signup' && form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        navigate('/dashboard');
      } else {
        await signup(form.email, form.password, form.fullName);
        setSuccess('Account created! You can now sign in.');
        setMode('login');
        setForm(f => ({ ...f, password: '', confirmPassword: '' }));
      }
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${mode}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg flex flex-col items-center justify-center p-4"
      style={{ background: 'var(--deep-navy)' }}>

      {/* Background glow orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-5"
          style={{ background: '#00D4FF', filter: 'blur(100px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-5"
          style={{ background: '#6B48FF', filter: 'blur(80px)' }} />
      </div>

      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3 fade-in-up">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #00D4FF 0%, #0064A0 100%)',
            boxShadow: '0 0 40px rgba(0,212,255,0.3)',
          }}>
          <Activity className="w-7 h-7 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-wider text-white">SYNEXXUS</h1>
          <p className="text-xs font-mono tracking-widest mt-0.5" style={{ color: '#00D4FF' }}>
            REAL-TIME MARKET TERMINAL
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md glass-card p-8 fade-in-up fade-in-up-delay-1"
        style={{ border: '1px solid rgba(0,212,255,0.15)' }}>

        {/* Tab Toggle */}
        <div className="flex rounded-xl p-1 mb-7"
          style={{ background: 'rgba(5,11,20,0.6)' }}>
          {['login', 'signup'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setSuccess(''); }}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: mode === m ? 'rgba(0,212,255,0.15)' : 'transparent',
                color: mode === m ? '#00D4FF' : '#4A6080',
                border: mode === m ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
              }}
            >
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name — signup only */}
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: '#8BAFC8' }}>
                Full Name
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base" style={{ color: '#4A6080' }}>✦</span>
                <input
                  type="text"
                  name="fullName"
                  id="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  required
                  autoComplete="name"
                  placeholder="Your full name"
                  className="input-field pl-10"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#8BAFC8' }}>
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: '#4A6080' }} />
              <input
                type="email"
                name="email"
                id="email"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
                placeholder="analyst@trading.com"
                className="input-field pl-10"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#8BAFC8' }}>
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: '#4A6080' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                id="password"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••••"
                className="input-field pl-10 pr-10"
              />
              <button type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: '#4A6080' }}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password (signup only) */}
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: '#8BAFC8' }}>
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: '#4A6080' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  id="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••••"
                  className="input-field pl-10"
                />
              </div>
            </div>
          )}

          {/* Error / Success */}
          {error && (
            <div className="rounded-lg p-3 text-sm"
              style={{ background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.25)', color: '#FF4D6D' }}>
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg p-3 text-sm"
              style={{ background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.25)', color: '#00E5A0' }}>
              {success}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            id={mode === 'login' ? 'login-submit-btn' : 'signup-submit-btn'}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: '#050B14', borderTopColor: 'transparent' }} />
                {mode === 'login' ? 'Authenticating...' : 'Creating Account...'}
              </span>
            ) : (
              <>
                {mode === 'login' ? 'Access Terminal' : 'Create Account'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer stats */}
      <div className="mt-8 flex items-center gap-6 fade-in-up fade-in-up-delay-2">
        {[
          { label: 'Assets Tracked', value: '3+' },
          { label: 'Alerts Fired', value: '∞' },
          { label: 'Latency', value: '<5ms' },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <div className="text-sm font-bold font-mono" style={{ color: '#00D4FF' }}>{value}</div>
            <div className="text-xs" style={{ color: '#4A6080' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoginPage;
