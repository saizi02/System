/** CSV output safe for Excel: quotes, BOM for UTF-8, and a leading apostrophe on cells that could run as formulas. */
export const csvCell=v=>{let s=v==null?'':String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return/[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
export const csv=(head,rows)=>'﻿'+[head,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
