import { Clock, CheckCircle, FileCheck, Calendar, Bell } from 'lucide-react';

const VerificationPending = () => {
    return (
        <div className="w-full max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                {/* Header Section */}
                <div className="bg-gradient-to-br from-tangerang-purple to-tangerang-light p-10 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10">
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
                            <circle cx="50" cy="0" r="50" fill="white" fillOpacity="0.5" />
                        </svg>
                    </div>
                    
                    <div className="relative z-10">
                        <div className="mx-auto w-28 h-28 bg-white/10 rounded-full flex items-center justify-center mb-6 backdrop-blur-sm shadow-xl ring-4 ring-white/20 animate-pulse-slow">
                            <FileCheck className="w-14 h-14 text-tangerang-gold" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight drop-shadow-sm">
                            Pendaftaran Ditutup
                        </h1>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 rounded-full border border-white/20 backdrop-blur-sm">
                            <span className="w-2 h-2 bg-tangerang-gold rounded-full animate-pulse"></span>
                            <p className="text-white text-lg font-medium">Tahap Verifikasi Berkas Sedang Berlangsung</p>
                        </div>
                    </div>
                </div>
                
                {/* Content Section */}
                <div className="p-8 md:p-12">
                    <div className="grid md:grid-cols-2 gap-10 items-start">
                        {/* Status Card */}
                        <div className="bg-purple-50 rounded-2xl p-6 border border-purple-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-purple-100 rounded-full opacity-50 blur-xl group-hover:scale-110 transition-transform"></div>
                            
                            <div className="flex items-center gap-3 mb-4 relative z-10">
                                <div className="p-2 bg-white rounded-lg shadow-sm text-tangerang-purple">
                                    <Clock className="w-6 h-6" />
                                </div>
                                <h3 className="font-bold text-xl text-tangerang-purple">Status Saat Ini</h3>
                            </div>
                            <p className="text-gray-700 leading-relaxed relative z-10">
                                Terima kasih atas antusiasme Anda. Saat ini, Panitia Seleksi RSUD Tigaraksa sedang melakukan 
                                <span className="font-semibold text-tangerang-purple"> verifikasi dan validasi berkas </span> 
                                seluruh pelamar secara bertahap dan teliti.
                            </p>
                        </div>

                        {/* Next Steps */}
                        <div>
                            <h3 className="font-bold text-lg text-gray-900 mb-5 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-tangerang-light" />
                                Agenda Selanjutnya
                            </h3>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-4 text-gray-700 bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:border-purple-200 transition-colors">
                                    <div className="mt-1">
                                        <CheckCircle className="w-5 h-5 text-tangerang-gold flex-shrink-0" />
                                    </div>
                                    <div>
                                        <span className="font-semibold block text-gray-900">Verifikasi Administrasi</span>
                                        <span className="text-sm text-gray-500">Pengecekan kelengkapan & keaslian dokumen</span>
                                    </div>
                                </li>
                                <li className="flex items-start gap-4 text-gray-700 bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:border-purple-200 transition-colors">
                                    <div className="mt-1">
                                        <Bell className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                    </div>
                                    <div>
                                        <span className="font-semibold block text-gray-900">Pengumuman Hasil</span>
                                        <span className="text-sm text-gray-500">Akan diumumkan melalui website ini</span>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="mt-12 pt-8 border-t border-gray-100">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-r from-gray-50 to-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-tangerang-purple/10 rounded-full text-tangerang-purple">
                                    <Bell className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 mb-1">Pantau Terus Informasi</h4>
                                    <div className="text-gray-600 text-sm space-y-2">
                                        <p>
                                            Hasil seleksi administrasi nanti dapat dilihat pada menu <span className="font-semibold text-tangerang-purple">Status</span> saat fase Pengumuman telah dibuka.
                                        </p>
                                        <p className="font-medium text-tangerang-purple">
                                            Seluruh proses pendaftaran tidak dipungut biaya (GRATIS).
                                        </p>
                                        <p>
                                            Peserta diimbau untuk waspada terhadap pihak-pihak yang mengatasnamakan panitia dan meminta sejumlah uang dalam bentuk apa pun.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="mt-8 text-center">
                <p className="text-gray-400 text-sm">
                    &copy; {new Date().getFullYear()} RSUD Tigaraksa - Panitia Seleksi Pegawai
                </p>
            </div>
        </div>
    );
};

export default VerificationPending;
