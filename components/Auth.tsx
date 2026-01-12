import React, { useState, useEffect } from 'react';
import { UserRole, User } from '../types';
import { ChevronLeft, Globe, AlertCircle, Loader2, KeyRound, MailCheck, ArrowRight, UserX, X, CheckCircle, RefreshCw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { auth, saveUserProfile, getUserProfile } from '../services/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification, AuthError } from 'firebase/auth';

interface AuthProps {
  initialView: 'login' | 'register';
  initialRole?: UserRole;
  onLogin: (user: User) => void;
  onBack: () => void;
}

export const Auth: React.FC<AuthProps> = ({ initialView, initialRole, onLogin, onBack }) => {
  const { t, toggleLanguage, language } = useLanguage();
  const [view, setView] = useState<'login' | 'register' | 'forgot-password'>(initialView);
  const [role, setRole] = useState<UserRole>(initialRole || UserRole.CUSTOMER);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [brandName, setBrandName] = useState('');
  
  // Custom Notification State
  const [notification, setNotification] = useState<{
    show: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showVerificationSent, setShowVerificationSent] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState<any>(null); // Store user object temporarily for resend

  // Auto-hide notification
  useEffect(() => {
    if (notification?.show) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showToast = (type: 'success' | 'error', title: string, message: string) => {
    setNotification({ show: true, type, title, message });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setUnverifiedUser(null);
    setIsLoading(true);

    try {
      if (view === 'forgot-password') {
        await sendPasswordResetEmail(auth, email);
        const msg = "Email reset kata sandi telah dikirim! Silakan periksa kotak masuk Anda.";
        setSuccessMsg(msg);
        showToast('success', 'Email Terkirim', msg);
        setIsLoading(false);
        return;
      }

      if (view === 'register') {
        // 1. Create User in Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        // 2. Prepare User Profile Object
        const newUser: User = {
          id: firebaseUser.uid,
          name: name,
          email: email,
          role: role,
          brandName: role === UserRole.MERCHANT ? brandName : undefined
        };

        // 3. Save Profile to Firestore
        try {
          await saveUserProfile(newUser);
          
          // 4. Send Verification Email
          await sendEmailVerification(firebaseUser);
          
          // 5. DO NOT Sign out immediately. 
          // Keeping the user signed in allows the Firestore write to sync reliably 
          // and prevents "Profile Not Found" errors due to race conditions.
          // App.tsx handles blocking access to dashboard if !emailVerified.
          
          setShowVerificationSent(true);
        } catch (dbError: any) {
          console.error("DB/Email Error during reg:", dbError);
          // Only sign out if critical failure prevents profile creation
          await signOut(auth);
          throw new Error("Gagal menyimpan data profil atau mengirim email. Silakan coba lagi.");
        }

      } else {
        // Login Flow
        let userCredential;
        try {
            userCredential = await signInWithEmailAndPassword(auth, email, password);
        } catch (loginErr: any) {
            // Handle Login Errors Specifically here to be safe
            if (loginErr.code === 'auth/invalid-credential' || loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/wrong-password') {
                throw new Error("Email atau kata sandi salah.");
            }
            throw loginErr;
        }

        const firebaseUser = userCredential.user;

        // Reload user to get fresh token and verification status
        await firebaseUser.reload();

        // --- EMAIL VERIFICATION CHECK ---
        if (!auth.currentUser?.emailVerified) {
            setUnverifiedUser(auth.currentUser); 
            setError("Email belum diverifikasi. Silakan cek kotak masuk email Anda.");
            setIsLoading(false);
            return;
        }

        // Fetch User Profile from Firestore to Check Role
        // Add a small delay/retry logic if needed, but usually not needed if registration worked
        const userProfile = await getUserProfile(firebaseUser.uid);
        
        if (userProfile) {
          // Check Role Match
          if (userProfile.role !== role) {
             await signOut(auth);
             const attemptedRole = role === UserRole.CUSTOMER ? 'Pelanggan (Customer)' : 'Mitra (Merchant)';
             const actualRole = userProfile.role === UserRole.CUSTOMER ? 'Pelanggan (Customer)' : 'Mitra (Merchant)';
             
             showToast('error', 'Jenis Akun Tidak Sesuai', `Akun ini terdaftar sebagai ${actualRole}.`);
             setError(`Akun Anda adalah ${actualRole}. Silakan pindah ke tab yang sesuai.`);
             setIsLoading(false);
             return; 
          }

          onLogin(userProfile);
        } else {
           // Profile missing
           console.error("Profile document missing for UID:", firebaseUser.uid);
           await signOut(auth); // Must sign out because state is invalid
           setError("Profil pengguna tidak ditemukan di database. Hubungi dukungan jika masalah berlanjut.");
        }
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      // Clean up unverified user state if error
      setUnverifiedUser(null);
      
      let msg = "Terjadi kesalahan. Silakan coba lagi.";
      
      if (err.code === 'auth/email-already-in-use') {
        msg = "Email sudah terdaftar. Silakan login.";
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = "Email atau kata sandi salah.";
      } else if (err.code === 'auth/weak-password') {
        msg = "Kata sandi harus minimal 6 karakter.";
      } else if (err.code === 'auth/too-many-requests') {
        msg = "Terlalu banyak percobaan. Silakan tunggu beberapa saat.";
      } else if (err.code === 'permission-denied' || err.message.includes("Missing or insufficient permissions")) {
        msg = "Izin database ditolak. Silakan periksa koneksi atau coba lagi.";
      } else if (err.message) {
        msg = err.message;
      }
      
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    // Check global auth currentUser instead of local state to ensure validity
    if (!auth.currentUser) {
        setError("Sesi habis. Silakan login ulang untuk kirim verifikasi.");
        setUnverifiedUser(null);
        return;
    }
    
    setIsResending(true);
    try {
        await sendEmailVerification(auth.currentUser);
        showToast('success', 'Terkirim', `Email verifikasi dikirim ulang ke ${auth.currentUser.email}`);
        setSuccessMsg("Email verifikasi baru telah dikirim. Cek Inbox/Spam.");
        setError(null); // Clear error message when success
    } catch (e: any) {
        console.error("Resend error:", e);
        if (e.code === 'auth/too-many-requests') {
            setError("Terlalu sering meminta email. Silakan tunggu beberapa menit.");
        } else {
            setError("Gagal mengirim ulang: " + e.message);
        }
    } finally {
        setIsResending(false);
    }
  };

  const renderTitle = () => {
    if (showVerificationSent) return "Verifikasi Email";
    if (view === 'forgot-password') return 'Reset Password';
    return view === 'login' ? t.welcomeBack : t.join;
  };

  const renderDesc = () => {
    if (showVerificationSent) return "Kami telah mengirimkan link verifikasi.";
    if (view === 'forgot-password') return 'Masukkan email Anda untuk menerima link reset kata sandi.';
    return view === 'login' ? t.signInDesc : t.createDesc;
  };

  // Verification Success View
  if (showVerificationSent) {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#FDFBF7]">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-gold/10 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-berry-rich/5 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden relative border border-white/50 p-8 text-center animate-fade-in-up">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 animate-scale-in border-4 border-white shadow-lg">
                    <MailCheck size={48} />
                </div>
                <h2 className="text-3xl font-serif font-bold text-berry-rich mb-4 leading-tight">Pendaftaran Berhasil</h2>
                <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100 mb-8">
                    <p className="text-stone-600 text-sm leading-relaxed">
                        Silahkan verifikasi akun di email Anda: <br/>
                        <strong>{email}</strong>
                    </p>
                    <p className="text-xs text-stone-400 mt-2 italic">
                        (Cek folder Spam jika tidak ada di Inbox)
                    </p>
                </div>
                <button 
                    onClick={() => { 
                        // When going back to login, we can sign out now or let App.tsx handle it.
                        // Ideally, we sign out to force fresh login flow, but if we want to allow 
                        // seamless "I verified in another tab" experience, we could keep session.
                        // But for security/simplicity in this requested flow:
                        signOut(auth).then(() => {
                           setShowVerificationSent(false); 
                           setView('login'); 
                           setEmail(''); 
                           setPassword('');
                        });
                    }}
                    className="w-full py-4 bg-berry-rich text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 hover:-translate-y-1"
                >
                    Kembali ke Login <ArrowRight size={20} />
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
       {/* Background */}
       <div className="absolute inset-0 bg-[#FDFBF7]">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-berry-rich/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-gold/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>
       </div>

       {/* Toast Notification */}
       {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-6 z-[100] animate-fade-in-up w-full max-w-sm px-4">
          <div className={`bg-white shadow-2xl rounded-2xl p-4 border-l-4 flex items-start gap-4 ${notification.type === 'success' ? 'border-green-500' : 'border-red-500'}`}>
            <div className={`p-2 rounded-full shrink-0 ${notification.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
              {notification.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
            </div>
            <div className="flex-1">
              <h4 className={`font-bold text-sm ${notification.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {notification.title}
              </h4>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                {notification.message}
              </p>
            </div>
            <button onClick={() => setNotification(null)} className="text-stone-400 hover:text-stone-600">
              <X size={18} />
            </button>
          </div>
        </div>
       )}

      <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden relative border border-white/50 animate-fade-in-up">
        {/* Decorative Top Border */}
        <div className="h-2 bg-gradient-to-r from-berry-rich to-brand-gold w-full"></div>

        <button 
          onClick={onBack}
          className="absolute top-6 left-6 p-2 rounded-full hover:bg-stone-100 text-stone-500 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>

        <button 
          onClick={toggleLanguage}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-stone-100 text-berry-rich transition-colors"
          title="Switch Language"
        >
          <Globe size={20} />
          <span className="sr-only">{language === 'en' ? 'Bahasa Indonesia' : 'English'}</span>
        </button>
        
        <div className="p-8 pt-12">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <img 
                src="https://raw.githubusercontent.com/idantexe/berrylybelle/refs/heads/main/logoooo.webp" 
                alt="Berryly Belle" 
                className="h-32 w-auto object-contain drop-shadow-md" 
              />
            </div>
            <h2 className="text-3xl font-serif font-bold text-berry-rich mb-2">
              {renderTitle()}
            </h2>
            <p className="text-stone-500 text-sm">
              {renderDesc()}
            </p>
          </div>

          {/* Role Toggle - Hide on Forgot Password */}
          {view !== 'forgot-password' && (
            <div className="flex bg-stone-100/80 p-1.5 rounded-2xl mb-8 relative">
              <button
                type="button"
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 z-10 ${
                  role === UserRole.CUSTOMER ? 'text-berry-rich shadow-sm bg-white' : 'text-stone-400 hover:text-stone-600'
                }`}
                onClick={() => setRole(UserRole.CUSTOMER)}
              >
                {t.customer}
              </button>
              <button
                type="button"
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 z-10 ${
                  role === UserRole.MERCHANT ? 'text-berry-rich shadow-sm bg-white' : 'text-stone-400 hover:text-stone-600'
                }`}
                onClick={() => setRole(UserRole.MERCHANT)}
              >
                {t.merchant}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl border border-red-100 shadow-sm animate-fade-in">
                <div className="flex items-start gap-2">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <span className="font-medium">{error}</span>
                </div>
                {unverifiedUser && (
                    <button 
                        type="button"
                        onClick={handleResendVerification}
                        disabled={isResending}
                        className="mt-3 text-xs font-bold bg-white border border-red-200 text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 flex items-center gap-2 transition-colors w-full justify-center disabled:opacity-70"
                    >
                        {isResending ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                        {isResending ? "Mengirim..." : "Kirim Ulang Email Verifikasi"}
                    </button>
                )}
              </div>
            )}
            
            {/* Simple success message for forgot password or resend */}
            {successMsg && !notification && (
              <div className="bg-green-50 text-green-600 text-sm p-4 rounded-xl flex items-start gap-2 animate-fade-in break-words">
                <KeyRound size={16} className="mt-0.5 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {view === 'register' && (
              <div className="animate-fade-in-up" style={{animationDelay: '0.1s'}}>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.fullName}</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-transparent transition-all"
                  placeholder="Nama Lengkap"
                />
              </div>
            )}
            
            {view === 'register' && role === UserRole.MERCHANT && (
              <div className="animate-fade-in-up" style={{animationDelay: '0.15s'}}>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.brandName}</label>
                <input
                  type="text"
                  required
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-transparent transition-all"
                  placeholder="Contoh: Berrylybelle"
                />
              </div>
            )}

            <div className="animate-fade-in-up" style={{animationDelay: '0.2s'}}>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.email}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-transparent transition-all"
                placeholder="email@contoh.com"
              />
            </div>

            {view !== 'forgot-password' && (
              <div className="animate-fade-in-up" style={{animationDelay: '0.3s'}}>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.password}</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            )}

            {/* Forgot Password Link */}
            {view === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setView('forgot-password'); setError(null); setSuccessMsg(null); setUnverifiedUser(null); }}
                  className="text-xs font-bold text-stone-400 hover:text-berry-rich transition-colors"
                >
                  Lupa Kata Sandi?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-berry-rich to-berry-dark text-white rounded-xl font-bold hover:shadow-lg hover:shadow-berry-rich/30 transition-all transform hover:-translate-y-1 mt-8 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Memproses...</span>
                </>
              ) : (
                view === 'login' ? t.signIn : (view === 'forgot-password' ? 'Kirim Link Reset' : t.createAccount)
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-stone-500">
            {view === 'login' 
              ? `${t.noAccount} ` 
              : (view === 'register' ? `${t.hasAccount} ` : 'Ingat kata sandi Anda? ')}
            
            <button 
              onClick={() => {
                setView(view === 'register' ? 'login' : (view === 'forgot-password' ? 'login' : 'register'));
                setError(null);
                setSuccessMsg(null);
                setUnverifiedUser(null);
              }}
              className="text-berry-rich font-bold hover:text-brand-gold transition-colors underline decoration-2 decoration-transparent hover:decoration-brand-gold"
            >
               {view === 'login' 
                  ? t.signUp 
                  : (view === 'register' ? t.logIn : 'Kembali ke Login')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};