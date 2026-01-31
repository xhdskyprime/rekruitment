import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const location = useLocation();

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
        <header className="bg-white shadow-md sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              {/* Logo Section */}
              <div className="flex items-center space-x-4">
                <img 
                  src="/logo-rsud.png" 
                  alt="Logo RSUD Tigaraksa" 
                  className="h-16 w-auto drop-shadow-sm"
                />
                <div className="hidden md:block">
                  <h1 className="text-xl font-bold text-black tracking-wide">RSUD TIGARAKSA</h1>
                  <h2 className="text-lg font-semibold text-gray-700">KABUPATEN TANGERANG</h2>
                </div>
              </div>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex space-x-8">
                <Link 
                  to="/" 
                  className={`font-medium transition-colors duration-200 ${isActive('/') ? 'text-tangerang-purple font-bold' : 'text-gray-600 hover:text-tangerang-purple'}`}
                >
                  Pendaftaran
                </Link>
                <Link 
                  to="/status" 
                  className={`font-medium transition-colors duration-200 ${isActive('/status') ? 'text-tangerang-purple font-bold' : 'text-gray-600 hover:text-tangerang-purple'}`}
                >
                  Cek Status
                </Link>
                <Link 
                  to="/login" 
                  className={`px-4 py-2 rounded-full border border-tangerang-purple text-tangerang-purple hover:bg-tangerang-purple hover:text-white transition-all duration-300 text-sm font-medium ${isActive('/login') ? 'bg-tangerang-purple text-white' : ''}`}
                >
                  Login Admin
                </Link>
              </nav>

              {/* Mobile Menu Button */}
              <button 
                className="md:hidden text-gray-600 hover:text-tangerang-purple focus:outline-none"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden bg-white border-t py-4 px-4 space-y-4 shadow-lg animate-in slide-in-from-top-5">
              <Link to="/" className="block py-2 text-gray-700 font-medium hover:text-tangerang-purple" onClick={() => setIsMenuOpen(false)}>Pendaftaran</Link>
              <Link to="/status" className="block py-2 text-gray-700 font-medium hover:text-tangerang-purple" onClick={() => setIsMenuOpen(false)}>Cek Status</Link>
              <Link to="/login" className="block py-2 text-tangerang-purple font-bold" onClick={() => setIsMenuOpen(false)}>Login Admin</Link>
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
        </div>
      </footer>
    </div>
  );
};

export default Layout;
