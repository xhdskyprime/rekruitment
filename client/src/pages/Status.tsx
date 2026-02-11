import React, { useState } from 'react';
import axios from 'axios';
import { Search, FileCheck, XCircle, Clock, Download, User } from 'lucide-react';

const Status = () => {
  const [nik, setNik] = useState('');
  const [applicant, setApplicant] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setApplicant(null);

    try {
      const response = await axios.get(`/api/status?nik=${nik}`);
      setApplicant(response.data.applicant);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Data pelamar dengan NIK tersebut tidak ditemukan.');
      } else {
        setError('Terjadi kesalahan saat mengambil data.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Cek Status Lamaran</h1>
        <p className="text-gray-500">Masukkan NIK yang Anda gunakan saat pendaftaran.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-grow relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              required
              minLength={16}
              maxLength={16}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-tangerang-purple focus:border-transparent sm:text-sm transition"
              placeholder="Masukkan NIK (16 digit)"
              value={nik}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setNik(value);
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex-shrink-0 bg-tangerang-purple text-white px-6 py-3 rounded-xl font-medium hover:bg-tangerang-light transition shadow-md disabled:opacity-70"
          >
            {loading ? 'Mencari...' : <Search className="w-5 h-5" />}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r mb-8 animate-in fade-in slide-in-from-top-2">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {applicant && (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-gray-50 px-8 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800">Detail Lamaran</h3>
            <span className="text-xs font-mono text-gray-400">No. Peserta: {applicant.id}</span>
          </div>
          
          <div className="p-8">
            <div className="flex items-center mb-8">
              <div className="h-16 w-16 rounded-full bg-tangerang-purple/10 flex items-center justify-center text-tangerang-purple font-bold text-2xl mr-4">
                {applicant.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{applicant.name}</h2>
                <p className="text-gray-500">{applicant.position}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">Status Lamaran</p>
                <div className="flex items-center">
                  {applicant.status === 'verified' && (
                    <>
                      <FileCheck className="w-5 h-5 text-green-500 mr-2" />
                      <span className="font-semibold text-green-600">Lolos Verifikasi</span>
                    </>
                  )}
                  {applicant.status === 'rejected' && (
                    <>
                      <XCircle className="w-5 h-5 text-red-500 mr-2" />
                      <span className="font-semibold text-red-600">Tidak Lolos</span>
                    </>
                  )}
                  {applicant.status === 'pending' && (
                    <>
                      <Clock className="w-5 h-5 text-yellow-500 mr-2" />
                      <span className="font-semibold text-yellow-600">Menunggu Verifikasi</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">Tanggal Daftar</p>
                <p className="font-medium text-gray-800">
                  {new Date(applicant.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </p>
              </div>
            </div>

            {applicant.status === 'verified' && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <FileCheck className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="ml-4 flex-grow">
                    <h3 className="text-lg font-medium text-green-800">Kartu Ujian Tersedia!</h3>
                    <p className="mt-1 text-sm text-green-700">
                      Selamat! Berkas Anda telah disetujui. Silakan unduh kartu ujian Anda.
                    </p>
                    <div className="mt-4">
                      <a
                        href={`/api/applicant/${applicant.id}/exam-card?nik=${applicant.nik}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Kartu Ujian (PDF)
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {applicant.status === 'rejected' && (
               <div className="bg-red-50 border border-red-100 rounded-xl p-6">
                 <p className="text-red-700">
                   Mohon maaf, berkas Anda belum memenuhi persyaratan administrasi kami. Tetap semangat dan coba lagi di kesempatan berikutnya.
                 </p>
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Status;
