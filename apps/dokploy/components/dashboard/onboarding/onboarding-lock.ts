// Session storage, not local: the flag re-opens the wizard so a reload or an OAuth round trip
// resumes where it left off, but it must not outlive the tab. In localStorage an abandoned wizard
// reopens on every later visit, and the next person to sign in on that browser inherits it.
const ONBOARDING_ACTIVE_KEY = "dokploy_onboarding_active";
const ONBOARDING_STATE_KEY = "dokploy_onboarding_state";

interface OnboardingState {
	stepId?: string;
	projectId?: string;
	environmentId?: string;
}

export const isOnboardingActive = () => {
	if (typeof window === "undefined") return false;
	try {
		return window.sessionStorage.getItem(ONBOARDING_ACTIVE_KEY) === "true";
	} catch {
		return false;
	}
};

export const markOnboardingActive = () => {
	try {
		window.sessionStorage.setItem(ONBOARDING_ACTIVE_KEY, "true");
	} catch {}
};

export const clearOnboardingActive = () => {
	try {
		window.sessionStorage.removeItem(ONBOARDING_ACTIVE_KEY);
		window.sessionStorage.removeItem(ONBOARDING_STATE_KEY);
	} catch {}
};

export const getOnboardingState = (): OnboardingState => {
	if (typeof window === "undefined") return {};
	try {
		const raw = window.sessionStorage.getItem(ONBOARDING_STATE_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
};

export const setOnboardingState = (state: OnboardingState) => {
	try {
		window.sessionStorage.setItem(
			ONBOARDING_STATE_KEY,
			JSON.stringify({ ...getOnboardingState(), ...state }),
		);
	} catch {}
};
