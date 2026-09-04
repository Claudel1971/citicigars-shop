import { type ReactNode } from 'react';
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

const queryClient = new QueryClient();

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
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
