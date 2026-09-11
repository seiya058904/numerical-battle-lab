'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CARDS } = require('../src/cards.js');
const { buildUnit, battlePower } = require('../src/power.js');
test('BP reads final attributes only and ignores mutable battle state', () => {
  for (const card of CARDS) {
    const u = buildUnit(card, 50), expected = battlePower(u);
    const altered = { ...u, hp: 0, alive: false, cardId: 'other', name: 'other', role: 'other', level: 1, rarity: 11, rarityName: 'other', volatility: .9 };
    assert.equal(battlePower(altered), expected);
    for (const key of ['hp','alive','cardId','name','role','level','rarity','rarityName','volatility']) Object.defineProperty(altered,key,{get(){throw new Error('Forbidden BP read: '+key);}});
    assert.equal(battlePower(altered), expected);
  }
});
test('beneficial attribute changes are monotone, crit contracts use expected multiplier', () => {
  for (const card of CARDS) for (const level of [1,25,55,100]) {
    const u = buildUnit(card, level), bp = battlePower(u);
    for (const key of ['maxHp','atk','def','spd','acc','eva','pen','lifesteal','hpRegen','crit','critDmg']) {
      const delta = ['pen','lifesteal','hpRegen','crit'].includes(key) ? .01 : Math.max(1,u[key]*.1);
      assert.ok(battlePower({...u,[key]:u[key]+delta})>=bp, key+' '+card.id);
    }
    assert.equal(battlePower({...u,crit:0,critDmg:1.2}),battlePower({...u,crit:0,critDmg:2}));
    assert.equal(battlePower({...u,crit:0,critDmg:1}),battlePower({...u,crit:.5,critDmg:1}));
  }
});
