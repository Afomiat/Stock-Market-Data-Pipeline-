import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart2, Bell, LayoutDashboard, LogOut, Menu, X, Zap,
  AlertCircle, TrendingUp, Activity
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Navbar = ({ connected, alertCount }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/alerts', label: 'Alerts', icon: AlertCircle },
    { to: '/notifications', label: 'Notifications', icon: Bell },
  ];

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'SX';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5"
      style={{ background: 'rgba(5,11,20,0.92)', backdropFilter: 'blur(24px)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #00D4FF 0%, #0064A0 100%)' }}>
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-black tracking-wider text-white">
              SYNEXXUS
              <span className="ml-1 font-light text-sm tracking-widest"
                style={{ color: '#00D4FF' }}>TERMINAL</span>
            </span>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `nav-link flex items-center gap-2 ${isActive ? 'active' : ''}`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </div>

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-4">
            {/* WS Status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-500'}`}
                style={connected ? { boxShadow: '0 0 8px rgba(0,229,160,0.8)', animation: 'pulse 2s infinite' } : {}} />
              <span className="text-xs font-mono"
                style={{ color: connected ? '#00E5A0' : '#FF4D6D' }}>
                {connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>

            {/* Notifications bell */}
            <NavLink to="/notifications" className="relative p-2 rounded-lg hover:bg-white/5 transition-colors">
              <Bell className="w-5 h-5" style={{ color: '#8BAFC8' }} />
              {alertCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center text-white"
                  style={{ background: '#FF4D6D', fontSize: '10px' }}>
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </NavLink>

            {/* User Avatar */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #00D4FF 0%, #6B48FF 100%)' }}
              >
                {initials}
              </button>
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 py-1 shadow-xl"
                  style={{ background: '#0A1628' }}>
                  <div className="px-4 py-2 text-xs" style={{ color: '#8BAFC8' }}>
                    {user?.email || 'User'}
                  </div>
                  <hr className="border-white/10 my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/5 transition-colors text-left"
                    style={{ color: '#FF4D6D' }}
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Toggle */}
          <button className="md:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/5 py-4 px-4"
          style={{ background: 'rgba(10,22,40,0.98)' }}>
          {navLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${isActive
                  ? 'text-cyan-400 bg-cyan-400/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left transition-colors hover:bg-white/5"
            style={{ color: '#FF4D6D' }}>
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
