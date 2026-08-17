(function configureCitiCigarsDnaRuntime(window) {
  const current = window.CITICIGARS_RUNTIME_CONFIG || {};
  if (current.API_BASE) {
    window.CITICIGARS_RUNTIME_CONFIG = {
      ...current,
      DNA_PILOT_MODE: current.DNA_PILOT_MODE === true,
    };
    return;
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (localHosts.has(window.location.hostname)) {
    window.CITICIGARS_RUNTIME_CONFIG = {
      ...current,
      API_BASE: `http://${window.location.hostname}:5000/api`,
      DNA_PILOT_MODE: current.DNA_PILOT_MODE === true,
    };
    return;
  }

  // Fail closed outside local development. The WHC staging and production
  // deployments replace this public runtime file with the matching Render
  // API_BASE before publishing the HTML. No production URL is a fallback.
  window.CITICIGARS_RUNTIME_CONFIG = {
    ...current,
    DNA_PILOT_MODE: current.DNA_PILOT_MODE === true,
  };
})(window);
