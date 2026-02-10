import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const location = useLocation();
  const { recruitmentPhase } = useConfig();

  const isActive = (path: string) => location.pathname === path;
  const isAdminRoute = location.pathname.startsWith('/admin');

  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-800">
      {/* Top Bar removed as requested */}

      {/* Main Header */}
      {!isAdminRoute && (
        <header className="bg-white/90 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-gray-100 transition-all duration-300">
          <div className="container mx-auto px-4 lg:px-8 py-3">
            <div className="flex justify-between items-center">
              {/* Logo Section */}
              <Link to="/" className="flex items-center gap-4 group">
                <div className="relative">
                  <div className="absolute inset-0 bg-tangerang-purple/10 rounded-full blur-lg group-hover:bg-tangerang-purple/20 transition-all"></div>
                  <img 
                    src="/logo-rsud.png" 
                    alt="Logo RSUD Tigaraksa" 
                    className="h-14 w-auto drop-shadow-sm relative z-10 transition-transform group-hover:scale-105"
                  />
                </div>
                <div className="hidden md:flex flex-col">
                  <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-tight group-hover:text-tangerang-purple transition-colors">RSUD TIGARAKSA</h1>
                  <span className="text-xs font-medium text-gray-500 tracking-widest uppercase border-l-2 border-tangerang-gold pl-2 mt-0.5">Kabupaten Tangerang</span>
                </div>
              </Link>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center gap-1">
                {recruitmentPhase === 'registration' && (
                  <Link 
                    to="/" 
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${isActive('/') ? 'bg-tangerang-purple text-white shadow-md shadow-purple-200' : 'text-gray-600 hover:bg-gray-50 hover:text-tangerang-purple'}`}
                  >
                    Pendaftaran
                  </Link>
                )}
                
                {recruitmentPhase === 'announcement' && (
                  <Link 
                    to="/status" 
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${isActive('/status') ? 'bg-tangerang-purple text-white shadow-md shadow-purple-200' : 'text-gray-600 hover:bg-gray-50 hover:text-tangerang-purple'}`}
                  >
                    Cek Status
                  </Link>
                )}
              </nav>

              {/* Mobile Menu Button */}
              <button 
                className="md:hidden p-2 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-tangerang-purple focus:outline-none transition-colors"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden bg-white border-t py-4 px-4 space-y-4 shadow-lg animate-in slide-in-from-top-5">
              {recruitmentPhase === 'registration' && (
                <Link to="/" className="block py-2 text-gray-700 font-medium hover:text-tangerang-purple" onClick={() => setIsMenuOpen(false)}>Pendaftaran</Link>
              )}
              {recruitmentPhase === 'announcement' && (
                <Link to="/status" className="block py-2 text-gray-700 font-medium hover:text-tangerang-purple" onClick={() => setIsMenuOpen(false)}>Cek Status</Link>
              )}
            </div>
          )}
        </header>
      )}

      {/* Main Content */}
      <main className="flex-grow bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-gray-300 py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="mb-2">&copy; 2026 Pemerintah Kabupaten Tangerang - UPTD RSUD Tigaraksa</p>
          <p className="text-sm text-gray-500">Sistem Informasi Rekrutmen Pegawai BLUD</p>
          <Link to="/portal-rsud-secure-auth" className="text-slate-700 hover:text-slate-500 cursor-pointer text-xs inline-block mt-1 transition-colors px-1">!</Link>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
