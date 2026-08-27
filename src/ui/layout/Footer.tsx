export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white py-8 text-sm text-slate-500">
      <div className="mx-auto max-w-6xl px-4">
        © {new Date().getFullYear()} MotoShots. Todos los derechos reservados.
      </div>
    </footer>
  )
}
