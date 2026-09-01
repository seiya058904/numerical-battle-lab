(function (root) {
  'use strict';
  const NCB = root.NCB = root.NCB || {};

  // Directly derived from Pokémon Showdown's Gen5RNG arithmetic and
  // Battle.comparePriority/BattleQueue ordering semantics (MIT).
  class Gen5PRNG {
    constructor(seed) {
      const parts = Array.isArray(seed) ? seed.slice() : String(seed || 'gen5,1,2,3,4').split(',');
      if (parts[0] === 'gen5') parts.shift();
      const nums = parts.map(Number);
      if (nums.length !== 4 || nums.some(n => !Number.isInteger(n) || n < 0 || n > 0xffff)) {
        throw new Error('Invalid Gen5 seed');
      }
      this.seed = nums;
      this.startingSeed = this.getSeed();
    }
    getSeed() { return `gen5,${this.seed.join(',')}`; }
    clone() { return new Gen5PRNG(this.getSeed()); }
    multiplyAdd(a, b, c) {
      const out = [0, 0, 0, 0];
      let carry = 0;
      for (let outIndex = 3; outIndex >= 0; outIndex--) {
        for (let bIndex = outIndex; bIndex < 4; bIndex++) {
          const aIndex = 3 - (bIndex - outIndex);
          carry += a[aIndex] * b[bIndex];
        }
        carry += c[outIndex];
        out[outIndex] = carry & 0xffff;
        carry >>>= 16;
      }
      return out;
    }
    next() {
      this.seed = this.multiplyAdd(this.seed, [0x5d58, 0x8b65, 0x6c07, 0x8965], [0, 0, 0x26, 0x9ec3]);
      return (this.seed[0] << 16 >>> 0) + this.seed[1];
    }
    random(from, to) {
      const result = this.next();
      if (from === undefined) return result / 2 ** 32;
      from = Math.floor(from);
      if (to === undefined) return Math.floor(result * from / 2 ** 32);
      to = Math.floor(to);
      return Math.floor(result * (to - from) / 2 ** 32) + from;
    }
    randomChance(n, d) { return this.random(d) < n; }
    sample(items) {
      if (!items.length) throw new RangeError('Cannot sample empty array');
      return items[this.random(items.length)];
    }
    shuffle(items, start = 0, end = items.length) {
      while (start < end - 1) {
        const nextIndex = this.random(start, end);
        if (start !== nextIndex) [items[start], items[nextIndex]] = [items[nextIndex], items[start]];
        start++;
      }
      return items;
    }
  }

  function comparePriority(a, b) {
    const aOrder = a.order || 4294967296;
    const bOrder = b.order || 4294967296;
    return -(bOrder - aOrder) ||
      ((b.priority || 0) - (a.priority || 0)) ||
      ((b.speed || 0) - (a.speed || 0)) ||
      -((b.subOrder || 0) - (a.subOrder || 0)) ||
      -((b.effectOrder || 0) - (a.effectOrder || 0)) || 0;
  }

  function sortActions(actions, prng) {
    const result = actions.slice();
    prng.shuffle(result); // Showdown-style deterministic tie randomization.
    result.sort(comparePriority);
    return result;
  }

  class EventKernel {
    constructor(options = {}) {
      this.depth = 0;
      this.maxDepth = options.maxDepth || 32;
      this.discover = options.discover || (() => []);
      this.globalEffects = options.globalEffects || [];
      this.trace = [];
    }
    compare(a, b) {
      const ao = a.order || 4294967296;
      const bo = b.order || 4294967296;
      return -(bo - ao) || (b.priority || 0) - (a.priority || 0) ||
        -((b.subOrder || 0) - (a.subOrder || 0)) ||
        -((b.effectOrder || 0) - (a.effectOrder || 0)) || 0;
    }
    run(event, target, relay, source, data) {
      if (this.depth >= this.maxDepth) throw new Error(`Event recursion limit exceeded at ${event}`);
      const handlers = [...this.discover(target, event, source), ...this.globalEffects]
        .filter(h => h && h.event === event && typeof h.callback === 'function')
        .sort((a,b) => this.compare(a,b));
      this.depth++;
      try {
        for (const h of handlers) {
          const before = relay;
          const result = h.callback({kernel:this,event,target,source,relay,data,effect:h});
          if (result !== undefined) relay = result;
          this.trace.push({event,targetId:target?.id,before,after:relay,effectId:h.id});
          if (relay === false || relay === null) break;
        }
      } finally { this.depth--; }
      return relay;
    }
  }

  NCB.Gen5PRNG = Gen5PRNG;
  NCB.comparePriority = comparePriority;
  NCB.sortActions = sortActions;
  NCB.EventKernel = EventKernel;
  if (typeof module !== 'undefined') module.exports = NCB;
})(typeof globalThis !== 'undefined' ? globalThis : window);
