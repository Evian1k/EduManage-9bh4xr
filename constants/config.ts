export const APP_NAME = 'EduManage';
export const APP_VERSION = '1.0.0';

export const ROLES = {
  PLATFORM_ADMIN: 'platform_admin',
  SCHOOL_ADMIN: 'admin',
  TEACHER: 'teacher',
  ICT_MANAGER: 'ict_manager',
  ACCOUNTANT: 'accountant',
  CLERK: 'clerk',
  STUDENT: 'student',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

export const PLANS = {
  FREE_TRIAL: 'free_trial',
  BASIC: 'basic',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export const PLAN_LIMITS = {
  free_trial: { maxStudents: 50, maxTeachers: 5, aiUsageLimit: 50, label: 'Free Trial' },
  basic: { maxStudents: 200, maxTeachers: 20, aiUsageLimit: 200, label: 'Basic' },
  pro: { maxStudents: 1000, maxTeachers: 100, aiUsageLimit: 1000, label: 'Pro' },
  enterprise: { maxStudents: 99999, maxTeachers: 9999, aiUsageLimit: 99999, label: 'Enterprise' },
};

export const PLAN_PRICES = {
  basic: { monthly: 29, yearly: 290 },
  pro: { monthly: 79, yearly: 790 },
  enterprise: { monthly: 199, yearly: 1990 },
};

export const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const TERMS = ['First Term', 'Second Term', 'Third Term'];

export const ASSIGNMENT_TYPES = ['homework', 'quiz', 'exam', 'project', 'test'];

export const GRADE_SCALE = [
  { min: 90, letter: 'A+', remark: 'Excellent' },
  { min: 80, letter: 'A', remark: 'Very Good' },
  { min: 70, letter: 'B', remark: 'Good' },
  { min: 60, letter: 'C', remark: 'Average' },
  { min: 50, letter: 'D', remark: 'Below Average' },
  { min: 0, letter: 'F', remark: 'Fail' },
];

export function getGradeLetter(score: number): { letter: string; remark: string } {
  for (const g of GRADE_SCALE) {
    if (score >= g.min) return { letter: g.letter, remark: g.remark };
  }
  return { letter: 'F', remark: 'Fail' };
}

export function getPlanColor(plan: string): string {
  const colors: Record<string, string> = {
    free_trial: '#9BA3B2',
    basic: '#4CAF50',
    pro: '#2196F3',
    enterprise: '#FFD60A',
  };
  return colors[plan] || '#9BA3B2';
}

export function getPlanLabel(plan: string): string {
  return PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS]?.label || plan;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

export function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return 'N/A';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
