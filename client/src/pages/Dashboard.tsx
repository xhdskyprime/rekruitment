import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  Users, CheckCircle, XCircle, FileText, Pencil, 
  LogOut, Search, Clock, Menu, LayoutDashboard, Shield, User, Printer, ChevronDown, ChevronRight, ChevronLeft, X, QrCode, Camera, CameraOff, Trash2, Briefcase, Database, Settings
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import Swal from 'sweetalert2';
import { useConfig } from '../contexts/ConfigContext';

interface Applicant {
  id: number;
  name: string;
  nik: string;
  gender: string;
  birthDate?: string;
  birthPlace?: string;
  education: string;
  institution?: string;
  major?: string;
  gpa?: number;
  email: string;
  phoneNumber?: string;
  position: string;
  status: string;
  ktpPath: string;
  ijazahPath: string;
  strPath: string;
  sertifikatPath: string;
  ktpStatus: string;
  ijazahStatus: string;
  strStatus: string;
  sertifikatStatus: string;
  ktpVerifiedAt?: string;
  ktpVerifiedBy?: string;
  ijazahVerifiedAt?: string;
  ijazahVerifiedBy?: string;
  strVerifiedAt?: string;
  strVerifiedBy?: string;
  sertifikatVerifiedAt?: string;
  sertifikatVerifiedBy?: string;
  suratPernyataanPath: string;
  suratPernyataanStatus: string;
  suratPernyataanVerifiedAt?: string;
  suratPernyataanVerifiedBy?: string;
  ktpRejectReason?: string;
  ijazahRejectReason?: string;
  strRejectReason?: string;
  sertifikatRejectReason?: string;
  suratPernyataanRejectReason?: string;
  suratLamaranPath: string;
  suratLamaranStatus: string;
  suratLamaranVerifiedAt?: string;
  suratLamaranVerifiedBy?: string;
  suratLamaranRejectReason?: string;
  cvPath: string;
  cvStatus: string;
  cvVerifiedAt?: string;
  cvVerifiedBy?: string;
  cvRejectReason?: string;
  pasFotoPath?: string;
  examCardPath: string | null;
  createdAt: string;
  attendanceStatus?: 'absent' | 'present';
  attendanceTime?: string;
  sessionId?: number;
  Session?: {
    id: number;
    name: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
  };
}

interface AdminUser {
  id: number;
  username: string;
  role: 'superadmin' | 'verificator';
  createdAt: string;
}

interface PositionItem {
  id: number;
  name: string;
  createdAt: string;
}

interface SessionItem {
  id: number;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number;
  createdAt: string;
}

