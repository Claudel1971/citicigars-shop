import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { crmFetch } from "./crmApi";
export default function InlineCustomerField({
  customer,
  field,
  label,
  onSaved,
  options,
}) {
  const [editing, setEditing] = useState(false),
    [value, setValue] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const r = await crmFetch(`/api/crm/customers/${customer.customerId}`, {
        method: "PUT",
        body: JSON.stringify({ [field]: value.trim() || null }),
      });
      if (!r.ok) throw new Error("Enregistrement impossible");
      const updated = await r.json();
      onSaved(updated);
      setEditing(false);
      setMessage("Enregistré");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded border bg-white p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      {editing ? (
        <form onSubmit={save} className="mt-2 flex flex-wrap gap-2">
          {options ? (
            <select
              aria-label={label}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="rounded border p-2"
            >
              {options.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          ) : (
            <input
              aria-label={label}
              value={value}
              maxLength={field === "email" ? 255 : 100}
              onChange={(e) => setValue(e.target.value)}
              className="rounded border p-2"
            />
          )}
          <button disabled={busy} className="text-primary">
            Enregistrer
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setEditing(false);
              setMessage("");
            }}
          >
            Annuler
          </button>
        </form>
      ) : (
        <div className="flex justify-between gap-2">
          <span>{customer[field] || "Non renseigné"}</span>
          {!customer.isInternal && (
            <button
              aria-label={`Modifier ${label}`}
              onClick={() => {
                setValue(customer[field] || "");
                setEditing(true);
                setMessage("");
              }}
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
      )}
      <p role="status" className="text-xs mt-1">
        {message}
      </p>
    </div>
  );
}
