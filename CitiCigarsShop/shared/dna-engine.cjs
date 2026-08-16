// EXTRACTION MÉCANIQUE EXACTE — copié tel quel depuis
// CitiCigars_DNA_Curator_v2_10_3_RC.html, lignes 221-451 (bloc IIFE
// window.CitiCigarsDNAEngine), sans aucune retype manuelle.
// Extension `.cjs` volontaire (voir amendement 7) : ce repo a
// `"type":"module"` dans package.json (ESM natif) ; Node traite toujours
// un fichier `.cjs` comme CommonJS quel que soit ce réglage, donc
// `if(typeof module==='object'&&module.exports) module.exports=api;`
// fonctionne ici côté Node exactement comme il fonctionnait déjà côté
// navigateur (où `module` est simplement absent, et la ligne ne fait rien).
// Le HTML doit charger CE MÊME fichier via <script src="dna-engine.cjs">
// au lieu de l'avoir inline — une seule source, deux exécutions.
//
// AUCUNE MODIFICATION DE SCORING/selectDiverse/eligiblePool NI DU CATALOG
// N'A ÉTÉ FAITE lors de cette extraction. Le seul changement volontaire
// (paramètre liveAvailabilityByCigarId) est appliqué séparément juste après
// ce bloc, visible en diff isolé.

