
import React, { useState, useEffect } from 'react';
import { 
  ChevronDown, CheckCircle2, ArrowRight, ShieldCheck, ExternalLink, 
  Copy, Zap, Clock, Heart, TrendingUp, Layout, PlusCircle, 
  Sparkles, User, LogOut, MessageSquare, BarChart, Settings, 
  Layers, Lock, Smartphone, PieChart, Users, Activity, Briefcase,
  Search, Bell, Filter, MoreVertical, Globe, Youtube, Mail, MousePointer2,
  Cpu, Lightbulb, Target, BookOpen, CheckSquare, BarChart3, Tag
} from 'lucide-react';
import { INSTRUCTIONS_DATA, SHARED_EMAIL } from './constants';
import { UserRole, ClientData, InstructionItem } from './types';

const instructionIcons: Record<string, React.ReactElement> = {
  'google-ads': <MousePointer2 className="w-5 h-5 text-blue-600" />,
  'ga4': <BarChart3 className="w-5 h-5 text-orange-500" />,
  'gtm': <Tag className="w-5 h-5 text-teal-600" />,
  'looker': <PieChart className="w-5 h-5 text-purple-600" />,
  'gsc': <Search className="w-5 h-5 text-green-600" />,
  'meta': <Globe className="w-5 h-5 text-indigo-600" />,
};

const instructions: InstructionItem[] = INSTRUCTIONS_DATA.map((item) => ({
  ...item,
  icon: instructionIcons[item.id],
}));


// --- STYLED COMPONENTS ---

/**
 * CopyBadge component to provide a user-friendly way to copy text (like emails) to clipboard.
 * Fixes the "Cannot find name 'CopyBadge'" error on line 324.
 */
const CopyBadge = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border font-bold text-sm transition-all ${
        copied 
        ? 'bg-green-50 border-green-200 text-green-600' 
        : 'bg-white border-slate-200 text-blue-600 hover:border-blue-300 hover:bg-blue-50'
      }`}
    >
      {text}
      {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

const NavButton = ({ active, onClick, children, icon: Icon }: { active?: boolean, onClick?: () => void, children: React.ReactNode, icon: any }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-6 py-3.5 rounded-2xl font-bold transition-all duration-300 ${
      active 
      ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 translate-x-1' 
      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
    }`}
  >
    <Icon className="w-5 h-5" />
    {children}
  </button>
);

const ChannelNode = ({ icon: Icon, label, percentage, color }: any) => (
  <div className="flex flex-col items-center gap-3 group">
    <div className={`w-16 h-16 rounded-[1.5rem] bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center text-${color}-400 group-hover:scale-110 transition-transform relative`}>
      <Icon className="w-7 h-7" />
      <div className={`absolute -top-2 -right-2 bg-${color}-500 text-[10px] text-white font-black px-1.5 py-0.5 rounded-lg`}>{percentage}%</div>
    </div>
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
  </div>
);

