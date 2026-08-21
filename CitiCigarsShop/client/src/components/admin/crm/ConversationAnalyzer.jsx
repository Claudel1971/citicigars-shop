import React, { useState } from 'react';
import { crmFetch } from './crmApi';

const ConfidenceBadge = ({ level }) => {
  const colors = { high: 'bg-green-100 text-green-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-red-100 text-red-700' };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${colors[level] || 'bg-gray-100 text-gray-600'}`}>{level}</span>;
};

const FieldRow = ({ label, field, onChange }) => {
  if (!field) return null;
  return (
    <div className="border-t py-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <ConfidenceBadge level={field.confidence} />
      </div>
      <input
        type="text"
        value={Array.isArray(field.value) ? field.value.join(', ') : field.value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded-md px-2 py-1 w-full text-sm"
      />
      {field.sourceExcerpt && <p className="text-xs text-gray-400 italic mt-1">« {field.sourceExcerpt} »</p>}
    </div>
  );
};

const ConversationAnalyzer = () => {
  const [rawText, setRawText] = useState('');
  const [proposal, setProposal] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Editable copies — the human can correct anything before validating.
  const [edited, setEdited] = useState({});

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
      setEdited({
        firstName: data.suggestedFirstName?.value || '',
        phone: data.suggestedPhone?.value || '',
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

  const validate = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        customerId: proposal.matchedCustomerId || undefined,
        newCustomer: proposal.matchedCustomerId
          ? undefined
          : {
              firstName: edited.firstName || null,
              phoneWhatsapp: edited.phone || null,
              status: 'PROSPECT',
              source: 'whatsapp_paste',
            },
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
            ? { action: edited.nextAction, dueAt: edited.nextActionAt }
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
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-primary mb-1">Analyse WhatsApp</h1>
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
          ✓ Enregistré — client {result.customerId}
          {result.followup ? ' + relance créée' : ''}.
        </p>
      )}

      {proposal && (
        <div className="bg-white border rounded-md p-4 mt-4">
          <div className="mb-3 text-sm">
            {proposal.matchedCustomerId ? (
              <span className="text-green-700">
                Client existant rattaché ({proposal.matchedCustomerId}), correspondance téléphone exacte.
              </span>
            ) : (
              <span className="text-amber-700">Aucune correspondance exacte — un nouveau prospect sera créé.</span>
            )}
          </div>

          <FieldRow label="Prénom" field={proposal.suggestedFirstName} onChange={(v) => setEdited((s) => ({ ...s, firstName: v }))} />
          <FieldRow label="Téléphone" field={proposal.suggestedPhone} onChange={(v) => setEdited((s) => ({ ...s, phone: v }))} />
          <FieldRow label="Résumé" field={proposal.summary} onChange={(v) => setEdited((s) => ({ ...s, summary: v }))} />
          <FieldRow label="Intérêt" field={proposal.interest} onChange={(v) => setEdited((s) => ({ ...s, interest: v }))} />
          <FieldRow label="Prochaine action" field={proposal.nextAction} onChange={(v) => setEdited((s) => ({ ...s, nextAction: v }))} />
          <FieldRow label="Échéance" field={proposal.nextActionAt} onChange={(v) => setEdited((s) => ({ ...s, nextActionAt: v }))} />

          <button
            onClick={validate}
            disabled={saving}
            className="mt-4 bg-green-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Valider et enregistrer dans le CRM'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ConversationAnalyzer;