(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.CitiCigarsDNAEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const CATALOG=[{"cigarId":"CTG000001","sku":"CTGHO0001","brand":"Bolivar","line":"Cofradia N° 654","vitole":"Toro","format":"Toro","dimension":"6 x 54","power":4,"families":["Fauve","Boisé","Gourmand"],"intensity":4,"spice":4,"sweetness":1,"signatures":[],"durationMin":55,"durationMax":75,"confidence":"MODÉRÉE","stock":{"heldUnits":2.0,"ownedUnits":2.0,"depositUnits":0.0,"cigarsPerUnit":5.0,"heldCigars":10.0,"initialUnits":2.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":10.0,"siteStatus":"IN_STOCK","unitPrice":12000,"packPrice":60000,"boxPrice":300000},"sourceConfidenceRank":2,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000002","sku":"CTGNI0001","brand":"CAO","line":"Flathead Big","vitole":"V770 Gigante","format":"Giant","dimension":"7 x 70","power":3,"families":["Gourmand","Fauve","Boisé"],"intensity":4,"spice":3,"sweetness":3,"signatures":["Fruité"],"durationMin":90,"durationMax":120,"confidence":"MODÉRÉE","stock":{"heldUnits":0.0,"ownedUnits":0.0,"depositUnits":0.0,"cigarsPerUnit":24.0,"heldCigars":0.0,"initialUnits":1.0,"exitsUnits":1.0,"sellThrough":1.0,"alert":"RUPTURE","available":false},"commercial":{"clearancePriority":0.0,"siteStatus":"IN_STOCK","unitPrice":16000,"packPrice":64000,"boxPrice":384000},"sourceConfidenceRank":2,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000003","sku":"CTGNI0003","brand":"My Father","line":"Jaime Garcia RE","vitole":"Gordo","format":"Gordo","dimension":"6 x 60","power":4,"families":["Gourmand","Fauve","Boisé"],"intensity":4,"spice":3,"sweetness":2,"signatures":[],"durationMin":60,"durationMax":80,"confidence":"MODÉRÉE","stock":{"heldUnits":2.0,"ownedUnits":2.0,"depositUnits":0.0,"cigarsPerUnit":4.0,"heldCigars":8.0,"initialUnits":2.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":8.0,"siteStatus":"IN_STOCK","unitPrice":13000,"packPrice":52000,"boxPrice":260000},"sourceConfidenceRank":2,"arbitrage":"Source officielle de ligne.","allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000004","sku":"CTGNI0004","brand":"My Father","line":"Jaime Garcia RE","vitole":"Gigante (Gordo Extra)","format":"Giant","dimension":"7 x 70","power":4,"families":["Gourmand","Fauve","Boisé"],"intensity":4,"spice":3,"sweetness":2,"signatures":[],"durationMin":90,"durationMax":120,"confidence":"MODÉRÉE","stock":{"heldUnits":0.0,"ownedUnits":0.0,"depositUnits":0.0,"cigarsPerUnit":14.0,"heldCigars":0.0,"initialUnits":1.0,"exitsUnits":1.0,"sellThrough":1.0,"alert":"RUPTURE","available":false},"commercial":{"clearancePriority":0.0,"siteStatus":"SOLD_OUT","unitPrice":16000,"packPrice":64000,"boxPrice":224000},"sourceConfidenceRank":2,"arbitrage":"Source officielle de ligne.","allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000005","sku":"CTGNI0005","brand":"My Father","line":"Jaime Garcia RE","vitole":"Super Gordo","format":"Gordo","dimension":"5 3/4 x 66","power":4,"families":["Gourmand","Fauve","Boisé"],"intensity":4,"spice":3,"sweetness":2,"signatures":[],"durationMin":60,"durationMax":80,"confidence":"MODÉRÉE","stock":{"heldUnits":5.0,"ownedUnits":5.0,"depositUnits":0.0,"cigarsPerUnit":4.0,"heldCigars":20.0,"initialUnits":5.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":null,"available":true},"commercial":{"clearancePriority":20.0,"siteStatus":"IN_STOCK","unitPrice":15000,"packPrice":60000,"boxPrice":300000},"sourceConfidenceRank":2,"arbitrage":"Source officielle de ligne.","allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000006","sku":"CTGNI0006","brand":"My Father","line":"Jaime Garcia RE","vitole":"Toro","format":"Toro","dimension":"6 x 54","power":4,"families":["Gourmand","Fauve","Boisé"],"intensity":4,"spice":3,"sweetness":2,"signatures":[],"durationMin":55,"durationMax":75,"confidence":"MODÉRÉE","stock":{"heldUnits":1.0,"ownedUnits":1.0,"depositUnits":0.0,"cigarsPerUnit":5.0,"heldCigars":5.0,"initialUnits":1.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":5.0,"siteStatus":"IN_STOCK","unitPrice":12000,"packPrice":60000,"boxPrice":240000},"sourceConfidenceRank":2,"arbitrage":"Source officielle de ligne.","allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000007","sku":"CTGNI0007","brand":"La Aroma de Cuba","line":"Mi Amor","vitole":"Belicoso","format":"Belicoso","dimension":"5 1/2 x 54","power":4,"families":["Gourmand","Boisé","Velouté"],"intensity":4,"spice":3,"sweetness":3,"signatures":["Malté"],"durationMin":50,"durationMax":70,"confidence":"MODÉRÉE","stock":{"heldUnits":2.0,"ownedUnits":2.0,"depositUnits":0.0,"cigarsPerUnit":5.0,"heldCigars":10.0,"initialUnits":2.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":10.0,"siteStatus":"IN_STOCK","unitPrice":15000,"packPrice":75000,"boxPrice":375000},"sourceConfidenceRank":2,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000008","sku":"CTGNI0008","brand":"La Aroma de Cuba","line":"Monarch","vitole":"Toro","format":"Toro","dimension":"6 x 52","power":3,"families":["Fauve","Boisé","Gourmand"],"intensity":4,"spice":3,"sweetness":2,"signatures":[],"durationMin":55,"durationMax":70,"confidence":"MODÉRÉE","stock":{"heldUnits":0.0,"ownedUnits":0.0,"depositUnits":0.0,"cigarsPerUnit":5.0,"heldCigars":0.0,"initialUnits":0.0,"exitsUnits":0.0,"sellThrough":0,"alert":"RUPTURE","available":false},"commercial":{"clearancePriority":0.0,"siteStatus":"IN_STOCK","unitPrice":12000,"packPrice":60000,"boxPrice":300000},"sourceConfidenceRank":2,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000009","sku":"CTGNI0009","brand":"Montecristo","line":"Nicaragua","vitole":"Churchill","format":"Churchill","dimension":"7 x 56","power":4,"families":["Fauve","Gourmand","Boisé"],"intensity":4,"spice":4,"sweetness":2,"signatures":[],"durationMin":70,"durationMax":95,"confidence":"MODÉRÉE","stock":{"heldUnits":1.0,"ownedUnits":1.0,"depositUnits":0.0,"cigarsPerUnit":20.0,"heldCigars":20.0,"initialUnits":1.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":20.0,"siteStatus":"IN_STOCK","unitPrice":14000,"packPrice":56000,"boxPrice":280000},"sourceConfidenceRank":2,"arbitrage":"Profil de ligne; vitole à contre-vérifier.","allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000010","sku":"CTGNI0010","brand":"Montecristo","line":"1935 Anniversary Nicaragua","vitole":"N°2 Figurado","format":"Torpedo","dimension":"6 1/8 x 52","power":4,"families":["Fauve","Gourmand","Boisé"],"intensity":5,"spice":4,"sweetness":2,"signatures":["Malté"],"durationMin":55,"durationMax":70,"confidence":"HAUTE","stock":{"heldUnits":3.0,"ownedUnits":3.0,"depositUnits":0.0,"cigarsPerUnit":5.0,"heldCigars":15.0,"initialUnits":4.0,"exitsUnits":1.0,"sellThrough":0.25,"alert":null,"available":true},"commercial":{"clearancePriority":11.25,"siteStatus":"IN_STOCK","unitPrice":15000,"packPrice":75000,"boxPrice":300000},"sourceConfidenceRank":3,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000011","sku":"CTGNI0011","brand":"My Father","line":"Le Bijou 1922","vitole":"Grand  Robusto","format":"Robusto Gordo","dimension":"5 5/8 x 55","power":5,"families":["Gourmand","Fauve","Boisé"],"intensity":4,"spice":3,"sweetness":2,"signatures":[],"durationMin":50,"durationMax":70,"confidence":"MODÉRÉE","stock":{"heldUnits":1.0,"ownedUnits":1.0,"depositUnits":0.0,"cigarsPerUnit":23.0,"heldCigars":23.0,"initialUnits":1.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":23.0,"siteStatus":"IN_STOCK","unitPrice":15000,"packPrice":60000,"boxPrice":345000},"sourceConfidenceRank":2,"arbitrage":"Profil de ligne; exact à contre-vérifier.","allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000012","sku":"CTGNI0012","brand":"My Father","line":"Le Bijou 1922","vitole":"Torpedo","format":"Torpedo","dimension":"6 1/8 x 52","power":5,"families":["Gourmand","Fauve","Boisé"],"intensity":4,"spice":3,"sweetness":3,"signatures":["Fruité"],"durationMin":55,"durationMax":70,"confidence":"HAUTE","stock":{"heldUnits":1.0,"ownedUnits":1.0,"depositUnits":0.0,"cigarsPerUnit":23.0,"heldCigars":23.0,"initialUnits":1.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":23.0,"siteStatus":"IN_STOCK","unitPrice":16000,"packPrice":80000,"boxPrice":368000},"sourceConfidenceRank":3,"arbitrage":null,"allocation":{"curatorEligible":false,"status":"RESERVED_FOR_EVENTS","pool":"My Father event reserve","reason":"Le Bijou 1922 Torpedo réservé temporairement aux événements CitiCigars."}},{"cigarId":"CTG000013","sku":"CTGNI0013","brand":"My Father","line":"Le Bijou 1922","vitole":"Toro","format":"Toro","dimension":"6 x 52","power":5,"families":["Gourmand","Fauve","Boisé"],"intensity":4,"spice":3,"sweetness":3,"signatures":["Fruité"],"durationMin":55,"durationMax":70,"confidence":"HAUTE","stock":{"heldUnits":1.0,"ownedUnits":1.0,"depositUnits":0.0,"cigarsPerUnit":23.0,"heldCigars":23.0,"initialUnits":1.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":23.0,"siteStatus":"IN_STOCK","unitPrice":14750,"packPrice":73750,"boxPrice":339250},"sourceConfidenceRank":3,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000014","sku":"CTGNI0014","brand":"My Father","line":"Connecticut","vitole":"Toro Gordo","format":"Gordo","dimension":"6 x 60","power":3,"families":["Velouté","Boisé","Gourmand"],"intensity":2,"spice":2,"sweetness":2,"signatures":[],"durationMin":60,"durationMax":80,"confidence":"MODÉRÉE","stock":{"heldUnits":2.0,"ownedUnits":2.0,"depositUnits":0.0,"cigarsPerUnit":4.0,"heldCigars":8.0,"initialUnits":2.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":8.0,"siteStatus":"IN_STOCK","unitPrice":12500,"packPrice":50000,"boxPrice":250000},"sourceConfidenceRank":2,"arbitrage":"Source officielle de ligne.","allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000015","sku":"CTGNI0015","brand":"My Father","line":"Connecticut","vitole":"Toro","format":"Toro","dimension":"6 1/2 x 54","power":3,"families":["Velouté","Boisé","Gourmand"],"intensity":2,"spice":2,"sweetness":2,"signatures":[],"durationMin":60,"durationMax":80,"confidence":"MODÉRÉE","stock":{"heldUnits":0.0,"ownedUnits":1.0,"depositUnits":1.0,"cigarsPerUnit":5.0,"heldCigars":0.0,"initialUnits":1.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"RUPTURE","available":false},"commercial":{"clearancePriority":0.0,"siteStatus":"IN_STOCK","unitPrice":12000,"packPrice":60000,"boxPrice":240000},"sourceConfidenceRank":2,"arbitrage":"Source officielle de ligne.","allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000016","sku":"CTGNI0016","brand":"My Father","line":"Connecticut","vitole":"Robusto","format":"Robusto Gordo","dimension":"5 1/4 x 52","power":3,"families":["Velouté","Boisé","Gourmand"],"intensity":2,"spice":2,"sweetness":2,"signatures":[],"durationMin":45,"durationMax":60,"confidence":"MODÉRÉE","stock":{"heldUnits":0.0,"ownedUnits":0.0,"depositUnits":0.0,"cigarsPerUnit":5.0,"heldCigars":0.0,"initialUnits":0.0,"exitsUnits":0.0,"sellThrough":0,"alert":"RUPTURE","available":false},"commercial":{"clearancePriority":0.0,"siteStatus":"IN_STOCK","unitPrice":11000,"packPrice":55000,"boxPrice":220000},"sourceConfidenceRank":2,"arbitrage":"Source officielle de ligne.","allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000017","sku":"CTGNI0017","brand":"My Father","line":"The Judge","vitole":"Grand Robusto","format":"Robusto Grande","dimension":"5 x 60","power":5,"families":["Fauve","Boisé","Gourmand"],"intensity":4,"spice":3,"sweetness":2,"signatures":[],"durationMin":45,"durationMax":65,"confidence":"HAUTE","stock":{"heldUnits":1.0,"ownedUnits":1.0,"depositUnits":0.0,"cigarsPerUnit":23.0,"heldCigars":23.0,"initialUnits":1.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":23.0,"siteStatus":"IN_STOCK","unitPrice":16000,"packPrice":64000,"boxPrice":368000},"sourceConfidenceRank":3,"arbitrage":null,"allocation":{"curatorEligible":false,"status":"RESERVED_FOR_EVENTS","pool":"My Father event reserve","reason":"The Judge Grand Robusto réservé temporairement aux événements CitiCigars."}},{"cigarId":"CTG000018","sku":"CTGNI0018","brand":"My Father","line":"The Judge","vitole":"Toro Grande","format":"Toro","dimension":"6 x 56","power":5,"families":["Fauve","Boisé","Gourmand"],"intensity":4,"spice":3,"sweetness":2,"signatures":[],"durationMin":55,"durationMax":75,"confidence":"MODÉRÉE","stock":{"heldUnits":1.0,"ownedUnits":1.0,"depositUnits":0.0,"cigarsPerUnit":23.0,"heldCigars":23.0,"initialUnits":1.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":23.0,"siteStatus":"IN_STOCK","unitPrice":13000,"packPrice":52000,"boxPrice":299000},"sourceConfidenceRank":2,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000019","sku":"CTGNI0019","brand":"My Father","line":"The Judge","vitole":"Toro Fino","format":"Toro","dimension":"6 x 52","power":5,"families":["Fauve","Boisé","Gourmand"],"intensity":4,"spice":3,"sweetness":2,"signatures":[],"durationMin":55,"durationMax":70,"confidence":"MODÉRÉE","stock":{"heldUnits":0.0,"ownedUnits":0.0,"depositUnits":0.0,"cigarsPerUnit":4.0,"heldCigars":0.0,"initialUnits":0.0,"exitsUnits":0.0,"sellThrough":0,"alert":"RUPTURE","available":false},"commercial":{"clearancePriority":0.0,"siteStatus":"IN_STOCK","unitPrice":12000,"packPrice":60000,"boxPrice":276000},"sourceConfidenceRank":2,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000020","sku":"CTGNI0020","brand":"My Father","line":"Flor de Las Antillas","vitole":"Gordo (Toro Grande)","format":"Gordo","dimension":"6 x 60","power":3,"families":["Velouté","Gourmand","Boisé"],"intensity":3,"spice":3,"sweetness":2,"signatures":[],"durationMin":60,"durationMax":80,"confidence":"HAUTE","stock":{"heldUnits":1.0,"ownedUnits":1.0,"depositUnits":0.0,"cigarsPerUnit":20.0,"heldCigars":20.0,"initialUnits":1.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":20.0,"siteStatus":"IN_STOCK","unitPrice":12500,"packPrice":50000,"boxPrice":250000},"sourceConfidenceRank":3,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000021","sku":"CTGNI0021","brand":"Oliva","line":"Serie V","vitole":"Double Toro","format":"Toro","dimension":"6 x 60","power":4,"families":["Gourmand","Boisé","Fauve"],"intensity":5,"spice":4,"sweetness":2,"signatures":[],"durationMin":60,"durationMax":80,"confidence":"MODÉRÉE","stock":{"heldUnits":0.0,"ownedUnits":0.0,"depositUnits":0.0,"cigarsPerUnit":24.0,"heldCigars":0.0,"initialUnits":1.0,"exitsUnits":1.0,"sellThrough":1.0,"alert":"RUPTURE","available":false},"commercial":{"clearancePriority":0.0,"siteStatus":"IN_STOCK","unitPrice":12500,"packPrice":50000,"boxPrice":300000},"sourceConfidenceRank":2,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000022","sku":"CTGNI0022","brand":"Oliva","line":"Serie V Melanio","vitole":"Churchill","format":"Churchill","dimension":"7 x 50","power":4,"families":["Boisé","Gourmand","Velouté"],"intensity":4,"spice":2,"sweetness":2,"signatures":["Malté"],"durationMin":65,"durationMax":85,"confidence":"HAUTE","stock":{"heldUnits":0.0,"ownedUnits":0.0,"depositUnits":0.0,"cigarsPerUnit":10.0,"heldCigars":0.0,"initialUnits":1.0,"exitsUnits":1.0,"sellThrough":1.0,"alert":"RUPTURE","available":false},"commercial":{"clearancePriority":0.0,"siteStatus":"SOLD_OUT","unitPrice":13000,"packPrice":65000,"boxPrice":130000},"sourceConfidenceRank":3,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000023","sku":"CTGNI0023","brand":"Oliva","line":"Serie V Melanio","vitole":"Torpedo","format":"Torpedo","dimension":"6 1/2 x 52","power":4,"families":["Boisé","Gourmand","Velouté"],"intensity":4,"spice":2,"sweetness":2,"signatures":[],"durationMin":60,"durationMax":80,"confidence":"MODÉRÉE","stock":{"heldUnits":0.0,"ownedUnits":0.0,"depositUnits":0.0,"cigarsPerUnit":10.0,"heldCigars":0.0,"initialUnits":1.0,"exitsUnits":1.0,"sellThrough":1.0,"alert":"RUPTURE","available":false},"commercial":{"clearancePriority":0.0,"siteStatus":"SOLD_OUT","unitPrice":16500,"packPrice":82500,"boxPrice":165000},"sourceConfidenceRank":2,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000024","sku":"CTGNI0024","brand":"Oliva","line":"Serie V Melanio","vitole":"Gordo (Double Toro)","format":"Gordo","dimension":"6 x 60","power":3,"families":["Boisé","Velouté","Gourmand"],"intensity":4,"spice":2,"sweetness":2,"signatures":[],"durationMin":60,"durationMax":80,"confidence":"MODÉRÉE","stock":{"heldUnits":0.0,"ownedUnits":0.0,"depositUnits":0.0,"cigarsPerUnit":10.0,"heldCigars":0.0,"initialUnits":1.0,"exitsUnits":1.0,"sellThrough":1.0,"alert":"RUPTURE","available":false},"commercial":{"clearancePriority":0.0,"siteStatus":"SOLD_OUT","unitPrice":14000,"packPrice":56000,"boxPrice":140000},"sourceConfidenceRank":2,"arbitrage":"Profil principalement au niveau de la ligne.","allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000025","sku":"CTGNI0025","brand":"Oliva","line":"Serie V Melanio","vitole":"Toro","format":"Toro","dimension":"6 x 52","power":4,"families":["Boisé","Velouté","Gourmand"],"intensity":4,"spice":2,"sweetness":2,"signatures":[],"durationMin":55,"durationMax":70,"confidence":"MODÉRÉE","stock":{"heldUnits":0.0,"ownedUnits":0.0,"depositUnits":0.0,"cigarsPerUnit":10.0,"heldCigars":0.0,"initialUnits":1.0,"exitsUnits":1.0,"sellThrough":1.0,"alert":"RUPTURE","available":false},"commercial":{"clearancePriority":0.0,"siteStatus":"SOLD_OUT","unitPrice":13500,"packPrice":67500,"boxPrice":135000},"sourceConfidenceRank":2,"arbitrage":"Profil officiel surtout au niveau de la ligne; à contre-vérifier sur vitole exacte.","allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000026","sku":"CTGNI0026","brand":"Oliva","line":"Serie V Melanio Maduro","vitole":"Churchill","format":"Churchill","dimension":"7 x 50","power":3,"families":["Gourmand","Boisé","Velouté"],"intensity":4,"spice":3,"sweetness":3,"signatures":["Malté"],"durationMin":65,"durationMax":85,"confidence":"HAUTE","stock":{"heldUnits":0.0,"ownedUnits":0.0,"depositUnits":0.0,"cigarsPerUnit":10.0,"heldCigars":0.0,"initialUnits":1.0,"exitsUnits":1.0,"sellThrough":1.0,"alert":"RUPTURE","available":false},"commercial":{"clearancePriority":0.0,"siteStatus":"SOLD_OUT","unitPrice":13500,"packPrice":67500,"boxPrice":135000},"sourceConfidenceRank":3,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000027","sku":"CTGNI0027","brand":"Oliva","line":"Serie V Melanio Maduro","vitole":"Toro","format":"Toro","dimension":"6 x 52","power":4,"families":["Gourmand","Boisé","Velouté"],"intensity":4,"spice":3,"sweetness":3,"signatures":[],"durationMin":55,"durationMax":70,"confidence":"MODÉRÉE","stock":{"heldUnits":1.0,"ownedUnits":1.0,"depositUnits":0.0,"cigarsPerUnit":10.0,"heldCigars":10.0,"initialUnits":2.0,"exitsUnits":1.0,"sellThrough":0.5,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":5.0,"siteStatus":"IN_STOCK","unitPrice":12500,"packPrice":62500,"boxPrice":125000},"sourceConfidenceRank":2,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000028","sku":"CTGNI0028","brand":"Oliva","line":"Serie V Melanio Maduro","vitole":"Gordo (Double Toro)","format":"Gordo","dimension":"6 x 60","power":3,"families":["Gourmand","Boisé","Velouté"],"intensity":4,"spice":3,"sweetness":3,"signatures":[],"durationMin":60,"durationMax":80,"confidence":"MODÉRÉE","stock":{"heldUnits":0.0,"ownedUnits":0.0,"depositUnits":0.0,"cigarsPerUnit":8.0,"heldCigars":0.0,"initialUnits":1.0,"exitsUnits":1.0,"sellThrough":1.0,"alert":"RUPTURE","available":false},"commercial":{"clearancePriority":0.0,"siteStatus":"SOLD_OUT","unitPrice":14000,"packPrice":56000,"boxPrice":140000},"sourceConfidenceRank":2,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000029","sku":"CTGNI0029","brand":"Oliva","line":"Master Blends 3","vitole":"Robusto","format":"Robusto","dimension":"5 x 50","power":3,"families":["Gourmand","Boisé","Fauve"],"intensity":4,"spice":3,"sweetness":3,"signatures":[],"durationMin":40,"durationMax":55,"confidence":"MODÉRÉE","stock":{"heldUnits":0.0,"ownedUnits":0.0,"depositUnits":0.0,"cigarsPerUnit":5.0,"heldCigars":0.0,"initialUnits":0.0,"exitsUnits":0.0,"sellThrough":0,"alert":"RUPTURE","available":false},"commercial":{"clearancePriority":0.0,"siteStatus":"IN_STOCK","unitPrice":10000,"packPrice":50000,"boxPrice":200000},"sourceConfidenceRank":2,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000030","sku":"CTGNI0032","brand":"Plasencia","line":"Alma Fuerte","vitole":"Gordo (Sixto I)","format":"Gordo","dimension":"6 x 60","power":3,"families":["Gourmand","Boisé","Fauve"],"intensity":4,"spice":3,"sweetness":3,"signatures":["Fruité"],"durationMin":60,"durationMax":80,"confidence":"HAUTE","stock":{"heldUnits":1.0,"ownedUnits":1.0,"depositUnits":0.0,"cigarsPerUnit":10.0,"heldCigars":10.0,"initialUnits":1.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":10.0,"siteStatus":"IN_STOCK","unitPrice":14000,"packPrice":56000,"boxPrice":140000},"sourceConfidenceRank":3,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000031","sku":"CTGNI0033","brand":"Plasencia","line":"Alma Fuerte","vitole":"Toro (Nestor IV)","format":"Toro","dimension":"6 1/4 x 54","power":3,"families":["Gourmand","Boisé","Fauve"],"intensity":4,"spice":3,"sweetness":3,"signatures":["Fruité"],"durationMin":60,"durationMax":80,"confidence":"MODÉRÉE","stock":{"heldUnits":0.0,"ownedUnits":0.0,"depositUnits":0.0,"cigarsPerUnit":10.0,"heldCigars":0.0,"initialUnits":1.0,"exitsUnits":1.0,"sellThrough":1.0,"alert":"RUPTURE","available":false},"commercial":{"clearancePriority":0.0,"siteStatus":"IN_STOCK","unitPrice":12000,"packPrice":60000,"boxPrice":120000},"sourceConfidenceRank":2,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000032","sku":"CTGRD0001","brand":"Montecristo","line":"White","vitole":"Toro","format":"Toro","dimension":"6 x 54","power":3,"families":["Boisé","Fauve","Velouté"],"intensity":2,"spice":1,"sweetness":1,"signatures":["Toasté"],"durationMin":55,"durationMax":75,"confidence":"HAUTE","stock":{"heldUnits":2.0,"ownedUnits":2.0,"depositUnits":0.0,"cigarsPerUnit":4.0,"heldCigars":8.0,"initialUnits":3.0,"exitsUnits":1.0,"sellThrough":0.3333,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":5.3333,"siteStatus":"IN_STOCK","unitPrice":12000,"packPrice":60000,"boxPrice":240000},"sourceConfidenceRank":3,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales","reason":null}},{"cigarId":"CTG000033","sku":"CTGRD0002","brand":"Perez-Carrillo Series","line":"Allegiance","vitole":"Confidant","format":"Toro","dimension":"6 x 52","power":4,"families":["Gourmand","Boisé"],"intensity":4,"spice":4,"sweetness":3,"signatures":[],"durationMin":55,"durationMax":70,"confidence":"HAUTE","stock":{"heldUnits":2.0,"ownedUnits":2.0,"depositUnits":0.0,"cigarsPerUnit":20.0,"heldCigars":40.0,"initialUnits":2.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":40.0,"siteStatus":"IN_STOCK","unitPrice":15750,"packPrice":78750,"boxPrice":315000},"sourceConfidenceRank":3,"arbitrage":null,"allocation":{"curatorEligible":false,"status":"RESERVED_FOR_EVENTS","pool":"Casa Carrillo / événements","reason":"Réservé temporairement aux activations et événements CitiCigars."}},{"cigarId":"CTG000034","sku":"CTGRD0003","brand":"Perez-Carrillo Series","line":"Encore","vitole":"Celestial","format":"Robusto Extra","dimension":"6 1/8 x 50","power":4,"families":["Boisé","Velouté","Fauve"],"intensity":4,"spice":3,"sweetness":null,"signatures":["Agrumé"],"durationMin":55,"durationMax":70,"confidence":"MODÉRÉE","stock":{"heldUnits":3.0,"ownedUnits":3.0,"depositUnits":0.0,"cigarsPerUnit":20.0,"heldCigars":60.0,"initialUnits":3.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":null,"available":true},"commercial":{"clearancePriority":60.0,"siteStatus":"IN_STOCK","unitPrice":11500,"packPrice":57500,"boxPrice":230000},"sourceConfidenceRank":2,"arbitrage":"Sweetness non assez convergent.","allocation":{"curatorEligible":false,"status":"RESERVED_FOR_EVENTS","pool":"Casa Carrillo / événements","reason":"Réservé temporairement aux activations et événements CitiCigars."}},{"cigarId":"CTG000035","sku":"CTGRD0004","brand":"Perez-Carrillo Series","line":"Encore","vitole":"Majestic","format":"Robusto Gordo","dimension":"5 3/8 x 52","power":4,"families":["Boisé","Gourmand","Velouté"],"intensity":4,"spice":3,"sweetness":3,"signatures":["Caramélisé","Agrumé"],"durationMin":45,"durationMax":60,"confidence":"HAUTE","stock":{"heldUnits":2.0,"ownedUnits":3.0,"depositUnits":1.0,"cigarsPerUnit":20.0,"heldCigars":40.0,"initialUnits":3.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":40.0,"siteStatus":"IN_STOCK","unitPrice":12000,"packPrice":60000,"boxPrice":240000},"sourceConfidenceRank":3,"arbitrage":null,"allocation":{"curatorEligible":false,"status":"RESERVED_FOR_EVENTS","pool":"Casa Carrillo / événements","reason":"Réservé temporairement aux activations et événements CitiCigars."}},{"cigarId":"CTG000036","sku":"CTGRD0005","brand":"Perez-Carrillo Series","line":"La Historia","vitole":"E-III","format":"Double Corona","dimension":"6 7/8 x 54","power":4,"families":["Gourmand","Fauve","Boisé"],"intensity":4,"spice":4,"sweetness":2,"signatures":[],"durationMin":70,"durationMax":95,"confidence":"HAUTE","stock":{"heldUnits":4.0,"ownedUnits":5.0,"depositUnits":1.0,"cigarsPerUnit":20.0,"heldCigars":80.0,"initialUnits":5.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":null,"available":true},"commercial":{"clearancePriority":80.0,"siteStatus":"IN_STOCK","unitPrice":13000,"packPrice":65000,"boxPrice":260000},"sourceConfidenceRank":3,"arbitrage":null,"allocation":{"curatorEligible":false,"status":"RESERVED_FOR_EVENTS","pool":"Casa Carrillo / événements","reason":"Réservé temporairement aux activations et événements CitiCigars."}},{"cigarId":"CTG000037","sku":"CTGRD0006","brand":"Perez-Carrillo Series","line":"La Historia","vitole":"El Senador","format":"Toro","dimension":"5 3/8 x 52","power":4,"families":["Gourmand","Fauve","Boisé"],"intensity":4,"spice":4,"sweetness":2,"signatures":[],"durationMin":45,"durationMax":60,"confidence":"MODÉRÉE","stock":{"heldUnits":1.0,"ownedUnits":1.0,"depositUnits":0.0,"cigarsPerUnit":20.0,"heldCigars":20.0,"initialUnits":1.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":20.0,"siteStatus":"IN_STOCK","unitPrice":12500,"packPrice":62500,"boxPrice":250000},"sourceConfidenceRank":2,"arbitrage":null,"allocation":{"curatorEligible":false,"status":"RESERVED_FOR_EVENTS","pool":"Casa Carrillo / événements","reason":"Réservé temporairement aux activations et événements CitiCigars."}},{"cigarId":"CTG000038","sku":"CTGRD0007","brand":"Perez-Carrillo Series","line":"Pledge","vitole":"Prequel","format":"Robusto","dimension":"5 x 50","power":5,"families":["Boisé","Gourmand","Fauve"],"intensity":5,"spice":4,"sweetness":2,"signatures":[],"durationMin":40,"durationMax":55,"confidence":"HAUTE","stock":{"heldUnits":1.0,"ownedUnits":2.0,"depositUnits":1.0,"cigarsPerUnit":20.0,"heldCigars":20.0,"initialUnits":2.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":20.0,"siteStatus":"IN_STOCK","unitPrice":12000,"packPrice":60000,"boxPrice":240000},"sourceConfidenceRank":3,"arbitrage":null,"allocation":{"curatorEligible":false,"status":"RESERVED_FOR_EVENTS","pool":"Casa Carrillo / événements","reason":"Réservé temporairement aux activations et événements CitiCigars."}},{"cigarId":"CTG000039","sku":"CTGRD0008","brand":"Perez-Carrillo Series","line":"Pledge","vitole":"Sojourn","format":"Toro","dimension":"6 x 52","power":5,"families":["Boisé","Gourmand","Fauve"],"intensity":5,"spice":4,"sweetness":2,"signatures":[],"durationMin":55,"durationMax":70,"confidence":"MODÉRÉE","stock":{"heldUnits":2.0,"ownedUnits":2.0,"depositUnits":0.0,"cigarsPerUnit":20.0,"heldCigars":40.0,"initialUnits":2.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":40.0,"siteStatus":"IN_STOCK","unitPrice":13000,"packPrice":65000,"boxPrice":260000},"sourceConfidenceRank":2,"arbitrage":null,"allocation":{"curatorEligible":false,"status":"RESERVED_FOR_EVENTS","pool":"Casa Carrillo / événements","reason":"Réservé temporairement aux activations et événements CitiCigars."}},{"cigarId":"CTG000040","sku":"CTGRD0009","brand":"Inch Series","line":"Natural","vitole":"No. 62","format":"Gordo","dimension":"5 x 62","power":3,"families":["Fauve","Boisé","Gourmand"],"intensity":5,"spice":4,"sweetness":2,"signatures":[],"durationMin":50,"durationMax":70,"confidence":"MODÉRÉE","stock":{"heldUnits":1.0,"ownedUnits":1.0,"depositUnits":0.0,"cigarsPerUnit":24.0,"heldCigars":24.0,"initialUnits":1.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":24.0,"siteStatus":"IN_STOCK","unitPrice":10000,"packPrice":50000,"boxPrice":240000},"sourceConfidenceRank":2,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales / event optional","reason":"Disponible au Curator. Si la référence est encore disponible au moment d’un événement, elle peut aussi y être exposée/proposée."}},{"cigarId":"CTG000041","sku":"CTGRD0010","brand":"Inch Series","line":"Nicaragua","vitole":"No. 62","format":"Gordo","dimension":"5 x 62","power":4,"families":["Fauve","Boisé","Gourmand"],"intensity":5,"spice":4,"sweetness":2,"signatures":[],"durationMin":50,"durationMax":70,"confidence":"MODÉRÉE","stock":{"heldUnits":1.0,"ownedUnits":1.0,"depositUnits":0.0,"cigarsPerUnit":24.0,"heldCigars":24.0,"initialUnits":1.0,"exitsUnits":0.0,"sellThrough":0.0,"alert":"STOCK BAS","available":true},"commercial":{"clearancePriority":24.0,"siteStatus":"IN_STOCK","unitPrice":10000,"packPrice":50000,"boxPrice":240000},"sourceConfidenceRank":2,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales / event optional","reason":"Disponible au Curator. Si la référence est encore disponible au moment d’un événement, elle peut aussi y être exposée/proposée."}},{"cigarId":"CTG000042","sku":"CTGRD0011","brand":"New Wave Series","line":"New Wave Connecticut","vitole":"Brillantes","format":"Toro","dimension":"5 x 50","power":2,"families":["Velouté","Boisé","Fauve"],"intensity":2,"spice":2,"sweetness":2,"signatures":[],"durationMin":40,"durationMax":55,"confidence":"MODÉRÉE","stock":{"heldUnits":0.0,"ownedUnits":0.0,"depositUnits":0.0,"cigarsPerUnit":20.0,"heldCigars":0.0,"initialUnits":1.0,"exitsUnits":1.0,"sellThrough":1.0,"alert":"RUPTURE","available":false},"commercial":{"clearancePriority":0.0,"siteStatus":"IN_STOCK","unitPrice":8000,"packPrice":160000,"boxPrice":160000},"sourceConfidenceRank":2,"arbitrage":null,"allocation":{"curatorEligible":true,"status":"OPEN_FOR_CURATOR","pool":"Live sales / event optional","reason":"Disponible au Curator. Si la référence est encore disponible au moment d’un événement, elle peut aussi y être exposée/proposée."}}];

  const FAMILY_LABEL={veloute:'Velouté',boise:'Boisé',gourmand:'Gourmand',fauve:'Fauve'};
  const FAMILY_POS_SCORE=[100,67,33];
  const INTENSITY_SCORE=[100,75,50,25,0];
  const PREF_SCORE=[100,75,50,25,0];
  const SIG_CODE_TO_LABEL={toaste:'Toasté',caramelise:'Caramélisé',malte:'Malté',fruite:'Fruité',agrume:'Agrumé'};
  const DURATION_WINDOWS={
    under_60:{min:30,max:60,label:'moins d’1 heure'},
    around_60:{min:50,max:70,label:'autour d’1 heure'},
    '60_90':{min:60,max:90,label:'entre 1 h et 1 h 30'},
    '90_plus':{min:90,max:130,label:'plus d’1 h 30'}
  };
  const CONF_RANK={'HAUTE':3,'MODÉRÉE':2,'MODEREE':2,'MIXTE':1.5,'FAIBLE':1};

  function corridor(v){ return v<=2?0:(v===3?1:2); }
  function familyScore(p,family){
    const idx=(p.families||[]).indexOf(FAMILY_LABEL[family]);
    return idx<0?0:(FAMILY_POS_SCORE[idx]||0);
  }
  function intensityScore(p,client){
    if(!Number.isFinite(p.intensity)||!Number.isFinite(client)) return 0;
    return INTENSITY_SCORE[Math.min(4,Math.abs(p.intensity-client))]||0;
  }
  function dnaFit(p,a){
    return (5*familyScore(p,a.family)+2*intensityScore(p,a.intensity))/7;
  }
  function durationWindow(key,widen){
    const d=DURATION_WINDOWS[key];
    if(!d) return null;
    return {min:Math.max(0,d.min-(widen||0)),max:d.max+(widen||0),label:d.label};
  }
  function durationEligible(p,key,widen){
    const w=durationWindow(key,widen);
    if(!w) return true;
    if(!Number.isFinite(p.durationMin)||!Number.isFinite(p.durationMax)) return false;
    const overlap=Math.min(p.durationMax,w.max)-Math.max(p.durationMin,w.min);
    return overlap>=10; // une simple intersection au point frontière ne suffit pas
  }
  function durationScore(p,key){
    const w=durationWindow(key,0);
    if(!w) return 50;
    if(!Number.isFinite(p.durationMin)||!Number.isFinite(p.durationMax)) return 20;
    const target=(w.min+w.max)/2, pmid=(p.durationMin+p.durationMax)/2;
    return Math.max(0,100-Math.abs(pmid-target)*4);
  }
  function prefAxisScore(productValue,clientValue){
    if(clientValue===null||clientValue===undefined) return null;
    if(!Number.isFinite(productValue)) return 20; // ND: inconnu, jamais assimilé à faible
    return PREF_SCORE[Math.min(4,Math.abs(productValue-clientValue))]||0;
  }
  function signatureScore(p,selected){
    if(!Array.isArray(selected)||!selected.length) return null;
    const desired=selected.map(x=>SIG_CODE_TO_LABEL[x]).filter(Boolean);
    if(!desired.length) return null;
    const have=new Set(p.signatures||[]);
    return 100*desired.filter(x=>have.has(x)).length/desired.length;
  }
  function refinementScore(p,a){
    const comps=[];
    if(a.secondaryFamily){
      const s=familyScore(p,a.secondaryFamily);
      comps.push([s,.5]);
    }
    const sp=prefAxisScore(p.spice,a.spice);
    if(sp!==null) comps.push([sp,1]);
    const sw=prefAxisScore(p.sweetness,a.sweetness);
    if(sw!==null) comps.push([sw,1]);
    const sg=signatureScore(p,a.signatures||[]);
    if(sg!==null) comps.push([sg,1]);
    if(!comps.length) return 50;
    const den=comps.reduce((t,x)=>t+x[1],0);
    return comps.reduce((t,x)=>t+x[0]*x[1],0)/den;
  }
  function confidenceRank(p){
    if(Number.isFinite(p.sourceConfidenceRank)) return p.sourceConfidenceRank;
    return CONF_RANK[String(p.confidence||'').toUpperCase()]||0;
  }
  function rankVector(p,a){
    return [
      refinementScore(p,a),
      durationScore(p,a.duration),
      confidenceRank(p),
      Number(p.stock&&p.stock.heldCigars)||0,
      Number(p.commercial&&p.commercial.clearancePriority)||0
    ];
  }
  function compareVector(a,b){
    for(let i=0;i<a.length;i++){
      if(a[i]!==b[i]) return b[i]-a[i];
    }
    return 0;
  }
  function sameVector(a,b){
    return a.length===b.length && a.every((x,i)=>Math.abs(x-b[i])<1e-9);
  }
  function normalizeAnswers(input){
    const a=(input&&input.customerDNA)?{
      family:input.customerDNA.family,
      power:Number(input.customerDNA.power),
      intensity:Number(input.customerDNA.intensity),
      secondaryFamily:input.customerDNA.secondaryFamily||null,
      spice:input.refinements?input.refinements.spice:null,
      sweetness:input.refinements?input.refinements.sweetness:null,
      signatures:input.refinements&&Array.isArray(input.refinements.signatures)?input.refinements.signatures:[],
      duration:input.refinements?input.refinements.duration:null
    }:{...(input||{})};
    if(a.spice==='none') a.spice=null;
    if(a.sweetness==='none') a.sweetness=null;
    return a;
  }
  // AJOUT AMENDEMENT (schéma diff V2 point 10) : liveAvailabilityByCigarId
  // permet d'injecter une disponibilité fraîche (Stock Central) par-dessus
  // le CATALOG figé, sans toucher au scoring/selectDiverse. Absent ou
  // sans entrée pour un cigarId => comportement inchangé (CATALOG figé),
  // donc rétro-compatible avec tout appelant existant qui ne le passe pas.
  function eligiblePool(a,widen,allowAdjacentPower,liveAvailabilityByCigarId){
    const cc=corridor(a.power);
    // Fail-closed CORRIGÉ (audit) : si liveAvailabilityByCigarId est fourni (même
    // vide), c'est le SEUL juge de disponibilité, cigarId par cigarId. L'absence
    // d'entrée pour un cigarId précis = indisponible pour CE cigarId — ne retombe
    // JAMAIS sur p.stock.available (le CATALOG figé), même si d'autres cigarId
    // sont bien présents dans la map. Seule l'ABSENCE TOTALE du paramètre
    // (undefined, aucun contrôle live tenté) conserve l'ancien comportement local.
    const hasLiveOverride = liveAvailabilityByCigarId != null;
    return CATALOG.filter(p=>{
      let available, heldOk;
      if(hasLiveOverride){
        const live=liveAvailabilityByCigarId[p.cigarId];
        available=!!live&&(!!live.packAvailable||!!live.boxAvailable);
        heldOk=true; // heldUnits figé n'a plus de sens dès qu'une source live existe
      }else{
        available=!!(p.stock&&p.stock.available);
        heldOk=Number(p.stock&&p.stock.heldUnits)>0;
      }
      if(!(available&&heldOk)) return false; // détenu physiquement = vérité opérationnelle
      if(p.allocation&&p.allocation.curatorEligible===false) return false; // stock réservé aux événements: hors Curator sans falsifier le stock
      if(!durationEligible(p,a.duration,widen||0)) return false;
      if(!Number.isFinite(p.power)) return false;
      const pc=corridor(p.power);
      if(allowAdjacentPower ? Math.abs(pc-cc)>1 : pc!==cc) return false;
      if(!Number.isFinite(p.intensity)||Math.abs(p.intensity-a.intensity)>=3) return false;
      return dnaFit(p,a)>=70;
    }).map(p=>({
      ...p,
      _audit:{
        dnaFit:Math.round(dnaFit(p,a)),
        familyScore:familyScore(p,a.family),
        intensityScore:intensityScore(p,a.intensity),
        refinementScore:Math.round(refinementScore(p,a)),
        durationScore:Math.round(durationScore(p,a.duration)),
        powerExact:corridor(p.power)===cc
      }
    })).sort((x,y)=>compareVector(rankVector(x,a),rankVector(y,a)));
  }
  function selectDiverse(cands,a,n){
    if(cands.length<=n) return cands.slice();
    const rest=cands.slice(), chosen=[];
    while(rest.length&&chosen.length<n){
      if(!chosen.length){ chosen.push(rest.shift()); continue; }
      const top=rest[0], topV=rankVector(top,a);
      const tied=rest.filter(p=>sameVector(rankVector(p,a),topV));
      const used=new Set(chosen.map(p=>p.brand));
      const diverse=tied.find(p=>!used.has(p.brand));
      if(diverse){ rest.splice(rest.indexOf(diverse),1); chosen.push(diverse); }
      else chosen.push(rest.shift());
    }
    return chosen;
  }
  function priceList(p){
    const c=p.commercial||{}, out=[];
    const fmt=n=>Number(n).toLocaleString('fr-FR')+' FCFA';
    if(Number.isFinite(c.unitPrice)) out.push({label:'À l’unité',value:fmt(c.unitPrice)});
    if(Number.isFinite(c.packPrice)) out.push({label:'Au pack',value:fmt(c.packPrice)});
    if(Number.isFinite(c.boxPrice)) out.push({label:'À la boîte',value:fmt(c.boxPrice)});
    return out;
  }
  function durationLabel(p){
    if(Number.isFinite(p.durationMin)&&Number.isFinite(p.durationMax)) return `≈ ${p.durationMin}–${p.durationMax} min`;
    return '';
  }
  function matchedSignatures(p,a){
    const desired=(a.signatures||[]).map(x=>SIG_CODE_TO_LABEL[x]).filter(Boolean);
    const have=new Set(p.signatures||[]);
    return desired.filter(x=>have.has(x));
  }
  function reasonFor(p,a,mode){
    const fam=FAMILY_LABEL[a.family]||'votre univers';
    const parts=[`Son profil ${fam.toLowerCase()} correspond au cœur de votre Cigar DNA.`];
    const ms=matchedSignatures(p,a);
    if(ms.length) parts.push(`On y retrouve aussi ${ms.map(x=>x.toLowerCase()).join(' et ')}, parmi les accents qui vous attirent.`);
    else if(a.spice!==null&&a.spice!==undefined&&Number.isFinite(p.spice)&&Math.abs(p.spice-a.spice)<=1) parts.push('Son relief épicé est proche de votre sensibilité.');
    else if(a.sweetness!==null&&a.sweetness!==undefined&&Number.isFinite(p.sweetness)&&Math.abs(p.sweetness-a.sweetness)<=1) parts.push('Sa douceur naturelle est proche de votre sensibilité.');
    if(mode==='FALLBACK_DURATION') parts.push('La durée estimée est légèrement en dehors de votre plage habituelle.');
    if(mode==='FALLBACK_POWER') parts.push('Sa puissance se situe dans le corridor immédiatement voisin du vôtre : c’est une alternative de compromis.');
    return parts.join(' ');
  }
  function publicItem(p,a,mode){
    return {
      cigarId:p.cigarId, sku:p.sku,
      name:[p.brand,p.line,p.vitole].filter(Boolean).join(' — '),
      brand:p.brand,line:p.line,vitole:p.vitole,
      format:[p.format,p.dimension].filter(Boolean).join(' · '),
      durationLabel:durationLabel(p),
      reason:reasonFor(p,a,mode),
      // Le Curator révèle le cigare, pas son prix : le détail commercial reste sur le site.
      productUrl:null,
      // Toute vitole détenue a une fiche produit identifiée par son SKU. Le statut site est audité séparément.
      productSkuPath:`/p/${encodeURIComponent(p.sku)}`,
      imageUrl:null,
      fallback:mode!=='EXACT',
      fallbackType:mode==='FALLBACK_DURATION'?'DURATION':(mode==='FALLBACK_POWER'?'POWER':null)
    };
  }
  function recommend(input,liveAvailabilityByCigarId){
    const a=normalizeAnswers(input);
    if(!a.family||!Number.isFinite(a.power)||!Number.isFinite(a.intensity)) throw new Error('DNA_INPUT_INCOMPLETE');
    let mode='EXACT', pool=eligiblePool(a,0,false,liveAvailabilityByCigarId);
    if(!pool.length){ mode='FALLBACK_DURATION'; pool=eligiblePool(a,15,false,liveAvailabilityByCigarId); }
    if(!pool.length){ mode='FALLBACK_POWER'; pool=eligiblePool(a,15,true,liveAvailabilityByCigarId); }
    if(!pool.length) return {mode:'NO_MATCH',recommendations:[],audit:{eligible:0}};
    const selected=selectDiverse(pool,a,3);
    return {
      mode,
      recommendations:selected.map(p=>publicItem(p,a,mode)),
      audit:{
        eligible:pool.length,
        selected:selected.map(p=>({sku:p.sku,...p._audit,rankVector:rankVector(p,a),siteStatus:String(p.commercial&&p.commercial.siteStatus||''),siteStatusMismatch:String(p.commercial&&p.commercial.siteStatus||'').toUpperCase()!=='IN_STOCK'}))
      }
    };
  }
  function audit(input){
    const a=normalizeAnswers(input), r=recommend(input);
    return {answers:a,...r};
  }
  return {
    // Bump volontaire 1.3.1-rc -> 1.3.2-rc (liveAvailabilityByCigarId) -> 1.3.3-rc
    // (export de publicItem) -> 1.3.4-rc (correction audit : fail-closed par
    // CIGAR_ID individuel dans eligiblePool, cf. commentaire ci-dessus).
    // Aucun changement de scoring/selectDiverse dans aucun de ces cas.
    // dna_availability_watch.lastEvaluatedEngineVersion trace cette valeur
    // à chaque évaluation pour détecter toute divergence future HTML/Node.
    version:'1.3.4-rc',
    doctrine:'Stock détenu Curator-eligible → durée → corridor puissance → DNA Fit ≥70 → raffinements → 1 à 3 recommandations → fallback explicite',
    catalogAsOf:'2026-08-11',
    CATALOG,
    DURATION_WINDOWS,
    eligiblePool,
    publicItem, // exposé pour que le front puisse rendre les cartes du pool complet (déroulé "voir les autres"), même forme que le top-3 — ajout d'exposition, pas de nouvelle logique
    recommend,
    audit
  };
});
