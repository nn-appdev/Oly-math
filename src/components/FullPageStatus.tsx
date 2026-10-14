export function FullPageStatus({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ground p-6">
      <div role="status" aria-live="polite" className="flex items-center gap-4 text-ink-soft">
        <span
          aria-hidden="true"
          className="h-8 w-8 animate-spin rounded-full border-4 border-teal-100 border-t-teal-600 motion-reduce:animate-none"
        />
        <p className="text-lg font-semibold">{message}</p>
      </div>
    </div>
  );
}
