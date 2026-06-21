// EduManage — Translation strings for all supported languages

export type LanguageCode = 'en' | 'sw' | 'fr' | 'ar' | 'es';

export interface TranslationTree {
  common: {
    welcome: string;
    loading: string;
    error: string;
    success: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    search: string;
    filter: string;
    close: string;
    back: string;
    next: string;
    previous: string;
    confirm: string;
    yes: string;
    no: string;
    all: string;
    none: string;
    actions: string;
    status: string;
    date: string;
    time: string;
    name: string;
    email: string;
    phone: string;
    password: string;
    logout: string;
    settings: string;
    profile: string;
    notifications: string;
    no_data: string;
    no_results: string;
    retry: string;
    required: string;
    optional: string;
  };
  auth: {
    login: string;
    register: string;
    sign_in: string;
    sign_up: string;
    sign_out: string;
    forgot_password: string;
    reset_password: string;
    verify_email: string;
    mfa_challenge: string;
    mfa_code: string;
    mfa_enter_code: string;
    remember_me: string;
    new_here: string;
    already_have_account: string;
    welcome_back: string;
    create_account: string;
    full_name: string;
    school_name: string;
    subdomain: string;
    confirm_password: string;
    password_min: string;
    invalid_email: string;
    invalid_credentials: string;
    account_locked: string;
    reset_link_sent: string;
    email_verified: string;
    mfa_enabled: string;
    mfa_disabled: string;
  };
  roles: {
    platform_admin: string;
    school_owner: string;
    principal: string;
    deputy_principal: string;
    administrator: string;
    teacher: string;
    student: string;
    parent: string;
    secretary: string;
    bursar: string;
    librarian: string;
    nurse: string;
    ict_manager: string;
    driver: string;
    groundskeeper: string;
    counselor: string;
    boarding_master: string;
    boarding_mistress: string;
  };
  nav: {
    dashboard: string;
    students: string;
    teachers: string;
    staff: string;
    classes: string;
    finance: string;
    attendance: string;
    grades: string;
    assignments: string;
    exams: string;
    timetable: string;
    messages: string;
    announcements: string;
    events: string;
    library: string;
    medical: string;
    transport: string;
    boarding: string;
    hr: string;
    payroll: string;
    leave: string;
    analytics: string;
    settings: string;
    users: string;
    logs: string;
    audit: string;
    domains: string;
    subscription: string;
    invitations: string;
    visitors: string;
    ai_assistant: string;
    search: string;
  };
  finance: {
    fees: string;
    invoices: string;
    payments: string;
    receipts: string;
    scholarships: string;
    fines: string;
    reports: string;
    invoice_number: string;
    payment_method: string;
    amount_due: string;
    amount_paid: string;
    balance: string;
    status_paid: string;
    status_unpaid: string;
    status_partial: string;
    status_overdue: string;
    record_payment: string;
    generate_report: string;
    total_billed: string;
    total_collected: string;
    total_outstanding: string;
    payment_mpesa: string;
    payment_cash: string;
    payment_cheque: string;
    payment_bank: string;
    payment_stripe: string;
    payment_paypal: string;
    payment_airtel: string;
  };
  students: {
    admission_number: string;
    full_name: string;
    class: string;
    stream: string;
    guardian: string;
    enroll: string;
    transfer: string;
    graduate: string;
    suspend: string;
    status_active: string;
    status_suspended: string;
    status_graduated: string;
    status_transferred: string;
  };
  academics: {
    academic_year: string;
    term: string;
    subject: string;
    exam: string;
    report_card: string;
    transcript: string;
    promote: string;
    score: string;
    grade: string;
    position: string;
    average: string;
  };
  ai: {
    chat: string;
    assignment_generator: string;
    grading: string;
    lesson_planner: string;
    quiz_generator: string;
    student_tutor: string;
    admin_analytics: string;
    principal_insights: string;
    usage_limit: string;
    tokens_used: string;
    powered_by: string;
  };
  notifications: {
    mark_all_read: string;
    unread: string;
    announcements: string;
    messages: string;
    finance: string;
    attendance: string;
    alerts: string;
  };
  settings: {
    language: string;
    theme: string;
    dark_mode: string;
    light_mode: string;
    account: string;
    security: string;
    devices: string;
    preferences: string;
    help: string;
    documentation: string;
    contact_support: string;
    about: string;
    version: string;
    terms: string;
    privacy: string;
  };
  multi_tenant: {
    school: string;
    school_id: string;
    tenant: string;
    access_denied: string;
    cross_tenant_blocked: string;
    subdomain: string;
    custom_domain: string;
    verify_domain: string;
  };
}

