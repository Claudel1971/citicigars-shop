import React, { createContext, useContext, useState, useEffect } from 'react';

const ContentContext = createContext();

const defaultContent = {
  home: {
    heroSlides: [
      {
        title: "L'Art de la Dégustation",
        subtitle: "Découvrez notre sélection exclusive de cigares cubains et du nouveau monde.",
        ctaText: "Explorer le catalogue",
        ctaLink: "/catalogue"
      },
      {
        title: "Promotions Hivernales",
        subtitle: "Jusqu'à -20% sur une sélection de coffrets prestige.",
        ctaText: "Voir les offres",
        ctaLink: "/promotions"
      },
      {
        title: "Nouveaux Arrivages",
        subtitle: "Les dernières pépites d'Arturo Fuente et Padron.",
        ctaText: "Découvrir",
        ctaLink: "/catalogue"
      }
    ],
    brandStory: {
      icon: "⚜",
      title: "L'Excellence sans Compromis",
      text: "Citi Cigars est né d'une passion pour les terroirs d'exception. Nous parcourons le monde pour sélectionner les vitoles qui racontent une histoire, celle du temps, de la patience et du savoir-faire.",
      ctaText: "Notre Histoire",
      ctaLink: "/about"
    }
  },
  footer: {
    tagline: "L'excellence du cigare livrée chez vous. Une sélection rigoureuse des meilleurs terroirs pour les amateurs exigeants.",
    legalNotice: "L'abus de tabac est dangereux pour la santé."
  }
};

export function ContentProvider({ children }) {
  const [content, setContent] = useState(defaultContent);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const res = await fetch('/api/content');
        if (res.ok) {
          const data = await res.json();
          setContent(data);
        }
      } catch (err) {
        console.warn('Using default content (API unavailable)');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, []);

  return (
    <ContentContext.Provider value={{ content, loading }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  const ctx = useContext(ContentContext);
  if (!ctx) {
    return { content: defaultContent, loading: false };
  }
  return ctx;
}

export default ContentContext;
