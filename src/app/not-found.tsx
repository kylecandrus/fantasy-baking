import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h1 className="font-display text-4xl text-ink mb-2">404</h1>
      <p className="text-ink-muted mb-6">This page doesn&apos;t exist.</p>
      <Link href="/" className="btn btn-primary">Back to Home</Link>
    </div>
  );
}
