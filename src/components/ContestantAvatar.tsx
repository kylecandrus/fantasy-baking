import { Contestant } from '@/lib/types';

interface ContestantAvatarProps {
  contestant: Pick<Contestant, 'name' | 'image_url'>;
  /** Size, text and spacing classes, e.g. "w-12 h-12 text-sm" */
  className?: string;
}

// Baker headshot, or their initial until a photo is uploaded in Admin > Contestants.
export default function ContestantAvatar({ contestant, className = 'w-12 h-12 text-sm' }: ContestantAvatarProps) {
  if (contestant.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL; next/image would need remotePatterns
      <img src={contestant.image_url} alt="" className={`rounded-full object-cover shrink-0 ${className}`} />
    );
  }
  return (
    <div className={`rounded-full bg-cream flex items-center justify-center text-ink-muted font-semibold shrink-0 ${className}`}>
      {contestant.name[0]}
    </div>
  );
}
