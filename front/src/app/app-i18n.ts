export type UiLocale = 'en' | 'es';

export interface UiCopy {
  readonly app: {
    readonly title: string;
    readonly subtitle: string;
    readonly connected: string;
    readonly offline: string;
    readonly actions: string;
    readonly refresh: string;
    readonly noDescription: string;
    readonly noScanRecorded: string;
    readonly lastScan: (date: string) => string;
    readonly scanId: (id: number) => string;
    readonly projectSlug: (slug: string) => string;
  };
  readonly sidebar: {
    readonly newProject: string;
    readonly projects: string;
    readonly trackedProjects: (count: number) => string;
    readonly loadingProjects: string;
    readonly noProjectsTitle: string;
    readonly noProjectsBody: string;
    readonly workspace: string;
    readonly workspaceTools: string;
    readonly aiProvider: string;
    readonly aiProviderHelp: string;
    readonly savedLocally: string;
    readonly fromEnv: string;
    readonly language: string;
  };
  readonly project: {
    readonly mockup: string;
    readonly delete: string;
    readonly deleting: string;
    readonly demo: string;
    readonly loadingDetails: string;
    readonly copiedSlug: (slug: string) => string;
    readonly projectActions: string;
    readonly loadMockProject: string;
    readonly openSettings: string;
    readonly refreshData: string;
  };
  readonly review: {
    readonly modeLabel: string;
    readonly deterministic: string;
    readonly ai: string;
    readonly generating: string;
    readonly generateAiReview: string;
    readonly latestScanContext: string;
    readonly noRuleMatches: string;
    readonly ruleMatchesFound: string;
    readonly needsHumanReview: string;
    readonly noSuggestionsYet: string;
    readonly noAiReviewYet: string;
    readonly aiNotConfigured: string;
    readonly aiReviewFailed: string;
    readonly aiReviewAdvisory: string;
    readonly reviewContext: string;
    readonly sortChangedFiles: string;
    readonly sortConfidence: string;
    readonly lastAiCall: (label: string) => string;
    readonly confidenceAvg: string;
    readonly filesReviewed: string;
    readonly deterministicFindings: string;
    readonly aiSuggestions: string;
    readonly changes: (count: number) => string;
    readonly aiSuggestionsTitle: (count: number) => string;
  };
  readonly result: {
    readonly overview: string;
    readonly findings: string;
    readonly remediationGuidance: string;
    readonly noFindingsRecorded: string;
    readonly noRemediationGuidance: string;
    readonly reviewedProject: string;
    readonly securityScore: string;
    readonly projectDetails: string;
    readonly evidence: string;
    readonly fix: string;
    readonly noFindings: string;
    readonly scoreAria: (score: number) => string;
    readonly labels: {
      readonly clean: string;
      readonly lowRisk: string;
      readonly moderate: string;
      readonly highRisk: string;
      readonly security: string;
    };
    readonly summary: {
      readonly noFindings: string;
      readonly detected: (total: number, severity: string) => string;
    };
    readonly recommendation: {
      readonly noFindings: string;
      readonly clean: string;
      readonly lowRisk: string;
      readonly moderate: string;
      readonly highRisk: string;
      readonly fallback: string;
    };
  };
  readonly messages: {
    readonly projectCreated: (name: string) => string;
    readonly projectDeleted: (name: string) => string;
    readonly demoLocked: string;
    readonly demoLoaded: string;
    readonly demoLoadedPreview: string;
    readonly scanPayloadInvalid: string;
    readonly scanUploaded: (id: number, project: string) => string;
    readonly reportExported: (fileName: string) => string;
    readonly aiProviderSaved: (provider: string) => string;
    readonly aiKeyCleared: string;
    readonly aiReviewFallback: string;
    readonly aiReviewError: string;
  };
}

