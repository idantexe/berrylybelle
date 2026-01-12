import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { LandingPage } from './components/LandingPage';
import { Auth } from './components/Auth';
import { CustomerDashboard } from './components/CustomerDashboard';
import { MerchantDashboard } from './components/MerchantDashboard';
import { LanguageProvider } from './contexts/LanguageContext';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, getUserProfile } from './services/firebase';
import { Loader2 } from 'lucide-react';

type ViewState = 'landing' | 'login' | 'register' | 'dashboard';

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('landing');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authTargetRole, setAuthTargetRole] = useState<UserRole | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // Monitor Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in, fetch profile
        const profile = await getUserProfile(firebaseUser.uid);
        if (profile) {
          // CRITICAL FIX: 
          // If we are explicitly trying to login with a specific role (authTargetRole is set),
          // and the profile role doesn't match, DO NOT switch to dashboard automatically.
          // Let the Auth component handle the error display and sign out.
          if (authTargetRole && profile.role !== authTargetRole) {
             setLoading(false);
             return;
          }

          setCurrentUser(profile);
          setCurrentView('dashboard');
        } else {
          // Profile doesn't exist yet (or error), maybe stay on auth or landing
          setCurrentUser(null);
        }
      } else {
        // User is signed out
        setCurrentUser(null);
        // Only redirect to landing if we were previously in the dashboard
        // This keeps the user on the Login page if they get kicked out due to wrong role
        if (currentView === 'dashboard') {
          setCurrentView('landing');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [authTargetRole, currentView]); // Add dependencies to ensure logic works with latest state

  const handleNavigate = (view: 'login' | 'register', role?: UserRole) => {
    setAuthTargetRole(role);
    setCurrentView(view);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentView('dashboard');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setCurrentView('landing');
      setAuthTargetRole(undefined);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleBackToLanding = () => {
    setCurrentView('landing');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFBF7]">
        <img 
          src="https://raw.githubusercontent.com/idantexe/berrylybelle/refs/heads/main/logoooo.webp" 
          alt="Loading..." 
          className="h-24 w-auto mb-4 animate-pulse" 
        />
        <Loader2 className="animate-spin text-berry-rich" size={32} />
      </div>
    );
  }

  // Render Logic
  if (currentView === 'landing') {
    return <LandingPage onNavigate={handleNavigate} />;
  }

  if (currentView === 'login' || currentView === 'register') {
    return (
      <Auth 
        initialView={currentView}
        initialRole={authTargetRole}
        onLogin={handleLogin}
        onBack={handleBackToLanding}
      />
    );
  }

  if (currentView === 'dashboard' && currentUser) {
    if (currentUser.role === UserRole.MERCHANT) {
      return <MerchantDashboard user={currentUser} onLogout={handleLogout} />;
    } else {
      return <CustomerDashboard user={currentUser} onLogout={handleLogout} />;
    }
  }

  // Fallback
  return <LandingPage onNavigate={handleNavigate} />;
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
};

export default App;