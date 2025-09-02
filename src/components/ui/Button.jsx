export default function Button({ as:Comp='button', className='', children, ...props }){
  return <Comp className={'px-4 py-2 rounded-xl font-bold ' + className} {...props}>{children}</Comp>
}