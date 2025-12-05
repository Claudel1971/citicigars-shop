import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCart } from '@/context/CartContext';
import { generateWhatsAppLink } from '@/utils/whatsappGenerator';
import { formatPrice } from '@/utils/priceCalculator';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import Button from '../shared/Button';
import { MessageCircle, ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';

const formSchema = z.object({
  nom: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  telephone: z.string().min(10, "Numéro de téléphone invalide"),
  ville: z.string().min(2, "La ville est requise"),
  notes: z.string().optional(),
  cgv: z.boolean().refine(val => val === true, "Vous devez accepter les CGV"),
});

const CheckoutForm = () => {
  const { items, total, clearCart } = useCart();
  const [, setLocation] = useLocation();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nom: "",
      telephone: "",
      ville: "",
      notes: "",
      cgv: false
    }
  });

  const onSubmit = (data) => {
    const link = generateWhatsAppLink(items, total, data);
    window.open(link, '_blank');
    clearCart();
    setLocation('/'); // Redirect home after checkout
  };

  if (items.length === 0) {
    return (
      <div className="container py-20 text-center">
        <h2 className="text-2xl font-serif mb-4">Votre panier est vide</h2>
        <Button onClick={() => setLocation('/catalogue')}>Retour au catalogue</Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-12 px-4">
      <Button variant="ghost" onClick={() => setLocation('/catalogue')} className="mb-8 gap-2">
        <ArrowLeft size={16} /> Continuer les achats
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          <h2 className="text-3xl font-serif font-bold text-primary mb-6">Finaliser la commande</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="nom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom Complet</FormLabel>
                    <FormControl>
                      <Input placeholder="Jean Dupont" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="telephone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone (WhatsApp)</FormLabel>
                    <FormControl>
                      <Input placeholder="+225 XX XX XX XX XX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ville"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ville / Quartier</FormLabel>
                    <FormControl>
                      <Input placeholder="Abidjan, Cocody..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes spéciales (Optionnel)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Code porte, instructions de livraison..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cgv"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        J'accepte les conditions générales de vente
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
                {form.formState.errors.cgv && <p className="text-destructive text-sm">{form.formState.errors.cgv.message}</p>}

              <Button type="submit" size="lg" className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white gap-2">
                <MessageCircle /> Commander via WhatsApp
              </Button>
            </form>
          </Form>
        </div>

        <div className="bg-muted/20 p-8 rounded-lg h-fit border border-border">
          <h3 className="text-xl font-serif font-bold mb-6 border-b pb-4">Récapitulatif</h3>
          <div className="space-y-4 mb-6">
            {items.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.quantite}x {item.marque} {item.modele} ({item.format})</span>
                <span className="font-mono font-medium">{formatPrice(item.prixTotal)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xl font-bold border-t pt-4">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            * Le paiement et la livraison seront arrangés directement via WhatsApp avec notre service commercial.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CheckoutForm;
