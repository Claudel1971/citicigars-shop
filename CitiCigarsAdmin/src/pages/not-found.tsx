import { Layout } from '@/components/layout';
import { ShieldAlert } from 'lucide-react';

export default function NotFound() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <ShieldAlert className="w-16 h-16 text-muted-foreground/30" />
        <h1 className="text-4xl font-serif text-primary">404</h1>
        <p className="text-muted-foreground text-sm uppercase tracking-widest font-mono">Signal Perdu - Page Introuvable</p>
      </div>
    </Layout>
  );
}
