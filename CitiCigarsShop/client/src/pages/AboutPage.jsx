import React from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CartDrawer from '@/components/cart/CartDrawer';
import { useContent } from '@/context/ContentContext';

const AboutPage = () => {
  const { content } = useContent();
  const aboutData = content?.pages?.about || {};
  const brandStory = content?.home?.brandStory || {};

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="bg-primary text-primary-foreground py-16">
          <div className="container mx-auto px-4 text-center">
            <span className="text-secondary text-5xl font-serif block mb-4">{brandStory.icon || '⚜'}</span>
            <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">
              {aboutData.title || "Notre Histoire"}
            </h1>
          </div>
        </section>

        <section className="py-16 bg-background">
          <div className="container max-w-4xl mx-auto px-4">
            <div className="bg-card rounded-lg shadow-lg p-8 md:p-12">
              <div className="prose prose-lg max-w-none">
                {aboutData.content ? (
                  <div className="text-muted-foreground leading-relaxed whitespace-pre-line">
                    {aboutData.content}
                  </div>
                ) : (
                  <div className="space-y-6 text-muted-foreground">
                    <p className="text-lg leading-relaxed">
                      {brandStory.text || "Citi Cigars est né d'une passion pour les terroirs d'exception. Nous parcourons le monde pour sélectionner les vitoles qui racontent une histoire, celle du temps, de la patience et du savoir-faire."}
                    </p>
                    <p className="text-lg leading-relaxed">
                      Notre mission est de vous offrir les meilleurs cigares du monde, soigneusement sélectionnés parmi les plus prestigieuses manufactures de Cuba, du Nicaragua, de la République Dominicaine et du Honduras.
                    </p>
                    <p className="text-lg leading-relaxed">
                      Chaque cigare que nous proposons a été choisi pour sa qualité exceptionnelle, son caractère unique et son histoire. Nous travaillons directement avec les producteurs pour vous garantir authenticité et fraîcheur.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-12 pt-8 border-t border-border">
                <h3 className="text-xl font-serif font-bold text-foreground mb-4">Nos Valeurs</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <span className="text-3xl mb-2 block">🌿</span>
                    <h4 className="font-semibold text-foreground mb-2">Authenticité</h4>
                    <p className="text-sm text-muted-foreground">Des cigares 100% authentiques, directement des meilleures manufactures.</p>
                  </div>
                  <div className="text-center">
                    <span className="text-3xl mb-2 block">⭐</span>
                    <h4 className="font-semibold text-foreground mb-2">Excellence</h4>
                    <p className="text-sm text-muted-foreground">Une sélection rigoureuse des meilleures vitoles du monde.</p>
                  </div>
                  <div className="text-center">
                    <span className="text-3xl mb-2 block">🤝</span>
                    <h4 className="font-semibold text-foreground mb-2">Service</h4>
                    <p className="text-sm text-muted-foreground">Un accompagnement personnalisé pour chaque amateur.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
};

export default AboutPage;
