import { useToast } from '@/hooks/use-toast';
import { Toast, ToastProvider, ToastViewport, ToastTitle, ToastDescription } from '@radix-ui/react-toast';

export function Toaster() {
  const { toasts } = useToast();
  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, variant, ...props }) {
        return (
          <Toast 
            key={id} 
            {...props} 
            className={`border p-4 shadow-lg mb-2 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-bottom-full ${variant === 'destructive' ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-card text-card-foreground border-border'}`}
          >
            <div className="grid gap-1">
              {title && <ToastTitle className="text-sm font-medium">{title}</ToastTitle>}
              {description && <ToastDescription className="text-sm opacity-90">{description}</ToastDescription>}
            </div>
          </Toast>
        );
      })}
      <ToastViewport className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]" />
    </ToastProvider>
  );
}
