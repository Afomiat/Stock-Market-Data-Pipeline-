import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Mail, Lock, Eye, EyeOff, ArrowRight, User } from 'lucide-react';
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
      const serverMsg = err.response?.data?.error || '';
      // Map common backend errors to user-friendly messages
      if (serverMsg.toLowerCase().includes('duplicate') || serverMsg.toLowerCase().includes('unique constraint')) {
        setError('This email is already registered. Please sign in instead.');
      } else if (err.response?.status === 401) {
        setError('Invalid email or password. Please try again.');
      } else if (err.response?.status === 400) {
        setError(serverMsg || 'Please check your details and try again.');
      } else if (!err.response) {
        setError('Cannot connect to server. Please check your internet connection.');
      } else {
        setError(serverMsg || `Failed to ${mode}. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#050B14] font-sans text-white overflow-hidden">
      
      {/* Left Pane: Image/Branding (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-12">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/auth-bg.png')" }}
        >
          {/* Subtle gradient overlay to blend into the right pane */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#050B14]"></div>
          {/* Top/Bottom gradient for cinematic feel */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#050B14]/40 via-transparent to-[#050B14]/80"></div>
        </div>

        <div className="relative z-10 fade-in-up">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
            style={{
              background: 'linear-gradient(135deg, #00D4FF 0%, #0064A0 100%)',
              boxShadow: '0 0 40px rgba(0,212,255,0.4)',
            }}>
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-black tracking-wider text-white mb-2" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>SYNEXXUS</h1>
          <p className="text-sm font-mono tracking-widest text-[#00D4FF]">INSTITUTIONAL GRADE TERMINAL</p>
        </div>

        <div className="relative z-10 mt-auto fade-in-up-delay-2">
          <h2 className="text-5xl font-bold leading-tight mb-4" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            Trade The Future.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D4FF] to-[#6B48FF]">With Zero Delay.</span>
          </h2>
          <p className="text-[#8BAFC8] text-lg max-w-md">
            Experience real-time market data, advanced analytics, and lightning-fast execution in one seamless platform.
          </p>
        </div>
      </div>

      {/* Right Pane: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative z-10">
        
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-10 pointer-events-none"
             style={{ background: '#00D4FF', filter: 'blur(150px)', transform: 'translate(20%, -20%)' }} />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full opacity-10 pointer-events-none"
             style={{ background: '#6B48FF', filter: 'blur(150px)', transform: 'translate(-20%, 20%)' }} />

        <div className="w-full max-w-md">
          {/* Mobile Logo (Visible only on mobile) */}
          <div className="lg:hidden flex flex-col items-center mb-10 fade-in-up">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: 'linear-gradient(135deg, #00D4FF 0%, #0064A0 100%)',
                boxShadow: '0 0 30px rgba(0,212,255,0.3)',
              }}>
              <Activity className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-wider text-white">SYNEXXUS</h1>
          </div>

          {/* Glassmorphic Form Container */}
          <div className="glass-card p-8 md:p-10 fade-in-up-delay-1"
               style={{ 
                 background: 'linear-gradient(135deg, rgba(15,30,53,0.6) 0%, rgba(10,22,40,0.8) 100%)',
                 border: '1px solid rgba(0,212,255,0.2)',
                 boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)'
               }}>
            
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">
                {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
              </h2>
              <p className="text-[#8BAFC8] text-sm">
                {mode === 'login' ? 'Enter your credentials to access the terminal.' : 'Join the next generation of traders.'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold mb-2 uppercase tracking-wider text-[#8BAFC8]">
                    Full Name
                  </label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#4A6080] group-focus-within:text-[#00D4FF] transition-colors" />
                    <input
                      type="text"
                      name="fullName"
                      value={form.fullName}
                      onChange={handleChange}
                      required
                      placeholder="John Doe"
                      className="w-full bg-[#0A1628]/80 border border-[#00D4FF]/20 rounded-xl py-3 pl-12 pr-4 text-white placeholder-[#4A6080] focus:outline-none focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] transition-all"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-2 uppercase tracking-wider text-[#8BAFC8]">
                  Email Address
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#4A6080] group-focus-within:text-[#00D4FF] transition-colors" />
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    placeholder="analyst@trading.com"
                    className="w-full bg-[#0A1628]/80 border border-[#00D4FF]/20 rounded-xl py-3 pl-12 pr-4 text-white placeholder-[#4A6080] focus:outline-none focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2 uppercase tracking-wider text-[#8BAFC8]">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#4A6080] group-focus-within:text-[#00D4FF] transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    placeholder="••••••••"
                    className="w-full bg-[#0A1628]/80 border border-[#00D4FF]/20 rounded-xl py-3 pl-12 pr-12 text-white placeholder-[#4A6080] focus:outline-none focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] transition-all"
                  />
                  <button type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4A6080] hover:text-[#00D4FF] transition-colors">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold mb-2 uppercase tracking-wider text-[#8BAFC8]">
                    Confirm Password
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#4A6080] group-focus-within:text-[#00D4FF] transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      required
                      placeholder="••••••••"
                      className="w-full bg-[#0A1628]/80 border border-[#00D4FF]/20 rounded-xl py-3 pl-12 pr-4 text-white placeholder-[#4A6080] focus:outline-none focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Error / Success Messages */}
              {error && (
                <div className="rounded-lg p-4 text-sm flex items-center gap-2"
                  style={{ background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.2)', color: '#FF4D6D' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF4D6D]"></div>
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg p-4 text-sm flex items-center gap-2"
                  style={{ background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.2)', color: '#00E5A0' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00E5A0]"></div>
                  {success}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-[#050B14] flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
                style={{ 
                  background: 'linear-gradient(135deg, #00D4FF 0%, #0094B3 100%)',
                  boxShadow: '0 10px 20px -5px rgba(0,212,255,0.4)'
                }}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-t-transparent border-[#050B14] rounded-full animate-spin" />
                    {mode === 'login' ? 'Authenticating...' : 'Creating Account...'}
                  </span>
                ) : (
                  <>
                    {mode === 'login' ? 'Sign In Securely' : 'Create Free Account'}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center border-t border-[#1E2D4A] pt-6">
              <p className="text-[#8BAFC8] text-sm">
                {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <button type="button" 
                  onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setSuccess(''); }}
                  className="text-[#00D4FF] font-semibold hover:text-white transition-colors">
                  {mode === 'login' ? 'Sign up' : 'Log in'}
                </button>
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
