export default function Loading() {
  return (
    <div aria-busy="true" className="animate-pulse">
      <div className="mb-6 h-8 w-48 rounded-xl bg-surface-2" />
      <div className="h-64 rounded-3xl bg-surface-2" />
    </div>
  );
}
