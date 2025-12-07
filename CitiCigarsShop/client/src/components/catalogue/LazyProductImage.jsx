import React, { useState, useEffect, useRef } from "react";
import apiService from "@/services/apiService";
import generatedImage from "@assets/generated_images/single_premium_cigar.png";

const imageCache = new Map();

const LazyProductImage = ({ 
  sku, 
  format = "unitaire", 
  existingImages = null,
  alt = "",
  className = ""
}) => {
  const [images, setImages] = useState(existingImages);
  const [isLoading, setIsLoading] = useState(!existingImages);
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px", threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || images || !sku) return;

    const fetchImages = async () => {
      if (imageCache.has(sku)) {
        setImages(imageCache.get(sku));
        setIsLoading(false);
        return;
      }

      try {
        const imgData = await apiService.getProductImages(sku);
        if (imgData) {
          imageCache.set(sku, imgData);
          setImages(imgData);
        }
      } catch (err) {
        console.error(`Error loading images for ${sku}:`, err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchImages();
  }, [isVisible, sku, images]);

  const getImageForFormat = () => {
    if (!images) return generatedImage;
    
    switch (format) {
      case "pack":
        return images.imagePack || images.imagePack4 || images.imagePack5 || 
               images.imagePrincipale || images.imageSolo || generatedImage;
      case "boite":
        return images.imageBoite || images.imagePrincipale || generatedImage;
      case "bundle":
        return images.imageBundle || images.imagePrincipale || generatedImage;
      default:
        return images.imagePrincipale || images.imageSolo || 
               images.imagePack || images.imageBoite || generatedImage;
    }
  };

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {isLoading && isVisible && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <img
        src={getImageForFormat()}
        alt={alt}
        className={`w-full h-full object-contain transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
};

export default LazyProductImage;