const ManualSection = () => {
  const [language, setLanguage] = useState<'cs' | 'en'>('cs');

  const manualContent = {
    cs: {
      title: 'Podrobný manuál pro připojení marketingových kanálů',
      subtitle: 'Návod pro sdílení přístupů k vašim marketingovým nástrojům',
      instructions: [
        {
          platform: 'Google Ads (Reklamy)',
          steps: [
            'Přihlaste se do Google Ads na adrese: https://ads.google.com',
            'Klikněte na "Nástroje a nastavení" (ikona klíče) v horním menu',
            'V sekci "Nastavení" zvolte "Přístup a zabezpečení"',
            'Klikněte na modré tlačítko PLUS (+)',
            'Vložte email: pavel.kaspar@okamih.cz',
            'Zvolte úroveň přístupu "SPRÁVCE" (Admin)',
            'Klikněte na "Odeslat pozvánku"'
          ],
          tips: 'Ujistěte se, že poskytujete plný přístup pro efektivní správu vašich kampaní.'
        },
        {
          platform: 'Google Analytics 4 (Měření)',
          steps: [
            'Přihlaste se do Google Analytics na adrese: https://analytics.google.com',
            'Klikněte vlevo dole na ozubené kolo (Správce)',
            'V prvním sloupci (Účet) klikněte na "Správa přístupu k účtu"',
            'Klikněte na modré PLUS (+) vpravo nahoře a "Přidat uživatele"',
            'Zadejte email: pavel.kaspar@okamih.cz',
            'Zaškrtněte roli "EDITOR" (nebo Administrátor pro plnou kontrolu)',
            'Klikněte na "Přidat"'
          ],
          tips: 'Editor role umožňuje úplnou analýzu dat a tvorbu reportů.'
        },
        {
          platform: 'Google Tag Manager (Měřící kódy)',
          steps: [
            'Otevřete GTM na adrese: https://tagmanager.google.com',
            'Přejděte do záložky "Správce" (Admin)',
            'V pravém sloupci (Kontejner) zvolte "Správa uživatelů"',
            'Klikněte na "Nový" (modré +) -> "Přidat uživatele"',
            'Vložte email: pavel.kaspar@okamih.cz',
            'V "Oprávnění kontejneru" zaškrtněte vše (Publikovat, Schválit, Upravit, Číst)',
            'Klikněte na "Pozvat"'
          ],
          tips: 'Plná oprávnění jsou nezbytná pro správu měřících kódů a značek.'
        },
        {
          platform: 'Looker Studio (Reporty a grafy)',
          steps: [
            'Pokud již máte existující reporty, otevřete daný report',
            'Vpravo nahoře klikněte na tlačítko "Sdílet"',
            'Přidejte email: pavel.kaspar@okamih.cz',
            'Nastavte roli na "EDITOR"',
            'Klikněte na "Odeslat"'
          ],
          tips: 'Tímto získáme přístup k vizualizaci vašich dat a tvorbě reportů.'
        },
        {
          platform: 'Google Search Console (SEO)',
          steps: [
            'Přihlaste se do Search Console na adrese: https://search.google.com/search-console',
            'V menu vlevo sjeďte úplně dolů a klikněte na "Nastavení"',
            'Zvolte "Uživatelé a oprávnění"',
            'Klikněte na tlačítko "Přidat uživatele"',
            'Zadejte email: pavel.kaspar@okamih.cz',
            'Oprávnění nastavte na "ÚPLNÉ" (Full)',
            'Potvrďte tlačítkem "Přidat"'
          ],
          tips: 'Plný přístup je nezbytný pro SEO optimalizaci a monitorování výkonu.'
        },
        {
          platform: 'Meta (Facebook / Instagram Ads)',
          steps: [
            'Otevřete Nastavení firmy (Business Settings) na adrese: https://business.facebook.com/settings',
            'V sekci "Uživatelé" -> "Lidé" klikněte na "Přidat"',
            'Vložte email: pavel.kaspar@okamih.cz',
            'Povolte "Úplnou kontrolu" (Full Control / Admin access)',
            'V dalším kroku nám přiřaďte přístup k "Stránkám" a "Účtům pro reklamu"'
          ],
          tips: 'Ujistěte se, že poskytujete přístup ke všem relevantním stránkám a reklamním účtům.'
        }
      ],
      contact: 'Pro jakékoli otázky nebo potíže nás kontaktujte na: pavel.kaspar@okamih.cz'
    },
    en: {
      title: 'Detailed Manual for Connecting Marketing Channels',
      subtitle: 'Guide for Sharing Access to Your Marketing Tools',
      instructions: [
        {
          platform: 'Google Ads (Advertising)',
          steps: [
            'Log in to Google Ads at: https://ads.google.com',
            'Click on "Tools and Settings" (key icon) in the top menu',
            'In the "Settings" section, select "Access and Security"',
            'Click the blue PLUS (+) button',
            'Enter email: pavel.kaspar@okamih.cz',
            'Select access level "ADMIN"',
            'Click "Send Invitation"'
          ],
          tips: 'Make sure to provide full access for effective campaign management.'
        },
        {
          platform: 'Google Analytics 4 (Measurement)',
          steps: [
            'Log in to Google Analytics at: https://analytics.google.com',
            'Click on the gear icon (Admin) in the bottom left',
            'In the first column (Account), click "Account Access Management"',
            'Click the blue PLUS (+) button in the top right and "Add User"',
            'Enter email: pavel.kaspar@okamih.cz',
            'Check the "EDITOR" role (or Administrator for full control)',
            'Click "Add"'
          ],
          tips: 'Editor role enables complete data analysis and report creation.'
        },
        {
          platform: 'Google Tag Manager (Tracking Codes)',
          steps: [
            'Open GTM at: https://tagmanager.google.com',
            'Go to the "Admin" tab',
            'In the right column (Container), select "User Management"',
            'Click "New" (blue +) -> "Add User"',
            'Enter email: pavel.kaspar@okamih.cz',
            'In "Container Permissions" check all (Publish, Approve, Edit, Read)',
            'Click "Invite"'
          ],
          tips: 'Full permissions are essential for managing tracking codes and tags.'
        },
        {
          platform: 'Looker Studio (Reports and Charts)',
          steps: [
            'If you already have existing reports, open the specific report',
            'Click the "Share" button in the top right',
            'Add email: pavel.kaspar@okamih.cz',
            'Set role to "EDITOR"',
            'Click "Send"'
          ],
          tips: 'This gives us access to visualize your data and create reports.'
        },
        {
          platform: 'Google Search Console (SEO)',
          steps: [
            'Log in to Search Console at: https://search.google.com/search-console',
            'In the left menu, scroll all the way down and click "Settings"',
            'Select "Users and Permissions"',
            'Click the "Add User" button',
            'Enter email: pavel.kaspar@okamih.cz',
            'Set permissions to "FULL"',
            'Confirm with "Add"'
          ],
          tips: 'Full access is essential for SEO optimization and performance monitoring.'
        },
        {
          platform: 'Meta (Facebook / Instagram Ads)',
          steps: [
            'Open Business Settings at: https://business.facebook.com/settings',
            'In the "Users" -> "People" section, click "Add"',
            'Enter email: pavel.kaspar@okamih.cz',
            'Enable "Full Control" (Admin access)',
            'In the next step, assign us access to "Pages" and "Ad Accounts"'
          ],
          tips: 'Make sure to provide access to all relevant pages and advertising accounts.'
        }
      ],
      contact: 'For any questions or issues, contact us at: pavel.kaspar@okamih.cz'
    }
  };

  const currentContent = manualContent[language];

  return (
    <div className="bg-white rounded-[3rem] border border-slate-200/60 p-12 shadow-xl mb-24">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-3xl font-black text-slate-900 mb-2">{currentContent.title}</h3>
          <p className="text-slate-500 font-medium">{currentContent.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setLanguage('cs')}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
              language === 'cs' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Česky
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
              language === 'en' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            English
          </button>
        </div>
      </div>

      <div className="space-y-12">
        {currentContent.instructions.map((platform, index) => (
          <div key={index} className="border-t border-slate-200/60 pt-12">
            <h4 className="text-2xl font-black text-slate-900 mb-8">{platform.platform}</h4>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <ol className="space-y-6">
                  {platform.steps.map((step, stepIndex) => (
                    <li key={stepIndex} className="flex gap-6 items-start">
                      <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-lg font-black border-2 border-white shadow-lg">
                        {stepIndex + 1}
                      </div>
                      <div className="pt-1 text-slate-700 font-medium text-lg leading-relaxed">
                        {step}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                    💡
                  </div>
                  <div>
                    <h5 className="font-bold text-blue-900 mb-2">Tip:</h5>
                    <p className="text-blue-800 text-sm leading-relaxed">{platform.tips}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 pt-8 border-t border-slate-200/60">
        <p className="text-slate-600 text-center font-medium">{currentContent.contact}</p>
      </div>
    </div>
  );
};

// --- MAIN APPLICATION ---

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState<UserRole>('CUSTOMER');
  const [stage, setStage] = useState<'intro' | 'setup' | 'dashboard'>('intro');
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [os, setOs] = useState<'win' | 'mac' | 'other'>('other');
  const [activeCategory, setActiveCategory] = useState<'plans' | 'priorities' | 'research' | 'ideas'>('priorities');
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [setupState, setSetupState] = useState<Record<string, 'have' | 'need'>>({});
  
  const [clientData] = useState<ClientData>({
    domain: 'mojefirma.cz',
    email: 'zakaznik@email.cz',
    onboardingComplete: false,
    metrics: { roas: '8.4x', spend: '45,200 Kč', conversions: '142', revenue: '379,680 Kč' },
    tasks: [
      { id: '1', title: 'Analýza klíčových slov', status: 'done' },
      { id: '2', title: 'Nastavení GTM kontejneru', status: 'done' },
      { id: '3', title: 'Spuštění Performance Max kampaní', status: 'todo' },
    ]
  });

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) setOs('mac');
    else if (ua.includes('win')) setOs('win');
  }, []);

  const handleLogin = (selectedRole: UserRole) => {
    setRole(selectedRole);
    setIsLoggedIn(true);
    setStage(selectedRole === 'ADMIN' ? 'dashboard' : 'intro');
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#FDFDFF] text-slate-900 font-sans selection:bg-blue-100 flex flex-col">
        <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-slate-100 px-10 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4 font-black text-2xl tracking-tighter">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">M</div>
            MarketingPortal
          </div>
          <div className="flex gap-4">
            <button onClick={() => handleLogin('ADMIN')} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors flex items-center gap-2">
              <Lock className="w-3 h-3" /> Admin
            </button>
            <button onClick={() => handleLogin('CUSTOMER')} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-sm hover:bg-blue-600 transition-all shadow-xl">
              Klientská Sekce
            </button>
          </div>
        </header>

        <section className="relative flex-1 overflow-hidden pt-44 pb-24 px-6 flex items-center">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-20">
            <div className="flex-1 text-center lg:text-left z-10 animate-fadeIn">
              <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-blue-50 text-blue-600 text-sm font-black tracking-tight mb-10 shadow-sm border border-blue-100">
                <Sparkles className="w-4 h-4" /> Strategie & Implementace
              </div>
              <h1 className="text-7xl lg:text-8xl font-black text-slate-900 mb-10 leading-[0.95] tracking-tighter">
                Váš marketing, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">v nejlepší formě.</span>
              </h1>
              <p className="text-2xl text-slate-500 mb-12 leading-relaxed max-w-2xl font-medium">Zbavte se chaosu. Připravíme kompletní infrastrukturu pro váš digitální růst.</p>
              <button onClick={() => setStage('setup')} className="group inline-flex items-center gap-4 bg-slate-900 text-white px-12 py-6 rounded-3xl font-black text-xl hover:bg-blue-600 transition-all shadow-2xl active:scale-95">
                Začít Setup Ekosystému <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            <div className="flex-1 hidden lg:block relative">
              <div className="w-full aspect-square bg-white rounded-[4rem] border border-slate-100 p-12 shadow-2xl relative overflow-hidden">
                <svg viewBox="0 0 400 300" className="w-full h-full opacity-20">
                  <path d="M 20 250 C 80 230 120 50 180 80 S 260 220 380 40" fill="none" stroke="black" strokeWidth="1" strokeDasharray="5 5" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center p-20">
                   <div className="grid grid-cols-2 gap-8">
                      <div className="w-32 h-32 bg-blue-50 rounded-3xl animate-pulse"></div>
                      <div className="w-32 h-32 bg-indigo-50 rounded-3xl delay-75 animate-pulse"></div>
                      <div className="w-32 h-32 bg-slate-50 rounded-3xl delay-150 animate-pulse"></div>
                      <div className="w-32 h-32 bg-orange-50 rounded-3xl delay-200 animate-pulse"></div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (role === 'ADMIN') {
    return (
      <div className="min-h-screen bg-[#0F172A] flex text-slate-200 selection:bg-blue-500/30">
        <aside className="w-80 bg-slate-900 border-r border-white/5 flex flex-col fixed h-full z-50">
          <div className="p-10 pb-6 flex items-center gap-4 font-black text-2xl tracking-tighter text-white">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">M</div>
            Command
          </div>
          <nav className="flex-1 px-6 space-y-1 py-6">
            <div className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-slate-500">Global Portfolio</div>
            <NavButton active icon={Users}>Klienti</NavButton>
            <NavButton icon={Cpu}>AI Automation</NavButton>
            <NavButton icon={BarChart}>Agency ROI</NavButton>
            <div className="pt-10 px-4 text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-slate-500">Resources</div>
            <NavButton icon={BookOpen}>Knowledge Base</NavButton>
            <NavButton icon={Layers}>Master Templates</NavButton>
          </nav>
          <div className="p-8">
            <button onClick={() => setIsLoggedIn(false)} className="w-full flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-slate-400 hover:text-white transition-all">
              <LogOut className="w-5 h-5" /> Logout
            </button>
          </div>
        </aside>

        <main className="flex-1 ml-80 min-h-screen p-12">
          <div className="max-w-7xl mx-auto space-y-12">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-4xl font-black text-white tracking-tight mb-2">MojeFirma.cz</h2>
                <p className="text-slate-500 font-medium">Strategický přehled a marketingový tok</p>
              </div>
              <div className="flex gap-4">
                 <div className="bg-slate-800 border border-white/5 p-4 rounded-3xl flex items-center gap-6 pr-8">
                    <div className="flex items-center gap-3">
                       <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                       <span className="text-xs font-black uppercase tracking-widest text-slate-400">Live Status</span>
                    </div>
                    <div className="h-6 w-px bg-white/10"></div>
                    <div className="flex items-center gap-2">
                       <span className="text-xl font-black text-white">8.4x</span>
                       <span className="text-[10px] font-bold text-slate-500">ROAS</span>
                    </div>
                 </div>
              </div>
            </header>

            {/* MARKETING ECOSYSTEM VISUALIZATION */}
            <div className="bg-slate-800/50 border border-white/5 rounded-[3rem] p-12 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px]"></div>
              <h3 className="text-sm font-black uppercase tracking-[0.3em] text-blue-400 mb-12 text-center">Marketing Flow & Infrastructure</h3>
              
              <div className="flex items-center justify-between relative max-w-5xl mx-auto">
                <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-y-1/2 z-0"></div>
                
                <div className="z-10 flex flex-col items-center gap-12 w-full">
                  <div className="flex justify-around w-full">
                    <ChannelNode icon={Mail} label="Mailing" percentage={85} color="purple" />
                    <ChannelNode icon={MousePointer2} label="Google Ads" percentage={100} color="blue" />
                    <ChannelNode icon={Globe} label="SEO" percentage={45} color="green" />
                  </div>
                  
                  <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-blue-500/20 z-20 border-4 border-[#0F172A]">
                    <Cpu className="w-10 h-10" />
                  </div>

                  <div className="flex justify-around w-full">
                    <ChannelNode icon={Youtube} label="YouTube" percentage={20} color="red" />
                    <ChannelNode icon={Smartphone} label="Social/FB" percentage={95} color="indigo" />
                    <ChannelNode icon={PieChart} label="Analytics" percentage={100} color="orange" />
                  </div>
                </div>
              </div>
            </div>

            {/* CHANNEL DEEP DIVE & NOTES */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-slate-800/50 border border-white/5 rounded-[3rem] p-10">
                <div className="flex items-center justify-between mb-8">
                   <div className="flex gap-4">
                      {['priorities', 'plans', 'research', 'ideas'].map((cat) => (
                        <button 
                          key={cat}
                          onClick={() => setActiveCategory(cat as any)}
                          className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === cat ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-white'}`}
                        >
                          {cat}
                        </button>
                      ))}
                   </div>
                   <button className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                      <PlusCircle className="w-5 h-5" />
                   </button>
                </div>

                <div className="space-y-4">
                   <div className="p-6 bg-white/5 border border-white/5 rounded-[2rem] hover:border-blue-500/30 transition-all group cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                         <h4 className="font-bold text-white text-lg">Optimalizace PMax kampaní</h4>
                         <span className="text-[10px] font-black text-blue-400 uppercase">Google Ads</span>
                      </div>
                      <p className="text-slate-400 text-sm leading-relaxed mb-4">Aktuální struktura skupin podkladů vykazuje nízké CTR u video složky. Navrhuji revizi kreativy.</p>
                      <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase">
                         <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Due: Mon</span>
                         <span className="flex items-center gap-1"><User className="w-3 h-3" /> Pavel K.</span>
                      </div>
                   </div>
                   <div className="p-6 bg-white/5 border border-white/5 rounded-[2rem] opacity-60">
                      <h4 className="font-bold text-white text-lg">Revize SEO metadat</h4>
                      <p className="text-slate-400 text-sm">Priorita: Nízká</p>
                   </div>
                </div>
              </div>

              {/* AI SUGGESTIONS ENGINE */}
              <div className="bg-indigo-600 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col">
                <div className="relative z-10 flex-1">
                  <div className="flex items-center gap-3 mb-8">
                     <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                        <Sparkles className="w-5 h-5 text-white" />
                     </div>
                     <h4 className="text-2xl font-black">AI Suggestions</h4>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="bg-white/10 border border-white/20 p-6 rounded-[2rem] backdrop-blur-sm">
                       <p className="text-xs font-black uppercase tracking-widest text-indigo-200 mb-3">Opportunitity detected</p>
                       <p className="text-sm font-medium leading-relaxed mb-6">"Lookalike publikum z mailingové databáze (85% setup) by mohlo zvýšit konverze na Facebooku o 15-20%."</p>
                       <div className="flex gap-3">
                          <button className="flex-1 py-3 bg-white text-indigo-600 rounded-xl font-black text-xs hover:shadow-lg transition-all">Approve & Send</button>
                          <button className="px-4 py-3 bg-indigo-500/30 border border-white/10 rounded-xl text-white hover:bg-indigo-500/50 transition-all"><Settings className="w-4 h-4" /></button>
                       </div>
                    </div>

                    <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
                       <p className="text-xs font-black uppercase tracking-widest text-indigo-300 mb-2">Portfolio Insight</p>
                       <p className="text-xs italic opacity-60">"SEO performance is lagging behind compared to GAds spend. Shift 5% budget to SEO content?"</p>
                    </div>
                  </div>
                </div>
                
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/5 rounded-full blur-[100px]"></div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // --- CLIENT SETUP VIEW ---
  return (
    <div className="min-h-screen bg-slate-50/30 text-slate-900 font-sans pb-24 selection:bg-blue-100">
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-40 h-24 flex items-center">
        <div className="max-w-6xl mx-auto px-10 w-full flex items-center justify-between">
          <button onClick={() => setStage('intro')} className="flex items-center gap-4 font-black text-2xl tracking-tighter text-slate-900">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">M</div>
            MarketingPortal
          </button>
          <div className="text-xs font-black text-blue-600 bg-blue-50 border border-blue-100 px-6 py-2.5 rounded-full flex items-center gap-2">
            <Activity className="w-4 h-4 animate-pulse" /> Konfigurace Ekosystému
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-8 mt-20 animate-fadeIn">
        <div className="text-center mb-20">
          <h2 className="text-5xl font-black text-slate-900 mb-6 tracking-tight">Propojení kanálů</h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium">
            Pro Gmail uživatele doporučujeme sdílet přímo z hlavní obrazovky (<kbd className="bg-white px-2 py-1 rounded border shadow-sm text-xs font-bold">{os === 'mac' ? 'Green Dot 🟢' : 'Win + ←'}</kbd>).
          </p>
        </div>

        {/* MANUAL SECTION */}
        <ManualSection />

        <div className="space-y-6 mb-24">
          {instructions.map((item) => (
            <div key={item.id} className={`bg-white rounded-[2.5rem] border transition-all duration-500 overflow-hidden ${openCard === item.id ? 'border-blue-500 shadow-2xl' : 'border-slate-200/60 hover:border-blue-300'}`}>
              <div className="p-1 border-b border-slate-50 flex">
                <button onClick={() => setSetupState(prev => ({...prev, [item.id]: 'have'}))} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-t-2xl transition-all ${setupState[item.id] !== 'need' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>Již mám</button>
                <button onClick={() => setSetupState(prev => ({...prev, [item.id]: 'need'}))} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-t-2xl transition-all ${setupState[item.id] === 'need' ? 'bg-orange-50 text-orange-600' : 'text-slate-400'}`}>Založit</button>
              </div>
              <button onClick={() => { setOpenCard(openCard === item.id ? null : item.id) }} className="w-full flex items-center justify-between p-8 text-left group">
                <div className="flex items-center gap-8">
                  <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-300 ${openCard === item.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-slate-50 text-slate-400'}`}>{item.icon}</div>
                  <span className={`text-2xl font-black block tracking-tight ${openCard === item.id ? 'text-blue-600' : 'text-slate-900'}`}>{item.title}</span>
                </div>
                <div className={`w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center transition-all ${openCard === item.id ? 'rotate-180 bg-blue-50 text-blue-600' : 'text-slate-300'}`}>
                  <ChevronDown className="w-5 h-5" />
                </div>
              </button>
              {openCard === item.id && (
                <div className="px-10 pb-12 pl-[7rem] animate-fadeIn">
                   <div className="flex items-center gap-4 mb-8">
                     {item.directLink && (
                       <a 
                         href={item.directLink} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="inline-flex items-center gap-3 px-6 py-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-600 font-bold text-sm hover:bg-blue-100 transition-all"
                       >
                         <ExternalLink className="w-4 h-4" />
                         Přejít na nastavení {item.title}
                       </a>
                     )}
                   </div>
                   <ol className="space-y-8">
                    {item.steps.map((step, idx) => (
                      <li key={idx} className="flex gap-8 items-start group/step">
                        <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center text-lg font-black border transition-colors group-hover/step:bg-blue-600 group-hover/step:text-white group-hover/step:border-blue-600">{idx+1}</div>
                        <div className="pt-2 text-slate-600 font-medium text-lg leading-relaxed">
                          {step.includes(SHARED_EMAIL) ? <div className="flex flex-wrap items-center gap-3">{step.split(SHARED_EMAIL)[0]} <CopyBadge text={SHARED_EMAIL} /> {step.split(SHARED_EMAIL)[1]}</div> : step}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-slate-900 rounded-[4rem] p-16 text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20 transition-all group-hover:opacity-40"></div>
          <h3 className="text-4xl font-black mb-10 tracking-tight text-center">Finalizovat přístup</h3>
          <div className="space-y-8 relative z-10 max-w-2xl mx-auto">
             <button className="w-full bg-blue-600 py-7 rounded-[2rem] text-2xl font-black flex items-center justify-center gap-5 hover:bg-blue-500 transition-all shadow-xl active:scale-[0.98]">
               Odeslat k zahájení spolupráce <ArrowRight className="w-8 h-8" />
             </button>
          </div>
        </div>
      </main>
    </div>
  );
}