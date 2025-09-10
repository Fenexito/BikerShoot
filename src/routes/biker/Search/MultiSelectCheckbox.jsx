// src/ui/MultiSelectCheckbox.jsx
import React, { useEffect, useRef, useState } from "react";

/**
 * props:
 * - options: [{ value, label }]
 * - value:   string[] (values seleccionados)
 * - onChange: (newArray: string[]) => void
 * - placeholder?: string
 */
export default function MultiSelectCheckbox({
  options = [],
  value = [],
  onChange,
  placeholder = "Seleccionar...",
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const toggle = (val) => {
    const set = new Set(value.map(String));
    set.has(val) ? set.delete(val) : set.add(val);
    onChange(Array.from(set));
  };

  const allValues = options.map((o) => String(o.value));
  const isAllSelected =
    value.length > 0 && value.length === options.length;

  const toggleAll = () => {
    if (isAllSelected) onChange([]);
    else onChange(allValues);
  };

  const labelText = (() => {
    if (!value || value.length === 0) return placeholder;
    if (value.length === 1) {
      const opt = options.find(
        (o) => String(o.value) === String(value[0])
      );
      return opt?.label || placeholder;
    }
    return `${value.length} seleccionados`;
  })();

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        className="h-9 min-w-[200px] w-full text-left border rounded-lg px-2 bg-white"
        onClick={() => setOpen((v) => !v)}
      >
        {labelText}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-[260px] max-h-64 overflow-auto rounded-lg border bg-white shadow">
          {/* Header con "Seleccionar todo" */}
          <div className="px-2 py-1 border-b bg-slate-50 sticky top-0">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={isAllSelected}
                onChange={toggleAll}
              />
              <span>Seleccionar todo</span>
            </label>
          </div>

          <div className="p-2 space-y-1">
            {options.length === 0 && (
              <div className="text-xs text-slate-500 px-1 py-2">
                No hay opciones
              </div>
            )}
            {options.map((opt) => {
              const v = String(opt.value);
              const checked = value.map(String).includes(v);
              return (
                <label
                  key={v}
                  className="flex items-center gap-2 text-sm cursor-pointer px-1 py-1 rounded hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={checked}
                    onChange={() => toggle(v)}
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
