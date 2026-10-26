const paths:Record<string,string>={
 palette:'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4c-1-1 0-2 1-2h2a4 4 0 0 0 4-4 9 9 0 0 0-9-8ZM7 8h.01M11 6h.01M16 8h.01M7 13h.01',
 brush:'m14 4 6 6-9 9-5-5 8-10ZM6 14c-3 0-4 3-3 7 4 0 7-1 7-4',
 width:'M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3',
 height:'M12 3v18M9 6l3-3 3 3M9 18l3 3 3-3',
 depth:'m5 19 14-14M13 5h6v6M5 13v6h6',
 layers:'m3 8 9-5 9 5-9 5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5',
 build:'M5 21V8l7-5 7 5v13M3 21h18M8 11h8M8 15h8M10 21v-3h4v3',
 shape:'M4 6h16v12H4ZM8 3v6M16 15v6',
 more:'M5 12h.01M12 12h.01M19 12h.01',
 frame:'M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6M9 9h6v6H9Z',
 shading:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 3v18M15 5v14M18 8v8',
 underwater:'M3 7c3-4 6 4 9 0s6 4 9 0M3 12c3-4 6 4 9 0s6 4 9 0M3 17c3-4 6 4 9 0s6 4 9 0',
 dither:'M5 5h.01M12 5h.01M19 5h.01M8 9h.01M16 9h.01M5 13h.01M12 13h.01M19 13h.01M8 18h.01M16 18h.01',
 wobble:'M4 5h6v4h5v5h5v6M4 20h5v-5h5v-5h6',
 outline:'M4 5h16v14H4ZM8 9h8v6H8Z',
 wireframe:'m12 3 9 5v9l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v9M12 3v10',
 pixelate:'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
};
export function toolIcon(name:string){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
 for(const [key,value] of Object.entries({fill:'none',stroke:'currentColor','stroke-width':'1.65','stroke-linecap':'round','stroke-linejoin':'round'}))svg.setAttribute(key,value);
 const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]??paths.shape!);svg.append(path);return svg;
}
