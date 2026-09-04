import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  Search, 
  Users, 
  Package, 
  Truck, 
  ShieldCheck, 
  Gavel, 
  AlertTriangle,
  Lock,
  Database,
  Menu,
  X
} from 'lucide-react';
import { cn } from './ui/bespoke';

const NAV_ITEMS = [
  { href: '/', label: "Aujourd'hui", icon: LayoutDashboard },
  { href: '/recherche', label: 'Recherche Globale', icon: Search },
  { href: '/clients', label: 'Clients 360', icon: Users },
  { href: '/stock', label: 'Stock Central', icon: Package },
  { href: '/fournisseurs', label: 'Fournisseurs', icon: Truck },
  { href: '/approbations', label: 'Approbations', icon: ShieldCheck },
  { href: '/gouvernance', label: 'Gouvernance', icon: Gavel },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background w-full">
      {/* Noise Texture */}
      <div className="noise-overlay" />

      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-sidebar border-r border-sidebar-border flex-shrink-0 flex flex-col z-10">
        <div className="p-4 md:p-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center border border-primary/50 shadow-sm">
              <span className="font-serif text-primary-foreground font-bold text-lg leading-none">C</span>
            </div>
            <div>
              <h1 className="font-serif text-sidebar-foreground font-medium tracking-tight leading-tight">CitiCigars</h1>
              <p className="text-[10px] font-mono uppercase tracking-widest text-sidebar-foreground/50">Poste de Commandement</p>
            </div>
          </div>
          <button
            type="button"
            className="md:hidden p-2 border border-sidebar-border text-sidebar-foreground"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Fermer la navigation' : 'Ouvrir la navigation'}
            data-testid="button-navigation-mobile"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        
        <nav className={cn("flex-1 px-3 pb-4 md:py-4 space-y-1", mobileMenuOpen ? "block" : "hidden md:block")}>
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm transition-all relative group",
                  isActive 
                    ? "text-primary-foreground bg-sidebar-accent border border-sidebar-border/50" 
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 border border-transparent"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />
                )}
                <item.icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground")} />
                <span className="font-medium tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={cn("p-4 border-t border-sidebar-border/50 mt-auto", mobileMenuOpen ? "block" : "hidden md:block")}>
          <div className="flex items-center gap-3 p-3 bg-black/20 border border-sidebar-border rounded-sm">
            <Lock className="w-4 h-4 text-warning" />
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-sidebar-foreground/60 uppercase tracking-widest">Opérateur</span>
              <span className="text-xs text-sidebar-foreground font-medium">Owner (Lecture seule)</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-y-auto relative z-10">
        
        {/* Global Warning Banner */}
        <header className="sticky top-0 z-20 w-full bg-warning/10 border-b border-warning/20 backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 py-2.5">
            <div className="flex items-center gap-2 text-warning font-medium text-xs">
              <AlertTriangle className="w-4 h-4" />
              <span className="uppercase tracking-wider font-mono">Environnement R1 (bac à sable) — Données de démonstration</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-mono uppercase tracking-widest">
                <Database className="w-3.5 h-3.5" />
                Sources simulées
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
