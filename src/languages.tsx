export const LANGUAGES=['PT','EN','FR','ES','DE'] as const;
export const LANGUAGE_NAMES:Record<string,string>={PT:'Português',EN:'Inglês',FR:'Francês',ES:'Espanhol',DE:'Alemão'};
export function orderedContents<T extends{language:string}>(items:T[]):T[]{return [...items].sort((a,b)=>LANGUAGES.indexOf(a.language as typeof LANGUAGES[number])-LANGUAGES.indexOf(b.language as typeof LANGUAGES[number]));}
export function LanguagePicker({value,onChange,disabled=false,reviewed=[]}:{value:string;onChange:(v:string)=>void;disabled?:boolean;reviewed?:string[]}){
 return <fieldset className="language-picker" disabled={disabled}><legend>Idioma do título e da descrição</legend><div className="row-start">{LANGUAGES.map(l=><button type="button" className={`btn ${value===l?'btn-primary':'btn-secondary'}`} aria-pressed={value===l} key={l} onClick={()=>onChange(l)}>{l} · {LANGUAGE_NAMES[l]}{reviewed.includes(l)?' · revisto':''}</button>)}</div><p className="muted">A mesma ordem do eGO. O título e a descrição mudam em conjunto.</p></fieldset>;
}
