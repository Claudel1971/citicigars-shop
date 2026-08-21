import React, { useState } from 'react';
import { LayoutDashboard, Package, Upload, Image as ImageIcon, Percent, Settings, LogOut, X, Link2, DollarSign, Flame, FileText, Edit3, Users, MessageSquare, Bell, Table, ChevronDown, ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';

const AdminSidebar = ({ className, onNavigate, onClose }) => {
  const [location] = useLocation();

  const crmSubLinks = [
    { path: '/admin/crm', icon: Users, label: 'Clients' },
    { path: '/admin/crm-transactions', icon: Table, label: 'Explorateur de transactions' },
    { path: '/admin/crm-whatsapp', icon: MessageSquare, label: 'Analyse WhatsApp' },
    { path: '/admin/crm-followups', icon: Bell, label: 'Relances' },
  ];

  const [crmOpen, setCrmOpen] = useState(crmSubLinks.some((l) => location.startsWith(l.path)));

  const links = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/products', icon: Package, label: 'Prix_Produits' },
    { path: '/admin/import', icon: Upload, label: 'Import Excel' },
    { path: '/admin/prices', icon: DollarSign, label: 'Maj Prix (Excel)' },
    { path: '/admin/puissance', icon: Flame, label: 'Maj Puissance' },
    { path: '/admin/characteristics', icon: Edit3, label: 'Produits' },
    { path: '/admin/images', icon: ImageIcon, label: 'Images' },
    { path: '/admin/associations', icon: Link2, label: 'Associations' },
    { path: '/admin/promotions', icon: Percent, label: 'Promotions' },
    { path: '/admin/content', icon: FileText, label: 'Contenu (CMS)' },
    { path: '/admin/fiches', icon: FileText, label: 'Fiches Techniques' },
    { path: '/admin/config', icon: Settings, label: 'Configuration' },
  ];

  // Helper to check if path is active (handling sub-routes if needed)
  // Note: wouter's useLocation returns the full path relative to the router base.
  // Since we are not using a nested router yet, it returns full path.
  // If we switch to nested router, we need to adjust these paths.
  
  // For now, let's make it work with absolute paths as they are
  const isActive = (path) => {
      if (path === '/admin' && location === '/admin') return true;
      if (path !== '/admin' && location.startsWith(path)) return true;
      return false;
  };

  return (
    <div className={cn("w-64 bg-primary text-primary-foreground min-h-screen p-4 flex flex-col", className)}>
      <div className="mb-8 px-2 flex justify-between items-center">
        <h2 className="text-xl font-bold font-serif text-secondary">Citi Admin</h2>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-primary-foreground/80 hover:text-white">
            <X size={24} />
          </button>
        )}
      </div>

      <nav className="space-y-1 flex-1">
        <button
          onClick={() => setCrmOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-md transition-colors text-sm font-medium text-primary-foreground/80 hover:bg-white/10"
        >
          <span className="flex items-center gap-3">
            <Users size={18} />
            CRM
          </span>
          {crmOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {crmOpen && (
          <div className="ml-4 space-y-1 border-l border-white/10 pl-2">
            {crmSubLinks.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm cursor-pointer",
                  isActive(link.path)
                    ? "bg-secondary text-primary font-bold"
                    : "hover:bg-white/10 text-primary-foreground/70"
                )}
                onClick={onNavigate}
              >
                <link.icon size={16} />
                {link.label}
              </Link>
            ))}
          </div>
        )}

        {links.map(link => (
          <Link key={link.path} href={link.path} className={cn(
               "flex items-center gap-3 px-4 py-3 rounded-md transition-colors text-sm font-medium cursor-pointer",
               isActive(link.path) 
                 ? "bg-secondary text-primary font-bold" 
                 : "hover:bg-white/10 text-primary-foreground/80"
             )}
             onClick={onNavigate}
          >
               <link.icon size={18} />
               {link.label}
          </Link>
        ))}
      </nav>

      <button 
        className="flex items-center gap-3 px-4 py-3 text-destructive-foreground hover:bg-destructive/20 rounded-md transition-colors mt-auto"
        onClick={() => {
          sessionStorage.removeItem('cms_token');
          window.location.href = '/';
        }}
      >
        <LogOut size={18} />
        Déconnexion
      </button>
    </div>
  );
};

export default AdminSidebar;
