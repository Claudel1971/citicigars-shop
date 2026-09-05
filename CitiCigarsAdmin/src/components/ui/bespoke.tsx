import { ReactNode } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('bg-card border border-border text-card-foreground', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col space-y-1.5 p-4 border-b border-border/50 bg-muted/20', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('font-serif text-lg font-medium leading-none tracking-tight text-foreground', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-4', className)} {...props}>
      {children}
    </div>
  );
}

export function Badge({ className, variant = 'default', children, ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default'|'secondary'|'destructive'|'warning'|'success'|'outline'|'ghost' }) {
  const variants = {
    default: 'bg-primary text-primary-foreground border-transparent',
    secondary: 'bg-secondary text-secondary-foreground border-transparent',
    destructive: 'bg-destructive text-destructive-foreground border-transparent',
    warning: 'bg-warning text-warning-foreground border-transparent',
    success: 'bg-success text-success-foreground border-transparent',
    outline: 'text-foreground border-border',
    ghost: 'bg-muted text-muted-foreground border-transparent',
  };
  
  return (
    <span 
      className={cn(
        'inline-flex items-center border px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function DataLabel({ label, value, className, mono = false }: { label: ReactNode, value: ReactNode, className?: string, mono?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{label}</span>
      <span className={cn("text-sm font-medium", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

export function Table({ className, children, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b border-border bg-muted/30", className)} {...props}>{children}</thead>;
}

export function TableBody({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props}>{children}</tbody>;
}

export function TableRow({ className, children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("border-b border-border transition-colors hover:bg-muted/20 data-[state=selected]:bg-muted", className)}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ className, children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("h-10 px-4 text-left align-middle text-[11px] font-mono uppercase tracking-widest text-muted-foreground", className)}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props}>
      {children}
    </td>
  );
}

export function TabContainer({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex w-full overflow-x-auto no-scrollbar pb-1", className)} {...props}>
      <div className="flex space-x-2">{children}</div>
    </div>
  );
}

export function TabButton({ active, className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        "px-4 py-2 text-xs font-semibold uppercase tracking-widest font-mono rounded-md border transition-all whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active 
          ? "border-primary bg-primary text-primary-foreground shadow-sm" 
          : "border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border/80",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
