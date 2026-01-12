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
        // --- NEW: Global Email Verification Check ---
        if (!firebaseUser.emailVerified) {
          // FIX: Don't force logout immediately if user is on 'login' or 'register' view.
          // This allows Auth.tsx to perform 'saveUserProfile' (requires auth) 
          // or 'sendEmailVerification' (requires auth) before logging out.
          if (currentView !== 'login' && currentView !== 'register') {
             await signOut(auth);
             setCurrentUser(null);
             setAuthTargetRole(undefined);
             if (currentView === 'dashboard') {
                setCurrentView('landing');
             }
          }
          // Do NOT set currentUser if unverified (prevents dashboard access)
          setLoading(false);
          return;
        }

        try {
          // User is signed in AND verified, fetch profile
          const profile = await getUserProfile(firebaseUser.uid);
          if (profile) {
            // Check if specific role was requested via navigation (e.g. Landing buttons)
            if (authTargetRole && profile.role !== authTargetRole) {
               setLoading(false);
               return;
            }

            setCurrentUser(profile);
            
            // RACE CONDITION FIX:
            // If the user is currently on the Login/Register screen, do NOT auto-redirect to Dashboard here.
            // Why? Because Auth.tsx needs to perform its own strict Role Validation (checking the toggle state vs profile role).
            // If Auth.tsx passes validation, it calls onLogin() which manually sets view to 'dashboard'.
            // If we redirect here, we preempt Auth.tsx's validation, leading to the dashboard flashing 
            // and then kicking the user out (bouncing to landing) when Auth.tsx detects the role mismatch.
            //
            // If currentView is 'landing' (fresh load/refresh), we DO auto-redirect.
            if (currentView !== 'login' && currentView !== 'register') {
                setCurrentView('dashboard');
            }
          } else {
            // Profile doesn't exist yet (or error), maybe stay on auth or landing
            setCurrentUser(null);
          }
        } catch (error) {
          console.error("Error in auth state change:", error);
          // If permission denied, user might be logged in but can't read profile.
          // Stay logged out in the UI to prevent hanging.
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