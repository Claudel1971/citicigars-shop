import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocation } from 'wouter';
import { useContent } from '@/context/ContentContext';
import generatedImage from '@assets/generated_images/luxury_cigar_lounge_hero_background.webp';

const defaultImages = [
  generatedImage,
  "https://images.unsplash.com/photo-1533052967778-5932d302867f?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1625468823554-236b96759603?q=80&w=2070&auto=format&fit=crop"
];

export default function HeroCarousel() {
  const { content } = useContent();
  
  const slides = (content?.home?.heroSlides || []).map((slide, index) => ({
    ...slide,
    image: slide.imageUrl || defaultImages[index] || defaultImages[0]
  }));
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isAutoPlaying, slides.length]);

  const goToSlide = (index) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  if (!slides || slides.length === 0) return null;

  return (
    <div className="relative w-full h-[500px] md:h-[600px] overflow-hidden bg-black">
      {/* Slides */}
      <div className="relative h-full">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <div
              className="w-full h-full bg-cover bg-center relative"
              style={{
                backgroundImage: `url(${slide.image})`
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
              <div className="relative z-10 flex flex-col justify-center h-full text-white px-4 md:px-16 max-w-4xl container mx-auto">
                <h2 className="text-4xl md:text-6xl font-serif font-bold mb-6 drop-shadow-lg animate-in slide-in-from-left-10 duration-700">
                  {slide.title}
                </h2>
                <p className="text-lg md:text-xl mb-8 opacity-90 max-w-lg leading-relaxed drop-shadow-md font-light">
                  {slide.subtitle}
                </p>
                {slide.ctaText && (
                  <button
                    onClick={() => setLocation(slide.ctaLink)}
                    className="bg-secondary text-secondary-foreground w-fit px-8 py-3 rounded font-bold hover:bg-white hover:text-primary transition-all shadow-xl uppercase tracking-wider text-sm"
                  >
                    {slide.ctaText}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-secondary hover:text-primary text-white p-3 rounded-full transition-all backdrop-blur-sm border border-white/10 z-20"
      >
        <ChevronLeft size={24} />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-secondary hover:text-primary text-white p-3 rounded-full transition-all backdrop-blur-sm border border-white/10 z-20"
      >
        <ChevronRight size={24} />
      </button>

      {/* Dots Navigation */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-20">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentSlide
                ? 'bg-secondary w-8'
                : 'bg-white/50 hover:bg-white w-2'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
