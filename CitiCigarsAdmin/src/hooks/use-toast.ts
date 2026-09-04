import { useState, useEffect } from 'react';

export type ToastProps = {
  id?: string;
  title?: string;
  description?: React.ReactNode;
  variant?: 'default' | 'destructive';
};

let memoryState: ToastProps[] = [];
let listeners: Function[] = [];

export const toast = (props: Omit<ToastProps, 'id'>) => {
  const id = Math.random().toString(36).substr(2, 9);
  const newToast = { ...props, id };
  memoryState = [...memoryState, newToast];
  listeners.forEach((l) => l(memoryState));
  setTimeout(() => {
    memoryState = memoryState.filter((t) => t.id !== id);
    listeners.forEach((l) => l(memoryState));
  }, 4000);
};

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastProps[]>(memoryState);
  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setToasts);
    };
  }, []);
  return { toasts, toast };
};
