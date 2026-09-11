import { type ReactNode } from 'react'

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 md:px-16">
      <h1 className="text-4xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: {updated}</p>
      <div className="prose prose-neutral mt-10 flex flex-col gap-6 text-base leading-relaxed text-foreground [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_li]:text-muted-foreground [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-1.5 [&_ol]:pl-5 [&_p]:text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </div>
  )
}
