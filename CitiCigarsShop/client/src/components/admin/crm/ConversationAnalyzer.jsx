import React, { useState } from 'react';
import { crmFetch } from './crmApi';

const ConfidenceBadge = ({ level }) => {
  const colors = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-red-100 text-red-700',
  };

  if (!level) return null;

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[level] || 'bg-gray-100 text-gray-600'}`}>
      {level}
    </span>
  );
};

const AiField = ({ label, field, value, onChange }) => (
  <div className="border-t py-2">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <ConfidenceBadge level={field?.confidence} />
    </div>
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="border rounded-md px-2 py-1 w-full text-sm"
    />
    {field?.sourceExcerpt && (
      <p className="text-xs text-gray-400 italic mt-1">« {field.sourceExcerpt} »</p>
    )}
  </div>
);

const ConversationAnalyzer = () => {
  const [rawText, setRawText] = useState('');
  const [proposal, setProposal] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const [edited, setEdited] = useState({});
  // Généré une seule fois par proposition analysée, réutilisé tel quel par
  // /validate — clé d'idempotence côté serveur (customer_interactions.source_request_id) :
  // un second clic sur "Valider" avec ce même id ne crée jamais une seconde
  // ligne, même après un succès déjà enregistré.
  const [clientRequestId, setClientRequestId] = useState(null);

  const analyze = async () => {
    if (!rawText.trim()) return;

    setAnalyzing(true);
    setError(null);
    setProposal(null);
    setResult(null);

    try {
      const res = await crmFetch('/api/crm/analyze-conversation', {
        method: 'POST',
        body: JSON.stringify({ rawText }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Analyse impossible');
      }

      const data = await res.json();

      setProposal(data);
      setClientRequestId(crypto.randomUUID());
      setEdited({
        firstName: data.suggestedFirstName?.value || '',
        lastName: data.suggestedLastName?.value || '',
        phone: data.suggestedPhone?.value || '',
        customerType: data.suggestedCustomerType?.value || 'B2C',
        companyName: '',
        jobTitle: '',
        summary: data.summary?.value || '',
        interest: data.interest?.value || '',
        nextAction: data.nextAction?.value || '',
        nextActionAt: data.nextActionAt?.value || '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const setField = (key, value) =>
    setEdited((current) => ({ ...current, [key]: value }));

  const validate = async () => {
    if (!proposal.matchedCustomerId && !edited.phone.trim()) {
      setError("Le numéro WhatsApp / téléphone est requis pour identifier un nouveau prospect.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const body = {
        clientRequestId,
        customerId: proposal.matchedCustomerId || undefined,

        newCustomer: proposal.matchedCustomerId
          ? undefined
          : {
              firstName: edited.firstName.trim() || null,
              lastName: edited.lastName.trim() || null,
              phoneWhatsapp: edited.phone.trim(),
              customerType: edited.customerType || 'B2C',
              companyName: edited.companyName.trim() || null,
              jobTitle: edited.jobTitle.trim() || null,
              status: 'PROSPECT',
              source: 'whatsapp_paste',
            },

        customerUpdates: proposal.matchedCustomerId
          ? {
              firstName: edited.firstName.trim() || undefined,
              lastName: edited.lastName.trim() || undefined,
              phoneWhatsapp: edited.phone.trim() || undefined,
              customerType: edited.customerType || undefined,
              companyName: edited.companyName.trim() || undefined,
              jobTitle: edited.jobTitle.trim() || undefined,
            }
          : undefined,

        interaction: {
          channel: 'whatsapp',
          interactionDate: new Date().toISOString(),
          direction: 'INBOUND',
          rawText,
          summary: edited.summary,
          interest: edited.interest || null,
          nextAction: edited.nextAction || null,
          nextActionAt: edited.nextActionAt || null,
        },

        followup:
          edited.nextAction && edited.nextActionAt
            ? {
                action: edited.nextAction,
                dueAt: edited.nextActionAt,
              }
            : undefined,
      };

      const res = await crmFetch('/api/crm/analyze-conversation/validate', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Échec de l'enregistrement");
      }

      setResult(await res.json());
      setProposal(null);
      setRawText('');
      setEdited({});
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-primary mb-1">
        Analyse WhatsApp
      </h1>

      <p className="text-sm text-gray-500 mb-4">
        L'IA propose une extraction. Rien n'est écrit dans le CRM tant que tu n'as pas validé.
      </p>

      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        rows={8}
        placeholder="Colle ici la conversation WhatsApp..."
        className="w-full border rounded-md p-3 text-sm mb-3"
      />

      <button
        onClick={analyze}
        disabled={analyzing || !rawText.trim()}
        className="bg-primary text-white px-4 py-2 rounded-md disabled:opacity-50"
      >
        {analyzing ? 'Analyse en cours...' : 'Analyser'}
      </button>

      {error && <p className="text-red-600 mt-3">{error}</p>}

      {result && (
        <p className="text-green-700 mt-3">
          {result.alreadyValidated ? 'Déjà enregistré' : '✓ Enregistré'} — client {result.customerId}
          {result.followup ? ' + relance créée' : ''}.
        </p>
      )}

      {proposal && (
        <div className="mt-4 space-y-4">
          <div className="bg-white border rounded-md p-4">
            <h2 className="font-semibold mb-1">Identifier le contact</h2>

            <p className="text-xs text-gray-500 mb-4">
              Le téléphone est la clé principale de rapprochement CRM.
            </p>

            {proposal.matchedCustomerId ? (
              <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                Client existant identifié par correspondance téléphonique exacte : {proposal.matchedCustomerId}
              </div>
            ) : (
              <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                Aucun téléphone correspondant dans le CRM. Un nouveau prospect sera créé après validation.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block mb-1 font-medium">Téléphone / WhatsApp *</span>
                <input
                  type="text"
                  value={edited.phone || ''}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="+237..."
                  className="w-full border rounded-md px-3 py-2"
                />
                <ConfidenceBadge level={proposal.suggestedPhone?.confidence} />
              </label>

              <label className="text-sm">
                <span className="block mb-1 font-medium">Type</span>
                <select
                  value={edited.customerType || 'B2C'}
                  onChange={(e) => setField('customerType', e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="B2C">B2C</option>
                  <option value="CORPORATE">B2B</option>
                  <option value="PARTNER">Partenaire</option>
                  <option value="OTHER">Autre</option>
                </select>
                <ConfidenceBadge level={proposal.suggestedCustomerType?.confidence} />
              </label>

              <label className="text-sm">
                <span className="block mb-1 font-medium">Prénom</span>
                <input
                  type="text"
                  value={edited.firstName || ''}
                  onChange={(e) => setField('firstName', e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                />
                <ConfidenceBadge level={proposal.suggestedFirstName?.confidence} />
              </label>

              <label className="text-sm">
                <span className="block mb-1 font-medium">Nom</span>
                <input
                  type="text"
                  value={edited.lastName || ''}
                  onChange={(e) => setField('lastName', e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                />
                <ConfidenceBadge level={proposal.suggestedLastName?.confidence} />
              </label>

              <label className="text-sm">
                <span className="block mb-1 font-medium">Entreprise</span>
                <input
                  type="text"
                  value={edited.companyName || ''}
                  onChange={(e) => setField('companyName', e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1 font-medium">Fonction</span>
                <input
                  type="text"
                  value={edited.jobTitle || ''}
                  onChange={(e) => setField('jobTitle', e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                />
              </label>
            </div>
          </div>

          <div className="bg-white border rounded-md p-4">
            <h2 className="font-semibold mb-2">Analyse de la conversation</h2>

            <AiField
              label="Résumé"
              field={proposal.summary}
              value={edited.summary}
              onChange={(v) => setField('summary', v)}
            />

            <AiField
              label="Intérêt"
              field={proposal.interest}
              value={edited.interest}
              onChange={(v) => setField('interest', v)}
            />

            <AiField
              label="Prochaine action"
              field={proposal.nextAction}
              value={edited.nextAction}
              onChange={(v) => setField('nextAction', v)}
            />

            <AiField
              label="Échéance"
              field={proposal.nextActionAt}
              value={edited.nextActionAt}
              onChange={(v) => setField('nextActionAt', v)}
            />

            <button
              onClick={validate}
              disabled={saving}
              className="mt-4 bg-green-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Valider et enregistrer dans le CRM'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationAnalyzer;
