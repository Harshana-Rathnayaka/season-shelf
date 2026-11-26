import type { InputHTMLAttributes } from 'react';
import { useAsyncAction } from './useAsyncAction';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role' | 'className'> {
  label: string;
  text?: string;
  className?: string;
  onCheckedChange?: (checked: boolean) => Promise<void>;
}
export function Switch({label,text,className='',onCheckedChange,...props}:Props) {
  const {pending,run}=useAsyncAction();
  return <label className={`switch-control ${className}`}>
    <input {...props} type="checkbox" role="switch" className="switch-input" aria-label={label} aria-checked={props.checked}
      disabled={props.disabled || pending} aria-busy={pending || undefined} onClick={event=>event.stopPropagation()}
      onChange={onCheckedChange ? event=>{event.stopPropagation();const checked=event.currentTarget.checked;void run(()=>onCheckedChange(checked));} : props.onChange} />
    {text ? <span>{text}</span> : <span className="switch-state" aria-hidden="true"><span>On</span><span>Off</span></span>}
  </label>;
}
