export const t = {
  nav: {
    dashboard: 'Dashboard',
    clients: 'Clienti',
    tasks: 'Note',
    services: 'Servizi',
    settings: 'Impostazioni',
  },
  clients: {
    title: 'Clienti',
    add: 'Aggiungi cliente',
    empty: 'Ancora nessun cliente.',
    fields: {
      name: 'Nome',
      email: 'Email',
      phone: 'Telefono',
      notes: 'Note',
      tags: 'Tag',
    },
  },
  services: {
    title: 'Servizi',
    add: 'Aggiungi servizio',
    fields: {
      name: 'Cosa stai monitorando?',
      url: 'Indirizzo (URL)',
      client: 'Cliente',
    },
    status: {
      up: 'Tutto a posto',
      down: 'Giù',
      unknown: 'In attesa…',
    },
  },
  tasks: {
    title: 'Note',
    placeholder: 'Cosa devi fare?',
    empty: 'La lavagna è vuota.',
    confirmDelete: 'Eliminare questa nota?',
  },
  incidents: {
    title: 'Incidenti',
    empty: 'Nessun incidente.',
  },
  common: {
    save: 'Salva',
    cancel: 'Annulla',
    delete: 'Elimina',
    edit: 'Modifica',
    search: 'Cerca…',
    logout: 'Disconnetti',
    changeTheme: 'Cambia tema',
    loading: 'Un attimo…',
    error: 'Non sono riuscito a salvare. Riprova.',
    saved: 'Salvato',
  },
} as const
