import React, { useEffect, useState } from 'react';
import { useProducts } from '@/context/ProductContext';
import { crmFetch } from './crm/crmApi';

const Dashboard = () => {
  const { products } = useProducts();

  // Top produits — nombre de commandes CRM distinctes par SKU, toutes
  // périodes (décision Claudel, 22 août 2026). Remplace l'ancien
  // products.slice(0,3) + "14 ventes" en dur, qui n'étaient reliés à
  // aucune donnée de vente réelle.
  const [topProducts, setTopProducts] = useState(null); // null = chargement
  const [topProductsError, setTopProductsError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    crmFetch('/api/crm/dashboard/top-products?limit=3')
      .then((res) => {
        if (!res.ok) throw new Error(`http_${res.status}`);
        return res.json();
      })
      .then((rows) => {
        if (!cancelled) setTopProducts(rows);
      })
      .catch(() => {
        if (!cancelled) setTopProductsError('Impossible de charger les ventes réelles.');
      });
    return () => { cancelled = true; };
  }, []);

  const stats = [
    { label: "Total Produits", value: products.length, color: "bg-blue-500" },
    { label: "En Promotion", value: products.filter(p => p.promotions?.unitaire?.actif).length, color: "bg-green-500" },
    { label: "Stock Faible", value: 12, color: "bg-orange-500" }, // Mock
    { label: "Vues (24h)", value: 145, color: "bg-purple-500" }, // Mock
  ];

  const verifierImages = () => {
    const avecImages = products.filter(p => 
      p.imagePrincipale || p.imageSolo || p.imagePack || p.imageBoite
    );
    
    console.log('📊 RAPPORT IMAGES:');
    console.log(`Total produits: ${products.length}`);
    console.log(`Avec images: ${avecImages.length}`);
    console.log('Détails:', avecImages.map(p => ({
      sku: p.sku,
      marque: p.marque,
      vitole: p.vitole,
      hasImages: {
        principale: !!p.imagePrincipale,
        solo: !!p.imageSolo,
        pack: !!p.imagePack,
        boite: !!p.imageBoite
      }
    })));
    
    alert(`${avecImages.length}/${products.length} produits ont des images\n\nVoir console pour détails`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-primary">Tableau de Bord</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-border">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-3xl font-bold mt-2">{stat.value}</p>
            <div className={`h-1 w-full mt-4 rounded-full ${stat.color} opacity-50`}></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-border">
          <h3 className="font-bold text-lg mb-4">Activité Récente</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm border-b pb-2">
              <span>Nouvelle commande #1234</span>
              <span className="text-muted-foreground">Il y a 2 min</span>
            </div>
            <div className="flex items-center justify-between text-sm border-b pb-2">
              <span>Import Excel (45 produits)</span>
              <span className="text-muted-foreground">Il y a 1h</span>
            </div>
             <div className="flex items-center justify-between text-sm border-b pb-2">
              <span>Mise à jour stock COH001</span>
              <span className="text-muted-foreground">Il y a 3h</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-border">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-lg">Top Produits</h3>
             <button onClick={verifierImages} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">
                🔍 Debug Images
             </button>
          </div>
          <div className="space-y-4">
             {topProductsError && (
               <p className="text-sm text-red-600">{topProductsError}</p>
             )}
             {!topProductsError && topProducts === null && (
               <p className="text-sm text-muted-foreground">Chargement…</p>
             )}
             {!topProductsError && topProducts !== null && topProducts.length === 0 && (
               <p className="text-sm text-muted-foreground">Aucune vente CRM enregistrée pour le moment.</p>
             )}
             {topProducts && topProducts.map((tp) => {
               // Image/nom depuis le catalogue si le SKU y figure encore ;
               // sinon on retombe sur le snapshot marque/série/vitole
               // enregistré sur la vente elle-même (le produit a pu être
               // retiré du catalogue depuis).
               const catalogMatch = products.find((p) => p.sku === tp.itemSku);
               const label = catalogMatch
                 ? `${catalogMatch.marque || ''} ${catalogMatch.modele || ''}`.trim()
                 : [tp.brand, tp.series, tp.vitole].filter(Boolean).join(' ') || tp.itemSku;
               return (
                 <div key={tp.itemSku} className="flex items-center gap-4">
                   <div className="h-10 w-10 bg-muted rounded overflow-hidden">
                      {catalogMatch?.imagePrincipale && <img src={catalogMatch.imagePrincipale} className="w-full h-full object-cover" alt="" />}
                   </div>
                   <div className="flex-1">
                     <p className="font-bold text-sm">{label}</p>
                     <p className="text-xs text-muted-foreground">{tp.itemSku}</p>
                   </div>
                   <span className="font-mono font-bold text-sm">{tp.orderCount} vente{tp.orderCount > 1 ? 's' : ''}</span>
                 </div>
               );
             })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
