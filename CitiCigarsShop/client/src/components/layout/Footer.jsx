import React from 'react';
import { Facebook, Instagram, Twitter } from 'lucide-react';
import { useContent } from '@/context/ContentContext';

const Footer = () => {
  const { content } = useContent();
  const footerContent = content?.footer || {};

  return (
    <footer className="bg-primary text-primary-foreground pt-16 pb-8">
      <div className="container px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="space-y-4">
            <h3 className="font-serif text-2xl font-bold text-secondary">Citi Cigars</h3>
            <p className="text-primary-foreground/80 text-sm leading-relaxed">
              {footerContent.tagline || "L'excellence du cigare livrée chez vous. Une sélection rigoureuse des meilleurs terroirs pour les amateurs exigeants."}
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-secondary uppercase tracking-wider text-sm">Navigation</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/80">
              <li><a href="/" className="hover:text-white transition-colors">Accueil</a></li>
              <li><a href="/catalogue" className="hover:text-white transition-colors">Catalogue</a></li>
              <li><a href="/promotions" className="hover:text-white transition-colors">Promotions</a></li>
              <li><a href="/blog" className="hover:text-white transition-colors">Le Blog</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-secondary uppercase tracking-wider text-sm">Légal</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/80">
              <li><a href="/cgv" className="hover:text-white transition-colors">Conditions Générales</a></li>
              <li><a href="/privacy" className="hover:text-white transition-colors">Politique de Confidentialité</a></li>
              <li><a href="/mentions" className="hover:text-white transition-colors">Mentions Légales</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-secondary uppercase tracking-wider text-sm">Suivez-nous</h4>
            <div className="flex gap-4">
              <a href="#" className="p-2 bg-primary-foreground/10 rounded-full hover:bg-secondary hover:text-primary transition-colors">
                <Instagram size={20} />
              </a>
              <a href="#" className="p-2 bg-primary-foreground/10 rounded-full hover:bg-secondary hover:text-primary transition-colors">
                <Facebook size={20} />
              </a>
              <a href="#" className="p-2 bg-primary-foreground/10 rounded-full hover:bg-secondary hover:text-primary transition-colors">
                <Twitter size={20} />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-primary-foreground/60">
          <p>&copy; {new Date().getFullYear()} Citi Cigars. Tous droits réservés. {footerContent.legalNotice || "L'abus de tabac est dangereux pour la santé."}</p>
          <a href="/admin" className="hover:text-secondary transition-colors opacity-50 hover:opacity-100">Administration</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
