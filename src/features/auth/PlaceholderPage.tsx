export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 px-4 py-24 text-center font-flat">
      <span className="text-4xl opacity-40">🚧</span>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">Pendiente de implementar.</p>
    </div>
  )
}
