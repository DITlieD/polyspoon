import test from 'node:test';
import assert from 'node:assert/strict';
import {readCatalogFilters,catalogSearch} from '../hosted/app/discovery.ts';

test('catalog filter URLs keep name, type and style while excluding unrelated application state',()=>{
 const filters=readCatalogFilters(new URLSearchParams('q=Garden+bench&type=Furniture&style=faceted-low-poly&view=admin&edit=1'));
 assert.deepEqual(filters,{query:'Garden bench',type:'Furniture',style:'faceted-low-poly',offset:'0'});
 assert.equal(catalogSearch(filters),'?q=Garden+bench&type=Furniture&style=faceted-low-poly');
 assert.deepEqual(readCatalogFilters(new URLSearchParams()),{query:'',type:'',style:'',offset:'0'});
 assert.equal(catalogSearch({query:'',type:'',style:'',offset:'0'}),'');
});

test('catalog filter URLs round-trip punctuation without interpreting facet values as markup or navigation',()=>{
 const filters={query:'wood & metal / #1?',type:'<unknown-type>',style:'painted+soft',offset:'24'};
 const search=catalogSearch(filters);assert.ok(!search.includes('<unknown-type>'));assert.deepEqual(readCatalogFilters(new URLSearchParams(search)),filters);
 assert.equal(new URL('/catalog'+search,'https://polyspoon.example').pathname,'/catalog');
 assert.equal(catalogSearch(readCatalogFilters(new URLSearchParams('view=review&edit=1'))),'');
});

test('catalog URLs preserve page offsets on model and back navigation',()=>{
 const filters=readCatalogFilters(new URLSearchParams('q=bench&type=Props&style=faceted-low-poly&offset=24'));
 assert.equal(filters.offset,'24');assert.equal(catalogSearch(filters),'?q=bench&type=Props&style=faceted-low-poly&offset=24');
 assert.equal(catalogSearch({...filters,offset:'0'}),'?q=bench&type=Props&style=faceted-low-poly');
 assert.equal(readCatalogFilters(new URLSearchParams('offset=invalid')).offset,'invalid');
});
