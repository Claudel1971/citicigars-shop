import React from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CartDrawer from '@/components/cart/CartDrawer';
import { useContent } from '@/context/ContentContext';
import { Loader2 } from 'lucide-react';

const LegalPage = ({ pageKey }) => {
  const { content, loading } = useContent();
  
  const pageData = content?.legal?.[pageKey] || {};
  const title = pageData.title || 'Page légale';
  const contentText = pageData.content || '';

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
        <CartDrawer />
      </div>
    );
  }

  const formatContent = (text) => {
    if (!text) return null;
    
    const paragraphs = text.split('\n\n');
    
    return paragraphs.map((paragraph, idx) => {
      const lines = paragraph.split('\n');
      
      return (
        <div key={idx} className="mb-6">
          {lines.map((line, lineIdx) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return null;
            
            if (/^\d+\.\s/.test(trimmedLine) && !trimmedLine.includes('\n')) {
              const isMainSection = /^\d+\.\s[A-Z]/.test(trimmedLine);
              if (isMainSection) {
                return (
                  <h2 key={lineIdx} className="text-xl font-serif font-bold text-primary mt-8 mb-4">
                    {trimmedLine}
                  </h2>
                );
              }
            }
            
            if (/^\d+\.\d+\./.test(trimmedLine)) {
              return (
                <h3 key={lineIdx} className="text-lg font-semibold text-gray-800 mt-4 mb-2">
                  {trimmedLine}
                </h3>
              );
            }
            
            if (trimmedLine.startsWith('•')) {
              return (
                <li key={lineIdx} className="ml-6 text-gray-700 leading-relaxed">
                  {trimmedLine.substring(1).trim()}
                </li>
              );
            }
            
            if (trimmedLine.toUpperCase() === trimmedLine && trimmedLine.length > 10 && !trimmedLine.includes('•')) {
              return (
                <h2 key={lineIdx} className="text-2xl font-serif font-bold text-primary mt-8 mb-4 border-b border-secondary/30 pb-2">
                  {trimmedLine}
                </h2>
              );
            }
            
            return (
              <p key={lineIdx} className="text-gray-700 leading-relaxed mb-2">
                {trimmedLine}
              </p>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-background">
        <div className="bg-primary py-16">
          <div className="container px-4 md:px-8">
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-white text-center">
              {title}
            </h1>
          </div>
        </div>

        <div className="container px-4 md:px-8 py-12">
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border p-8 md:p-12">
            {contentText ? (
              <div className="prose prose-lg max-w-none">
                {formatContent(contentText)}
              </div>
            ) : (
              <p className="text-center text-gray-500">
                Contenu non disponible. Veuillez configurer cette page depuis l'administration.
              </p>
            )}
          </div>

          <div className="max-w-4xl mx-auto mt-8 text-center">
            <a 
              href="/" 
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
            >
              ← Retour à l'accueil
            </a>
          </div>
        </div>
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
};

export const CGVPage = () => <LegalPage pageKey="cgv" />;
export const PrivacyPage = () => <LegalPage pageKey="privacy" />;
export const MentionsPage = () => <LegalPage pageKey="mentions" />;

export default LegalPage;
