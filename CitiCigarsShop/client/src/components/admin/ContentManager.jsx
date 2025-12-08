import React, { useState, useEffect } from 'react';
import { 
  Save, RefreshCw, AlertCircle, CheckCircle, Loader2,
  Home, Image, Tag, FileText, Settings, ChevronRight,
  Plus, Trash2, Upload, Menu, GripVertical, ArrowUp, ArrowDown
} from 'lucide-react';

const API_BASE = '/api';

const MENU_SECTIONS = [
  { 
    id: 'header', 
    label: 'Header / Navigation', 
    icon: Menu,
    subsections: [
      { id: 'logo', label: 'Logo' },
      { id: 'menuItems', label: 'Menu de Navigation' }
    ]
  },
  { 
    id: 'home', 
    label: 'Page d\'Accueil', 
    icon: Home,
    subsections: [
      { id: 'carousel', label: 'Carousel / Bannière' },
      { id: 'brandStory', label: 'Notre Histoire' }
    ]
  },
  { 
    id: 'promotions', 
    label: 'Promotions', 
    icon: Tag,
    subsections: [
      { id: 'promoBanner', label: 'Bannière Promo' },
      { id: 'promoProducts', label: 'Produits en Promo' }
    ]
  },
  { 
    id: 'pages', 
    label: 'Pages', 
    icon: FileText,
    subsections: [
      { id: 'about', label: 'À Propos' },
      { id: 'contact', label: 'Contact' }
    ]
  },
  { 
    id: 'footer', 
    label: 'Footer', 
    icon: Settings,
    subsections: []
  }
];

