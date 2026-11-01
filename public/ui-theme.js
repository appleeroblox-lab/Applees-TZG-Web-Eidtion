// Keep icon-only controls square, including controls added by chat and menus.
export function installUITheme(doc=document){
 const mark=button=>{const text=(button.textContent||'').trim();const iconOnly=(!text&&!!button.querySelector('img,svg'))||(/^[^\p{L}\p{N}]{1,3}$/u.test(text)&&text.length<5);button.toggleAttribute('data-icon-only',iconOnly&&!button.closest('#flightPad,#flightRight,#walkTouch,#touchControls'))};
 const scan=node=>{if(node.nodeType!==1)return;if(node.matches('button'))mark(node);node.querySelectorAll('button').forEach(mark)};scan(doc.body);
 const Observer=doc.defaultView?.MutationObserver||globalThis.MutationObserver;if(!Observer)return ()=>{};const observer=new Observer(records=>{for(const record of records){const button=record.target.nodeType===1?record.target.closest('button'):record.target.parentElement?.closest('button');if(button)mark(button);for(const node of record.addedNodes)scan(node)}});observer.observe(doc.body,{childList:true,subtree:true,characterData:true});return ()=>observer.disconnect();
}
