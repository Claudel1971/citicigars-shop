import React, { createContext, useContext, useState } from 'react';

const ConfigContext = createContext();

export const useConfig = () => useContext(ConfigContext);

export const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState({
    phoneNumber: "22507070707",
    // NOUVEAU: Member status
    isMember: false,
    colors: {
      primary: "#2C1810",
      secondary: "#D4AF37",
      accent: "#F5F5DC"
    },
    fonts: {
      heading: "Playfair Display",
      body: "Inter"
    },
    // NOUVEAU: Configuration packs
    packDefaut: {
      ring54AndLess: 5,  // Ring ≤ 54 → pack de X cigares
      ring55AndMore: 4   // Ring > 54 → pack de X cigares
    }
  });

  const updateConfig = (newConfig, merge = true) => {
    if (merge) {
        setConfig(prev => ({ ...prev, ...newConfig }));
    } else {
        setConfig(newConfig);
    }
  };
  
  const toggleMemberStatus = () => {
    setConfig(prev => ({ ...prev, isMember: !prev.isMember }));
  };

  return (
    <ConfigContext.Provider value={{ config, updateConfig, toggleMemberStatus }}>
      {children}
    </ConfigContext.Provider>
  );
};
