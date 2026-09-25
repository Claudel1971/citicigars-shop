import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

import Home from '@/pages/home';
import Recherche from '@/pages/recherche';
import Clients from '@/pages/clients';
import Stock from '@/pages/stock';
import Fournisseurs from '@/pages/fournisseurs';
import Approbations from '@/pages/approbations';
import Gouvernance from '@/pages/gouvernance';
import NotFound from '@/pages/not-found';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAdminToken, login } from '@/lib/api';

const queryClient = new QueryClient();

function AuthGate({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(() => Boolean(getAdminToken()));
  const [password, setPassword] = useState('');
  const [persist, setPersist] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const expire = () => setAuthenticated(false);
    window.addEventListener('citicigars-auth-expired', expire);
    return () => window.removeEventListener('citicigars-auth-expired', expire);
  }, []);

  if (authenticated) return <>{children}</>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await login(password, persist);
      setAuthenticated(true);
      setPassword('');
    } catch (e) {
      setError(e instanceof Error && e.message === 'AUTH_REQUIRED' ? 'Authentification requise.' : 'Identifiants invalides ou service indisponible.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <form onSubmit={submit} className="w-full max-w-sm border border-border bg-card p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-serif">CitiCigars Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">Connexion au backend réel protégé par RBAC.</p>
        </div>
        <Input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe administrateur" required />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} />
          Conserver la session sur cet appareil
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full">Se connecter</Button>
      </form>
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/recherche" component={Recherche} />
        <Route path="/clients" component={Clients} />
        <Route path="/stock" component={Stock} />
        <Route path="/fournisseurs" component={Fournisseurs} />
        <Route path="/approbations" component={Approbations} />
        <Route path="/gouvernance" component={Gouvernance} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary key={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthGate>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
        </AuthGate>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
