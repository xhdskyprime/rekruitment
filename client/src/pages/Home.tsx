import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Upload, CheckCircle, AlertCircle, FileText, Send, Download, Trash2, X, Eye, Loader2 } from 'lucide-react';

const Home = () => {
  const [formData, setFormData] = useState({
    name: '',
    nik: '',
    gender: '',
    birthPlace: '',
    birthDate: '',
    education: '',
    institution: '',
    major: '',
    gpa: '',
    email: '',
    phoneNumber: '',
    position: ''
  });
  
  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    suratLamaran: null,
    ktp: null,
    ijazah: null,
    str: null,
    sertifikat: null,
    suratPernyataan: null,
    pasFoto: null
  });

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showAgeWarning, setShowAgeWarning] = useState(false);
  const [positions, setPositions] = useState<{ id: number, name: string }[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [registeredId, setRegisteredId] = useState<number | null>(null);

  // File Preview State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string>('');
  const [previewName, setPreviewName] = useState<string>('');

  const handlePreview = (file: File) => {
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPreviewType(file.type);
    setPreviewName(file.name);
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewType('');
    setPreviewName('');
  };

  // Auto-download card when registration is successful
  React.useEffect(() => {
    if (status === 'success' && registeredId) {
      // Use window.location.href to trigger download (since Content-Disposition is attachment)
      // This won't navigate away if it's a file download
      window.location.href = `/api/print-registration-card/${registeredId}?download=true`;
    }
  }, [status, registeredId]);

  React.useEffect(() => {
    const fetchPositions = async () => {
      try {
        const res = await axios.get('/positions');
        setPositions(res.data.positions || []);
      } catch (e) {
        setPositions([]);
      }
    };
    fetchPositions();
  }, []);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.name) newErrors.name = 'Nama lengkap wajib diisi';
    if (!formData.nik) newErrors.nik = 'NIK wajib diisi';
    else if (formData.nik.length !== 16) newErrors.nik = 'NIK harus 16 digit angka';
    
    if (!formData.birthPlace) newErrors.birthPlace = 'Tempat lahir wajib diisi';
    if (!formData.birthDate) newErrors.birthDate = 'Tanggal lahir wajib diisi';
    if (!formData.gender) newErrors.gender = 'Jenis kelamin wajib dipilih';
    if (!formData.education) newErrors.education = 'Pendidikan terakhir wajib dipilih';
    if (!formData.institution) newErrors.institution = 'Institusi pendidikan wajib diisi';
    
    if (formData.education !== 'SMA/SMK') {
      if (!formData.major) newErrors.major = 'Jurusan wajib diisi';
      if (!formData.gpa) newErrors.gpa = 'IPK wajib diisi';
    }
    
    if (!formData.email) newErrors.email = 'Email wajib diisi';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Format email tidak valid (contoh: nama@email.com)';
    
    if (!formData.phoneNumber) newErrors.phoneNumber = 'Nomor HP wajib diisi';
    else if (formData.phoneNumber.length < 10) newErrors.phoneNumber = 'Nomor HP minimal 10 digit';
    
    if (!formData.position) newErrors.position = 'Posisi dilamar wajib dipilih';
    
    // File validation
    if (!files.pasFoto) newErrors.pasFoto = 'Pas foto wajib diupload';
    if (!files.suratLamaran) newErrors.suratLamaran = 'Surat lamaran wajib diupload';
    if (!files.ktp) newErrors.ktp = 'KTP wajib diupload';
    // CV validation removed as it is merged with Surat Lamaran
    if (!files.ijazah) newErrors.ijazah = 'Ijazah wajib diupload';
    if (!files.str) newErrors.str = 'STR wajib diupload';
    // Sertifikat is now optional
    if (!files.suratPernyataan) newErrors.suratPernyataan = 'Surat pernyataan wajib diupload';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    if (name === 'birthDate' && value) {
      const birthDate = new Date(value);
      // Reset hours to ensure strict date comparison
      birthDate.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Calculate cutoff dates
      const minAgeDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
      const maxAgeDate = new Date(today.getFullYear() - 35, today.getMonth(), today.getDate());

      // Validation logic:
      // 1. Must be at least 18 years old (birthDate <= minAgeDate)
      // 2. Must be at most 35 years old (birthDate >= maxAgeDate)
      // Note: If birthDate < maxAgeDate, it means they were born BEFORE the cutoff, so they are older than 35.
      
      const isTooYoung = birthDate > minAgeDate;
      const isTooOld = birthDate < maxAgeDate;

      if (isTooYoung || isTooOld) {
        setShowAgeWarning(true);
        setFormData(prev => ({ ...prev, [name]: '' }));
        return;
      }
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRemoveFile = (fieldId: string) => {
    setFiles(prev => ({ ...prev, [fieldId]: null }));
    
    // Reset file input value manually
    const inputId = `file-input-${fieldId}`;
    const inputElement = document.getElementById(inputId) as HTMLInputElement;
    if (inputElement) {
      inputElement.value = '';
    }

    // Clear error for this field if exists
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const { name } = e.target;

      // Clear error
      if (errors[name]) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }

      // Validasi Ukuran File
      const maxSize = name === 'sertifikat' ? 2 * 1024 * 1024 : 1 * 1024 * 1024;
      const maxSizeLabel = name === 'sertifikat' ? '2MB' : '1MB';

      if (file.size > maxSize) {
        alert(`Ukuran file melebihi ${maxSizeLabel}. Silakan upload file yang lebih kecil.`);
        e.target.value = ''; // Reset input file
        return;
      }

      setFiles(prev => ({ ...prev, [name]: file }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      // Scroll to top to see errors if needed, or specific element
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    console.log('Submitting form data:', formData); // Debugging
    setStatus('submitting');
    setErrorMessage('');

    const data = new FormData();
    data.append('name', formData.name);
    data.append('nik', formData.nik);
    data.append('gender', formData.gender);
    data.append('birthPlace', formData.birthPlace);
    data.append('birthDate', formData.birthDate);
    data.append('education', formData.education);
    data.append('institution', formData.institution);
    data.append('major', formData.major);
    data.append('gpa', formData.gpa);
    data.append('email', formData.email);
    data.append('phoneNumber', formData.phoneNumber);
    data.append('position', formData.position);
    
    if (files.suratLamaran) data.append('suratLamaran', files.suratLamaran);
    if (files.ktp) data.append('ktp', files.ktp);
    if (files.ijazah) data.append('ijazah', files.ijazah);
    if (files.str) data.append('str', files.str);
    if (files.sertifikat) data.append('sertifikat', files.sertifikat);
    if (files.suratPernyataan) data.append('suratPernyataan', files.suratPernyataan);
    if (files.pasFoto) data.append('pasFoto', files.pasFoto);

    try {
      const response = await axios.post('/register', data);
      if (response.data.applicant && response.data.applicant.id) {
          setRegisteredId(response.data.applicant.id);
      }
      setStatus('success');
    } catch (error: any) {
      console.error(error);
      setStatus('error');
      setErrorMessage(error.response?.data?.error || 'Terjadi kesalahan saat mengirim data.');
    }
  };

  if (status === 'success') {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 animate-in fade-in zoom-in duration-500">
        <div className="bg-white rounded-3xl shadow-xl p-10 border border-green-100">
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 p-4 rounded-full">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Pendaftaran Berhasil!</h2>
          <p className="text-gray-600 text-lg mb-8">
            Terima kasih, <span className="font-semibold text-tangerang-purple">{formData.name.toUpperCase()}</span>. 
            Data lamaran Anda telah kami terima dan akan diverifikasi oleh tim verifikasi panita rekrutment.
          </p>
          <div className="flex flex-col md:flex-row justify-center gap-4">
            <button 
              onClick={() => window.location.reload()} 
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-medium"
            >
              Kembali ke Beranda
            </button>
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Dokumen Penting</h3>
            <p className="text-gray-500 mb-4">Silakan unduh Kartu Pendaftaran Anda sebagai bukti registrasi.</p>
            
            {registeredId ? (
                <button
                    onClick={() => window.location.href = `/api/print-registration-card/${registeredId}?download=true`}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200 font-medium w-full md:w-auto inline-flex items-center justify-center"
                >
                    <Download className="w-5 h-5 mr-2" />
                    Download Kartu Pendaftaran
                </button>
            ) : (
                <Link 
                  to={`/status?nik=${formData.nik}`}
                  className="px-6 py-3 bg-white border-2 border-tangerang-purple text-tangerang-purple rounded-xl hover:bg-purple-50 transition font-medium inline-flex items-center"
                >
                   <Download className="w-5 h-5 mr-2" />
                   Download Kartu Pendaftaran (via Cek Status)
                </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Formulir Pendaftaran Pegawai</h1>
        <p className="text-gray-500 text-lg">Lengkapi data diri dan unggah berkas persyaratan di bawah ini.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Progress Header */}
        <div className="bg-gradient-to-r from-tangerang-purple to-tangerang-light p-1"></div>
        
        <form onSubmit={handleSubmit} className="p-8 md:p-10" noValidate>
          {status === 'error' && (
            <div className="mb-8 bg-red-50 border-l-4 border-red-500 p-4 rounded-r flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5" />
              <div>
                <h4 className="font-bold text-red-700">Gagal Mengirim</h4>
                <p className="text-red-600 text-sm">{errorMessage}</p>
              </div>
            </div>
          )}

          {showAgeWarning && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform scale-100 animate-in zoom-in duration-200">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-red-100 p-3 rounded-full mb-4">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Mohon Maaf</h3>
                  <p className="text-gray-600 mb-6">
                    Usia anda tidak memenuhi syarat pendaftaran, mohon maaf anda tidak dapat melamar.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAgeWarning(false)}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition font-medium"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 flex items-center">
                <span className="bg-tangerang-purple text-white w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">1</span>
                Data Diri
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  name="name" 
                  required
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition ${errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                  placeholder="Sesuai KTP"
                  value={formData.name}
                  onChange={handleInputChange}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NIK</label>
                <input 
                  type="text" 
                  name="nik" 
                  required
                  minLength={16}
                  maxLength={16}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition ${errors.nik ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                  placeholder="Nomor Induk Kependudukan (16 digit)"
                  value={formData.nik}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setFormData(prev => ({ ...prev, nik: value }));
                    // Clear error manually for custom handler
                    if (errors.nik) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.nik;
                        return newErrors;
                      });
                    }
                  }}
                />
                {errors.nik && <p className="text-red-500 text-xs mt-1">{errors.nik}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tempat Lahir</label>
                    <input 
                      type="text" 
                      name="birthPlace" 
                      required
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition ${errors.birthPlace ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      placeholder="Kota Lahir"
                      value={formData.birthPlace}
                      onChange={handleInputChange}
                    />
                    {errors.birthPlace && <p className="text-red-500 text-xs mt-1">{errors.birthPlace}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Lahir <span className="text-xs text-gray-500 font-normal">(Max 35 Tahun)</span></label>
                    <input 
                      type="date" 
                      name="birthDate" 
                      required
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition ${errors.birthDate ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      value={formData.birthDate}
                      onChange={handleInputChange}
                    />
                    {errors.birthDate && <p className="text-red-500 text-xs mt-1">{errors.birthDate}</p>}
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Kelamin</label>
                  <select 
                    name="gender" 
                    required
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition bg-white ${errors.gender ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    value={formData.gender}
                    onChange={handleInputChange}
                  >
                    <option value="">-- Pilih --</option>
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                  {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pendidikan Terakhir</label>
                  <select 
                    name="education" 
                    required
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition bg-white ${errors.education ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    value={formData.education}
                    onChange={handleInputChange}
                  >
                    <option value="">-- Pilih --</option>
                    <option value="SMA/SMK">SMA/SMK</option>
                    <option value="D3">D3</option>
                    <option value="S1">S1</option>
                    <option value="S2">S2</option>
                    <option value="S3">S3</option>
                  </select>
                  {errors.education && <p className="text-red-500 text-xs mt-1">{errors.education}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Institusi Pendidikan</label>
                <input 
                  type="text" 
                  name="institution" 
                  required
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition ${errors.institution ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                  placeholder="Nama Sekolah / Universitas"
                  value={formData.institution}
                  onChange={handleInputChange}
                />
                {errors.institution && <p className="text-red-500 text-xs mt-1">{errors.institution}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jurusan</label>
                  <input 
                    type="text" 
                    name="major" 
                    required={formData.education !== 'SMA/SMK'}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition ${errors.major ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    placeholder="Contoh: Teknik Informatika"
                    value={formData.major}
                    onChange={handleInputChange}
                  />
                  {errors.major && <p className="text-red-500 text-xs mt-1">{errors.major}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IPK Terakhir</label>
                  <input 
                    type="number" 
                    name="gpa" 
                    required={formData.education !== 'SMA/SMK'}
                    step="0.01"
                    min="0"
                    max="4.00"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition ${errors.gpa ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    placeholder="Contoh: 3.50"
                    value={formData.gpa}
                    onChange={handleInputChange}
                  />
                  {errors.gpa && <p className="text-red-500 text-xs mt-1">{errors.gpa}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input 
                  type="email" 
                  name="email" 
                  required
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition ${errors.email ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                  placeholder="email@contoh.com"
                  value={formData.email}
                  onChange={handleInputChange}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nomor HP / WhatsApp</label>
                <input 
                  type="tel" 
                  name="phoneNumber" 
                  required
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition ${errors.phoneNumber ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                  placeholder="Contoh: 081234567890"
                  value={formData.phoneNumber}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setFormData(prev => ({ ...prev, phoneNumber: value }));
                    if (errors.phoneNumber) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.phoneNumber;
                        return newErrors;
                      });
                    }
                  }}
                />
                {errors.phoneNumber && <p className="text-red-500 text-xs mt-1">{errors.phoneNumber}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pas Foto 3x4 Terbaru *</label>
                <div className={`relative border-2 border-dashed rounded-lg p-6 hover:bg-gray-50 transition text-center group ${errors.pasFoto ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}>
                  <input 
                    type="file" 
                    name="pasFoto"
                    required
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-2">
                    <Upload className={`mx-auto h-10 w-10 transition ${errors.pasFoto ? 'text-red-400' : 'text-gray-400 group-hover:text-tangerang-purple'}`} />
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-tangerang-purple">Upload file</span> atau drag and drop
                    </div>
                    <p className="text-xs text-gray-500">JPG, PNG maks 1MB</p>
                    <p className="text-xs text-gray-500 font-medium mt-2 bg-gray-100 py-1 px-2 rounded-full inline-block">
                      Berpakaian Rapih (Background Merah/Biru)
                    </p>
                  </div>
                  {files.pasFoto && (
                    <div className="absolute inset-0 bg-green-50 bg-opacity-90 flex items-center justify-center rounded-lg group-hover:bg-opacity-100 transition cursor-pointer" onClick={() => handlePreview(files.pasFoto!)}>
                      <div className="text-green-700 font-medium flex items-center max-w-full px-4">
                        <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                        <span className="truncate underline decoration-green-700/30 underline-offset-2" title="Klik untuk preview">{files.pasFoto.name}</span>
                      </div>
                      <div className="absolute bottom-2 text-xs text-green-600 flex items-center opacity-0 group-hover:opacity-100 transition">
                         <Eye className="w-3 h-3 mr-1" /> Klik untuk lihat
                      </div>
                    </div>
                  )}
                </div>
                {errors.pasFoto && <p className="text-red-500 text-xs mt-1">{errors.pasFoto}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Posisi Dilamar</label>
                <select 
                  name="position" 
                  required
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition bg-white ${errors.position ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                  value={formData.position}
                  onChange={handleInputChange}
                >
                  <option value="">-- Pilih Posisi --</option>
                  {positions && positions.length > 0 ? (
                    positions.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))
                  ) : (
                    <>
                      <option value="Perawat">Perawat</option>
                      <option value="Bidan">Bidan</option>
                      <option value="Apoteker">Apoteker</option>
                      <option value="Dokter Umum">Dokter Umum</option>
                      <option value="Staff IT">Staff IT</option>
                      <option value="Staff Administrasi">Staff Administrasi</option>
                    </>
                  )}
                </select>
                {errors.position && <p className="text-red-500 text-xs mt-1">{errors.position}</p>}
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 flex items-center">
                <span className="bg-tangerang-purple text-white w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">2</span>
                Dokumen Persyaratan
              </h3>

              <div className="grid grid-cols-1 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-2">
                  <h4 className="font-semibold text-blue-800 mb-1 flex items-center">
                    <Download className="w-4 h-4 mr-2" />
                    Template Surat
                  </h4>
                  <p className="text-sm text-blue-600 mb-3">
                    Silakan unduh template surat lamaran dan surat pernyataan disini, isi, tandatangani di atas materai, lalu scan dan upload kembali sesuai jenisnya.
                  </p>
                  <a 
                    href="https://drive.google.com/drive/folders/1hYt7qbzSbljkJOHfnNWZ1_EGpqwQUwxQ?usp=sharing" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-white border border-blue-300 rounded-md text-sm font-medium text-blue-700 hover:bg-blue-50 transition"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </a>
                </div>

                {[
                  { id: 'suratLamaran', label: 'Surat Lamaran dan CV *', desc: 'Surat Lamaran Kerja & CV (Maks 1MB)', required: true },
                  { id: 'ktp', label: 'KTP *', desc: 'Kartu Tanda Penduduk (Maks 1MB)', required: true },
                  { id: 'ijazah', label: 'Ijazah dan Nilai Terakhir *', desc: 'Scan Asli (Maks 1MB)', required: true },
                  { id: 'str', label: 'STR *', desc: 'Surat Tanda Registrasi (Maks 1MB)', required: true },
                  { id: 'suratPernyataan', label: 'Surat Pernyataan *', desc: 'Scan Asli Bermaterai (Maks 1MB)', required: true },
                  { id: 'sertifikat', label: 'Sertifikat', desc: 'Sertifikat Keahlian (Maks 2MB) - Opsional', required: false },
                ].map((field) => (
                  <div key={field.id} className={`relative border border-dashed rounded-lg p-4 hover:bg-gray-50 transition group ${errors[field.id] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center flex-1 min-w-0">
                        <div className={`p-2 rounded-lg mr-3 flex-shrink-0 ${files[field.id] ? 'bg-green-100 text-green-600' : (errors[field.id] ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-500')}`}>
                          {files[field.id] ? <CheckCircle className="w-5 h-5" /> : (errors[field.id] ? <AlertCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-700 truncate" title={field.label}>{field.label}</p>
                          {files[field.id] ? (
                            <button 
                                type="button"
                                onClick={() => handlePreview(files[field.id]!)}
                                className="text-xs text-left truncate text-blue-600 hover:text-blue-800 hover:underline flex items-center mt-0.5 w-full focus:outline-none"
                                title="Klik untuk preview file"
                            >
                                <Eye className="w-3 h-3 mr-1.5 flex-shrink-0" />
                                <span className="truncate">{files[field.id]?.name}</span>
                            </button>
                          ) : (
                            <p className={`text-xs truncate ${errors[field.id] ? 'text-red-500' : 'text-gray-500'}`} title={field.desc}>
                                {errors[field.id] || field.desc}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {files[field.id] && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(field.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition border border-red-200"
                            title="Hapus file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <label className={`cursor-pointer bg-white border shadow-sm px-3 py-1.5 rounded-md text-sm font-medium transition ${errors[field.id] ? 'text-red-600 border-red-200 hover:text-red-700 hover:border-red-300' : 'text-gray-600 border-gray-200 hover:text-tangerang-purple hover:border-tangerang-purple'}`}>
                          Browse
                          <input 
                            id={`file-input-${field.id}`}
                            type="file" 
                            name={field.id}
                            required={field.required}
                            className="hidden" 
                            onChange={handleFileChange}
                            accept=".pdf,.jpg,.jpeg,.png"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t flex justify-end">
            <button 
              type="submit" 
              disabled={status === 'submitting'}
              className="flex items-center bg-tangerang-purple text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-purple-200 hover:bg-tangerang-light hover:scale-[1.02] active:scale-95 transition disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {status === 'submitting' ? (
                <>Loading...</>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Kirim Lamaran
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* File Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black bg-opacity-75 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col animate-in zoom-in duration-200 overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <div className="flex items-center space-x-2 overflow-hidden">
                 <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                 <h3 className="font-semibold text-gray-800 truncate" title={previewName}>Preview: {previewName}</h3>
              </div>
              <button 
                onClick={closePreview}
                className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 bg-gray-100 p-4 flex items-center justify-center overflow-auto relative">
                {previewType.startsWith('image/') ? (
                    <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain shadow-lg" />
                ) : previewType === 'application/pdf' ? (
                    <iframe src={previewUrl} className="w-full h-full rounded-lg shadow-lg border bg-white" title="PDF Preview"></iframe>
                ) : (
                    <div className="text-center p-8 bg-white rounded-xl shadow">
                        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-4">Preview tidak tersedia untuk tipe file ini.</p>
                        <a href={previewUrl} download={previewName} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <Download className="w-4 h-4 mr-2" /> Download File
                        </a>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}
      {status === 'submitting' && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-purple-100 p-4 rounded-full">
                <Loader2 className="w-10 h-10 text-tangerang-purple animate-spin" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Mengirim Lamaran...</h3>
            <p className="text-gray-600">Mohon tunggu sejenak hingga semua berkas terunggah.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
