export default function CompareLoading() {
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="h-9 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="h-72 w-full animate-pulse rounded-2xl border bg-card" />
    </main>
  )
}
