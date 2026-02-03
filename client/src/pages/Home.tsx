import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Upload, CheckCircle, AlertCircle, FileText, Send, Download } from 'lucide-react';

const Home = () => {
  const [formData, setFormData] = useState({
    name: '',
    nik: '',
    gender: '',
    birthDate: '',
    education: '',
    email: '',
    phoneNumber: '',
    position: '',
  });
  
  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    ktp: null,
    ijazah: null,
    str: null,
    sertifikat: null,
    suratPernyataan: null,
    pasFoto: null
  });

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [positions, setPositions] = useState<{ id: number, name: string }[]>([]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const { name } = e.target;

      // Validasi Ukuran File (Max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert(`Ukuran file ${name} melebihi 2MB. Silakan upload file yang lebih kecil.`);
        e.target.value = ''; // Reset input file
        return;
      }

      setFiles(prev => ({ ...prev, [name]: file }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting form data:', formData); // Debugging
    setStatus('submitting');
    setErrorMessage('');

    const data = new FormData();
    data.append('name', formData.name);
    data.append('nik', formData.nik);
    data.append('gender', formData.gender);
    data.append('birthDate', formData.birthDate);
    data.append('education', formData.education);
    data.append('email', formData.email);
    data.append('phoneNumber', formData.phoneNumber);
    data.append('position', formData.position);
    
    if (files.ktp) data.append('ktp', files.ktp);
    if (files.ijazah) data.append('ijazah', files.ijazah);
    if (files.str) data.append('str', files.str);
    if (files.sertifikat) data.append('sertifikat', files.sertifikat);
    if (files.suratPernyataan) data.append('suratPernyataan', files.suratPernyataan);
    if (files.pasFoto) data.append('pasFoto', files.pasFoto);

    try {
      await axios.post('/register', data);
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
            Terima kasih, <span className="font-semibold text-tangerang-purple">{formData.name}</span>. 
            Data Anda telah kami terima dan akan segera diverifikasi oleh tim HR.
          </p>
          <div className="flex justify-center space-x-4">
            <button 
              onClick={() => window.location.reload()} 
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-medium"
            >
              Kembali ke Beranda
            </button>
            <Link 
              to="/status" 
              className="px-6 py-3 bg-tangerang-purple text-white rounded-xl hover:bg-tangerang-light transition shadow-lg shadow-purple-200 font-medium"
            >
              Cek Status Lamaran
            </Link>
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
        
        <form onSubmit={handleSubmit} className="p-8 md:p-10">
          {status === 'error' && (
            <div className="mb-8 bg-red-50 border-l-4 border-red-500 p-4 rounded-r flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5" />
              <div>
                <h4 className="font-bold text-red-700">Gagal Mengirim</h4>
                <p className="text-red-600 text-sm">{errorMessage}</p>
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition"
                  placeholder="Sesuai KTP"
                  value={formData.name}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NIK</label>
                <input 
                  type="text" 
                  name="nik" 
                  required
                  minLength={16}
                  maxLength={16}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition"
                  placeholder="Nomor Induk Kependudukan (16 digit)"
                  value={formData.nik}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setFormData(prev => ({ ...prev, nik: value }));
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Lahir</label>
                <input 
                  type="date" 
                  name="birthDate" 
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition"
                  value={formData.birthDate}
                  onChange={handleInputChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Kelamin</label>
                  <select 
                    name="gender" 
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition bg-white"
                    value={formData.gender}
                    onChange={handleInputChange}
                  >
                    <option value="">-- Pilih --</option>
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pendidikan Terakhir</label>
                  <select 
                    name="education" 
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition bg-white"
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
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input 
                  type="email" 
                  name="email" 
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition"
                  placeholder="email@contoh.com"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nomor HP / WhatsApp</label>
                <input 
                  type="tel" 
                  name="phoneNumber" 
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition"
                  placeholder="Contoh: 081234567890"
                  value={formData.phoneNumber}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setFormData(prev => ({ ...prev, phoneNumber: value }));
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pas Foto 3x4 (Latar Belakang Merah/Biru)</label>
                <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition text-center group">
                  <input 
                    type="file" 
                    name="pasFoto"
                    required
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-2">
                    <Upload className="mx-auto h-10 w-10 text-gray-400 group-hover:text-tangerang-purple transition" />
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-tangerang-purple">Upload file</span> atau drag and drop
                    </div>
                    <p className="text-xs text-gray-500">JPG, PNG up to 2MB</p>
                  </div>
                  {files.pasFoto && (
                    <div className="absolute inset-0 bg-green-50 bg-opacity-90 flex items-center justify-center rounded-lg">
                      <div className="text-green-700 font-medium flex items-center">
                        <CheckCircle className="w-5 h-5 mr-2" />
                        {files.pasFoto.name}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Posisi Dilamar</label>
                <select 
                  name="position" 
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tangerang-purple focus:border-transparent transition bg-white"
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
                    Template Surat Pernyataan
                  </h4>
                  <p className="text-sm text-blue-600 mb-3">
                    Silakan unduh template surat pernyataan, isi, tandatangani di atas materai, lalu scan dan upload kembali.
                  </p>
                  <a 
                    href="/template-surat-pernyataan.doc" 
                    download="Template_Surat_Pernyataan_RSUD_Tigaraksa.doc"
                    className="inline-flex items-center px-4 py-2 bg-white border border-blue-300 rounded-md text-sm font-medium text-blue-700 hover:bg-blue-50 transition"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </a>
                </div>

                {[
                  { id: 'ktp', label: 'KTP', desc: 'Kartu Tanda Penduduk' },
                  { id: 'ijazah', label: 'Ijazah Terakhir', desc: 'Scan Asli' },
                  { id: 'str', label: 'STR', desc: 'Surat Tanda Registrasi' },
                  { id: 'sertifikat', label: 'Sertifikat', desc: 'Sertifikat Keahlian' },
                  { id: 'suratPernyataan', label: 'Surat Pernyataan', desc: 'Scan Asli Bermaterai' }
                ].map((field) => (
                  <div key={field.id} className="relative border border-dashed border-gray-300 rounded-lg p-4 hover:bg-gray-50 transition group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-lg mr-3 ${files[field.id] ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                          {files[field.id] ? <CheckCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">{field.label}</p>
                          <p className="text-xs text-gray-500">{files[field.id]?.name || field.desc}</p>
                        </div>
                      </div>
                      <label className="cursor-pointer bg-white border border-gray-200 shadow-sm px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-tangerang-purple hover:border-tangerang-purple transition">
                        Browse
                        <input 
                          type="file" 
                          name={field.id}
                          required
                          className="hidden" 
                          onChange={handleFileChange}
                          accept=".pdf,.jpg,.jpeg,.png"
                        />
                      </label>
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
    </div>
  );
};

export default Home;
