'use client';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Combobox,ComboboxInput,ComboboxContent,ComboboxList,ComboboxItem,ComboboxEmpty} from '@/components/ui/combobox';
import type {Guest} from '@/lib/domain';
export function Choice({label,value,onChange,options,disabled=false}:{label:string;value:string;onChange:(v:string)=>void;options:readonly string[];disabled?:boolean}){return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger className="choice" aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{options.map(o=><SelectItem value={o} key={o}>{o}</SelectItem>)}</SelectContent></Select>}
export function GuestPicker({guests,value,onChange}:{guests:Guest[];value:string;onChange:(v:string)=>void}){const items=guests.map(g=>({value:g.id,label:g.name+' — Room '+g.room+' — Checkout '+g.departure}));return <Combobox items={items} value={items.find(i=>i.value===value)||null} onValueChange={item=>onChange(item?.value||'')} itemToStringLabel={item=>item.label}><ComboboxInput aria-label="Select guest" placeholder="Search guest name or room"/><ComboboxContent><ComboboxEmpty>No matching guests</ComboboxEmpty><ComboboxList>{item=><ComboboxItem key={item.value} value={item}>{item.label}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox>}

