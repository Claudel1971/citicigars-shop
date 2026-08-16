// Frontières typées minimales pour les composants React historiques en JSX.
// Ils restent volontairement en JavaScript; leur migration complète vers TS
// n'est pas nécessaire pour typer la composition de l'application.
declare module "@/context/CartContext" {
  import type { ComponentType, PropsWithChildren } from "react";
  export const CartProvider: ComponentType<PropsWithChildren>;
}

declare module "@/context/ProductContext" {
  import type { ComponentType, PropsWithChildren } from "react";
  export const ProductProvider: ComponentType<PropsWithChildren>;
}

declare module "@/context/WishlistContext" {
  import type { ComponentType, PropsWithChildren } from "react";
  export const WishlistProvider: ComponentType<PropsWithChildren>;
}

declare module "@/context/ConfigContext" {
  import type { ComponentType, PropsWithChildren } from "react";
  export const ConfigProvider: ComponentType<PropsWithChildren>;
}

declare module "@/context/ContentContext" {
  import type { ComponentType, PropsWithChildren } from "react";
  export const ContentProvider: ComponentType<PropsWithChildren>;
}

declare module "@/pages/ProductPage" {
  import type { ComponentType } from "react";
  const component: ComponentType<any>;
  export default component;
}

declare module "@/pages/Home" {
  import type { ComponentType } from "react";
  const component: ComponentType<any>;
  export default component;
}

declare module "@/pages/Catalogue" {
  import type { ComponentType } from "react";
  const component: ComponentType<any>;
  export default component;
}

declare module "@/pages/WishlistPage" {
  import type { ComponentType } from "react";
  const component: ComponentType<any>;
  export default component;
}

declare module "@/pages/Admin" {
  import type { ComponentType } from "react";
  const component: ComponentType<any>;
  export default component;
}

declare module "@/pages/BundlesPage" {
  import type { ComponentType } from "react";
  const component: ComponentType<any>;
  export default component;
}

declare module "@/pages/PromotionsPage" {
  import type { ComponentType } from "react";
  const component: ComponentType<any>;
  export default component;
}

declare module "@/pages/AboutPage" {
  import type { ComponentType } from "react";
  const component: ComponentType<any>;
  export default component;
}

declare module "@/pages/LegalPage" {
  import type { ComponentType } from "react";
  export const CGVPage: ComponentType<any>;
  export const PrivacyPage: ComponentType<any>;
  export const MentionsPage: ComponentType<any>;
}

declare module "@/components/cart/CheckoutForm" {
  import type { ComponentType } from "react";
  const component: ComponentType<any>;
  export default component;
}

declare module "@/components/layout/Header" {
  import type { ComponentType } from "react";
  const component: ComponentType<any>;
  export default component;
}

declare module "@/components/layout/Footer" {
  import type { ComponentType } from "react";
  const component: ComponentType<any>;
  export default component;
}

declare module "@/components/cart/CartDrawer" {
  import type { ComponentType } from "react";
  const component: ComponentType<any>;
  export default component;
}
