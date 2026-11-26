export const content = {
  featured: ['CTGNI0032', 'CTGNI0017', 'CTGRD0004', 'CTGBDL001'],
  hero: {
    image: 'photos/salon-accueil.webp',
    alt: 'Salon aux boiseries sombres, fauteuils en cuir et lumière ambrée',
  },
  giftPresentation: {
    closed: { image: 'photos/coffret-cuivre-ferme.webp', alt: 'Écrin cuivré CitiCigars fermé par un ruban clair' },
    open: { image: 'photos/coffret-cuivre-ouvert.webp', alt: 'Écrin cuivré ouvert, avec le logo CitiCigars et son papier de soie' },
  },
  businessDiscounts: [5, 10, 15],
  gifts: [
    {
      id: 'diamond',
      name: 'Diamond',
      price: 295000,
      volumeThresholds: [10, 20, 40],
      media: {
        photo: 'https://res.cloudinary.com/citicigars/image/upload/v1795627893/Coffret_DIAMOND_ktg05k.jpg',
        localPhoto: 'photos/coffret-diamond.webp',
        alt: 'Coffret Diamond avec cigares Plasencia Alma Fuerte et accessoires',
        video: 'https://res.cloudinary.com/citicigars/video/upload/v1795624274/coffret_DIAMOND_whatsapp_ya8lst.mp4',
      },
    },
    {
      id: 'gold',
      name: 'Gold',
      price: 175000,
      volumeThresholds: [15, 30, 50],
      media: {
        photo: 'https://res.cloudinary.com/citicigars/image/upload/v1795627893/Coffret_GOLD_uau2sk.jpg',
        localPhoto: 'photos/coffret-gold.webp',
        alt: 'Coffret Gold avec quatre cigares Horacio et accessoires',
        video: 'https://res.cloudinary.com/citicigars/video/upload/v1795624275/coffret_GOLD_whatsapp_ipggvd.mp4',
      },
    },
    {
      id: 'silver',
      name: 'Silver',
      price: 100000,
      volumeThresholds: [20, 40, 60],
      media: {
        photo: 'https://res.cloudinary.com/citicigars/image/upload/v1795627893/Coffret_SILVER_z9zkof.jpg',
        localPhoto: 'photos/coffret-silver.webp',
        alt: 'Coffret Silver avec humidor vitré et écrin bleu Triumph ouvert',
        video: 'https://res.cloudinary.com/citicigars/video/upload/v1795624276/coffret_SILVER_whatsapp_kj09xq.mp4',
      },
    },
    {
      id: 'trilogy',
      name: 'Trilogy',
      price: 50000,
      volumeThresholds: [25, 50, 100],
      media: {
        photo: 'https://res.cloudinary.com/citicigars/image/upload/v1795627893/Coffret_TRILOGY_axjxgs.jpg',
        localPhoto: 'photos/coffret-trilogy.webp',
        alt: 'Écrin bleu Casa Carrillo Triumph ouvert, avec ses trois cigares',
        video: 'https://res.cloudinary.com/citicigars/video/upload/v1795624276/coffret_TRILOGY_whatsapp_kkyl7b.mp4',
      },
    },
  ],
  occasions: {
    coffrets: {
      label: 'Coffrets cadeaux',
      title: 'L’art d’offrir.',
      intro: 'Quatre catégories de coffrets à offrir. Les photos présentent les compositions du moment, qui peuvent évoluer d’une année à l’autre.',
    },
    entreprises: {
      label: 'Entreprises',
      title: 'Commander en volume.',
      intro: 'Choisissez un coffret et une quantité pour estimer votre budget après remise.',
    },
    evenements: {
      label: 'Événements',
      title: 'Un moment à partager.',
      intro: 'Une réception privée, une célébration ou une rencontre entre amateurs. Décrivez le cadre que vous imaginez.',
      details: [
        ['Le lieu', 'Indiquez la ville et le lieu envisagés.'],
        ['Le moment', 'Précisez la date et le nombre d’invités.'],
        ['Le format', 'Partagez vos attentes et le rôle que pourrait jouer CitiCigars.'],
      ],
      missing: 'Photo d’événement CitiCigars à venir.',
      action: 'Décrire mon événement',
    },
  },
};