export const translations: Record<LanguageCode, TranslationTree> = {
  en: {
    common: {
      welcome: 'Welcome',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      search: 'Search',
      filter: 'Filter',
      close: 'Close',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      confirm: 'Confirm',
      yes: 'Yes',
      no: 'No',
      all: 'All',
      none: 'None',
      actions: 'Actions',
      status: 'Status',
      date: 'Date',
      time: 'Time',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      password: 'Password',
      logout: 'Sign Out',
      settings: 'Settings',
      profile: 'Profile',
      notifications: 'Notifications',
      no_data: 'No data available',
      no_results: 'No results found',
      retry: 'Retry',
      required: 'Required',
      optional: 'Optional',
    },
    auth: {
      login: 'Login',
      register: 'Register',
      sign_in: 'Sign In',
      sign_up: 'Sign Up',
      sign_out: 'Sign Out',
      forgot_password: 'Forgot Password?',
      reset_password: 'Reset Password',
      verify_email: 'Verify Email',
      mfa_challenge: 'Two-Factor Authentication',
      mfa_code: '6-digit code',
      mfa_enter_code: 'Enter the 6-digit code from your authenticator app',
      remember_me: 'Keep me signed in',
      new_here: 'New school?',
      already_have_account: 'Already have an account?',
      welcome_back: 'Welcome Back',
      create_account: 'Create School & Start Trial',
      full_name: 'Full Name',
      school_name: 'School Name',
      subdomain: 'Subdomain',
      confirm_password: 'Confirm Password',
      password_min: 'Min 8 chars, 1 upper, 1 lower, 1 number',
      invalid_email: 'Please enter a valid email address',
      invalid_credentials: 'Invalid email or password',
      account_locked: 'Account temporarily locked due to too many failed attempts',
      reset_link_sent: 'Reset link sent! Check your email',
      email_verified: 'Email verified successfully',
      mfa_enabled: 'MFA enabled successfully',
      mfa_disabled: 'MFA disabled',
    },
    roles: {
      platform_admin: 'Platform Admin',
      school_owner: 'School Owner',
      principal: 'Principal',
      deputy_principal: 'Deputy Principal',
      administrator: 'Administrator',
      teacher: 'Teacher',
      student: 'Student',
      parent: 'Parent',
      secretary: 'Secretary',
      bursar: 'Bursar',
      librarian: 'Librarian',
      nurse: 'Nurse',
      ict_manager: 'ICT Manager',
      driver: 'Driver',
      groundskeeper: 'Groundskeeper',
      counselor: 'Counselor',
      boarding_master: 'Boarding Master',
      boarding_mistress: 'Boarding Mistress',
    },
    nav: {
      dashboard: 'Dashboard', students: 'Students', teachers: 'Teachers', staff: 'Staff',
      classes: 'Classes', finance: 'Finance', attendance: 'Attendance', grades: 'Grades',
      assignments: 'Assignments', exams: 'Exams', timetable: 'Timetable',
      messages: 'Messages', announcements: 'Announcements', events: 'Events',
      library: 'Library', medical: 'Medical', transport: 'Transport', boarding: 'Boarding',
      hr: 'HR', payroll: 'Payroll', leave: 'Leave', analytics: 'Analytics',
      settings: 'Settings', users: 'Users', logs: 'Logs', audit: 'Audit',
      domains: 'Domains', subscription: 'Subscription', invitations: 'Invitations',
      visitors: 'Visitors', ai_assistant: 'AI Assistant', search: 'Search',
    },
    finance: {
      fees: 'Fee Structures', invoices: 'Invoices', payments: 'Payments',
      receipts: 'Receipts', scholarships: 'Scholarships', fines: 'Fines',
      reports: 'Reports', invoice_number: 'Invoice Number',
      payment_method: 'Payment Method', amount_due: 'Amount Due',
      amount_paid: 'Amount Paid', balance: 'Balance',
      status_paid: 'Paid', status_unpaid: 'Unpaid', status_partial: 'Partial',
      status_overdue: 'Overdue', record_payment: 'Record Payment',
      generate_report: 'Generate Report', total_billed: 'Total Billed',
      total_collected: 'Total Collected', total_outstanding: 'Outstanding',
      payment_mpesa: 'M-Pesa', payment_cash: 'Cash', payment_cheque: 'Cheque',
      payment_bank: 'Bank Transfer', payment_stripe: 'Stripe',
      payment_paypal: 'PayPal', payment_airtel: 'Airtel Money',
    },
    students: {
      admission_number: 'Admission Number', full_name: 'Full Name',
      class: 'Class', stream: 'Stream', guardian: 'Guardian',
      enroll: 'Enroll', transfer: 'Transfer', graduate: 'Graduate',
      suspend: 'Suspend', status_active: 'Active', status_suspended: 'Suspended',
      status_graduated: 'Graduated', status_transferred: 'Transferred',
    },
    academics: {
      academic_year: 'Academic Year', term: 'Term', subject: 'Subject',
      exam: 'Exam', report_card: 'Report Card', transcript: 'Transcript',
      promote: 'Promote', score: 'Score', grade: 'Grade',
      position: 'Position', average: 'Average',
    },
    ai: {
      chat: 'Chat', assignment_generator: 'Assignment Generator',
      grading: 'Grading Assistant', lesson_planner: 'Lesson Planner',
      quiz_generator: 'Quiz Generator', student_tutor: 'AI Tutor',
      admin_analytics: 'Admin Analytics', principal_insights: 'Principal Insights',
      usage_limit: 'Usage Limit', tokens_used: 'Tokens Used',
      powered_by: 'Powered by EduManage AI',
    },
    notifications: {
      mark_all_read: 'Mark All Read', unread: 'Unread',
      announcements: 'Announcements', messages: 'Messages',
      finance: 'Finance', attendance: 'Attendance', alerts: 'Alerts',
    },
    settings: {
      language: 'Language', theme: 'Theme', dark_mode: 'Dark Mode',
      light_mode: 'Light Mode', account: 'Account', security: 'Security',
      devices: 'Devices', preferences: 'Preferences', help: 'Help & Support',
      documentation: 'Documentation', contact_support: 'Contact Support',
      about: 'About', version: 'Version', terms: 'Terms of Service',
      privacy: 'Privacy Policy',
    },
    multi_tenant: {
      school: 'School', school_id: 'School ID', tenant: 'Tenant',
      access_denied: 'Access Denied', cross_tenant_blocked: 'Cross-tenant access blocked',
      subdomain: 'Subdomain', custom_domain: 'Custom Domain',
      verify_domain: 'Verify Domain',
    },
  },

  sw: {
    common: {
      welcome: 'Karibu',
      loading: 'Inapakia...',
      error: 'Hitilafu',
      success: 'Mafanikio',
      save: 'Hifadhi',
      cancel: 'Ghairi',
      delete: 'Futa',
      edit: 'Hariri',
      add: 'Ongeza',
      search: 'Tafuta',
      filter: 'Chuja',
      close: 'Funga',
      back: 'Nyuma',
      next: 'Inayofuata',
      previous: 'Iliyotangulia',
      confirm: 'Thibitisha',
      yes: 'Ndiyo',
      no: 'Hapana',
      all: 'Zote',
      none: 'Hakuna',
      actions: 'Vitendo',
      status: 'Hali',
      date: 'Tarehe',
      time: 'Wakati',
      name: 'Jina',
      email: 'Barua pepe',
      phone: 'Simu',
      password: 'Nenosiri',
      logout: 'Toka',
      settings: 'Mipangilio',
      profile: 'Wasifu',
      notifications: 'Arifa',
      no_data: 'Hakuna data',
      no_results: 'Hakuna matokeo',
      retry: 'Jaribu tena',
      required: 'Inahitajika',
      optional: 'Si lazima',
    },
    auth: {
      login: 'Ingia',
      register: 'Jisajili',
      sign_in: 'Ingia',
      sign_up: 'Jisajili',
      sign_out: 'Toka',
      forgot_password: 'Umesahau nenosiri?',
      reset_password: 'Weka Nenosiri Jipya',
      verify_email: 'Thibitisha Barua pepe',
      mfa_challenge: 'Uthibitisho wa Hatua Mbili',
      mfa_code: 'Nambari ya tarakimu 6',
      mfa_enter_code: 'Ingiza nambari ya tarakimu 6 kutoka kwa programu yako',
      remember_me: 'Nikumbuke',
      new_here: 'Shule mpya?',
      already_have_account: 'Tayari una akaunti?',
      welcome_back: 'Karibu Tena',
      create_account: 'Unda Shule na Anza Kipindi cha Bure',
      full_name: 'Jina Kamili',
      school_name: 'Jina la Shule',
      subdomain: 'Subdomain',
      confirm_password: 'Thibitisha Nenosiri',
      password_min: 'Angalau herufi 8, 1 kubwa, 1 ndogo, 1 nambari',
      invalid_email: 'Tafadhali weka barua pepe halali',
      invalid_credentials: 'Barua pepe au nenosiri sio sahihi',
      account_locked: 'Akaunti imefungwa kwa muda kutokana na majaribio mengi yaliyoshindwa',
      reset_link_sent: 'Kiungo cha kubadilisha nimetumwa! Angalia barua pepe yako',
      email_verified: 'Barua pepe imethibitishwa',
      mfa_enabled: 'MFA imewashwa',
      mfa_disabled: 'MFA imezimwa',
    },
    roles: {
      platform_admin: 'Msimamizi wa Jukwaa',
      school_owner: 'Mmiliki wa Shule',
      principal: 'Mkuu wa Shule',
      deputy_principal: 'Naibu Mkuu',
      administrator: 'Msimamizi',
      teacher: 'Mwalimu',
      student: 'Mwanafunzi',
      parent: 'Mzazi',
      secretary: 'Katibu',
      bursar: 'Mhasibu',
      librarian: 'Mkuu wa Maktaba',
      nurse: 'Muuguzi',
      ict_manager: 'Meneja wa ICT',
      driver: 'Dereva',
      groundskeeper: 'Mlinzi wa Viwanja',
      counselor: 'Mshauri',
      boarding_master: 'Mkuu wa Bweni',
      boarding_mistress: 'Mke wa Mkuu wa Bweni',
    },
    nav: {
      dashboard: 'Dashibodi', students: 'Wanafunzi', teachers: 'Walimu',
      staff: 'Wafanyakazi', classes: 'Madarasa', finance: 'Fedha',
      attendance: 'Mahudhurio', grades: 'Alama', assignments: 'Kazi',
      exams: 'Mitihani', timetable: 'Ratiba', messages: 'Ujumbe',
      announcements: 'Matangazo', events: 'Matukio', library: 'Maktaba',
      medical: 'Matibabu', transport: 'Usafiri', boarding: 'Bweni',
      hr: 'HR', payroll: 'Mishahara', leave: 'Likizo', analytics: 'Uchanganuzi',
      settings: 'Mipangilio', users: 'Watumiaji', logs: 'Kumbukumbu',
      audit: 'Ukaguzi', domains: 'Domains', subscription: 'Usajili',
      invitations: 'Mialiko', visitors: 'Wageni',
      ai_assistant: 'Msaidizi wa AI', search: 'Tafuta',
    },
    finance: {
      fees: 'Muundo wa Ada', invoices: 'Ankara', payments: 'Malipo',
      receipts: 'Risiti', scholarships: 'Ufadhili', fines: 'Faini',
      reports: 'Ripoti', invoice_number: 'Nambari ya Ankara',
      payment_method: 'Njia ya Malipo', amount_due: 'Kiasi Kinachohitajika',
      amount_paid: 'Kiasi Kilicholipwa', balance: 'Salio',
      status_paid: 'Imelipwa', status_unpaid: 'Haijalipwa',
      status_partial: 'Sehemu', status_overdue: 'Imechelewa',
      record_payment: 'Rekodi Malipo', generate_report: 'Tengeneza Ripoti',
      total_billed: 'Juu ya Ankara', total_collected: 'Juu ya Malipo',
      total_outstanding: 'Bado Hajalipa',
      payment_mpesa: 'M-Pesa', payment_cash: 'Taslimu',
      payment_cheque: 'Cheque', payment_bank: 'Hamisha Benki',
      payment_stripe: 'Stripe', payment_paypal: 'PayPal',
      payment_airtel: 'Airtel Money',
    },
    students: {
      admission_number: 'Nambari ya Kuandikishwa', full_name: 'Jina Kamili',
      class: 'Darasa', stream: 'Toko', guardian: 'Mlezi',
      enroll: 'Andikisha', transfer: 'Hamisha', graduate: 'Hitimu',
      suspend: 'Sitisha', status_active: 'Ameshindwa',
      status_suspended: 'Amesitishwa', status_graduated: 'Amehitimu',
      status_transferred: 'Amehamishwa',
    },
    academics: {
      academic_year: 'Mwaka wa Masomo', term: 'Muhula', subject: 'Somo',
      exam: 'Mtihani', report_card: 'Kadi ya Ripoti', transcript: 'Karatas',
      promote: 'Pandisha', score: 'Alama', grade: 'Daraja',
      position: 'Nafasi', average: 'Wastani',
    },
    ai: {
      chat: 'Mazungumzo', assignment_generator: 'Kitengeneza Kazi',
      grading: 'Msaidizi wa Alama', lesson_planner: 'Mpangaji wa Somo',
      quiz_generator: 'Kitengeneza Quiz', student_tutor: 'Mwalimu wa AI',
      admin_analytics: 'Uchanganuzi wa Msimamizi',
      principal_insights: 'Maoni ya Mkuu',
      usage_limit: 'Kikomo cha Matumizi',
      tokens_used: 'Token Zilizotumika',
      powered_by: 'Inaendeshwa na EduManage AI',
    },
    notifications: {
      mark_all_read: 'Weka Zote Zimesomwa', unread: 'Haijasomwa',
      announcements: 'Matangazo', messages: 'Ujumbe',
      finance: 'Fedha', attendance: 'Mahudhurio', alerts: 'Arifa',
    },
    settings: {
      language: 'Lugha', theme: 'Mandhari', dark_mode: 'Modi ya Giza',
      light_mode: 'Modi ya Nuru', account: 'Akaunti', security: 'Usalama',
      devices: 'Vifaa', preferences: 'Mapendeleo', help: 'Msaada',
      documentation: 'Nyaraka', contact_support: 'Wasiliana nasi',
      about: 'Kuhusu', version: 'Toleo', terms: 'Masharti ya Huduma',
      privacy: 'Sera ya Faragha',
    },
    multi_tenant: {
      school: 'Shule', school_id: 'Kitambulisho cha Shule',
      tenant: 'Mpangaji', access_denied: 'Ufikiaji Umekataliwa',
      cross_tenant_blocked: 'Ufikiaji wa mpangaji mwingine umezuiwa',
      subdomain: 'Subdomain', custom_domain: 'Domain Maalum',
      verify_domain: 'Thibitisha Domain',
    },
  },

  fr: {
    common: {
      welcome: 'Bienvenue', loading: 'Chargement...', error: 'Erreur',
      success: 'Succès', save: 'Enregistrer', cancel: 'Annuler',
      delete: 'Supprimer', edit: 'Modifier', add: 'Ajouter',
      search: 'Rechercher', filter: 'Filtrer', close: 'Fermer',
      back: 'Retour', next: 'Suivant', previous: 'Précédent',
      confirm: 'Confirmer', yes: 'Oui', no: 'Non', all: 'Tous',
      none: 'Aucun', actions: 'Actions', status: 'Statut',
      date: 'Date', time: 'Heure', name: 'Nom', email: 'Email',
      phone: 'Téléphone', password: 'Mot de passe', logout: 'Déconnexion',
      settings: 'Paramètres', profile: 'Profil',
      notifications: 'Notifications', no_data: 'Aucune donnée',
      no_results: 'Aucun résultat', retry: 'Réessayer',
      required: 'Requis', optional: 'Optionnel',
    },
    auth: {
      login: 'Connexion', register: "S'inscrire", sign_in: 'Se connecter',
      sign_up: "S'inscrire", sign_out: 'Déconnexion',
      forgot_password: 'Mot de passe oublié?',
      reset_password: 'Réinitialiser le mot de passe',
      verify_email: 'Vérifier email',
      mfa_challenge: 'Authentification à deux facteurs',
      mfa_code: 'Code à 6 chiffres',
      mfa_enter_code: 'Entrez le code à 6 chiffres de votre application',
      remember_me: 'Rester connecté', new_here: 'Nouvelle école?',
      already_have_account: 'Vous avez déjà un compte?',
      welcome_back: 'Bon retour', create_account: 'Créer une école',
      full_name: 'Nom complet', school_name: "Nom de l'école",
      subdomain: 'Sous-domaine', confirm_password: 'Confirmer le mot de passe',
      password_min: 'Min 8 caractères, 1 maj, 1 min, 1 chiffre',
      invalid_email: 'Veuillez entrer un email valide',
      invalid_credentials: 'Email ou mot de passe invalide',
      account_locked: 'Compte verrouillé temporairement',
      reset_link_sent: 'Lien envoyé! Vérifiez votre email',
      email_verified: 'Email vérifié',
      mfa_enabled: 'MFA activé', mfa_disabled: 'MFA désactivé',
    },
    roles: {
      platform_admin: 'Admin Plateforme', school_owner: 'Propriétaire',
      principal: 'Directeur', deputy_principal: 'Directeur Adjoint',
      administrator: 'Administrateur', teacher: 'Enseignant',
      student: 'Étudiant', parent: 'Parent', secretary: 'Secrétaire',
      bursar: 'Comptable', librarian: 'Bibliothécaire', nurse: 'Infirmier',
      ict_manager: 'Manager ICT', driver: 'Chauffeur',
      groundskeeper: 'Gardien', counselor: 'Conseiller',
      boarding_master: 'Surveillant Internat',
      boarding_mistress: 'Surveillante Internat',
    },
    nav: {
      dashboard: 'Tableau de bord', students: 'Étudiants',
      teachers: 'Enseignants', staff: 'Personnel', classes: 'Classes',
      finance: 'Finances', attendance: 'Présence', grades: 'Notes',
      assignments: 'Devoirs', exams: 'Examens', timetable: 'Emploi du temps',
      messages: 'Messages', announcements: 'Annonces', events: 'Événements',
      library: 'Bibliothèque', medical: 'Médical', transport: 'Transport',
      boarding: 'Internat', hr: 'RH', payroll: 'Paie', leave: 'Congé',
      analytics: 'Analytique', settings: 'Paramètres', users: 'Utilisateurs',
      logs: 'Journaux', audit: 'Audit', domains: 'Domaines',
      subscription: 'Abonnement', invitations: 'Invitations',
      visitors: 'Visiteurs', ai_assistant: 'Assistant IA', search: 'Rechercher',
    },
    finance: {
      fees: 'Frais', invoices: 'Factures', payments: 'Paiements',
      receipts: 'Reçus', scholarships: 'Bourses', fines: 'Amendes',
      reports: 'Rapports', invoice_number: 'N° Facture',
      payment_method: 'Mode de paiement', amount_due: 'Montant dû',
      amount_paid: 'Montant payé', balance: 'Solde',
      status_paid: 'Payé', status_unpaid: 'Impayé', status_partial: 'Partiel',
      status_overdue: 'En retard', record_payment: 'Enregistrer paiement',
      generate_report: 'Générer rapport', total_billed: 'Total facturé',
      total_collected: 'Total perçu', total_outstanding: 'En attente',
      payment_mpesa: 'M-Pesa', payment_cash: 'Espèces',
      payment_cheque: 'Chèque', payment_bank: 'Virement',
      payment_stripe: 'Stripe', payment_paypal: 'PayPal',
      payment_airtel: 'Airtel Money',
    },
    students: {
      admission_number: "N° d'admission", full_name: 'Nom complet',
      class: 'Classe', stream: 'Flux', guardian: 'Tuteur',
      enroll: 'Inscrire', transfer: 'Transférer', graduate: 'Diplômer',
      suspend: 'Suspendre', status_active: 'Actif',
      status_suspended: 'Suspendu', status_graduated: 'Diplômé',
      status_transferred: 'Transféré',
    },
    academics: {
      academic_year: 'Année scolaire', term: 'Trimestre', subject: 'Matière',
      exam: 'Examen', report_card: 'Bulletin', transcript: 'Relevé de notes',
      promote: 'Promouvoir', score: 'Score', grade: 'Note',
      position: 'Rang', average: 'Moyenne',
    },
    ai: {
      chat: 'Chat', assignment_generator: 'Générateur de devoirs',
      grading: 'Assistant de notation', lesson_planner: 'Planificateur de leçon',
      quiz_generator: 'Générateur de quiz', student_tutor: 'Tuteur IA',
      admin_analytics: 'Analytique admin', principal_insights: 'Insights directeur',
      usage_limit: 'Limite d\'usage', tokens_used: 'Tokens utilisés',
      powered_by: 'Propulsé par EduManage AI',
    },
    notifications: {
      mark_all_read: 'Tout marquer lu', unread: 'Non lu',
      announcements: 'Annonces', messages: 'Messages',
      finance: 'Finances', attendance: 'Présence', alerts: 'Alertes',
    },
    settings: {
      language: 'Langue', theme: 'Thème', dark_mode: 'Mode sombre',
      light_mode: 'Mode clair', account: 'Compte', security: 'Sécurité',
      devices: 'Appareils', preferences: 'Préférences', help: 'Aide',
      documentation: 'Documentation', contact_support: 'Contacter le support',
      about: 'À propos', version: 'Version', terms: 'Conditions d\'utilisation',
      privacy: 'Politique de confidentialité',
    },
    multi_tenant: {
      school: 'École', school_id: 'ID École', tenant: 'Locataire',
      access_denied: 'Accès refusé',
      cross_tenant_blocked: 'Accès inter-locataire bloqué',
      subdomain: 'Sous-domaine', custom_domain: 'Domaine personnalisé',
      verify_domain: 'Vérifier domaine',
    },
  },

  ar: {
    common: {
      welcome: 'مرحبا', loading: 'جار التحميل...', error: 'خطأ',
      success: 'نجاح', save: 'حفظ', cancel: 'إلغاء', delete: 'حذف',
      edit: 'تحرير', add: 'إضافة', search: 'بحث', filter: 'تصفية',
      close: 'إغلاق', back: 'رجوع', next: 'التالي', previous: 'السابق',
      confirm: 'تأكيد', yes: 'نعم', no: 'لا', all: 'الكل',
      none: 'لا شيء', actions: 'إجراءات', status: 'الحالة',
      date: 'التاريخ', time: 'الوقت', name: 'الاسم',
      email: 'البريد الإلكتروني', phone: 'الهاتف', password: 'كلمة المرور',
      logout: 'تسجيل الخروج', settings: 'الإعدادات', profile: 'الملف الشخصي',
      notifications: 'الإشعارات', no_data: 'لا توجد بيانات',
      no_results: 'لا توجد نتائج', retry: 'إعادة المحاولة',
      required: 'مطلوب', optional: 'اختياري',
    },
    auth: {
      login: 'تسجيل الدخول', register: 'التسجيل',
      sign_in: 'تسجيل الدخول', sign_up: 'التسجيل',
      sign_out: 'تسجيل الخروج',
      forgot_password: 'نسيت كلمة المرور؟',
      reset_password: 'إعادة تعيين كلمة المرور',
      verify_email: 'تحقق من البريد الإلكتروني',
      mfa_challenge: 'المصادقة الثنائية',
      mfa_code: 'رمز من 6 أرقام',
      mfa_enter_code: 'أدخل الرمز من 6 أرقام من تطبيق المصادقة',
      remember_me: 'ابقني مسجل الدخول',
      new_here: 'مدرسة جديدة؟',
      already_have_account: 'لديك حساب بالفعل؟',
      welcome_back: 'مرحبا بعودتك',
      create_account: 'إنشاء مدرعة وبدء التجربة',
      full_name: 'الاسم الكامل', school_name: 'اسم المدرسة',
      subdomain: 'النطاق الفرعي',
      confirm_password: 'تأكيد كلمة المرور',
      password_min: '8 أحرف على الأقل، 1 كبير، 1 صغير، 1 رقم',
      invalid_email: 'يرجى إدخال بريد إلكتروني صحيح',
      invalid_credentials: 'بريد إلكتروني أو كلمة مرور غير صحيحة',
      account_locked: 'تم قفل الحساب مؤقتاً',
      reset_link_sent: 'تم إرسال الرابط! تحقق من بريدك',
      email_verified: 'تم التحقق من البريد',
      mfa_enabled: 'تم تفعيل MFA', mfa_disabled: 'تم تعطيل MFA',
    },
    roles: {
      platform_admin: 'مدير المنصة', school_owner: 'مالك المدرسة',
      principal: 'المدير', deputy_principal: 'نائب المدير',
      administrator: 'مسؤول', teacher: 'معلم', student: 'طالب',
      parent: 'ول الأمر', secretary: 'سكرتير', bursar: 'محاسب',
      librarian: 'أمين المكتبة', nurse: 'ممرض',
      ict_manager: 'مدير تقنية المعلومات', driver: 'سائق',
      groundskeeper: 'حارس الأرض', counselor: 'مرشد',
      boarding_master: 'مشرف السكن', boarding_mistress: 'مشرفة السكن',
    },
    nav: {
      dashboard: 'لوحة التحكم', students: 'الطلاب', teachers: 'المعلمون',
      staff: 'الموظفون', classes: 'الفصول', finance: 'المالية',
      attendance: 'الحضور', grades: 'الدرجات',
      assignments: 'الواجبات', exams: 'الامتحانات', timetable: 'الجدول',
      messages: 'الرسائل', announcements: 'الإعلانات', events: 'الأحداث',
      library: 'المكتبة', medical: 'طبي', transport: 'النقل',
      boarding: 'السكن', hr: 'الموارد البشرية', payroll: 'الرواتب',
      leave: 'الإجازة', analytics: 'التحليلات', settings: 'الإعدادات',
      users: 'المستخدمون', logs: 'السجلات', audit: 'التدقيق',
      domains: 'النطاقات', subscription: 'الاشتراك',
      invitations: 'الدعوات', visitors: 'الزوار',
      ai_assistant: 'مساعد الذكاء الاصطناعي', search: 'بحث',
    },
    finance: {
      fees: 'الرسوم', invoices: 'الفواتير', payments: 'المدفوعات',
      receipts: 'الإيصالات', scholarships: 'المنح', fines: 'الغرامات',
      reports: 'التقارير', invoice_number: 'رقم الفاتورة',
      payment_method: 'طريقة الدفع', amount_due: 'المبلغ المستحق',
      amount_paid: 'المبلغ المدفوع', balance: 'الرصيد',
      status_paid: 'مدفوع', status_unpaid: 'غير مدفوع',
      status_partial: 'جزئي', status_overdue: 'متأخر',
      record_payment: 'تسجيل دفعة', generate_report: 'إنشاء تقرير',
      total_billed: 'إجمالي الفواتير', total_collected: 'إجمالي المحصّل',
      total_outstanding: 'المتبقي',
      payment_mpesa: 'M-Pesa', payment_cash: 'نقداً',
      payment_cheque: 'شيك', payment_bank: 'تحويل بنكي',
      payment_stripe: 'Stripe', payment_paypal: 'PayPal',
      payment_airtel: 'Airtel Money',
    },
    students: {
      admission_number: 'رقم القبول', full_name: 'الاسم الكامل',
      class: 'الفصل', stream: 'الدفق', guardian: 'ولي الأمر',
      enroll: 'تسجيل', transfer: 'نقل', graduate: 'تخرج',
      suspend: 'إيقاف', status_active: 'نشط',
      status_suspended: 'موقوف', status_graduated: 'تخرج',
      status_transferred: 'منقول',
    },
    academics: {
      academic_year: 'السنة الدراسية', term: 'الفصل الدراسي',
      subject: 'المادة', exam: 'امتحان', report_card: 'بطاقة التقرير',
      transcript: 'كشف الدرجات', promote: 'ترقية', score: 'النتيجة',
      grade: 'التقدير', position: 'الترتيب', average: 'المعدل',
    },
    ai: {
      chat: 'محادثة', assignment_generator: 'مولد الواجبات',
      grading: 'مساعد التصحيح', lesson_planner: 'مخطط الدرس',
      quiz_generator: 'مولد الاختبارات', student_tutor: 'مدرس الذكاء',
      admin_analytics: 'تحليلات المسؤول',
      principal_insights: 'رؤى المدير',
      usage_limit: 'حد الاستخدام', tokens_used: 'الرموز المستخدمة',
      powered_by: 'مدعوم من EduManage AI',
    },
    notifications: {
      mark_all_read: 'تحديد الكل كمقروء', unread: 'غير مقروء',
      announcements: 'إعلانات', messages: 'رسائل',
      finance: 'مالية', attendance: 'حضور', alerts: 'تنبيهات',
    },
    settings: {
      language: 'اللغة', theme: 'السمة', dark_mode: 'الوضع الداكن',
      light_mode: 'الوضع الفاتح', account: 'الحساب', security: 'الأمان',
      devices: 'الأجهزة', preferences: 'التفضيلات', help: 'المساعدة',
      documentation: 'التوثيق', contact_support: 'اتصل بالدعم',
      about: 'حول', version: 'الإصدار', terms: 'شروط الخدمة',
      privacy: 'سياسة الخصوصية',
    },
    multi_tenant: {
      school: 'مدرسة', school_id: 'معرف المدرسة', tenant: 'مستأجر',
      access_denied: 'تم رفض الوصول',
      cross_tenant_blocked: 'تم حظر الوصول بين المستأجرين',
      subdomain: 'النطاق الفرعي', custom_domain: 'نطاق مخصص',
      verify_domain: 'تحقق من النطاق',
    },
  },

  es: {
    common: {
      welcome: 'Bienvenido', loading: 'Cargando...', error: 'Error',
      success: 'Éxito', save: 'Guardar', cancel: 'Cancelar',
      delete: 'Eliminar', edit: 'Editar', add: 'Añadir',
      search: 'Buscar', filter: 'Filtrar', close: 'Cerrar',
      back: 'Atrás', next: 'Siguiente', previous: 'Anterior',
      confirm: 'Confirmar', yes: 'Sí', no: 'No', all: 'Todos',
      none: 'Ninguno', actions: 'Acciones', status: 'Estado',
      date: 'Fecha', time: 'Hora', name: 'Nombre', email: 'Email',
      phone: 'Teléfono', password: 'Contraseña',
      logout: 'Cerrar sesión', settings: 'Configuración',
      profile: 'Perfil', notifications: 'Notificaciones',
      no_data: 'Sin datos', no_results: 'Sin resultados',
      retry: 'Reintentar', required: 'Requerido', optional: 'Opcional',
    },
    auth: {
      login: 'Iniciar sesión', register: 'Registrarse',
      sign_in: 'Iniciar sesión', sign_up: 'Registrarse',
      sign_out: 'Cerrar sesión',
      forgot_password: '¿Olvidó su contraseña?',
      reset_password: 'Restablecer contraseña',
      verify_email: 'Verificar email',
      mfa_challenge: 'Autenticación de dos factores',
      mfa_code: 'Código de 6 dígitos',
      mfa_enter_code: 'Ingrese el código de 6 dígitos de su aplicación',
      remember_me: 'Mantener sesión', new_here: '¿Nueva escuela?',
      already_have_account: '¿Ya tiene cuenta?',
      welcome_back: 'Bienvenido de nuevo',
      create_account: 'Crear escuela y comenzar prueba',
      full_name: 'Nombre completo', school_name: 'Nombre de la escuela',
      subdomain: 'Subdominio', confirm_password: 'Confirmar contraseña',
      password_min: 'Mín 8 caracteres, 1 mayús, 1 minús, 1 número',
      invalid_email: 'Ingrese un email válido',
      invalid_credentials: 'Email o contraseña inválidos',
      account_locked: 'Cuenta bloqueada temporalmente',
      reset_link_sent: '¡Enlace enviado! Revise su email',
      email_verified: 'Email verificado',
      mfa_enabled: 'MFA activado', mfa_disabled: 'MFA desactivado',
    },
    roles: {
      platform_admin: 'Admin de Plataforma', school_owner: 'Propietario',
      principal: 'Director', deputy_principal: 'Subdirector',
      administrator: 'Administrador', teacher: 'Profesor',
      student: 'Estudiante', parent: 'Padre', secretary: 'Secretario',
      bursar: 'Contador', librarian: 'Bibliotecario', nurse: 'Enfermero',
      ict_manager: 'Gerente TIC', driver: 'Conductor',
      groundskeeper: 'Jardínero', counselor: 'Consejero',
      boarding_master: 'Supervisor Internado',
      boarding_mistress: 'Supervisora Internado',
    },
    nav: {
      dashboard: 'Panel', students: 'Estudiantes', teachers: 'Profesores',
      staff: 'Personal', classes: 'Clases', finance: 'Finanzas',
      attendance: 'Asistencia', grades: 'Notas',
      assignments: 'Tareas', exams: 'Exámenes', timetable: 'Horario',
      messages: 'Mensajes', announcements: 'Anuncios', events: 'Eventos',
      library: 'Biblioteca', medical: 'Médico', transport: 'Transporte',
      boarding: 'Internado', hr: 'RRHH', payroll: 'Nómina',
      leave: 'Permiso', analytics: 'Analíticas',
      settings: 'Configuración', users: 'Usuarios', logs: 'Registros',
      audit: 'Auditoría', domains: 'Dominios',
      subscription: 'Suscripción', invitations: 'Invitaciones',
      visitors: 'Visitantes', ai_assistant: 'Asistente IA', search: 'Buscar',
    },
    finance: {
      fees: 'Estructura de cuotas', invoices: 'Facturas',
      payments: 'Pagos', receipts: 'Recibos', scholarships: 'Becas',
      fines: 'Multas', reports: 'Informes',
      invoice_number: 'N° Factura', payment_method: 'Método de pago',
      amount_due: 'Monto adeudado', amount_paid: 'Monto pagado',
      balance: 'Saldo', status_paid: 'Pagado', status_unpaid: 'Impagado',
      status_partial: 'Parcial', status_overdue: 'Vencido',
      record_payment: 'Registrar pago',
      generate_report: 'Generar informe', total_billed: 'Total facturado',
      total_collected: 'Total recaudado', total_outstanding: 'Pendiente',
      payment_mpesa: 'M-Pesa', payment_cash: 'Efectivo',
      payment_cheque: 'Cheque', payment_bank: 'Transferencia',
      payment_stripe: 'Stripe', payment_paypal: 'PayPal',
      payment_airtel: 'Airtel Money',
    },
    students: {
      admission_number: 'N° de admisión', full_name: 'Nombre completo',
      class: 'Clase', stream: 'Stream', guardian: 'Tutor',
      enroll: 'Matricular', transfer: 'Transferir', graduate: 'Graduar',
      suspend: 'Suspender', status_active: 'Activo',
      status_suspended: 'Suspendido', status_graduated: 'Graduado',
      status_transferred: 'Transferido',
    },
    academics: {
      academic_year: 'Año académico', term: 'Trimestre',
      subject: 'Asignatura', exam: 'Examen',
      report_card: 'Boletín', transcript: 'Expediente',
      promote: 'Promover', score: 'Puntuación', grade: 'Nota',
      position: 'Posición', average: 'Promedio',
    },
    ai: {
      chat: 'Chat', assignment_generator: 'Generador de tareas',
      grading: 'Asistente de calificación',
      lesson_planner: 'Planificador de lecciones',
      quiz_generator: 'Generador de exámenes', student_tutor: 'Tutor IA',
      admin_analytics: 'Analíticas admin',
      principal_insights: 'Perspectivas del director',
      usage_limit: 'Límite de uso', tokens_used: 'Tokens usados',
      powered_by: 'Desarrollado por EduManage AI',
    },
    notifications: {
      mark_all_read: 'Marcar todo leído', unread: 'No leído',
      announcements: 'Anuncios', messages: 'Mensajes',
      finance: 'Finanzas', attendance: 'Asistencia', alerts: 'Alertas',
    },
    settings: {
      language: 'Idioma', theme: 'Tema', dark_mode: 'Modo oscuro',
      light_mode: 'Modo claro', account: 'Cuenta', security: 'Seguridad',
      devices: 'Dispositivos', preferences: 'Preferencias', help: 'Ayuda',
      documentation: 'Documentación', contact_support: 'Contactar soporte',
      about: 'Acerca de', version: 'Versión',
      terms: 'Términos de servicio', privacy: 'Política de privacidad',
    },
    multi_tenant: {
      school: 'Escuela', school_id: 'ID de escuela', tenant: 'Inquilino',
      access_denied: 'Acceso denegado',
      cross_tenant_blocked: 'Acceso entre inquilinos bloqueado',
      subdomain: 'Subdominio', custom_domain: 'Dominio personalizado',
      verify_domain: 'Verificar dominio',
    },
  },
};
