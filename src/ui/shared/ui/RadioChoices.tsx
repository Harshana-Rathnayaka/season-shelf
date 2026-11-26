import { useAsyncAction } from './useAsyncAction';

interface Props {
  label:string; name:string; options:ReadonlyArray<{value:string;label:string}>;
  value?:string; defaultValue?:string; disabled?:boolean; hideLabel?:boolean;
  onValueChange?:(value:string)=>Promise<void>;
}
export function RadioChoices({label,name,options,value,defaultValue,disabled,hideLabel,onValueChange}:Props) {
  const {pending,run}=useAsyncAction();
  return <fieldset className="radio-choices" disabled={disabled || pending} aria-busy={pending || undefined}>
    <legend className={hideLabel?'sr-only':undefined}>{label}</legend><div>{options.map(option=><label key={option.value}>
      <input type="radio" name={name} value={option.value} {...(value===undefined?{defaultChecked:defaultValue===option.value}:{checked:value===option.value})}
        onChange={onValueChange ? event=>{event.stopPropagation();const next=event.currentTarget.value;void run(()=>onValueChange(next));} : undefined} />
      <span>{option.label}</span>
    </label>)}</div>
  </fieldset>;
}
