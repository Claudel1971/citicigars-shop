import React, { useState, useEffect } from 'react';
import { Switch, Route, Router } from 'wouter';
import AdminSidebar from '@/components/admin/AdminSidebar';
import Dashboard from '@/components/admin/Dashboard';
import ImportExcel from '@/components/admin/ImportExcel';
import UpdatePricesExcel from '@/components/admin/UpdatePricesExcel';
import UpdatePuissanceExcel from '@/components/admin/UpdatePuissanceExcel';
import UploadImages from '@/components/admin/UploadImages';
import GestionAssociations from '@/components/admin/GestionAssociations';
import PackConfig from '@/components/admin/PackConfig';
import ProductManager from '@/components/admin/ProductManager';
import ContentManager from '@/components/admin/ContentManager';
import { Menu } from 'lucide-react';

const PromotionManager = () => <div className="p-8">Gestion des promotions (À venir)</div>;

const Admin = () => {
  // ... state remains same
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  
  const [menuOuvert, setMenuOuvert] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // ... effects remain same
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
          setMenuOuvert(false);
      } else {
          setMenuOuvert(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) return;

    let touchStartX = 0;
    let touchEndX = 0;

    const handleTouchStart = (e) => {
      touchStartX = e.changedTouches[0].screenX;
    };

    const handleTouchEnd = (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    };

    const handleSwipe = () => {
      if (touchStartX < 50 && touchEndX > touchStartX + 100) {
        setMenuOuvert(true);
      }
      if (menuOuvert && touchStartX > touchEndX + 100) {
        setMenuOuvert(false);
      }
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, menuOuvert]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/content/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          sessionStorage.setItem('cms_token', data.token);
          setIsAuthenticated(true);
        }
      } else {
        alert('Mot de passe incorrect');
      }
    } catch (err) {
      alert('Erreur de connexion');
    }
  };
  
  const handleMenuClick = () => {
      if (isMobile) {
          setMenuOuvert(false);
      }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-xl border max-w-sm w-full">
          <h1 className="text-2xl font-serif font-bold text-center mb-6 text-primary">Admin Login</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Mot de passe</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full border rounded p-2"
                placeholder="Entrez le mot de passe admin"
              />
            </div>
            <button type="submit" className="w-full bg-primary text-primary-foreground py-2 rounded font-bold hover:bg-primary/90">
              Connexion
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-muted/10 relative">
      {isMobile && menuOuvert && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 backdrop-blur-sm transition-opacity"
          onClick={() => setMenuOuvert(false)}
        />
      )}

      <AdminSidebar 
        className={`
            fixed md:relative z-40 h-full shadow-xl md:shadow-none
            transition-transform duration-300 ease-in-out
            ${menuOuvert ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            ${isMobile ? 'w-72' : 'w-64'}
        `}
        onNavigate={handleMenuClick}
        onClose={() => setMenuOuvert(false)}
      />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
          <div className="md:hidden p-4 bg-white border-b flex items-center justify-between shrink-0">
            <button
                onClick={() => setMenuOuvert(true)}
                className="p-2 hover:bg-gray-100 rounded-md text-gray-700"
            >
                <Menu size={24} />
            </button>
            <span className="font-serif font-bold text-primary">Citi Admin</span>
            <div className="w-8"></div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            {/* Use explicit matching for admin routes */}
            <Switch>
              <Route path="/admin" component={Dashboard} />
              <Route path="/admin/import" component={ImportExcel} />
              <Route path="/admin/prices" component={UpdatePricesExcel} />
              <Route path="/admin/puissance" component={UpdatePuissanceExcel} />
              <Route path="/admin/promotions" component={PromotionManager} />
              <Route path="/admin/images" component={UploadImages} />
              <Route path="/admin/associations" component={GestionAssociations} />
              <Route path="/admin/config" component={PackConfig} />
              <Route path="/admin/products" component={ProductManager} />
              <Route path="/admin/content" component={ContentManager} />
              
              {/* If we are here, it means we matched /admin/* in App.tsx but nothing specific above */}
              {/* This might be a sub-route not covered or just a trailing slash issue */}
              <Route component={Dashboard} /> 
            </Switch>
        </div>
      </div>
    </div>
  );
};

export default Admin;
