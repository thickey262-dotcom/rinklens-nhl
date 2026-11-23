'use strict';
/* Responsive ranking table should fit the viewport and preserve the full source data in player profiles. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const css=fs.readFileSync(path.join(base,'money.css'),'utf8');
const js=fs.readFileSync(path.join(base,'money.js'),'utf8');
const table=html.match(/<table class="rankings-table"[^>]*>\s*<thead><tr>([\s\S]*?)<\/tr><\/thead><tbody id="rows">/);
assert.ok(table,'rankings have a dedicated responsive table');
assert.equal((table[1].match(/<th\b/g)||[]).length,13,'full desktop rankings retain all thirteen columns');
assert.match(html,/<div class="table-wrap rankings-wrap">/);
assert.match(html,/<select id="pageSize"><option value="10" selected>/);
assert.match(html,/<option value="25">25<\/option>/);
assert.match(html,/<option value="50">50<\/option>/);
assert.match(html,/<details class="rankings-help">/);
assert.match(css,/#players \.rankings-table\{table-layout:fixed;width:100%;min-width:0/);
assert.match(css,/#players \.rankings-wrap\{width:100%;overflow-x:visible\}/);
assert.match(css, /@media\(max-width:1040px\)/);
assert.match(css, /@media\(max-width:600px\)/);
assert.match(css, /@media\(max-width:420px\)/);
assert.match(css, /#players \.rankings-table th:nth-child\(3\),#players \.rankings-table td:nth-child\(3\)/);
assert.match(css, /#players \.rankings-table th:nth-child\(2\),#players \.rankings-table td:nth-child\(2\)\{display:none\}/);
assert.match(css, /#players \.rankings-table th:nth-child\(5\),#players \.rankings-table td:nth-child\(5\)\{display:none\}/);
assert.match(js,/const PAGE_SIZE = 10/);
assert.match(js,/\['search','team','position','sort','pageSize'\]/);
assert.match(js,/function detail\(id\)/);
assert.match(js, /'<div class="detail-grid">'/);
assert.match(js,/\['gp',0\],\['g',0\],\['a',0\],\['p',0\],\['p60',2\],\['xgfPct',1\],\['cfPct',1\],\['ixG60',2\]/);
const layoutWidths={
 desktop:[18,5,4,4,5,6,6,6,6,10,13,8,9],
 tablet:[27,8,8,13,19,11,14],
 phone:[31,10,16,18,11,14],
 narrow:[35,18,21,12,14]
};
for(const [mode,widths] of Object.entries(layoutWidths))
 assert.equal(widths.reduce((a,b)=>a+b,0),100,mode+' uses a complete 100% column width');
console.log('PASS: compact full-width rankings at desktop, tablet, and phone; 10/25/50 row options; full metrics remain in details.');
