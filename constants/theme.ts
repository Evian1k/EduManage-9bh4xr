// EduManage Design System

export const Colors = {
  // Backgrounds
  background: '#0B1426',
  surface: '#132035',
  surface2: '#1A2B45',
  surface3: '#1E3358',

  // Brand
  primary: '#2196F3',
  primaryLight: '#42A5F5',
  primaryDark: '#1565C0',
  secondary: '#00B4D8',
  secondaryLight: '#48CAE4',

  // Role Colors
  superAdmin: '#FFD60A',
  superAdminBg: 'rgba(255, 214, 10, 0.1)',
  schoolAdmin: '#2196F3',
  schoolAdminBg: 'rgba(33, 150, 243, 0.1)',
  teacher: '#AB47BC',
  teacherBg: 'rgba(171, 71, 188, 0.1)',
  student: '#00B4D8',
  studentBg: 'rgba(0, 180, 216, 0.1)',

  // Semantic
  success: '#4CAF50',
  successBg: 'rgba(76, 175, 80, 0.12)',
  warning: '#FF9800',
  warningBg: 'rgba(255, 152, 0, 0.12)',
  error: '#F44336',
  errorBg: 'rgba(244, 67, 54, 0.12)',
  info: '#2196F3',
  infoBg: 'rgba(33, 150, 243, 0.12)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#9BA3B2',
  textMuted: '#5C6680',
  textLink: '#42A5F5',

  // Border
  border: '#1E3358',
  borderLight: '#243755',

  // Plans
  free: '#9BA3B2',
  basic: '#4CAF50',
  pro: '#2196F3',
  enterprise: '#FFD60A',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
};
