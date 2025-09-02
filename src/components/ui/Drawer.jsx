import React from 'react'
export default function Drawer({ open, onClose, children, side='right' }){
  return (
    <div className={(open ? 'pointer-events-auto' : 'pointer-events-none') + ' fixed inset-0 z-50'}>
      <div onClick={onClose} className={(open?'opacity-100':'opacity-0') + ' absolute inset-0 bg-black/40 transition-opacity'} />
      <aside className={(open?'translate-x-0':'translate-x-full') + ' absolute top-0 h-full w-full max-w-md bg-white shadow-2xl transition-transform ' + (side==='right' ? 'right-0' : 'left-0')}>
        {children}
      </aside>
    </div>
  )
}