/**
 * Marketing panel upstream shows beside the signup form on Dokploy Cloud.
 *
 * `register.tsx` only mounts it when `IS_CLOUD` is set, which this fork never sets, so it
 * renders nothing. The export exists to satisfy that import.
 */
export const SignupShowcase = () => null;
