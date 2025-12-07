import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

const API_BASE = '/api';

export default function ContentManager() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [token, setToken] = useState(() => sessionStorage.getItem('cms_token'));

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/content`);
      if (res.ok) {
        const data = await res.json();
        setContent(data);
      }
    } catch (err) {
      console.error('Error loading content:', err);
      setMessage({ type: 'error', text: 'Erreur lors du chargement du contenu' });
    } finally {
      setLoading(false);
    }
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
        setContent(data.content);
        setMessage({ type: 'success', text: 'Contenu enregistré avec succès !' });
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
          obj = obj[key];
        }
      }
      const lastKey = keys[keys.length - 1];
      obj[lastKey] = value;
      return newContent;
    });
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
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary">Gestion du Contenu</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Modifiez les textes du site sans toucher au code
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchContent}
            className="px-3 py-2 border rounded hover:bg-gray-50 flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw size={16} /> Recharger
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 flex items-center gap-2"
            disabled={saving}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Enregistrer
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg mb-6 flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {message.text}
        </div>
      )}

      {!token && (
        <LoginForm onLogin={handleLogin} />
      )}

      {content._meta?.lastUpdated && (
        <p className="text-xs text-muted-foreground mb-6">
          Dernière mise à jour : {new Date(content._meta.lastUpdated).toLocaleString('fr-FR')}
        </p>
      )}

      <div className="space-y-8">
        <Section title="Carousel Hero (Page d'accueil)">
          {content.home?.heroSlides?.map((slide, index) => (
            <div key={index} className="border rounded-lg p-4 mb-4 bg-gray-50">
              <h4 className="font-semibold text-sm mb-3 text-primary">Slide {index + 1}</h4>
              <div className="space-y-3">
                <Field
                  label="Titre"
                  value={slide.title}
                  onChange={(v) => updateField(`home.heroSlides[${index}].title`, v)}
                />
                <Field
                  label="Sous-titre"
                  value={slide.subtitle}
                  onChange={(v) => updateField(`home.heroSlides[${index}].subtitle`, v)}
                  textarea
                />
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="Texte du bouton"
                    value={slide.ctaText}
                    onChange={(v) => updateField(`home.heroSlides[${index}].ctaText`, v)}
                  />
                  <Field
                    label="Lien du bouton"
                    value={slide.ctaLink}
                    onChange={(v) => updateField(`home.heroSlides[${index}].ctaLink`, v)}
                  />
                </div>
              </div>
            </div>
          ))}
        </Section>

        <Section title="Section 'Notre Histoire' (Page d'accueil)">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Icône"
                value={content.home?.brandStory?.icon}
                onChange={(v) => updateField('home.brandStory.icon', v)}
              />
              <Field
                label="Titre"
                value={content.home?.brandStory?.title}
                onChange={(v) => updateField('home.brandStory.title', v)}
              />
            </div>
            <Field
              label="Texte"
              value={content.home?.brandStory?.text}
              onChange={(v) => updateField('home.brandStory.text', v)}
              textarea
            />
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Texte du bouton"
                value={content.home?.brandStory?.ctaText}
                onChange={(v) => updateField('home.brandStory.ctaText', v)}
              />
              <Field
                label="Lien du bouton"
                value={content.home?.brandStory?.ctaLink}
                onChange={(v) => updateField('home.brandStory.ctaLink', v)}
              />
            </div>
          </div>
        </Section>

        <Section title="Footer">
          <div className="space-y-4">
            <Field
              label="Slogan / Tagline"
              value={content.footer?.tagline}
              onChange={(v) => updateField('footer.tagline', v)}
              textarea
            />
            <Field
              label="Mention légale"
              value={content.footer?.legalNotice}
              onChange={(v) => updateField('footer.legalNotice', v)}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-bold text-primary mb-4 border-b pb-2">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, textarea = false }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {textarea ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border rounded-md p-2 text-sm resize-y min-h-[80px]"
          rows={3}
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border rounded-md p-2 text-sm"
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
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
      <h3 className="font-bold text-amber-800 mb-2">Authentification CMS requise</h3>
      <p className="text-sm text-amber-700 mb-4">
        Entrez le mot de passe CMS pour pouvoir modifier le contenu.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe CMS"
          className="flex-1 border rounded p-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
        >
          {loading ? 'Connexion...' : 'Valider'}
        </button>
      </form>
    </div>
  );
}
