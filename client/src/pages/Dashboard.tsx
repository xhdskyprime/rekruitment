import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  Users, CheckCircle, XCircle, FileText, 
  LogOut, Search, Clock, Menu, LayoutDashboard, Shield, User, Printer, ChevronDown, ChevronRight, X, QrCode, Camera, CameraOff, Trash2, Briefcase, Database
} from 'lucide-react';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
  import Swal from 'sweetalert2';
  import JsBarcode from 'jsbarcode';

interface Applicant {
  id: number;
  name: string;
  nik: string;
  gender: string;
  birthDate?: string;
  education: string;
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] = useState<Pagination>({ totalItems: 0, totalPages: 1, currentPage: 1, limit: 20 });
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, verified: 0, rejected: 0, present: 0, absent: 0 });
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>('');
  
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [previewFile, setPreviewFile] = useState<{ type: string, label: string, url: string, status: string, verifiedAt?: string, verifiedBy?: string, rejectReason?: string } | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [activeTab, setActiveTab] = useState<'applicants' | 'verification' | 'users' | 'attendance' | 'positions'>('applicants');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMasterMenuOpen, setMasterMenuOpen] = useState(true);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  
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

  const navigate = useNavigate();

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
    setFilterStatus('');
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
      }
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
      await axios.post('/admin/positions', { name }, { withCredentials: true });
      setNewPosition('');
      fetchPositions();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Gagal menambah posisi');
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
        const scanner = new Html5Qrcode("reader");
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
    else if (type === 'cv') {
        verifiedAt = applicant.cvVerifiedAt;
        verifiedBy = applicant.cvVerifiedBy;
        rejectReason = applicant.cvRejectReason;
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
        { fileType: previewFile.type, status, rejectReason },
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

  const handlePrintCard = async (applicant: Applicant) => {
    // Generate QR Code
    let qrCodeDataUrl = '';
    try {
      qrCodeDataUrl = await QRCode.toDataURL(applicant.id.toString(), {
        width: 150,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
    } catch (e) {
      console.error("QR Code generation failed", e);
    }

    // Generate Barcode using hidden canvas ref
    let barcodeDataUrl = '';
    if (barcodeCanvasRef.current) {
        try {
            const ctx = barcodeCanvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, barcodeCanvasRef.current.width, barcodeCanvasRef.current.height);

            const jsBarcodeFn = (JsBarcode as any).default || JsBarcode;
            
            if (typeof jsBarcodeFn === 'function') {
                jsBarcodeFn(barcodeCanvasRef.current, applicant.id.toString().padStart(6, '0'), {
                    format: "CODE128",
                    displayValue: true,
                    height: 40,
                    fontSize: 14,
                    margin: 0,
                    width: 2
                });
                barcodeDataUrl = barcodeCanvasRef.current.toDataURL("image/png");
            } else {
                console.error("JsBarcode function not found", jsBarcodeFn);
            }
        } catch (e) {
            console.error("Ref-based barcode generation failed", e);
        }
    } else {
        console.error("Barcode canvas ref is null");
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
        printWindow.document.write(`
            <html>
            <head>
                <title>Kartu Ujian - ${applicant.name}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; background: #f0f0f0; }
                    .card { 
                        background: white;
                        border: 1px solid #ddd; 
                        padding: 30px; 
                        max-width: 700px; 
                        margin: 0 auto; 
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                        position: relative;
                        overflow: hidden;
                    }
                    .header { 
                        text-align: center; 
                        border-bottom: 3px double #4c1d95; 
                        padding-bottom: 20px; 
                        margin-bottom: 30px; 
                        position: relative;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                    }
                    .header h1 { margin: 0; font-size: 24px; color: #4c1d95; text-transform: uppercase; letter-spacing: 1px; }
                    .header h2 { margin: 5px 0 0; font-size: 16px; color: #666; }
                    .barcode-container {
                        position: absolute;
                        right: 0;
                        top: 0;
                        background: white;
                        padding: 5px;
                        display: flex;
                        flex-direction: column;
                        align-items: flex-end;
                        min-width: 150px;
                        min-height: 50px;
                        z-index: 10;
                    }
                    .barcode-container img, .barcode-container svg {
                        height: 50px;
                        width: auto;
                        display: block;
                        max-width: 200px;
                    }
                    .content { display: flex; gap: 30px; }
                    .photo-container { 
                        flex-shrink: 0;
                        width: 150px; 
                        height: 200px; 
                        border: 1px solid #ddd;
                        padding: 5px;
                        background: #fff;
                    }
                    .photo { 
                        width: 100%; 
                        height: 100%; 
                        object-fit: cover; 
                        background: #eee; 
                    }
                    .details { flex: 1; }
                    .row { 
                        margin-bottom: 12px; 
                        display: flex;
                        border-bottom: 1px solid #f0f0f0;
                        padding-bottom: 5px;
                    }
                    .label { 
                        font-weight: 600; 
                        width: 140px; 
                        color: #555;
                    }
                    .value {
                        flex: 1;
                        color: #000;
                        font-weight: 500;
                    }
                    .footer { 
                        margin-top: 40px; 
                        text-align: center; 
                        font-size: 12px; 
                        color: #888;
                        border-top: 1px solid #eee;
                        padding-top: 20px;
                    }
                    .watermark {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-45deg);
                        font-size: 100px;
                        color: rgba(76, 29, 149, 0.05);
                        pointer-events: none;
                        font-weight: bold;
                        z-index: 0;
                    }
                    @media print {
                        body { padding: 0; background: white; }
                        .card { box-shadow: none; border: 1px solid #ccc; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="watermark">RSUD</div>
                    <div class="header">
                        <h1>KARTU PESERTA UJIAN</h1>
                        <h2>REKRUTMEN PEGAWAI RSUD TIGARAKSA</h2>
                        <div class="barcode-container">
                             ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" alt="Barcode" />` : ''}
                             <svg id="barcode-fallback" style="${barcodeDataUrl ? 'display:none' : ''}"></svg>
                        </div>
                    </div>
                    <div class="content">
                        <div class="photo-container">
                            ${applicant.pasFotoPath 
                                ? `<img src="${applicant.pasFotoPath}" class="photo" alt="Foto Peserta" crossorigin="anonymous" />` 
                                : '<div class="photo" style="display:flex;align-items:center;justify-content:center;color:#999;font-size:12px;">No Photo</div>'
                            }
                        </div>
                        <div class="details">
                            <div class="row">
                                <span class="label">Nomor Peserta</span>
                                <span class="value">: ${applicant.id.toString().padStart(6, '0')}</span>
                            </div>
                            <div class="row">
                                <span class="label">Nama Lengkap</span>
                                <span class="value">: ${applicant.name}</span>
                            </div>
                            <div class="row">
                                <span class="label">NIK</span>
                                <span class="value">: ${applicant.nik}</span>
                            </div>
                            <div class="row">
                                <span class="label">Posisi Dilamar</span>
                                <span class="value">: ${applicant.position}</span>
                            </div>
                            <div class="row">
                                <span class="label">Lokasi Ujian</span>
                                <span class="value">: RSUD Tigaraksa (Gedung Utama)</span>
                            </div>
                            <div class="row">
                                <span class="label">Jadwal Ujian</span>
                                <span class="value">: Menunggu Informasi Selanjutnya</span>
                            </div>
                            <div class="row">
                                <span class="label">Status</span>
                                <span class="value" style="color:green;font-weight:bold">: TERVERIFIKASI</span>
                            </div>
                            <div class="row" style="border-bottom: none; margin-top: 15px;">
                                <span class="label">Scan QR Code</span>
                                <div class="value">
                                    <img src="${qrCodeDataUrl}" alt="QR Code" style="display:block; margin-top:-10px; width: 100px; height: 100px;" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="footer">
                        <p>Kartu ini adalah bukti sah kepesertaan ujian.</p>
                        <p>Wajib dibawa beserta KTP asli saat pelaksanaan ujian.</p>
                        <p>Dicetak pada: ${new Date().toLocaleString('id-ID')}</p>
                    </div>
                </div>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js"></script>
                <script>
                    window.onload = function() {
                        if (!"${barcodeDataUrl}") {
                            try {
                                JsBarcode("#barcode-fallback", "${applicant.id.toString().padStart(6, '0')}", {
                                    format: "CODE128",
                                    displayValue: true,
                                    height: 40,
                                    fontSize: 14,
                                    margin: 0,
                                    width: 2
                                });
                            } catch(e) { console.error("Fallback barcode failed", e); }
                        }
                        setTimeout(() => {
                            window.print();
                        }, 800);
                    }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
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
               activeTab === 'positions' ? 'Master Posisi Dilamar' : 'Manajemen User'}
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
            {activeTab === 'users' || activeTab === 'positions' ? (
              <div className="space-y-6 animate-in fade-in duration-500">
                {activeTab === 'positions' && (
                  <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                      <Shield className="w-5 h-5 mr-2 text-tangerang-purple" />
                      Master Posisi Dilamar
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
                      <button
                        type="submit"
                        className="px-6 py-2 bg-tangerang-purple text-white rounded-lg hover:bg-tangerang-dark transition font-medium shadow-md hover:shadow-lg"
                      >
                        Tambah Posisi
                      </button>
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
                                <button
                                  onClick={() => handleDeletePosition(pos.id)}
                                  className="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 transition"
                                  title="Hapus Posisi"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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
                    Tambah User Admin Baru
                  </h2>
                  <form onSubmit={handleCreateUser} className="flex flex-col md:flex-row gap-4 items-end">
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <input
                        type="password"
                        required
                        value={newUser.password}
                        onChange={e => setNewUser({...newUser, password: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent outline-none transition-all"
                        placeholder="Masukkan password"
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
                      Tambah
                    </button>
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
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 transition"
                                title="Hapus User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
                          <th className="px-6 py-4">Tanggal Lahir</th>
                          <th className="px-6 py-4">Umur (Saat Daftar)</th>
                          <th className="px-6 py-4">Pendidikan</th>
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
                              <td className="px-6 py-4 text-gray-600">{app.birthDate || '-'}</td>
                              <td className="px-6 py-4 text-gray-600 font-medium">
                                {calculateAgeAtRegistration(app.birthDate, app.createdAt)}
                              </td>
                              <td className="px-6 py-4 text-gray-600">{app.education}</td>
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
                                    { key: 'suratLamaran', label: 'Lamaran', status: app.suratLamaranStatus, path: app.suratLamaranPath },
                                    { key: 'ktp', label: 'KTP', status: app.ktpStatus, path: app.ktpPath },
                                    { key: 'cv', label: 'CV', status: app.cvStatus, path: app.cvPath },
                                    { key: 'ijazah', label: 'Ijazah', status: app.ijazahStatus, path: app.ijazahPath },
                                    { key: 'str', label: 'STR', status: app.strStatus, path: app.strPath },
                                    { key: 'sertifikat', label: 'Sert', status: app.sertifikatStatus, path: app.sertifikatPath },
                                    { key: 'suratPernyataan', label: 'Pernyataan', status: app.suratPernyataanStatus, path: app.suratPernyataanPath },
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
                                {app.status === 'verified' && (
                                  <button
                                    onClick={() => handlePrintCard(app)}
                                    className="flex items-center px-3 py-1.5 bg-tangerang-purple text-white text-xs font-medium rounded hover:bg-tangerang-dark transition shadow-sm"
                                    title="Cetak Kartu Ujian"
                                  >
                                    <Printer className="w-4 h-4 mr-1.5" />
                                    Cetak Kartu
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
                <p className="text-sm text-gray-500">Pelamar: {selectedApplicant.name}</p>
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
      <canvas ref={barcodeCanvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default Dashboard;
