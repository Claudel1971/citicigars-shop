import React from 'react';
import { useConfig } from '@/context/ConfigContext';

const PackConfig = () => {
  const { config, updateConfig } = useConfig();

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">📦 Configuration des Packs</h3>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-blue-800 mb-3">
          <strong>Règle automatique actuelle :</strong>
        </p>
        <p className="text-sm text-blue-700">
          • Ring ≤ 54 → Pack de <strong>{config.packDefaut.ring54AndLess}</strong> cigares
        </p>
        <p className="text-sm text-blue-700">
          • Ring &gt; 54 → Pack de <strong>{config.packDefaut.ring55AndMore}</strong> cigares
        </p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre de cigares pour Ring ≤ 54
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={config.packDefaut.ring54AndLess}
            onChange={(e) => updateConfig({
              packDefaut: {
                ...config.packDefaut,
                ring54AndLess: parseInt(e.target.value)
              }
            })}
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre de cigares pour Ring &gt; 54
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={config.packDefaut.ring55AndMore}
            onChange={(e) => updateConfig({
              packDefaut: {
                ...config.packDefaut,
                ring55AndMore: parseInt(e.target.value)
              }
            })}
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>
      </div>
      
      <p className="text-xs text-gray-500 mt-3">
        💡 Ces valeurs s'appliquent automatiquement lors de l'import Excel
      </p>
    </div>
  );
};

export default PackConfig;
