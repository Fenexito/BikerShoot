export const cn = (...cls) => cls.filter(Boolean).join(' ');
export const isAuthPath = (p) => ['/login','/login-fotografo','/signup','/signup-fotografo','/set-password'].includes(p);
export const isUserPortal = (p) => p.startsWith('/app');
export const isStudioPortal = (p) => p.startsWith('/studio');
export const isPublic = (p) => !(isAuthPath(p) || isUserPortal(p) || isStudioPortal(p));
export const isDarkRoute = (p) => isStudioPortal(p) || ['/login-fotografo','/signup-fotografo','/eres-fotografo'].includes(p);