interface Pagination {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

interface Stats {
  total: number;
  pending: number;
  verified: number;
  rejected: number;
  present: number;
  absent: number;
}

const Dashboard = () => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPhase, setCurrentPhase] = useState<'registration' | 'verification' | 'announcement'>('registration');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] = useState<Pagination>({ totalItems: 0, totalPages: 1, currentPage: 1, limit: 20 });
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, verified: 0, rejected: 0, present: 0, absent: 0 });
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>('');
  
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [previewFile, setPreviewFile] = useState<{ type: string, label: string, url: string, status: string, verifiedAt?: string, verifiedBy?: string, rejectReason?: string } | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<number | ''>('');
  const [activeTab, setActiveTab] = useState<'applicants' | 'verification' | 'users' | 'attendance' | 'positions' | 'sessions' | 'schedule' | 'settings'>('applicants');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMasterMenuOpen, setMasterMenuOpen] = useState(true);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [scheduleFilterSessionId, setScheduleFilterSessionId] = useState<number | '' | 'UNASSIGNED'>('');
  const [capacityPrompt, setCapacityPrompt] = useState<{ open: boolean, applicantId?: number, sessionId?: number, sessionName?: string, assigned?: number, capacity?: number }>({ open: false });
  const [scheduleCarouselIndex, setScheduleCarouselIndex] = useState(0);
  const [editingPosition, setEditingPosition] = useState<PositionItem | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  
  // Attendance State
  const [scanInput, setScanInput] = useState('');
  const [lastScanned, setLastScanned] = useState<{name: string, status: 'success' | 'error' | 'warning', message: string} | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  // User Management State
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'verificator' });
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [newPosition, setNewPosition] = useState<string>('');

  // Session Master State
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [newSession, setNewSession] = useState({ 
    name: '', 
    date: '', 
    startTime: '', 
    endTime: '', 
    location: '', 
    capacity: 0 
  });
  const [editingSession, setEditingSession] = useState<SessionItem | null>(null);

  const navigate = useNavigate();
  const { refreshConfig } = useConfig();

  const calculateAgeAtRegistration = (birthDate: string | undefined, registrationDate: string) => {
    if (!birthDate) return '-';
    
    const birth = new Date(birthDate);
    const registration = new Date(registrationDate);
    
    let age = registration.getFullYear() - birth.getFullYear();
    const m = registration.getMonth() - birth.getMonth();
    
    if (m < 0 || (m === 0 && registration.getDate() < birth.getDate())) {
        age--;
    }
    
    return age + ' Tahun';
  };

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  useEffect(() => {
    setPage(1);
    setFilterStatus(activeTab === 'schedule' ? 'verified' : '');
    if (activeTab === 'schedule' && sessions.length === 0) {
      fetchSessions();
    }
    if (activeTab === 'schedule') {
      setScheduleCarouselIndex(0);
    }
  }, [activeTab]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch data when dependencies change (immediate)
  useEffect(() => {
    if (currentUserRole) fetchApplicants();
  }, [page, debouncedSearch, activeTab, currentUserRole, filterStatus]);

  const fetchApplicants = async () => {
    try {
      const params: any = {
        page,
        limit: 20,
        search: searchTerm
      };

      if (filterStatus) {
        params.status = filterStatus;
      }

      if (activeTab === 'attendance') {
        params.attendanceStatus = 'present';
      }

      const response = await axios.get('/admin', { params, withCredentials: true });
      setApplicants(response.data.applicants);
      setPagination(response.data.pagination);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Failed to fetch applicants', error);
    }
  };

  const checkAuthAndFetch = async () => {
    try {
      // Check auth first to get role
      const authRes = await axios.get('/admin/check-auth', { withCredentials: true });
      if (!authRes.data.authenticated) {
        navigate('/login');
        return;
      }
      setCurrentUserRole(authRes.data.role);
      setCurrentUsername(authRes.data.username || 'Admin');

      // Fetch applicants is handled by useEffect now

      // If superadmin, fetch users
      if (authRes.data.role === 'superadmin') {
          fetchUsers();
          fetchPositions();
          fetchSessions();
      }
      fetchSettings();
    } catch (error: any) {
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPositions = async () => {
    try {
      const res = await axios.get('/admin/positions', { withCredentials: true });
      setPositions(res.data.positions || []);
    } catch (error) {
      console.error('Failed to fetch positions', error);
    }
  };

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const name = newPosition.trim();
      if (!name) return;
      if (editingPosition) {
        await axios.put(`/admin/positions/${editingPosition.id}`, { name }, { withCredentials: true });
        setEditingPosition(null);
        Swal.fire('Berhasil', 'Posisi berhasil diperbarui', 'success');
      } else {
        await axios.post('/admin/positions', { name }, { withCredentials: true });
        Swal.fire('Berhasil', 'Posisi berhasil ditambah', 'success');
      }
      setNewPosition('');
      fetchPositions();
    } catch (error: any) {
      Swal.fire('Gagal', error.response?.data?.error || 'Gagal menyimpan posisi', 'error');
    }
  };

  const handleDeletePosition = async (id: number) => {
    if (!confirm('Yakin hapus posisi ini?')) return;
    try {
      await axios.delete(`/admin/positions/${id}`, { withCredentials: true });
      fetchPositions();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Gagal menghapus posisi');
    }
  };

  const startEditPosition = (pos: PositionItem) => {
    setEditingPosition(pos);
    setNewPosition(pos.name);
  };

  const cancelEditPosition = () => {
    setEditingPosition(null);
    setNewPosition('');
  };

  const fetchUsers = async () => {
    try {
        const res = await axios.get('/admin/users', { withCredentials: true });
        setAdminUsers(res.data.admins);
    } catch (error) {
        console.error('Failed to fetch users', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        await axios.post('/admin/users', newUser, { withCredentials: true });
        setNewUser({ username: '', password: '', role: 'verificator' });
        fetchUsers();
        alert('User berhasil dibuat');
    } catch (error: any) {
        alert(error.response?.data?.error || 'Gagal membuat user');
    }
  };

  const startEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setNewUser({ username: user.username, password: '', role: user.role });
  };

  const cancelEditUser = () => {
    setEditingUser(null);
    setNewUser({ username: '', password: '', role: 'verificator' });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const payload: any = { username: newUser.username, role: newUser.role };
      if (newUser.password && newUser.password.trim().length > 0) {
        payload.password = newUser.password.trim();
      }
      await axios.put(`/admin/users/${editingUser.id}`, payload, { withCredentials: true });
      setEditingUser(null);
      setNewUser({ username: '', password: '', role: 'verificator' });
      fetchUsers();
      Swal.fire('Berhasil', 'User berhasil diperbarui', 'success');
    } catch (error: any) {
      Swal.fire('Gagal', error.response?.data?.error || 'Gagal memperbarui user', 'error');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Yakin ingin menghapus user ini?')) return;
    try {
        await axios.delete(`/admin/users/${id}`, { withCredentials: true });
        fetchUsers();
    } catch (error: any) {
        alert(error.response?.data?.error || 'Gagal menghapus user');
    }
  };

  const handleUpdateRole = async (id: number, newRole: string) => {
    try {
      await axios.put(`/admin/users/${id}/role`, { role: newRole }, { withCredentials: true });
      // Update local state without refetching entire list for smoother UX
      setAdminUsers(prev => prev.map(user => 
        user.id === id ? { ...user, role: newRole as 'superadmin' | 'verificator' } : user
      ));
    } catch (error: any) {
      alert(error.response?.data?.error || 'Gagal mengubah role');
      // Revert change by refetching
      fetchUsers();
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get('/api/settings');
      if (res.data.recruitmentPhase) {
        setCurrentPhase(res.data.recruitmentPhase);
      }
    } catch (error) {
      console.error('Fetch settings error', error);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await axios.get('/admin/sessions', { withCredentials: true });
      setSessions(res.data.sessions || []);
    } catch (error) {
      console.error('Failed to fetch sessions', error);
    }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/admin/sessions', newSession, { withCredentials: true });
      setNewSession({ name: '', date: '', startTime: '', endTime: '', location: '', capacity: 0 });
      fetchSessions();
      Swal.fire('Berhasil', 'Sesi berhasil ditambah', 'success');
    } catch (error: any) {
      Swal.fire('Gagal', error.response?.data?.error || 'Gagal menambah sesi', 'error');
    }
  };

  const handleUpdateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;
    try {
      await axios.put(`/admin/sessions/${editingSession.id}`, editingSession, { withCredentials: true });
      setEditingSession(null);
      fetchSessions();
      Swal.fire('Berhasil', 'Sesi berhasil diperbarui', 'success');
    } catch (error: any) {
      Swal.fire('Gagal', error.response?.data?.error || 'Gagal memperbarui sesi', 'error');
    }
  };

  const handleDeleteSession = async (id: number) => {
    const result = await Swal.fire({
      title: 'Yakin hapus sesi ini?',
      text: "Data yang terkait mungkin akan terpengaruh",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`/admin/sessions/${id}`, { withCredentials: true });
        fetchSessions();
        Swal.fire('Dihapus', 'Sesi berhasil dihapus', 'success');
      } catch (error: any) {
        Swal.fire('Gagal', error.response?.data?.error || 'Gagal menghapus sesi', 'error');
      }
    }
  };

  const updatePhase = async (phase: 'registration' | 'verification' | 'announcement') => {
    try {
      console.log('Updating phase to:', phase);
      await axios.put('/admin/settings', { recruitmentPhase: phase }, { withCredentials: true });
      setCurrentPhase(phase);
      await refreshConfig(); // Update global config
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Fase rekrutmen berhasil diperbarui',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Update settings error', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal',
        text: 'Gagal memperbarui fase rekrutmen'
      });
    }
  };

  const processAttendance = async (id: string) => {
    if (!id.trim()) return;

    try {
      const res = await axios.post('/admin/attendance', { applicantId: id }, { withCredentials: true });
      const { applicant, alreadyPresent } = res.data;
      
      setLastScanned({
        name: applicant.name,
        status: alreadyPresent ? 'warning' : 'success',
        message: res.data.message
      });
      
      // Update local state immediately
      setApplicants(prev => {
        const exists = prev.some(app => app.id === applicant.id);
        if (exists) {
            return prev.map(app => 
                app.id === applicant.id ? { ...app, attendanceStatus: 'present', attendanceTime: new Date().toISOString() } : app
            );
        } else {
            // Add to list if not exists (so it appears in history)
            // Ensure we have minimal required fields or full object
            return [{ ...applicant, attendanceStatus: 'present', attendanceTime: new Date().toISOString() }, ...prev];
        }
      });

      // Update stats immediately
      if (!alreadyPresent) {
        setStats(prev => ({
          ...prev,
          present: prev.present + 1,
          absent: Math.max(0, prev.absent - 1)
        }));
      }
      
      setScanInput(''); // Clear input for next scan
      if (showScanner) setShowScanner(false);

      // Popup Feedback
      Swal.fire({
        icon: alreadyPresent ? 'warning' : 'success',
        title: alreadyPresent ? 'Sudah Hadir' : 'Berhasil!',
        text: `${applicant.name} - ${res.data.message}`,
        timer: 2000,
        showConfirmButton: false,
        position: 'center'
      });

    } catch (error: any) {
      setLastScanned({
        name: 'Unknown',
        status: 'error',
        message: error.response?.data?.error || 'Gagal memproses data'
      });
      setScanInput('');
      if (showScanner) setShowScanner(false);

      Swal.fire({
        icon: 'error',
        title: 'Gagal',
        text: error.response?.data?.error || 'Gagal memproses data'
      });
    }
  };

  const handleResetAttendance = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus SEMUA data riwayat scan? Data yang sudah dihapus tidak dapat dikembalikan.')) {
      return;
    }

    try {
      await axios.post('/admin/reset-attendance', {}, { withCredentials: true });
      
      // Update local state
      setApplicants(prev => prev.map(app => ({
        ...app,
        attendanceStatus: 'absent',
        attendanceTime: undefined
      })));
      
      setStats(prev => ({
        ...prev,
        present: 0,
        absent: prev.total // Simplified assumption, or better: prev.present + prev.absent
      }));

      // Re-fetch to be sure
      fetchApplicants();

      alert('Data absensi berhasil direset');
    } catch (error) {
      console.error('Failed to reset attendance', error);
      alert('Gagal mereset data absensi');
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    await processAttendance(scanInput);
  };

  useEffect(() => {
    const cleanupScanner = async () => {
        if (scannerRef.current) {
            try {
                if (scannerRef.current.isScanning) {
                    await scannerRef.current.stop();
                }
            } catch (e) {
                console.log("Error stopping scanner", e);
            }
            try {
                scannerRef.current.clear();
            } catch (e) {
                console.log("Error clearing scanner", e);
            }
            scannerRef.current = null;
        }
    };

    if (showScanner && activeTab === 'attendance') {
        // No auto-start, manual start only
    } else {
        cleanupScanner();
    }

    return () => {
        cleanupScanner();
    };
  }, [showScanner, activeTab]);

  const handleStartScanner = async () => {
    setIsStartingCamera(true);
    // Ensure element exists and has dimensions even if hidden
    // We handle visibility via state, but element must be in DOM
    
    // Wait for a small tick to ensure any re-renders if needed (though we keep it in DOM now)
    await new Promise(r => setTimeout(r, 50));

    try {
        const scanner = new Html5Qrcode("reader", {
            formatsToSupport: [ 
                Html5QrcodeSupportedFormats.QR_CODE, 
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.EAN_13
            ],
            verbose: false
        });
        scannerRef.current = scanner;
        
        await scanner.start(
            { facingMode: "environment" },
            { 
                fps: 10, 
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            (decodedText) => {
                processAttendance(decodedText);
                // Optional: Stop after scan? Or keep scanning?
                // Keeping it scanning for bulk attendance
            },
            (_errorMessage) => {
                // ignore
            }
        );
        
        setShowScanner(true);
    } catch (err) {
        console.error("Failed to start camera", err);
        Swal.fire({
            icon: 'error',
            title: 'Gagal Membuka Kamera',
            text: 'Pastikan Anda memberikan izin akses kamera. Coba refresh halaman atau cek pengaturan browser.',
            confirmButtonColor: '#4c1d95'
        });
        setShowScanner(false);
    } finally {
        setIsStartingCamera(false);
    }
  };

  const handleStopScanner = async () => {
      if (scannerRef.current) {
          try {
              await scannerRef.current.stop();
              scannerRef.current.clear();
          } catch (e) {
              console.error(e);
          }
          scannerRef.current = null;
      }
      setShowScanner(false);
  };

  const handleLogout = async () => {
    try {
      await axios.post('/admin/logout', {}, { withCredentials: true });
      navigate('/login');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const handleDeleteApplicant = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data pelamar ini? Tindakan ini tidak dapat dibatalkan.')) return;
    
    try {
      await axios.delete(`/admin/applicant/${id}`, { withCredentials: true });
      // Refresh data
      await fetchApplicants();
    } catch (error: any) {
      console.error('Delete failed', error);
      alert(error.response?.data?.error || 'Gagal menghapus data pelamar');
    }
  };

  const openPreview = (applicant: Applicant, type: string, label: string, path: string, status: string) => {
    setSelectedApplicant(applicant);
    setSelectedSessionId(applicant.sessionId || '');
    
    let verifiedAt, verifiedBy, rejectReason;
    // Map type to property names
    if (type === 'ktp') { 
        verifiedAt = applicant.ktpVerifiedAt; 
        verifiedBy = applicant.ktpVerifiedBy; 
        rejectReason = applicant.ktpRejectReason;
    }
    else if (type === 'ijazah') { 
        verifiedAt = applicant.ijazahVerifiedAt; 
        verifiedBy = applicant.ijazahVerifiedBy; 
        rejectReason = applicant.ijazahRejectReason;
    }
    else if (type === 'str') { 
        verifiedAt = applicant.strVerifiedAt; 
        verifiedBy = applicant.strVerifiedBy; 
        rejectReason = applicant.strRejectReason;
    }
    else if (type === 'sertifikat') { 
        verifiedAt = applicant.sertifikatVerifiedAt; 
        verifiedBy = applicant.sertifikatVerifiedBy; 
        rejectReason = applicant.sertifikatRejectReason;
    }
    else if (type === 'suratPernyataan') {
        verifiedAt = applicant.suratPernyataanVerifiedAt;
        verifiedBy = applicant.suratPernyataanVerifiedBy;
        rejectReason = applicant.suratPernyataanRejectReason;
    }
    else if (type === 'suratLamaran') {
        verifiedAt = applicant.suratLamaranVerifiedAt;
        verifiedBy = applicant.suratLamaranVerifiedBy;
        rejectReason = applicant.suratLamaranRejectReason;
    }

    setRejectReasonInput(rejectReason || '');

    setPreviewFile({
      type,
      label,
      url: path,
      status,
      verifiedAt,
      verifiedBy,
      rejectReason
    });
  };

  const verifyFile = async (status: 'valid' | 'invalid') => {
    if (!selectedApplicant || !previewFile) return;

    let rejectReason = '';
    if (status === 'invalid') {
        if (!rejectReasonInput.trim()) {
            alert('Harap masukkan alasan penolakan.');
            return;
        }
        rejectReason = rejectReasonInput;
    }

    try {
      await axios.post(
        `/admin/verify-file/${selectedApplicant.id}`, 
        { 
          fileType: previewFile.type, 
          status, 
          rejectReason,
          sessionId: selectedSessionId || null
        },
        { withCredentials: true }
      );
      
      // Refresh data
      await fetchApplicants();
      
      // Close modal
      setPreviewFile(null);
      setSelectedApplicant(null);
      setRejectReasonInput('');
    } catch (error: any) {
      console.error('Verification failed', error);
      const msg = error.response?.data?.error || error.message || 'Gagal memverifikasi berkas.';
      alert(msg);
    }
  };

  const handlePrintCard = (applicant: Applicant) => {
    // Open in new tab instead of window.location.href
    window.open(`/api/applicant/${applicant.id}/exam-card?nik=${applicant.nik}`, '_blank');
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className={`bg-white border-r border-gray-200 flex flex-col fixed md:relative z-30 h-full transition-all duration-300 w-64 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-20'}`}>
        <div className={`h-16 flex items-center px-4 border-b border-gray-100 ${!isSidebarOpen && 'justify-center'}`}>
          <div className="w-8 h-8 bg-tangerang-purple rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
            <Shield size={20} />
          </div>
          <span className={`ml-3 font-bold text-gray-800 text-lg transition-opacity duration-200 ${!isSidebarOpen && 'hidden md:hidden'}`}>
            Admin Panel
          </span>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
          <button
            onClick={() => setActiveTab('applicants')}
            className={`w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200 group ${
              activeTab === 'applicants'
                ? 'bg-purple-50 text-tangerang-purple font-medium shadow-sm'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            } ${!isSidebarOpen && 'justify-center'}`}
            title="Data Pelamar"
          >
            <LayoutDashboard className={`w-5 h-5 flex-shrink-0 ${activeTab === 'applicants' ? 'text-tangerang-purple' : 'text-gray-400 group-hover:text-gray-600'}`} />
            <span className={`ml-3 whitespace-nowrap ${!isSidebarOpen && 'hidden md:hidden'}`}>Data Pelamar</span>
          </button>

          <button
            onClick={() => setActiveTab('verification')}
            className={`w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200 group ${
              activeTab === 'verification'
                ? 'bg-purple-50 text-tangerang-purple font-medium shadow-sm'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            } ${!isSidebarOpen && 'justify-center'}`}
            title="Verifikasi Berkas"
          >
            <FileText className={`w-5 h-5 flex-shrink-0 ${activeTab === 'verification' ? 'text-tangerang-purple' : 'text-gray-400 group-hover:text-gray-600'}`} />
            <span className={`ml-3 whitespace-nowrap ${!isSidebarOpen && 'hidden md:hidden'}`}>Verifikasi Berkas</span>
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            className={`w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200 group ${
              activeTab === 'schedule'
                ? 'bg-purple-50 text-tangerang-purple font-medium shadow-sm'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            } ${!isSidebarOpen && 'justify-center'}`}
            title="Atur Jadwal"
          >
            <Clock className={`w-5 h-5 flex-shrink-0 ${activeTab === 'schedule' ? 'text-tangerang-purple' : 'text-gray-400 group-hover:text-gray-600'}`} />
            <span className={`ml-3 whitespace-nowrap ${!isSidebarOpen && 'hidden md:hidden'}`}>Atur Jadwal</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200 group ${
              activeTab === 'attendance'
                ? 'bg-purple-50 text-tangerang-purple font-medium shadow-sm'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            } ${!isSidebarOpen && 'justify-center'}`}
            title="Absensi Ujian"
          >
            <QrCode className={`w-5 h-5 flex-shrink-0 ${activeTab === 'attendance' ? 'text-tangerang-purple' : 'text-gray-400 group-hover:text-gray-600'}`} />
            <span className={`ml-3 whitespace-nowrap ${!isSidebarOpen && 'hidden md:hidden'}`}>Absensi Ujian</span>
          </button>

          {currentUserRole === 'superadmin' && (
            <>
              {isSidebarOpen ? (
                <div className="mt-6">
                  <button
                    onClick={() => setMasterMenuOpen(!isMasterMenuOpen)}
                    className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200 group"
                  >
                    <div className="flex items-center">
                      <Database className="w-5 h-5 flex-shrink-0 text-gray-400 group-hover:text-gray-600" />
                      <span className="ml-3 whitespace-nowrap font-medium">Master Data</span>
                    </div>
                    {isMasterMenuOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </button>

                  {isMasterMenuOpen && (
                    <div className="mt-1 pl-3 space-y-1">
                      <button
                        onClick={() => setActiveTab('positions')}
                        className={`w-full flex items-center px-3 py-2 rounded-lg transition-all duration-200 group text-sm ${
                          activeTab === 'positions'
                            ? 'bg-purple-50 text-tangerang-purple font-medium'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <div className="w-5 flex justify-center mr-2">
                            <Briefcase className={`w-4 h-4 flex-shrink-0 ${activeTab === 'positions' ? 'text-tangerang-purple' : 'text-gray-400'}`} />
                        </div>
                        Posisi Dilamar
                      </button>

                      <button
                        onClick={() => setActiveTab('sessions')}
                        className={`w-full flex items-center px-3 py-2 rounded-lg transition-all duration-200 group text-sm ${
                          activeTab === 'sessions'
                            ? 'bg-purple-50 text-tangerang-purple font-medium'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                         <div className="w-5 flex justify-center mr-2">
                            <Clock className={`w-4 h-4 flex-shrink-0 ${activeTab === 'sessions' ? 'text-tangerang-purple' : 'text-gray-400'}`} />
                         </div>
                        Master Sesi
                      </button>

                      <button
                        onClick={() => setActiveTab('users')}
                        className={`w-full flex items-center px-3 py-2 rounded-lg transition-all duration-200 group text-sm ${
                          activeTab === 'users'
                            ? 'bg-purple-50 text-tangerang-purple font-medium'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                         <div className="w-5 flex justify-center mr-2">
                            <Users className={`w-4 h-4 flex-shrink-0 ${activeTab === 'users' ? 'text-tangerang-purple' : 'text-gray-400'}`} />
                         </div>
                        Manajemen User
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="mt-4 mb-2 h-px bg-gray-100 mx-4"></div>
                  <button
                    onClick={() => setActiveTab('positions')}
                    className={`w-full flex items-center justify-center px-3 py-3 rounded-xl transition-all duration-200 group ${
                      activeTab === 'positions'
                        ? 'bg-purple-50 text-tangerang-purple shadow-sm'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    title="Posisi Dilamar"
                  >
                    <Briefcase className={`w-5 h-5 flex-shrink-0 ${activeTab === 'positions' ? 'text-tangerang-purple' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  </button>

                  <button
                    onClick={() => setActiveTab('sessions')}
                    className={`w-full flex items-center justify-center px-3 py-3 rounded-xl transition-all duration-200 group ${
                      activeTab === 'sessions'
                        ? 'bg-purple-50 text-tangerang-purple shadow-sm'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    title="Master Sesi"
                  >
                    <Clock className={`w-5 h-5 flex-shrink-0 ${activeTab === 'sessions' ? 'text-tangerang-purple' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  </button>

                  <button
                    onClick={() => setActiveTab('users')}
                    className={`w-full flex items-center justify-center px-3 py-3 rounded-xl transition-all duration-200 group ${
                      activeTab === 'users'
                        ? 'bg-purple-50 text-tangerang-purple shadow-sm'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    title="Manajemen User"
                  >
                    <Users className={`w-5 h-5 flex-shrink-0 ${activeTab === 'users' ? 'text-tangerang-purple' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  </button>

                  <button
                    onClick={() => setActiveTab('users')}
                    className={`w-full flex items-center justify-center px-3 py-3 rounded-xl transition-all duration-200 group ${
                      activeTab === 'users'
                        ? 'bg-purple-50 text-tangerang-purple shadow-sm'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    title="Manajemen User"
                  >
                    <Users className={`w-5 h-5 flex-shrink-0 ${activeTab === 'users' ? 'text-tangerang-purple' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  </button>
                </>
              )}
            </>
          )}

          {currentUserRole === 'superadmin' && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200 group ${
              activeTab === 'settings'
                ? 'bg-purple-50 text-tangerang-purple font-medium shadow-sm'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            } ${!isSidebarOpen && 'justify-center'}`}
            title="Pengaturan Website"
          >
            <Settings className={`w-5 h-5 flex-shrink-0 ${activeTab === 'settings' ? 'text-tangerang-purple' : 'text-gray-400 group-hover:text-gray-600'}`} />
            <span className={`ml-3 whitespace-nowrap ${!isSidebarOpen && 'hidden md:hidden'}`}>Pengaturan Website</span>
          </button>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100">
           <div className={`text-xs text-gray-400 text-center ${!isSidebarOpen && 'hidden'}`}>
             v1.0.0
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)} 
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-gray-800">
              {activeTab === 'applicants' ? 'Data Pelamar' : 
               activeTab === 'verification' ? 'Verifikasi Berkas' : 
               activeTab === 'attendance' ? 'Absensi Ujian' : 
               activeTab === 'positions' ? 'Master Posisi' : 
               activeTab === 'sessions' ? 'Master Sesi' : 
               activeTab === 'schedule' ? 'Atur Jadwal' :
               activeTab === 'users' ? 'Manajemen User' : 'Pengaturan Website'}
            </h2>
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-3 pl-6 border-l border-gray-100">
                <div className="text-right hidden sm:block">
                   <p className="text-sm font-bold text-gray-800 leading-none mb-1">{currentUsername || 'Admin'}</p>
                   <p className="text-xs text-gray-500 uppercase font-medium">{currentUserRole}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-100 border-2 border-white shadow-sm flex items-center justify-center text-tangerang-purple font-bold text-lg">
                   {currentUsername ? currentUsername.charAt(0).toUpperCase() : <User size={20} />}
                </div>
                <button 
                  onClick={handleLogout} 
                  className="ml-2 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="Logout"
                >
                   <LogOut className="w-5 h-5" />
                </button>
             </div>
          </div>
        </header>

        {/* Scrollable Content Body */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <div className="max-w-6xl mx-auto">
            {/* Stats Cards - Only show on Applicants or Verification tab */}
            {(activeTab === 'applicants' || activeTab === 'verification') && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center hover:shadow-md transition-shadow">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-xl mr-4">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Total Pelamar</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center hover:shadow-md transition-shadow">
                  <div className="p-3 bg-yellow-100 text-yellow-600 rounded-xl mr-4">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Menunggu</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.pending}
                    </p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center hover:shadow-md transition-shadow">
                  <div className="p-3 bg-green-100 text-green-600 rounded-xl mr-4">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Lolos</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.verified}
                    </p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center hover:shadow-md transition-shadow">
                  <div className="p-3 bg-red-100 text-red-600 rounded-xl mr-4">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Ditolak</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.rejected}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Attendance Section */}
            {activeTab === 'attendance' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Scanner Box */}
                  <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className="w-16 h-16 bg-purple-100 text-tangerang-purple rounded-full flex items-center justify-center mb-4">
                      <QrCode className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Scan QR Code Peserta</h3>
                    <p className="text-gray-500 mb-6">Gunakan scanner manual atau buka kamera untuk scan QR Code pada kartu ujian peserta.</p>
                    
                    {/* Always render reader but control visibility to keep user gesture valid */}
                    <div className={`w-full max-w-md mb-6 transition-all duration-300 ${showScanner ? 'block animate-in fade-in zoom-in' : 'invisible absolute opacity-0 pointer-events-none'}`} style={{ minHeight: showScanner ? 'auto' : '300px' }}>
                        <div id="reader" className="w-full overflow-hidden rounded-xl border-2 border-gray-200"></div>
                        <button 
                          onClick={handleStopScanner}
                          className="mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium w-full"
                        >
                          <CameraOff size={20} />
                          Tutup Kamera
                        </button>
                    </div>

                    {!showScanner && (
                      <button 
                        onClick={handleStartScanner}
                        disabled={isStartingCamera}
                        className="mb-8 flex items-center justify-center gap-2 px-6 py-3 bg-purple-50 border-2 border-purple-100 text-tangerang-purple rounded-xl font-bold hover:bg-purple-100 hover:border-purple-200 transition w-full max-w-md disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isStartingCamera ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                                Membuka Kamera...
                            </>
                        ) : (
                            <>
                                <Camera size={20} />
                                Buka Kamera Scanner
                            </>
                        )}
                      </button>
                    )}

                    <form onSubmit={handleScan} className="w-full max-w-md relative">
                      <div className="relative">
                        <input
                          autoFocus
                          type="text"
                          value={scanInput}
                          onChange={(e) => setScanInput(e.target.value)}
                          placeholder="Atau ketik ID & Enter..."
                          className="w-full px-6 py-4 text-center text-xl font-mono tracking-wider border-2 border-purple-200 rounded-xl focus:border-tangerang-purple focus:ring-4 focus:ring-purple-100 outline-none transition-all"
                        />
                      </div>
                      <button 
                        type="submit" 
                        className="mt-4 w-full py-3 bg-tangerang-purple text-white rounded-xl font-bold hover:bg-tangerang-dark transition shadow-md"
                      >
                        Submit Manual
                      </button>
                    </form>

                    {lastScanned && (
                      <div className={`mt-6 p-4 rounded-xl w-full max-w-md animate-in slide-in-from-top-2 duration-300 ${
                        lastScanned.status === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
                        lastScanned.status === 'warning' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                        'bg-red-100 text-red-800 border border-red-200'
                      }`}>
                        <div className="flex items-center justify-center gap-2 font-bold text-lg mb-1">
                          {lastScanned.status === 'success' ? <CheckCircle className="w-6 h-6"/> : 
                           lastScanned.status === 'warning' ? <Clock className="w-6 h-6"/> : <XCircle className="w-6 h-6"/>}
                          {lastScanned.status === 'success' ? 'Berhasil!' : lastScanned.status === 'warning' ? 'Peringatan' : 'Gagal!'}
                        </div>
                        <p className="font-medium text-lg">{lastScanned.name}</p>
                        <p className="text-sm opacity-90 mt-1">{lastScanned.message}</p>
                      </div>
                    )}
                  </div>

                  {/* Summary Stats */}
                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                        <Users className="w-5 h-5 mr-2 text-tangerang-purple" />
                        Statistik Kehadiran
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                          <p className="text-sm text-green-600 font-medium">Hadir</p>
                          <p className="text-3xl font-bold text-green-700">
                            {stats.present}
                          </p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-sm text-gray-500 font-medium">Belum Hadir</p>
                          <p className="text-3xl font-bold text-gray-700">
                            {stats.absent}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex-1 h-[400px] flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Riwayat Scan Terbaru</h3>
                        {applicants.some(a => a.attendanceStatus === 'present') && (
                          <button
                            onClick={handleResetAttendance}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                            title="Hapus Semua Riwayat Scan"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Reset</span>
                          </button>
                        )}
                      </div>
                      <div className="overflow-y-auto flex-1 pr-2 space-y-3">
                        {applicants
                          .filter(a => a.attendanceStatus === 'present')
                          .sort((a, b) => new Date(b.attendanceTime!).getTime() - new Date(a.attendanceTime!).getTime())
                          .slice(0, 10)
                          .map((app) => (
                            <div key={app.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                              <div>
                                <p className="font-bold text-gray-800">{app.name}</p>
                                <div className="flex flex-col gap-0.5 mt-1">
                                  <p className="text-xs text-gray-500 font-mono">ID: {String(app.id).padStart(6, '0')}</p>
                                  <p className="text-xs text-gray-400">{app.nik}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">Hadir</span>
                                <p className="text-xs text-gray-400 mt-1">
                                  {new Date(app.attendanceTime!).toLocaleTimeString('id-ID')}
                                </p>
                              </div>
                            </div>
                          ))}
                          {applicants.filter(a => a.attendanceStatus === 'present').length === 0 && (
                            <p className="text-center text-gray-400 py-8">Belum ada data kehadiran.</p>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* User/Positions Management Section */}
            {activeTab === 'users' || activeTab === 'positions' || activeTab === 'sessions' ? (
              <div className="space-y-6 animate-in fade-in duration-500">
                {activeTab === 'sessions' && (
                  <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-tangerang-purple" />
                      {editingSession ? 'Edit Sesi Ujian' : 'Master Sesi Ujian'}
                    </h2>
                    
                    <form onSubmit={editingSession ? handleUpdateSession : handleAddSession} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 bg-gray-50 p-6 rounded-xl border border-gray-100">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Sesi</label>
                        <input
                          type="text"
                          required
                          value={editingSession ? editingSession.name : newSession.name}
                          onChange={e => editingSession ? setEditingSession({...editingSession, name: e.target.value}) : setNewSession({...newSession, name: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple outline-none"
                          placeholder="Contoh: Sesi 1 - Pagi"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                        <input
                          type="date"
                          required
                          value={editingSession ? editingSession.date : newSession.date}
                          onChange={e => editingSession ? setEditingSession({...editingSession, date: e.target.value}) : setNewSession({...newSession, date: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Jam Mulai</label>
                        <input
                          type="time"
                          required
                          value={editingSession ? editingSession.startTime : newSession.startTime}
                          onChange={e => editingSession ? setEditingSession({...editingSession, startTime: e.target.value}) : setNewSession({...newSession, startTime: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Jam Selesai</label>
                        <input
                          type="time"
                          required
                          value={editingSession ? editingSession.endTime : newSession.endTime}
                          onChange={e => editingSession ? setEditingSession({...editingSession, endTime: e.target.value}) : setNewSession({...newSession, endTime: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kapasitas (Opsional)</label>
                        <input
                          type="number"
                          value={editingSession ? editingSession.capacity : newSession.capacity}
                          onChange={e => editingSession ? setEditingSession({...editingSession, capacity: parseInt(e.target.value)}) : setNewSession({...newSession, capacity: parseInt(e.target.value)})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple outline-none"
                          placeholder="0 = Tanpa batas"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
                        <input
                          type="text"
                          required
                          value={editingSession ? editingSession.location : newSession.location}
                          onChange={e => editingSession ? setEditingSession({...editingSession, location: e.target.value}) : setNewSession({...newSession, location: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple outline-none"
                          placeholder="Contoh: Ruang Aula Lt. 2"
                        />
                      </div>
                      <div className="flex gap-2 items-end">
                        <button
                          type="submit"
                          className="flex-1 px-6 py-2 bg-tangerang-purple text-white rounded-lg hover:bg-tangerang-dark transition font-medium shadow-md"
                        >
                          {editingSession ? 'Simpan Perubahan' : 'Tambah Sesi'}
                        </button>
                        {editingSession && (
                          <button
                            type="button"
                            onClick={() => setEditingSession(null)}
                            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                          >
                            Batal
                          </button>
                        )}
                      </div>
                    </form>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                          <tr>
                            <th className="px-6 py-4">Nama Sesi</th>
                            <th className="px-6 py-4">Waktu & Tempat</th>
                            <th className="px-6 py-4">Kapasitas</th>
                            <th className="px-6 py-4">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {sessions.map(session => (
                            <tr key={session.id} className="hover:bg-gray-50 transition">
                              <td className="px-6 py-4">
                                <div className="font-bold text-gray-900">{session.name}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center text-sm text-gray-700 mb-1">
                                  <Clock className="w-3.5 h-3.5 mr-1.5 text-tangerang-purple" />
                                  {new Date(session.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {session.startTime} - {session.endTime} WIB
                                </div>
                                <div className="text-sm text-gray-500 italic mt-1">
                                  {session.location}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-700">
                                {session.capacity > 0 ? `${session.capacity} Peserta` : 'Tidak Terbatas'}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setEditingSession(session)}
                                    className="text-tangerang-purple hover:text-tangerang-dark p-1.5 rounded-full hover:bg-purple-50 transition"
                                    title="Edit Sesi"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSession(session.id)}
                                    className="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 transition"
                                    title="Hapus Sesi"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {sessions.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                                Belum ada sesi ujian yang dibuat.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {activeTab === 'positions' && (
                  <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                      <Shield className="w-5 h-5 mr-2 text-tangerang-purple" />
                      {editingPosition ? 'Edit Posisi Dilamar' : 'Master Posisi Dilamar'}
                    </h2>
                    <form onSubmit={handleAddPosition} className="flex flex-col md:flex-row gap-4 items-end mb-6">
                      <div className="flex-1 w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Posisi</label>
                        <input
                          type="text"
                          required
                          value={newPosition}
                          onChange={e => setNewPosition(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent outline-none transition-all"
                          placeholder="Contoh: Perawat, Bidan, Apoteker"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="px-6 py-2 bg-tangerang-purple text-white rounded-lg hover:bg-tangerang-dark transition font-medium shadow-md hover:shadow-lg"
                        >
                          {editingPosition ? 'Simpan Perubahan' : 'Tambah Posisi'}
                        </button>
                        {editingPosition && (
                          <button
                            type="button"
                            onClick={cancelEditPosition}
                            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                          >
                            Batal
                          </button>
                        )}
                      </div>
                    </form>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                          <tr>
                            <th className="px-6 py-4">Nama Posisi</th>
                            <th className="px-6 py-4">Dibuat Pada</th>
                            <th className="px-6 py-4">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {positions.map(pos => (
                            <tr key={pos.id} className="hover:bg-gray-50 transition">
                              <td className="px-6 py-4 font-semibold text-gray-900">{pos.name}</td>
                              <td className="px-6 py-4 text-gray-500 text-sm">
                                {new Date(pos.createdAt).toLocaleDateString('id-ID')}
                              </td>
                              <td className="px-6 py-4">
                                {currentUserRole === 'superadmin' && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => startEditPosition(pos)}
                                    className="text-gray-700 hover:text-tangerang-purple p-1.5 rounded-full hover:bg-purple-50 transition"
                                    title="Edit Posisi"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePosition(pos.id)}
                                    className="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 transition"
                                    title="Hapus Posisi"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                                )}
                              </td>
                            </tr>
                          ))}
                          {positions.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-6 py-8 text-center text-gray-500">Belum ada posisi.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'users' && (
                  <>
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <Users className="w-5 h-5 mr-2 text-tangerang-purple" />
                    {editingUser ? 'Edit User Admin' : 'Tambah User Admin Baru'}
                  </h2>
                  <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                      <input
                        type="text"
                        required
                        value={newUser.username}
                        onChange={e => setNewUser({...newUser, username: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent outline-none transition-all"
                        placeholder="Masukkan username"
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{editingUser ? 'Password Baru (Opsional)' : 'Password'}</label>
                      <input
                        type="password"
                        required={!editingUser}
                        value={newUser.password}
                        onChange={e => setNewUser({...newUser, password: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent outline-none transition-all"
                        placeholder={editingUser ? 'Kosongkan jika tidak diubah' : 'Masukkan password'}
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <select
                        value={newUser.role}
                        onChange={e => setNewUser({...newUser, role: e.target.value as 'superadmin' | 'verificator'})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent outline-none transition-all"
                      >
                        <option value="verificator">Verificator</option>
                        <option value="superadmin">Superadmin</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-tangerang-purple text-white rounded-lg hover:bg-tangerang-dark transition font-medium shadow-md hover:shadow-lg"
                    >
                      {editingUser ? 'Simpan Perubahan' : 'Tambah'}
                    </button>
                    {editingUser && (
                      <button
                        type="button"
                        onClick={cancelEditUser}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                      >
                        Batal
                      </button>
                    )}
                  </form>
                </div>

                {/* Moved to Positions Tab */}

                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800">Daftar User Admin</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                        <tr>
                          <th className="px-6 py-4">Username</th>
                          <th className="px-6 py-4">Role</th>
                          <th className="px-6 py-4">Dibuat Pada</th>
                          <th className="px-6 py-4">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {adminUsers.map(user => (
                          <tr key={user.id} className="hover:bg-gray-50 transition">
                            <td className="px-6 py-4 font-semibold text-gray-900">{user.username}</td>
                            <td className="px-6 py-4">
                              <div className="relative inline-block group">
                                <select
                                  value={user.role}
                                  onChange={(e) => handleUpdateRole(user.id, e.target.value as 'superadmin' | 'verificator')}
                                  className={`appearance-none pl-4 pr-9 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer focus:ring-2 focus:ring-offset-1 outline-none shadow-sm hover:shadow-md ${
                                    user.role === 'superadmin' 
                                      ? 'bg-purple-50 text-purple-700 border-purple-200 focus:ring-purple-400 hover:bg-purple-100' 
                                      : 'bg-blue-50 text-blue-700 border-blue-200 focus:ring-blue-400 hover:bg-blue-100'
                                  }`}
                                >
                                  <option value="superadmin">Superadmin</option>
                                  <option value="verificator">Verificator</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none transition-transform duration-200 group-hover:translate-y-0.5">
                                  <ChevronDown className={`w-3.5 h-3.5 ${
                                    user.role === 'superadmin' ? 'text-purple-700' : 'text-blue-700'
                                  }`} strokeWidth={2.5} />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-gray-500 text-sm">
                              {new Date(user.createdAt).toLocaleDateString('id-ID')}
                            </td>
                            <td className="px-6 py-4">
                              {currentUserRole === 'superadmin' && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => startEditUser(user)}
                                  className="text-gray-700 hover:text-tangerang-purple p-1.5 rounded-full hover:bg-purple-50 transition"
                                  title="Edit User"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 transition"
                                  title="Hapus User"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              )}
                            </td>
                          </tr>
                        ))}
                        {adminUsers.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-gray-500">Belum ada user lain.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                </>
                )}
              </div>
            ) : activeTab === 'schedule' ? (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-tangerang-purple" />
                  Atur Jadwal Ujian (Peserta Lolos)
                </h2>
                <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Filter Sesi</label>
                    <select
                      value={scheduleFilterSessionId || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setScheduleFilterSessionId(v === 'UNASSIGNED' ? 'UNASSIGNED' : (v ? parseInt(v) : ''));
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent outline-none"
                    >
                      <option value="">Semua Sesi</option>
                      <option value="UNASSIGNED">Belum Ditentukan</option>
                      {sessions.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({new Date(s.date).toLocaleDateString('id-ID')})</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cari Peserta</label>
                    <input
                      type="text"
                      placeholder="Nama atau NIK"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent outline-none"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                {sessions.length > 3 && (
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm text-gray-600">
                      Menampilkan sesi {scheduleCarouselIndex + 1}–{Math.min(scheduleCarouselIndex + 3, sessions.length)} dari {sessions.length}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setScheduleCarouselIndex(i => Math.max(i - 1, 0))}
                        disabled={scheduleCarouselIndex === 0}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 flex items-center gap-1"
                        title="Sebelumnya"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Prev
                      </button>
                      <button
                        onClick={() => setScheduleCarouselIndex(i => (i + 3 < sessions.length ? i + 1 : i))}
                        disabled={scheduleCarouselIndex + 3 >= sessions.length}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 flex items-center gap-1"
                        title="Berikutnya"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                <div
                  className="relative overflow-hidden mb-6"
                  onTouchStart={(e) => {
                    const x = e.touches[0].clientX;
                    (window as any).__s_start = x;
                  }}
                  onTouchMove={(e) => {
                    const x = e.touches[0].clientX;
                    (window as any).__s_delta = x - (window as any).__s_start;
                  }}
                  onTouchEnd={() => {
                    const d = (window as any).__s_delta || 0;
                    if (d > 50) {
                      setScheduleCarouselIndex(i => Math.max(i - 1, 0));
                    } else if (d < -50) {
                      setScheduleCarouselIndex(i => (i + 3 < sessions.length ? i + 1 : i));
                    }
                    (window as any).__s_start = 0;
                    (window as any).__s_delta = 0;
                  }}
                >
                  <div
                    className="flex transition-transform duration-300 ease-out"
                    style={{ transform: `translateX(-${scheduleCarouselIndex * (100 / 3)}%)` }}
                  >
                    {sessions.map(s => {
                      const assigned = applicants.filter(a => a.status === 'verified' && a.sessionId === s.id).length;
                      return (
                        <div key={s.id} className="basis-1/3 flex-shrink-0 px-2">
                          <div className={`p-4 rounded-xl border ${activeTab === 'schedule' && scheduleFilterSessionId === s.id ? 'border-tangerang-purple bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-bold text-gray-800">{s.name}</div>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">{new Date(s.date).toLocaleDateString('id-ID')}</span>
                            </div>
                            <div className="text-sm text-gray-600">{s.startTime} - {s.endTime} WIB</div>
                            <div className="text-xs text-gray-500 italic">{s.location}</div>
                            <div className="mt-3 text-sm font-medium">
                              {s.capacity > 0 ? `${assigned}/${s.capacity} ditempatkan` : `${assigned} ditempatkan`}
                            </div>
                            <button
                              onClick={() => setScheduleFilterSessionId(s.id)}
                              className="mt-3 w-full px-3 py-2 bg-purple-100 text-tangerang-purple rounded-lg hover:bg-purple-200 transition text-sm font-semibold"
                            >
                              Fokus Sesi Ini
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {sessions.length === 0 && (
                    <div className="p-6 rounded-xl border border-gray-200 bg-gray-50 text-center">
                      Tidak ada sesi tersedia.
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                      <tr>
                        <th className="px-6 py-4">Nama</th>
                        <th className="px-6 py-4">NIK</th>
                        <th className="px-6 py-4">Posisi</th>
                        <th className="px-6 py-4">Sesi Saat Ini</th>
                        <th className="px-6 py-4">Atur Sesi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {applicants
                        .filter(a => a.status === 'verified')
                        .filter(a => scheduleFilterSessionId === 'UNASSIGNED' ? !a.sessionId : (!scheduleFilterSessionId || a.sessionId === scheduleFilterSessionId))
                        .map(app => (
                          <tr key={app.id} className="hover:bg-gray-50 transition">
                            <td className="px-6 py-4 font-semibold text-gray-900">{app.name}</td>
                            <td className="px-6 py-4 text-gray-600 text-sm">{app.nik}</td>
                            <td className="px-6 py-4 text-gray-700 text-sm">{app.position}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {app.Session ? (
                                <>
                                  <div className="font-medium">{app.Session.name}</div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(app.Session.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    {' '}({app.Session.startTime} - {app.Session.endTime} WIB)
                                  </div>
                                  <div className="text-xs text-gray-500 italic">{app.Session.location}</div>
                                </>
                              ) : (
                                <span className="text-gray-400 italic">Belum ditetapkan</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <select
                                value={app.sessionId || ''}
                                onChange={async (e) => {
                                  const sid = e.target.value ? parseInt(e.target.value) : null;
                                  if (sid) {
                                    const s = sessions.find(x => x.id === sid);
                                    if (s && s.capacity > 0) {
                                      const assigned = applicants.filter(a => a.status === 'verified' && a.sessionId === sid).length;
                                      if (assigned >= s.capacity) {
                                        setCapacityPrompt({ open: true, applicantId: app.id, sessionId: sid, sessionName: s.name, assigned, capacity: s.capacity });
                                        return;
                                      }
                                    }
                                  }
                                  try {
                                    const res = await axios.post(`/admin/applicants/${app.id}/session`, { sessionId: sid }, { withCredentials: true });
                                    const updated = res.data.applicant as Applicant;
                                    setApplicants(prev => prev.map(a => a.id === app.id ? { ...a, sessionId: updated.sessionId, Session: updated.Session } : a));
                                  } catch (err: any) {
                                    alert(err.response?.data?.error || 'Gagal mengatur sesi');
                                  }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-tangerang-purple focus:border-transparent outline-none"
                              >
                                <option value="">-- Pilih Sesi Ujian --</option>
                                {sessions.map(s => (
                                  <option key={s.id} value={s.id}>{s.name} ({new Date(s.date).toLocaleDateString('id-ID')})</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      {applicants.filter(a => a.status === 'verified').length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                            Tidak ada peserta lolos yang tersedia saat ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            ) : (activeTab === 'applicants' || activeTab === 'verification') ? (
            /* Table Section */
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden animate-in fade-in duration-500">
              <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between gap-4">
                <h2 className="text-lg font-bold text-gray-800 flex items-center">
                  {activeTab === 'applicants' ? (
                    <>
                      <LayoutDashboard className="w-5 h-5 mr-2 text-tangerang-purple" />
                      Data Lengkap Pelamar
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5 mr-2 text-tangerang-purple" />
                      Verifikasi Berkas Masuk
                    </>
                  )}
                </h2>
                <div className="relative flex gap-2">
                  {(activeTab === 'applicants' || activeTab === 'verification') && (
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-tangerang-purple focus:border-transparent outline-none bg-white transition-all"
                    >
                      <option value="">Semua Status</option>
                      <option value="pending">Menunggu</option>
                      <option value="verified">Lolos</option>
                      <option value="rejected">Ditolak</option>
                    </select>
                  )}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Cari nama, email..."
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-tangerang-purple focus:border-transparent outline-none w-full md:w-64 transition-all"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                    <tr>
                      {activeTab === 'applicants' ? (
                        <>
                          <th className="px-6 py-4">Nama Lengkap</th>
                          <th className="px-6 py-4">NIK</th>
                          <th className="px-6 py-4">Jenis Kelamin</th>
                          <th className="px-6 py-4">Tempat / Tanggal Lahir</th>
                          <th className="px-6 py-4">Umur (Saat Daftar)</th>
                          <th className="px-6 py-4">Pendidikan</th>
                          <th className="px-6 py-4">Institusi</th>
                          <th className="px-6 py-4">Jurusan</th>
                          <th className="px-6 py-4">IPK</th>
                          <th className="px-6 py-4">Posisi</th>
                          <th className="px-6 py-4">Email</th>
                          <th className="px-6 py-4">No HP</th>
                        </>
                      ) : (
                        <>
                          <th className="px-6 py-4">Pelamar</th>
                          <th className="px-6 py-4">Posisi</th>
                          <th className="px-6 py-4">Verifikasi Berkas</th>
                          <th className="px-6 py-4">Status Akhir</th>
                          <th className="px-6 py-4">Aksi</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Loading data...</td></tr>
                    ) : applicants.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Tidak ada data pelamar.</td></tr>
                    ) : (
                      applicants.map((app) => (
                        <tr key={app.id} className="hover:bg-gray-50 transition">
                          {activeTab === 'applicants' ? (
                            <>
                              <td className="px-6 py-4 font-semibold text-gray-900">{app.name}</td>
                              <td className="px-6 py-4 text-gray-600 font-mono text-sm">{app.nik}</td>
                              <td className="px-6 py-4 text-gray-600">{app.gender}</td>
                              <td className="px-6 py-4 text-gray-600">{app.birthPlace ? `${app.birthPlace}, ` : ''}{app.birthDate || '-'}</td>
                              <td className="px-6 py-4 text-gray-600 font-medium">
                                {calculateAgeAtRegistration(app.birthDate, app.createdAt)}
                              </td>
                              <td className="px-6 py-4 text-gray-600">{app.education}</td>
                              <td className="px-6 py-4 text-gray-600">{app.institution || '-'}</td>
                              <td className="px-6 py-4 text-gray-600">{app.major || '-'}</td>
                              <td className="px-6 py-4 text-gray-600">{app.gpa ? app.gpa.toFixed(2) : '-'}</td>
                              <td className="px-6 py-4">
                                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100 whitespace-nowrap">
                                  {app.position}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-gray-500 text-sm">{app.email}</td>
                              <td className="px-6 py-4 text-gray-500 text-sm">{app.phoneNumber || '-'}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-6 py-4">
                                <div className="flex items-center">
                                  {app.pasFotoPath ? (
                                    <div className="h-10 w-10 flex-shrink-0 mr-3 cursor-pointer" onClick={() => window.open(`${app.pasFotoPath}`, '_blank')}>
                                      <img className="h-10 w-10 rounded-full object-cover border border-gray-200" src={`${app.pasFotoPath}`} alt="" />
                                    </div>
                                  ) : (
                                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center mr-3 text-gray-500">
                                      <User size={20} />
                                    </div>
                                  )}
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{app.name}</div>
                                    <div className="text-sm text-gray-500">{app.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100 whitespace-nowrap">
                                  {app.position}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex gap-2">
                                  {[
                                    { key: 'suratLamaran', label: 'Lamaran & CV', status: app.suratLamaranStatus, path: app.suratLamaranPath },
                                    { key: 'ktp', label: 'KTP', status: app.ktpStatus, path: app.ktpPath },
                                    { key: 'ijazah', label: 'Ijazah & Nilai', status: app.ijazahStatus, path: app.ijazahPath },
                                    { key: 'str', label: 'STR', status: app.strStatus, path: app.strPath },
                                    { key: 'suratPernyataan', label: 'Pernyataan', status: app.suratPernyataanStatus, path: app.suratPernyataanPath },
                                    { key: 'sertifikat', label: 'Sert', status: app.sertifikatStatus, path: app.sertifikatPath },
                                  ].map((file) => (
                                    <button
                                      key={file.key}
                                      onClick={() => openPreview(app, file.key, file.label, file.path!, file.status!)}
                                      className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border shadow-sm transition-all duration-200 flex items-center ${
                                        file.status === 'valid' 
                                          ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200 hover:shadow-md' 
                                          : file.status === 'invalid' 
                                            ? 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200 hover:shadow-md' 
                                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:text-amber-800 hover:border-amber-300'
                                      }`}
                                      title={file.label}
                                    >
                                      {file.status === 'valid' && <CheckCircle className="w-3.5 h-3.5 mr-1.5" />}
                                      {file.status === 'invalid' && <XCircle className="w-3.5 h-3.5 mr-1.5" />}
                                      {file.label}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {app.status === 'verified' && <span className="text-green-600 font-medium flex items-center"><CheckCircle className="w-4 h-4 mr-1"/> Lolos</span>}
                                {app.status === 'rejected' && <span className="text-red-600 font-medium flex items-center"><XCircle className="w-4 h-4 mr-1"/> Ditolak</span>}
                                {app.status === 'pending' && <span className="text-yellow-600 font-medium flex items-center"><Clock className="w-4 h-4 mr-1"/> Menunggu</span>}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center">
                                  <button
                                      onClick={() => window.open(`/api/print-registration-card/${app.id}`, '_blank')}
                                      className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition shadow-sm mr-2"
                                      title="Cetak Kartu Pendaftaran"
                                  >
                                      <Printer className="w-4 h-4 mr-1.5" />
                                      Kartu Daftar
                                  </button>
                                  {app.status === 'verified' && (
                                    <button
                                      onClick={() => handlePrintCard(app)}
                                      className="flex items-center px-3 py-1.5 bg-tangerang-purple text-white text-xs font-medium rounded hover:bg-tangerang-dark transition shadow-sm"
                                      title="Cetak Kartu Ujian"
                                    >
                                      <Printer className="w-4 h-4 mr-1.5" />
                                      Kartu Ujian
                                    </button>
                                  )}
                                  {currentUserRole === 'superadmin' && (
                                  <button
                                    onClick={() => handleDeleteApplicant(app.id)}
                                    className="ml-2 text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 transition"
                                    title="Hapus Pelamar"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                  )}
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Hal {pagination.currentPage} dari {pagination.totalPages} ({pagination.totalItems} data)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                    disabled={pagination.currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                  >
                    Sebelumnya
                  </button>
                  <button
                    onClick={() => setPage(prev => Math.min(prev + 1, pagination.totalPages))}
                    disabled={pagination.currentPage === pagination.totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            </div>
            ) : activeTab === 'settings' && currentUserRole === 'superadmin' ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                        <Settings className="w-5 h-5 mr-2 text-tangerang-purple" />
                        Pengaturan Sistem Rekrutmen
                    </h3>

                    <div className="space-y-6">
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                            <h4 className="font-semibold text-blue-900 mb-4">Fase Rekrutmen Saat Ini</h4>
                            <p className="text-sm text-blue-700 mb-6">
                                Mengubah fase rekrutmen akan mempengaruhi aksesibilitas halaman bagi pelamar.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-0">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updatePhase('registration');
                                    }}
                                    className={`relative z-10 cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 text-left group ${
                                        currentPhase === 'registration'
                                            ? 'border-blue-500 bg-white shadow-md ring-2 ring-blue-200 ring-offset-1'
                                            : 'border-blue-200/50 bg-white/60 hover:bg-white hover:border-blue-300 hover:shadow-md hover:-translate-y-1'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`font-bold ${currentPhase === 'registration' ? 'text-blue-600' : 'text-gray-600 group-hover:text-blue-600'}`}>Pendaftaran</span>
                                        {currentPhase === 'registration' && <CheckCircle className="w-5 h-5 text-blue-500" />}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Halaman pendaftaran dibuka. Pelamar dapat mengisi form dan upload berkas.
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updatePhase('verification');
                                    }}
                                    className={`relative z-10 cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 text-left group ${
                                        currentPhase === 'verification'
                                            ? 'border-yellow-500 bg-white shadow-md ring-2 ring-yellow-200 ring-offset-1'
                                            : 'border-yellow-200/50 bg-white/60 hover:bg-white hover:border-yellow-300 hover:shadow-md hover:-translate-y-1'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`font-bold ${currentPhase === 'verification' ? 'text-yellow-600' : 'text-gray-600 group-hover:text-yellow-600'}`}>Verifikasi Berkas</span>
                                        {currentPhase === 'verification' && <CheckCircle className="w-5 h-5 text-yellow-500" />}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Pendaftaran ditutup. Menampilkan halaman informasi verifikasi sedang berlangsung.
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updatePhase('announcement');
                                    }}
                                    className={`relative z-10 cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 text-left group ${
                                        currentPhase === 'announcement'
                                            ? 'border-green-500 bg-white shadow-md ring-2 ring-green-200 ring-offset-1'
                                            : 'border-green-200/50 bg-white/60 hover:bg-white hover:border-green-300 hover:shadow-md hover:-translate-y-1'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`font-bold ${currentPhase === 'announcement' ? 'text-green-600' : 'text-gray-600 group-hover:text-green-600'}`}>Pengumuman</span>
                                        {currentPhase === 'announcement' && <CheckCircle className="w-5 h-5 text-green-500" />}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Halaman status dibuka. Pelamar dapat melihat hasil dan cetak kartu ujian.
                                    </p>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
          </div>
        </main>
      </div>

      {/* Preview Modal */}
      {previewFile && selectedApplicant && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[95vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Verifikasi Berkas: {previewFile.label} <span className="text-xs text-gray-400 font-normal">(v3)</span></h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  <p className="text-sm text-gray-600 font-medium">Pelamar: <span className="text-gray-900">{selectedApplicant.name}</span></p>
                  {previewFile.type === 'ijazah' && (
                    <>
                      <p className="text-sm text-gray-600 font-medium">Institusi: <span className="text-gray-900">{selectedApplicant.institution || '-'}</span></p>
                      <p className="text-sm text-gray-600 font-medium">Pendidikan: <span className="text-gray-900">{selectedApplicant.major || selectedApplicant.education}</span></p>
                      <p className="text-sm text-gray-600 font-medium">IPK: <span className="text-gray-900">{selectedApplicant.gpa ? selectedApplicant.gpa.toFixed(2) : '-'}</span></p>
                    </>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setPreviewFile(null)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all duration-200"
                title="Tutup Preview"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 bg-gray-100 p-4 overflow-hidden relative">
              <iframe 
                src={previewFile.url} 
                className="w-full h-full rounded-lg border bg-white shadow-inner"
                title="Preview"
              />
            </div>

            <div className="p-4 border-t bg-white flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Komentar / Alasan Penolakan</label>
                  <textarea 
                    value={rejectReasonInput}
                    onChange={(e) => setRejectReasonInput(e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    placeholder="Masukkan alasan jika berkas ditolak..."
                    rows={2}
                  />
                </div>
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Penugasan Sesi Ujian</label>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  >
                    <option value="">-- Pilih Sesi Ujian --</option>
                    {sessions.map(session => (
                      <option key={session.id} value={session.id}>
                        {session.name} ({new Date(session.date).toLocaleDateString('id-ID')})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500 italic">Sesi ini akan dicetak pada kartu ujian jika status diverifikasi Lolos.</p>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  <span className={`font-medium px-2 py-1 rounded ${
                    previewFile.status === 'valid' ? 'bg-green-100 text-green-700' : 
                    previewFile.status === 'invalid' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    Status Saat Ini: {previewFile.status === 'valid' ? 'Sesuai' : previewFile.status === 'invalid' ? 'Tidak Sesuai' : 'Belum Diperiksa'}
                  </span>
                  {previewFile.verifiedBy && (
                    <p className="mt-1 text-xs">
                      <Clock className="w-3 h-3 inline mr-1" />
                      Diverifikasi oleh {previewFile.verifiedBy} pada {new Date(previewFile.verifiedAt!).toLocaleString('id-ID')}
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => verifyFile('invalid')}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium flex items-center border border-red-200"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Tolak Berkas
                  </button>
                  <button
                    onClick={() => verifyFile('valid')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium flex items-center shadow-md hover:shadow-lg"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Verifikasi Sesuai
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Capacity Prompt Modal (global, covers header too) */}
      {capacityPrompt.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 p-6">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 text-tangerang-purple flex items-center justify-center mr-3">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Kapasitas Sesi Penuh</h3>
                <p className="text-xs text-gray-500">Sesi {capacityPrompt.sessionName}</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-4">
              Kapasitas sesi telah terpenuhi ({capacityPrompt.assigned}/{capacityPrompt.capacity}). Tetap masukkan peserta ke sesi ini?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setCapacityPrompt({ open: false });
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                Tidak
              </button>
              <button
                onClick={async () => {
                  try {
                    if (!capacityPrompt.applicantId || !capacityPrompt.sessionId) return;
                    const res = await axios.post(`/admin/applicants/${capacityPrompt.applicantId}/session`, { sessionId: capacityPrompt.sessionId }, { withCredentials: true });
                    const updated = res.data.applicant as Applicant;
                    setApplicants(prev => prev.map(a => a.id === capacityPrompt.applicantId ? { ...a, sessionId: updated.sessionId, Session: updated.Session } : a));
                  } catch (err: any) {
                    alert(err.response?.data?.error || 'Gagal mengatur sesi');
                  } finally {
                    setCapacityPrompt({ open: false });
                  }
                }}
                className="flex-1 px-4 py-2 bg-tangerang-purple text-white rounded-lg hover:bg-tangerang-dark transition font-medium"
              >
                Iya, Tetap Masukkan
              </button>
            </div>
          </div>
        </div>
      )}
      <canvas ref={barcodeCanvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default Dashboard;