export default function ContentManager() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [token, setToken] = useState(() => sessionStorage.getItem('cms_token'));
  const [activeSection, setActiveSection] = useState('home');
  const [activeSubsection, setActiveSubsection] = useState('carousel');
  const [expandedMenus, setExpandedMenus] = useState(['home']);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/content`);
      if (res.ok) {
        const data = await res.json();
        setContent(ensureContentStructure(data));
      }
    } catch (err) {
      console.error('Error loading content:', err);
      setMessage({ type: 'error', text: 'Erreur lors du chargement du contenu' });
    } finally {
      setLoading(false);
    }
  };

  const ensureContentStructure = (data) => {
    return {
      header: data.header || {
        logo: {
          url: '',
          alt: 'CitiCigars',
          href: '/'
        },
        menuItems: [
          { label: 'ACCUEIL', href: '/', highlight: false, icon: '' },
          { label: 'CIGARES', href: '/catalogue', highlight: false, icon: '' },
          { label: 'NOS ASSORTIMENTS', href: '/assortiments', highlight: true, icon: '🎁' },
          { label: 'PROMOTIONS', href: '/promotions', highlight: false, icon: '' }
        ]
      },
      home: {
        heroSlides: data.home?.heroSlides || [
          { title: '', subtitle: '', ctaText: '', ctaLink: '', imageUrl: '' }
        ],
        brandStory: data.home?.brandStory || {
          icon: '⚜',
          title: '',
          text: '',
          ctaText: '',
          ctaLink: ''
        }
      },
      promotions: data.promotions || {
        banner: {
          enabled: false,
          title: '',
          subtitle: '',
          discount: '',
          validUntil: ''
        },
        featuredSkus: []
      },
      pages: data.pages || {
        about: { title: '', content: '' },
        contact: { title: '', address: '', phone: '', email: '', hours: '' }
      },
      footer: data.footer || {
        tagline: '',
        legalNotice: ''
      },
      _meta: data._meta
    };
  };

  const handleSave = async () => {
    if (!token) {
      setMessage({ type: 'error', text: 'Veuillez vous connecter avec le mot de passe CMS' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/content`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(content)
      });

      if (res.ok) {
        const data = await res.json();
        setContent(ensureContentStructure(data.content));
        setMessage({ type: 'success', text: 'Contenu enregistré avec succès !' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.error || 'Erreur lors de la sauvegarde' });
      }
    } catch (err) {
      console.error('Error saving content:', err);
      setMessage({ type: 'error', text: 'Erreur réseau lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogin = async (password) => {
    try {
      const res = await fetch(`${API_BASE}/content/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        sessionStorage.setItem('cms_token', data.token);
        setMessage({ type: 'success', text: 'Connecté au CMS !' });
        setTimeout(() => setMessage(null), 2000);
        return true;
      } else {
        setMessage({ type: 'error', text: 'Mot de passe incorrect' });
        return false;
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur de connexion' });
      return false;
    }
  };

  const updateField = (path, value) => {
    setContent(prev => {
      const newContent = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = newContent;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (key.includes('[')) {
          const [arrKey, idx] = key.replace(']', '').split('[');
          obj = obj[arrKey][parseInt(idx)];
        } else {
          if (!obj[key]) obj[key] = {};
          obj = obj[key];
        }
      }
      const lastKey = keys[keys.length - 1];
      obj[lastKey] = value;
      return newContent;
    });
  };

  const addSlide = () => {
    setContent(prev => ({
      ...prev,
      home: {
        ...prev.home,
        heroSlides: [
          ...prev.home.heroSlides,
          { title: 'Nouveau Slide', subtitle: '', ctaText: 'Découvrir', ctaLink: '/catalogue', imageUrl: '' }
        ]
      }
    }));
  };

  const removeSlide = (index) => {
    if (content.home.heroSlides.length <= 1) {
      setMessage({ type: 'error', text: 'Vous devez garder au moins un slide' });
      return;
    }
    setContent(prev => ({
      ...prev,
      home: {
        ...prev.home,
        heroSlides: prev.home.heroSlides.filter((_, i) => i !== index)
      }
    }));
  };

  const toggleMenu = (sectionId) => {
    setExpandedMenus(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleSectionClick = (section, subsection = null) => {
    setActiveSection(section.id);
    if (subsection) {
      setActiveSubsection(subsection.id);
    } else if (section.subsections.length > 0) {
      setActiveSubsection(section.subsections[0].id);
    } else {
      setActiveSubsection(null);
    }
    if (!expandedMenus.includes(section.id)) {
      setExpandedMenus(prev => [...prev, section.id]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Chargement du contenu...</span>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="p-8 text-center text-red-600">
        <AlertCircle className="h-12 w-12 mx-auto mb-4" />
        <p>Impossible de charger le contenu</p>
        <button onClick={fetchContent} className="mt-4 px-4 py-2 bg-primary text-white rounded">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-180px)] bg-gray-50 rounded-lg overflow-hidden border">
      {/* Sidebar Menu */}
      <div className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-serif font-bold text-primary">Gestion du Contenu</h2>
          <p className="text-xs text-muted-foreground mt-1">Sélectionnez une section</p>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-2">
          {MENU_SECTIONS.map(section => (
            <div key={section.id} className="mb-1">
              <button
                onClick={() => {
                  if (section.subsections.length > 0) {
                    toggleMenu(section.id);
                  }
                  handleSectionClick(section);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  activeSection === section.id 
                    ? 'bg-primary/10 text-primary font-medium' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <section.icon size={18} />
                <span className="flex-1 text-sm">{section.label}</span>
                {section.subsections.length > 0 && (
                  <ChevronRight 
                    size={16} 
                    className={`transition-transform ${expandedMenus.includes(section.id) ? 'rotate-90' : ''}`}
                  />
                )}
              </button>
              
              {section.subsections.length > 0 && expandedMenus.includes(section.id) && (
                <div className="ml-6 mt-1 space-y-1">
                  {section.subsections.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => {
                        setActiveSection(section.id);
                        setActiveSubsection(sub.id);
                      }}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        activeSection === section.id && activeSubsection === sub.id
                          ? 'bg-primary text-white'
                          : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Save Button in Sidebar */}
        <div className="p-3 border-t bg-gray-50">
          <button
            onClick={handleSave}
            disabled={saving || !token}
            className="w-full px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center justify-center gap-2 disabled:opacity-50 font-medium"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Enregistrer
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-white border-b flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-gray-800">
              {MENU_SECTIONS.find(s => s.id === activeSection)?.label}
              {activeSubsection && (
                <span className="text-primary ml-2">
                  / {MENU_SECTIONS.find(s => s.id === activeSection)?.subsections.find(ss => ss.id === activeSubsection)?.label}
                </span>
              )}
            </h3>
            {content._meta?.lastUpdated && (
              <p className="text-xs text-muted-foreground">
                Dernière MAJ : {new Date(content._meta.lastUpdated).toLocaleString('fr-FR')}
              </p>
            )}
          </div>
          <button
            onClick={fetchContent}
            className="px-3 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
            disabled={loading}
          >
            <RefreshCw size={16} /> Recharger
          </button>
        </div>

        {/* Messages */}
        {message && (
          <div className={`mx-4 mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            {message.text}
          </div>
        )}

        {/* Login Form */}
        {!token && (
          <div className="m-4">
            <LoginForm onLogin={handleLogin} />
          </div>
        )}

        {/* Content Editor */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeSection === 'header' && activeSubsection === 'logo' && (
            <HeaderLogoEditor 
              data={content.header?.logo}
              updateField={updateField}
              token={token}
            />
          )}

          {activeSection === 'header' && activeSubsection === 'menuItems' && (
            <HeaderMenuEditor 
              menuItems={content.header?.menuItems || []}
              updateField={updateField}
              setContent={setContent}
            />
          )}

          {activeSection === 'home' && activeSubsection === 'carousel' && (
            <CarouselEditor 
              slides={content.home?.heroSlides || []}
              updateField={updateField}
              addSlide={addSlide}
              removeSlide={removeSlide}
              token={token}
            />
          )}

          {activeSection === 'home' && activeSubsection === 'brandStory' && (
            <BrandStoryEditor 
              data={content.home?.brandStory}
              updateField={updateField}
            />
          )}

          {activeSection === 'promotions' && activeSubsection === 'promoBanner' && (
            <PromoBannerEditor 
              data={content.promotions?.banner}
              updateField={updateField}
            />
          )}

          {activeSection === 'promotions' && activeSubsection === 'promoProducts' && (
            <PromoProductsEditor 
              skus={content.promotions?.featuredSkus || []}
              updateField={updateField}
            />
          )}

          {activeSection === 'pages' && activeSubsection === 'about' && (
            <AboutPageEditor 
              data={content.pages?.about}
              updateField={updateField}
            />
          )}

          {activeSection === 'pages' && activeSubsection === 'contact' && (
            <ContactPageEditor 
              data={content.pages?.contact}
              updateField={updateField}
            />
          )}

          {activeSection === 'footer' && (
            <FooterEditor 
              data={content.footer}
              updateField={updateField}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CarouselEditor({ slides, updateField, addSlide, removeSlide, token }) {
  const [expandedSlide, setExpandedSlide] = useState(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-semibold text-gray-800">Slides du Carousel</h4>
          <p className="text-sm text-gray-500">{slides.length} slide(s) - Cliquez pour modifier</p>
        </div>
        <button
          onClick={addSlide}
          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> Ajouter un slide
        </button>
      </div>

      {slides.map((slide, index) => (
        <div key={index} className="bg-white border rounded-lg shadow-sm overflow-hidden">
          <div 
            className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
              expandedSlide === index ? 'bg-primary/5 border-b' : 'hover:bg-gray-50'
            }`}
            onClick={() => setExpandedSlide(expandedSlide === index ? null : index)}
          >
            <div className="flex items-center gap-3">
              {slide.imageUrl ? (
                <img 
                  src={slide.imageUrl} 
                  alt="" 
                  className="w-12 h-8 object-cover rounded"
                />
              ) : (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  expandedSlide === index ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {index + 1}
                </div>
              )}
              <div>
                <h5 className="font-medium text-gray-800 text-sm">
                  {slide.title || `Slide ${index + 1}`}
                </h5>
                <p className="text-xs text-gray-500 truncate max-w-xs">
                  {slide.subtitle?.substring(0, 50) || 'Pas de sous-titre'}...
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); removeSlide(index); }}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Supprimer ce slide"
              >
                <Trash2 size={16} />
              </button>
              <ChevronRight 
                size={18} 
                className={`text-gray-400 transition-transform ${expandedSlide === index ? 'rotate-90' : ''}`}
              />
            </div>
          </div>

          {expandedSlide === index && (
            <div className="p-4 bg-gray-50 grid gap-4">
              <ImageUploader
                label="Image de fond"
                currentUrl={slide.imageUrl}
                onImageChange={(url) => updateField(`home.heroSlides[${index}].imageUrl`, url)}
                token={token}
              />
              <Field
                label="Titre principal"
                value={slide.title}
                onChange={(v) => updateField(`home.heroSlides[${index}].title`, v)}
                placeholder="Ex: L'Excellence du Cigare"
              />
              <Field
                label="Sous-titre / Description"
                value={slide.subtitle}
                onChange={(v) => updateField(`home.heroSlides[${index}].subtitle`, v)}
                textarea
                placeholder="Ex: Découvrez notre sélection de cigares premium..."
              />
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Texte du bouton"
                value={slide.ctaText}
                onChange={(v) => updateField(`home.heroSlides[${index}].ctaText`, v)}
                placeholder="Ex: Découvrir"
              />
              <Field
                label="Lien du bouton"
                value={slide.ctaLink}
                onChange={(v) => updateField(`home.heroSlides[${index}].ctaLink`, v)}
                placeholder="Ex: /catalogue"
              />
            </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function BrandStoryEditor({ data, updateField }) {
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <h4 className="font-semibold text-gray-800 mb-4">Section "Notre Histoire"</h4>
      <p className="text-sm text-gray-500 mb-6">Cette section apparaît sur la page d'accueil</p>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Icône / Emoji"
            value={data?.icon}
            onChange={(v) => updateField('home.brandStory.icon', v)}
            placeholder="⚜"
          />
          <Field
            label="Titre"
            value={data?.title}
            onChange={(v) => updateField('home.brandStory.title', v)}
            placeholder="Notre Histoire"
          />
        </div>
        <Field
          label="Texte descriptif"
          value={data?.text}
          onChange={(v) => updateField('home.brandStory.text', v)}
          textarea
          placeholder="Depuis plus de 20 ans..."
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Texte du bouton"
            value={data?.ctaText}
            onChange={(v) => updateField('home.brandStory.ctaText', v)}
            placeholder="En savoir plus"
          />
          <Field
            label="Lien du bouton"
            value={data?.ctaLink}
            onChange={(v) => updateField('home.brandStory.ctaLink', v)}
            placeholder="/a-propos"
          />
        </div>
      </div>
    </div>
  );
}

function PromoBannerEditor({ data, updateField }) {
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <h4 className="font-semibold text-gray-800 mb-4">Bannière Promotionnelle</h4>
      <p className="text-sm text-gray-500 mb-6">Configurez la bannière de promotion affichée sur le site</p>

      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data?.enabled || false}
              onChange={(e) => updateField('promotions.banner.enabled', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="font-medium">Activer la bannière promotionnelle</span>
          </label>
        </div>

        <Field
          label="Titre de la promo"
          value={data?.title}
          onChange={(v) => updateField('promotions.banner.title', v)}
          placeholder="Ex: Soldes d'été"
        />
        <Field
          label="Sous-titre"
          value={data?.subtitle}
          onChange={(v) => updateField('promotions.banner.subtitle', v)}
          placeholder="Ex: Sur une sélection de cigares premium"
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Réduction affichée"
            value={data?.discount}
            onChange={(v) => updateField('promotions.banner.discount', v)}
            placeholder="Ex: -20%"
          />
          <Field
            label="Valable jusqu'au"
            value={data?.validUntil}
            onChange={(v) => updateField('promotions.banner.validUntil', v)}
            placeholder="Ex: 31/12/2024"
          />
        </div>
      </div>
    </div>
  );
}

function PromoProductsEditor({ skus, updateField }) {
  const [newSku, setNewSku] = useState('');

  const addSku = () => {
    if (newSku.trim()) {
      updateField('promotions.featuredSkus', [...skus, newSku.trim()]);
      setNewSku('');
    }
  };

  const removeSku = (index) => {
    updateField('promotions.featuredSkus', skus.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <h4 className="font-semibold text-gray-800 mb-4">Produits en Promotion</h4>
      <p className="text-sm text-gray-500 mb-6">Ajoutez les SKUs des produits à mettre en avant</p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newSku}
          onChange={(e) => setNewSku(e.target.value)}
          placeholder="Entrez un SKU..."
          className="flex-1 border rounded-lg p-2 text-sm"
          onKeyPress={(e) => e.key === 'Enter' && addSku()}
        />
        <button
          onClick={addSku}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          Ajouter
        </button>
      </div>

      <div className="space-y-2">
        {skus.length === 0 ? (
          <p className="text-gray-400 text-sm italic">Aucun produit en promotion</p>
        ) : (
          skus.map((sku, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <code className="text-sm font-mono">{sku}</code>
              <button
                onClick={() => removeSku(index)}
                className="p-1 text-red-500 hover:bg-red-100 rounded"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AboutPageEditor({ data, updateField }) {
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <h4 className="font-semibold text-gray-800 mb-4">Page À Propos</h4>
      <p className="text-sm text-gray-500 mb-6">Contenu de la page "À Propos"</p>

      <div className="space-y-4">
        <Field
          label="Titre de la page"
          value={data?.title}
          onChange={(v) => updateField('pages.about.title', v)}
          placeholder="À Propos de CitiCigars"
        />
        <Field
          label="Contenu"
          value={data?.content}
          onChange={(v) => updateField('pages.about.content', v)}
          textarea
          placeholder="Présentez votre entreprise..."
        />
      </div>
    </div>
  );
}

function ContactPageEditor({ data, updateField }) {
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <h4 className="font-semibold text-gray-800 mb-4">Page Contact</h4>
      <p className="text-sm text-gray-500 mb-6">Informations de contact</p>

      <div className="space-y-4">
        <Field
          label="Titre de la page"
          value={data?.title}
          onChange={(v) => updateField('pages.contact.title', v)}
          placeholder="Contactez-nous"
        />
        <Field
          label="Adresse"
          value={data?.address}
          onChange={(v) => updateField('pages.contact.address', v)}
          textarea
          placeholder="123 Rue du Cigare..."
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Téléphone"
            value={data?.phone}
            onChange={(v) => updateField('pages.contact.phone', v)}
            placeholder="+237 6XX XXX XXX"
          />
          <Field
            label="Email"
            value={data?.email}
            onChange={(v) => updateField('pages.contact.email', v)}
            placeholder="contact@citicigars.com"
          />
        </div>
        <Field
          label="Horaires d'ouverture"
          value={data?.hours}
          onChange={(v) => updateField('pages.contact.hours', v)}
          textarea
          placeholder="Lun-Ven: 9h-18h..."
        />
      </div>
    </div>
  );
}

function FooterEditor({ data, updateField }) {
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <h4 className="font-semibold text-gray-800 mb-4">Pied de Page (Footer)</h4>
      <p className="text-sm text-gray-500 mb-6">Textes affichés en bas de chaque page</p>

      <div className="space-y-4">
        <Field
          label="Slogan / Tagline"
          value={data?.tagline}
          onChange={(v) => updateField('footer.tagline', v)}
          textarea
          placeholder="L'excellence du cigare depuis 2003..."
        />
        <Field
          label="Mention légale"
          value={data?.legalNotice}
          onChange={(v) => updateField('footer.legalNotice', v)}
          placeholder="L'abus de tabac est dangereux pour la santé."
        />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, textarea = false, placeholder = '' }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {textarea ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border rounded-lg p-3 text-sm resize-y min-h-[100px] focus:ring-2 focus:ring-primary/20 focus:border-primary"
          placeholder={placeholder}
          rows={4}
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function LoginForm({ onLogin }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onLogin(password);
    setLoading(false);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
      <h3 className="font-bold text-amber-800 mb-2">Authentification requise</h3>
      <p className="text-sm text-amber-700 mb-4">
        Entrez le mot de passe CMS pour pouvoir modifier le contenu.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe CMS"
          className="flex-1 border rounded-lg p-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Connexion...' : 'Valider'}
        </button>
      </form>
    </div>
  );
}

function ImageUploader({ label, currentUrl, onImageChange, token }) {
  const [uploading, setUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const fileInputRef = React.useRef(null);

  const loadAssets = async () => {
    setLoadingAssets(true);
    try {
      const res = await fetch('/api/cms/assets');
      if (res.ok) {
        setAssets(await res.json());
      }
    } catch (err) {
      console.error('Error loading assets:', err);
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!token) {
      alert('Veuillez vous connecter avec le mot de passe CMS');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/cms/assets', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        onImageChange(data.url);
        setShowPicker(false);
      } else {
        const err = await res.json();
        alert(err.error || 'Erreur lors de l\'upload');
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const selectAsset = (url) => {
    onImageChange(url);
    setShowPicker(false);
  };

  const removeImage = () => {
    onImageChange('');
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      
      {currentUrl ? (
        <div className="relative inline-block">
          <img 
            src={currentUrl} 
            alt="Preview" 
            className="w-full max-w-md h-32 object-cover rounded-lg border"
          />
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={() => { loadAssets(); setShowPicker(true); }}
              className="p-1.5 bg-white rounded-lg shadow hover:bg-gray-50"
              title="Changer l'image"
            >
              <Upload size={16} />
            </button>
            <button
              onClick={removeImage}
              className="p-1.5 bg-white rounded-lg shadow hover:bg-red-50 text-red-500"
              title="Supprimer l'image"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { loadAssets(); setShowPicker(true); }}
          className="w-full max-w-md h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <Upload size={24} className="text-gray-400" />
          <span className="text-sm text-gray-500">Ajouter une image</span>
        </button>
      )}

      {showPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-lg">Sélectionner une image</h3>
              <button 
                onClick={() => setShowPicker(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-4 border-b">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full py-3 border-2 border-dashed border-primary rounded-lg text-primary hover:bg-primary/5 flex items-center justify-center gap-2 font-medium"
              >
                {uploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Upload en cours...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Uploader une nouvelle image
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                JPG, PNG, WebP ou GIF - Max 5 Mo
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <h4 className="text-sm font-medium text-gray-600 mb-3">Images existantes</h4>
              {loadingAssets ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-gray-400" />
                </div>
              ) : assets.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Aucune image uploadée</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {assets.map((asset) => (
                    <button
                      key={asset.filename}
                      onClick={() => selectAsset(asset.url)}
                      className={`relative aspect-video rounded-lg overflow-hidden border-2 hover:border-primary transition-colors ${
                        currentUrl === asset.url ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200'
                      }`}
                    >
                      <img 
                        src={asset.url} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                      {currentUrl === asset.url && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <CheckCircle className="text-primary" size={24} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderLogoEditor({ data, updateField, token }) {
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <h4 className="font-semibold text-gray-800 mb-4">Logo du Site</h4>
      <p className="text-sm text-gray-500 mb-6">
        Uploadez votre logo pour remplacer le texte "CITI CIGARS" dans le header. 
        L'image s'adaptera automatiquement à la hauteur de la barre de navigation.
      </p>

      <div className="space-y-4">
        <ImageUploader
          label="Image du Logo"
          currentUrl={data?.url}
          onImageChange={(url) => updateField('header.logo.url', url)}
          token={token}
        />

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Texte alternatif (accessibilité)"
            value={data?.alt}
            onChange={(v) => updateField('header.logo.alt', v)}
            placeholder="CitiCigars"
          />
          <Field
            label="Lien du logo"
            value={data?.href}
            onChange={(v) => updateField('header.logo.href', v)}
            placeholder="/"
          />
        </div>

        {data?.url && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">Aperçu dans le header :</p>
            <div className="flex items-center gap-2 h-12 bg-white border rounded px-4">
              <img 
                src={data.url} 
                alt={data?.alt || 'Logo'} 
                className="h-full max-h-10 object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HeaderMenuEditor({ menuItems, updateField, setContent }) {
  const addMenuItem = () => {
    setContent(prev => ({
      ...prev,
      header: {
        ...prev.header,
        menuItems: [
          ...prev.header.menuItems,
          { label: 'NOUVEAU', href: '/', highlight: false, icon: '' }
        ]
      }
    }));
  };

  const removeMenuItem = (index) => {
    if (menuItems.length <= 1) {
      return;
    }
    setContent(prev => ({
      ...prev,
      header: {
        ...prev.header,
        menuItems: prev.header.menuItems.filter((_, i) => i !== index)
      }
    }));
  };

  const moveMenuItem = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= menuItems.length) return;
    
    setContent(prev => {
      const items = [...prev.header.menuItems];
      [items[index], items[newIndex]] = [items[newIndex], items[index]];
      return {
        ...prev,
        header: {
          ...prev.header,
          menuItems: items
        }
      };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-semibold text-gray-800">Menu de Navigation</h4>
          <p className="text-sm text-gray-500">
            Gérez les liens du menu principal. Utilisez les flèches pour réorganiser l'ordre.
          </p>
        </div>
        <button
          onClick={addMenuItem}
          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> Ajouter un lien
        </button>
      </div>

      <div className="space-y-3">
        {menuItems.map((item, index) => (
          <div 
            key={index} 
            className="bg-white border rounded-lg p-4 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => moveMenuItem(index, 'up')}
                  disabled={index === 0}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Monter"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  onClick={() => moveMenuItem(index, 'down')}
                  disabled={index === menuItems.length - 1}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Descendre"
                >
                  <ArrowDown size={16} />
                </button>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-4">
                <Field
                  label="Libellé (en majuscules)"
                  value={item.label}
                  onChange={(v) => updateField(`header.menuItems[${index}].label`, v)}
                  placeholder="ACCUEIL"
                />
                <Field
                  label="URL / Lien"
                  value={item.href}
                  onChange={(v) => updateField(`header.menuItems[${index}].href`, v)}
                  placeholder="/"
                />
                <Field
                  label="Icône / Emoji (optionnel)"
                  value={item.icon}
                  onChange={(v) => updateField(`header.menuItems[${index}].icon`, v)}
                  placeholder="🎁"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Style</label>
                  <label className="flex items-center gap-2 cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      checked={item.highlight || false}
                      onChange={(e) => updateField(`header.menuItems[${index}].highlight`, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm">Mettre en surbrillance (orange)</span>
                  </label>
                </div>
              </div>

              <button
                onClick={() => removeMenuItem(index)}
                disabled={menuItems.length <= 1}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Supprimer"
              >
                <Trash2 size={18} />
              </button>
            </div>

            {item.highlight && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-amber-600 font-bold">
                    {item.icon} {item.label}
                  </span>
                  <span className="text-gray-400">← Aperçu du style surbrillance</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
