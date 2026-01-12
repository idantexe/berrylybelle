import React from 'react';
import { Sparkles, Scissors, UserCheck, ArrowRight, Globe, Phone, Star } from 'lucide-react';
import { UserRole } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface LandingPageProps {
  onNavigate: (view: 'login' | 'register', role?: UserRole) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const { t, language, toggleLanguage } = useLanguage();

  const handleContactCS = () => {
    window.open('https://wa.me/6285173458645', '_blank');
  };

  const catalogImages = [
    "https://github.com/idantexe/berrylybelle/blob/main/asset/1.jpeg?raw=true",
    "https://github.com/idantexe/berrylybelle/blob/main/asset/2.jpeg?raw=true",
    "https://github.com/idantexe/berrylybelle/blob/main/asset/3.webp?raw=true",
    "https://github.com/idantexe/berrylybelle/blob/main/asset/4.webp?raw=true",
    "https://github.com/idantexe/berrylybelle/blob/main/asset/5.webp?raw=true"
  ];

  return (
    <div className="flex flex-col min-h-screen bg-transparent font-sans overflow-x-hidden">
      {/* Navigation for Language Toggle */}
      <nav className="fixed top-0 left-0 right-0 p-6 z-50 flex justify-between items-center bg-transparent pointer-events-none">
        <div className="pointer-events-auto">
          {/* Optional: Small logo in nav if scrolled */}
        </div>
        <div className="flex gap-3 pointer-events-auto">
          <button 
            onClick={handleContactCS}
            className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-full shadow-lg hover:bg-green-700 transition-all text-sm font-medium hover:shadow-green-200 transform hover:-translate-y-0.5"
          >
            <Phone size={16} />
            <span className="hidden sm:inline">{t.contactCS}</span>
          </button>
          <button 
            onClick={toggleLanguage}
            className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-5 py-2.5 rounded-full shadow-lg border border-white/50 hover:border-brand-gold hover:text-brand-gold transition-all text-berry-rich text-sm font-medium"
          >
            <Globe size={16} />
            {language === 'en' ? 'ID' : 'EN'}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 pb-10">
        {/* Modern Abstract Background Blobs */}
        <div className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-b from-brand-gold/10 to-transparent rounded-full blur-[100px] animate-float"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[800px] h-[800px] bg-gradient-to-t from-berry-rich/5 to-transparent rounded-full blur-[120px] animate-float" style={{animationDelay: '2s'}}></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12 lg:gap-20">
            {/* Left Content */}
            <div className="md:w-1/2 flex flex-col items-center md:items-start text-center md:text-left animate-fade-in-up">
              <div className="mb-8 w-full flex justify-center md:justify-start">
                {/* Logo kept colored on landing page for contrast against light bg, but larger */}
                <img 
                  src="https://raw.githubusercontent.com/idantexe/berrylybelle/refs/heads/main/logoooo.webp" 
                  alt="Berryly Belle Logo" 
                  className="h-56 md:h-72 w-auto object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-700" 
                />
              </div>
              <h1 className="text-6xl md:text-8xl font-serif font-bold text-berry-rich mb-6 leading-tight tracking-tight">
                Berryly <span className="text-brand-gold italic font-light">Belle</span>
              </h1>
              <p className="text-lg md:text-xl text-stone-600 mb-10 max-w-lg leading-relaxed font-light">
                {t.tagline}
              </p>
              <div className="flex flex-col sm:flex-row gap-5 w-full justify-center md:justify-start">
                <button 
                  onClick={() => onNavigate('register')}
                  className="group px-8 py-4 bg-berry-rich text-white rounded-full font-serif font-bold text-lg hover:bg-berry-dark transition-all shadow-xl hover:shadow-berry-rich/40 hover:-translate-y-1 flex items-center justify-center gap-3 min-w-[220px]"
                >
                  SIGN UP / DAFTAR 
                  <span className="bg-white/20 rounded-full p-1 group-hover:translate-x-1 transition-transform">
                    <ArrowRight size={16} />
                  </span>
                </button>
                <button 
                  onClick={() => onNavigate('login')}
                  className="px-8 py-4 bg-white/50 backdrop-blur-sm text-berry-rich border-2 border-berry-rich/10 rounded-full font-serif font-bold text-lg hover:bg-white hover:border-berry-rich transition-all shadow-sm min-w-[220px]"
                >
                  SIGN IN / MASUK
                </button>
              </div>
            </div>
            
            {/* Right Image (Frame) - Fixed Border Offset */}
            <div className="md:w-1/2 flex justify-center md:justify-end mt-12 md:mt-0 relative animate-scale-in" style={{animationDelay: '0.2s'}}>
              {/* Container for the image and frame */}
              <div className="relative w-[340px] md:w-[420px] h-[500px] md:h-[600px] p-3">
                 {/* Gold Border Frame - Perfectly Aligned around the image */}
                 <div className="absolute inset-0 border-[3px] border-brand-gold/40 rounded-t-[13rem] rounded-b-[4rem]"></div>
                 
                 {/* Main Image Container - Centered within the border */}
                 <div className="absolute inset-4 bg-white rounded-t-[12rem] rounded-b-[3rem] shadow-2xl overflow-hidden">
                   <div className="w-full h-full relative group">
                     <img 
                      src="https://github.com/idantexe/berrylybelle/blob/main/asset/6.webp?raw=true" 
                      alt="Fashion Model" 
                      className="w-full h-full object-cover transition-transform duration-[3s] group-hover:scale-110"
                    />
                     <div className="absolute inset-0 bg-gradient-to-t from-berry-rich/30 to-transparent opacity-40"></div>
                   </div>
                 </div>

                 {/* Floating Badge */}
                 <div className="absolute top-[45%] -right-4 md:-right-8 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/50 flex flex-col items-center gap-1 animate-float">
                    <div className="bg-brand-gold/10 p-2.5 rounded-full text-brand-gold">
                      <Sparkles size={24} />
                    </div>
                    <span className="font-serif font-bold text-berry-rich text-lg">Koleksi</span>
                    <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Terbaru</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Catalog / Collection Section */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in-up">
            <div className="inline-flex items-center gap-4 mb-4 px-6 py-2 rounded-full bg-brand-gold/5 border border-brand-gold/20">
              <span className="text-brand-gold uppercase tracking-[0.2em] font-bold text-xs">Portofolio Eksklusif</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-serif font-bold text-berry-rich mb-6">{t.ourCollection}</h2>
            <p className="max-w-3xl mx-auto text-lg text-stone-600 leading-relaxed font-light">
              {t.collectionDesc}
            </p>
          </div>

          {/* Catalog Layout */}
          <div className="relative group px-4 md:px-0">
            <div className="flex overflow-x-auto pb-12 gap-8 snap-x snap-mandatory scrollbar-hide">
              {catalogImages.map((img, idx) => (
                <div 
                  key={idx} 
                  className="flex-shrink-0 w-[280px] md:w-[340px] h-[450px] md:h-[520px] rounded-[2.5rem] overflow-hidden shadow-lg snap-center relative group/item cursor-pointer transition-all duration-500 hover:-translate-y-4 hover:shadow-2xl bg-white border border-stone-100"
                >
                   <img 
                    src={img} 
                    alt={`Collection Item ${idx + 1}`} 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover/item:scale-110" 
                  />
                   <div className="absolute inset-0 bg-gradient-to-t from-berry-rich/90 via-transparent to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">
                      <div className="transform translate-y-8 group-hover/item:translate-y-0 transition-transform duration-500 ease-out">
                        <p className="text-brand-gold font-serif text-3xl italic mb-2">Ukuran Pas</p>
                        <p className="text-white/90 text-sm font-light mb-6 line-clamp-2">Detail indah yang disesuaikan khusus untuk Anda.</p>
                        <button className="bg-white/20 backdrop-blur-md border border-white/40 text-white px-6 py-3 rounded-full text-sm flex items-center gap-2 hover:bg-white hover:text-berry-rich transition-all duration-300">
                          Lihat Desain <ArrowRight size={14} />
                        </button>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 relative z-10 bg-white/30 backdrop-blur-sm my-10 rounded-[3rem] mx-4 md:mx-8">
        <h2 className="text-4xl md:text-5xl font-serif font-bold text-center mb-16 text-berry-rich">{t.whyChoose}</h2>
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-10">
          {[
            { icon: UserCheck, title: t.personalized, desc: t.personalizedDesc, color: 'text-brand-gold', bg: 'bg-brand-gold/10' },
            { icon: Scissors, title: t.measurements, desc: t.measurementsDesc, color: 'text-berry-rich', bg: 'bg-berry-rich/10' },
            { icon: Sparkles, title: t.aiStyle, desc: t.aiStyleDesc, color: 'text-purple-500', bg: 'bg-purple-100' }
          ].map((feature, idx) => (
            <div key={idx} className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-stone-100 hover:border-brand-gold/30 text-center hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group">
              <div className={`w-24 h-24 ${feature.bg} rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner group-hover:scale-110 transition-transform duration-500`}>
                <feature.icon size={40} className={feature.color} />
              </div>
              <h3 className="text-2xl font-serif font-bold mb-4 text-brand-dark">{feature.title}</h3>
              <p className="text-stone-500 leading-relaxed font-light text-lg">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Brand Highlight */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto rounded-[3rem] overflow-hidden relative shadow-2xl group">
          <div className="absolute inset-0 bg-gradient-to-r from-berry-rich to-berry-dark transition-transform duration-[3s] group-hover:scale-105"></div>
          {/* Pattern overlay */}
          <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>
          
          <div className="relative z-10 px-8 py-24 md:p-24 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="text-center md:text-left flex-1">
              <img 
                 src="https://github.com/idantexe/berrylybelle/blob/main/asset/AIEnhancer_WhatsApp_Image_2026-01-08_at_1.png?raw=true" 
                 alt="Berrylybelle Signature"
                 className="h-32 md:h-48 mb-8 object-contain mx-auto md:mx-0 drop-shadow-lg brightness-0 invert opacity-90"
              />
              <p className="max-w-xl text-white/90 text-xl md:text-2xl leading-relaxed font-serif italic font-light">
                "{t.pioneer}"
              </p>
            </div>
            <button 
              onClick={() => onNavigate('login')} 
              className="px-12 py-6 bg-white text-berry-rich rounded-full hover:bg-brand-gold hover:text-white transition-all font-bold tracking-wide shadow-2xl hover:shadow-white/20 transform hover:scale-105 duration-300 text-lg"
            >
              {t.viewCollection}
            </button>
          </div>
        </div>
      </section>
      
      <footer className="bg-white/40 backdrop-blur-md py-12 mt-auto border-t border-brand-gold/10">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4 text-berry-rich font-serif font-bold text-2xl">
             <span>Berryly</span>
             <Star size={14} className="text-brand-gold fill-brand-gold" />
             <span className="italic">Belle</span>
          </div>
          <p className="text-stone-500 text-sm">
            &copy; {new Date().getFullYear()} {t.footer}
          </p>
          <p className="text-[10px] text-stone-300 mt-2">v1.0.0 (Build 20250523)</p>
        </div>
      </footer>
    </div>
  );
};