export function loadUiLocale(): UiLocale {
  try {
    const stored = window.localStorage.getItem('patchproof.locale');
    return stored === 'es' ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

export function saveUiLocale(locale: UiLocale): void {
  try {
    window.localStorage.setItem('patchproof.locale', locale);
  } catch {
    // ignore storage issues
  }
}

export function uiCopy(locale: UiLocale): UiCopy {
  return locale === 'es' ? esCopy : enCopy;
}

const enCopy: UiCopy = {
  app: {
    title: 'PatchProof',
    subtitle: 'Local scan review',
    connected: 'Connected',
    offline: 'Offline',
    actions: 'Actions',
    refresh: 'Refresh',
    noDescription: 'No description',
    noScanRecorded: 'No scan recorded yet',
    lastScan: (date) => `Last scan ${date}`,
    scanId: (id) => `Scan ID: #${id}`,
    projectSlug: (slug) => slug,
  },
  sidebar: {
    newProject: 'New project',
    projects: 'Projects',
    trackedProjects: (count) => `${count} tracked projects`,
    loadingProjects: 'Loading projects...',
    noProjectsTitle: 'No projects yet',
    noProjectsBody: 'Create a local project to start tracking scans.',
    workspace: 'Workspace',
    workspaceTools: 'Workspace tools',
    aiProvider: 'AI provider',
    aiProviderHelp: 'Set a provider once and reuse it for review + remediation.',
    savedLocally: 'Saved locally',
    fromEnv: 'From .env',
    language: 'Language',
  },
  project: {
    mockup: 'Mockup',
    delete: 'Delete',
    deleting: 'Deleting…',
    demo: 'Demo',
    loadingDetails: 'Loading project details...',
    copiedSlug: (slug) => `Copy project slug ${slug}`,
    projectActions: 'Project actions',
    loadMockProject: 'Load mock project',
    openSettings: 'Open settings',
    refreshData: 'Refresh data',
  },
  review: {
    modeLabel: 'Scan review mode',
    deterministic: 'Deterministic Scan',
    ai: 'AI Review Mode',
    generating: 'Generating…',
    generateAiReview: 'Generate AI review',
    latestScanContext: 'Latest scan context',
    noRuleMatches: 'No rule matches',
    ruleMatchesFound: 'Rule matches found',
    needsHumanReview: 'Needs human review',
    noSuggestionsYet: 'No suggestions yet',
    noAiReviewYet: 'No AI review yet',
    aiNotConfigured: 'AI not configured',
    aiReviewFailed: 'AI review failed',
    aiReviewAdvisory: 'Advisory notes only. Never blocks CI by default.',
    reviewContext: 'Review context',
    sortChangedFiles: 'Sort: Changed files',
    sortConfidence: 'Sort: Confidence',
    lastAiCall: (label) => `Last AI call · ${label}`,
    confidenceAvg: 'Confidence avg',
    filesReviewed: 'Files reviewed',
    deterministicFindings: 'Deterministic findings',
    aiSuggestions: 'AI suggestions',
    changes: (count) => `Changes (${count} files)`,
    aiSuggestionsTitle: (count) => `AI suggestions (${count})`,
  },
  result: {
    overview: 'Overview',
    findings: 'Findings',
    remediationGuidance: 'Remediation guidance',
    noFindingsRecorded: 'No findings recorded',
    noRemediationGuidance: 'No remediation guidance',
    reviewedProject: 'Reviewed project',
    securityScore: 'Security score',
    projectDetails: 'Project details',
    evidence: 'Evidence',
    fix: 'Fix',
    noFindings: 'No findings were recorded. Keep the clean baseline for future comparisons.',
    scoreAria: (score) => `Security score ${score} out of 100`,
    labels: {
      clean: 'Clean result',
      lowRisk: 'Low-risk result',
      moderate: 'Needs review',
      highRisk: 'High-risk result',
      security: 'Security result',
    },
    summary: {
      noFindings: 'No findings were recorded. Keep the clean baseline for future comparisons.',
      detected: (total, severity) => `Detected ${total} finding${total === 1 ? '' : 's'} with a ${severity} result.`,
    },
    recommendation: {
      noFindings: 'No immediate issues were found. Keep the clean result as a baseline and scan again after the next change.',
      clean: 'Treat this as a clean-ish result and review the report history after the next change.',
      lowRisk: 'Review the highlighted items and rerun the scan after the fixes land.',
      moderate: 'Prioritize the findings and verify the risky code paths before shipping.',
      highRisk: 'Address the findings before release and rerun the scan until the score improves.',
      fallback: 'Review the scan and compare it against the previous baseline.',
    },
  },
  messages: {
    projectCreated: (name) => `Project "${name}" created.`,
    projectDeleted: (name) => `Project "${name}" deleted.`,
    demoLocked: 'The demo project is mock data and cannot be deleted.',
    demoLoaded: 'Loaded the mock project with sample issues.',
    demoLoadedPreview: 'Loaded a local mock project with a dense issue set for previewing reports.',
    scanPayloadInvalid: 'The scan payload must be valid JSON.',
    scanUploaded: (id, project) => `Scan #${id} uploaded for ${project}.`,
    reportExported: (fileName) => `Report exported as ${fileName}.`,
    aiProviderSaved: (provider) => `AI provider saved: ${provider}.`,
    aiKeyCleared: 'Saved AI key cleared. Using .env or no-provider fallback now.',
    aiReviewFallback: 'Using deterministic fallback output.',
    aiReviewError: 'AI request failed.',
  },
};

const esCopy: UiCopy = {
  app: {
    title: 'PatchProof',
    subtitle: 'Revisión local de scans',
    connected: 'Conectado',
    offline: 'Sin conexión',
    actions: 'Acciones',
    refresh: 'Actualizar',
    noDescription: 'Sin descripción',
    noScanRecorded: 'Aún no hay ningún scan',
    lastScan: (date) => `Último scan ${date}`,
    scanId: (id) => `ID del scan: #${id}`,
    projectSlug: (slug) => slug,
  },
  sidebar: {
    newProject: 'Nuevo proyecto',
    projects: 'Proyectos',
    trackedProjects: (count) => `${count} proyecto${count === 1 ? '' : 's'} monitoreado${count === 1 ? '' : 's'}`,
    loadingProjects: 'Cargando proyectos...',
    noProjectsTitle: 'Aún no hay proyectos',
    noProjectsBody: 'Crea un proyecto local para empezar a registrar scans.',
    workspace: 'Espacio de trabajo',
    workspaceTools: 'Herramientas',
    aiProvider: 'Proveedor de IA',
    aiProviderHelp: 'Configura un proveedor una vez y reutilízalo para revisión y remediación.',
    savedLocally: 'Guardado localmente',
    fromEnv: 'Desde .env',
    language: 'Idioma',
  },
  project: {
    mockup: 'Demo',
    delete: 'Eliminar',
    deleting: 'Eliminando…',
    demo: 'Demo',
    loadingDetails: 'Cargando detalles del proyecto...',
    copiedSlug: (slug) => `Copiar slug del proyecto ${slug}`,
    projectActions: 'Acciones del proyecto',
    loadMockProject: 'Cargar proyecto demo',
    openSettings: 'Abrir ajustes',
    refreshData: 'Actualizar datos',
  },
  review: {
    modeLabel: 'Modo de revisión',
    deterministic: 'Scan determinístico',
    ai: 'Modo IA',
    generating: 'Generando…',
    generateAiReview: 'Generar revisión IA',
    latestScanContext: 'Contexto del último scan',
    noRuleMatches: 'Sin coincidencias',
    ruleMatchesFound: 'Coincidencias encontradas',
    needsHumanReview: 'Requiere revisión humana',
    noSuggestionsYet: 'Todavía no hay sugerencias',
    noAiReviewYet: 'Aún no hay revisión IA',
    aiNotConfigured: 'IA no configurada',
    aiReviewFailed: 'Falló la revisión IA',
    aiReviewAdvisory: 'Solo notas de apoyo. Nunca bloquea CI por defecto.',
    reviewContext: 'Contexto de revisión',
    sortChangedFiles: 'Orden: archivos cambiados',
    sortConfidence: 'Orden: confianza',
    lastAiCall: (label) => `Última llamada IA · ${label}`,
    confidenceAvg: 'Confianza promedio',
    filesReviewed: 'Archivos revisados',
    deterministicFindings: 'Hallazgos determinísticos',
    aiSuggestions: 'Sugerencias IA',
    changes: (count) => `Cambios (${count} archivos)`,
    aiSuggestionsTitle: (count) => `Sugerencias IA (${count})`,
  },
  result: {
    overview: 'Resumen',
    findings: 'Hallazgos',
    remediationGuidance: 'Guía de remediación',
    noFindingsRecorded: 'No se registraron hallazgos',
    noRemediationGuidance: 'Sin guía de remediación',
    reviewedProject: 'Proyecto revisado',
    securityScore: 'Puntuación de seguridad',
    projectDetails: 'Detalles del proyecto',
    evidence: 'Evidencia',
    fix: 'Corrección',
    noFindings: 'No se registraron hallazgos. Mantén la línea base limpia para futuras comparaciones.',
    scoreAria: (score) => `Puntuación de seguridad ${score} sobre 100`,
    labels: {
      clean: 'Resultado limpio',
      lowRisk: 'Resultado de bajo riesgo',
      moderate: 'Requiere revisión',
      highRisk: 'Resultado de alto riesgo',
      security: 'Resultado de seguridad',
    },
    summary: {
      noFindings: 'No se registraron hallazgos. Mantén la línea base limpia para futuras comparaciones.',
      detected: (total, severity) => `Detectados ${total} hallazgo${total === 1 ? '' : 's'} con un resultado ${severity}.`,
    },
    recommendation: {
      noFindings: 'No se detectaron problemas inmediatos. Conserva el resultado limpio como línea base y vuelve a escanear tras el próximo cambio.',
      clean: 'Trátalo como un resultado limpio y revisa el historial del reporte después del siguiente cambio.',
      lowRisk: 'Revisa los elementos resaltados y vuelve a ejecutar el scan después de corregirlos.',
      moderate: 'Prioriza los hallazgos y verifica las rutas de código riesgosas antes de publicar.',
      highRisk: 'Corrige los hallazgos antes de liberar y vuelve a ejecutar el scan hasta mejorar la puntuación.',
      fallback: 'Revisa el scan y compáralo con la línea base previa.',
    },
  },
  messages: {
    projectCreated: (name) => `Proyecto "${name}" creado.`,
    projectDeleted: (name) => `Proyecto "${name}" eliminado.`,
    demoLocked: 'El proyecto demo es una maqueta y no se puede eliminar.',
    demoLoaded: 'Se cargó el proyecto demo con ejemplos.',
    demoLoadedPreview: 'Se cargó un proyecto mock local con varios hallazgos para previsualizar reportes.',
    scanPayloadInvalid: 'El payload del scan debe ser JSON válido.',
    scanUploaded: (id, project) => `Scan #${id} subido para ${project}.`,
    reportExported: (fileName) => `Reporte exportado como ${fileName}.`,
    aiProviderSaved: (provider) => `Proveedor de IA guardado: ${provider}.`,
    aiKeyCleared: 'La llave de IA guardada fue borrada. Usando .env o fallback sin proveedor.',
    aiReviewFallback: 'Usando salida determinística de respaldo.',
    aiReviewError: 'Falló la solicitud de IA.',
  },
};
