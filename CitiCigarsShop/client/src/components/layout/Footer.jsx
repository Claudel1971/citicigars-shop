import React, { useState, useEffect } from 'react';
import { Facebook, Instagram, Twitter } from 'lucide-react';
import { useContent } from '@/context/ContentContext';
import i18n from '@/i18n';

const Footer = () => {
  const [, setLang] = useState(i18n.language);
  const t = (key) => i18n.t(key);
  
  useEffect(() => {
    const handleLangChange = (lng) => setLang(lng);
    i18n.on('languageChanged', handleLangChange);
    return () => i18n.off('languageChanged', handleLangChange);
  }, []);
  
  const { content } = useContent();
  const footerContent = content?.footer || {};

  return (
    <footer className="bg-primary text-primary-foreground pt-16 pb-8">
      <div className="container px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="space-y-4">
            <h3 className="font-serif text-2xl font-bold text-secondary">CitiCigars</h3>
            <p className="text-primary-foreground/80 text-sm leading-relaxed">
              {t('footer.tagline')}
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-secondary uppercase tracking-wider text-sm">{t('footer.navigation')}</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/80">
              <li><a href="/" className="hover:text-white transition-colors">{t('nav.home')}</a></li>
              <li><a href="/catalogue" className="hover:text-white transition-colors">{t('catalogue.title')}</a></li>
              <li><a href="/promotions" className="hover:text-white transition-colors">{t('promotions.title')}</a></li>
              <li><a href="/about" className="hover:text-white transition-colors">{t('footer.about')}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-secondary uppercase tracking-wider text-sm">{t('footer.legal')}</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/80">
              <li><a href="/cgv" className="hover:text-white transition-colors">{t('footer.shipping')}</a></li>
              <li><a href="/privacy" className="hover:text-white transition-colors">{t('footer.returns')}</a></li>
              <li><a href="/mentions" className="hover:text-white transition-colors">{t('footer.legal')}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-secondary uppercase tracking-wider text-sm">{t('footer.followUs')}</h4>
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
          <p>&copy; {new Date().getFullYear()} CitiCigars. {t('footer.copyright')}. {t('footer.legalNotice')}</p>
          <a href="/admin" className="hover:text-secondary transition-colors opacity-50 hover:opacity-100">Administration</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
