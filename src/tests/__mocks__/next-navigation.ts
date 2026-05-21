/**
 * Minimal mock for `next/navigation` used in Jest tests that import Next.js
 * app-router modules. Only stubs are provided; add entries as needed.
 */
export const useRouter = () => ({ push: () => {}, replace: () => {}, prefetch: () => {} });
export const usePathname = () => '/';
export const useSearchParams = () => new URLSearchParams();
export const redirect = (url: string) => { throw new Error(`redirect(${url})`); };
