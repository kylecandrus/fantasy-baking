'use client';

// Mounts the onboarding modal globally so it shows up no matter which page
// a player lands on first (e.g. a deep link straight to /picks), not just
// the home page. `layout.tsx` is a server component, so this tiny client
// wrapper is what lets it render a client component.
import Onboarding from '@/components/Onboarding';

export default function OnboardingMount() {
  return <Onboarding />;
}
